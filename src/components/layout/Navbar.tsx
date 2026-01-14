import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, User, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function Navbar() {
  const { totalItems, setIsOpen } = useCart();
  const { user } = useAuth();
  const location = useLocation();

  // Hide navbar on landing page for logged-out users
  if (location.pathname === '/' && !user) {
    return null;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 nav-blur border-b border-border/50">
      <nav className="container-luxury">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link 
            to={user ? "/shop" : "/"} 
            className="flex items-center gap-2 group"
          >
            <motion.span 
              className="font-serif text-2xl md:text-3xl font-bold text-foreground"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              Aura<span className="text-primary">Cart</span>
            </motion.span>
          </Link>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full" asChild>
              <Link to="/wishlist">
                <Heart className="h-5 w-5" />
              </Link>
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full relative"
              onClick={() => setIsOpen(true)}
            >
              <ShoppingBag className="h-5 w-5" />
              {totalItems > 0 && (
                <motion.span 
                  key={totalItems}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs font-semibold rounded-full flex items-center justify-center"
                >
                  {totalItems > 99 ? '99+' : totalItems}
                </motion.span>
              )}
            </Button>

            <Button variant="ghost" size="icon" className="rounded-full" asChild>
              <Link to={user ? "/account" : "/auth"}>
                <User className="h-5 w-5" />
              </Link>
            </Button>

            <ThemeToggle />
          </div>

          {/* Mobile - just cart and theme (bottom nav handles the rest) */}
          <div className="flex md:hidden items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full relative"
              onClick={() => setIsOpen(true)}
            >
              <ShoppingBag className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs font-semibold rounded-full flex items-center justify-center">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Button>
            
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
}
