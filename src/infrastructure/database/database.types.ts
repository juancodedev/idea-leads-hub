// Database type definitions for Supabase
// Generated manually from migration files in supabase/migrations/
// When Supabase CLI auth is resolved, replace this file with:
//   supabase gen types --lang=ts --linked > src/infrastructure/database/database.types.ts

export interface Database {
  public: {
    Tables: {
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          last_used_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          company_name: string | null;
          job_title: string | null;
          phone: string | null;
          bio: string | null;
          website: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          company_name?: string | null;
          job_title?: string | null;
          phone?: string | null;
          bio?: string | null;
          website?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          company_name?: string | null;
          job_title?: string | null;
          phone?: string | null;
          bio?: string | null;
          website?: string | null;
          updated_at?: string;
        };
      };
      leads: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          company: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          website: string | null;
          status: string;
          source: string | null;
          notes: string | null;
          pipeline_id: string | null;
          stage_id: string | null;
          instagram_handle: string | null;
          instagram_scoped_id: string | null;
          job_title: string | null;
          linkedin_url: string | null;
          estimated_value: number | null;
          next_follow_up: string | null;
          last_activity_at: string | null;
          external_id: string | null;
          city: string | null;
          industry: string | null;
          opportunity_score: number | null;
          rating: number | null;
          reviews_count: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          company: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          website?: string | null;
          status?: string;
          source?: string | null;
          notes?: string | null;
          pipeline_id?: string | null;
          stage_id?: string | null;
          instagram_handle?: string | null;
          instagram_scoped_id?: string | null;
          job_title?: string | null;
          linkedin_url?: string | null;
          estimated_value?: number | null;
          next_follow_up?: string | null;
          last_activity_at?: string | null;
          external_id?: string | null;
          city?: string | null;
          industry?: string | null;
          opportunity_score?: number | null;
          rating?: number | null;
          reviews_count?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          company?: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          website?: string | null;
          status?: string;
          source?: string | null;
          notes?: string | null;
          pipeline_id?: string | null;
          stage_id?: string | null;
          instagram_handle?: string | null;
          instagram_scoped_id?: string | null;
          job_title?: string | null;
          linkedin_url?: string | null;
          estimated_value?: number | null;
          next_follow_up?: string | null;
          last_activity_at?: string | null;
          external_id?: string | null;
          city?: string | null;
          industry?: string | null;
          opportunity_score?: number | null;
          rating?: number | null;
          reviews_count?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      ideas: {
        Row: {
          id: string;
          created_by: string;
          title: string;
          description: string | null;
          status: string;
          priority: string;
          potential_revenue: number;
          archived_at: string | null;
          attachments: any[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          created_by: string;
          title: string;
          description?: string | null;
          status?: string;
          priority?: string;
          potential_revenue?: number;
          archived_at?: string | null;
          attachments?: any[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          created_by?: string;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          potential_revenue?: number;
          archived_at?: string | null;
          attachments?: any[];
          created_at?: string;
          updated_at?: string;
        };
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string | null;
          idea_id: string | null;
          type: string;
          title: string;
          description: string;
          due_date: string | null;
          status: string | null;
          completed: boolean;
          completed_at: string | null;
          read_at: string | null;
          attachments: any[];
          external_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lead_id?: string | null;
          idea_id?: string | null;
          type: string;
          title: string;
          description: string;
          due_date?: string | null;
          status?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          read_at?: string | null;
          attachments?: any[];
          external_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lead_id?: string | null;
          idea_id?: string | null;
          type?: string;
          title?: string;
          description?: string;
          due_date?: string | null;
          status?: string | null;
          completed?: boolean;
          completed_at?: string | null;
          read_at?: string | null;
          attachments?: any[];
          external_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_secrets: {
        Row: {
          id: string;
          user_id: string;
          instagram_token: string | null;
          instagram_user_token: string | null;
          instagram_ig_id: string | null;
          instagram_page_id: string | null;
          token_expires_at: string | null;
          auth_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          instagram_token?: string | null;
          instagram_user_token?: string | null;
          instagram_ig_id?: string | null;
          instagram_page_id?: string | null;
          token_expires_at?: string | null;
          auth_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          instagram_token?: string | null;
          instagram_user_token?: string | null;
          instagram_ig_id?: string | null;
          instagram_page_id?: string | null;
          token_expires_at?: string | null;
          auth_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
      };
      lead_tags: {
        Row: {
          lead_id: string;
          tag_id: string;
          user_id: string;
        };
        Insert: {
          lead_id: string;
          tag_id: string;
          user_id: string;
        };
        Update: {
          lead_id?: string;
          tag_id?: string;
          user_id?: string;
        };
      };
      idea_tags: {
        Row: {
          idea_id: string;
          tag_id: string;
          user_id: string;
        };
        Insert: {
          idea_id: string;
          tag_id: string;
          user_id: string;
        };
        Update: {
          idea_id?: string;
          tag_id?: string;
          user_id?: string;
        };
      };
      idea_leads: {
        Row: {
          idea_id: string;
          lead_id: string;
          user_id: string;
        };
        Insert: {
          idea_id: string;
          lead_id: string;
          user_id: string;
        };
        Update: {
          idea_id?: string;
          lead_id?: string;
          user_id?: string;
        };
      };
      pipelines: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
      };
      pipeline_stages: {
        Row: {
          id: string;
          pipeline_id: string;
          user_id: string;
          name: string;
          position: number;
          color: string;
          is_closed: boolean;
          is_won: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          pipeline_id: string;
          user_id: string;
          name: string;
          position: number;
          color?: string;
          is_closed?: boolean;
          is_won?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          pipeline_id?: string;
          user_id?: string;
          name?: string;
          position?: number;
          color?: string;
          is_closed?: boolean;
          is_won?: boolean;
          created_at?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string | null;
          idea_id: string | null;
          content: string;
          external_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lead_id?: string | null;
          idea_id?: string | null;
          content: string;
          external_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lead_id?: string | null;
          idea_id?: string | null;
          content?: string;
          external_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          parent_id: string | null;
          action: string;
          changes: any;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          parent_id?: string | null;
          action: string;
          changes?: any;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          parent_id?: string | null;
          action?: string;
          changes?: any;
          user_id?: string | null;
          created_at?: string;
        };
      };
      channel_accounts: {
        Row: {
          id: string;
          user_id: string;
          channel: string;
          external_account_id: string;
          page_id: string | null;
          display_name: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          channel: string;
          external_account_id: string;
          page_id?: string | null;
          display_name?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          channel?: string;
          external_account_id?: string;
          page_id?: string | null;
          display_name?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string | null;
          account_id: string | null;
          channel: string;
          external_id: string;
          participant_name: string | null;
          last_inbound_at: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          unread_count: number;
          metadata: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lead_id?: string | null;
          account_id?: string | null;
          channel?: string;
          external_id: string;
          participant_name?: string | null;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          unread_count?: number;
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lead_id?: string | null;
          account_id?: string | null;
          channel?: string;
          external_id?: string;
          participant_name?: string | null;
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          unread_count?: number;
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string;
          direction: string;
          origin: string | null;
          type: string;
          body: string | null;
          external_id: string | null;
          status: string;
          error_message: string | null;
          hint: string | null;
          legacy_activity_id: string | null;
          raw_payload: any;
          created_at: string;
          delivered_at: string | null;
          read_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id: string;
          direction: string;
          origin?: string | null;
          type?: string;
          body?: string | null;
          external_id?: string | null;
          status?: string;
          error_message?: string | null;
          hint?: string | null;
          legacy_activity_id?: string | null;
          raw_payload?: any;
          created_at?: string;
          delivered_at?: string | null;
          read_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          conversation_id?: string;
          direction?: string;
          origin?: string | null;
          type?: string;
          body?: string | null;
          external_id?: string | null;
          status?: string;
          error_message?: string | null;
          hint?: string | null;
          legacy_activity_id?: string | null;
          raw_payload?: any;
          created_at?: string;
          delivered_at?: string | null;
          read_at?: string | null;
          updated_at?: string;
        };
      };
      webhook_events: {
        Row: {
          event_id: string;
          provider: string;
          status: string;
          attempts: number;
          payload: any;
          received_at: string;
          last_attempt_at: string | null;
        };
        Insert: {
          event_id: string;
          provider: string;
          status?: string;
          attempts?: number;
          payload: any;
          received_at?: string;
          last_attempt_at?: string | null;
        };
        Update: {
          event_id?: string;
          provider?: string;
          status?: string;
          attempts?: number;
          payload?: any;
          received_at?: string;
          last_attempt_at?: string | null;
        };
      };
    };
    Enums: {};
  };
}

// Convenience type aliases for each table
export namespace Tables {
  export type Profiles = Database['public']['Tables']['profiles']['Row'];
  export type Leads = Database['public']['Tables']['leads']['Row'];
  export type Ideas = Database['public']['Tables']['ideas']['Row'];
  export type Activities = Database['public']['Tables']['activities']['Row'];
  export type Tags = Database['public']['Tables']['tags']['Row'];
  export type LeadTags = Database['public']['Tables']['lead_tags']['Row'];
  export type IdeaTags = Database['public']['Tables']['idea_tags']['Row'];
  export type IdeaLeads = Database['public']['Tables']['idea_leads']['Row'];
  export type Pipelines = Database['public']['Tables']['pipelines']['Row'];
  export type PipelineStages = Database['public']['Tables']['pipeline_stages']['Row'];
  export type Notes = Database['public']['Tables']['notes']['Row'];
  export type AuditLogs = Database['public']['Tables']['audit_logs']['Row'];
  export type UserSecrets = Database['public']['Tables']['user_secrets']['Row'];
  export type ChannelAccounts = Database['public']['Tables']['channel_accounts']['Row'];
  export type Conversations = Database['public']['Tables']['conversations']['Row'];
  export type Messages = Database['public']['Tables']['messages']['Row'];
  export type WebhookEvents = Database['public']['Tables']['webhook_events']['Row'];
}
