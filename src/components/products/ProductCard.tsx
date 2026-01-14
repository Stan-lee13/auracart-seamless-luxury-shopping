import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingBag, Eye } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import type { Product } from '@/hooks/useProducts';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { addItem } = useCart();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    addItem({
      productId: product.id,
      name: product.name,
      price: product.customer_price,
      image: product.thumbnail_url || product.images?.[0] || '/placeholder.svg',
      quantity: 1,
    });
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
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
          <img
            src={product.thumbnail_url || product.images?.[0] || '/placeholder.svg'}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          
          {/* Overlay on hover */}
          <motion.div
            className="absolute inset-0 bg-black/20 flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              size="icon"
              variant="secondary"
              className="h-10 w-10 rounded-full glass-card"
              onClick={handleAddToCart}
            >
              <ShoppingBag className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-10 w-10 rounded-full glass-card"
              asChild
            >
              <Link to={`/product/${product.slug}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          {/* Wishlist Button */}
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              'absolute top-3 right-3 h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm',
              'hover:bg-background transition-colors',
              isWishlisted && 'text-red-500'
            )}
            onClick={handleWishlist}
          >
            <Heart className={cn('h-4 w-4', isWishlisted && 'fill-current')} />
          </Button>

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            {product.is_featured && (
              <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded">
                Featured
              </span>
            )}
            {product.stock_quantity !== null && product.stock_quantity < 10 && product.stock_quantity > 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-amber-500 text-white rounded">
                Low Stock
              </span>
            )}
            {product.stock_quantity === 0 && (
              <span className="px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded">
                Sold Out
              </span>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="mt-4 space-y-1">
          {product.category && (
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {product.category.name}
            </p>
          )}
          <h3 className="font-serif text-lg font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.short_description}
          </p>
          <p className="font-semibold text-lg price-display">
            {formatCurrency(product.customer_price)}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
