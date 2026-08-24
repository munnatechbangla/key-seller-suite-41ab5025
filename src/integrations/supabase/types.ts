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
      audit_logs: {
        Row: {
          action: string | null
          actor_email: string | null
          actor_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action?: string | null
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string | null
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
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
      blog_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          kind: string | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          kind?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          kind?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          post_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          post_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category_id: string | null
          content: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          post_type: string | null
          slug: string
          status: string | null
          tag_ids: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          post_type?: string | null
          slug: string
          status?: string | null
          tag_ids?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          post_type?: string | null
          slug?: string
          status?: string | null
          tag_ids?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      blog_tags: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      cms_navigation: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          icon: string | null
          id: string
          label: string
          menu_name: string
          parent_id: string | null
          sort_order: number | null
          target: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          icon?: string | null
          id?: string
          label: string
          menu_name: string
          parent_id?: string | null
          sort_order?: number | null
          target?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          icon?: string | null
          id?: string
          label?: string
          menu_name?: string
          parent_id?: string | null
          sort_order?: number | null
          target?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_navigation_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cms_navigation"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_pages: {
        Row: {
          body_html: string | null
          canonical_url: string | null
          created_at: string | null
          description: string | null
          excerpt: string | null
          featured_image: string | null
          id: string
          is_system: boolean | null
          menu_order: number | null
          meta_description: string | null
          meta_title: string | null
          og_description: string | null
          og_image: string | null
          og_title: string | null
          published_at: string | null
          slug: string
          status: string | null
          title: string
          twitter_card: string | null
          twitter_image: string | null
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          canonical_url?: string | null
          created_at?: string | null
          description?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          is_system?: boolean | null
          menu_order?: number | null
          meta_description?: string | null
          meta_title?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          published_at?: string | null
          slug: string
          status?: string | null
          title: string
          twitter_card?: string | null
          twitter_image?: string | null
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          canonical_url?: string | null
          created_at?: string | null
          description?: string | null
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          is_system?: boolean | null
          menu_order?: number | null
          meta_description?: string | null
          meta_title?: string | null
          og_description?: string | null
          og_image?: string | null
          og_title?: string | null
          published_at?: string | null
          slug?: string
          status?: string | null
          title?: string
          twitter_card?: string | null
          twitter_image?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cms_sections: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          json_content: Json | null
          page_id: string | null
          section_key: string
          section_type: string
          sort_order: number | null
          subtitle: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          json_content?: Json | null
          page_id?: string | null
          section_key: string
          section_type: string
          sort_order?: number | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          json_content?: Json | null
          page_id?: string | null
          section_key?: string
          section_type?: string
          sort_order?: number | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "cms_pages"
            referencedColumns: ["id"]
          },
        ]
      }
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
      license_assignments: {
        Row: {
          assigned_at: string
          id: string
          license_key_id: string | null
          order_id: string | null
          order_item_id: string | null
          revoked_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string
          id?: string
          license_key_id?: string | null
          order_id?: string | null
          order_item_id?: string | null
          revoked_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string
          id?: string
          license_key_id?: string | null
          order_id?: string | null
          order_item_id?: string | null
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
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_value: string
          pool_id: string
          product_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          key_value?: string
          pool_id?: string
          product_id?: string
          status?: string
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
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string
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
          license_pool_id_snapshot: string | null
          order_id: string | null
          product_id: string | null
          product_name: string | null
          product_slug: string | null
          qty: number
          smm_fulfillment: Json | null
          unit_price: number
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          license_pool_id_snapshot?: string | null
          order_id?: string | null
          product_id?: string | null
          product_name?: string | null
          product_slug?: string | null
          qty?: number
          smm_fulfillment?: Json | null
          unit_price?: number
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          license_pool_id_snapshot?: string | null
          order_id?: string | null
          product_id?: string | null
          product_name?: string | null
          product_slug?: string | null
          qty?: number
          smm_fulfillment?: Json | null
          unit_price?: number
          variation_id?: string | null
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
      orders: {
        Row: {
          created_at: string
          currency: string
          customer_name: string | null
          email: string
          id: string
          order_number: string
          payment_method: string | null
          status: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_name?: string | null
          email: string
          id?: string
          order_number: string
          payment_method?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          customer_name?: string | null
          email?: string
          id?: string
          order_number?: string
          payment_method?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      product_attribute_options: {
        Row: {
          attribute_id: string
          color: string | null
          id: string
          image: string | null
          label: string
          sort_order: number
          value: string
        }
        Insert: {
          attribute_id: string
          color?: string | null
          id?: string
          image?: string | null
          label: string
          sort_order?: number
          value: string
        }
        Update: {
          attribute_id?: string
          color?: string | null
          id?: string
          image?: string | null
          label?: string
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_options_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "product_attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attributes: {
        Row: {
          display_type: string | null
          id: string
          name: string
          product_id: string
          slug: string
          sort_order: number
        }
        Insert: {
          display_type?: string | null
          id?: string
          name: string
          product_id: string
          slug: string
          sort_order?: number
        }
        Update: {
          display_type?: string | null
          id?: string
          name?: string
          product_id?: string
          slug?: string
          sort_order?: number
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
      product_variations: {
        Row: {
          attribute_option_ids: string[] | null
          attributes: Json
          compare_price: number | null
          created_at: string
          delivery_type: Database["public"]["Enums"]["delivery_type"] | null
          dimensions: Json | null
          id: string
          inventory_pool_id: string | null
          license_pool_id: string | null
          name: string
          price: number
          product_id: string
          sale_price: number | null
          sku: string | null
          sort_order: number
          status: Database["public"]["Enums"]["variation_status"]
          stock: number | null
          stock_status: Database["public"]["Enums"]["stock_state"]
          subscription_pool_id: string | null
          thumbnail_url: string | null
          updated_at: string
          visibility: string | null
          weight: number | null
        }
        Insert: {
          attribute_option_ids?: string[] | null
          attributes?: Json
          compare_price?: number | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          dimensions?: Json | null
          id?: string
          inventory_pool_id?: string | null
          license_pool_id?: string | null
          name: string
          price?: number
          product_id: string
          sale_price?: number | null
          sku?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["variation_status"]
          stock?: number | null
          stock_status?: Database["public"]["Enums"]["stock_state"]
          subscription_pool_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          visibility?: string | null
          weight?: number | null
        }
        Update: {
          attribute_option_ids?: string[] | null
          attributes?: Json
          compare_price?: number | null
          created_at?: string
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          dimensions?: Json | null
          id?: string
          inventory_pool_id?: string | null
          license_pool_id?: string | null
          name?: string
          price?: number
          product_id?: string
          sale_price?: number | null
          sku?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["variation_status"]
          stock?: number | null
          stock_status?: Database["public"]["Enums"]["stock_state"]
          subscription_pool_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          visibility?: string | null
          weight?: number | null
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
          category_id: string | null
          created_at: string
          delivery_type: Database["public"]["Enums"]["delivery_type"] | null
          description: string | null
          external_url: string | null
          id: string
          is_best_seller: boolean | null
          is_digital: boolean
          is_external: boolean
          is_featured: boolean
          is_license_key: boolean
          is_subscription: boolean
          is_trending: boolean | null
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
          is_best_seller?: boolean | null
          is_digital?: boolean
          is_external?: boolean
          is_featured?: boolean
          is_license_key?: boolean
          is_subscription?: boolean
          is_trending?: boolean | null
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
          is_best_seller?: boolean | null
          is_digital?: boolean
          is_external?: boolean
          is_featured?: boolean
          is_license_key?: boolean
          is_subscription?: boolean
          is_trending?: boolean | null
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
      start_fulfillment_for_order: {
        Args: { _order_id: string }
        Returns: undefined
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
