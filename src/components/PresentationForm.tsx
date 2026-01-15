import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Save, Upload, Sparkles, Settings, Palette, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PresentationFormProps {
  onSubmit: (data: {
    systemPrompt: string;
    userPrompt: string;
    stylePrompt: string;
    transcript: string;
  }) => void;
  isProcessing: boolean;
}

export const PresentationForm = ({ onSubmit, isProcessing }: PresentationFormProps) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('session_id');
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem('session_id', newId);
    return newId;
  });

  useEffect(() => {
    loadSavedPrompt();
  }, []);

  const loadSavedPrompt = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('system_prompt')
        .eq('session_id', sessionId)
        .single();

      if (data?.system_prompt) {
        setSystemPrompt(data.system_prompt);
      }
    } catch (error) {
      // No saved prompt found, that's okay
    }
  };

  const saveSystemPrompt = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          session_id: sessionId,
          system_prompt: systemPrompt,
        }, {
          onConflict: 'session_id'
        });

      if (error) throw error;
      toast.success('Prompt de sistema guardado');
    } catch (error) {
      toast.error('Error al guardar el prompt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      setTranscript(text);
      toast.success('Archivo cargado correctamente');
    } else if (validTypes.includes(file.type) || file.name.endsWith('.doc') || file.name.endsWith('.docx') || file.name.endsWith('.pdf')) {
      // For PDF and DOC files, we'll send them to an edge function for processing
      toast.info('Procesando archivo...');
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const { data, error } = await supabase.functions.invoke('parse-document', {
          body: formData,
        });
        
        if (error) throw error;
        setTranscript(data.text);
        toast.success('Archivo procesado correctamente');
      } catch (error) {
        toast.error('Error al procesar el archivo. Por favor, copia el texto manualmente.');
      }
    } else {
      toast.error('Formato de archivo no soportado');
    }
  };

  const handleSubmit = () => {
    if (!transcript.trim()) {
      toast.error('Por favor, añade el transcript de la reunión');
      return;
    }

    onSubmit({
      systemPrompt,
      userPrompt,
      stylePrompt,
      transcript,
    });
  };

  return (
    <div className="space-y-6">
      {/* System Prompt Card */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Prompt de Sistema</CardTitle>
              <CardDescription>Se mantiene guardado para futuras presentaciones</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Define el contexto general, tono y estilo de comunicación para todas tus presentaciones..."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="min-h-[100px] input-enhanced resize-none"
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={saveSystemPrompt}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Prompt
          </Button>
        </CardContent>
      </Card>

      {/* User Prompt Card */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Orientación del Contenido</CardTitle>
              <CardDescription>¿Qué enfoque quieres para esta presentación?</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Ej: Enfócate en los puntos clave de decisión, resalta los próximos pasos y asigna responsables..."
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            className="min-h-[100px] input-enhanced resize-none"
          />
        </CardContent>
      </Card>

      {/* Style Prompt Card */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Estilo Visual</CardTitle>
              <CardDescription>Describe el aspecto gráfico deseado</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Ej: Estilo corporativo minimalista con colores azul y blanco, iconos modernos, tipografía sans-serif..."
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            className="min-h-[100px] input-enhanced resize-none"
          />
        </CardContent>
      </Card>

      {/* Transcript Card */}
      <Card className="glass-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Transcript de la Reunión</CardTitle>
              <CardDescription>Sube un archivo o pega el texto directamente</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Label 
              htmlFor="file-upload" 
              className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-secondary/50 transition-all duration-200 flex-1"
            >
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-muted-foreground">Subir archivo (.txt, .doc, .pdf)</span>
              <Input 
                id="file-upload" 
                type="file" 
                accept=".txt,.doc,.docx,.pdf"
                onChange={handleFileUpload}
                className="hidden" 
              />
            </Label>
          </div>
          <Textarea
            placeholder="O pega aquí el transcript de tu reunión..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="min-h-[200px] input-enhanced resize-none font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button 
        variant="gradient" 
        size="xl" 
        className="w-full"
        onClick={handleSubmit}
        disabled={isProcessing || !transcript.trim()}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Crear Presentación
          </>
        )}
      </Button>
    </div>
  );
};
