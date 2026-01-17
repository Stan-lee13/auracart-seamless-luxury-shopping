import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategories } from '@/hooks/useProducts';

interface ShopSidebarProps {
    currentCategory?: string;
    className?: string;
}

export function ShopSidebar({ currentCategory, className }: ShopSidebarProps) {
    const { data: categories = [], isLoading } = useCategories();

    if (isLoading) {
        return (
            <div className={cn("w-full space-y-4", className)}>
                <Skeleton className="h-8 w-1/2 mb-6" />
                {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                ))}
            </div>
        );
    }

    return (
        <aside className={cn("hidden lg:block w-64 flex-shrink-0", className)}>
            <div className="sticky top-24">
                <h2 className="font-serif text-xl font-bold mb-6">Collections</h2>

                <ScrollArea className="h-[calc(100vh-12rem)] pr-4">
                    <div className="space-y-1">
                        <Button
                            variant={!currentCategory ? "secondary" : "ghost"}
                            className={cn(
                                "w-full justify-start text-base font-normal",
                                !currentCategory && "bg-primary/10 text-primary font-medium"
                            )}
                            asChild
                        >
                            <Link to="/shop">All Products</Link>
                        </Button>

                        {categories.map((category) => (
                            <Button
                                key={category.id}
                                variant={currentCategory === category.slug ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start text-base font-normal",
                                    currentCategory === category.slug && "bg-primary/10 text-primary font-medium"
                                )}
                                asChild
                            >
                                <Link to={`/shop?category=${category.slug}`}>
                                    {category.name}
                                </Link>
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        </aside>
    );
}
