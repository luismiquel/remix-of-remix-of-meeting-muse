import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LogViewerProps {
  logs: string[];
}

export const LogViewer = ({ logs }: LogViewerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary group-hover:bg-secondary/80 transition-colors">
            <Terminal className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-left">
            <span className="font-medium block">Logs del Proceso</span>
            <span className="text-xs text-muted-foreground">{logs.length} entradas</span>
          </div>
        </div>
        <div className={cn(
          "p-2 rounded-lg bg-secondary transition-transform duration-300",
          isExpanded && "rotate-180"
        )}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </div>
      </button>
      
      <div className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden",
        isExpanded ? "max-h-80" : "max-h-0"
      )}>
        <div className="border-t border-border/20">
          <div 
            ref={scrollRef}
            className="bg-background/50 p-4 max-h-72 overflow-y-auto font-mono text-xs space-y-1"
          >
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={cn(
                  "py-1 px-2 rounded transition-colors",
                  log.includes('ERROR') && "text-destructive bg-destructive/5",
                  log.includes('completado') && "text-success",
                  log.includes('exitosamente') && "text-success",
                  log.includes('Paso') && "text-primary font-semibold bg-primary/5",
                  log.includes('✓') && "text-success",
                  log.includes('✗') && "text-destructive",
                )}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
