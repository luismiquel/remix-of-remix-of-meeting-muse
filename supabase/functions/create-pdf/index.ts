import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { PDFDocument, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect image format using magic bytes
const detectImageFormat = (bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | 'unknown' => {
  if (bytes.length < 12) return 'unknown';
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'jpeg';
  }
  // WebP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'webp';
  }
  return 'unknown';
};

interface SlideData {
  slide_number: number;
  image_url: string | null;
}

interface ImageFetchResult {
  slide: SlideData;
  imageBytes: ArrayBuffer | null;
  format: 'png' | 'jpeg' | 'webp' | 'unknown' | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { presentationId, selectedSlides } = await req.json();
    
    console.log('Creating PDF for presentation:', presentationId);
    console.log('Selected slides:', selectedSlides || 'all');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get slides for this presentation
    let query = supabase
      .from('slides')
      .select('*')
      .eq('presentation_id', presentationId);
    
    // Filter by selected slides if provided
    if (selectedSlides && Array.isArray(selectedSlides) && selectedSlides.length > 0) {
      query = query.in('slide_number', selectedSlides);
    }
    
    const { data: slides, error: slidesError } = await query.order('slide_number', { ascending: true });

    if (slidesError) {
      throw new Error('Error fetching slides: ' + slidesError.message);
    }

    console.log('Found', slides.length, 'slides');

    // Pre-fetch all images in parallel to optimize CPU time
    console.log('Pre-fetching all images in parallel...');
    const startFetch = Date.now();
    
    const imagePromises = slides.map(async (slide: SlideData): Promise<ImageFetchResult> => {
      if (!slide.image_url) {
        return { slide, imageBytes: null, format: null };
      }
      
      try {
        const response = await fetch(slide.image_url);
        if (!response.ok) {
          console.error(`Slide ${slide.slide_number}: failed to fetch, status ${response.status}`);
          return { slide, imageBytes: null, format: null };
        }
        
        const imageBytes = await response.arrayBuffer();
        const uint8Array = new Uint8Array(imageBytes);
        const format = detectImageFormat(uint8Array);
        
        console.log(`Slide ${slide.slide_number}: pre-fetched, format = ${format}, size = ${imageBytes.byteLength} bytes`);
        return { slide, imageBytes, format };
      } catch (err) {
        console.error(`Slide ${slide.slide_number}: fetch error:`, err);
        return { slide, imageBytes: null, format: null };
      }
    });

    const imageResults = await Promise.all(imagePromises);
    const fetchTime = Date.now() - startFetch;
    console.log(`Pre-fetched ${imageResults.filter(r => r.imageBytes).length}/${slides.length} images in ${fetchTime}ms`);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Standard 16:9 presentation size (in points)
    const slideWidth = 1920 * 0.5; // Scale down for reasonable PDF size
    const slideHeight = 1080 * 0.5;

    // Now embed each image (this is sequential but images are already fetched)
    for (const { slide, imageBytes, format } of imageResults) {
      console.log(`Adding slide ${slide.slide_number} to PDF...`);
      
      const page = pdfDoc.addPage([slideWidth, slideHeight]);

      // Draw white background first to handle transparent PNGs
      page.drawRectangle({
        x: 0,
        y: 0,
        width: slideWidth,
        height: slideHeight,
        color: rgb(1, 1, 1), // White background
      });

      if (imageBytes && format) {
        try {
          let image;
          
          if (format === 'png') {
            image = await pdfDoc.embedPng(imageBytes);
          } else if (format === 'jpeg') {
            image = await pdfDoc.embedJpg(imageBytes);
          } else if (format === 'webp') {
            // WebP not supported by pdf-lib, keep white background
            console.error(`Slide ${slide.slide_number}: WebP format not supported`);
            continue;
          } else {
            // Unknown format, try PNG then JPEG as fallback
            console.log(`Slide ${slide.slide_number}: unknown format, trying PNG then JPEG`);
            try {
              image = await pdfDoc.embedPng(imageBytes);
            } catch {
              try {
                image = await pdfDoc.embedJpg(imageBytes);
              } catch {
                console.error(`Slide ${slide.slide_number}: failed to embed as PNG or JPEG`);
                continue;
              }
            }
          }

          // Draw image to fill the page
          const scaledDims = image.scaleToFit(slideWidth, slideHeight);
          const x = (slideWidth - scaledDims.width) / 2;
          const y = (slideHeight - scaledDims.height) / 2;

          console.log(`Slide ${slide.slide_number}: embedding ${image.width}x${image.height} -> ${scaledDims.width.toFixed(0)}x${scaledDims.height.toFixed(0)}`);

          page.drawImage(image, {
            x,
            y,
            width: scaledDims.width,
            height: scaledDims.height,
          });
        } catch (imageError) {
          console.error(`Error embedding image for slide ${slide.slide_number}:`, imageError);
          // White background already drawn, just continue
        }
      } else {
        console.log(`Slide ${slide.slide_number}: no image available`);
        // White background already drawn
      }
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();
    console.log('PDF generated, size:', pdfBytes.length, 'bytes');

    // Upload PDF to storage
    const pdfFileName = `${presentationId}/presentation.pdf`;

    const pdfArrayBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(pdfArrayBuffer).set(pdfBytes);
    const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    const { error: uploadError } = await supabase.storage
      .from('presentations')
      .upload(pdfFileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      throw new Error('Error uploading PDF: ' + uploadError.message);
    }

    // Get public URL with cache-busting timestamp
    const { data: urlData } = supabase.storage
      .from('presentations')
      .getPublicUrl(pdfFileName);

    const pdfUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    console.log('PDF uploaded successfully:', pdfUrl);

    return new Response(JSON.stringify({ 
      success: true, 
      pdfUrl: pdfUrl,
      totalPages: slides.length,
      pdfSize: pdfBytes.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create-pdf:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
