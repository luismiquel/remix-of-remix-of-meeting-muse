import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, Download, FileText, Image as ImageIcon, Edit3, 
  Loader2, Save, RefreshCw, CheckSquare, Square, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
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

const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  const [selectedSlides, setSelectedSlides] = useState<Set<number>>(new Set());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadProject();
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
      toast.error('Error loading project');
    } finally {
      setIsLoading(false);
    }
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
      toast.success('Description saved');
    } catch (error) {
      toast.error('Error saving');
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
      toast.success('Slide regenerated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Error regenerating slide');
    } finally {
      setIsRegenerating(false);
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
      toast.error('Select at least one slide');
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
      toast.success('PDF generated');
      window.open(data.pdfUrl, '_blank');
    } catch (error: any) {
      toast.error(error.message || 'Error generating PDF');
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
      
      toast.success('Project deleted');
      navigate('/projects');
    } catch (error) {
      toast.error('Error deleting project');
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
      <div className="p-8 text-center text-muted-foreground">Project not found</div>
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
              <h1 className="text-lg sm:text-2xl font-bold truncate">{presentation.outline?.title || 'Presentation'}</h1>
              <p className="text-muted-foreground text-xs">
                {format(new Date(presentation.created_at), 'MMM dd, yyyy, HH:mm')}
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
                Download PDF
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
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-card border-border/30 mx-4 max-w-[calc(100vw-2rem)]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete the project, all its slides and images. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteProject}
                    disabled={isDeleting}
                    className="rounded-lg bg-destructive hover:bg-destructive/90"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* PDF Controls */}
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <div className="p-2 rounded-xl bg-primary/10 shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base">Generate PDF</h3>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Select slides to include</p>
            </div>
            <Badge variant="secondary" className="bg-white/5 shrink-0">
              {selectedSlides.size}/{slides.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={selectAllSlides} className="rounded-lg border-border/30 text-xs sm:text-sm">
              <CheckSquare className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAllSlides} className="rounded-lg border-border/30 text-xs sm:text-sm">
              <Square className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              None
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
                <><Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />Generating...</>
              ) : (
                <><RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />Generate PDF</>
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
                    onClick={() => handleEditDescription(slide)}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span className="hidden sm:inline ml-1">Edit</span>
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

        {/* Edit Dialog */}
        <Dialog open={!!editingSlide} onOpenChange={() => setEditingSlide(null)}>
          <DialogContent className="glass-card border-border/30 mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Slide {editingSlide?.slide_number}</DialogTitle>
            </DialogHeader>
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="min-h-[120px] sm:min-h-[150px] bg-secondary/30 border-border/30 rounded-xl text-sm"
            />
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" onClick={() => setEditingSlide(null)} className="rounded-lg">
                Cancel
              </Button>
              <Button 
                onClick={saveDescription} 
                disabled={isSaving || isRegenerating}
                variant="outline"
                className="rounded-lg border-border/30"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
              <Button 
                onClick={regenerateSlide} 
                disabled={isRegenerating || isSaving}
                className="rounded-lg shimmer-button"
              >
                {isRegenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Regenerating...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" />Regenerate</>
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
