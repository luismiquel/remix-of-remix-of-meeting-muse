import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Palette, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const SettingsPage = () => {
  const { user } = useAuth();
  const [stylePrompt, setStylePrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadSavedSettings();
    }
  }, [user?.id]);

  const loadSavedSettings = async () => {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('system_prompt')
        .eq('user_id', user?.id)
        .single();

      if (data?.system_prompt) {
        try {
          const parsed = JSON.parse(data.system_prompt);
          setStylePrompt(parsed.stylePrompt || '');
        } catch {
          // Ignore parsing errors
        }
      }
    } catch (error) {
      // No settings found, that's okay
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      const settingsData = JSON.stringify({ stylePrompt });

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          session_id: user.id, // Use user_id as session_id for compatibility
          system_prompt: settingsData,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      setSaved(true);
      toast.success('Settings saved');
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error('Error saving settings');
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

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12 animate-fade-in-up">
          <h1 className="text-display-sm mb-4">
            Settings
          </h1>
          <p className="text-body-lg text-muted-foreground">
            Configure your default presentation style
          </p>
        </div>

        {/* Style Card */}
        <div className="glass-card p-6 md:p-8 animate-fade-in-up">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shrink-0">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Visual Style</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Describe the visual look you want for your presentations
              </p>
            </div>
          </div>
          <Textarea
            placeholder="e.g., Corporate minimalist style with blue and white colors, clean typography..."
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            className={cn(
              "min-h-[120px] resize-none",
              "bg-secondary/30 border-border/30 rounded-xl",
              "focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
              "transition-all duration-300 placeholder:text-muted-foreground/50"
            )}
          />
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
            onClick={saveSettings}
            disabled={isSaving}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
