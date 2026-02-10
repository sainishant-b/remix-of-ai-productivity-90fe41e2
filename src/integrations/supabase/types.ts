export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      check_ins: {
        Row: {
          created_at: string
          energy_level: number | null
          id: string
          mood: string | null
          question: string
          response: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          energy_level?: number | null
          id?: string
          mood?: string | null
          question: string
          response: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          energy_level?: number | null
          id?: string
          mood?: string | null
          question?: string
          response?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          custom_reminder_times: number[] | null
          daily_summary_enabled: boolean
          due_today_reminders_enabled: boolean
          frequency_multiplier: number
          high_priority_enabled: boolean
          id: string
          low_priority_enabled: boolean
          medium_priority_enabled: boolean
          minimum_lead_time: number
          overdue_reminders_enabled: boolean
          peak_energy_time: string
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          upcoming_reminders_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_reminder_times?: number[] | null
          daily_summary_enabled?: boolean
          due_today_reminders_enabled?: boolean
          frequency_multiplier?: number
          high_priority_enabled?: boolean
          id?: string
          low_priority_enabled?: boolean
          medium_priority_enabled?: boolean
          minimum_lead_time?: number
          overdue_reminders_enabled?: boolean
          peak_energy_time?: string
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          upcoming_reminders_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_reminder_times?: number[] | null
          daily_summary_enabled?: boolean
          due_today_reminders_enabled?: boolean
          frequency_multiplier?: number
          high_priority_enabled?: boolean
          id?: string
          low_priority_enabled?: boolean
          medium_priority_enabled?: boolean
          minimum_lead_time?: number
          overdue_reminders_enabled?: boolean
          peak_energy_time?: string
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          upcoming_reminders_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          check_in_frequency: number
          created_at: string
          current_streak: number
          email_frequency: string
          email_notifications_enabled: boolean
          email_overdue_alerts: boolean
          email_recommendations: boolean
          email_weekly_reports: boolean
          id: string
          last_check_in_date: string | null
          longest_streak: number
          name: string | null
          timezone: string
          total_ai_rating: number
          total_proofs_submitted: number
          work_hours_end: string
          work_hours_start: string
        }
        Insert: {
          check_in_frequency?: number
          created_at?: string
          current_streak?: number
          email_frequency?: string
          email_notifications_enabled?: boolean
          email_overdue_alerts?: boolean
          email_recommendations?: boolean
          email_weekly_reports?: boolean
          id: string
          last_check_in_date?: string | null
          longest_streak?: number
          name?: string | null
          timezone?: string
          total_ai_rating?: number
          total_proofs_submitted?: number
          work_hours_end?: string
          work_hours_start?: string
        }
        Update: {
          check_in_frequency?: number
          created_at?: string
          current_streak?: number
          email_frequency?: string
          email_notifications_enabled?: boolean
          email_overdue_alerts?: boolean
          email_recommendations?: boolean
          email_weekly_reports?: boolean
          id?: string
          last_check_in_date?: string | null
          longest_streak?: number
          name?: string | null
          timezone?: string
          total_ai_rating?: number
          total_proofs_submitted?: number
          work_hours_end?: string
          work_hours_start?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      repeat_completions: {
        Row: {
          completed_at: string
          completed_date: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          completed_date: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          completed_date?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repeat_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          created_at: string
          field_changed: string
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          field_changed: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_proofs: {
        Row: {
          ai_feedback: string | null
          ai_rating: number | null
          created_at: string
          id: string
          image_url: string
          task_id: string
          user_id: string
        }
        Insert: {
          ai_feedback?: string | null
          ai_rating?: number | null
          created_at?: string
          id?: string
          image_url: string
          task_id: string
          user_id: string
        }
        Update: {
          ai_feedback?: string | null
          ai_rating?: number | null
          created_at?: string
          id?: string
          image_url?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_proofs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_duration: number | null
          id: string
          notes: string | null
          priority: string
          progress: number
          repeat_days_of_week: number[] | null
          repeat_enabled: boolean
          repeat_end_count: number | null
          repeat_end_date: string | null
          repeat_end_type: string | null
          repeat_frequency: number | null
          repeat_streak_current: number | null
          repeat_streak_longest: number | null
          repeat_times: string[] | null
          repeat_unit: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_duration?: number | null
          id?: string
          notes?: string | null
          priority: string
          progress?: number
          repeat_days_of_week?: number[] | null
          repeat_enabled?: boolean
          repeat_end_count?: number | null
          repeat_end_date?: string | null
          repeat_end_type?: string | null
          repeat_frequency?: number | null
          repeat_streak_current?: number | null
          repeat_streak_longest?: number | null
          repeat_times?: string[] | null
          repeat_unit?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_duration?: number | null
          id?: string
          notes?: string | null
          priority?: string
          progress?: number
          repeat_days_of_week?: number[] | null
          repeat_enabled?: boolean
          repeat_end_count?: number | null
          repeat_end_date?: string | null
          repeat_end_type?: string | null
          repeat_frequency?: number | null
          repeat_streak_current?: number | null
          repeat_streak_longest?: number | null
          repeat_times?: string[] | null
          repeat_unit?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          task_id: string | null
          time_spent: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          task_id?: string | null
          time_spent?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          task_id?: string | null
          time_spent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
