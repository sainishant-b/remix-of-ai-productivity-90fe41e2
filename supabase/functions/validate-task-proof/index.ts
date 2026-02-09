import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { task_id, image_url, task_title, task_description } = await req.json();

    if (!task_id || !image_url) {
      return new Response(
        JSON.stringify({ error: "task_id and image_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Validating proof for task:", task_id);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a task completion validator. You analyze photos submitted as proof of task completion. 
            
Rate the completion proof on a scale of 0-10 based on:
- Relevance: Does the photo relate to the task?
- Completeness: Does it show the task is actually done?
- Quality: Is the proof clear and convincing?

Respond using the validate_proof function.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Task: "${task_title || "Untitled"}"${task_description ? `\nDescription: "${task_description}"` : ""}\n\nPlease validate this proof of completion photo and rate it 0-10.`,
              },
              {
                type: "image_url",
                image_url: { url: image_url },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "validate_proof",
              description: "Validate task completion proof and provide rating",
              parameters: {
                type: "object",
                properties: {
                  rating: {
                    type: "integer",
                    description: "Rating from 0-10",
                    minimum: 0,
                    maximum: 10,
                  },
                  feedback: {
                    type: "string",
                    description: "Brief feedback explaining the rating (1-2 sentences)",
                  },
                },
                required: ["rating", "feedback"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "validate_proof" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw new Error("AI validation failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let rating = 5;
    let feedback = "Could not validate proof.";

    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        rating = Math.min(10, Math.max(0, args.rating));
        feedback = args.feedback || feedback;
      } catch (e) {
        console.error("Failed to parse AI response:", e);
      }
    }

    // Save proof to database
    const { data: proof, error: insertError } = await supabase
      .from("task_proofs")
      .insert({
        task_id,
        user_id: user.id,
        image_url,
        ai_rating: rating,
        ai_feedback: feedback,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save proof");
    }

    // Update profile totals using service role
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch current profile totals and update
    
    // Fetch current profile totals and update
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("total_ai_rating, total_proofs_submitted")
      .eq("id", user.id)
      .single();

    if (profile) {
      await serviceClient
        .from("profiles")
        .update({
          total_ai_rating: (profile.total_ai_rating || 0) + rating,
          total_proofs_submitted: (profile.total_proofs_submitted || 0) + 1,
        })
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({ rating, feedback, proof_id: proof.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("validate-task-proof error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
