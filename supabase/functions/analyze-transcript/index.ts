import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { systemPrompt, userPrompt, transcript } = await req.json();
    
    console.log('Analyzing transcript with Gemini 3 Pro...');
    console.log('Transcript length:', transcript?.length);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const messages = [
      {
        role: 'system',
        content: `Eres un experto en análisis de reuniones y creación de presentaciones. Tu tarea es analizar transcripts de reuniones y extraer la información más relevante para crear presentaciones impactantes.

${systemPrompt ? `Instrucciones adicionales del usuario: ${systemPrompt}` : ''}

Debes analizar el transcript y proporcionar:
1. Los puntos clave de la reunión
2. Las decisiones tomadas
3. Los próximos pasos y responsables
4. Datos o métricas mencionados
5. Temas que requieren visualización

Responde en español y de forma estructurada.`
      },
      {
        role: 'user',
        content: `${userPrompt ? `Enfoque específico para esta presentación: ${userPrompt}\n\n` : ''}

Analiza el siguiente transcript de reunión:

${transcript}`
      }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages,
        max_tokens: 4000,
      }),
    });

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
    const analysis = data.choices?.[0]?.message?.content;

    console.log('Analysis completed successfully');

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-transcript:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
