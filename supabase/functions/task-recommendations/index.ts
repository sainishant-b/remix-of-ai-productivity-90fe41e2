import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const authHeader =
      req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user from auth (pass JWT explicitly to avoid relying on client session state)
    const jwt = authHeader.replace(/Bearer\s+/i, '').trim();
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }


    console.log('Fetching tasks and data for user:', user.id);

    // Fetch user's incomplete tasks only (exclude completed)
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    // Fetch user's profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw profileError;
    }

    // Fetch recent check-ins for energy/mood patterns
    const { data: checkIns, error: checkInsError } = await supabaseClient
      .from('check_ins')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (checkInsError) {
      console.error('Error fetching check-ins:', checkInsError);
    }

    console.log('Data fetched:', {
      tasksCount: tasks?.length,
      hasProfile: !!profile,
      checkInsCount: checkIns?.length,
    });

    // Build context for AI
    const context = {
      tasks: tasks?.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        category: t.category,
        due_date: t.due_date,
        estimated_duration: t.estimated_duration,
        progress: t.progress,
      })),
      workHours: {
        start: profile?.work_hours_start,
        end: profile?.work_hours_end,
        timezone: profile?.timezone,
      },
      recentCheckIns: checkIns?.map(c => ({
        mood: c.mood,
        energy_level: c.energy_level,
        created_at: c.created_at,
      })),
      streak: profile?.current_streak,
    };

    const now = new Date();
    const systemPrompt = `You are an AI productivity assistant specializing in task scheduling optimization.
  
Your goal is to recommend the DAILY TOP 5 tasks with optimal time slots based on:
- Task priority, due dates, and estimated duration
- User's energy patterns (identify peak productivity times from check-in history)
- Historical mood and completion patterns
- Current date/time context

SMART MATCHING RULES:
- Match high-priority/complex tasks with peak energy times
- Schedule quick wins during low energy periods
- Respect work hours preferences (${profile?.work_hours_start} to ${profile?.work_hours_end})
- Balance workload across the day

CRITICAL: In ALL messages and warnings, NEVER include task IDs or UUIDs. Always refer to tasks ONLY by their title. For example, say "Task 'Complete report' is overdue" instead of including any ID.

Always provide:
1. Top 5 task recommendations for TODAY with specific time slots
2. Brief, actionable reasoning for each recommendation (1-2 sentences max)
3. Warnings about: overdue tasks, schedule conflicts, workload concerns (use task titles only, no IDs)
4. Overall insights about the user's schedule and patterns (2-3 key points)`;

    const userPrompt = `Analyze and recommend scheduling for TODAY (${now.toLocaleDateString()}):

USER DATA:
${JSON.stringify(context, null, 2)}

Current time: ${now.toLocaleTimeString()}

Focus on the top 5 most important tasks for today. Consider energy patterns from check-ins, task urgency, and optimal timing.`;

    console.log('Calling Lovable AI...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'suggest_task_schedule',
              description: 'Provide daily top 5 task recommendations with smart time matching',
              parameters: {
                type: 'object',
                properties: {
                  recommendedTasks: {
                    type: 'array',
                    description: 'Top 5 tasks recommended for today with optimal time slots (max 5 items)',
                    maxItems: 5,
                    items: {
                      type: 'object',
                      properties: {
                        taskId: { type: 'string', description: 'UUID of the task' },
                        title: { type: 'string', description: 'Task title' },
                        suggestedTime: { type: 'string', description: 'Time slot (e.g., "9:00 AM - 11:00 AM")' },
                        suggestedDate: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                        reasoning: { type: 'string', description: 'Brief explanation (1-2 sentences)' },
                        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                        progress: { type: 'number', description: 'Task progress percentage (0-100)' },
                        status: { type: 'string', description: 'Task status (not_started, in_progress, completed)' }
                      },
                      required: ['taskId', 'title', 'suggestedTime', 'suggestedDate', 'reasoning', 'confidence', 'priority']
                    }
                  },
                  insights: {
                    type: 'array',
                    description: 'Key insights about schedule and patterns (2-3 items)',
                    items: { type: 'string' }
                  },
                  warnings: {
                    type: 'array',
                    description: 'Important warnings about schedule issues. IMPORTANT: Never include task IDs or UUIDs in messages - use task titles only.',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['overdue', 'conflict', 'overload', 'other'] },
                        message: { type: 'string', description: 'Warning message using task titles only, never include IDs' }
                      },
                      required: ['type', 'message']
                    }
                  }
                },
                required: ['recommendedTasks', 'insights', 'warnings']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'suggest_task_schedule' } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status} ${errorText}`);
    }

    const aiResponseData = await aiResponse.json();
    console.log('AI response received:', JSON.stringify(aiResponseData));

    const toolCall = aiResponseData.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'suggest_task_schedule') {
      throw new Error('AI did not provide recommendations');
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    // Merge task progress/status from fetched tasks into recommendations
    const taskMap = new Map(tasks?.map(t => [t.id, t]) || []);
    if (result.recommendedTasks) {
      result.recommendedTasks = result.recommendedTasks.map((rec: any) => {
        const task = taskMap.get(rec.taskId);
        return {
          ...rec,
          progress: task?.progress ?? 0,
          status: task?.status ?? 'not_started',
        };
      });
    }
    
    console.log('AI Recommendations generated:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in task-recommendations function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
