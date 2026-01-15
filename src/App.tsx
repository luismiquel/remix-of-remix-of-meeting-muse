import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import CreatePage from "./pages/CreatePage";
import CreateFromScratchPage from "./pages/CreateFromScratchPage";
import ScratchEditorPage from "./pages/ScratchEditorPage";
import SettingsPage from "./pages/SettingsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<CreatePage />} />
                      <Route path="/create-scratch" element={<CreateFromScratchPage />} />
                      <Route path="/create-scratch/:id" element={<ScratchEditorPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/projects" element={<ProjectsPage />} />
                      <Route path="/projects/:id" element={<ProjectDetailPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
