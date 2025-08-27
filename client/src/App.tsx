import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";

import AgentDashboard from "@/pages/agent-dashboard";
import PermitForm from "@/pages/permit-form";
import AdminDashboard from "@/pages/admin-dashboard";
import CameraCapture from "@/pages/camera-capture";
import QRScanner from "@/pages/qr-scanner";
import BottomNav from "@/components/bottom-nav";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AgentDashboard} />
      <Route path="/permit-form" component={PermitForm} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/camera" component={CameraCapture} />
      <Route path="/scanner" component={QRScanner} />
      <Route>
        <AgentDashboard />
      </Route>
    </Switch>
  );
}

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {/* Offline indicator */}
          <div className={`offline-indicator ${!isOnline ? 'show' : ''}`}>
            <i className="fas fa-wifi-slash mr-2"></i>
            Mode hors ligne - Les données seront synchronisées à la reconnexion
          </div>

          {/* Navigation Bar */}
          <nav className="bg-primary text-primary-foreground p-4 flex items-center justify-between sticky top-0 z-50 shadow-lg">
            <div className="flex items-center space-x-3">
              <i className="fas fa-fish text-xl" data-testid="nav-logo"></i>
              <h1 className="text-lg font-semibold">Permis de Pêche</h1>
            </div>
            <div className="flex items-center space-x-3">
              {/* Sync Status Indicator */}
              <div className="flex items-center space-x-1 text-sm" data-testid="sync-status">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-secondary' : 'bg-accent'} ${isOnline ? 'sync-indicator' : ''}`}></div>
                <span className="hidden sm:inline">{isOnline ? 'Synchronisé' : 'Hors ligne'}</span>
              </div>
            </div>
          </nav>

          <Router />
          <BottomNav />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
