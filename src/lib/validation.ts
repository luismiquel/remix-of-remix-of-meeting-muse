import { z } from 'zod';

export const transcriptSchema = z.object({
  transcript: z
    .string()
    .trim()
    .min(100, 'Transcript must be at least 100 characters')
    .max(100000, 'Transcript must be less than 100,000 characters')
});

export const validateTranscript = (text: string): { isValid: boolean; error: string | null } => {
  const result = transcriptSchema.safeParse({ transcript: text });
  return {
    isValid: result.success,
    error: result.success ? null : result.error.errors[0]?.message ?? null
  };
};

export const ALLOWED_FILE_TYPES = [
  'text/plain',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const ALLOWED_EXTENSIONS = ['.txt', '.doc', '.docx', '.pdf'];

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const validateFile = (file: File): { isValid: boolean; error: string | null } => {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  const isValidType = ALLOWED_FILE_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(extension);
  
  if (!isValidType) {
    return {
      isValid: false,
      error: `Only ${ALLOWED_EXTENSIONS.join(', ')} files are supported`
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit. Please use a smaller file.`
    };
  }

  return { isValid: true, error: null };
};
