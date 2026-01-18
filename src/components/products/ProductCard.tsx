import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, Eye, Image as ImageIcon } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserInteractions } from '@/hooks/useUserInteractions';
import type { Product } from '@/hooks/useProducts';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { addItem } = useCart();
  const { user } = useAuth();
  const { trackCartAddition } = useUserInteractions();
  const navigate = useNavigate();

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

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/auth');
      return;
    }

    setIsWishlisted(!isWishlisted);
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
        {/* Image Container */}
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

          {/* Quick Actions Overlay */}
          <div className={cn(
            'absolute inset-0 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 flex items-center justify-center gap-2',
            isHovered ? 'opacity-100' : 'opacity-0'
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
                "rounded-full shadow-lg hover:scale-110 transition-transform",
                isWishlisted && "text-red-500"
              )}
              onClick={handleWishlist}
            >
              <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
            </Button>
          </div>

          {/* New/Featured Badge */}
          {product.is_featured && (
            <div className="absolute top-2 left-2">
              <span className="bg-primary/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                Elite
              </span>
            </div>
          )}
        </div>

        {/* Info */}
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
            {(product as any).metadata?.discount && (
              <p className="text-[10px] line-through text-muted-foreground">
                {(product as any).metadata.original_price}
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
