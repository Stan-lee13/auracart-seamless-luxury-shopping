import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Grid3X3, Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Home', href: '/shop' },
  { icon: Grid3X3, label: 'Categories', href: '/categories' },
  { icon: Search, label: 'Search', href: '/search' },
  { icon: ShoppingBag, label: 'Cart', href: '/cart', showBadge: true },
  { icon: User, label: 'Account', href: '/account', authAware: true },
];

export function MobileBottomNav() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const location = useLocation();
  const { totalItems, setIsOpen } = useCart();
  const { user } = useAuth();
  const scrollRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDiff = currentScrollY - scrollRef.current;
      
      // Show on scroll up, hide on scroll down (with threshold)
      if (scrollDiff > 10) {
        setIsVisible(false);
      } else if (scrollDiff < -10) {
        setIsVisible(true);
      }
      
      // Always show at top of page
      if (currentScrollY < 50) {
        setIsVisible(true);
      }
      
      scrollRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Don't show on landing page for logged-out users
  if (location.pathname === '/' && !user) {
    return null;
  }

  // Don't show on auth page
  if (location.pathname === '/auth') {
    return null;
  }

  const handleCartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(true);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        >
          <div className="mx-2 mb-2 rounded-2xl bg-background/95 backdrop-blur-lg border border-border shadow-lg">
            <div className="flex items-center justify-around py-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href || 
                  (item.href === '/shop' && location.pathname === '/');
                const href = item.authAware && !user ? '/auth' : item.href;
                
                if (item.href === '/cart') {
                  return (
                    <button
                      key={item.label}
                      onClick={handleCartClick}
                      className={cn(
                        'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors relative',
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      )}
                    >
                      <div className="relative">
                        <item.icon className="h-5 w-5" />
                        {totalItems > 0 && (
                          <span className="absolute -top-2 -right-2 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full flex items-center justify-center">
                            {totalItems > 9 ? '9+' : totalItems}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    to={href}
                    className={cn(
                      'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
