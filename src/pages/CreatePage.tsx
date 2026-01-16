import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { ProgressTracker } from '@/components/ProgressTracker';
import { TranscriptInput } from '@/components/TranscriptInput';
import { usePresentationCreation } from '@/hooks/usePresentationCreation';
import { validateTranscript } from '@/lib/validation';
import { cn } from '@/lib/utils';

const CreatePage = () => {
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const {
    isProcessing,
    tasks,
    showProgress,
    isComplete,
    slideProgress,
    createPresentation,
    lastPresentationId,
  } = usePresentationCreation();

  const handleSubmit = async () => {
    const validation = validateTranscript(transcript);
    
    if (!validation.isValid) {
      setValidationError(validation.error);
      toast.error(validation.error || 'Please add more content');
      return;
    }

    setValidationError(null);
    await createPresentation({ transcript });
  };

  if (isComplete && lastPresentationId) {
    setTimeout(() => navigate(`/projects/${lastPresentationId}`), 2000);
  }

  const isSubmitDisabled = isProcessing || !transcript.trim() || transcript.trim().length < 100;

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

              {/* Transcript Input Component */}
              <TranscriptInput
                value={transcript}
                onChange={setTranscript}
                disabled={isProcessing}
                error={validationError}
              />

              {/* Submit Button */}
              <Button 
                variant="default"
                size="lg" 
                className={cn(
                  "w-full h-14 text-base font-semibold rounded-xl",
                  "bg-gradient-to-r from-primary via-primary to-accent",
                  "hover:opacity-90 transition-all duration-300",
                  "shadow-glow hover:shadow-glow-lg",
                  "group relative overflow-hidden",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
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

              {/* Minimum character hint */}
              {!isProcessing && transcript.trim().length > 0 && transcript.trim().length < 100 && (
                <p className="text-sm text-muted-foreground text-center">
                  Add at least {100 - transcript.trim().length} more characters to create a presentation
                </p>
              )}
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
