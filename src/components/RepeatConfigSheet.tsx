import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface RepeatConfig {
  repeat_enabled: boolean;
  repeat_frequency: number;
  repeat_unit: "day" | "week" | "month" | "year";
  repeat_days_of_week: number[];
  repeat_times: string[];
  repeat_end_type: "never" | "on_date" | "after_count";
  repeat_end_date: string | null;
  repeat_end_count: number | null;
}

interface RepeatConfigSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: RepeatConfig) => void;
  initialConfig?: Partial<RepeatConfig>;
}

const DAYS = [
  { label: "S", value: 0 },
  { label: "M", value: 1 },
  { label: "T", value: 2 },
  { label: "W", value: 3 },
  { label: "T", value: 4 },
  { label: "F", value: 5 },
  { label: "S", value: 6 },
];

export function RepeatConfigSheet({ open, onClose, onSave, initialConfig }: RepeatConfigSheetProps) {
  const [frequency, setFrequency] = useState(initialConfig?.repeat_frequency || 1);
  const [unit, setUnit] = useState<"day" | "week" | "month" | "year">(initialConfig?.repeat_unit || "week");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initialConfig?.repeat_days_of_week || []);
  const [times, setTimes] = useState<string[]>(initialConfig?.repeat_times || ["09:00"]);
  const [endType, setEndType] = useState<"never" | "on_date" | "after_count">(initialConfig?.repeat_end_type || "never");
  const [endDate, setEndDate] = useState<Date | undefined>(
    initialConfig?.repeat_end_date ? new Date(initialConfig.repeat_end_date) : undefined
  );
  const [endCount, setEndCount] = useState(initialConfig?.repeat_end_count || 10);

  useEffect(() => {
    if (open && initialConfig) {
      setFrequency(initialConfig.repeat_frequency || 1);
      setUnit(initialConfig.repeat_unit || "week");
      setDaysOfWeek(initialConfig.repeat_days_of_week || []);
      setTimes(initialConfig.repeat_times || ["09:00"]);
      setEndType(initialConfig.repeat_end_type || "never");
      setEndDate(initialConfig.repeat_end_date ? new Date(initialConfig.repeat_end_date) : undefined);
      setEndCount(initialConfig.repeat_end_count || 10);
    }
  }, [open, initialConfig]);

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const formatTimeForDisplay = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const updateTime = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
  };

  const removeTime = (index: number) => {
    if (times.length > 1) {
      setTimes(times.filter((_, i) => i !== index));
    }
  };

  const addTime = () => {
    setTimes([...times, "09:00"]);
  };

  const handleSave = () => {
    onSave({
      repeat_enabled: true,
      repeat_frequency: frequency,
      repeat_unit: unit,
      repeat_days_of_week: unit === "week" ? daysOfWeek : [],
      repeat_times: times,
      repeat_end_type: endType,
      repeat_end_date: endType === "on_date" && endDate ? endDate.toISOString() : null,
      repeat_end_count: endType === "after_count" ? endCount : null,
    });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <SheetTitle className="flex-1 text-center">Repeats</SheetTitle>
          <Button variant="ghost" className="text-primary font-semibold" onClick={handleSave}>
            Done
          </Button>
        </SheetHeader>

        <div className="space-y-6 pt-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* Frequency Selector */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Every</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={99}
                value={frequency}
                onChange={(e) => setFrequency(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                className="w-20 text-center"
              />
              <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">day{frequency > 1 ? "s" : ""}</SelectItem>
                  <SelectItem value="week">week{frequency > 1 ? "s" : ""}</SelectItem>
                  <SelectItem value="month">month{frequency > 1 ? "s" : ""}</SelectItem>
                  <SelectItem value="year">year{frequency > 1 ? "s" : ""}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Day of Week Selector (for weekly) */}
          {unit === "week" && (
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">On these days</Label>
              <div className="flex justify-between gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={cn(
                      "w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all",
                      daysOfWeek.includes(day.value)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time Selector */}
          <div className="space-y-3">
            <Label className="text-sm text-muted-foreground">At</Label>
            <div className="space-y-2">
              {times.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => updateTime(index, e.target.value)}
                      className="pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      {formatTimeForDisplay(time)}
                    </div>
                  </div>
                  {times.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeTime(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTime} className="w-full">
                + Add time
              </Button>
            </div>
          </div>

          {/* End Options */}
          <div className="space-y-3">
            <Label className="text-sm text-muted-foreground">Ends</Label>
            <RadioGroup value={endType} onValueChange={(v) => setEndType(v as typeof endType)}>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="never" id="never" />
                <Label htmlFor="never" className="flex-1 cursor-pointer">Never</Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="on_date" id="on_date" />
                <Label htmlFor="on_date" className="cursor-pointer">On</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "ml-auto",
                        !endDate && "text-muted-foreground"
                      )}
                      disabled={endType !== "on_date"}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="after_count" id="after_count" />
                <Label htmlFor="after_count" className="cursor-pointer">After</Label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={endCount}
                  onChange={(e) => setEndCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 ml-auto"
                  disabled={endType !== "after_count"}
                />
                <span className="text-sm text-muted-foreground">occurrences</span>
              </div>
            </RadioGroup>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
