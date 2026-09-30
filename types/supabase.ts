export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          role?: string | null;
          created_at?: string;
        };
      };
      profile_cards: {
        Row: {
          id: string;
          user_id: string;
          self_introduction: string | null;
          skills: string | null;
          communication_style: string | null;
          consultation_style: string | null;
          free_description: string | null;
          realtime_status: string | null;
          team_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          self_introduction?: string | null;
          skills?: string | null;
          communication_style?: string | null;
          consultation_style?: string | null;
          free_description?: string | null;
          realtime_status?: string | null;
          team_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          self_introduction?: string | null;
          skills?: string | null;
          communication_style?: string | null;
          consultation_style?: string | null;
          free_description?: string | null;
          realtime_status?: string | null;
          team_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profile_tags: {
        Row: {
          id: string;
          name: string;
          color_hex: string | null;
          category_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          color_hex?: string | null;
          category_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color_hex?: string | null;
          category_id?: string | null;
          created_at?: string;
        };
      };
      tag_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
      };
      profile_card_tags: {
        Row: {
          profile_card_id: string;
          profile_tag_id: string;
        };
        Insert: {
          profile_card_id: string;
          profile_tag_id: string;
        };
        Update: {
          profile_card_id?: string;
          profile_tag_id?: string;
        };
      };
      user_private_notes: {
        Row: {
          id: string;
          author_user_id: string;
          target_user_id: string;
          note_content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_user_id: string;
          target_user_id: string;
          note_content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_user_id?: string;
          target_user_id?: string;
          note_content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
