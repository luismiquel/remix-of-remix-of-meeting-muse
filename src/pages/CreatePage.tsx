import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, Sparkles, FileText, Loader2, ArrowRight, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProgressTracker } from '@/components/ProgressTracker';
import { LogViewer } from '@/components/LogViewer';
import { usePresentationCreation } from '@/hooks/usePresentationCreation';
import { cn } from '@/lib/utils';

const CreatePage = () => {
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState('');
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);
  
  const {
    isProcessing,
    tasks,
    showProgress,
    logs,
    isComplete,
    slideProgress,
    createPresentation,
    lastPresentationId,
  } = usePresentationCreation();

  // Parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
        const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
        setMousePosition({ x, y });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      setTranscript(text);
      toast.success('Archivo cargado correctamente');
    } else if (validTypes.includes(file.type) || file.name.endsWith('.doc') || file.name.endsWith('.docx') || file.name.endsWith('.pdf')) {
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
        toast.error('Error al procesar el archivo');
      }
    } else {
      toast.error('Formato no soportado');
    }
  };

  const handleSubmit = async () => {
    if (!transcript.trim()) {
      toast.error('Añade el transcript de la reunión');
      return;
    }

    const sessionId = localStorage.getItem('session_id') || '';
    let systemPrompt = '';
    let userPrompt = '';
    let stylePrompt = '';

    try {
      const { data } = await supabase
        .from('user_settings')
        .select('system_prompt')
        .eq('session_id', sessionId)
        .single();
      
      if (data?.system_prompt) {
        const parsed = JSON.parse(data.system_prompt);
        systemPrompt = parsed.systemPrompt || '';
        userPrompt = parsed.userPrompt || '';
        stylePrompt = parsed.stylePrompt || '';
      }
    } catch (e) {}

    await createPresentation({ systemPrompt, userPrompt, stylePrompt, transcript });
  };

  if (isComplete && lastPresentationId) {
    setTimeout(() => navigate(`/projects/${lastPresentationId}`), 2000);
  }

  return (
    <div className="min-h-screen relative">
      {/* Hero Section with Parallax */}
      <section 
        ref={heroRef}
        className="relative min-h-[60vh] flex items-center justify-center overflow-hidden"
      >
        {/* Animated background orbs */}
        <div 
          className="absolute w-[600px] h-[600px] rounded-full blur-[100px] bg-primary/20 transition-transform duration-1000 ease-out"
          style={{ 
            transform: `translate(${mousePosition.x * 30}px, ${mousePosition.y * 30}px)`,
            top: '10%',
            left: '20%'
          }}
        />
        <div 
          className="absolute w-[400px] h-[400px] rounded-full blur-[80px] bg-accent/20 transition-transform duration-1000 ease-out"
          style={{ 
            transform: `translate(${mousePosition.x * -20}px, ${mousePosition.y * -20}px)`,
            bottom: '20%',
            right: '20%'
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="animate-fade-in-down inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle mb-8">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Powered by <span className="text-foreground">Gemini 3 Pro</span>
            </span>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up text-display-sm md:text-display mb-6">
            De reunión a{' '}
            <span className="gradient-text">presentación</span>
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-in-up delay-200 text-body-lg text-muted-foreground max-w-2xl mx-auto mb-12">
            Transforma cualquier transcript en una presentación profesional con diapositivas visuales generadas por IA.
          </p>

          {/* Scroll indicator */}
          <div className="animate-fade-in delay-500 flex flex-col items-center gap-2 text-muted-foreground/50">
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <div className="w-px h-12 bg-gradient-to-b from-muted-foreground/50 to-transparent" />
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Card */}
          <div className="glass-card p-8 md:p-12 glow-border animate-scale-in">
            <div className="space-y-8">
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-title text-foreground">Transcript</h2>
                  <p className="text-sm text-muted-foreground">Sube un archivo o pega el texto</p>
                </div>
              </div>

              {/* Upload area */}
              <Label 
                htmlFor="file-upload" 
                className={cn(
                  "relative flex flex-col items-center justify-center gap-4 p-8",
                  "border-2 border-dashed border-border/50 rounded-2xl",
                  "cursor-pointer transition-all duration-300",
                  "hover:border-primary/50 hover:bg-primary/5",
                  "group"
                )}
              >
                <div className="p-4 rounded-full bg-secondary/50 group-hover:bg-primary/10 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">Arrastra un archivo aquí</p>
                  <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar (.txt, .doc, .pdf)</p>
                </div>
                <Input 
                  id="file-upload" 
                  type="file" 
                  accept=".txt,.doc,.docx,.pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                />
              </Label>

              {/* Textarea */}
              <div className="relative">
                <Textarea
                  placeholder="O pega aquí el transcript de tu reunión..."
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className={cn(
                    "min-h-[200px] resize-none font-mono text-sm",
                    "bg-secondary/30 border-border/30 rounded-xl",
                    "focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
                    "transition-all duration-300 placeholder:text-muted-foreground/50"
                  )}
                />
                {transcript && (
                  <div className="absolute bottom-4 right-4 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {transcript.length.toLocaleString()} caracteres
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button 
                variant="default"
                size="lg" 
                className={cn(
                  "w-full h-14 text-base font-semibold rounded-xl",
                  "bg-gradient-to-r from-primary via-primary to-accent",
                  "hover:opacity-90 transition-all duration-300",
                  "shadow-glow hover:shadow-glow-lg",
                  "group relative overflow-hidden"
                )}
                onClick={handleSubmit}
                disabled={isProcessing || !transcript.trim()}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Crear Presentación
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Progress Section */}
          {showProgress && (
            <div className="mt-12 space-y-6 animate-fade-in-up">
              <ProgressTracker tasks={tasks} slideProgress={slideProgress} />
              <LogViewer logs={logs} />
              
              {isComplete && (
                <div className="glass-card p-6 text-center border-success/20">
                  <div className="inline-flex items-center gap-2 text-success">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-medium">¡Presentación creada! Redirigiendo...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      {!showProgress && (
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Zap, title: 'Ultra Rápido', desc: 'Presentaciones en minutos, no horas' },
                { icon: Sparkles, title: 'IA Avanzada', desc: 'Gemini 3 Pro + Nano Banana Pro' },
                { icon: FileText, title: 'PDF Profesional', desc: 'Exporta en alta calidad' },
              ].map((feature, i) => (
                <div 
                  key={feature.title}
                  className="glass-card p-6 hover:bg-white/5 transition-all duration-300 group animate-fade-in-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default CreatePage;
