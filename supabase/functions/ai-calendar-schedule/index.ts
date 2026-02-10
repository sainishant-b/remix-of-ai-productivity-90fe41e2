import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { requestType, options } = await req.json();

    if (!["schedule_unscheduled", "reschedule", "batch_plan"].includes(requestType)) {
      throw new Error("Invalid requestType");
    }

    // Fetch user's tasks
    const { data: tasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pending", "in_progress"]);

    if (tasksErr) throw new Error(`Failed to fetch tasks: ${tasksErr.message}`);

    // Fetch profile for work hours
    const { data: profile } = await supabase
      .from("profiles")
      .select("work_hours_start, work_hours_end, timezone")
      .eq("id", user.id)
      .single();

    // Fetch recent work sessions for pattern analysis
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: sessions } = await supabase
      .from("work_sessions")
      .select("*")
      .eq("user_id", user.id)
      .gte("started_at", sevenDaysAgo.toISOString())
      .order("started_at", { ascending: false });

    // Build context
    const scheduledTasks = tasks?.filter((t) => t.scheduled_date) || [];
    const unscheduledTasks = tasks?.filter((t) => !t.scheduled_date) || [];

    const workHoursStart = profile?.work_hours_start || "09:00";
    const workHoursEnd = profile?.work_hours_end || "17:00";
    const timezone = profile?.timezone || "UTC";

    const today = new Date().toISOString().split("T")[0];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    const endDateStr = endDate.toISOString().split("T")[0];

    let promptContext = `Today is ${today}. User timezone: ${timezone}.\nWork hours: ${workHoursStart} to ${workHoursEnd}.\n\n`;

    promptContext += `SCHEDULED TASKS (${scheduledTasks.length}):\n`;
    scheduledTasks.forEach((t) => {
      promptContext += `- "${t.title}" | Priority: ${t.priority} | Date: ${t.scheduled_date} | Time: ${t.scheduled_time || "unset"} | Duration: ${t.estimated_duration || "unset"}min | Status: ${t.status}\n`;
    });

    promptContext += `\nUNSCHEDULED TASKS (${unscheduledTasks.length}):\n`;
    unscheduledTasks.forEach((t) => {
      promptContext += `- "${t.title}" (id: ${t.id}) | Priority: ${t.priority} | Due: ${t.due_date || "none"} | Duration: ${t.estimated_duration || "unset"}min | Status: ${t.status}\n`;
    });

    if (sessions && sessions.length > 0) {
      promptContext += `\nRECENT WORK SESSIONS (last 7 days):\n`;
      sessions.slice(0, 10).forEach((s) => {
        promptContext += `- Task: ${s.task_id} | Duration: ${s.duration_minutes || "ongoing"}min | ${s.started_at}\n`;
      });
    }

    let instruction = "";
    switch (requestType) {
      case "schedule_unscheduled":
        instruction = `Find optimal time slots for all unscheduled tasks. Consider priorities, due dates, and existing scheduled tasks to avoid conflicts. Distribute tasks across ${today} to ${endDateStr}.`;
        break;
      case "reschedule":
        instruction = `Optimize the entire schedule. Look for conflicts, poor time allocation, or tasks that could be better placed. Consider priorities, estimated durations, and work-life balance.`;
        break;
      case "batch_plan":
        instruction = `Create a comprehensive plan for the week (${today} to ${endDateStr}). Schedule all unscheduled tasks and optimize existing scheduled ones. Create a balanced, productive weekly plan.`;
        break;
    }

    const geminiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          {
            role: "system",
            content: `You are a productivity-focused calendar scheduling AI. Analyze the user's tasks your job is to propose optimal scheduling. Use the propose_schedule_changes function to return your proposals. Always provide reasoning for each proposal.`,
          },
          {
            role: "user",
            content: `${promptContext}\n\nINSTRUCTION: ${instruction}${options?.focusArea ? "\nFocus area: " + options.focusArea : ""}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_schedule_changes",
              description: "Propose scheduling changes for the user's tasks",
              parameters: {
                type: "object",
                properties: {
                  proposals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        taskId: { type: "string", description: "ID of the task to schedule/reschedule" },
                        taskTitle: { type: "string", description: "Title of the task" },
                        action: {
                          type: "string",
                          enum: ["schedule", "reschedule", "keep"],
                          description: "What action to take",
                        },
                        proposedDate: { type: "string", description: "YYYY-MM-DD format" },
                        proposedTime: { type: "string", description: "HH:MM format (24h)" },
                        reasoning: { type: "string", description: "Why this time slot is optimal" },
                        confidence: {
                          type: "string",
                          enum: ["high", "medium", "low"],
                          description: "Confidence in this proposal",
                        },
                        currentDate: { type: "string", description: "Current scheduled date if rescheduling" },
                        currentTime: { type: "string", description: "Current scheduled time if rescheduling" },
                      },
                      required: ["taskId", "taskTitle", "action", "proposedDate", "proposedTime", "reasoning", "confidence"],
                    },
                  },
                  overallReasoning: { type: "string", description: "Overall strategy explanation" },
                  conflictsDetected: {
                    type: "array",
                    items: { type: "string" },
                    description: "Any scheduling conflicts found",
                  },
                },
                required: ["proposals", "overallReasoning"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "propose_schedule_changes" } },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    const toolCall = geminiData.choices?.[0]?.message?.tool_calls?.[0];

    let result;
    if (toolCall?.function?.arguments) {
      result = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      result = {
        proposals: [],
        overallReasoning: geminiData.choices?.[0]?.message?.content || "Unable to generate proposals",
        conflictsDetected: [],
      };
    }

    const proposalId = crypto.randomUUID();

    return new Response(
      JSON.stringify({
        success: true,
        id: proposalId,
        proposals: result.proposals,
        overallReasoning: result.overallReasoning,
        conflictsDetected: result.conflictsDetected || [],
        proposalType: requestType,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-calendar-schedule error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
