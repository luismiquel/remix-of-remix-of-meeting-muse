import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { validateFile, validateTranscript, ALLOWED_EXTENSIONS } from '@/lib/validation';

interface TranscriptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minLength?: number;
  maxLength?: number;
  error?: string | null;
}

export const TranscriptInput = ({
  value,
  onChange,
  disabled = false,
  minLength = 100,
  maxLength = 100000,
  error: externalError
}: TranscriptInputProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validation = validateTranscript(value);
  const charCount = value.trim().length;
  const hasContent = charCount > 0;
  const isValid = validation.isValid;
  const displayError = externalError || (hasContent && !isValid ? validation.error : null);

  const processFile = async (file: File) => {
    const fileValidation = validateFile(file);
    if (!fileValidation.isValid) {
      setFileError(fileValidation.error);
      toast.error(fileValidation.error);
      return;
    }

    setFileError(null);
    setIsProcessing(true);
    setFileName(file.name);

    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text();
        onChange(text);
        toast.success('File loaded successfully');
      } else {
        const formData = new FormData();
        formData.append('file', file);

        const { data, error } = await supabase.functions.invoke('parse-document', {
          body: formData,
        });

        if (error) throw error;
        onChange(data.text);
        toast.success('File processed successfully');
      }
    } catch (error) {
      const message = 'Could not read this file. Try copying and pasting the text instead.';
      setFileError(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessing) {
      setIsDragOver(true);
    }
  }, [disabled, isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || isProcessing) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [disabled, isProcessing]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    onChange('');
    setFileName(null);
    setFileError(null);
  };

  const handleClick = () => {
    if (!disabled && !isProcessing) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 p-8",
          "border-2 border-dashed rounded-2xl",
          "cursor-pointer transition-all duration-300",
          "group",
          isDragOver && "border-primary bg-primary/10 scale-[1.02]",
          !isDragOver && !fileError && "border-border/50 hover:border-primary/50 hover:bg-primary/5",
          fileError && "border-destructive/50 bg-destructive/5",
          isProcessing && "pointer-events-none opacity-75",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <Input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || isProcessing}
        />

        {isProcessing ? (
          <>
            <div className="p-4 rounded-full bg-primary/10">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">Processing file...</p>
              {fileName && (
                <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={cn(
              "p-4 rounded-full transition-colors",
              isDragOver ? "bg-primary/20" : "bg-secondary/50 group-hover:bg-primary/10",
              fileError && "bg-destructive/10"
            )}>
              {fileError ? (
                <AlertCircle className="w-8 h-8 text-destructive" />
              ) : (
                <Upload className={cn(
                  "w-8 h-8 transition-colors",
                  isDragOver ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                )} />
              )}
            </div>
            <div className="text-center">
              <p className={cn(
                "font-medium",
                fileError ? "text-destructive" : "text-foreground"
              )}>
                {isDragOver ? 'Drop your file here' : 'Drag a file here'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to select ({ALLOWED_EXTENSIONS.join(', ')}, max 10MB)
              </p>
            </div>
          </>
        )}
      </div>

      {/* File Error */}
      {fileError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

      {/* Textarea */}
      <div className="relative">
        <Textarea
          placeholder="Or paste your meeting transcript here..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || isProcessing}
          className={cn(
            "min-h-[200px] resize-none font-mono text-sm pr-24",
            "bg-secondary/30 border-border/30 rounded-xl",
            "focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
            "transition-all duration-300 placeholder:text-muted-foreground/50",
            displayError && "border-destructive/50 focus:border-destructive/50 focus:ring-destructive/20"
          )}
        />
        
        {/* Character count & clear button */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          {hasContent && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled || isProcessing}
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5",
            isValid && hasContent ? "bg-success/10 text-success" : 
            hasContent ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
          )}>
            {isValid && hasContent && <CheckCircle2 className="w-3 h-3" />}
            {charCount.toLocaleString()} / {minLength}+
          </div>
        </div>
      </div>

      {/* Validation Error */}
      {displayError && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
};
