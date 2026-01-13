-- Fix function search paths for security

-- Fix generate_order_number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'AC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 6));
  RETURN new_number;
END;
$$;

-- Fix calculate_customer_price
CREATE OR REPLACE FUNCTION public.calculate_customer_price(
  base_cost DECIMAL,
  shipping_cost DECIMAL,
  buffer_fee DECIMAL,
  profit_margin DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;