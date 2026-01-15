import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Menu } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background relative overflow-hidden">
        {/* Global ambient background */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-[150px]" />
        </div>
        
        <AppSidebar />
        
        <main className="flex-1 flex flex-col min-h-screen relative z-10 w-full max-w-full overflow-x-hidden">
          {/* Mobile header */}
          <header className="sticky top-0 z-40 border-b border-border/20 bg-background/60 backdrop-blur-2xl md:hidden">
            <div className="flex items-center h-16 px-4">
              <SidebarTrigger className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                <Menu className="w-5 h-5" />
              </SidebarTrigger>
              <span className="ml-3 font-semibold">
                Transcript<span className="gradient-text">AI</span>
              </span>
            </div>
          </header>
          
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
