-- Setup admin users and initial product sync
-- This migration sets up the admin roles for the AuraCart platform

-- Step 1: Add admin users to user_roles table
-- These emails will have access to the admin dashboard
-- Note: Users must sign up first, then this grants them admin role

-- Admin Email: stanleyvic13@gmail.com
-- This SQL assumes the user has already signed up
-- To apply this, the user must exist in auth.users first

-- Get the user IDs for our admin emails and grant them admin role
-- We use a safe approach that only updates if the user exists

DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Try to grant admin role to stanleyvic13@gmail.com
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'stanleyvic13@gmail.com' LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role granted to stanleyvic13@gmail.com';
  ELSE
    RAISE NOTICE 'User stanleyvic13@gmail.com not found in auth.users. Please sign up first.';
  END IF;

  -- Try to grant admin role to stanleyvic14@gmail.com
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'stanleyvic14@gmail.com' LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin role granted to stanleyvic14@gmail.com';
  ELSE
    RAISE NOTICE 'User stanleyvic14@gmail.com not found in auth.users. Please sign up first.';
  END IF;
END $$;

-- Step 2: Create initial suppliers (empty, will be populated by sync worker)
INSERT INTO public.suppliers (name, aliexpress_seller_id, rating, is_active)
VALUES 
  ('AliExpress Default', 'aliexpress_default', 4.5, true),
  ('Premium Suppliers', 'premium_suppliers', 4.8, true)
ON CONFLICT (aliexpress_seller_id) DO NOTHING;

-- Step 3: Insert some sample products structure (without data - data comes from AliExpress API)
-- This ensures the products table structure is ready for the sync worker
-- Sample: Fashion category
INSERT INTO public.categories (name, slug, description, display_order, is_active)
VALUES 
  ('Luxury Watches', 'luxury-watches', 'Premium watches and timepieces', 100, true)
ON CONFLICT (slug) DO NOTHING;

-- Commit and output status
SELECT 'Admin users configured. Ready for product sync.' as status;
