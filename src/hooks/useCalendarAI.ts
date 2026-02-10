import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ScheduleProposal {
  taskId: string;
  taskTitle: string;
  action: "schedule" | "reschedule" | "keep";
  proposedDate: string;
  proposedTime: string;
  reasoning: string;
  confidence: "high" | "medium" | "low";
  currentDate?: string;
  currentTime?: string;
  accepted: boolean;
}

interface AIScheduleResponse {
  id: string;
  proposals: ScheduleProposal[];
  overallReasoning: string;
  conflictsDetected: string[];
  proposalType: string;
}

export type RequestType = "schedule_unscheduled" | "reschedule" | "batch_plan";

export function useCalendarAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [proposals, setProposals] = useState<ScheduleProposal[]>([]);
  const [overallReasoning, setOverallReasoning] = useState("");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const { toast } = useToast();

  const requestSchedule = useCallback(
    async (type: RequestType, options?: { focusArea?: string }) => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ai-calendar-schedule", {
          body: { requestType: type, options },
        });

        if (error) throw error;

        const response = data as AIScheduleResponse;
        const enriched = response.proposals.map((p) => ({
          ...p,
          accepted: true,
        }));

        setProposals(enriched);
        setOverallReasoning(response.overallReasoning);
        setConflicts(response.conflictsDetected || []);
        setProposalId(response.id);

        toast({
          title: "Schedule Proposals Ready",
          description: `${enriched.length} suggestions generated. Review and approve.`,
        });

        return enriched;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to generate schedule";
        toast({
          title: "Scheduling Failed",
          description: message,
          variant: "destructive",
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const toggleProposal = useCallback((taskId: string) => {
    setProposals((prev) =>
      prev.map((p) =>
        p.taskId === taskId ? { ...p, accepted: !p.accepted } : p
      )
    );
  }, []);

  const applyApprovedProposals = useCallback(
    async (
      onTaskUpdate: (taskId: string, updates: Record<string, unknown>) => Promise<void>
    ) => {
      const approved = proposals.filter((p) => p.accepted && p.action !== "keep");
      if (approved.length === 0) {
        toast({ title: "No proposals to apply" });
        return;
      }

      let successCount = 0;
      for (const proposal of approved) {
        try {
          await onTaskUpdate(proposal.taskId, {
            scheduled_date: proposal.proposedDate,
            scheduled_time: proposal.proposedTime,
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to update task ${proposal.taskId}:`, err);
        }
      }

      // Proposals applied locally — no persistent storage needed

      toast({
        title: "Schedule Updated",
        description: `${successCount} of ${approved.length} tasks rescheduled.`,
      });

      setProposals([]);
      setOverallReasoning("");
      setConflicts([]);
      setProposalId(null);
    },
    [proposals, proposalId, toast]
  );

  const dismissProposals = useCallback(async () => {
    setProposals([]);
    setOverallReasoning("");
    setConflicts([]);
    setProposalId(null);
  }, []);

  return {
    requestSchedule,
    toggleProposal,
    applyApprovedProposals,
    dismissProposals,
    proposals,
    overallReasoning,
    conflicts,
    isLoading,
    hasProposals: proposals.length > 0,
  };
}
