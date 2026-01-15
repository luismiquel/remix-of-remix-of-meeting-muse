import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, Sparkles, FileText, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProgressTracker } from '@/components/ProgressTracker';
import { usePresentationCreation } from '@/hooks/usePresentationCreation';
import { cn } from '@/lib/utils';

const CreatePage = () => {
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState('');
  
  const {
    isProcessing,
    tasks,
    showProgress,
    isComplete,
    slideProgress,
    createPresentation,
    lastPresentationId,
  } = usePresentationCreation();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      setTranscript(text);
      toast.success('File loaded successfully');
    } else if (validTypes.includes(file.type) || file.name.endsWith('.doc') || file.name.endsWith('.docx') || file.name.endsWith('.pdf')) {
      toast.info('Processing file...');
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const { data, error } = await supabase.functions.invoke('parse-document', {
          body: formData,
        });
        
        if (error) throw error;
        setTranscript(data.text);
        toast.success('File processed successfully');
      } catch (error) {
        toast.error('Error processing file');
      }
    } else {
      toast.error('Format not supported');
    }
  };

  const handleSubmit = async () => {
    if (!transcript.trim()) {
      toast.error('Add your meeting transcript');
      return;
    }

    await createPresentation({ transcript });
  };

  if (isComplete && lastPresentationId) {
    setTimeout(() => navigate(`/projects/${lastPresentationId}`), 2000);
  }

  return (
    <div className="min-h-screen relative">
      {/* Hero Section */}
      <section className="relative py-16 flex items-center justify-center">
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="animate-fade-in-up text-display-sm md:text-display mb-6">
            Meeting to{' '}
            <span className="gradient-text">Presentation</span>
          </h1>

          <p className="animate-fade-in-up delay-200 text-body-lg text-muted-foreground max-w-2xl mx-auto">
            Transform any transcript into a professional presentation with AI-generated slides.
          </p>
        </div>
      </section>

      {/* Upload Section */}
      <section className="relative py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="glass-card p-8 md:p-12 glow-border animate-scale-in">
            <div className="space-y-8">
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-title text-foreground">Transcript</h2>
                  <p className="text-sm text-muted-foreground">Upload a file or paste your text</p>
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
                  <p className="font-medium text-foreground">Drag a file here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to select (.txt, .doc, .pdf)</p>
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
                  placeholder="Or paste your meeting transcript here..."
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
                    {transcript.length.toLocaleString()} characters
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
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Create Presentation
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
              
              {isComplete && (
                <div className="glass-card p-6 text-center border-success/20">
                  <div className="inline-flex items-center gap-2 text-success">
                    <Sparkles className="w-5 h-5" />
                    <span className="font-medium">Presentation created! Redirecting...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default CreatePage;
