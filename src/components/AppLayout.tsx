import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import MobileBottomNav from "./MobileBottomNav";
import CheckInModal from "./CheckInModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const checkInQuestions = [
    "What are you working on right now?",
    "How's your progress going?",
    "What's your energy level right now? (1-10)",
    "Feeling stuck on anything?",
    "What did you accomplish in the last hour?",
  ];

  // Hide bottom nav on auth page
  const showBottomNav = location.pathname !== "/auth";
  
  // Detect platform
  const isIOS = Capacitor.getPlatform() === "ios";
  const isAndroid = Capacitor.getPlatform() === "android";
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    // Configure status bar for iOS and Android
    const configureStatusBar = async () => {
      if (!isNative) return;
      
      try {
        if (isIOS) {
          // iOS status bar configuration
          await StatusBar.setStyle({ style: Style.Dark });
          // iOS doesn't support setBackgroundColor - it's controlled by the app's content
          await StatusBar.setOverlaysWebView({ overlay: true });
        } else if (isAndroid) {
          // Android status bar configuration
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: "#000000" });
          await StatusBar.setOverlaysWebView({ overlay: false });
        }
      } catch (error) {
        console.log("Status bar configuration not available:", error);
      }
    };

    // Handle back button (Android only - iOS uses swipe gestures)
    const setupBackButton = async () => {
      if (!isAndroid) return;
      
      try {
        await App.addListener("backButton", () => {
          // Check if on home/dashboard - exit app
          if (location.pathname === "/" || location.pathname === "/auth") {
            App.exitApp();
          } else {
            // Navigate back using React Router
            navigate(-1);
          }
        });
      } catch (error) {
        console.log("Back button handler not available:", error);
      }
    };

    configureStatusBar();
    setupBackButton();

    return () => {
      if (isNative) {
        App.removeAllListeners().catch(() => {});
      }
    };
  }, [location.pathname, navigate, isNative, isIOS, isAndroid]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(data);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleCheckInSubmit = async (response: string, mood?: string, energyLevel?: number) => {
    if (!user) return;
    
    const randomQuestion = checkInQuestions[Math.floor(Math.random() * checkInQuestions.length)];
    
    const { error } = await supabase.from("check_ins").insert([{
      user_id: user.id,
      question: randomQuestion,
      response,
      mood,
      energy_level: energyLevel,
    }]);

    if (!error && profile) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastCheckIn = profile.last_check_in_date ? new Date(profile.last_check_in_date) : null;
      if (lastCheckIn) lastCheckIn.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (!lastCheckIn || lastCheckIn.getTime() !== today.getTime()) {
        let newStreak = 1;
        
        if (lastCheckIn && lastCheckIn.getTime() === yesterday.getTime()) {
          newStreak = profile.current_streak + 1;
        }
        
        await supabase.from("profiles").update({
          current_streak: newStreak,
          longest_streak: Math.max(profile.longest_streak, newStreak),
          last_check_in_date: new Date().toISOString(),
        }).eq("id", user.id);
        
        fetchProfile();
      }
    }
  };

  // Listen for check-in events from other components
  useEffect(() => {
    const handleOpenCheckIn = () => {
      setShowCheckIn(true);
    };
    
    window.addEventListener("open-checkin", handleOpenCheckIn);
    return () => window.removeEventListener("open-checkin", handleOpenCheckIn);
  }, []);

  return (
    <div 
      className="min-h-screen bg-background flex flex-col"
      style={{ 
        // iOS uses safe-area-inset for notch/Dynamic Island
        paddingTop: isIOS ? "env(safe-area-inset-top, 0px)" : "env(safe-area-inset-top, 0px)",
        paddingBottom: showBottomNav 
          ? "calc(60px + env(safe-area-inset-bottom, 0px))" 
          : "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* Global Header - shown on all pages except auth */}
      {showBottomNav && user && (
        <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-40">
          <div className="px-3 md:px-4 lg:px-6 py-2 max-w-full flex items-center justify-between">
            {/* Left side - Menu toggle (desktop/tablet) */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowNav(!showNav)} 
              className="h-10 w-10 hidden md:flex"
            >
              {showNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            
            {/* Spacer for mobile */}
            <div className="md:hidden" />
            
            {/* Right side - Logout */}
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9 md:h-10 md:w-10">
              <LogOut className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </header>
      )}

      {/* Left Navigation Panel - Desktop/Tablet */}
      {showNav && showBottomNav && user && (
        <div className="hidden md:flex fixed left-0 top-[49px] bottom-0 w-56 bg-card border-r z-30 flex-col p-4 gap-2 animate-in slide-in-from-left duration-200">
          <Button 
            variant="ghost" 
            onClick={() => { navigate("/"); setShowNav(false); }} 
            className="justify-start h-11 text-sm"
          >
            Dashboard
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => { setShowCheckIn(true); setShowNav(false); }} 
            className="justify-start h-11 text-sm"
          >
            Check-in
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => { navigate("/calendar"); setShowNav(false); }} 
            className="justify-start h-11 text-sm"
          >
            Calendar
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => { navigate("/insights"); setShowNav(false); }} 
            className="justify-start h-11 text-sm"
          >
            Insights
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => { navigate("/settings"); setShowNav(false); }} 
            className="justify-start h-11 text-sm"
          >
            Settings
          </Button>
        </div>
      )}

      {children}
      
      {showBottomNav && (
        <MobileBottomNav onCheckIn={() => setShowCheckIn(true)} />
      )}

      <CheckInModal
        open={showCheckIn}
        onClose={() => setShowCheckIn(false)}
        question={checkInQuestions[Math.floor(Math.random() * checkInQuestions.length)]}
        onSubmit={handleCheckInSubmit}
      />
    </div>
  );
}
