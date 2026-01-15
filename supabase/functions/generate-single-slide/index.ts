import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Image } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { presentationId, slideNumber, title, content, description, stylePrompt } = await req.json();
    
    // Normalize content to string
    const contentStr = Array.isArray(content) ? content.join('\n') : (typeof content === 'string' ? content : JSON.stringify(content || ''));
    
    console.log(`Generating image for slide ${slideNumber}...`);
    console.log(`Title: ${title}`);
    console.log(`Content: ${contentStr?.substring(0, 100)}...`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Build comprehensive image prompt that includes the actual slide content
    let imagePrompt = `Create a professional presentation slide image, 16:9 aspect ratio, high quality corporate design.

SLIDE CONTENT TO DISPLAY:
`;

    if (title) {
      imagePrompt += `TITLE: "${title}"
`;
    }

    if (contentStr) {
      imagePrompt += `CONTENT/BULLET POINTS: ${contentStr}
`;
    }

    imagePrompt += `
VISUAL DESIGN INSTRUCTIONS:
${description}

`;

    if (stylePrompt) {
      imagePrompt += `ADDITIONAL STYLE: ${stylePrompt}

`;
    }

    imagePrompt += `IMPORTANT REQUIREMENTS:
- The text "${title || 'slide title'}" MUST be clearly visible and readable on the slide
- All bullet points and content text must be rendered clearly
- Use professional typography with good contrast
- Ultra high resolution, sharp text, professional business presentation
- 16:9 aspect ratio suitable for presentations`;

    console.log('Image prompt:', imagePrompt.substring(0, 500));

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
      const errorText = await response.text();
      console.error(`Error generating image for slide ${slideNumber}:`, response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageBase64) {
      throw new Error('No image returned from AI Gateway');
    }

    // Detect real image format from data URL
    const mimeMatch = imageBase64.match(/^data:image\/(\w+);base64,/);
    const imageFormat = mimeMatch ? mimeMatch[1] : 'png';
    const extension = imageFormat === 'jpeg' ? 'jpg' : imageFormat;
    const contentType = `image/${imageFormat}`;
    
    console.log(`Detected image format: ${imageFormat}, extension: ${extension}`);

    // Extract base64 data and convert to binary
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    let binaryData: Uint8Array = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    let finalFormat = imageFormat;
    let finalExtension = extension;
    let finalContentType = contentType;

    // Convert PNG to JPEG for smaller file size and faster PDF processing
    if (imageFormat === 'png') {
      console.log(`Converting PNG to JPEG for slide ${slideNumber}...`);
      try {
        const image = await Image.decode(binaryData);
        const jpegData = await image.encodeJPEG(85); // 85% quality - good balance
        console.log(`Converted: ${binaryData.length} bytes PNG → ${jpegData.length} bytes JPEG`);
        binaryData = jpegData;
        finalFormat = 'jpeg';
        finalExtension = 'jpg';
        finalContentType = 'image/jpeg';
      } catch (convError) {
        console.error(`PNG conversion failed, keeping original:`, convError);
        // Keep original PNG if conversion fails
      }
    }

    // Upload to Supabase Storage with correct extension and content type
    const fileName = `${presentationId}/slide_${String(slideNumber).padStart(2, '0')}.${finalExtension}`;
    
    const { error: uploadError } = await supabase.storage
      .from('presentations')
      .upload(fileName, binaryData, {
        contentType: finalContentType,
        upsert: true
      });

    if (uploadError) {
      console.error(`Error uploading slide ${slideNumber}:`, uploadError);
      throw new Error(`Upload error: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('presentations')
      .getPublicUrl(fileName);

    // Update slide in database
    const { error: updateError } = await supabase
      .from('slides')
      .update({ image_url: urlData.publicUrl })
      .eq('presentation_id', presentationId)
      .eq('slide_number', slideNumber);

    if (updateError) {
      console.error(`Error updating slide ${slideNumber} in DB:`, updateError);
      throw new Error(`Database update error: ${updateError.message}`);
    }

    console.log(`Slide ${slideNumber} generated and saved successfully as ${finalExtension}`);

    return new Response(JSON.stringify({ 
      success: true, 
      slideNumber,
      imageUrl: urlData.publicUrl,
      format: extension
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-single-slide:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
