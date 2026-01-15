import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, Loader2, FileDown, ArrowLeft,
  Sparkles, Image as ImageIcon, Edit3, RefreshCw, Save,
  Download, CheckSquare, Square, Archive, FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SlideItem {
  id: string;
  title: string;
  description: string;
  image_url?: string | null;
  dbId?: string;
  slide_number: number;
}

interface Presentation {
  id: string;
  outline: any;
  style_prompt: string | null;
  status: string;
  pdf_url: string | null;
}

interface BackupImage {
  slideNumber: number;
  url: string;
  createdAt: string;
}

export default function ScratchEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [backupImages, setBackupImages] = useState<BackupImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Add slide dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideDescription, setNewSlideDescription] = useState('');
  const [isAddingSlide, setIsAddingSlide] = useState(false);

  // Edit slide dialog
  const [editingSlide, setEditingSlide] = useState<SlideItem | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Remix dialog
  const [remixSlide, setRemixSlide] = useState<SlideItem | null>(null);
  const [remixPrompt, setRemixPrompt] = useState('');
  const [isRemixing, setIsRemixing] = useState(false);

  // PDF generation
  const [selectedSlides, setSelectedSlides] = useState<Set<number>>(new Set());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadPresentation();
      loadBackupImages();
    }
  }, [id]);

  const loadPresentation = async () => {
    try {
      const { data: pres, error: presError } = await supabase
        .from('presentations')
        .select('*')
        .eq('id', id)
        .single();

      if (presError) throw presError;
      setPresentation(pres);

      const { data: dbSlides, error: slidesError } = await supabase
        .from('slides')
        .select('*')
        .eq('presentation_id', id)
        .order('slide_number', { ascending: true });

      if (slidesError) throw slidesError;

      const outlineData = pres.outline as { title?: string; slides?: Array<{ slideNumber: number; title: string; content: string[]; description: string }> } | null;

      const slideItems: SlideItem[] = (dbSlides || []).map((s) => ({
        id: s.id,
        dbId: s.id,
        slide_number: s.slide_number,
        title: outlineData?.slides?.find((os) => os.slideNumber === s.slide_number)?.title || `Slide ${s.slide_number}`,
        description: s.description,
        image_url: s.image_url,
      }));

      setSlides(slideItems);
      setSelectedSlides(new Set(slideItems.map(s => s.slide_number)));
    } catch (error) {
      console.error('Error loading presentation:', error);
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
    } catch (error) { }
  };

  const addSlide = async () => {
    if (!newSlideTitle.trim() || !newSlideDescription.trim()) {
      toast.error('Completa título y descripción');
      return;
    }

    setIsAddingSlide(true);
    try {
      const newSlideNumber = slides.length + 1;

      const { data: newDbSlide, error } = await supabase
        .from('slides')
        .insert({
          presentation_id: id,
          slide_number: newSlideNumber,
          description: newSlideDescription,
        })
        .select()
        .single();

      if (error) throw error;

      const updatedOutline = {
        ...presentation?.outline,
        slides: [
          ...(presentation?.outline?.slides || []),
          {
            slideNumber: newSlideNumber,
            title: newSlideTitle,
            content: [newSlideDescription],
            description: newSlideDescription,
          },
        ],
      };

      await supabase
        .from('presentations')
        .update({ outline: updatedOutline })
        .eq('id', id);

      const newSlide: SlideItem = {
        id: newDbSlide.id,
        dbId: newDbSlide.id,
        slide_number: newSlideNumber,
        title: newSlideTitle,
        description: newSlideDescription,
        image_url: null,
      };

      setSlides([...slides, newSlide]);
      setSelectedSlides(prev => new Set([...prev, newSlideNumber]));
      setPresentation((prev) => prev ? { ...prev, outline: updatedOutline } : null);
      setIsAddDialogOpen(false);
      setNewSlideTitle('');
      setNewSlideDescription('');
      toast.success('Diapositiva añadida');
    } catch (error: any) {
      console.error('Error adding slide:', error);
      toast.error(error.message || 'Error al añadir diapositiva');
    } finally {
      setIsAddingSlide(false);
    }
  };

  const removeSlide = async (slideId: string) => {
    const slide = slides.find((s) => s.id === slideId);
    if (!slide?.dbId) return;

    try {
      await supabase.from('slides').delete().eq('id', slide.dbId);

      const newSlides = slides.filter((s) => s.id !== slideId);
      setSlides(newSlides);

      const updatedOutline = {
        ...presentation?.outline,
        slides: newSlides.map((s, i) => ({
          slideNumber: i + 1,
          title: s.title,
          content: [s.description],
          description: s.description,
        })),
      };

      await supabase
        .from('presentations')
        .update({ outline: updatedOutline })
        .eq('id', id);

      for (let i = 0; i < newSlides.length; i++) {
        if (newSlides[i].dbId) {
          await supabase
            .from('slides')
            .update({ slide_number: i + 1 })
            .eq('id', newSlides[i].dbId);
        }
      }

      toast.success('Diapositiva eliminada');
    } catch (error: any) {
      console.error('Error removing slide:', error);
      toast.error('Error al eliminar');
    }
  };

  const handleEditSlide = (slide: SlideItem) => {
    setEditingSlide(slide);
    setEditedTitle(slide.title);
    setEditedDescription(slide.description);
  };

  const saveSlideChanges = async () => {
    if (!editingSlide) return;
    setIsSaving(true);
    try {
      await supabase.from('slides').update({ description: editedDescription }).eq('id', editingSlide.dbId);

      // Update outline
      const updatedOutline = {
        ...presentation?.outline,
        slides: (presentation?.outline?.slides || []).map((s: any) =>
          s.slideNumber === editingSlide.slide_number
            ? { ...s, title: editedTitle, description: editedDescription, content: [editedDescription] }
            : s
        ),
      };

      await supabase.from('presentations').update({ outline: updatedOutline }).eq('id', id);

      setSlides(slides.map(s =>
        s.id === editingSlide.id
          ? { ...s, title: editedTitle, description: editedDescription }
          : s
      ));
      setPresentation(prev => prev ? { ...prev, outline: updatedOutline } : null);
      setEditingSlide(null);
      toast.success('Cambios guardados');
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

      // Save changes first
      await supabase.from('slides').update({ description: editedDescription }).eq('id', editingSlide.dbId);

      const { data, error } = await supabase.functions.invoke('generate-single-slide', {
        body: {
          presentationId: id,
          slideNumber: editingSlide.slide_number,
          title: editedTitle,
          content: [editedDescription],
          description: editedDescription,
          stylePrompt: presentation?.style_prompt || '',
        }
      });

      if (error) throw error;

      setSlides(slides.map(s =>
        s.id === editingSlide.id
          ? { ...s, title: editedTitle, description: editedDescription, image_url: data.imageUrl }
          : s
      ));

      setEditingSlide(null);
      loadBackupImages();
      toast.success('Slide regenerada');
    } catch (error: any) {
      toast.error(error.message || 'Error al regenerar');
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

  const generateAllSlides = async () => {
    if (slides.length === 0) {
      toast.error('Añade al menos una diapositiva');
      return;
    }

    setIsGenerating(true);
    setProgress({ current: 0, total: slides.length + 1 });

    try {
      for (let i = 0; i < slides.length; i++) {
        setProgress({ current: i + 1, total: slides.length + 1 });
        const slide = slides[i];

        try {
          const { data } = await supabase.functions.invoke('generate-single-slide', {
            body: {
              presentationId: id,
              slideNumber: slide.slide_number,
              title: slide.title,
              content: [slide.description],
              description: slide.description,
              stylePrompt: presentation?.style_prompt || '',
            },
          });

          if (data?.imageUrl) {
            setSlides((prev) =>
              prev.map((s, idx) => (idx === i ? { ...s, image_url: data.imageUrl } : s))
            );
          }
        } catch (err) {
          console.error(`Error generating slide ${slide.slide_number}:`, err);
        }
      }

      setProgress({ current: slides.length + 1, total: slides.length + 1 });
      const { data: pdfData } = await supabase.functions.invoke('create-pdf', {
        body: { presentationId: id },
      });

      await supabase
        .from('presentations')
        .update({
          status: 'completed',
          pdf_url: pdfData?.pdfUrl || null,
        })
        .eq('id', id);

      setPresentation((prev) =>
        prev ? { ...prev, status: 'completed', pdf_url: pdfData?.pdfUrl || null } : null
      );

      toast.success('Presentación generada con éxito');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al generar');
    } finally {
      setIsGenerating(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const generatePdfWithSelection = async () => {
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
    } catch (error: any) {
      toast.error(error.message || 'Error al generar PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const downloadPdf = async () => {
    const pdfUrl = presentation?.pdf_url;
    if (!pdfUrl) return;

    setIsDownloadingPdf(true);
    try {
      const url = `${pdfUrl}${pdfUrl.includes('?') ? '&' : '?'}ts=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`No se pudo descargar el PDF (${res.status})`);

      const blob = await res.blob();
      if (!blob || blob.size < 1000) {
        throw new Error('El PDF descargado está vacío. Vuelve a generar la presentación.');
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'presentacion.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast.error(error?.message || 'Error al descargar el PDF');
      const win = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      if (!win) window.location.assign(pdfUrl);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      await supabase.from('slides').delete().eq('presentation_id', id);

      const { data: files } = await supabase.storage.from('presentations').list(id!);
      if (files && files.length > 0) {
        await supabase.storage.from('presentations').remove(files.map(f => `${id}/${f.name}`));
      }
      const { data: backups } = await supabase.storage.from('presentations').list(`${id}/backups`);
      if (backups && backups.length > 0) {
        await supabase.storage.from('presentations').remove(backups.map(f => `${id}/backups/${f.name}`));
      }

      await supabase.from('presentations').delete().eq('id', id);

      toast.success('Proyecto eliminado');
      navigate('/create-scratch');
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Proyecto no encontrado</p>
        <Button variant="outline" onClick={() => navigate('/create-scratch')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  const hasGeneratedImages = slides.some(s => s.image_url);

  return (
    <div className="min-h-screen py-4 px-3 sm:py-8 sm:px-4 w-full max-w-full overflow-hidden">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/create-scratch')}
              className="rounded-xl hover:bg-white/5 shrink-0 h-9 w-9"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold gradient-text truncate">
                {presentation.outline?.title || 'Sin título'}
              </h1>
              {presentation.style_prompt && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  Estilo: {presentation.style_prompt}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              variant="outline"
              size="sm"
              className="gap-2 border-border/30 h-8 text-xs"
            >
              <Plus className="w-4 h-4" />
              Añadir slide
            </Button>
            {presentation.pdf_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPdf}
                disabled={isDownloadingPdf}
                className="rounded-xl border-border/30 hover:bg-white/5 h-8 text-xs"
              >
                {isDownloadingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Download className="w-4 h-4 mr-1.5" />}
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
            <TabsTrigger value="generate" className="rounded-lg data-[state=active]:bg-white/10 text-xs sm:text-sm">
              Generar
            </TabsTrigger>
            <TabsTrigger value="backups" className="rounded-lg data-[state=active]:bg-white/10 text-xs sm:text-sm">
              Backups
            </TabsTrigger>
          </TabsList>

          {/* Slides Tab */}
          <TabsContent value="slides" className="space-y-4 sm:space-y-6 animate-fade-in">
            {slides.length === 0 ? (
              <Card className="glass-card border-border/30 border-dashed">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    No hay diapositivas. Añade la primera para empezar.
                  </p>
                  <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2 shimmer-button">
                    <Plus className="w-4 h-4" />
                    Añadir primera diapositiva
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
                {slides.map((slide, index) => (
                  <Card
                    key={slide.id}
                    className={cn(
                      "glass-card border-border/30 animate-fade-in-up overflow-hidden min-w-0 group",
                      selectedSlides.has(slide.slide_number) && hasGeneratedImages && "ring-2 ring-primary"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="relative aspect-video bg-gradient-to-br from-secondary to-background overflow-hidden w-full">
                      {slide.image_url ? (
                        <img
                          src={slide.image_url}
                          alt={slide.title}
                          className="w-full h-full object-contain bg-secondary"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="p-3 rounded-xl bg-white/5">
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                          </div>
                        </div>
                      )}
                      {hasGeneratedImages && (
                        <div className="absolute top-1 left-1 sm:top-2 sm:left-2">
                          <Checkbox
                            checked={selectedSlides.has(slide.slide_number)}
                            onCheckedChange={() => toggleSlideSelection(slide.slide_number)}
                            className="bg-background/80 border-border h-4 w-4"
                          />
                        </div>
                      )}
                      <Badge className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-background/80 border-0 text-[10px] sm:text-xs px-1.5 py-0.5">
                        {slide.slide_number}
                      </Badge>
                    </div>
                    <CardContent className="p-2 sm:p-3 space-y-1.5">
                      <h3 className="font-medium text-xs sm:text-sm line-clamp-1">{slide.title}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">{slide.description}</p>
                      <div className="flex gap-1 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-lg border-border/30 hover:bg-white/5 h-6 sm:h-7 text-[10px] sm:text-xs px-1.5"
                          onClick={() => handleEditSlide(slide)}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span className="hidden sm:inline ml-1">Editar</span>
                        </Button>
                        {slide.image_url && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg border-border/30 hover:bg-white/5 h-6 sm:h-7 px-1.5"
                              onClick={() => setRemixSlide(slide)}
                            >
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg border-border/30 hover:bg-white/5 h-6 sm:h-7 px-1.5"
                              onClick={() => downloadImage(slide.image_url!, slide.slide_number)}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSlide(slide.id)}
                          className="text-muted-foreground hover:text-destructive h-6 sm:h-7 px-1.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* Generate All */}
            {slides.length > 0 && (
              <div className="glass-card p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base">Generar todas las imágenes</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">Genera imágenes para todas las diapositivas y crea el PDF</p>
                  </div>
                </div>
                <Button
                  onClick={generateAllSlides}
                  disabled={isGenerating}
                  className="w-full shimmer-button py-5 text-base font-semibold"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Generando... ({progress.current}/{progress.total})
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generar presentación ({slides.length} slides)
                    </>
                  )}
                </Button>
                {isGenerating && (
                  <div className="mt-3">
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      {progress.current <= slides.length
                        ? `Generando imagen ${progress.current} de ${slides.length}...`
                        : 'Creando PDF...'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* PDF Controls */}
            {hasGeneratedImages && (
              <div className="glass-card p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base">Regenerar PDF</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Selecciona las diapositivas a incluir</p>
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
                    onClick={generatePdfWithSelection}
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
            )}
          </TabsContent>

          {/* Backups Tab */}
          <TabsContent value="backups" className="animate-fade-in">
            {backupImages.length === 0 ? (
              <div className="glass-card p-8 sm:p-16 text-center">
                <Archive className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/30 mx-auto mb-3 sm:mb-4" />
                <p className="text-muted-foreground text-sm sm:text-base">No hay backups todavía</p>
                <p className="text-xs sm:text-sm text-muted-foreground/50 mt-1">Los backups se crean al editar o hacer remix</p>
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
      </div>

      {/* Add Slide Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="glass-card border-border/30 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Añadir diapositiva
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Título *
              </label>
              <Input
                placeholder="Ej: Introducción"
                value={newSlideTitle}
                onChange={(e) => setNewSlideTitle(e.target.value)}
                className="bg-background/50 border-border/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Descripción *
              </label>
              <Textarea
                placeholder="Describe el contenido de esta diapositiva en lenguaje natural..."
                value={newSlideDescription}
                onChange={(e) => setNewSlideDescription(e.target.value)}
                className="bg-background/50 border-border/30 min-h-[120px]"
              />
            </div>
            <Button
              onClick={addSlide}
              disabled={isAddingSlide}
              className="w-full shimmer-button"
            >
              {isAddingSlide ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Añadiendo...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Añadir diapositiva
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Slide Dialog */}
      <Dialog open={!!editingSlide} onOpenChange={() => setEditingSlide(null)}>
        <DialogContent className="glass-card border-border/30 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Slide {editingSlide?.slide_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Título</label>
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="bg-secondary/30 border-border/30 rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Descripción</label>
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="min-h-[120px] sm:min-h-[150px] bg-secondary/30 border-border/30 rounded-xl text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setEditingSlide(null)} className="rounded-lg">
              Cancelar
            </Button>
            <Button
              onClick={saveSlideChanges}
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
  );
}
