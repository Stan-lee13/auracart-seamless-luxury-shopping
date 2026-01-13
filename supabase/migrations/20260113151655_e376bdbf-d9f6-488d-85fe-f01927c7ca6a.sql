-- =============================================
-- AURACART DATABASE SCHEMA
-- Production-grade dropshipping platform
-- =============================================

-- 1. ENUMS
-- =============================================

-- User roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

-- Order status enum
CREATE TYPE public.order_status AS ENUM (
  'created',
  'paid',
  'sent_to_supplier',
  'fulfilled',
  'shipped',
  'delivered',
  'refunded_partial',
  'refunded_full',
  'disputed',
  'chargeback'
);

-- Payment status enum
CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'success',
  'failed',
  'refunded'
);

-- Refund status enum
CREATE TYPE public.refund_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- 2. CORE TABLES
-- =============================================

-- User profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  preferred_currency TEXT DEFAULT 'NGN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- User addresses
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT DEFAULT 'Home',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  postal_code TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppliers (AliExpress sellers)
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aliexpress_seller_id TEXT UNIQUE,
  name TEXT NOT NULL,
  rating DECIMAL(3,2) DEFAULT 0,
  -- SLA scoring
  avg_delivery_days DECIMAL(5,2),
  refund_response_days DECIMAL(5,2),
  dispute_win_rate DECIMAL(5,4) DEFAULT 0,
  accuracy_rate DECIMAL(5,4) DEFAULT 1,
  sla_score DECIMAL(5,2) DEFAULT 100,
  total_orders INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  
  -- Product info
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  short_description TEXT,
  
  -- AliExpress data
  aliexpress_product_id TEXT,
  aliexpress_url TEXT,
  
  -- Pricing components (stored separately, never recalculated)
  base_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  buffer_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  profit_margin DECIMAL(5,4) NOT NULL DEFAULT 0.30, -- 30% default
  
  -- Calculated price (stored, not computed)
  customer_price DECIMAL(12,2) NOT NULL,
  
  -- Currency
  cost_currency TEXT DEFAULT 'USD',
  display_currency TEXT DEFAULT 'NGN',
  
  -- Stock
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  
  -- Media
  images TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- AI-enhanced content
  ai_description TEXT,
  ai_features TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product variants (size, color, etc.)
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  aliexpress_sku_id TEXT,
  
  -- Variant-specific pricing
  base_cost DECIMAL(12,2) NOT NULL,
  shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  buffer_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  profit_margin DECIMAL(5,4),
  customer_price DECIMAL(12,2) NOT NULL,
  
  stock_quantity INTEGER DEFAULT 0,
  attributes JSONB DEFAULT '{}',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ORDER SYSTEM
-- =============================================

-- Orders (immutable financial record)
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Status tracking
  status public.order_status NOT NULL DEFAULT 'created',
  
  -- Shipping address (snapshot at order time)
  shipping_address JSONB NOT NULL,
  
  -- Financial totals (stored, not computed)
  subtotal DECIMAL(12,2) NOT NULL,
  shipping_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(12,2) NOT NULL,
  
  -- Internal costs (admin only)
  total_cost DECIMAL(12,2) NOT NULL,
  total_profit DECIMAL(12,2) NOT NULL,
  
  -- Currency
  currency TEXT DEFAULT 'NGN',
  
  -- Supplier tracking
  aliexpress_order_id TEXT,
  tracking_number TEXT,
  carrier TEXT,
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  
  -- Timestamps
  paid_at TIMESTAMPTZ,
  sent_to_supplier_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Policy acceptance (for chargeback defense)
  policy_accepted_at TIMESTAMPTZ,
  terms_version TEXT,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  
  -- Snapshot at order time
  product_name TEXT NOT NULL,
  variant_name TEXT,
  product_image TEXT,
  
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Pricing snapshot (immutable)
  unit_price DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  line_cost DECIMAL(12,2) NOT NULL,
  line_profit DECIMAL(12,2) NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PAYMENT & TRANSACTION LEDGER
-- =============================================

-- Transactions (immutable ledger - NEVER UPDATE, ONLY INSERT)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Paystack data
  paystack_reference TEXT UNIQUE NOT NULL,
  paystack_transaction_id TEXT,
  
  -- Payment details
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status public.payment_status NOT NULL DEFAULT 'pending',
  
  -- Paystack fees (for auditing)
  paystack_fees DECIMAL(12,2) DEFAULT 0,
  net_amount DECIMAL(12,2),
  
  -- Payment method
  payment_method TEXT,
  payment_channel TEXT,
  card_type TEXT,
  last_four TEXT,
  bank TEXT,
  
  -- Metadata
  ip_address TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Immutable timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. REFUND SYSTEM
-- =============================================

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Refund type
  is_full_refund BOOLEAN DEFAULT false,
  
  -- Amounts
  refund_amount DECIMAL(12,2) NOT NULL,
  supplier_refund_amount DECIMAL(12,2) DEFAULT 0,
  platform_loss DECIMAL(12,2) DEFAULT 0, -- Profit we lose
  
  -- Bank details for refund
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  
  -- Status
  status public.refund_status NOT NULL DEFAULT 'pending',
  
  -- Reason
  reason TEXT,
  admin_notes TEXT,
  
  -- AliExpress dispute (if post-fulfillment)
  aliexpress_dispute_id TEXT,
  aliexpress_refund_status TEXT,
  
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. DISPUTES & CHARGEBACKS
-- =============================================

CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  -- Paystack dispute data
  paystack_dispute_id TEXT,
  
  -- Dispute details
  reason TEXT,
  customer_claim TEXT,
  
  -- Evidence (for auto-defense)
  evidence_compiled JSONB DEFAULT '{}',
  evidence_submitted_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'open',
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  
  -- Outcome
  won BOOLEAN,
  amount_recovered DECIMAL(12,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. CART (for logged-in users)
-- =============================================

CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id, variant_id)
);

-- 8. WISHLIST
-- =============================================

CREATE TABLE public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- 9. GLOBAL SETTINGS (for admin configuration)
-- =============================================

CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('default_profit_margin', '0.30', 'Default profit margin for new products (30%)'),
  ('buffer_fee_percentage', '0.05', 'Buffer fee for FX volatility (5%)'),
  ('low_stock_alert_threshold', '5', 'Alert when stock falls below this'),
  ('auto_fulfill_orders', 'true', 'Automatically send orders to AliExpress'),
  ('refund_window_days', '14', 'Days allowed for refund requests');

-- 10. FUNCTIONS
-- =============================================

-- Function to check user role (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'AC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 6));
  RETURN new_number;
END;
$$;

-- Function to calculate customer price
CREATE OR REPLACE FUNCTION public.calculate_customer_price(
  base_cost DECIMAL,
  shipping_cost DECIMAL,
  buffer_fee DECIMAL,
  profit_margin DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
DECLARE
  total_cost DECIMAL;
  profit DECIMAL;
  final_price DECIMAL;
BEGIN
  total_cost := base_cost + shipping_cost + buffer_fee;
  profit := total_cost * profit_margin;
  final_price := CEIL((total_cost + profit) * 100) / 100; -- Round UP
  RETURN final_price;
END;
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$;

-- 11. TRIGGERS
-- =============================================

-- Auto-update timestamps
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ADDRESSES policies
CREATE POLICY "Users can manage own addresses" ON public.addresses
  FOR ALL USING (auth.uid() = user_id);

-- CATEGORIES policies (public read)
CREATE POLICY "Anyone can view active categories" ON public.categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- SUPPLIERS policies (admin only)
CREATE POLICY "Admins can manage suppliers" ON public.suppliers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCTS policies (public read)
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCT_VARIANTS policies
CREATE POLICY "Anyone can view active variants" ON public.product_variants
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage variants" ON public.product_variants
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ORDERS policies
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all orders" ON public.orders
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ORDER_ITEMS policies
CREATE POLICY "Users can view own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage order items" ON public.order_items
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- TRANSACTIONS policies
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" ON public.transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- REFUNDS policies
CREATE POLICY "Users can view own refunds" ON public.refunds
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage refunds" ON public.refunds
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- DISPUTES policies (admin only)
CREATE POLICY "Admins can manage disputes" ON public.disputes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- CART_ITEMS policies
CREATE POLICY "Users can manage own cart" ON public.cart_items
  FOR ALL USING (auth.uid() = user_id);

-- WISHLIST_ITEMS policies
CREATE POLICY "Users can manage own wishlist" ON public.wishlist_items
  FOR ALL USING (auth.uid() = user_id);

-- SETTINGS policies (admin only)
CREATE POLICY "Admins can manage settings" ON public.settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read settings" ON public.settings
  FOR SELECT USING (true);

-- 13. INDEXES for performance
-- =============================================

CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_supplier ON public.products(supplier_id);
CREATE INDEX idx_products_slug ON public.products(slug);
CREATE INDEX idx_products_featured ON public.products(is_featured) WHERE is_featured = true;
CREATE INDEX idx_products_active ON public.products(is_active) WHERE is_active = true;

CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_number ON public.orders(order_number);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);

CREATE INDEX idx_transactions_order ON public.transactions(order_id);
CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_paystack_ref ON public.transactions(paystack_reference);

CREATE INDEX idx_cart_user ON public.cart_items(user_id);
CREATE INDEX idx_wishlist_user ON public.wishlist_items(user_id);

CREATE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);