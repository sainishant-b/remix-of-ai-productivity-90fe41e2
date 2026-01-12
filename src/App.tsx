import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import TaskWorkspace from "./pages/TaskWorkspace";
import CalendarView from "./pages/CalendarView";
import Insights from "./pages/Insights";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Handle Android back button and notification deep linking
const NavigationHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Handle Android hardware back button
    if (Capacitor.isNativePlatform()) {
      const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        // Dispatch event to close any open modals/dialogs first
        const closeEvent = new CustomEvent('app-back-button');
        const handled = !window.dispatchEvent(closeEvent);
        
        // If no modal handled it, use browser history
        if (!handled) {
          if (canGoBack) {
            window.history.back();
          } else if (location.pathname !== '/') {
            navigate('/');
          } else {
            // On home screen with no history - minimize app
            CapacitorApp.minimizeApp();
          }
        }
      });

      return () => {
        backButtonListener.then(listener => listener.remove());
      };
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    // Handle URL query params from notification taps
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const tab = params.get('tab');
    const filter = params.get('filter');

    if (action === 'checkin') {
      window.dispatchEvent(new CustomEvent("open-checkin"));
    }

    if (tab === 'recommendations') {
      console.log("Navigating to recommendations tab");
    }

    if (filter === 'overdue') {
      console.log("Filtering to overdue tasks");
    }

    // Set up listener for local notification actions (native)
    if (Capacitor.isNativePlatform()) {
      const handleLocalNotificationAction = (event: CustomEvent) => {
        const { type, taskId } = event.detail || {};
        
        if (type === 'check-in') {
          window.dispatchEvent(new CustomEvent("open-checkin"));
        } else if ((type === 'task-reminder' || type === 'smart-task') && taskId) {
          navigate(`/task/${taskId}`);
        } else if (type === 'ai-recommendation') {
          navigate('/?tab=recommendations');
        } else if (type === 'overdue-alert') {
          navigate('/?filter=overdue');
        }
      };

      window.addEventListener('local-notification-action', handleLocalNotificationAction as EventListener);
      
      return () => {
        window.removeEventListener('local-notification-action', handleLocalNotificationAction as EventListener);
      };
    }
  }, [navigate, location.search]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NavigationHandler />
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/task/:taskId" element={<TaskWorkspace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
