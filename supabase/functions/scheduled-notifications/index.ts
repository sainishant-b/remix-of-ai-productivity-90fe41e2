import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get current time
    const now = new Date();
    const currentHour = now.getHours();
    
    console.log(`Running scheduled notifications check at ${now.toISOString()}, hour: ${currentHour}`);
    
    // Get all users with their profiles and tasks
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, work_hours_start, work_hours_end, check_in_frequency');
    
    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No profiles found', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let notificationsSent = 0;
    let usersProcessed = 0;

    for (const profile of profiles) {
      try {
        // Check if current hour is within user's work hours
        const workStart = parseInt(profile.work_hours_start?.split(':')[0] || '9');
        const workEnd = parseInt(profile.work_hours_end?.split(':')[0] || '17');
        
        const isWorkHours = currentHour >= workStart && currentHour < workEnd;
        
        if (!isWorkHours) {
          console.log(`Skipping user ${profile.id} - outside work hours (${workStart}-${workEnd})`);
          continue;
        }

        usersProcessed++;

        // Check for overdue tasks
        const today = now.toISOString().split('T')[0];
        const { data: overdueTasks, error: overdueError } = await supabase
          .from('tasks')
          .select('id, title, due_date, priority')
          .eq('user_id', profile.id)
          .eq('status', 'pending')
          .lt('due_date', today)
          .order('priority', { ascending: false })
          .limit(3);

        if (overdueError) {
          console.error(`Error fetching overdue tasks for user ${profile.id}:`, overdueError);
          continue;
        }

        if (overdueTasks && overdueTasks.length > 0) {
          // Send overdue notification via the send-push-notification function
          const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: profile.id,
              title: `⚠️ ${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? 's' : ''}`,
              body: overdueTasks.length === 1 
                ? `"${overdueTasks[0].title}" is past due!`
                : `"${overdueTasks[0].title}" and ${overdueTasks.length - 1} more need attention`,
              data: { 
                type: 'overdue-alert',
                taskIds: overdueTasks.map(t => t.id)
              },
              tag: 'overdue-tasks'
            }
          });

          if (pushError) {
            console.error(`Error sending overdue notification to user ${profile.id}:`, pushError);
          } else {
            notificationsSent++;
            console.log(`Sent overdue notification to user ${profile.id}`);
          }
        }

        // Check for tasks due today
        const { data: todayTasks, error: todayError } = await supabase
          .from('tasks')
          .select('id, title, due_date, priority')
          .eq('user_id', profile.id)
          .eq('status', 'pending')
          .eq('due_date', today)
          .order('priority', { ascending: false })
          .limit(5);

        if (todayError) {
          console.error(`Error fetching today's tasks for user ${profile.id}:`, todayError);
          continue;
        }

        // Send daily summary at start of work hours
        if (currentHour === workStart && todayTasks && todayTasks.length > 0) {
          const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: profile.id,
              title: `📋 ${todayTasks.length} Task${todayTasks.length > 1 ? 's' : ''} Today`,
              body: todayTasks.length === 1 
                ? `Don't forget: "${todayTasks[0].title}"`
                : `Starting with: "${todayTasks[0].title}"`,
              data: { 
                type: 'daily-summary',
                taskIds: todayTasks.map(t => t.id)
              },
              tag: 'daily-summary'
            }
          });

          if (pushError) {
            console.error(`Error sending daily summary to user ${profile.id}:`, pushError);
          } else {
            notificationsSent++;
            console.log(`Sent daily summary to user ${profile.id}`);
          }
        }

        // Check-in reminder (based on frequency)
        const frequency = profile.check_in_frequency || 4;
        const shouldCheckIn = currentHour % frequency === 0 && currentHour >= workStart && currentHour < workEnd;
        
        if (shouldCheckIn && currentHour !== workStart) { // Don't double-notify at start
          const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: profile.id,
              title: '🎯 Quick Check-in',
              body: 'How\'s your productivity? Take a moment to reflect.',
              data: { type: 'check-in' },
              tag: 'check-in'
            }
          });

          if (pushError) {
            console.error(`Error sending check-in to user ${profile.id}:`, pushError);
          } else {
            notificationsSent++;
            console.log(`Sent check-in reminder to user ${profile.id}`);
          }
        }

      } catch (userError) {
        console.error(`Error processing user ${profile.id}:`, userError);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Scheduled notifications processed',
        usersProcessed,
        notificationsSent,
        timestamp: now.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in scheduled-notifications:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
