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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          aadhaar_number: string | null
          advance_paid: number
          agreed_incentive_amount: number | null
          incentive_amount: number | null
          approval_history: Json | null
          approval_stage: string | null
          approved_at: string | null
          approved_by: string | null
          attribution_type: string | null
          bdo_id: string | null
          external_bdo_name: string | null
          booking_amount: number
          booking_date: string
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          expected_registration_date: string | null
          id: string
          pan_number: string | null
          payment_method: string | null
          plot_id: string
          remarks: string | null
          sales_executive_id: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_price: number
          govt_amount: number | null
          company_amount: number | null
          updated_at: string
        }
        Insert: {
          aadhaar_number?: string | null
          advance_paid?: number
          agreed_incentive_amount?: number | null
          incentive_amount?: number | null
          approval_history?: Json | null
          approval_stage?: string | null
          approved_at?: string | null
          approved_by?: string | null
          booking_amount: number
          booking_date?: string
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          expected_registration_date?: string | null
          id?: string
          pan_number?: string | null
          payment_method?: string | null
          plot_id: string
          remarks?: string | null
          sales_executive_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price: number
          govt_amount?: number | null
          company_amount?: number | null
          updated_at?: string
        }
        Update: {
          aadhaar_number?: string | null
          advance_paid?: number
          agreed_incentive_amount?: number | null
          incentive_amount?: number | null
          approval_history?: Json | null
          approval_stage?: string | null
          approved_at?: string | null
          approved_by?: string | null
          booking_amount?: number
          booking_date?: string
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          expected_registration_date?: string | null
          id?: string
          pan_number?: string | null
          payment_method?: string | null
          plot_id?: string
          remarks?: string | null
          sales_executive_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_price?: number
          govt_amount?: number | null
          company_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
        ]
      }
      bdo_partners: {
        Row: {
          account_number: string | null
          agency_name: string | null
          bank_name: string | null
          bdo_code: string | null
          commission_rate: number | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          ifsc_code: string | null
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          upi_id: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          agency_name?: string | null
          bank_name?: string | null
          bdo_code?: string | null
          commission_rate?: number | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          upi_id?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          agency_name?: string | null
          bank_name?: string | null
          bdo_code?: string | null
          commission_rate?: number | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          ifsc_code?: string | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          upi_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          message: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          message: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          message?: string
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      plots: {
        Row: {
          area_sqft: number
          corner_plot: boolean
          created_at: string
          dimensions: string | null
          facing: Database["public"]["Enums"]["plot_facing"] | null
          id: string
          layout_x: number | null
          layout_y: number | null
          length_ft: number | null
          incentive_percentage: number | null
          plot_number: string
          polygon_coordinates: Json | null
          price: number
          project_id: string
          rate_per_sqft: number | null
          remarks: string | null
          road_width: number | null
          status: Database["public"]["Enums"]["plot_status"]
          updated_at: string
          width_ft: number | null
        }
        Insert: {
          area_sqft: number
          corner_plot?: boolean
          created_at?: string
          dimensions?: string | null
          facing?: Database["public"]["Enums"]["plot_facing"] | null
          id?: string
          layout_x?: number | null
          layout_y?: number | null
          length_ft?: number | null
          incentive_percentage?: number | null
          plot_number: string
          polygon_coordinates?: Json | null
          price: number
          project_id: string
          rate_per_sqft?: number | null
          remarks?: string | null
          road_width?: number | null
          status?: Database["public"]["Enums"]["plot_status"]
          updated_at?: string
          width_ft?: number | null
        }
        Update: {
          area_sqft?: number
          corner_plot?: boolean
          created_at?: string
          dimensions?: string | null
          facing?: Database["public"]["Enums"]["plot_facing"] | null
          id?: string
          layout_x?: number | null
          layout_y?: number | null
          length_ft?: number | null
          incentive_percentage?: number | null
          plot_number?: string
          polygon_coordinates?: Json | null
          price?: number
          project_id?: string
          rate_per_sqft?: number | null
          remarks?: string | null
          road_width?: number | null
          status?: Database["public"]["Enums"]["plot_status"]
          updated_at?: string
          width_ft?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          manager_id: string | null
          job_title: string | null
          department: string | null
          joining_date: string | null
          status: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          manager_id?: string | null
          job_title?: string | null
          department?: string | null
          joining_date?: string | null
          status?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          manager_id?: string | null
          job_title?: string | null
          department?: string | null
          joining_date?: string | null
          status?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          created_at: string
          file_path: string
          file_type: string | null
          id: string
          name: string
          project_id: string
          size_bytes: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_path: string
          file_type?: string | null
          id?: string
          name: string
          project_id: string
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string
          file_type?: string | null
          id?: string
          name?: string
          project_id?: string
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          code: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          google_maps_link: string | null
          id: string
          launch_date: string | null
          layout_image_url: string | null
          location: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          code: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          google_maps_link?: string | null
          id?: string
          launch_date?: string | null
          layout_image_url?: string | null
          location: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          google_maps_link?: string | null
          id?: string
          launch_date?: string | null
          layout_image_url?: string | null
          location?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      project_bank_accounts: {
        Row: {
          id: string
          project_id: string
          bank_name: string
          account_name: string
          account_number: string
          ifsc_code: string
          branch_name: string | null
          account_type: string
          is_primary: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          bank_name: string
          account_name: string
          account_number: string
          ifsc_code: string
          branch_name?: string | null
          account_type?: string
          is_primary?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          bank_name?: string
          account_name?: string
          account_number?: string
          ifsc_code?: string
          branch_name?: string | null
          account_type?: string
          is_primary?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_bank_accounts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      project_fund_transfers: {
        Row: {
          id: string
          source_project_id: string
          target_project_id: string
          source_bank_account_id: string | null
          target_bank_account_id: string | null
          amount: number
          repaid_amount: number
          purpose: string | null
          status: string
          transferred_by: string
          repayment_due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_project_id: string
          target_project_id: string
          source_bank_account_id?: string | null
          target_bank_account_id?: string | null
          amount: number
          repaid_amount?: number
          purpose?: string | null
          status?: string
          transferred_by: string
          repayment_due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          source_project_id?: string
          target_project_id?: string
          source_bank_account_id?: string | null
          target_bank_account_id?: string | null
          amount?: number
          repaid_amount?: number
          purpose?: string | null
          status?: string
          transferred_by?: string
          repayment_due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_fund_transfers_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_fund_transfers_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_fund_transfers_source_bank_account_id_fkey"
            columns: ["source_bank_account_id"]
            isOneToOne: false
            referencedRelation: "project_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_fund_transfers_target_bank_account_id_fkey"
            columns: ["target_bank_account_id"]
            isOneToOne: false
            referencedRelation: "project_bank_accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "employee" | "manager" | "management" | "accounts" | "crm"
      booking_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "on_hold"
      plot_facing:
        | "north"
        | "south"
        | "east"
        | "west"
        | "north_east"
        | "north_west"
        | "south_east"
        | "south_west"
      plot_status:
        | "available"
        | "pending"
        | "booked"
        | "reserved"
        | "sold"
        | "cancelled"
      project_status: "upcoming" | "live" | "completed" | "archived"
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
    Enums: {
      app_role: ["super_admin", "admin", "employee", "manager", "management", "accounts", "crm"],
      booking_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "on_hold",
      ],
      plot_facing: [
        "north",
        "south",
        "east",
        "west",
        "north_east",
        "north_west",
        "south_east",
        "south_west",
      ],
      plot_status: [
        "available",
        "pending",
        "booked",
        "reserved",
        "sold",
        "cancelled",
      ],
      project_status: ["upcoming", "live", "completed", "archived"],
    },
  },
} as const
