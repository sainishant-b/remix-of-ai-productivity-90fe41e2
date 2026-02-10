import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface VerificationResult {
  id: string;
  rating: number;
  feedback: string;
  relevance: string;
  completeness: string;
  imagePath: string;
}

interface TaskVerification {
  id: string;
  task_id: string;
  task_title: string;
  image_path: string;
  ai_rating: number;
  ai_feedback: string;
  created_at: string;
}

export function useTaskVerification() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const verifyTaskProof = async (
    imageFile: File,
    task: { id: string; title: string; description?: string }
  ): Promise<VerificationResult | null> => {
    setIsVerifying(true);
    setProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      setProgress(20);

      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("taskId", task.id);
      formData.append("taskTitle", task.title);
      formData.append("taskDescription", task.description || "");

      setProgress(40);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ||
        (supabase as unknown as { supabaseUrl: string }).supabaseUrl;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/verify-task-proof`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      setProgress(80);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Verification failed");
      }

      const data = await response.json();
      setProgress(100);

      if (data.success) {
        return data.verification;
      }

      throw new Error("Unexpected response format");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Verification failed";
      toast({
        title: "Verification Failed",
        description: message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsVerifying(false);
      setProgress(0);
    }
  };

  const getTaskVerifications = async (taskId: string): Promise<TaskVerification[]> => {
    const { data, error } = await supabase
      .from("task_proofs")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch verifications:", error);
      return [];
    }
    return (data || []).map((p) => ({
      id: p.id,
      task_id: p.task_id,
      task_title: "",
      image_path: p.image_url,
      ai_rating: p.ai_rating || 0,
      ai_feedback: p.ai_feedback || "",
      created_at: p.created_at,
    }));
  };

  const getUserVerificationScore = async (): Promise<{
    avg: number;
    count: number;
  }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { avg: 0, count: 0 };

    const { data } = await supabase
      .from("profiles")
      .select("total_ai_rating, total_proofs_submitted")
      .eq("id", user.id)
      .single();

    const count = data?.total_proofs_submitted || 0;
    const avg = count > 0 ? (data?.total_ai_rating || 0) / count : 0;
    return { avg, count };
  };

  const getProofImageUrl = (imagePath: string): string => {
    const { data } = supabase.storage
      .from("proof-images")
      .getPublicUrl(imagePath);
    return data.publicUrl;
  };

  return {
    verifyTaskProof,
    getTaskVerifications,
    getUserVerificationScore,
    getProofImageUrl,
    isVerifying,
    progress,
  };
}
