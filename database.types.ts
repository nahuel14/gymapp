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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      coach_students: {
        Row: {
          coach_id: string
          created_at: string | null
          student_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          student_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_students_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          body_zone: Database["public"]["Enums"]["body_zone"] | null
          category: Database["public"]["Enums"]["exercise_category"] | null
          created_at: string | null
          description: string | null
          id: number
          name: string
          video_url: string | null
        }
        Insert: {
          body_zone?: Database["public"]["Enums"]["body_zone"] | null
          category?: Database["public"]["Enums"]["exercise_category"] | null
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
          video_url?: string | null
        }
        Update: {
          body_zone?: Database["public"]["Enums"]["body_zone"] | null
          category?: Database["public"]["Enums"]["exercise_category"] | null
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
          video_url?: string | null
        }
        Relationships: []
      }
      phase_types: {
        Row: {
          created_at: string | null
          default_weeks: number | null
          description: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          default_weeks?: number | null
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          default_weeks?: number | null
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          last_name: string | null
          name: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          last_name?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_name?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      session_exercises: {
        Row: {
          coach_notes: string | null
          exercise_id: number | null
          id: number
          order_index: number | null
          reps: string | null
          rest_seconds: number | null
          rpe_target: number | null
          session_id: number | null
          sets: number | null
        }
        Insert: {
          coach_notes?: string | null
          exercise_id?: number | null
          id?: number
          order_index?: number | null
          reps?: string | null
          rest_seconds?: number | null
          rpe_target?: number | null
          session_id?: number | null
          sets?: number | null
        }
        Update: {
          coach_notes?: string | null
          exercise_id?: number | null
          id?: number
          order_index?: number | null
          reps?: string | null
          rest_seconds?: number | null
          rpe_target?: number | null
          session_id?: number | null
          sets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string | null
          day_name: string | null
          id: number
          is_completed: boolean | null
          order_index: number | null
          phase_type_id: number | null
          plan_id: number | null
          week_number: number
        }
        Insert: {
          created_at?: string | null
          day_name?: string | null
          id?: number
          is_completed?: boolean | null
          order_index?: number | null
          phase_type_id?: number | null
          plan_id?: number | null
          week_number: number
        }
        Update: {
          created_at?: string | null
          day_name?: string | null
          id?: number
          is_completed?: boolean | null
          order_index?: number | null
          phase_type_id?: number | null
          plan_id?: number | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_phase_type_id_fkey"
            columns: ["phase_type_id"]
            isOneToOne: false
            referencedRelation: "phase_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          coach_id: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          start_date: string | null
          student_id: string
        }
        Insert: {
          coach_id?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          start_date?: string | null
          student_id: string
        }
        Update: {
          coach_id?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          start_date?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          coach_feedback: string | null
          created_at: string | null
          id: number
          is_validated: boolean | null
          reps_performed: number | null
          rpe_actual: number | null
          session_exercise_id: number | null
          set_number: number | null
          student_id: string | null
          student_notes: string | null
          weight_kg: number | null
        }
        Insert: {
          coach_feedback?: string | null
          created_at?: string | null
          id?: number
          is_validated?: boolean | null
          reps_performed?: number | null
          rpe_actual?: number | null
          session_exercise_id?: number | null
          set_number?: number | null
          student_id?: string | null
          student_notes?: string | null
          weight_kg?: number | null
        }
        Update: {
          coach_feedback?: string | null
          created_at?: string | null
          id?: number
          is_validated?: boolean | null
          reps_performed?: number | null
          rpe_actual?: number | null
          session_exercise_id?: number | null
          set_number?: number | null
          student_id?: string | null
          student_notes?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_coach: { Args: never; Returns: boolean }
    }
    Enums: {
      body_zone:
        | "UPPER_BODY"
        | "LOWER_BODY"
        | "CORE"
        | "FULL_BODY"
        | "CARDIO"
        | "MOBILITY"
      exercise_category: "MAIN" | "BALANCE" | "AUX" | "MOBILITY"
      user_role: "COACH" | "STUDENT" | "ADMIN"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      body_zone: [
        "UPPER_BODY",
        "LOWER_BODY",
        "CORE",
        "FULL_BODY",
        "CARDIO",
        "MOBILITY",
      ],
      exercise_category: ["MAIN", "BALANCE", "AUX", "MOBILITY"],
      user_role: ["COACH", "STUDENT", "ADMIN"],
    },
  },
} as const
