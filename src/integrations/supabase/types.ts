export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          badge: string;
          earned_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          badge: string;
          earned_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          badge?: string;
          earned_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_usage_events: {
        Row: {
          created_at: string;
          id: number;
          kind: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          kind: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          kind?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      agent_messages: {
        Row: {
          ai_message_id: string | null;
          created_at: string;
          id: string;
          parts: Json;
          role: string;
          thread_id: string;
        };
        Insert: {
          ai_message_id?: string | null;
          created_at?: string;
          id?: string;
          parts?: Json;
          role: string;
          thread_id: string;
        };
        Update: {
          ai_message_id?: string | null;
          created_at?: string;
          id?: string;
          parts?: Json;
          role?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "agent_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_threads: {
        Row: {
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          kind: string;
          read: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          read?: boolean;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          read?: boolean;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      opportunities: {
        Row: {
          category: string;
          created_at: string;
          date: string | null;
          description: string | null;
          difficulty: string | null;
          duration: string | null;
          id: string;
          tags: string[] | null;
          title: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          date?: string | null;
          description?: string | null;
          difficulty?: string | null;
          duration?: string | null;
          id?: string;
          tags?: string[] | null;
          title: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          date?: string | null;
          description?: string | null;
          difficulty?: string | null;
          duration?: string | null;
          id?: string;
          tags?: string[] | null;
          title?: string;
        };
        Relationships: [];
      };
      participations: {
        Row: {
          id: string;
          joined_at: string;
          opportunity_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          joined_at?: string;
          opportunity_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          joined_at?: string;
          opportunity_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "participations_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      post_comments: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_likes: {
        Row: {
          created_at: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          approved_at: string | null;
          author_id: string;
          content: string;
          created_at: string;
          id: string;
          location: string | null;
          media_types: string[];
          media_urls: string[];
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["post_status"];
          tags: string[];
          title: string | null;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          author_id: string;
          content?: string;
          created_at?: string;
          id?: string;
          location?: string | null;
          media_types?: string[];
          media_urls?: string[];
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          tags?: string[];
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          author_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          location?: string | null;
          media_types?: string[];
          media_urls?: string[];
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          tags?: string[];
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          age: number | null;
          availability: string | null;
          bio: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          goal: string | null;
          ics_token: string;
          id: string;
          interests: string[] | null;
          learning_areas: string[] | null;
          level: number;
          onboarded: boolean;
          phone: string | null;
          preferred_project_type: string | null;
          school: string | null;
          skills: string[] | null;
          updated_at: string;
          xp: number;
        };
        Insert: {
          age?: number | null;
          availability?: string | null;
          bio?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          goal?: string | null;
          ics_token?: string;
          id: string;
          interests?: string[] | null;
          learning_areas?: string[] | null;
          level?: number;
          onboarded?: boolean;
          phone?: string | null;
          preferred_project_type?: string | null;
          school?: string | null;
          skills?: string[] | null;
          updated_at?: string;
          xp?: number;
        };
        Update: {
          age?: number | null;
          availability?: string | null;
          bio?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          goal?: string | null;
          ics_token?: string;
          id?: string;
          interests?: string[] | null;
          learning_areas?: string[] | null;
          level?: number;
          onboarded?: boolean;
          phone?: string | null;
          preferred_project_type?: string | null;
          school?: string | null;
          skills?: string[] | null;
          updated_at?: string;
          xp?: number;
        };
        Relationships: [];
      };
      project_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          media_types: string[];
          media_urls: string[];
          project_id: string;
          user_id: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          id?: string;
          media_types?: string[];
          media_urls?: string[];
          project_id: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          media_types?: string[];
          media_urls?: string[];
          project_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "started_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      project_participants: {
        Row: {
          id: string;
          joined_at: string;
          project_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          joined_at?: string;
          project_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          joined_at?: string;
          project_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_participants_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "started_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      quest_activity_events: {
        Row: {
          created_at: string;
          event_kind: string;
          id: number;
          period_day: string;
          reference_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_kind: string;
          id?: never;
          period_day: string;
          reference_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_kind?: string;
          id?: never;
          period_day?: string;
          reference_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      quest_submissions: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          media_urls: string[];
          period_key: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["quest_submission_status"];
          template_id: string;
          user_id: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          id?: string;
          media_urls?: string[];
          period_key: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["quest_submission_status"];
          template_id: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          media_urls?: string[];
          period_key?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["quest_submission_status"];
          template_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quest_submissions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "quest_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      quest_templates: {
        Row: {
          active: boolean;
          created_at: string;
          description: string;
          evidence_prompt: string | null;
          icon: string;
          id: string;
          kind: string;
          requires_evidence: boolean;
          target: number;
          tint: string;
          title: string;
          xp: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description: string;
          evidence_prompt?: string | null;
          icon?: string;
          id: string;
          kind: string;
          requires_evidence?: boolean;
          target: number;
          tint?: string;
          title: string;
          xp: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string;
          evidence_prompt?: string | null;
          icon?: string;
          id?: string;
          kind?: string;
          requires_evidence?: boolean;
          target?: number;
          tint?: string;
          title?: string;
          xp?: number;
        };
        Relationships: [];
      };
      level_reward_catalog: {
        Row: {
          active: boolean;
          level: number;
          min_xp: number;
          reward: string;
          reward_key: string;
        };
        Insert: {
          active?: boolean;
          level: number;
          min_xp: number;
          reward: string;
          reward_key: string;
        };
        Update: {
          active?: boolean;
          level?: number;
          min_xp?: number;
          reward?: string;
          reward_key?: string;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          data: Json;
          generated_at: string;
          id: string;
          source: string;
          user_id: string;
        };
        Insert: {
          data: Json;
          generated_at?: string;
          id?: string;
          source?: string;
          user_id: string;
        };
        Update: {
          data?: Json;
          generated_at?: string;
          id?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reward_claims: {
        Row: {
          claimed_at: string;
          level: number;
          reward: string;
          reward_key: string;
          user_id: string;
        };
        Insert: {
          claimed_at?: string;
          level: number;
          reward: string;
          reward_key: string;
          user_id: string;
        };
        Update: {
          claimed_at?: string;
          level?: number;
          reward?: string;
          reward_key?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      schedule_events: {
        Row: {
          all_day: boolean;
          color: string | null;
          created_at: string;
          description: string | null;
          ends_at: string;
          external_id: string | null;
          ics_token: string;
          id: string;
          kind: string;
          location: string | null;
          recurrence: string | null;
          reminder_minutes: number | null;
          source: string;
          starts_at: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          all_day?: boolean;
          color?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at: string;
          external_id?: string | null;
          ics_token?: string;
          id?: string;
          kind?: string;
          location?: string | null;
          recurrence?: string | null;
          reminder_minutes?: number | null;
          source?: string;
          starts_at: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          all_day?: boolean;
          color?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at?: string;
          external_id?: string | null;
          ics_token?: string;
          id?: string;
          kind?: string;
          location?: string | null;
          recurrence?: string | null;
          reminder_minutes?: number | null;
          source?: string;
          starts_at?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      started_projects: {
        Row: {
          admin_rating: number | null;
          approved_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          difficulty: string | null;
          difficulty_tier: string;
          first_steps: Json | null;
          full_description: string | null;
          id: string;
          matching_interests: string[] | null;
          progress: number;
          quality: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          short_description: string | null;
          status: string;
          submitted_at: string | null;
          team_size: string | null;
          title: string;
          user_id: string;
          xp_cost: number;
          xp_reward_exceptional: number;
          xp_reward_standard: number;
        };
        Insert: {
          admin_rating?: number | null;
          approved_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          difficulty?: string | null;
          difficulty_tier?: string;
          first_steps?: Json | null;
          full_description?: string | null;
          id?: string;
          matching_interests?: string[] | null;
          progress?: number;
          quality?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          short_description?: string | null;
          status?: string;
          submitted_at?: string | null;
          team_size?: string | null;
          title: string;
          user_id: string;
          xp_cost?: number;
          xp_reward_exceptional?: number;
          xp_reward_standard?: number;
        };
        Update: {
          admin_rating?: number | null;
          approved_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          difficulty?: string | null;
          difficulty_tier?: string;
          first_steps?: Json | null;
          full_description?: string | null;
          id?: string;
          matching_interests?: string[] | null;
          progress?: number;
          quality?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          short_description?: string | null;
          status?: string;
          submitted_at?: string | null;
          team_size?: string | null;
          title?: string;
          user_id?: string;
          xp_cost?: number;
          xp_reward_exceptional?: number;
          xp_reward_standard?: number;
        };
        Relationships: [];
      };
      support_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          sender_id: string;
          sender_role: string;
          thread_id: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          id?: string;
          sender_id: string;
          sender_role?: string;
          thread_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          sender_role?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "support_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      support_threads: {
        Row: {
          created_at: string;
          id: string;
          last_message_at: string;
          origin: string;
          status: string;
          subject: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          origin?: string;
          status?: string;
          subject?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message_at?: string;
          origin?: string;
          status?: string;
          subject?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_integrations: {
        Row: {
          calendar_id: string | null;
          created_at: string;
          expires_at: string | null;
          provider: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          calendar_id?: string | null;
          created_at?: string;
          expires_at?: string | null;
          provider: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          calendar_id?: string | null;
          created_at?: string;
          expires_at?: string | null;
          provider?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_quest_rerolls: {
        Row: {
          day: string;
          seed: number;
          used: number;
          user_id: string;
        };
        Insert: {
          day: string;
          seed?: number;
          used?: number;
          user_id: string;
        };
        Update: {
          day?: string;
          seed?: number;
          used?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      user_quests: {
        Row: {
          awarded: boolean;
          awarded_at: string | null;
          id: string;
          period_key: string;
          progress: number;
          template_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          awarded?: boolean;
          awarded_at?: string | null;
          id?: string;
          period_key?: string;
          progress?: number;
          template_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          awarded?: boolean;
          awarded_at?: string | null;
          id?: string;
          period_key?: string;
          progress?: number;
          template_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_quests_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "quest_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_project: {
        Args: { _project_id: string };
        Returns: {
          admin_rating: number | null;
          approved_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          difficulty: string | null;
          difficulty_tier: string;
          first_steps: Json | null;
          full_description: string | null;
          id: string;
          matching_interests: string[] | null;
          progress: number;
          quality: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          short_description: string | null;
          status: string;
          submitted_at: string | null;
          team_size: string | null;
          title: string;
          user_id: string;
          xp_cost: number;
          xp_reward_exceptional: number;
          xp_reward_standard: number;
        };
        SetofOptions: {
          from: "*";
          to: "started_projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      claim_level_reward: {
        Args: { _level: number; _min_xp: number; _reward: string };
        Returns: Json;
      };
      claim_quest: {
        Args: { _period: string; _template_id: string };
        Returns: Json;
      };
      count_active_projects: { Args: { _uid: string }; Returns: number };
      consume_chat_quota: { Args: Record<PropertyKey, never>; Returns: Json };
      consume_ai_quota: {
        Args: { _hourly_limit: number; _kind: string; _user_id: string };
        Returns: boolean;
      };
      create_support_thread: {
        Args: { _first_message: string; _subject: string };
        Returns: Database["public"]["Tables"]["support_threads"]["Row"];
      };
      ensure_my_profile: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      ensure_agent_thread: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["agent_threads"]["Row"];
      };
      get_member_directory: {
        Args: { _user_ids: string[] };
        Returns: { full_name: string | null; id: string; xp: number }[];
      };
      get_user_rank: { Args: { _uid: string }; Returns: Json };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      increment_quest_progress: {
        Args: { _delta?: number; _period: string; _template_id: string };
        Returns: {
          awarded: boolean;
          awarded_at: string | null;
          id: string;
          period_key: string;
          progress: number;
          template_id: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "user_quests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      is_project_member: {
        Args: { _pid: string; _uid: string };
        Returns: boolean;
      };
      join_opportunity: {
        Args: { _opportunity_id: string };
        Returns: Json;
      };
      join_project: {
        Args: { _project_id: string };
        Returns: {
          id: string;
          joined_at: string;
          project_id: string;
          role: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "project_participants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      moderate_post: {
        Args: { _approve: boolean; _post_id: string; _reason?: string };
        Returns: {
          approved_at: string | null;
          author_id: string;
          content: string;
          created_at: string;
          id: string;
          location: string | null;
          media_types: string[];
          media_urls: string[];
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["post_status"];
          tags: string[];
          title: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "posts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_ai_refresh: {
        Args: { _request_id: string; _user_id: string };
        Returns: Database["public"]["Tables"]["user_quests"]["Row"];
      };
      record_opportunity_view: {
        Args: { _opportunity_id: string };
        Returns: Database["public"]["Tables"]["user_quests"]["Row"];
      };
      review_project: {
        Args: {
          _approve: boolean;
          _exceptional?: boolean;
          _project_id: string;
          _rating?: number;
          _reason?: string;
        };
        Returns: {
          admin_rating: number | null;
          approved_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          difficulty: string | null;
          difficulty_tier: string;
          first_steps: Json | null;
          full_description: string | null;
          id: string;
          matching_interests: string[] | null;
          progress: number;
          quality: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          short_description: string | null;
          status: string;
          submitted_at: string | null;
          team_size: string | null;
          title: string;
          user_id: string;
          xp_cost: number;
          xp_reward_exceptional: number;
          xp_reward_standard: number;
        };
        SetofOptions: {
          from: "*";
          to: "started_projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      review_quest_submission: {
        Args: { _approve: boolean; _id: string; _note: string };
        Returns: {
          content: string;
          created_at: string;
          id: string;
          media_urls: string[];
          period_key: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["quest_submission_status"];
          template_id: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "quest_submissions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reset_agent_thread: {
        Args: { _thread_id: string };
        Returns: Database["public"]["Tables"]["agent_threads"]["Row"];
      };
      save_agent_message: {
        Args: {
          _ai_message_id?: string | null;
          _parts: Json;
          _role: string;
          _thread_id: string;
        };
        Returns: Database["public"]["Tables"]["agent_messages"]["Row"];
      };
      send_support_message: {
        Args: { _content: string; _thread_id: string };
        Returns: Database["public"]["Tables"]["support_messages"]["Row"];
      };
      set_support_thread_status: {
        Args: { _status: string; _thread_id: string };
        Returns: Database["public"]["Tables"]["support_threads"]["Row"];
      };
      start_project: {
        Args: {
          _difficulty_tier: string;
          _first_steps: Json;
          _full_description: string;
          _matching_interests: string[];
          _short_description: string;
          _team_size: string;
          _title: string;
        };
        Returns: {
          admin_rating: number | null;
          approved_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          difficulty: string | null;
          difficulty_tier: string;
          first_steps: Json | null;
          full_description: string | null;
          id: string;
          matching_interests: string[] | null;
          progress: number;
          quality: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          short_description: string | null;
          status: string;
          submitted_at: string | null;
          team_size: string | null;
          title: string;
          user_id: string;
          xp_cost: number;
          xp_reward_exceptional: number;
          xp_reward_standard: number;
        };
        SetofOptions: {
          from: "*";
          to: "started_projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_project: {
        Args: { _project_id: string };
        Returns: {
          admin_rating: number | null;
          approved_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          difficulty: string | null;
          difficulty_tier: string;
          first_steps: Json | null;
          full_description: string | null;
          id: string;
          matching_interests: string[] | null;
          progress: number;
          quality: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          short_description: string | null;
          status: string;
          submitted_at: string | null;
          team_size: string | null;
          title: string;
          user_id: string;
          xp_cost: number;
          xp_reward_exceptional: number;
          xp_reward_standard: number;
        };
        SetofOptions: {
          from: "*";
          to: "started_projects";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_quest: {
        Args: {
          _content: string;
          _media: string[];
          _period: string;
          _template_id: string;
        };
        Returns: {
          content: string;
          created_at: string;
          id: string;
          media_urls: string[];
          period_key: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["quest_submission_status"];
          template_id: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "quest_submissions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      sync_quest_progress: {
        Args: { _template_id: string };
        Returns: Database["public"]["Tables"]["user_quests"]["Row"];
      };
      store_google_integration: {
        Args: {
          _access_token: string;
          _calendar_id?: string;
          _expires_at: string;
          _refresh_token: string | null;
          _user_id: string;
        };
        Returns: undefined;
      };
      tier_cost: { Args: { _tier: string }; Returns: number };
      tier_reward: {
        Args: { _exceptional: boolean; _tier: string };
        Returns: number;
      };
      use_daily_reroll: { Args: Record<PropertyKey, never>; Returns: Json };
    };
    Enums: {
      app_role: "admin" | "student";
      post_status: "pending" | "approved" | "rejected";
      quest_submission_status: "pending" | "approved" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
      post_status: ["pending", "approved", "rejected"],
      quest_submission_status: ["pending", "approved", "rejected"],
    },
  },
} as const;
