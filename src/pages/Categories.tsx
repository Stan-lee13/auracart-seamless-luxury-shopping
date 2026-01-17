import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useCategories } from '@/hooks/useProducts';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/navigation/BackButton';

export default function Categories() {
  const { data: categories = [], isLoading } = useCategories();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="relative py-12 bg-gradient-to-b from-muted/50 to-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-6">
            <BackButton />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">
              All Categories
            </h1>
            <p className="text-muted-foreground text-lg">
              Browse our complete collection organized by category
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <Link
                  to={`/shop?category=${category.slug}`}
                  className="group flex items-center justify-between p-5 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/20 transition-all duration-300"
                >
                  <div className="flex-1">
                    <h2 className="font-medium text-lg group-hover:text-primary transition-colors">
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {category.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && categories.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No categories available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
