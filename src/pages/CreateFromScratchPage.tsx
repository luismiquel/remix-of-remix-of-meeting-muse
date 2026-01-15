import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  FolderOpen, Calendar, Loader2, Image as ImageIcon, ArrowRight, 
  Plus, PenLine, Sparkles 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

export default function CreateFromScratchPage() {
  const { user } = useAuth();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStylePrompt, setNewStylePrompt] = useState('');

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    try {
      // Load presentations that were created manually (transcript starts with "Manual:")
      const { data, error } = await supabase
        .from('presentations')
        .select('id, created_at, status, pdf_url, outline')
        .like('transcript', 'Manual:%')
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
            slides: slides || [],
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

  const createNewProject = async () => {
    if (!newTitle.trim()) {
      toast.error('Introduce un título para el proyecto');
      return;
    }

    setIsCreating(true);
    try {
      const outline = {
        title: newTitle,
        slides: [],
      };

      const { data: presentation, error } = await supabase
        .from('presentations')
        .insert({
          transcript: `Manual: ${newTitle}`,
          outline,
          style_prompt: newStylePrompt || null,
          status: 'draft',
          user_id: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Proyecto creado');
      setIsDialogOpen(false);
      setNewTitle('');
      setNewStylePrompt('');
      
      // Redirect to editor
      window.location.href = `/create-scratch/${presentation.id}`;
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al crear el proyecto');
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-success/20 text-success border-success/30',
      processing: 'bg-warning/20 text-warning border-warning/30',
      error: 'bg-destructive/20 text-destructive border-destructive/30',
      pending: 'bg-muted text-muted-foreground border-border',
      draft: 'bg-primary/20 text-primary border-primary/30',
    };
    const labels = {
      completed: 'Completado',
      processing: 'Procesando',
      error: 'Error',
      pending: 'Pendiente',
      draft: 'Borrador',
    };
    return (
      <Badge className={cn('border', styles[status as keyof typeof styles] || styles.pending)}>
        {labels[status as keyof typeof labels] || 'Pendiente'}
      </Badge>
    );
  };

  const getProjectTitle = (presentation: Presentation) => {
    if (presentation.outline?.title) return presentation.outline.title;
    return `Proyecto ${format(new Date(presentation.created_at), 'dd MMM yyyy', { locale: es })}`;
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
    <div className="min-h-screen py-8 px-4 sm:py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 sm:mb-12 animate-fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-display-sm mb-2 sm:mb-4 gradient-text">
              Crear desde cero
            </h1>
            <p className="text-body-lg text-muted-foreground">
              Crea presentaciones manualmente, slide por slide
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shimmer-button gap-2 w-full sm:w-auto">
                <Plus className="w-5 h-5" />
                Nuevo proyecto
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/30">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Crear nuevo proyecto
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Título del proyecto *
                  </label>
                  <Input
                    placeholder="Ej: Estrategia de Marketing Q1 2025"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="bg-background/50 border-border/30"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Estilo visual (opcional)
                  </label>
                  <Textarea
                    placeholder="Ej: Estilo corporativo minimalista, colores azul y blanco..."
                    value={newStylePrompt}
                    onChange={(e) => setNewStylePrompt(e.target.value)}
                    className="bg-background/50 border-border/30 min-h-[80px]"
                  />
                </div>
                <Button
                  onClick={createNewProject}
                  disabled={isCreating}
                  className="w-full shimmer-button"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Crear proyecto
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {presentations.length === 0 ? (
          /* Empty State */
          <div className="glass-card p-12 sm:p-16 text-center animate-scale-in">
            <div className="relative inline-block mb-8">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <PenLine className="w-12 h-12 text-primary" />
              </div>
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/10 to-accent/10 blur-2xl -z-10" />
            </div>
            <h2 className="text-headline mb-4">Sin proyectos manuales</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
              Crea tu primer proyecto y añade diapositivas una a una
            </p>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="shimmer-button gap-2 px-8 py-4"
            >
              <Plus className="w-5 h-5" />
              Crear primer proyecto
            </Button>
          </div>
        ) : (
          /* Projects Grid */
          <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-3">
            {presentations.map((presentation, index) => (
              <Link
                key={presentation.id}
                to={`/create-scratch/${presentation.id}`}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className={cn(
                    'glass-card overflow-hidden h-full',
                    'hover:bg-white/5 transition-all duration-300',
                    'group cursor-pointer'
                  )}
                >
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
                          <PenLine className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
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
                        <span className="hidden sm:inline">
                          {format(new Date(presentation.created_at), 'dd MMM yyyy', { locale: es })}
                        </span>
                        <span className="sm:hidden">
                          {format(new Date(presentation.created_at), 'dd/MM', { locale: es })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{getSlideCount(presentation)} slides</span>
                      </div>
                    </div>
                  </div>

                  {/* Hover indicator */}
                  <div className="px-3 pb-3 sm:px-5 sm:pb-5">
                    <div className="flex items-center text-xs sm:text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Editar proyecto</span>
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
}
