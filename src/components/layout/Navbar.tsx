import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Search, User, Menu, X, Heart } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/categories', label: 'Categories' },
  { href: '/about', label: 'About' },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { totalItems, setIsOpen } = useCart();
  const { user } = useAuth();
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 nav-blur border-b border-border/50">
      <nav className="container-luxury">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link 
            to="/" 
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

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "text-sm font-medium animated-underline transition-colors",
                  location.pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Search className="h-5 w-5" />
            </Button>
            
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

          {/* Mobile Menu Button */}
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
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-full"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-b border-border"
          >
            <div className="container-luxury py-4 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block py-2 text-lg font-medium transition-colors",
                    location.pathname === link.href
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              
              <div className="flex items-center gap-4 pt-4 border-t border-border">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Search className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full" asChild>
                  <Link to="/wishlist">
                    <Heart className="h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full" asChild>
                  <Link to={user ? "/account" : "/auth"}>
                    <User className="h-5 w-5" />
                  </Link>
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
