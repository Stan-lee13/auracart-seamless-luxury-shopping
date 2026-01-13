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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean | null
          label: string | null
          phone: string
          postal_code: string | null
          state: string
          street_address: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone: string
          postal_code?: string | null
          state: string
          street_address: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone?: string
          postal_code?: string | null
          state?: string
          street_address?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          amount_recovered: number | null
          created_at: string
          customer_claim: string | null
          evidence_compiled: Json | null
          evidence_submitted_at: string | null
          id: string
          order_id: string
          paystack_dispute_id: string | null
          reason: string | null
          resolution: string | null
          resolved_at: string | null
          status: string | null
          transaction_id: string | null
          updated_at: string
          won: boolean | null
        }
        Insert: {
          amount_recovered?: number | null
          created_at?: string
          customer_claim?: string | null
          evidence_compiled?: Json | null
          evidence_submitted_at?: string | null
          id?: string
          order_id: string
          paystack_dispute_id?: string | null
          reason?: string | null
          resolution?: string | null
          resolved_at?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string
          won?: boolean | null
        }
        Update: {
          amount_recovered?: number | null
          created_at?: string
          customer_claim?: string | null
          evidence_compiled?: Json | null
          evidence_submitted_at?: string | null
          id?: string
          order_id?: string
          paystack_dispute_id?: string | null
          reason?: string | null
          resolution?: string | null
          resolved_at?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_cost: number
          line_profit: number
          line_total: number
          order_id: string
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number
          unit_cost: number
          unit_price: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_cost: number
          line_profit: number
          line_total: number
          order_id: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity?: number
          unit_cost: number
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_cost?: number
          line_profit?: number
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number
          unit_cost?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
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
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_delivery_date: string | null
          aliexpress_order_id: string | null
          carrier: string | null
          created_at: string
          currency: string | null
          delivered_at: string | null
          discount_total: number
          estimated_delivery_date: string | null
          fulfilled_at: string | null
          grand_total: number
          id: string
          notes: string | null
          order_number: string
          paid_at: string | null
          policy_accepted_at: string | null
          sent_to_supplier_at: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_total: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_total: number
          terms_version: string | null
          total_cost: number
          total_profit: number
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          aliexpress_order_id?: string | null
          carrier?: string | null
          created_at?: string
          currency?: string | null
          delivered_at?: string | null
          discount_total?: number
          estimated_delivery_date?: string | null
          fulfilled_at?: string | null
          grand_total: number
          id?: string
          notes?: string | null
          order_number: string
          paid_at?: string | null
          policy_accepted_at?: string | null
          sent_to_supplier_at?: string | null
          shipped_at?: string | null
          shipping_address: Json
          shipping_total?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_total?: number
          terms_version?: string | null
          total_cost: number
          total_profit: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          aliexpress_order_id?: string | null
          carrier?: string | null
          created_at?: string
          currency?: string | null
          delivered_at?: string | null
          discount_total?: number
          estimated_delivery_date?: string | null
          fulfilled_at?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          policy_accepted_at?: string | null
          sent_to_supplier_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_total?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          terms_version?: string | null
          total_cost?: number
          total_profit?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          aliexpress_sku_id: string | null
          attributes: Json | null
          base_cost: number
          buffer_fee: number
          created_at: string
          customer_price: number
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          product_id: string
          profit_margin: number | null
          shipping_cost: number
          sku: string | null
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          aliexpress_sku_id?: string | null
          attributes?: Json | null
          base_cost: number
          buffer_fee?: number
          created_at?: string
          customer_price: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          product_id: string
          profit_margin?: number | null
          shipping_cost?: number
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          aliexpress_sku_id?: string | null
          attributes?: Json | null
          base_cost?: number
          buffer_fee?: number
          created_at?: string
          customer_price?: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          product_id?: string
          profit_margin?: number | null
          shipping_cost?: number
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ai_description: string | null
          ai_features: string[] | null
          aliexpress_product_id: string | null
          aliexpress_url: string | null
          base_cost: number
          buffer_fee: number
          category_id: string | null
          cost_currency: string | null
          created_at: string
          customer_price: number
          description: string | null
          display_currency: string | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          low_stock_threshold: number | null
          meta_description: string | null
          meta_title: string | null
          name: string
          profit_margin: number
          shipping_cost: number
          short_description: string | null
          slug: string
          stock_quantity: number | null
          supplier_id: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          ai_description?: string | null
          ai_features?: string[] | null
          aliexpress_product_id?: string | null
          aliexpress_url?: string | null
          base_cost?: number
          buffer_fee?: number
          category_id?: string | null
          cost_currency?: string | null
          created_at?: string
          customer_price: number
          description?: string | null
          display_currency?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          profit_margin?: number
          shipping_cost?: number
          short_description?: string | null
          slug: string
          stock_quantity?: number | null
          supplier_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          ai_description?: string | null
          ai_features?: string[] | null
          aliexpress_product_id?: string | null
          aliexpress_url?: string | null
          base_cost?: number
          buffer_fee?: number
          category_id?: string | null
          cost_currency?: string | null
          created_at?: string
          customer_price?: number
          description?: string | null
          display_currency?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          profit_margin?: number
          shipping_cost?: number
          short_description?: string | null
          slug?: string
          stock_quantity?: number | null
          supplier_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_currency: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_currency?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_currency?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          account_name: string | null
          account_number: string | null
          admin_notes: string | null
          aliexpress_dispute_id: string | null
          aliexpress_refund_status: string | null
          bank_name: string | null
          created_at: string
          id: string
          is_full_refund: boolean | null
          order_id: string
          platform_loss: number | null
          processed_at: string | null
          reason: string | null
          refund_amount: number
          status: Database["public"]["Enums"]["refund_status"]
          supplier_refund_amount: number | null
          transaction_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          admin_notes?: string | null
          aliexpress_dispute_id?: string | null
          aliexpress_refund_status?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          is_full_refund?: boolean | null
          order_id: string
          platform_loss?: number | null
          processed_at?: string | null
          reason?: string | null
          refund_amount: number
          status?: Database["public"]["Enums"]["refund_status"]
          supplier_refund_amount?: number | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          admin_notes?: string | null
          aliexpress_dispute_id?: string | null
          aliexpress_refund_status?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          is_full_refund?: boolean | null
          order_id?: string
          platform_loss?: number | null
          processed_at?: string | null
          reason?: string | null
          refund_amount?: number
          status?: Database["public"]["Enums"]["refund_status"]
          supplier_refund_amount?: number | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          accuracy_rate: number | null
          aliexpress_seller_id: string | null
          avg_delivery_days: number | null
          created_at: string
          dispute_win_rate: number | null
          id: string
          is_active: boolean | null
          name: string
          rating: number | null
          refund_response_days: number | null
          sla_score: number | null
          total_orders: number | null
          updated_at: string
        }
        Insert: {
          accuracy_rate?: number | null
          aliexpress_seller_id?: string | null
          avg_delivery_days?: number | null
          created_at?: string
          dispute_win_rate?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          rating?: number | null
          refund_response_days?: number | null
          sla_score?: number | null
          total_orders?: number | null
          updated_at?: string
        }
        Update: {
          accuracy_rate?: number | null
          aliexpress_seller_id?: string | null
          avg_delivery_days?: number | null
          created_at?: string
          dispute_win_rate?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          rating?: number | null
          refund_response_days?: number | null
          sla_score?: number | null
          total_orders?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          bank: string | null
          card_type: string | null
          created_at: string
          currency: string
          id: string
          ip_address: string | null
          last_four: string | null
          metadata: Json | null
          net_amount: number | null
          order_id: string | null
          payment_channel: string | null
          payment_method: string | null
          paystack_fees: number | null
          paystack_reference: string
          paystack_transaction_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string | null
        }
        Insert: {
          amount: number
          bank?: string | null
          card_type?: string | null
          created_at?: string
          currency?: string
          id?: string
          ip_address?: string | null
          last_four?: string | null
          metadata?: Json | null
          net_amount?: number | null
          order_id?: string | null
          payment_channel?: string | null
          payment_method?: string | null
          paystack_fees?: number | null
          paystack_reference: string
          paystack_transaction_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string | null
        }
        Update: {
          amount?: number
          bank?: string | null
          card_type?: string | null
          created_at?: string
          currency?: string
          id?: string
          ip_address?: string | null
          last_four?: string | null
          metadata?: Json | null
          net_amount?: number | null
          order_id?: string | null
          payment_channel?: string | null
          payment_method?: string | null
          paystack_fees?: number | null
          paystack_reference?: string
          paystack_transaction_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_customer_price: {
        Args: {
          base_cost: number
          buffer_fee: number
          profit_margin: number
          shipping_cost: number
        }
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
    }
    Enums: {
      app_role: "admin" | "customer"
      order_status:
        | "created"
        | "paid"
        | "sent_to_supplier"
        | "fulfilled"
        | "shipped"
        | "delivered"
        | "refunded_partial"
        | "refunded_full"
        | "disputed"
        | "chargeback"
      payment_status: "pending" | "success" | "failed" | "refunded"
      refund_status: "pending" | "processing" | "completed" | "failed"
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
      app_role: ["admin", "customer"],
      order_status: [
        "created",
        "paid",
        "sent_to_supplier",
        "fulfilled",
        "shipped",
        "delivered",
        "refunded_partial",
        "refunded_full",
        "disputed",
        "chargeback",
      ],
      payment_status: ["pending", "success", "failed", "refunded"],
      refund_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
