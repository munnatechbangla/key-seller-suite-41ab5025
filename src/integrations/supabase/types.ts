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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: []
      }
      best_sellers: {
        Row: {
          created_at: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "best_sellers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          created_at: string
          discount_amount: number
          email: string | null
          id: string
          order_id: string | null
          order_total: number
          user_id: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_amount?: number
          email?: string | null
          id?: string
          order_id?: string | null
          order_total?: number
          user_id?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_amount?: number
          email?: string | null
          id?: string
          order_id?: string | null
          order_total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          first_order_only: boolean | null
          free_product_id: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_order_amount: number | null
          new_customer_only: boolean | null
          per_user_limit: number | null
          revenue_generated: number
          starts_at: string | null
          target_brand_ids: string[] | null
          target_category_ids: string[] | null
          target_product_ids: string[] | null
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at: string
          usage_limit: number | null
          used_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          first_order_only?: boolean | null
          free_product_id?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_amount?: number | null
          new_customer_only?: boolean | null
          per_user_limit?: number | null
          revenue_generated?: number
          starts_at?: string | null
          target_brand_ids?: string[] | null
          target_category_ids?: string[] | null
          target_product_ids?: string[] | null
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          first_order_only?: boolean | null
          free_product_id?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order_amount?: number | null
          new_customer_only?: boolean | null
          per_user_limit?: number | null
          revenue_generated?: number
          starts_at?: string | null
          target_brand_ids?: string[] | null
          target_category_ids?: string[] | null
          target_product_ids?: string[] | null
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      downloads: {
        Row: {
          created_at: string
          download_count: number
          expires_at: string | null
          file_url: string | null
          id: string
          max_downloads: number
          order_id: string
          order_item_id: string
          product_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          download_count?: number
          expires_at?: string | null
          file_url?: string | null
          id?: string
          max_downloads?: number
          order_id: string
          order_item_id: string
          product_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          download_count?: number
          expires_at?: string | null
          file_url?: string | null
          id?: string
          max_downloads?: number
          order_id?: string
          order_item_id?: string
          product_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "downloads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          provider: string | null
          provider_message_id: string | null
          recipient: string
          rendered_html: string | null
          sent_at: string | null
          status: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          rendered_html?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          rendered_html?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          enabled: boolean
          html_body: string
          id: string
          name: string
          subject: string
          template_key: string
          text_body: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          html_body: string
          id?: string
          name: string
          subject: string
          template_key: string
          text_body?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          created_at?: string
          enabled?: boolean
          html_body?: string
          id?: string
          name?: string
          subject?: string
          template_key?: string
          text_body?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      featured_products: {
        Row: {
          created_at: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_deals: {
        Row: {
          created_at: string
          discount_price: number
          ends_at: string
          id: string
          product_id: string
          sort_order: number
          starts_at: string
        }
        Insert: {
          created_at?: string
          discount_price: number
          ends_at: string
          id?: string
          product_id: string
          sort_order?: number
          starts_at?: string
        }
        Update: {
          created_at?: string
          discount_price?: number
          ends_at?: string
          id?: string
          product_id?: string
          sort_order?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_pages: {
        Row: {
          canonical_url: string | null
          content: Json
          created_at: string
          id: string
          is_published: boolean
          seo_description: string | null
          seo_title: string | null
          slug: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      license_assignments: {
        Row: {
          assigned_at: string
          id: string
          license_key_id: string
          order_id: string
          order_item_id: string
          revoked_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string
          id?: string
          license_key_id: string
          order_id: string
          order_item_id: string
          revoked_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string
          id?: string
          license_key_id?: string
          order_id?: string
          order_item_id?: string
          revoked_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_assignments_license_key_id_fkey"
            columns: ["license_key_id"]
            isOneToOne: false
            referencedRelation: "license_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_assignments_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      license_keys: {
        Row: {
          created_at: string
          id: string
          key_value: string
          pool_id: string
          product_id: string
          status: Database["public"]["Enums"]["license_key_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_value: string
          pool_id: string
          product_id: string
          status?: Database["public"]["Enums"]["license_key_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key_value?: string
          pool_id?: string
          product_id?: string
          status?: Database["public"]["Enums"]["license_key_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_keys_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "license_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_keys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      license_pools: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_pools_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_payment_submissions: {
        Row: {
          admin_note: string | null
          amount: number | null
          created_at: string
          currency: string | null
          email: string | null
          gateway_id: string | null
          gateway_slug: string
          id: string
          note: string | null
          order_id: string
          payment_intent_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_url: string | null
          sender_account: string | null
          sender_name: string | null
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          amount?: number | null
          created_at?: string
          currency?: string | null
          email?: string | null
          gateway_id?: string | null
          gateway_slug: string
          id?: string
          note?: string | null
          order_id: string
          payment_intent_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          sender_account?: string | null
          sender_name?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          amount?: number | null
          created_at?: string
          currency?: string | null
          email?: string | null
          gateway_id?: string | null
          gateway_slug?: string
          id?: string
          note?: string | null
          order_id?: string
          payment_intent_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          sender_account?: string | null
          sender_name?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_payment_submissions_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payment_submissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_payment_submissions_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      media_asset_usage: {
        Row: {
          asset_id: string
          created_at: string
          entity_id: string
          entity_type: string
          field: string | null
          id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          field?: string | null
          id?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          field?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_asset_usage_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          created_at: string
          file_size: number
          filename: string
          folder: string
          height: number | null
          id: string
          mime_type: string
          original_filename: string | null
          public_url: string | null
          storage_path: string
          updated_at: string
          uploader_id: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          file_size?: number
          filename: string
          folder?: string
          height?: number | null
          id?: string
          mime_type: string
          original_filename?: string | null
          public_url?: string | null
          storage_path: string
          updated_at?: string
          uploader_id?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          file_size?: number
          filename?: string
          folder?: string
          height?: number | null
          id?: string
          mime_type?: string
          original_filename?: string | null
          public_url?: string | null
          storage_path?: string
          updated_at?: string
          uploader_id?: string | null
          width?: number | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          ip: string | null
          name: string | null
          source: string | null
          status: string
          unsubscribed_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          ip?: string | null
          name?: string | null
          source?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          ip?: string | null
          name?: string | null
          source?: string | null
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      order_custom_field_values: {
        Row: {
          created_at: string
          field_id: string | null
          field_label: string
          field_name: string
          field_type: string
          id: string
          order_id: string
          product_id: string | null
          product_slug: string | null
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          field_id?: string | null
          field_label: string
          field_name: string
          field_type: string
          id?: string
          order_id: string
          product_id?: string | null
          product_slug?: string | null
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          field_id?: string | null
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_slug?: string | null
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "product_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_custom_field_values_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_custom_field_values_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          product_slug: string
          qty: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          product_slug: string
          qty?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_slug?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          country: string | null
          coupon_code: string | null
          created_at: string
          currency: string
          customer_name: string | null
          discount: number
          email: string
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          phone: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          country?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string
          customer_name?: string | null
          discount?: number
          email: string
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          country?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string
          customer_name?: string | null
          discount?: number
          email?: string
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_gateways: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          logo_url: string | null
          mode: string
          name: string
          slug: string
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          logo_url?: string | null
          mode?: string
          name: string
          slug: string
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          logo_url?: string | null
          mode?: string
          name?: string
          slug?: string
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_intents: {
        Row: {
          amount: number
          created_at: string
          currency: string
          expires_at: string | null
          gateway: string
          gateway_payment_id: string | null
          gateway_session_id: string | null
          id: string
          mode: string
          order_id: string
          order_number: string
          redirect_url: string | null
          request_payload: Json | null
          response_payload: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          gateway: string
          gateway_payment_id?: string | null
          gateway_session_id?: string | null
          id?: string
          mode?: string
          order_id: string
          order_number: string
          redirect_url?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          gateway?: string
          gateway_payment_id?: string | null
          gateway_session_id?: string | null
          id?: string
          mode?: string
          order_id?: string
          order_number?: string
          redirect_url?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          error_message: string | null
          event_type: string
          gateway: string
          id: string
          ip_address: string | null
          order_id: string | null
          order_number: string | null
          payment_intent_id: string | null
          request_body: Json | null
          response_body: Json | null
          signature_valid: boolean | null
          status: string | null
          transaction_id: string | null
          user_agent: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          event_type: string
          gateway: string
          id?: string
          ip_address?: string | null
          order_id?: string | null
          order_number?: string | null
          payment_intent_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          signature_valid?: boolean | null
          status?: string | null
          transaction_id?: string | null
          user_agent?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          event_type?: string
          gateway?: string
          id?: string
          ip_address?: string | null
          order_id?: string | null
          order_number?: string | null
          payment_intent_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          signature_valid?: boolean | null
          status?: string | null
          transaction_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_logs_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          gateway_response: Json | null
          id: string
          method: string
          order_id: string
          paid_at: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          gateway_response?: Json | null
          id?: string
          method: string
          order_id: string
          paid_at?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          gateway_response?: Json | null
          id?: string
          method?: string
          order_id?: string
          paid_at?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attributes: {
        Row: {
          id: string
          name: string
          product_id: string
          sort_order: number
          value: string
        }
        Insert: {
          id?: string
          name: string
          product_id: string
          sort_order?: number
          value: string
        }
        Update: {
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
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
          seo_description: string | null
          seo_title: string | null
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
          seo_description?: string | null
          seo_title?: string | null
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
          seo_description?: string | null
          seo_title?: string | null
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
      product_custom_field_options: {
        Row: {
          created_at: string
          field_id: string
          id: string
          label: string
          sort_order: number
          value: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          label: string
          sort_order?: number
          value: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          label?: string
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_custom_field_options_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "product_custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      product_custom_fields: {
        Row: {
          admin_notes: string | null
          created_at: string
          default_value: string | null
          field_type: Database["public"]["Enums"]["custom_field_type"]
          help_text: string | null
          id: string
          is_enabled: boolean
          is_required: boolean
          is_visible: boolean
          label: string
          max_length: number | null
          min_length: number | null
          name: string
          placeholder: string | null
          product_id: string
          regex_pattern: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          default_value?: string | null
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          help_text?: string | null
          id?: string
          is_enabled?: boolean
          is_required?: boolean
          is_visible?: boolean
          label: string
          max_length?: number | null
          min_length?: number | null
          name: string
          placeholder?: string | null
          product_id: string
          regex_pattern?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          default_value?: string | null
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          help_text?: string | null
          id?: string
          is_enabled?: boolean
          is_required?: boolean
          is_visible?: boolean
          label?: string
          max_length?: number | null
          min_length?: number | null
          name?: string
          placeholder?: string | null
          product_id?: string
          regex_pattern?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_custom_fields_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_downloads: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          product_id: string
          sort_order: number
          updated_at: string
          version: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          product_id: string
          sort_order?: number
          updated_at?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_downloads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          product_id: string
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          product_id: string
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          product_id?: string
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_faqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          admin_reply_at: string | null
          avatar_url: string | null
          body: string | null
          created_at: string
          display_name: string | null
          id: string
          is_approved: boolean
          is_verified: boolean
          order_item_id: string | null
          product_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          admin_reply_at?: string | null
          avatar_url?: string | null
          body?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          order_item_id?: string | null
          product_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          admin_reply_at?: string | null
          avatar_url?: string | null
          body?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          order_item_id?: string | null
          product_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tag_pivot: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tag_pivot_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tag_pivot_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "product_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      product_variations: {
        Row: {
          attributes: Json
          compare_price: number | null
          created_at: string
          id: string
          name: string
          price: number
          product_id: string
          sale_price: number | null
          sku: string | null
          sort_order: number
          status: Database["public"]["Enums"]["variation_status"]
          stock: number | null
          stock_status: Database["public"]["Enums"]["stock_state"]
          updated_at: string
        }
        Insert: {
          attributes?: Json
          compare_price?: number | null
          created_at?: string
          id?: string
          name: string
          price?: number
          product_id: string
          sale_price?: number | null
          sku?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["variation_status"]
          stock?: number | null
          stock_status?: Database["public"]["Enums"]["stock_state"]
          updated_at?: string
        }
        Update: {
          attributes?: Json
          compare_price?: number | null
          created_at?: string
          id?: string
          name?: string
          price?: number
          product_id?: string
          sale_price?: number | null
          sku?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["variation_status"]
          stock?: number | null
          stock_status?: Database["public"]["Enums"]["stock_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string | null
          brand_id: string | null
          category_id: string | null
          created_at: string
          delivery_time: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"] | null
          description: string | null
          emoji: string | null
          external_url: string | null
          features: string[]
          id: string
          included: string[]
          is_best_seller: boolean
          is_digital: boolean
          is_external: boolean
          is_featured: boolean
          is_license_key: boolean
          is_subscription: boolean
          is_trending: boolean
          product_type: Database["public"]["Enums"]["product_type"] | null
          rating: number
          regular_price: number
          reviews_count: number
          sale_price: number | null
          sales_count: number
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string | null
          slug: string
          specs: Json
          status: Database["public"]["Enums"]["product_status"]
          stock_status: Database["public"]["Enums"]["stock_state"]
          thumbnail_url: string | null
          title: string
          updated_at: string
          views_count: number
          visibility: Database["public"]["Enums"]["product_visibility"]
        }
        Insert: {
          badge?: string | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          delivery_time?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          description?: string | null
          emoji?: string | null
          external_url?: string | null
          features?: string[]
          id?: string
          included?: string[]
          is_best_seller?: boolean
          is_digital?: boolean
          is_external?: boolean
          is_featured?: boolean
          is_license_key?: boolean
          is_subscription?: boolean
          is_trending?: boolean
          product_type?: Database["public"]["Enums"]["product_type"] | null
          rating?: number
          regular_price?: number
          reviews_count?: number
          sale_price?: number | null
          sales_count?: number
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          slug: string
          specs?: Json
          status?: Database["public"]["Enums"]["product_status"]
          stock_status?: Database["public"]["Enums"]["stock_state"]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          views_count?: number
          visibility?: Database["public"]["Enums"]["product_visibility"]
        }
        Update: {
          badge?: string | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          delivery_time?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          description?: string | null
          emoji?: string | null
          external_url?: string | null
          features?: string[]
          id?: string
          included?: string[]
          is_best_seller?: boolean
          is_digital?: boolean
          is_external?: boolean
          is_featured?: boolean
          is_license_key?: boolean
          is_subscription?: boolean
          is_trending?: boolean
          product_type?: Database["public"]["Enums"]["product_type"] | null
          rating?: number
          regular_price?: number
          reviews_count?: number
          sale_price?: number | null
          sales_count?: number
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          specs?: Json
          status?: Database["public"]["Enums"]["product_status"]
          stock_status?: Database["public"]["Enums"]["stock_state"]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          views_count?: number
          visibility?: Database["public"]["Enums"]["product_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_brands"
            referencedColumns: ["id"]
          },
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
          completed_at: string | null
          id: number
          is_completed: boolean
          updated_at: string
          version: number
        }
        Insert: {
          completed_at?: string | null
          id?: number
          is_completed?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          completed_at?: string | null
          id?: number
          is_completed?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          group_key: string
          id: string
          is_public: boolean
          setting_key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          group_key: string
          id?: string
          is_public?: boolean
          setting_key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          group_key?: string
          id?: string
          is_public?: boolean
          setting_key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      trending_products: {
        Row: {
          created_at: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "trending_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
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
      webhook_events: {
        Row: {
          event_id: string
          gateway: string
          id: string
          order_id: string | null
          processed_at: string
        }
        Insert: {
          event_id: string
          gateway: string
          id?: string
          order_id?: string | null
          processed_at?: string
        }
        Update: {
          event_id?: string
          gateway?: string
          id?: string
          order_id?: string | null
          processed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_asset_usage: { Args: { _asset_id: string }; Returns: Json }
      admin_list_media_assets: {
        Args: {
          _folder?: string
          _limit?: number
          _mime_prefix?: string
          _offset?: number
          _search?: string
        }
        Returns: Json
      }
      admin_mark_order_failed: {
        Args: { _gateway_response?: Json; _order_id: string; _reason?: string }
        Returns: Json
      }
      admin_mark_order_paid: {
        Args: {
          _gateway_response?: Json
          _order_id: string
          _transaction_id: string
        }
        Returns: Json
      }
      admin_update_order_custom_field_value: {
        Args: { _id: string; _value: string }
        Returns: Json
      }
      apply_coupon_usage: {
        Args: {
          _coupon_id: string
          _discount: number
          _email: string
          _order_id: string
          _order_total: number
          _user_id: string
        }
        Returns: undefined
      }
      assign_licenses_for_order: {
        Args: { _order_id: string }
        Returns: number
      }
      claim_first_admin: { Args: never; Returns: Json }
      claim_webhook_event: {
        Args: { _event_id: string; _gateway: string; _order_id?: string }
        Returns: boolean
      }
      enqueue_email_log: { Args: { _row: Json }; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      get_latest_payment_intent: {
        Args: { _gateway: string; _order_id: string }
        Returns: Json
      }
      get_order_basic_by_number: {
        Args: { _order_number: string }
        Returns: Json
      }
      get_order_custom_field_values: {
        Args: { _email?: string; _order_id: string }
        Returns: Json
      }
      get_order_summary_by_number: {
        Args: { _email?: string; _order_number: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_audit_log: { Args: { _entry: Json }; Returns: undefined }
      list_public_payment_gateways: {
        Args: never
        Returns: {
          config: Json
          description: string
          id: string
          is_enabled: boolean
          logo_url: string
          mode: string
          name: string
          slug: string
          sort_order: number
          type: string
        }[]
      }
      list_recent_public_purchases: {
        Args: { _limit?: number }
        Returns: {
          country: string
          first_name: string
          product_name: string
          product_slug: string
          product_thumbnail: string
          purchased_at: string
        }[]
      }
      log_payment_event: { Args: { _entry: Json }; Returns: undefined }
      mark_order_failed: {
        Args: { _gateway_response?: Json; _order_id: string; _reason?: string }
        Returns: Json
      }
      mark_order_paid: {
        Args: {
          _gateway_response?: Json
          _order_id: string
          _transaction_id: string
        }
        Returns: Json
      }
      place_order: {
        Args: {
          _coupon_code?: string
          _customer: Json
          _items: Json
          _payment_method: string
        }
        Returns: Json
      }
      process_payment_callback: {
        Args: {
          _gateway: string
          _order_number: string
          _raw?: Json
          _status: string
          _transaction_id: string
        }
        Returns: Json
      }
      recalc_product_rating: {
        Args: { _product_id: string }
        Returns: undefined
      }
      record_coupon_usage_for_order: {
        Args: { _coupon_id: string; _email?: string; _order_id: string }
        Returns: Json
      }
      save_order_custom_field_values: {
        Args: { _email?: string; _order_id: string; _values: Json }
        Returns: Json
      }
      submit_manual_payment_proof: {
        Args: {
          _email?: string
          _gateway_slug: string
          _note?: string
          _order_number: string
          _screenshot_url?: string
          _sender_account?: string
          _sender_name?: string
          _transaction_id?: string
        }
        Returns: Json
      }
      subscribe_newsletter: {
        Args: { _email: string; _name?: string; _source?: string }
        Returns: Json
      }
      update_payment_intent_status: {
        Args: {
          _gateway_payment_id?: string
          _id: string
          _response?: Json
          _status: string
        }
        Returns: undefined
      }
      user_purchased_product: {
        Args: { _product_id: string; _user_id: string }
        Returns: boolean
      }
      validate_coupon: {
        Args: {
          _code: string
          _email?: string
          _product_ids?: string[]
          _subtotal: number
          _user_id?: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "customer" | "affiliate" | "support"
      coupon_type: "percent" | "fixed" | "free_product" | "free_download"
      custom_field_type:
        | "text"
        | "email"
        | "number"
        | "url"
        | "password"
        | "textarea"
        | "select"
        | "radio"
        | "checkbox"
        | "date"
        | "phone"
        | "country"
        | "hidden"
      delivery_type:
        | "download"
        | "license_key"
        | "account"
        | "manual"
        | "external_url"
      license_key_status: "available" | "assigned" | "revoked"
      order_status:
        | "pending"
        | "paid"
        | "processing"
        | "completed"
        | "cancelled"
        | "refunded"
        | "failed"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      product_status: "draft" | "published" | "archived" | "private"
      product_type:
        | "downloadable"
        | "license_key"
        | "subscription"
        | "account"
        | "external"
        | "manual"
      product_visibility: "public" | "members_only" | "hidden"
      review_status: "pending" | "approved" | "rejected"
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
      coupon_type: ["percent", "fixed", "free_product", "free_download"],
      custom_field_type: [
        "text",
        "email",
        "number",
        "url",
        "password",
        "textarea",
        "select",
        "radio",
        "checkbox",
        "date",
        "phone",
        "country",
        "hidden",
      ],
      delivery_type: [
        "download",
        "license_key",
        "account",
        "manual",
        "external_url",
      ],
      license_key_status: ["available", "assigned", "revoked"],
      order_status: [
        "pending",
        "paid",
        "processing",
        "completed",
        "cancelled",
        "refunded",
        "failed",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      product_status: ["draft", "published", "archived", "private"],
      product_type: [
        "downloadable",
        "license_key",
        "subscription",
        "account",
        "external",
        "manual",
      ],
      product_visibility: ["public", "members_only", "hidden"],
      review_status: ["pending", "approved", "rejected"],
      stock_state: ["in_stock", "out_of_stock", "on_backorder"],
      variation_status: ["active", "inactive"],
    },
  },
} as const
