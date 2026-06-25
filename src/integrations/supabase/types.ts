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
          product_id: string
          sort_order: number
          url: string
        }
        Insert: {
          alt?: string | null
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number
          url: string
        }
        Update: {
          alt?: string | null
          created_at?: string
          id?: string
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
          body: string | null
          created_at: string
          id: string
          is_approved: boolean
          is_verified: boolean
          product_id: string
          rating: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          product_id: string
          rating: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          product_id?: string
          rating?: number
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
          created_at: string
          id: string
          name: string
          price: number
          product_id: string
          sale_price: number | null
          sku: string | null
          sort_order: number
          stock_status: Database["public"]["Enums"]["stock_state"]
          updated_at: string
        }
        Insert: {
          attributes?: Json
          created_at?: string
          id?: string
          name: string
          price?: number
          product_id: string
          sale_price?: number | null
          sku?: string | null
          sort_order?: number
          stock_status?: Database["public"]["Enums"]["stock_state"]
          updated_at?: string
        }
        Update: {
          attributes?: Json
          created_at?: string
          id?: string
          name?: string
          price?: number
          product_id?: string
          sale_price?: number | null
          sku?: string | null
          sort_order?: number
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
        }
        Insert: {
          badge?: string | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          delivery_time?: string | null
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
        }
        Update: {
          badge?: string | null
          brand_id?: string | null
          category_id?: string | null
          created_at?: string
          delivery_time?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      generate_order_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      product_status: "draft" | "published" | "archived"
      stock_state: "in_stock" | "out_of_stock" | "on_backorder"
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
      product_status: ["draft", "published", "archived"],
      stock_state: ["in_stock", "out_of_stock", "on_backorder"],
    },
  },
} as const
