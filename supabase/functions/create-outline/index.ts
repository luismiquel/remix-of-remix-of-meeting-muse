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
    
    console.log('Creating presentation outline...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const messages = [
      {
        role: 'system',
        content: `You are an expert executive presentation designer. Create concise, decision-focused presentations.

CRITICAL RULES:
- Create 6-10 slides maximum (prefer fewer, more impactful slides)
- Focus on decisions, conclusions, and action items
- NO filler slides, NO excessive detail
- Each slide must have a clear purpose

For each slide provide:
1. title: Short, impactful title (max 6 words)
2. content: Key points as bullet list (max 4 bullets per slide)
3. description: COMPLETE English description for image generation

${stylePrompt ? `Visual style: ${stylePrompt}` : 'Visual style: Professional, corporate, modern, clean'}

CRITICAL for "description" field:
- Must be in ENGLISH for the image generation model
- MUST include the EXACT text that should appear visible on the slide
- Describe layout, colors, typography and visual elements
- Include specific design instructions

Example description:
"A professional presentation slide with dark blue gradient background. Large white title text at top reading 'Q4 Results'. Below, three bullet points in white: '• Revenue +25%', '• New markets launched', '• 95% satisfaction'. Modern sans-serif typography. Clean minimalist corporate design."

IMPORTANT: Respond ONLY with valid JSON without markdown. Format:
{
  "title": "Presentation Title",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide title",
      "content": "Main content with key points",
      "description": "Complete English description for image generation including ALL visible text"
    }
  ]
}`
      },
      {
        role: 'user',
        content: `Create an executive presentation outline based on this analysis:

${analysis}

INSTRUCTIONS:
1. Generate 6-10 slides maximum
2. First slide: title/cover
3. Last slide: conclusions/next steps
4. Each "description" MUST include exact text to appear on the image
5. Descriptions must be detailed and in English`
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
