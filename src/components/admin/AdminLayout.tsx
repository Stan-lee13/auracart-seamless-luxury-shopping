import React from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BackButton } from '@/components/navigation/BackButton';
import { 
  LayoutDashboard, 
  Package, 
  RefreshCcw, 
  AlertTriangle, 
  Truck,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { path: '/admin/orders', label: 'Orders', icon: Package },
  { path: '/admin/refunds', label: 'Refunds', icon: RefreshCcw },
  { path: '/admin/disputes', label: 'Disputes', icon: AlertTriangle },
  { path: '/admin/suppliers', label: 'Suppliers', icon: Truck },
];

export default function AdminLayout() {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-16 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container-luxury py-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container-luxury py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="glass-card p-4 space-y-2 lg:sticky lg:top-36">
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                      'hover:bg-primary/10',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-foreground'
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                  <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
                </NavLink>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
