import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  console.log('create-outline function called');
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysis, stylePrompt } = await req.json();
    
    console.log('Creating presentation outline with Gemini 3 Pro...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const messages = [
      {
        role: 'system',
        content: `Eres un experto diseñador de presentaciones ejecutivas. Tu tarea es crear un outline detallado para una presentación profesional basándote en el análisis de una reunión.

IMPORTANTE: Debes crear entre 10 y 15 diapositivas para cubrir adecuadamente todo el contenido.

Para cada diapositiva debes proporcionar:
1. title: Título de la diapositiva (corto, impactante)
2. content: Contenido principal con los puntos clave en formato de bullets o párrafo
3. description: Descripción COMPLETA para generar la imagen de la diapositiva

${stylePrompt ? `Estilo visual deseado: ${stylePrompt}` : 'Estilo visual: Profesional, corporativo, moderno'}

CRÍTICO para el campo "description":
- Debe ser una descripción en INGLÉS para el modelo de generación de imágenes
- DEBE incluir el texto EXACTO que debe aparecer visible en la diapositiva (título y puntos clave)
- Debe describir el layout, colores, tipografía y elementos visuales
- Incluir instrucciones de diseño específicas

Ejemplo de description correcto:
"A professional presentation slide with dark blue gradient background. Large white title text at top reading 'Q4 Financial Results'. Below the title, three bullet points in white text: '• Revenue increased 25%', '• New market expansion completed', '• Customer satisfaction at 95%'. Modern sans-serif typography (like Montserrat or Roboto). A subtle upward trending graph icon in the bottom right corner in teal color. Clean minimalist corporate design with plenty of white space."

IMPORTANTE: Responde SOLO con un JSON válido sin markdown ni texto adicional. El formato debe ser:
{
  "title": "Título de la presentación",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Título de la diapositiva",
      "content": "Contenido principal con puntos clave en español",
      "description": "Complete English description for image generation including ALL text that must appear on the slide, visual elements, colors, layout, and typography"
    }
  ]
}`
      },
      {
        role: 'user',
        content: `Crea un outline de presentación basándote en este análisis:

${analysis}

INSTRUCCIONES:
1. Genera entre 10 y 15 diapositivas según la cantidad y complejidad del contenido
2. La primera diapositiva debe ser una portada con el título principal
3. La última diapositiva debe ser un cierre/conclusiones/próximos pasos
4. Cada "description" DEBE incluir el texto exacto que debe aparecer visible en la imagen
5. Las descripciones deben ser en inglés y muy detalladas para generar imágenes de alta calidad`
      }
    ];

    console.log('Calling AI Gateway for outline generation...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages,
        max_tokens: 8000,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log('AI Gateway response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    let outlineText = data.choices?.[0]?.message?.content || '';
    
    // Clean up the response - remove markdown code blocks if present
    outlineText = outlineText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log('Outline text:', outlineText.substring(0, 500));

    let outline;
    try {
      outline = JSON.parse(outlineText);
    } catch (parseError) {
      console.error('Failed to parse outline JSON:', parseError);
      // Try to extract JSON from the response
      const jsonMatch = outlineText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        outline = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid outline format from AI');
      }
    }

    console.log('Outline created successfully with', outline.slides?.length, 'slides');

    return new Response(JSON.stringify({ outline }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create-outline:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
