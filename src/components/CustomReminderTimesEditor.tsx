import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Clock } from "lucide-react";

interface CustomReminderTimesEditorProps {
  times: number[]; // Array of minutes before due
  onChange: (times: number[]) => void;
  maxReminders?: number;
}

const TIME_OPTIONS = [
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 360, label: "6 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
  { value: 4320, label: "3 days" },
  { value: 10080, label: "1 week" },
];

function formatMinutes(minutes: number): string {
  if (minutes >= 10080) {
    const weeks = Math.floor(minutes / 10080);
    return `${weeks} week${weeks > 1 ? 's' : ''}`;
  }
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440);
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${minutes} min`;
}

export function CustomReminderTimesEditor({
  times,
  onChange,
  maxReminders = 5,
}: CustomReminderTimesEditorProps) {
  const [selectedTime, setSelectedTime] = useState<string>("60");

  const sortedTimes = [...times].sort((a, b) => a - b);
  const availableOptions = TIME_OPTIONS.filter(opt => !times.includes(opt.value));

  const handleAdd = () => {
    const timeValue = parseInt(selectedTime);
    if (!times.includes(timeValue) && times.length < maxReminders) {
      onChange([...times, timeValue]);
    }
  };

  const handleRemove = (timeToRemove: number) => {
    onChange(times.filter(t => t !== timeToRemove));
  };

  return (
    <div className="space-y-3">
      {/* Current reminder times */}
      <div className="flex flex-wrap gap-2">
        {sortedTimes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom reminders set</p>
        ) : (
          sortedTimes.map((time) => (
            <Badge 
              key={time} 
              variant="secondary"
              className="flex items-center gap-1.5 py-1 px-2"
            >
              <Clock className="h-3 w-3" />
              {formatMinutes(time)} before
              <button
                onClick={() => handleRemove(time)}
                className="ml-1 hover:text-destructive transition-colors"
                aria-label={`Remove ${formatMinutes(time)} reminder`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>

      {/* Add new reminder */}
      {times.length < maxReminders && availableOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Select
            value={selectedTime}
            onValueChange={setSelectedTime}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {availableOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={times.includes(parseInt(selectedTime))}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      )}

      {times.length >= maxReminders && (
        <p className="text-xs text-muted-foreground">
          Maximum {maxReminders} custom reminders allowed
        </p>
      )}
    </div>
  );
}
