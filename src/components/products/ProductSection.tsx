import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles, Clock, Heart } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/hooks/useProducts';

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  products: Product[];
  isLoading?: boolean;
  icon?: 'trending' | 'new' | 'recommended';
  viewAllLink?: string;
  className?: string;
}

const iconMap = {
  trending: Sparkles,
  new: Clock,
  recommended: Heart,
};

export function ProductSection({
  title,
  subtitle,
  products,
  isLoading,
  icon,
  viewAllLink,
  className = '',
}: ProductSectionProps) {
  const Icon = icon ? iconMap[icon] : null;

  if (isLoading) {
    return (
      <section className={`py-8 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`py-8 ${className}`}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h2 className="font-serif text-2xl font-bold">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {viewAllLink && (
          <Link
            to={viewAllLink}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View All
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.slice(0, 8).map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <ProductCard product={product} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
