import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, Download, FileText, Image as ImageIcon, Edit3, 
  Loader2, Save, RefreshCw, CheckSquare, Square, Archive, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Slide {
  id: string;
  slide_number: number;
  description: string;
  image_url: string | null;
}

interface Presentation {
  id: string;
  created_at: string;
  status: string;
  pdf_url: string | null;
  outline: any;
  style_prompt: string | null;
}

interface BackupImage {
  slideNumber: number;
  url: string;
  createdAt: string;
}

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [backupImages, setBackupImages] = useState<BackupImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  const [remixSlide, setRemixSlide] = useState<Slide | null>(null);
  const [remixPrompt, setRemixPrompt] = useState('');
  const [isRemixing, setIsRemixing] = useState(false);
  
  const [selectedSlides, setSelectedSlides] = useState<Set<number>>(new Set());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject();
      loadBackupImages();
    }
  }, [id]);

  const loadProject = async () => {
    try {
      const [presentationRes, slidesRes] = await Promise.all([
        supabase.from('presentations').select('*').eq('id', id).single(),
        supabase.from('slides').select('*').eq('presentation_id', id).order('slide_number', { ascending: true })
      ]);

      if (presentationRes.error) throw presentationRes.error;
      if (slidesRes.error) throw slidesRes.error;

      setPresentation(presentationRes.data);
      setSlides(slidesRes.data || []);
      setSelectedSlides(new Set((slidesRes.data || []).map(s => s.slide_number)));
    } catch (error) {
      toast.error('Error al cargar el proyecto');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBackupImages = async () => {
    try {
      const { data: files } = await supabase.storage.from('presentations').list(`${id}/backups`);
      if (files && files.length > 0) {
        const backups: BackupImage[] = files.map(file => {
          const match = file.name.match(/slide_(\d+)_backup_(\d+)/);
          const slideNumber = match ? parseInt(match[1]) : 0;
          const { data: { publicUrl } } = supabase.storage.from('presentations').getPublicUrl(`${id}/backups/${file.name}`);
          return { slideNumber, url: publicUrl, createdAt: file.created_at || '' };
        });
        setBackupImages(backups);
      }
    } catch (error) {}
  };

  const handleEditDescription = (slide: Slide) => {
    setEditingSlide(slide);
    setEditedDescription(slide.description);
  };

  const saveDescription = async () => {
    if (!editingSlide) return;
    setIsSaving(true);
    try {
      await supabase.from('slides').update({ description: editedDescription }).eq('id', editingSlide.id);
      setSlides(slides.map(s => s.id === editingSlide.id ? { ...s, description: editedDescription } : s));
      setEditingSlide(null);
      toast.success('Descripción guardada');
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const regenerateSlide = async () => {
    if (!editingSlide) return;
    setIsRegenerating(true);
    try {
      // Backup current image
      if (editingSlide.image_url) {
        const timestamp = Date.now();
        const backupPath = `${id}/backups/slide_${String(editingSlide.slide_number).padStart(2, '0')}_backup_${timestamp}.jpg`;
        const response = await fetch(editingSlide.image_url);
        const blob = await response.blob();
        await supabase.storage.from('presentations').upload(backupPath, blob, { contentType: 'image/jpeg' });
      }

      // Save new description first
      await supabase.from('slides').update({ description: editedDescription }).eq('id', editingSlide.id);

      // Get outline to extract title
      const outline = presentation?.outline as any;
      const slideData = outline?.slides?.[editingSlide.slide_number - 1];
      const title = slideData?.title || `Slide ${editingSlide.slide_number}`;

      // Generate new image with updated description
      const { data, error } = await supabase.functions.invoke('generate-single-slide', {
        body: {
          presentationId: id,
          slideNumber: editingSlide.slide_number,
          title: title,
          content: slideData?.content || [],
          description: editedDescription,
          stylePrompt: presentation?.style_prompt || '',
        }
      });

      if (error) throw error;

      // Update slides state
      setSlides(slides.map(s => 
        s.id === editingSlide.id 
          ? { ...s, description: editedDescription, image_url: data.imageUrl } 
          : s
      ));
      
      setEditingSlide(null);
      loadBackupImages();
      toast.success('Slide regenerada con éxito');
    } catch (error: any) {
      toast.error(error.message || 'Error al regenerar la slide');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRemix = async () => {
    if (!remixSlide || !remixPrompt.trim()) {
      toast.error('Introduce un prompt para el remix');
      return;
    }
    setIsRemixing(true);
    try {
      if (remixSlide.image_url) {
        const timestamp = Date.now();
        const backupPath = `${id}/backups/slide_${String(remixSlide.slide_number).padStart(2, '0')}_backup_${timestamp}.jpg`;
        const response = await fetch(remixSlide.image_url);
        const blob = await response.blob();
        await supabase.storage.from('presentations').upload(backupPath, blob, { contentType: 'image/jpeg' });
      }

      const { data, error } = await supabase.functions.invoke('remix-slide', {
        body: {
          presentationId: id,
          slideNumber: remixSlide.slide_number,
          originalImageUrl: remixSlide.image_url,
          editPrompt: remixPrompt,
          stylePrompt: presentation?.style_prompt || '',
        }
      });

      if (error) throw error;
      setSlides(slides.map(s => s.id === remixSlide.id ? { ...s, image_url: data.newImageUrl } : s));
      setRemixSlide(null);
      setRemixPrompt('');
      loadBackupImages();
      toast.success('Imagen remixeada');
    } catch (error: any) {
      toast.error(error.message || 'Error al remixear');
    } finally {
      setIsRemixing(false);
    }
  };

  const downloadImage = async (imageUrl: string, slideNumber: number) => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slide_${slideNumber}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const toggleSlideSelection = (slideNumber: number) => {
    const newSelected = new Set(selectedSlides);
    if (newSelected.has(slideNumber)) newSelected.delete(slideNumber);
    else newSelected.add(slideNumber);
    setSelectedSlides(newSelected);
  };

  const selectAllSlides = () => setSelectedSlides(new Set(slides.map(s => s.slide_number)));
  const deselectAllSlides = () => setSelectedSlides(new Set());

  const generatePdf = async () => {
    if (selectedSlides.size === 0) {
      toast.error('Selecciona al menos una diapositiva');
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-pdf', {
        body: { presentationId: id, selectedSlides: Array.from(selectedSlides).sort((a, b) => a - b) }
      });
      if (error) throw error;
      await supabase.from('presentations').update({ pdf_url: data.pdfUrl }).eq('id', id);
      setPresentation(prev => prev ? { ...prev, pdf_url: data.pdfUrl } : null);
      toast.success('PDF generado');
      window.open(data.pdfUrl, '_blank');
    } catch (error: any) {
      toast.error(error.message || 'Error al generar PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      // Delete slides first
      await supabase.from('slides').delete().eq('presentation_id', id);
      
      // Delete storage files
      const { data: files } = await supabase.storage.from('presentations').list(id!);
      if (files && files.length > 0) {
        await supabase.storage.from('presentations').remove(files.map(f => `${id}/${f.name}`));
      }
      const { data: backups } = await supabase.storage.from('presentations').list(`${id}/backups`);
      if (backups && backups.length > 0) {
        await supabase.storage.from('presentations').remove(backups.map(f => `${id}/backups/${f.name}`));
      }
      
      // Delete presentation
      await supabase.from('presentations').delete().eq('id', id);
      
      toast.success('Proyecto eliminado');
      navigate('/projects');
    } catch (error) {
      toast.error('Error al eliminar el proyecto');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="p-8 text-center text-muted-foreground">Proyecto no encontrado</div>
    );
  }

  return (
    <div className="min-h-screen py-4 px-3 sm:py-8 sm:px-4 w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-8 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/projects')}
              className="rounded-xl hover:bg-white/5 shrink-0 h-9 w-9"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">{presentation.outline?.title || 'Presentación'}</h1>
              <p className="text-muted-foreground text-xs">
                {format(new Date(presentation.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {presentation.pdf_url && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(presentation.pdf_url!, '_blank')}
                className="rounded-xl border-border/30 hover:bg-white/5 h-8 text-xs"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Descargar PDF
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 h-8 text-xs"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-card border-border/30 mx-4 max-w-[calc(100vw-2rem)]">
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente el proyecto, todas sus diapositivas e imágenes. No se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteProject}
                    disabled={isDeleting}
                    className="rounded-lg bg-destructive hover:bg-destructive/90"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Tabs defaultValue="slides" className="space-y-4 sm:space-y-6">
          <TabsList className="glass-card p-1 rounded-xl w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
            <TabsTrigger value="slides" className="rounded-lg data-[state=active]:bg-white/10 text-xs sm:text-sm">
              Slides
            </TabsTrigger>
            <TabsTrigger value="descriptions" className="rounded-lg data-[state=active]:bg-white/10 text-xs sm:text-sm">
              Descripciones
            </TabsTrigger>
            <TabsTrigger value="backups" className="rounded-lg data-[state=active]:bg-white/10 text-xs sm:text-sm">
              Backups
            </TabsTrigger>
          </TabsList>

          {/* Slides Tab */}
          <TabsContent value="slides" className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* PDF Controls */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4 mb-4">
                <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base">Generar PDF</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Selecciona las diapositivas</p>
                </div>
                <Badge variant="secondary" className="bg-white/5 shrink-0">
                  {selectedSlides.size}/{slides.length}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={selectAllSlides} className="rounded-lg border-border/30 text-xs sm:text-sm">
                  <CheckSquare className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Todas
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllSlides} className="rounded-lg border-border/30 text-xs sm:text-sm">
                  <Square className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Ninguna
                </Button>
                <Button 
                  onClick={generatePdf}
                  size="sm"
                  disabled={isGeneratingPdf || selectedSlides.size === 0}
                  className={cn(
                    "rounded-lg bg-gradient-to-r from-primary to-accent text-xs sm:text-sm",
                    "hover:opacity-90 transition-opacity"
                  )}
                >
                  {isGeneratingPdf ? (
                    <><Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />Generando...</>
                  ) : (
                    <><RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />Regenerar PDF</>
                  )}
                </Button>
              </div>
            </div>

            {/* Slides Grid */}
            <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
              {slides.map((slide, index) => (
                <div 
                  key={slide.id} 
                  className={cn(
                    "glass-card overflow-hidden transition-all duration-300 animate-fade-in-up group min-w-0",
                    selectedSlides.has(slide.slide_number) && "ring-2 ring-primary"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="relative aspect-video bg-secondary/50 w-full overflow-hidden">
                    {slide.image_url ? (
                      <img src={slide.image_url} alt={`Slide ${slide.slide_number}`} className="w-full h-full object-contain bg-secondary" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon className="w-6 h-6 sm:w-10 sm:h-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-1 left-1 sm:top-2 sm:left-2">
                      <Checkbox
                        checked={selectedSlides.has(slide.slide_number)}
                        onCheckedChange={() => toggleSlideSelection(slide.slide_number)}
                        className="bg-background/80 border-border h-4 w-4"
                      />
                    </div>
                    <Badge className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-background/80 border-0 text-[10px] sm:text-xs px-1.5 py-0.5">
                      {slide.slide_number}
                    </Badge>
                  </div>
                  <div className="p-2 sm:p-4 space-y-1.5 sm:space-y-3">
                    <p className="text-[10px] sm:text-sm text-muted-foreground line-clamp-2">{slide.description}</p>
                    <div className="flex gap-1 sm:gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 rounded-lg border-border/30 hover:bg-white/5 h-6 sm:h-8 text-[10px] sm:text-sm px-1.5 sm:px-3"
                        onClick={() => setRemixSlide(slide)}
                        disabled={!slide.image_url}
                      >
                        <Edit3 className="w-3 h-3" />
                        <span className="hidden sm:inline ml-1">Remix</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="rounded-lg border-border/30 hover:bg-white/5 h-6 sm:h-8 px-1.5 sm:px-3"
                        onClick={() => slide.image_url && downloadImage(slide.image_url, slide.slide_number)}
                        disabled={!slide.image_url}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Descriptions Tab */}
          <TabsContent value="descriptions" className="space-y-3 sm:space-y-4 animate-fade-in">
            {slides.map((slide, index) => (
              <div 
                key={slide.id} 
                className="glass-card p-4 sm:p-6 animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-xs sm:text-sm">
                    Slide {slide.slide_number}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleEditDescription(slide)}
                    className="rounded-lg hover:bg-white/5 h-7 sm:h-8 text-xs sm:text-sm"
                  >
                    <Edit3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Editar
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">{slide.description}</p>
              </div>
            ))}
          </TabsContent>

          {/* Backups Tab */}
          <TabsContent value="backups" className="animate-fade-in">
            {backupImages.length === 0 ? (
              <div className="glass-card p-8 sm:p-16 text-center">
                <Archive className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/30 mx-auto mb-3 sm:mb-4" />
                <p className="text-muted-foreground text-sm sm:text-base">No hay backups todavía</p>
                <p className="text-xs sm:text-sm text-muted-foreground/50 mt-1">Los backups se crean al hacer remix</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
                {backupImages.map((backup, index) => (
                  <div key={index} className="glass-card overflow-hidden animate-fade-in-up min-w-0" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="relative aspect-video bg-secondary/50 w-full overflow-hidden">
                      <img src={backup.url} alt={`Backup ${backup.slideNumber}`} className="w-full h-full object-contain bg-secondary" />
                      <Badge className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-background/80 border-0 text-xs">
                        Slide {backup.slideNumber}
                      </Badge>
                    </div>
                    <div className="p-2.5 sm:p-4">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full rounded-lg border-border/30 h-7 sm:h-8 text-xs sm:text-sm"
                        onClick={() => downloadImage(backup.url, backup.slideNumber)}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={!!editingSlide} onOpenChange={() => setEditingSlide(null)}>
          <DialogContent className="glass-card border-border/30 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Slide {editingSlide?.slide_number}</DialogTitle>
            </DialogHeader>
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="min-h-[120px] sm:min-h-[150px] bg-secondary/30 border-border/30 rounded-xl text-sm"
            />
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" onClick={() => setEditingSlide(null)} className="rounded-lg">
                Cancelar
              </Button>
              <Button 
                onClick={saveDescription} 
                disabled={isSaving || isRegenerating}
                variant="outline"
                className="rounded-lg border-border/30"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar
              </Button>
              <Button 
                onClick={regenerateSlide} 
                disabled={isRegenerating || isSaving}
                className="rounded-lg shimmer-button"
              >
                {isRegenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Regenerando...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" />Regenerar</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remix Dialog */}
        <Dialog open={!!remixSlide} onOpenChange={() => setRemixSlide(null)}>
          <DialogContent className="glass-card border-border/30 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">Remix Slide {remixSlide?.slide_number}</DialogTitle>
            </DialogHeader>
            {remixSlide?.image_url && (
              <div className="aspect-video bg-secondary/50 rounded-xl overflow-hidden">
                <img src={remixSlide.image_url} alt="Original" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs sm:text-sm font-medium">Prompt de edición</label>
              <Input
                placeholder="Ej: Cambia el fondo a azul oscuro..."
                value={remixPrompt}
                onChange={(e) => setRemixPrompt(e.target.value)}
                className="bg-secondary/30 border-border/30 rounded-xl text-sm"
              />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" onClick={() => setRemixSlide(null)} className="rounded-lg">
                Cancelar
              </Button>
              <Button 
                onClick={handleRemix} 
                disabled={isRemixing || !remixPrompt.trim()}
                className="rounded-lg bg-gradient-to-r from-primary to-accent"
              >
                {isRemixing ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Remixeando...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" />Remix</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
