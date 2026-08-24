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
      coupon_usage: {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      downloads: {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          payload: Json | null
          provider: string | null
          recipient: string
          rendered_html: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          template_key: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          provider?: string | null
          recipient: string
          rendered_html?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_key?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          provider?: string | null
          recipient?: string
          rendered_html?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_key?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          enabled: boolean | null
          html_body: string | null
          id: string
          subject: string | null
          template_key: string
        }
        Insert: {
          enabled?: boolean | null
          html_body?: string | null
          id?: string
          subject?: string | null
          template_key: string
        }
        Update: {
          enabled?: boolean | null
          html_body?: string | null
          id?: string
          subject?: string | null
          template_key?: string
        }
        Relationships: []
      }
      legal_pages: {
        Row: {
          content: string | null
          id: string
          is_active: boolean | null
          slug: string
          title: string
        }
        Insert: {
          content?: string | null
          id?: string
          is_active?: boolean | null
          slug: string
          title: string
        }
        Update: {
          content?: string | null
          id?: string
          is_active?: boolean | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
      manual_payment_submissions: {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          product_id: string | null
          qty: number
          smm_fulfillment: Json | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string | null
          qty?: number
          smm_fulfillment?: Json | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string | null
          qty?: number
          smm_fulfillment?: Json | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          id: string
          is_enabled: boolean | null
          slug: string
        }
        Insert: {
          id?: string
          is_enabled?: boolean | null
          slug: string
        }
        Update: {
          id?: string
          is_enabled?: boolean | null
          slug?: string
        }
        Relationships: []
      }
      payment_intents: {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
        }
        Insert: {
          id?: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          url: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          url: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          admin_reply: string | null
          body: string | null
          created_at: string
          id: string
          is_approved: boolean
          is_verified: boolean
          product_id: string
          rating: number
          status: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          product_id: string
          rating: number
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          product_id?: string
          rating?: number
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          delivery_type: Database["public"]["Enums"]["delivery_type"] | null
          description: string | null
          external_url: string | null
          id: string
          is_digital: boolean
          is_external: boolean
          is_featured: boolean
          is_license_key: boolean
          is_subscription: boolean
          product_type: Database["public"]["Enums"]["product_type"] | null
          regular_price: number
          sale_price: number | null
          sales_count: number
          short_description: string | null
          sku: string | null
          slug: string
          smm_config: Json | null
          status: Database["public"]["Enums"]["product_status"]
          stock_status: Database["public"]["Enums"]["stock_state"]
          thumbnail_url: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["product_visibility"]
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_digital?: boolean
          is_external?: boolean
          is_featured?: boolean
          is_license_key?: boolean
          is_subscription?: boolean
          product_type?: Database["public"]["Enums"]["product_type"] | null
          regular_price?: number
          sale_price?: number | null
          sales_count?: number
          short_description?: string | null
          sku?: string | null
          slug: string
          smm_config?: Json | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_status?: Database["public"]["Enums"]["stock_state"]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["product_visibility"]
        }
        Update: {
          category_id?: string | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_digital?: boolean
          is_external?: boolean
          is_featured?: boolean
          is_license_key?: boolean
          is_subscription?: boolean
          product_type?: Database["public"]["Enums"]["product_type"] | null
          regular_price?: number
          sale_price?: number | null
          sales_count?: number
          short_description?: string | null
          sku?: string | null
          slug?: string
          smm_config?: Json | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_status?: Database["public"]["Enums"]["stock_state"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["product_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      setup_state: {
        Row: {
          id: number
          is_completed: boolean | null
          updated_at: string | null
        }
        Insert: {
          id: number
          is_completed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          is_completed?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          group_key: string
          id: string
          is_public: boolean | null
          setting_key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          group_key: string
          id?: string
          is_public?: boolean | null
          setting_key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          group_key?: string
          id?: string
          is_public?: boolean | null
          setting_key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_recent_public_purchases: {
        Args: { _limit: number }
        Returns: {
          created_at: string
          customer_name: string
          emoji: string
          id: string
          product_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "customer" | "affiliate" | "support"
      delivery_type:
        | "download"
        | "license_key"
        | "account"
        | "manual"
        | "external_url"
        | "smm_fulfillment"
      product_status: "draft" | "published" | "private" | "archived"
      product_type:
        | "downloadable"
        | "license_key"
        | "subscription"
        | "account"
        | "external"
        | "manual"
        | "smm_service"
      product_visibility: "public" | "members_only" | "hidden"
      smm_order_status:
        | "pending"
        | "processing"
        | "partial"
        | "completed"
        | "cancelled"
        | "refunded"
      stock_state: "in_stock" | "out_of_stock" | "on_backorder"
      variation_status: "active" | "inactive"
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
      app_role: ["admin", "manager", "customer", "affiliate", "support"],
      delivery_type: [
        "download",
        "license_key",
        "account",
        "manual",
        "external_url",
        "smm_fulfillment",
      ],
      product_status: ["draft", "published", "private", "archived"],
      product_type: [
        "downloadable",
        "license_key",
        "subscription",
        "account",
        "external",
        "manual",
        "smm_service",
      ],
      product_visibility: ["public", "members_only", "hidden"],
      smm_order_status: [
        "pending",
        "processing",
        "partial",
        "completed",
        "cancelled",
        "refunded",
      ],
      stock_state: ["in_stock", "out_of_stock", "on_backorder"],
      variation_status: ["active", "inactive"],
    },
  },
} as const
