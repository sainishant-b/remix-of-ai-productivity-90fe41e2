import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Moon, Sun, User, Bell, BellOff, RefreshCw, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { useNativePushNotifications } from "@/hooks/useNativePushNotifications";

const Settings = () => {
  const navigate = useNavigate();
  const [workHoursStart, setWorkHoursStart] = useState("09:00");
  const [workHoursEnd, setWorkHoursEnd] = useState("17:00");
  const [checkInFrequency, setCheckInFrequency] = useState(3);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const isEmbeddedPreview = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const {
    permission,
    isSupported,
    isPushSupported,
    isPushSubscribed,
    requestPermission,
    sendNotification,
    subscribeToPush,
    unsubscribeFromPush,
  } = useNotifications();

  const {
    isNative,
    isRegistered: isNativeRegistered,
    registerForPush: registerNativePush,
    unregisterFromPush: unregisterNativePush,
  } = useNativePushNotifications();

  useEffect(() => {
    loadSettings();
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" || "dark";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
    
    const savedNotifPref = localStorage.getItem("notificationsEnabled");
    if (savedNotifPref !== null) {
      setNotificationsEnabled(savedNotifPref === "true");
    }
  }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("work_hours_start, work_hours_end, check_in_frequency")
      .eq("id", user.id)
      .single();

    if (profile) {
      setWorkHoursStart(profile.work_hours_start || "09:00");
      setWorkHoursEnd(profile.work_hours_end || "17:00");
      setCheckInFrequency(profile.check_in_frequency || 3);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        work_hours_start: workHoursStart,
        work_hours_end: workHoursEnd,
        check_in_frequency: checkInFrequency,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Settings saved successfully");
    }
    setLoading(false);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const toggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    localStorage.setItem("notificationsEnabled", enabled.toString());
    if (enabled) {
      toast.success("Notifications enabled");
    } else {
      toast.info("Notifications disabled");
    }
  };

  const handleTestNotification = () => {
    if (!notificationsEnabled) {
      toast.error("Notifications are disabled. Enable them first.");
      return;
    }
    sendNotification({
      title: "Test Notification 🔔",
      body: "Notifications are working! You'll receive check-in reminders and task alerts.",
      tag: "test-notification",
    });
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (isNative) {
      if (enabled) {
        await registerNativePush();
      } else {
        await unregisterNativePush();
      }
    } else {
      if (enabled) {
        await subscribeToPush();
      } else {
        await unsubscribeFromPush();
      }
    }
  };

  const handleDebugPush = async () => {
    try {
      const swReg = await navigator.serviceWorker.ready;
      console.log("Service Worker ready:", swReg);
      toast.info("Service Worker: Ready ✓");
      
      const existingSub = await swReg.pushManager.getSubscription();
      console.log("Existing subscription:", existingSub);
      toast.info(existingSub ? "Existing subscription found" : "No existing subscription");
      
      const permState = await swReg.pushManager.permissionState({ userVisibleOnly: true });
      console.log("Push permission state:", permState);
      toast.info(`Push permission: ${permState}`);
      
    } catch (error) {
      console.error("Debug error:", error);
      toast.error(`Debug failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  };

  const handleResetPush = async () => {
    try {
      toast.info("Resetting push state...");
      
      // 1. Unsubscribe any existing push subscription
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        try {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
            console.log("Unsubscribed from push");
          }
        } catch (e) {
          console.warn("Error unsubscribing:", e);
        }
      }

      // 2. Remove subscriptions from database for this user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id);
        console.log("Removed push subscriptions from database");
      }

      // 3. Unregister all app service workers
      for (const reg of regs) {
        const swUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
        if (swUrl.includes("/sw.js")) {
          await reg.unregister();
          console.log("Unregistered service worker:", swUrl);
        }
      }

      // 4. Re-register fresh service worker
      await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      console.log("Re-registered service worker");

      toast.success("Push state reset! Toggle Push Notifications on to re-subscribe.");
    } catch (error) {
      console.error("Reset push error:", error);
      toast.error(`Reset failed: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const frequencyOptions = [
    { value: 1, label: "Every hour" },
    { value: 2, label: "Every 2 hours" },
    { value: 3, label: "Every 3 hours" },
    { value: 4, label: "Every 4 hours" },
    { value: 6, label: "Every 6 hours" },
    { value: 8, label: "Once per day" },
  ];

  return (
    <div className="flex-1 bg-background p-4 md:p-8 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-4xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">Customize your experience</p>
          </div>
          <Button onClick={() => navigate("/")} variant="outline">
            Back to Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Work Hours
            </CardTitle>
            <CardDescription>
              Set your typical work hours for better productivity tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={workHoursStart}
                  onChange={(e) => setWorkHoursStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={workHoursEnd}
                  onChange={(e) => setWorkHoursEnd(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Check-in Frequency
            </CardTitle>
            <CardDescription>
              How often would you like to be prompted for check-ins during work hours?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Check-in Interval</Label>
              <Select
                value={checkInFrequency.toString()}
                onValueChange={(value) => setCheckInFrequency(parseInt(value))}
              >
                <SelectTrigger id="frequency" className="w-full md:w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                You'll be prompted for check-ins {frequencyOptions.find(o => o.value === checkInFrequency)?.label.toLowerCase() || "every few hours"} during your work hours.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              Appearance
            </CardTitle>
            <CardDescription>
              Choose between light and dark theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={toggleTheme} variant="outline" className="w-full md:w-auto">
              {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            </Button>
          </CardContent>
        </Card>

        {(isSupported || isNative) && (
          <Card>
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                {isNative ? (
                  <Smartphone className="h-5 w-5 text-success" />
                ) : permission === "granted" ? (
                  <Bell className="h-5 w-5 text-success" />
                ) : permission === "denied" ? (
                  <BellOff className="h-5 w-5 text-destructive" />
                ) : (
                  <Bell className="h-5 w-5" />
                )}
                Notifications
              </CardTitle>
              <CardDescription>
                Get notified about check-ins and task reminders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isNative ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="native-push-toggle" className="text-base flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Native Push Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications directly on your device
                      </p>
                    </div>
                    <Switch
                      id="native-push-toggle"
                      checked={isNativeRegistered}
                      onCheckedChange={handlePushToggle}
                    />
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1 border-t pt-4">
                    <p>You'll receive notifications for:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>Check-in reminders during work hours</li>
                      <li>Tasks due today</li>
                      <li>Overdue task alerts</li>
                      <li>Upcoming task reminders</li>
                    </ul>
                  </div>
                </div>
              ) : permission === "granted" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="notifications-toggle" className="text-base">Enable Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive push notifications for check-ins and tasks
                      </p>
                    </div>
                    <Switch
                      id="notifications-toggle"
                      checked={notificationsEnabled}
                      onCheckedChange={toggleNotifications}
                    />
                  </div>
                  
                  {notificationsEnabled && (
                    <>
                      <div className="flex items-center justify-between border-t pt-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="push-toggle" className="text-base">Push Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive notifications even when the app is closed
                          </p>
                        </div>
                        <Switch
                          id="push-toggle"
                          checked={isPushSubscribed}
                          disabled={!isPushSupported || isEmbeddedPreview}
                          onCheckedChange={handlePushToggle}
                        />
                      </div>

                      {isEmbeddedPreview ? (
                        <div className="text-sm text-muted-foreground">
                          Push subscriptions can’t be enabled inside the embedded preview. Open this page in a new tab, then toggle Push Notifications.
                          <div className="mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}
                            >
                              Open in new tab
                            </Button>
                          </div>
                        </div>
                      ) : !isPushSupported ? (
                        <p className="text-sm text-muted-foreground">
                          Push subscriptions aren't supported in this environment.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-2">
                          💡 <strong>Tip:</strong> If push notifications don't work, enable "Use Google services for push messaging" in your browser settings (Settings → Privacy and security).
                        </p>
                      )}

                      <div className="text-sm text-muted-foreground space-y-1 border-t pt-4">
                        <p>You'll receive notifications for:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                          <li>Check-in reminders during work hours</li>
                          <li>Tasks due today</li>
                          <li>Overdue task alerts</li>
                          <li>Upcoming task reminders</li>
                        </ul>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button onClick={handleTestNotification} variant="outline" className="w-full md:w-auto">
                          Send Test Notification
                        </Button>
                        <Button onClick={handleResetPush} variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                          Reset Push State
                        </Button>
                        <Button onClick={handleDebugPush} variant="ghost" size="sm" className="text-muted-foreground">
                          Debug Push Status
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : permission === "denied" ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">Notifications are blocked</p>
                  <p className="text-sm text-muted-foreground">
                    To enable notifications, click the lock icon in your browser's address bar and allow notifications for this site.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Enable notifications to stay on track with check-ins and never miss a deadline.
                  </p>
                  <Button onClick={requestPermission} className="w-full md:w-auto">
                    Enable Notifications
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading} size="lg">
            {loading ? "Saving..." : "Save All Settings"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <User className="h-5 w-5" />
              Account
            </CardTitle>
            <CardDescription>
              Manage your account settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSignOut} variant="destructive" className="w-full md:w-auto">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;