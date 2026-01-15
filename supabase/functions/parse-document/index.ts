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
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    console.log('Parsing document:', file.name, 'Type:', file.type, 'Size:', file.size);

    // For text files, just read the content
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For other document types, we'll use a simple extraction approach
    // In a production environment, you'd want to use a proper document parsing service
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Simple text extraction for basic documents
    // This is a simplified approach - for production, use a proper parsing library
    let text = '';
    
    // Try to extract readable text from the binary
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawText = decoder.decode(bytes);
    
    // Clean up the text by removing non-printable characters
    text = rawText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // If we couldn't extract meaningful text, return an error
    if (text.length < 50) {
      return new Response(JSON.stringify({ 
        error: 'Could not extract text from this file type. Please copy and paste the text manually.',
        text: ''
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Document parsed successfully, text length:', text.length);

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in parse-document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
