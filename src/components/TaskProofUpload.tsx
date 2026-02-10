import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Upload, Loader2, Star, X } from "lucide-react";

interface TaskProof {
  id: string;
  image_url: string;
  ai_rating: number | null;
  ai_feedback: string | null;
  created_at: string;
}

interface TaskProofUploadProps {
  taskId: string;
  taskTitle: string;
  taskDescription?: string | null;
  proofs: TaskProof[];
  onProofAdded: () => void;
}

const TaskProofUpload = ({ taskId, taskTitle, taskDescription, proofs, onProofAdded }: TaskProofUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAndVerify = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload image to storage
      const fileExt = selectedFile.name.split(".").pop();
      const filePath = `${user.id}/${taskId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("proof-images")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("proof-images")
        .getPublicUrl(filePath);

      // Call the validation edge function
      const { data, error } = await supabase.functions.invoke("validate-task-proof", {
        body: {
          taskId,
          taskTitle,
          taskDescription: taskDescription || "",
          imageUrl: urlData.publicUrl,
          userId: user.id,
        },
      });

      if (error) throw error;

      toast.success(`Proof verified! Rating: ${data.ai_rating}/10`);
      clearSelection();
      onProofAdded();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="space-y-3">
        {!previewUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
          >
            <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Tap to upload proof photo
            </p>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden">
            <img
              src={previewUrl}
              alt="Proof preview"
              className="w-full h-48 object-cover rounded-xl"
            />
            <Button
              onClick={clearSelection}
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-background/80 rounded-full h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile && (
          <Button
            onClick={uploadAndVerify}
            disabled={isUploading}
            className="w-full rounded-xl"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying with AI...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload & Verify
              </>
            )}
          </Button>
        )}
      </div>

      {/* Previous proofs */}
      {proofs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Previous proofs</p>
          {proofs.map((proof) => (
            <div
              key={proof.id}
              className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
            >
              <img
                src={proof.image_url}
                alt="Proof"
                className="w-16 h-16 rounded-lg object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                {proof.ai_rating !== null && (
                  <Badge variant="secondary" className="rounded-lg mb-1 flex items-center gap-1 w-fit">
                    <Star className="h-3 w-3" />
                    {proof.ai_rating}/10
                  </Badge>
                )}
                {proof.ai_feedback && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {proof.ai_feedback}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskProofUpload;
