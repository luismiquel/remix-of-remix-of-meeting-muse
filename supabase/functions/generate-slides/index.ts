import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { presentationId, slides, stylePrompt } = await req.json();
    
    console.log('Generating slide images with Nano Banana Pro...');
    console.log('Number of slides:', slides?.length);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const generatedImages: { slideNumber: number; imageUrl: string }[] = [];

    // Generate images for each slide
    for (const slide of slides) {
      console.log(`Generating image for slide ${slide.slideNumber}...`);
      
      const imagePrompt = `Professional presentation slide design, 16:9 aspect ratio, high quality corporate design. ${stylePrompt || 'Modern minimalist style with clean typography'}. ${slide.description}. Ultra high resolution, sharp text, professional business presentation.`;

      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-pro-image-preview',
            messages: [
              {
                role: 'user',
                content: imagePrompt
              }
            ],
            modalities: ['image', 'text']
          }),
        });

        if (!response.ok) {
          console.error(`Error generating image for slide ${slide.slideNumber}:`, response.status);
          continue;
        }

        const data = await response.json();
        const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (imageBase64) {
          // Extract base64 data and convert to binary
          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

          // Upload to Supabase Storage
          const fileName = `${presentationId}/slide_${String(slide.slideNumber).padStart(2, '0')}.png`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('presentations')
            .upload(fileName, binaryData, {
              contentType: 'image/png',
              upsert: true
            });

          if (uploadError) {
            console.error(`Error uploading slide ${slide.slideNumber}:`, uploadError);
            continue;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('presentations')
            .getPublicUrl(fileName);

          // Update slide in database
          await supabase
            .from('slides')
            .update({ image_url: urlData.publicUrl })
            .eq('presentation_id', presentationId)
            .eq('slide_number', slide.slideNumber);

          generatedImages.push({
            slideNumber: slide.slideNumber,
            imageUrl: urlData.publicUrl
          });

          console.log(`Slide ${slide.slideNumber} generated and uploaded successfully`);
        }
      } catch (slideError) {
        console.error(`Error processing slide ${slide.slideNumber}:`, slideError);
      }

      // Small delay between image generations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('All slide images generated:', generatedImages.length);

    return new Response(JSON.stringify({ 
      success: true, 
      generatedImages,
      totalSlides: slides.length,
      successfulSlides: generatedImages.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-slides:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
