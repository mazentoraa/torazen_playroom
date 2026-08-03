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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      game_sessions: {
        Row: {
          announcement: string | null
          code: string
          created_at: string
          finished_at: string | null
          hint_penalty: number
          id: string
          language: string
          mode: string
          owner_id: string
          pack_id: string
          randomize: boolean
          started_at: string | null
          status: string
          timer_seconds: number
          title: string
        }
        Insert: {
          announcement?: string | null
          code: string
          created_at?: string
          finished_at?: string | null
          hint_penalty?: number
          id?: string
          language?: string
          mode?: string
          owner_id: string
          pack_id: string
          randomize?: boolean
          started_at?: string | null
          status?: string
          timer_seconds?: number
          title: string
        }
        Update: {
          announcement?: string | null
          code?: string
          created_at?: string
          finished_at?: string | null
          hint_penalty?: number
          id?: string
          language?: string
          mode?: string
          owner_id?: string
          pack_id?: string
          randomize?: boolean
          started_at?: string | null
          status?: string
          timer_seconds?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "quiz_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          allow_skip: boolean
          answer: Json | null
          category: string | null
          choices: Json
          created_at: string
          explanation: string | null
          hints: Json
          id: string
          media_type: string | null
          media_url: string | null
          order_index: number
          pack_id: string
          password: string | null
          points: number
          question: string | null
          requires_validation: boolean
          time_bonus: number
          title: string
          type: string
        }
        Insert: {
          allow_skip?: boolean
          answer?: Json | null
          category?: string | null
          choices?: Json
          created_at?: string
          explanation?: string | null
          hints?: Json
          id?: string
          media_type?: string | null
          media_url?: string | null
          order_index?: number
          pack_id: string
          password?: string | null
          points?: number
          question?: string | null
          requires_validation?: boolean
          time_bonus?: number
          title: string
          type?: string
        }
        Update: {
          allow_skip?: boolean
          answer?: Json | null
          category?: string | null
          choices?: Json
          created_at?: string
          explanation?: string | null
          hints?: Json
          id?: string
          media_type?: string | null
          media_url?: string | null
          order_index?: number
          pack_id?: string
          password?: string | null
          points?: number
          question?: string | null
          requires_validation?: boolean
          time_bonus?: number
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "quiz_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      quiz_packs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          language: string
          owner_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          owner_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          owner_id?: string
          title?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          media_url: string | null
          mission_id: string
          session_id: string
          status: string
          team_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          mission_id: string
          session_id: string
          status?: string
          team_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          media_url?: string | null
          mission_id?: string
          session_id?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string
          completed: Json
          current_index: number
          finished_at: string | null
          hints_used: Json
          id: string
          joined_at: string
          last_activity: string
          name: string
          score: number
          session_id: string
        }
        Insert: {
          color?: string
          completed?: Json
          current_index?: number
          finished_at?: string | null
          hints_used?: Json
          id?: string
          joined_at?: string
          last_activity?: string
          name: string
          score?: number
          session_id: string
        }
        Update: {
          color?: string
          completed?: Json
          current_index?: number
          finished_at?: string | null
          hints_used?: Json
          id?: string
          joined_at?: string
          last_activity?: string
          name?: string
          score?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
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
