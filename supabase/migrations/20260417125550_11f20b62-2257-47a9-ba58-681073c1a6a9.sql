CREATE OR REPLACE FUNCTION public.decrement_stock_for_order(_order_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products p
  SET stock_quantity = GREATEST(0, COALESCE(p.stock_quantity, 0) - oi.quantity)
  FROM public.order_items oi
  WHERE oi.order_id = _order_id
    AND oi.product_id = p.id;
END;
$$;