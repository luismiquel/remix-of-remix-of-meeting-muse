import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export interface Task {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

const initialTasks: Task[] = [
  {
    id: 'understand',
    label: 'Analizando contenido',
    description: 'Procesando transcript y prompts con IA',
    status: 'pending',
  },
  {
    id: 'outline',
    label: 'Creando outline',
    description: 'Generando estructura y contenido de diapositivas',
    status: 'pending',
  },
  {
    id: 'database',
    label: 'Guardando estructura',
    description: 'Almacenando descripciones en base de datos',
    status: 'pending',
  },
  {
    id: 'images',
    label: 'Generando imágenes',
    description: 'Creando visuales para cada diapositiva',
    status: 'pending',
  },
  {
    id: 'pdf',
    label: 'Compilando PDF',
    description: 'Unificando todas las diapositivas en un documento',
    status: 'pending',
  },
];

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to invoke edge function with custom timeout
const invokeWithTimeout = async (functionName: string, body: any, timeoutMs: number = 90000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: { message: `HTTP ${response.status}: ${errorText}` } };
    }
    
    return { data: await response.json(), error: null };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return { data: null, error: { message: `Timeout: La operación tardó más de ${timeoutMs/1000} segundos` } };
    }
    return { data: null, error: { message: error.message || 'Error de conexión' } };
  }
};

// Generic retry helper for edge functions
const invokeWithRetry = async (
  functionName: string, 
  body: any, 
  timeoutMs: number,
  maxRetries: number,
  addLog: (msg: string) => void,
  stepName: string
): Promise<{ data: any; error: any }> => {
  let retries = maxRetries;
  
  while (retries > 0) {
    const attemptNumber = maxRetries - retries + 1;
    const retryDelay = attemptNumber * 5000; // 5s, 10s, 15s
    
    try {
      addLog(`${stepName} (intento ${attemptNumber}/${maxRetries}, timeout: ${timeoutMs/1000}s)...`);
      
      const { data, error } = await invokeWithTimeout(functionName, body, timeoutMs);
      
      if (error) {
        retries--;
        if (retries > 0) {
          addLog(`Error: ${error.message}. Reintentando en ${retryDelay/1000}s...`);
          await delay(retryDelay);
          continue;
        }
        return { data: null, error: { message: `Error después de ${maxRetries} intentos: ${error.message}` } };
      }
      
      if (data?.error) {
        retries--;
        if (retries > 0) {
          addLog(`Error servidor: ${data.error}. Reintentando en ${retryDelay/1000}s...`);
          await delay(retryDelay);
          continue;
        }
        return { data: null, error: { message: `Error servidor después de ${maxRetries} intentos: ${data.error}` } };
      }
      
      return { data, error: null };
      
    } catch (e: any) {
      retries--;
      if (retries > 0) {
        addLog(`Excepción: ${e.message}. Reintentando en ${retryDelay/1000}s...`);
        await delay(retryDelay);
      } else {
        return { data: null, error: { message: `Excepción después de ${maxRetries} intentos: ${e.message}` } };
      }
    }
  }
  
  return { data: null, error: { message: 'Error desconocido' } };
};

export const usePresentationCreation = () => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [slideProgress, setSlideProgress] = useState({ completed: 0, total: 0 });
  const [lastPresentationId, setLastPresentationId] = useState<string | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  const updateTaskStatus = (taskId: string, status: Task['status'], errorMessage?: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, status, errorMessage } : task
    ));
  };

  const resetState = () => {
    setTasks(initialTasks);
    setPdfUrl(null);
    setLogs([]);
    setSlideProgress({ completed: 0, total: 0 });
    setLastPresentationId(null);
  };

  // Function to retry only PDF generation
  const retryPdfOnly = async () => {
    if (!lastPresentationId) {
      toast.error('No hay presentación para reintentar');
      return;
    }

    setIsProcessing(true);
    updateTaskStatus('pdf', 'processing', undefined);
    addLog('Reintentando generación de PDF...');

    try {
      const { data: pdfResult, error: pdfError } = await invokeWithRetry(
        'create-pdf',
        { presentationId: lastPresentationId },
        120000, // 2 minutes timeout
        3,
        addLog,
        'Generando PDF'
      );

      if (pdfError) {
        addLog(`ERROR: ${pdfError.message}`);
        updateTaskStatus('pdf', 'error', pdfError.message);
        toast.error(pdfError.message || 'Error al crear PDF');
        return;
      }

      // Update presentation with PDF URL
      await supabase
        .from('presentations')
        .update({ pdf_url: pdfResult.pdfUrl, status: 'completed' })
        .eq('id', lastPresentationId);

      updateTaskStatus('pdf', 'completed');
      setPdfUrl(pdfResult.pdfUrl!);
      addLog('¡PDF generado exitosamente!');
      addLog(`PDF disponible en: ${pdfResult.pdfUrl}`);
      toast.success('¡PDF creado exitosamente!');

    } catch (error: any) {
      console.error('Error retrying PDF:', error);
      addLog(`ERROR: ${error.message || 'Error desconocido'}`);
      updateTaskStatus('pdf', 'error', error.message);
      toast.error(error.message || 'Error al crear PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const createPresentation = async (data: {
    systemPrompt: string;
    userPrompt: string;
    stylePrompt: string;
    transcript: string;
  }) => {
    setIsProcessing(true);
    setShowProgress(true);
    resetState();
    addLog('Iniciando proceso de creación de presentación...');

    try {
      // Step 1: Analyze content with retries
      updateTaskStatus('understand', 'processing');
      addLog('Paso 1: Analizando transcript con Gemini 3 Pro...');
      
      const { data: analysisResult, error: analysisError } = await invokeWithRetry(
        'analyze-transcript',
        {
          systemPrompt: data.systemPrompt,
          userPrompt: data.userPrompt,
          transcript: data.transcript,
        },
        90000, // 90 seconds timeout
        3,     // 3 retries
        addLog,
        'Analizando transcript'
      );

      if (analysisError) {
        throw new Error(`Error al analizar el transcript: ${analysisError.message}`);
      }

      addLog('Análisis completado exitosamente');
      addLog(`Longitud del análisis: ${analysisResult.analysis?.length || 0} caracteres`);
      updateTaskStatus('understand', 'completed');

      // Step 2: Create outline with retries
      updateTaskStatus('outline', 'processing');
      addLog('Paso 2: Creando outline de presentación con Gemini 3 Pro...');
      
      const { data: outlineResult, error: outlineError } = await invokeWithRetry(
        'create-outline',
        {
          analysis: analysisResult.analysis,
          stylePrompt: data.stylePrompt,
        },
        90000, // 90 seconds timeout
        3,     // 3 retries
        addLog,
        'Creando outline'
      );

      if (outlineError) {
        throw new Error(`Error al crear el outline: ${outlineError.message}`);
      }

      addLog(`Outline creado con ${outlineResult.outline?.slides?.length || 0} diapositivas`);
      updateTaskStatus('outline', 'completed');

      // Step 3: Save to database with retries
      updateTaskStatus('database', 'processing');
      addLog('Paso 3: Guardando en base de datos...');
      
      let presentation: any = null;
      let dbRetries = 3;
      
      while (dbRetries > 0 && !presentation) {
        const attemptNumber = 4 - dbRetries;
        const retryDelay = attemptNumber * 5000;
        
        try {
          addLog(`Guardando presentación (intento ${attemptNumber}/3)...`);
          
          const { data: dbData, error: dbError } = await supabase
            .from('presentations')
            .insert({
              system_prompt: data.systemPrompt,
              user_prompt: data.userPrompt,
              style_prompt: data.stylePrompt,
              transcript: data.transcript,
              outline: outlineResult.outline,
              status: 'processing',
              user_id: user?.id,
            })
            .select()
            .single();

          if (dbError) {
            dbRetries--;
            if (dbRetries > 0) {
              addLog(`Error en BD: ${dbError.message}. Reintentando en ${retryDelay/1000}s...`);
              await delay(retryDelay);
              continue;
            }
            throw new Error(`Error al guardar en base de datos: ${dbError.message}`);
          }
          
          presentation = dbData;
        } catch (e: any) {
          dbRetries--;
          if (dbRetries > 0) {
            addLog(`Excepción BD: ${e.message}. Reintentando en ${retryDelay/1000}s...`);
            await delay(retryDelay);
          } else {
            throw e;
          }
        }
      }

      addLog(`Presentación guardada con ID: ${presentation.id}`);
      setLastPresentationId(presentation.id);

      // Save slides with retries
      const slidesData = outlineResult.outline.slides.map((slide: any, index: number) => ({
        presentation_id: presentation.id,
        slide_number: index + 1,
        description: slide.description,
      }));

      let slides: any[] = [];
      let slidesDbRetries = 3;
      
      while (slidesDbRetries > 0 && slides.length === 0) {
        const attemptNumber = 4 - slidesDbRetries;
        const retryDelay = attemptNumber * 5000;
        
        try {
          addLog(`Guardando slides (intento ${attemptNumber}/3)...`);
          
          const { data: slidesResult, error: slidesError } = await supabase
            .from('slides')
            .insert(slidesData)
            .select();

          if (slidesError) {
            slidesDbRetries--;
            if (slidesDbRetries > 0) {
              addLog(`Error guardando slides: ${slidesError.message}. Reintentando en ${retryDelay/1000}s...`);
              await delay(retryDelay);
              continue;
            }
            throw new Error(`Error al guardar diapositivas: ${slidesError.message}`);
          }
          
          slides = slidesResult || [];
        } catch (e: any) {
          slidesDbRetries--;
          if (slidesDbRetries > 0) {
            addLog(`Excepción slides: ${e.message}. Reintentando en ${retryDelay/1000}s...`);
            await delay(retryDelay);
          } else {
            throw e;
          }
        }
      }

      addLog(`${slides.length} diapositivas guardadas en BD`);
      updateTaskStatus('database', 'completed');

      // Step 4: Generate images one by one with retries
      updateTaskStatus('images', 'processing');
      addLog('Paso 4: Generando imágenes con Nano Banana Pro...');
      
      const totalSlides = outlineResult.outline.slides.length;
      setSlideProgress({ completed: 0, total: totalSlides });
      addLog(`Generando ${totalSlides} diapositivas (30-40 seg cada una)...`);
      
      let successfulSlides = 0;

      for (let i = 0; i < totalSlides; i++) {
        const slide = outlineResult.outline.slides[i];
        const slideNumber = i + 1;
        
        if (i > 0) {
          addLog(`Esperando 5s antes de siguiente slide...`);
          await delay(5000);
        }
        
        const { data: slideResult, error: slideError } = await invokeWithRetry(
          'generate-single-slide',
          {
            presentationId: presentation.id,
            slideNumber: slideNumber,
            title: slide.title,
            content: slide.content,
            description: slide.description,
            stylePrompt: data.stylePrompt,
          },
          90000, // 90 seconds timeout
          3,     // 3 retries
          addLog,
          `Generando slide ${slideNumber}/${totalSlides}`
        );

        if (!slideError && slideResult) {
          successfulSlides++;
          setSlideProgress({ completed: successfulSlides, total: totalSlides });
          addLog(`✓ Slide ${slideNumber} completada (${successfulSlides}/${totalSlides})`);
        } else {
          addLog(`✗ Slide ${slideNumber} falló después de 3 intentos`);
        }
      }

      if (successfulSlides === 0) {
        throw new Error('No se pudo generar ninguna imagen');
      }

      addLog(`Imágenes generadas: ${successfulSlides}/${totalSlides}`);
      updateTaskStatus('images', 'completed');

      // Step 5: Create PDF with retries
      updateTaskStatus('pdf', 'processing');
      addLog('Paso 5: Compilando PDF...');
      
      const { data: pdfResult, error: pdfError } = await invokeWithRetry(
        'create-pdf',
        { presentationId: presentation.id },
        120000, // 2 minutes timeout
        3,      // 3 retries
        addLog,
        'Generando PDF'
      );

      if (pdfError) {
        throw new Error(pdfError.message || 'Error al crear PDF');
      }
      
      // Update presentation with PDF URL
      await supabase
        .from('presentations')
        .update({ pdf_url: pdfResult.pdfUrl, status: 'completed' })
        .eq('id', presentation.id);

      updateTaskStatus('pdf', 'completed');
      setPdfUrl(pdfResult.pdfUrl!);
      addLog('¡Proceso completado exitosamente!');
      addLog(`PDF disponible en: ${pdfResult.pdfUrl}`);
      toast.success('¡Presentación creada exitosamente!');

    } catch (error: any) {
      console.error('Error creating presentation:', error);
      addLog(`ERROR: ${error.message || 'Error desconocido'}`);
      toast.error(error.message || 'Error al crear la presentación');
      
      setTasks(prev => prev.map(task => 
        task.status === 'processing' ? { ...task, status: 'error', errorMessage: error.message } : task
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const isComplete = tasks.every(t => t.status === 'completed');
  const canRetryPdf = !isProcessing && lastPresentationId && tasks.find(t => t.id === 'pdf')?.status === 'error';

  return {
    isProcessing,
    tasks,
    pdfUrl,
    showProgress,
    logs,
    isComplete,
    slideProgress,
    createPresentation,
    retryPdfOnly,
    canRetryPdf,
    lastPresentationId,
  };
};
