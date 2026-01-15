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
    const { presentationId, slideNumber, originalImageUrl, editPrompt, stylePrompt } = await req.json();

    if (!presentationId || !slideNumber || !originalImageUrl || !editPrompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`Remixing slide ${slideNumber} for presentation ${presentationId}`);
    console.log(`Edit prompt: ${editPrompt}`);

    // Call Gemini image editing API
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Edit this presentation slide image according to these instructions: ${editPrompt}. ${stylePrompt ? `Maintain the visual style: ${stylePrompt}` : ''} Keep it professional and suitable for a business presentation.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: originalImageUrl
                }
              }
            ]
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the image from response
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageData) {
      throw new Error('No image returned from AI');
    }

    // Extract base64 data
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid image data format');
    }

    const imageFormat = base64Match[1];
    const base64Data = base64Match[2];
    let binaryData: Uint8Array = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    let finalExtension = imageFormat === 'jpeg' || imageFormat === 'jpg' ? 'jpg' : imageFormat;
    let finalContentType = `image/${imageFormat}`;

    // Convert PNG to JPEG for consistency
    if (imageFormat === 'png') {
      console.log('Converting PNG to JPEG...');
      try {
        const image = await Image.decode(binaryData);
        const jpegData = await image.encodeJPEG(85);
        console.log(`Converted: ${binaryData.length} bytes PNG → ${jpegData.length} bytes JPEG`);
        binaryData = jpegData;
        finalExtension = 'jpg';
        finalContentType = 'image/jpeg';
      } catch (convError) {
        console.error('PNG conversion failed, keeping original:', convError);
      }
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upload new image (replace original)
    const fileName = `${presentationId}/slide_${String(slideNumber).padStart(2, '0')}.${finalExtension}`;
    
    const { error: uploadError } = await supabase.storage
      .from('presentations')
      .upload(fileName, binaryData, {
        contentType: finalContentType,
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('presentations')
      .getPublicUrl(fileName);

    // Add cache buster to force refresh
    const newImageUrl = `${publicUrl}?t=${Date.now()}`;

    // Update slide in database
    await supabase
      .from('slides')
      .update({ image_url: newImageUrl })
      .eq('presentation_id', presentationId)
      .eq('slide_number', slideNumber);

    console.log(`Slide ${slideNumber} remixed successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        newImageUrl,
        message: 'Slide remixed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in remix-slide:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
