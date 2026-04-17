import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, Eye, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserInteractions } from '@/hooks/useUserInteractions';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/hooks/useProducts';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const { addItem } = useCart();
  const { user } = useAuth();
  const { trackCartAddition } = useUserInteractions();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setIsWishlisted(false);
      return;
    }

    const loadWishlistState = async () => {
      const { data } = await supabase
        .from('wishlist_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      setIsWishlisted(!!data);
    };

    void loadWishlistState();
  }, [user, product.id]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/auth?redirect=' + encodeURIComponent(`/product/${product.slug}`));
      return;
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: product.customer_price,
      image: product.thumbnail_url || product.images?.[0] || '',
      quantity: 1,
    });

    trackCartAddition(product.id, product.category_id || undefined);
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/auth?redirect=' + encodeURIComponent(`/product/${product.slug}`));
      return;
    }

    if (isWishlistLoading) return;

    setIsWishlistLoading(true);
    try {
      if (isWishlisted) {
        const { error } = await supabase
          .from('wishlist_items')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);

        if (error) throw error;
        setIsWishlisted(false);
        toast.success('Removed from wishlist');
      } else {
        const { error } = await supabase
          .from('wishlist_items')
          .insert({ user_id: user.id, product_id: product.id });

        if (error) throw error;
        setIsWishlisted(true);
        toast.success('Added to wishlist');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update wishlist');
    } finally {
      setIsWishlistLoading(false);
    }
  };

  const handleView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/product/${product.slug}`);
  };

  return (
    <motion.div
      className={cn('group relative', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
          {product.thumbnail_url || product.images?.[0] ? (
            <img
              src={product.thumbnail_url || product.images?.[0] || ''}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-muted flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/20" />
            </div>
          )}

          <div className={cn(
            'absolute inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 flex items-center justify-center gap-2',
            isHovered ? 'opacity-100' : 'opacity-0',
          )}>
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full shadow-lg hover:scale-110 transition-transform"
              onClick={handleView}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="rounded-full shadow-lg hover:scale-110 transition-transform"
              onClick={handleAddToCart}
            >
              <ShoppingBag className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className={cn(
                'rounded-full shadow-lg hover:scale-110 transition-transform',
                isWishlisted && 'text-red-500',
              )}
              onClick={handleWishlist}
              disabled={isWishlistLoading}
            >
              <Heart className={cn('h-4 w-4', isWishlisted && 'fill-current')} />
            </Button>
          </div>

          {product.is_featured && (
            <div className="absolute top-2 left-2">
              <span className="bg-primary/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                Elite
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-1 px-1">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {product.category?.name || 'Collection'}
          </p>
          <div className="flex items-center justify-between pt-1">
            <p className="font-semibold text-primary">
              {formatCurrency(product.customer_price)}
            </p>
            {product.is_featured && (
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Featured
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
