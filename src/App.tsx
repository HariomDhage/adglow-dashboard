import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

// Auto-retry dynamic imports on chunk load failure (new deploys invalidate old chunks)
function lazyRetry(importFn: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    importFn().catch(() => {
      const key = 'chunk-reload';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // Return a never-resolving promise so the spinner stays while the page reloads
        return new Promise<{ default: React.ComponentType }>(() => {});
      }
      // Already reloaded once — clear the flag and let it error naturally
      sessionStorage.removeItem(key);
      return importFn();
    })
  );
}

const Landing = lazyRetry(() => import("./pages/Landing"));
const Dashboard = lazyRetry(() => import("./pages/Dashboard"));
const Campaigns = lazyRetry(() => import("./pages/Campaigns"));
const UploadVideo = lazyRetry(() => import("./pages/UploadVideo"));
const Analytics = lazyRetry(() => import("./pages/Analytics"));
const SettingsPage = lazyRetry(() => import("./pages/SettingsPage"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-t-transparent warm-gradient animate-spin" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Landing gets its own Suspense so AppLayout is never unmounted by lazy loading */}
              <Route path="/" element={<Suspense fallback={<PageLoader />}><Landing /></Suspense>} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/upload" element={<UploadVideo />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
