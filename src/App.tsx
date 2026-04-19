import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { MobileBottomNav } from "@/components/navigation/MobileBottomNav";
import { SearchFiltersBar } from "@/components/search/SearchFiltersBar";
import Landing from "./pages/Landing";
import Shop from "./pages/Shop";
import Categories from "./pages/Categories";
import Product from "./pages/Product";
import Cart from "./pages/Cart";
import Auth from "./pages/Auth";
import Account from "./pages/Account";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Wishlist from "./pages/Wishlist";
import StaticPage from "./pages/StaticPage";
import AdminLayout from "./components/admin/AdminLayout";
import AdminOrders from "./pages/AdminOrders";
import AdminProducts from "./pages/AdminProducts";
import AdminRefunds from "./pages/AdminRefunds";
import AdminDisputes from "./pages/AdminDisputes";
import AdminSuppliers from "./pages/AdminSuppliers";
import AdminAnalytics from "./pages/AdminAnalytics";
import NotFound from "./pages/NotFound";
import { useViewportRestore } from "@/hooks/useViewportRestore";

const queryClient = new QueryClient();

// Route guard component
function AuthAwareRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/shop" replace />;
  }

  return <>{children}</>;
}

// Protected route - requires auth
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  useViewportRestore();
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <SearchFiltersBar />
      <main className="flex-1 pt-16 md:pt-20 pb-20 md:pb-0">
        <Routes>
          {/* Landing */}
          <Route path="/" element={<AuthAwareRoute><Landing /></AuthAwareRoute>} />

          {/* Public */}
          <Route path="/shop" element={<Shop />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/search" element={<Shop />} />
          <Route path="/wishlist" element={<Wishlist />} />

          {/* Auth */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Static pages */}
          <Route path="/contact" element={<StaticPage />} />
          <Route path="/faq" element={<StaticPage />} />
          <Route path="/shipping" element={<StaticPage />} />
          <Route path="/returns" element={<StaticPage />} />
          <Route path="/track-order" element={<StaticPage />} />
          <Route path="/about" element={<StaticPage />} />
          <Route path="/privacy" element={<StaticPage />} />
          <Route path="/terms" element={<StaticPage />} />

          {/* Protected */}
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/order/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/analytics" replace />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="refunds" element={<AdminRefunds />} />
            <Route path="disputes" element={<AdminDisputes />} />
            <Route path="suppliers" element={<AdminSuppliers />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <MobileBottomNav />
      <CartDrawer />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
