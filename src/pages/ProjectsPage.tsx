import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Calendar, Loader2, Image as ImageIcon, ArrowRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Slide {
  slide_number: number;
  image_url: string | null;
}

interface Presentation {
  id: string;
  created_at: string;
  status: string;
  pdf_url: string | null;
  outline: any;
  slides?: Slide[];
}

const ProjectsPage = () => {
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    try {
      const { data, error } = await supabase
        .from('presentations')
        .select('id, created_at, status, pdf_url, outline')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Load first slide for each presentation
      const presentationsWithThumbs = await Promise.all(
        (data || []).map(async (presentation) => {
          const { data: slides } = await supabase
            .from('slides')
            .select('slide_number, image_url')
            .eq('presentation_id', presentation.id)
            .order('slide_number', { ascending: true })
            .limit(1);
          
          return {
            ...presentation,
            slides: slides || []
          };
        })
      );
      
      setPresentations(presentationsWithThumbs);
    } catch (error) {
      console.error('Error loading presentations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-success/20 text-success border-success/30',
      processing: 'bg-warning/20 text-warning border-warning/30',
      error: 'bg-destructive/20 text-destructive border-destructive/30',
      pending: 'bg-muted text-muted-foreground border-border',
    };
    const labels = {
      completed: 'Completado',
      processing: 'Procesando',
      error: 'Error',
      pending: 'Pendiente',
    };
    return (
      <Badge className={cn('border', styles[status as keyof typeof styles] || styles.pending)}>
        {labels[status as keyof typeof labels] || 'Pendiente'}
      </Badge>
    );
  };

  const getProjectTitle = (presentation: Presentation) => {
    if (presentation.outline?.title) return presentation.outline.title;
    if (presentation.outline?.slides?.[0]?.title) return presentation.outline.slides[0].title;
    return `Presentación ${format(new Date(presentation.created_at), 'dd MMM yyyy', { locale: es })}`;
  };

  const getSlideCount = (presentation: Presentation) => presentation.outline?.slides?.length || 0;
  
  const getFirstSlideImage = (presentation: Presentation) => {
    return presentation.slides?.[0]?.image_url || null;
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12 animate-fade-in-up">
          <h1 className="text-display-sm mb-4">
            Proyectos
          </h1>
          <p className="text-body-lg text-muted-foreground">
            Todas tus presentaciones creadas con IA
          </p>
        </div>

        {presentations.length === 0 ? (
          /* Empty State */
          <div className="glass-card p-16 text-center animate-scale-in">
            <div className="relative inline-block mb-8">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <FolderOpen className="w-12 h-12 text-primary" />
              </div>
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/10 to-accent/10 blur-2xl -z-10" />
            </div>
            <h2 className="text-headline mb-4">No hay proyectos todavía</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
              Crea tu primera presentación y la verás aquí
            </p>
            <Link to="/">
              <button className={cn(
                "inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold",
                "bg-gradient-to-r from-primary to-accent text-white",
                "hover:opacity-90 transition-all duration-300",
                "shadow-glow group"
              )}>
                <Sparkles className="w-5 h-5" />
                Crear Presentación
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>
        ) : (
          /* Projects Grid */
          <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-3">
            {presentations.map((presentation, index) => (
              <Link 
                key={presentation.id} 
                to={`/projects/${presentation.id}`}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={cn(
                  "glass-card overflow-hidden h-full",
                  "hover:bg-white/5 transition-all duration-300",
                  "group cursor-pointer"
                )}>
                  {/* Preview Image Area */}
                  <div className="aspect-video bg-gradient-to-br from-secondary to-background relative overflow-hidden">
                    {getFirstSlideImage(presentation) ? (
                      <img 
                        src={getFirstSlideImage(presentation)!} 
                        alt={getProjectTitle(presentation)}
                        className="w-full h-full object-contain bg-secondary"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="p-3 sm:p-4 rounded-2xl bg-white/5 group-hover:bg-white/10 transition-colors">
                          <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                      {getStatusBadge(presentation.status)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3 sm:p-5">
                    <h3 className="font-semibold text-sm sm:text-lg mb-1 sm:mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {getProjectTitle(presentation)}
                    </h3>
                    <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">{format(new Date(presentation.created_at), 'dd MMM yyyy', { locale: es })}</span>
                        <span className="sm:hidden">{format(new Date(presentation.created_at), 'dd/MM', { locale: es })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{getSlideCount(presentation)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Hover indicator */}
                  <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                    <div className="flex items-center text-xs sm:text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Ver proyecto</span>
                      <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsPage;
