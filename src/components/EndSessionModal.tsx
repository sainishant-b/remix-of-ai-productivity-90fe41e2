import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Clock, Save, X } from "lucide-react";
import { useBackButton } from "@/hooks/useBackButton";

interface EndSessionModalProps {
  open: boolean;
  onClose: () => void;
  durationSeconds: number;
  onSave: (notes: string, nextSteps: string) => void;
}

const EndSessionModal = ({ open, onClose, durationSeconds, onSave }: EndSessionModalProps) => {
  const [notes, setNotes] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  // Handle Android back button
  useBackButton(open, onClose);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const handleSave = () => {
    onSave(notes, nextSteps);
    setNotes("");
    setNextSteps("");
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            End Work Session
          </DialogTitle>
          <DialogDescription>
            Review your session and add notes before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Session Summary */}
          <div className="bg-accent/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">Session Duration</p>
            <p className="text-3xl font-bold font-heading mt-1">
              {formatDuration(durationSeconds)}
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">What did you accomplish?</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what you worked on..."
              rows={3}
            />
          </div>

          {/* Next Steps */}
          <div className="space-y-2">
            <Label htmlFor="nextSteps">Next steps for next session? (optional)</Label>
            <Textarea
              id="nextSteps"
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              placeholder="What should you pick up next time..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save & End Session
          </Button>
          <Button onClick={handleClose} variant="outline">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EndSessionModal;
