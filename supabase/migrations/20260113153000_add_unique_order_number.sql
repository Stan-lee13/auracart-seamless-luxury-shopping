-- Add unique constraint to ensure orders.order_number is unique (idempotency)
-- This migration adds a unique index/constraint on orders.order_number.
-- Run with supabase migrations apply or psql against the DB.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE c.contype = 'u' AND t.relname = 'orders'
        AND EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = t.oid AND a.attname = 'order_number'
        )
    ) THEN
        ALTER TABLE public.orders
        ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);
    END IF;
END$$;
