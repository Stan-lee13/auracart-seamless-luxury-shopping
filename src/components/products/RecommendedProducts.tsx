import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useUserInteractions } from '@/hooks/useUserInteractions';
import { ProductCard } from './ProductCard';
import { Skeleton } from '@/components/ui/skeleton';

interface RecommendedProductsProps {
  title?: string;
  subtitle?: string;
  limit?: number;
  excludeProductId?: string;
}

export function RecommendedProducts({ 
  title = "Recommended for You",
  subtitle = "Curated based on your preferences",
  limit = 4,
  excludeProductId
}: RecommendedProductsProps) {
  const { getTopCategories, getRecentlyViewed } = useUserInteractions();
  const { data: products = [], isLoading } = useProducts({});
  
  const topCategories = getTopCategories(3);
  const recentlyViewed = getRecentlyViewed(10);

  const recommendedProducts = useMemo(() => {
    if (!products.length) return [];

    // Score products based on user preferences
    const scored = products
      .filter(p => p.id !== excludeProductId)
      .map(product => {
        let score = 0;
        
        // Category affinity scoring
        if (product.category_id && topCategories.includes(product.category_id)) {
          const categoryIndex = topCategories.indexOf(product.category_id);
          score += (3 - categoryIndex) * 10; // Higher score for more viewed categories
        }
        
        // Recently viewed boost (but not exact matches - those go in "recently viewed" section)
        if (!recentlyViewed.includes(product.id)) {
          // Check if similar category was viewed
          if (product.category_id && recentlyViewed.some(viewedId => {
            const viewedProduct = products.find(p => p.id === viewedId);
            return viewedProduct?.category_id === product.category_id;
          })) {
            score += 5;
          }
        }
        
        // Featured products get a small boost
        if (product.is_featured) {
          score += 3;
        }
        
        // In-stock products preferred
        if ((product.stock_quantity ?? 0) > 0) {
          score += 2;
        }
        
        // Newer products get slight preference
        const daysSinceCreation = (Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation < 30) {
          score += 2;
        }
        
        // Add some randomness to keep it fresh
        score += Math.random() * 3;
        
        return { product, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ product }) => product);

    return recommendedProducts;
  }, [products, topCategories, recentlyViewed, excludeProductId, limit]);

  if (isLoading) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] rounded-lg" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!recommendedProducts.length) {
    return null;
  }

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl md:text-2xl font-bold">{title}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {recommendedProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Specific themed recommendation sections
export function InspiredByAura({ excludeProductId }: { excludeProductId?: string }) {
  return (
    <RecommendedProducts
      title="Inspired by Your Aura"
      subtitle="Pieces that complement your unique style"
      limit={4}
      excludeProductId={excludeProductId}
    />
  );
}

export function BecauseYouViewed({ productName, excludeProductId }: { productName: string; excludeProductId?: string }) {
  return (
    <RecommendedProducts
      title={`Because You Viewed ${productName}`}
      subtitle="Similar items you might love"
      limit={4}
      excludeProductId={excludeProductId}
    />
  );
}
