import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  userId: string;
  type: "test" | "daily_digest" | "overdue_alert" | "weekly_report" | "ai_recommendations";
  customSubject?: string;
  customBody?: string;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  progress: number;
}

function generateEmailHtml(
  type: string,
  userName: string,
  tasks: Task[],
  appUrl: string
): { subject: string; html: string } {
  const brandColor = "#8B5CF6";
  const headerStyle = `background: linear-gradient(135deg, ${brandColor}, #6D28D9); color: white; padding: 32px; text-align: center;`;
  const buttonStyle = `display: inline-block; background: ${brandColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;`;
  
  const footer = `
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
      <p>You're receiving this because you enabled email notifications.</p>
      <p><a href="${appUrl}/settings" style="color: ${brandColor};">Manage preferences</a> | <a href="${appUrl}/settings" style="color: ${brandColor};">Unsubscribe</a></p>
    </div>
  `;

  const taskListHtml = tasks.length > 0 
    ? tasks.slice(0, 5).map(task => `
        <div style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px;">
          <a href="${appUrl}/task/${task.id}" style="color: #1f2937; text-decoration: none; font-weight: 500;">
            ${task.title}
          </a>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
            Priority: ${task.priority} • Progress: ${task.progress}%
            ${task.due_date ? ` • Due: ${new Date(task.due_date).toLocaleDateString()}` : ''}
          </div>
        </div>
      `).join('')
    : '<p style="color: #6b7280;">No tasks to display.</p>';

  switch (type) {
    case "test":
      return {
        subject: "🎉 Test Email - AI Productivity App",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="${headerStyle}">
              <h1 style="margin: 0; font-size: 24px;">Email Notifications Working! 🚀</h1>
            </div>
            <div style="padding: 32px;">
              <p>Hi ${userName || 'there'}!</p>
              <p>Great news! Your email notifications are set up correctly. You'll now receive:</p>
              <ul style="line-height: 1.8;">
                <li>📊 Daily task digests</li>
                <li>⚠️ Overdue task alerts</li>
                <li>🤖 AI-powered task recommendations</li>
                <li>📈 Weekly progress reports</li>
              </ul>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${appUrl}" style="${buttonStyle}">Open App</a>
              </div>
              ${footer}
            </div>
          </div>
        `,
      };

    case "daily_digest":
      const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed');
      const dueTodayTasks = tasks.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date).toDateString();
        return dueDate === new Date().toDateString() && t.status !== 'completed';
      });
      
      return {
        subject: `📋 Your Daily Task Digest - ${new Date().toLocaleDateString()}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="${headerStyle}">
              <h1 style="margin: 0; font-size: 24px;">Good morning, ${userName || 'Productivity Champion'}! ☀️</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
            <div style="padding: 32px;">
              ${overdueTasks.length > 0 ? `
                <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
                  <h3 style="margin: 0 0 8px 0; color: #dc2626;">⚠️ ${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? 's' : ''}</h3>
                  <p style="margin: 0; color: #7f1d1d;">These need your attention today!</p>
                </div>
              ` : ''}
              
              <h3 style="margin: 0 0 16px 0;">📅 Today's Tasks (${dueTodayTasks.length})</h3>
              ${dueTodayTasks.length > 0 ? dueTodayTasks.map(task => `
                <div style="padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 8px;">
                  <a href="${appUrl}/task/${task.id}" style="color: #1f2937; text-decoration: none; font-weight: 500;">
                    ${task.title}
                  </a>
                </div>
              `).join('') : '<p style="color: #6b7280;">No tasks due today. Great job staying on top of things! 🎉</p>'}
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${appUrl}" style="${buttonStyle}">View All Tasks</a>
              </div>
              ${footer}
            </div>
          </div>
        `,
      };

    case "overdue_alert":
      const overdueList = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed');
      return {
        subject: `⚠️ You have ${overdueList.length} overdue task${overdueList.length > 1 ? 's' : ''}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Tasks Need Your Attention! ⚠️</h1>
            </div>
            <div style="padding: 32px;">
              <p>Hi ${userName || 'there'},</p>
              <p>You have ${overdueList.length} task${overdueList.length > 1 ? 's' : ''} past ${overdueList.length > 1 ? 'their' : 'its'} due date:</p>
              ${overdueList.map(task => `
                <div style="padding: 12px; border: 1px solid #fecaca; background: #fef2f2; border-radius: 8px; margin-bottom: 8px;">
                  <a href="${appUrl}/task/${task.id}" style="color: #dc2626; text-decoration: none; font-weight: 500;">
                    ${task.title}
                  </a>
                  <div style="font-size: 12px; color: #991b1b; margin-top: 4px;">
                    Was due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                  </div>
                </div>
              `).join('')}
              <div style="text-align: center; margin: 32px 0;">
                <a href="${appUrl}" style="${buttonStyle}">Take Action Now</a>
              </div>
              ${footer}
            </div>
          </div>
        `,
      };

    case "ai_recommendations":
      return {
        subject: "🤖 Your AI Task Recommendations Are Ready",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="${headerStyle}">
              <h1 style="margin: 0; font-size: 24px;">AI Recommendations 🤖</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">Personalized based on your energy levels</p>
            </div>
            <div style="padding: 32px;">
              <p>Hi ${userName || 'there'}!</p>
              <p>Based on your patterns and current energy, here are today's recommended tasks:</p>
              <h3 style="margin: 24px 0 16px 0;">🎯 Top Tasks for Today</h3>
              ${taskListHtml}
              <div style="text-align: center; margin: 32px 0;">
                <a href="${appUrl}" style="${buttonStyle}">View AI Recommendations</a>
              </div>
              ${footer}
            </div>
          </div>
        `,
      };

    case "weekly_report":
      const completedThisWeek = tasks.filter(t => t.status === 'completed');
      return {
        subject: "📈 Your Weekly Productivity Report",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="${headerStyle}">
              <h1 style="margin: 0; font-size: 24px;">Weekly Report 📈</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">Your productivity summary</p>
            </div>
            <div style="padding: 32px;">
              <p>Hi ${userName || 'there'}! Here's how your week went:</p>
              
              <div style="display: flex; gap: 16px; margin: 24px 0;">
                <div style="flex: 1; background: #f0fdf4; padding: 20px; border-radius: 12px; text-align: center;">
                  <div style="font-size: 32px; font-weight: bold; color: #16a34a;">${completedThisWeek.length}</div>
                  <div style="color: #166534; font-size: 14px;">Tasks Completed</div>
                </div>
                <div style="flex: 1; background: #faf5ff; padding: 20px; border-radius: 12px; text-align: center;">
                  <div style="font-size: 32px; font-weight: bold; color: ${brandColor};">${tasks.length - completedThisWeek.length}</div>
                  <div style="color: #6d28d9; font-size: 14px;">In Progress</div>
                </div>
              </div>
              
              <p>Keep up the great work! 💪</p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${appUrl}/insights" style="${buttonStyle}">View Full Insights</a>
              </div>
              ${footer}
            </div>
          </div>
        `,
      };

    default:
      return {
        subject: "Notification from AI Productivity",
        html: `<p>You have a new notification. <a href="${appUrl}">Open app</a></p>`,
      };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, type, customSubject, customBody }: EmailRequest = await req.json();

    console.log(`Sending ${type} email to user ${userId}`);

    // Get user email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user?.email) {
      console.error("Error fetching user:", userError);
      return new Response(
        JSON.stringify({ error: "User not found or no email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.user.email;
    const userName = userData.user.user_metadata?.name || userData.user.email?.split('@')[0] || '';

    // Get user's email preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("email_notifications_enabled, email_frequency, email_recommendations, email_overdue_alerts, email_weekly_reports")
      .eq("id", userId)
      .single();

    // Check if email notifications are enabled (skip for test emails)
    if (type !== "test" && profile && !profile.email_notifications_enabled) {
      console.log("Email notifications disabled for user");
      return new Response(
        JSON.stringify({ message: "Email notifications disabled", sent: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check specific email type preferences
    if (profile) {
      if (type === "ai_recommendations" && !profile.email_recommendations) {
        return new Response(
          JSON.stringify({ message: "AI recommendation emails disabled", sent: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (type === "overdue_alert" && !profile.email_overdue_alerts) {
        return new Response(
          JSON.stringify({ message: "Overdue alert emails disabled", sent: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (type === "weekly_report" && !profile.email_weekly_reports) {
        return new Response(
          JSON.stringify({ message: "Weekly report emails disabled", sent: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch user's tasks for email content
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, priority, status, due_date, progress")
      .eq("user_id", userId)
      .neq("status", "completed")
      .order("due_date", { ascending: true })
      .limit(10);

    const appUrl = Deno.env.get("APP_URL") || "https://ca8e63ec-c375-418d-bcdd-5673590b80ff.lovableproject.com";
    
    const { subject, html } = generateEmailHtml(
      type,
      userName,
      tasks || [],
      appUrl
    );

    const finalSubject = customSubject || subject;
    const finalHtml = customBody ? `<div style="font-family: sans-serif;">${customBody}</div>` : html;

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AI Productivity <onboarding@resend.dev>",
        to: [userEmail],
        subject: finalSubject,
        html: finalHtml,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Email send failed:", emailData);
      return new Response(
        JSON.stringify({ error: emailData.message || "Failed to send email", sent: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", emailData);

    return new Response(
      JSON.stringify({ 
        message: "Email sent successfully",
        sent: true,
        emailId: emailData.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});