import { Button } from '@/components/ui/button';
import { Download, FileText, ExternalLink, CheckCircle2 } from 'lucide-react';

interface DownloadSectionProps {
  pdfUrl: string | null;
  isComplete: boolean;
}

export const DownloadSection = ({ pdfUrl, isComplete }: DownloadSectionProps) => {
  if (!isComplete || !pdfUrl) return null;

  return (
    <div className="glass-card p-8 text-center space-y-6 animate-slide-up">
      <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center glow-effect">
        <CheckCircle2 className="w-8 h-8 text-success" />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-2xl font-bold gradient-text">¡Presentación Lista!</h3>
        <p className="text-muted-foreground">
          Tu presentación ha sido creada exitosamente
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button 
          variant="gradient" 
          size="lg" 
          className="gap-2"
          onClick={() => window.open(pdfUrl, '_blank')}
        >
          <Download className="w-5 h-5" />
          Descargar PDF
        </Button>
        <Button 
          variant="outline" 
          size="lg" 
          className="gap-2"
          onClick={() => window.open(pdfUrl, '_blank')}
        >
          <ExternalLink className="w-5 h-5" />
          Ver en Nueva Pestaña
        </Button>
      </div>
    </div>
  );
};
