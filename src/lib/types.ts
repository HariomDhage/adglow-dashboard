export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audience_breakdowns: {
        Row: {
          breakdown_type: string
          breakdown_value: string
          campaign_id: string
          clicks: number | null
          created_at: string | null
          date: string
          id: string
          impressions: number | null
          spend: number | null
        }
        Insert: {
          breakdown_type: string
          breakdown_value: string
          campaign_id: string
          clicks?: number | null
          created_at?: string | null
          date: string
          id?: string
          impressions?: number | null
          spend?: number | null
        }
        Update: {
          breakdown_type?: string
          breakdown_value?: string
          campaign_id?: string
          clicks?: number | null
          created_at?: string | null
          date?: string
          id?: string
          impressions?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audience_breakdowns_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_analytics: {
        Row: {
          campaign_id: string
          clicks: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          reach: number | null
          spend: number | null
          video_views: number | null
        }
        Insert: {
          campaign_id: string
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          reach?: number | null
          spend?: number | null
          video_views?: number | null
        }
        Update: {
          campaign_id?: string
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          reach?: number | null
          spend?: number | null
          video_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_analytics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string | null
          cta: string | null
          ctr: number | null
          daily_budget: number
          end_date: string | null
          fb_ad_id: string | null
          fb_adset_id: string | null
          fb_campaign_id: string | null
          fb_creative_id: string | null
          fb_video_id: string | null
          headline: string | null
          id: string
          name: string
          objective: string
          primary_text: string | null
          start_date: string | null
          status: string
          targeting: Json | null
          total_clicks: number | null
          total_impressions: number | null
          total_spend: number | null
          updated_at: string | null
          user_id: string
          video_filename: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          cta?: string | null
          ctr?: number | null
          daily_budget?: number
          end_date?: string | null
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_campaign_id?: string | null
          fb_creative_id?: string | null
          fb_video_id?: string | null
          headline?: string | null
          id?: string
          name: string
          objective?: string
          primary_text?: string | null
          start_date?: string | null
          status?: string
          targeting?: Json | null
          total_clicks?: number | null
          total_impressions?: number | null
          total_spend?: number | null
          updated_at?: string | null
          user_id: string
          video_filename?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          cta?: string | null
          ctr?: number | null
          daily_budget?: number
          end_date?: string | null
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_campaign_id?: string | null
          fb_creative_id?: string | null
          fb_video_id?: string | null
          headline?: string | null
          id?: string
          name?: string
          objective?: string
          primary_text?: string | null
          start_date?: string | null
          status?: string
          targeting?: Json | null
          total_clicks?: number | null
          total_impressions?: number | null
          total_spend?: number | null
          updated_at?: string | null
          user_id?: string
          video_filename?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      fb_connections: {
        Row: {
          access_token: string
          ad_account_id: string | null
          created_at: string | null
          fb_user_id: string | null
          id: string
          page_id: string | null
          page_name: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          ad_account_id?: string | null
          created_at?: string | null
          fb_user_id?: string | null
          id?: string
          page_id?: string | null
          page_name?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          ad_account_id?: string | null
          created_at?: string | null
          fb_user_id?: string | null
          id?: string
          page_id?: string | null
          page_name?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          budget_alerts: boolean | null
          campaign_status: boolean | null
          updated_at: string | null
          user_id: string
          weekly_reports: boolean | null
        }
        Insert: {
          budget_alerts?: boolean | null
          campaign_status?: boolean | null
          updated_at?: string | null
          user_id: string
          weekly_reports?: boolean | null
        }
        Update: {
          budget_alerts?: boolean | null
          campaign_status?: boolean | null
          updated_at?: string | null
          user_id?: string
          weekly_reports?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
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

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
