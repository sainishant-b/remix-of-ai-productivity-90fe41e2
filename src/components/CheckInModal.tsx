import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Smile, Frown, Meh, Heart, Zap } from "lucide-react";
import { useBackButton } from "@/hooks/useBackButton";

interface CheckInModalProps {
  open: boolean;
  onClose: () => void;
  question: string;
  onSubmit: (response: string, mood?: string, energyLevel?: number) => void;
}

const CheckInModal = ({ open, onClose, question, onSubmit }: CheckInModalProps) => {
  const [response, setResponse] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | undefined>();
  const [energyLevel, setEnergyLevel] = useState<number | undefined>();

  // Handle Android back button to close modal
  useBackButton(open, onClose);

  const moods = [
    { icon: Heart, label: "Great", value: "great" },
    { icon: Smile, label: "Good", value: "good" },
    { icon: Meh, label: "Okay", value: "okay" },
    { icon: Frown, label: "Struggling", value: "struggling" },
  ];

  const quickResponses = [
    "Working on my task",
    "Taking a break",
    "Got distracted",
    "Just finished something!",
  ];

  const handleSubmit = () => {
    if (!response.trim()) {
      toast.error("Please enter a response");
      return;
    }

    onSubmit(response, selectedMood, energyLevel);
    setResponse("");
    setSelectedMood(undefined);
    setEnergyLevel(undefined);
    onClose();
    toast.success("Check-in recorded! Keep it up! 🎉");
  };

  const handleQuickResponse = (text: string) => {
    setResponse(text);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Time for a Check-in! 📝</DialogTitle>
          <DialogDescription className="text-base pt-2">{question}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick response buttons */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick responses</Label>
            <div className="grid grid-cols-2 gap-2">
              {quickResponses.map((text) => (
                <Button
                  key={text}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickResponse(text)}
                  className="text-xs h-auto py-2 whitespace-normal"
                >
                  {text}
                </Button>
              ))}
            </div>
          </div>

          {/* Free text response */}
          <div className="space-y-2">
            <Label htmlFor="response">Your response</Label>
            <Textarea
              id="response"
              placeholder="Share what you're working on or how you're feeling..."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Mood selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">How are you feeling? (optional)</Label>
            <div className="flex gap-2">
              {moods.map((mood) => {
                const Icon = mood.icon;
                return (
                  <button
                    key={mood.value}
                    onClick={() => setSelectedMood(mood.value)}
                    className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                      selectedMood === mood.value
                        ? "border-primary bg-accent"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${selectedMood === mood.value ? "text-primary" : ""}`} />
                    <span className="text-xs">{mood.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Energy level */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Energy level (1-10, optional)
            </Label>
            <div className="flex gap-1">
              {[...Array(10)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setEnergyLevel(i + 1)}
                  className={`flex-1 h-10 rounded border-2 text-sm font-medium transition-all ${
                    energyLevel === i + 1
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Skip
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            Submit Check-in
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckInModal;
