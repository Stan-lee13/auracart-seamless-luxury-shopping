ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS aliexpress_id TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_aliexpress_id ON public.categories(aliexpress_id);