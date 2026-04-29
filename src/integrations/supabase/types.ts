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
          client_id: string
          created_at: string
          id: string
          notification_shown: boolean
          payment_method: string
          payment_status: string
          status: string
          total_value: number
          trip_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          notification_shown?: boolean
          payment_method?: string
          payment_status?: string
          status?: string
          total_value?: number
          trip_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          notification_shown?: boolean
          payment_method?: string
          payment_status?: string
          status?: string
          total_value?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_seats: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          passenger_name: string | null
          seat_number: number
          status: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          passenger_name?: string | null
          seat_number: number
          status?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          passenger_name?: string | null
          seat_number?: number
          status?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_seats_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_seats_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          cnpj: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          pix_key: string | null
          slug: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          pix_key?: string | null
          slug: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          pix_key?: string | null
          slug?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          cash_only: boolean
          code: string
          company_id: string
          created_at: string
          discount_percent: number
          expires_at: string | null
          id: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          cash_only?: boolean
          code: string
          company_id: string
          created_at?: string
          discount_percent: number
          expires_at?: string | null
          id?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          cash_only?: boolean
          code?: string
          company_id?: string
          created_at?: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          trip_id: string | null
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description: string
          id?: string
          trip_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          trip_id?: string | null
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          payment_method: string
          receipt_uploaded_at: string | null
          receipt_url: string | null
          status: string
          trip_id: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          payment_method?: string
          receipt_uploaded_at?: string | null
          receipt_url?: string | null
          status?: string
          trip_id: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          payment_method?: string
          receipt_uploaded_at?: string | null
          receipt_url?: string | null
          status?: string
          trip_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paid: number
          id: string
          paid_at: string
          trip_id: string
        }
        Insert: {
          amount_paid: number
          id?: string
          paid_at?: string
          trip_id: string
        }
        Update: {
          amount_paid?: number
          id?: string
          paid_at?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          business_address: string | null
          business_cnpj: string | null
          business_logo_url: string | null
          business_name: string | null
          business_phone: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          pix_key: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_address?: string | null
          business_cnpj?: string | null
          business_logo_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_address?: string | null
          business_cnpj?: string | null
          business_logo_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotion_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          promotion_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          promotion_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_images_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          draft_status: string
          expires_at: string | null
          id: string
          image: string | null
          title: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          draft_status?: string
          expires_at?: string | null
          id?: string
          image?: string | null
          title: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          draft_status?: string
          expires_at?: string | null
          id?: string
          image?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_images_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_queries: {
        Row: {
          coupon_code: string | null
          created_at: string
          discount_percent: number
          id: string
          installments: number
          passenger_name: string | null
          payment_method: string
          phone: string | null
          seat_number: number | null
          status: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          discount_percent?: number
          id?: string
          installments?: number
          passenger_name?: string | null
          payment_method?: string
          phone?: string | null
          seat_number?: number | null
          status?: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          discount_percent?: number
          id?: string
          installments?: number
          passenger_name?: string | null
          payment_method?: string
          phone?: string | null
          seat_number?: number | null
          status?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_seats: {
        Row: {
          created_at: string
          id: string
          seat_number: string
          status: string
          trip_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          seat_number: string
          status?: string
          trip_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          seat_number?: string
          status?: string
          trip_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          boleto_fee_percent: number
          company_id: string | null
          created_at: string
          credit_card_fee_percent: number
          description: string | null
          destination: string
          draft_status: string
          end_date: string
          id: string
          images: string[]
          is_public: boolean
          max_installments_card: number
          start_date: string
          status: string
          total_price: number
          total_seats: number
          updated_at: string
          user_id: string
        }
        Insert: {
          boleto_fee_percent?: number
          company_id?: string | null
          created_at?: string
          credit_card_fee_percent?: number
          description?: string | null
          destination: string
          draft_status?: string
          end_date: string
          id?: string
          images?: string[]
          is_public?: boolean
          max_installments_card?: number
          start_date: string
          status?: string
          total_price?: number
          total_seats?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          boleto_fee_percent?: number
          company_id?: string | null
          created_at?: string
          credit_card_fee_percent?: number
          description?: string | null
          destination?: string
          draft_status?: string
          end_date?: string
          id?: string
          images?: string[]
          is_public?: boolean
          max_installments_card?: number
          start_date?: string
          status?: string
          total_price?: number
          total_seats?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      confirm_trip_query: {
        Args: { _client_id: string; _query_id: string }
        Returns: undefined
      }
      consume_coupon: { Args: { _code: string }; Returns: undefined }
      get_auth_email: { Args: never; Returns: string }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      prereserve_bus_seat: {
        Args: {
          _passenger_name: string
          _phone?: string
          _seat_number: number
          _trip_id: string
        }
        Returns: {
          client_id: string | null
          created_at: string
          id: string
          passenger_name: string | null
          seat_number: number
          status: string
          trip_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bus_seats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_trip_statuses: { Args: never; Returns: undefined }
      reject_trip_query: { Args: { _query_id: string }; Returns: undefined }
      reserve_bus_seat: {
        Args: {
          _client_id: string
          _passenger_name: string
          _seat_number: number
          _trip_id: string
        }
        Returns: {
          client_id: string | null
          created_at: string
          id: string
          passenger_name: string | null
          seat_number: number
          status: string
          trip_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bus_seats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_installment_status: {
        Args: { _installment_id: string; _status: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "cliente"
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
      app_role: ["admin", "cliente"],
    },
  },
} as const
