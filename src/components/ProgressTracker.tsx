import { Check, Circle, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Task {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

interface ProgressTrackerProps {
  tasks: Task[];
  slideProgress?: { completed: number; total: number };
}

export const ProgressTracker = ({ tasks, slideProgress }: ProgressTrackerProps) => {
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progress = (completedCount / tasks.length) * 100;

  return (
    <div className="glass-card p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Creando Presentación</h3>
          <p className="text-sm text-muted-foreground">
            {completedCount} de {tasks.length} pasos completados
          </p>
        </div>
        <span className="text-2xl font-bold gradient-text">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary via-primary to-accent transition-all duration-700 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div 
          className="absolute top-0 h-2 bg-gradient-to-r from-white/20 to-transparent blur-sm rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Tasks */}
      <div className="space-y-2">
        {tasks.map((task, index) => (
          <div 
            key={task.id}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl transition-all duration-300",
              task.status === 'processing' && "bg-primary/5 border border-primary/20",
              task.status === 'completed' && "bg-success/5",
              task.status === 'error' && "bg-destructive/5",
              task.status === 'pending' && "opacity-50"
            )}
          >
            {/* Status indicator */}
            <div className="flex-shrink-0">
              {task.status === 'completed' && (
                <div className="w-8 h-8 rounded-xl bg-success/20 flex items-center justify-center animate-scale-in">
                  <Check className="w-4 h-4 text-success" />
                </div>
              )}
              {task.status === 'processing' && (
                <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center relative">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <div className="absolute inset-0 rounded-xl bg-primary/20 animate-ping" />
                </div>
              )}
              {task.status === 'pending' && (
                <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
                  <span className="text-xs font-medium text-muted-foreground">{index + 1}</span>
                </div>
              )}
              {task.status === 'error' && (
                <div className="w-8 h-8 rounded-xl bg-destructive/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-destructive">!</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-medium",
                task.status === 'completed' && "text-success",
                task.status === 'processing' && "text-primary",
                task.status === 'error' && "text-destructive"
              )}>
                {task.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {task.description}
              </p>
              {task.id === 'images' && task.status === 'processing' && slideProgress && slideProgress.total > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-primary font-medium">
                      Slide {slideProgress.completed}/{slideProgress.total}
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round((slideProgress.completed / slideProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${(slideProgress.completed / slideProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {task.status === 'error' && task.errorMessage && (
                <p className="text-xs text-destructive mt-2 bg-destructive/10 rounded-lg px-3 py-2">
                  {task.errorMessage}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
