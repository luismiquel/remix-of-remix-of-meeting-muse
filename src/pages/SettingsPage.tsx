import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Settings, Palette, Sparkles, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SettingsPage = () => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [stylePrompt, setStylePrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('session_id');
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem('session_id', newId);
    return newId;
  });

  useEffect(() => {
    loadSavedPrompts();
  }, []);

  const loadSavedPrompts = async () => {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('system_prompt')
        .eq('session_id', sessionId)
        .single();

      if (data?.system_prompt) {
        try {
          const parsed = JSON.parse(data.system_prompt);
          setSystemPrompt(parsed.systemPrompt || '');
          setUserPrompt(parsed.userPrompt || '');
          setStylePrompt(parsed.stylePrompt || '');
        } catch {
          setSystemPrompt(data.system_prompt);
        }
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const savePrompts = async () => {
    setIsSaving(true);
    try {
      const promptsData = JSON.stringify({ systemPrompt, userPrompt, stylePrompt });

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          session_id: sessionId,
          system_prompt: promptsData,
        }, {
          onConflict: 'session_id'
        });

      if (error) throw error;
      setSaved(true);
      toast.success('Ajustes guardados');
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const promptCards = [
    {
      icon: Settings,
      title: 'Prompt de Sistema',
      description: 'Define el contexto general y tono para las presentaciones',
      value: systemPrompt,
      onChange: setSystemPrompt,
      placeholder: 'Define el contexto general, tono y estilo de comunicación...',
    },
    {
      icon: Sparkles,
      title: 'Orientación del Contenido',
      description: '¿Qué enfoque quieres para las presentaciones?',
      value: userPrompt,
      onChange: setUserPrompt,
      placeholder: 'Ej: Enfócate en los puntos clave de decisión...',
    },
    {
      icon: Palette,
      title: 'Estilo Visual',
      description: 'Describe el aspecto gráfico deseado',
      value: stylePrompt,
      onChange: setStylePrompt,
      placeholder: 'Ej: Estilo corporativo minimalista con colores azul y blanco...',
    },
  ];

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12 animate-fade-in-up">
          <h1 className="text-display-sm mb-4">
            Ajustes
          </h1>
          <p className="text-body-lg text-muted-foreground">
            Configura los prompts predeterminados para todas tus presentaciones
          </p>
        </div>

        {/* Cards */}
        <div className="space-y-6">
          {promptCards.map((card, index) => (
            <div 
              key={card.title}
              className="glass-card p-6 md:p-8 animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shrink-0">
                  <card.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{card.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
                </div>
              </div>
              <Textarea
                placeholder={card.placeholder}
                value={card.value}
                onChange={(e) => card.onChange(e.target.value)}
                className={cn(
                  "min-h-[120px] resize-none",
                  "bg-secondary/30 border-border/30 rounded-xl",
                  "focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
                  "transition-all duration-300 placeholder:text-muted-foreground/50"
                )}
              />
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="mt-8 animate-fade-in-up delay-300">
          <Button 
            size="lg" 
            className={cn(
              "w-full h-14 text-base font-semibold rounded-xl",
              "bg-gradient-to-r from-primary via-primary to-accent",
              "hover:opacity-90 transition-all duration-300",
              "shadow-glow hover:shadow-glow-lg",
              "group relative overflow-hidden"
            )}
            onClick={savePrompts}
            disabled={isSaving}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Guardando...
              </>
            ) : saved ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Guardado
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Guardar Ajustes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
