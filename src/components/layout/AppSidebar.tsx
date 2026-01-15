import { Settings, PlusCircle, FolderOpen, Presentation, FilePlus2, LogOut, User } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

const menuItems = [
  { title: 'Crear', url: '/', icon: PlusCircle },
  { title: 'Crear desde cero', url: '/create-scratch', icon: FilePlus2 },
  { title: 'Proyectos', url: '/projects', icon: FolderOpen },
  { title: 'Ajustes', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const { user, signOut } = useAuth();
  const isCollapsed = state === 'collapsed';
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sesión cerrada');
  };

  return (
    <Sidebar className="border-r border-border/30 bg-sidebar/80 backdrop-blur-xl">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 glow-effect">
            <Presentation className="w-6 h-6 text-primary" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 blur-xl" />
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                Transcript<span className="gradient-text">AI</span>
              </h1>
              <p className="text-xs text-muted-foreground">Presentations reimagined</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item, index) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink 
                      to={item.url} 
                      end={item.url === '/'}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                        "hover:bg-white/5 group relative overflow-hidden",
                        isActive(item.url) && "bg-white/10"
                      )}
                      activeClassName="bg-white/10"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {isActive(item.url) && (
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent" />
                      )}
                      <div className={cn(
                        "p-2 rounded-lg transition-all duration-300",
                        isActive(item.url) 
                          ? "bg-primary/20 text-primary" 
                          : "bg-white/5 text-muted-foreground group-hover:bg-white/10 group-hover:text-foreground"
                      )}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      {!isCollapsed && (
                        <span className={cn(
                          "font-medium transition-colors duration-300",
                          isActive(item.url) ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {item.title}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/20 space-y-3">
        {user && (
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5",
            isCollapsed && "justify-center"
          )}>
            <div className="p-2 rounded-lg bg-primary/20">
              <User className="w-4 h-4 text-primary" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  Jon Hernández
                </p>
              </div>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "default"}
          onClick={handleSignOut}
          className={cn(
            "w-full rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors",
            isCollapsed && "px-2"
          )}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
        <div className="flex items-center justify-center">
          <p className="text-xs text-muted-foreground/50">
            {!isCollapsed && "Powered by Gemini 3 Pro"}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
