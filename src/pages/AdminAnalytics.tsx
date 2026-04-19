import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ShoppingCart, DollarSign, Package, Users, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface Stats {
  totalRevenue: number;
  totalOrders: number;
  totalProfit: number;
  pendingOrders: number;
  totalProducts: number;
  lowStockProducts: number;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
}

export default function AdminAnalytics() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [ordersRes, productsRes, itemsRes] = await Promise.all([
          supabase.from('orders').select('id, grand_total, total_profit, status, created_at, paid_at').gte('created_at', thirtyDaysAgo.toISOString()),
          supabase.from('products').select('id, stock_quantity, low_stock_threshold'),
          supabase.from('order_items').select('product_name, quantity, line_total, order_id').limit(1000),
        ]);

        const orders = ordersRes.data || [];
        const products = productsRes.data || [];
        const items = itemsRes.data || [];

        const paidOrders = orders.filter(o => ['paid', 'sent_to_supplier', 'fulfilled', 'shipped', 'delivered'].includes(o.status as string));
        const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
        const totalProfit = paidOrders.reduce((sum, o) => sum + Number(o.total_profit || 0), 0);
        const pendingOrders = orders.filter(o => o.status === 'paid' || o.status === 'sent_to_supplier').length;
        const lowStockProducts = products.filter(p => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 5)).length;

        // Group revenue by day
        const dayMap = new Map<string, { revenue: number; orders: number }>();
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          dayMap.set(key, { revenue: 0, orders: 0 });
        }
        paidOrders.forEach(o => {
          const key = (o.paid_at || o.created_at).slice(0, 10);
          if (dayMap.has(key)) {
            const cur = dayMap.get(key)!;
            cur.revenue += Number(o.grand_total || 0);
            cur.orders += 1;
          }
        });
        const revenueByDay = Array.from(dayMap.entries()).map(([date, v]) => ({
          date: date.slice(5),
          revenue: Math.round(v.revenue),
          orders: v.orders,
        }));

        // Top products
        const productMap = new Map<string, { quantity: number; revenue: number }>();
        items.forEach(it => {
          const cur = productMap.get(it.product_name) || { quantity: 0, revenue: 0 };
          cur.quantity += it.quantity;
          cur.revenue += Number(it.line_total || 0);
          productMap.set(it.product_name, cur);
        });
        const topProducts = Array.from(productMap.entries())
          .map(([name, v]) => ({ name: name.slice(0, 25), ...v }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        setStats({
          totalRevenue,
          totalOrders: orders.length,
          totalProfit,
          pendingOrders,
          totalProducts: products.length,
          lowStockProducts,
          revenueByDay,
          topProducts,
        });
      } catch (e) {
        console.error('analytics load failed:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="animate-pulse text-muted-foreground p-8">Loading analytics...</div>;
  }

  if (!stats) {
    return <div className="text-muted-foreground p-8">Unable to load analytics.</div>;
  }

  const cards = [
    { label: 'Revenue (30d)', value: `₦${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-600' },
    { label: 'Profit (30d)', value: `₦${Math.round(stats.totalProfit).toLocaleString()}`, icon: TrendingUp, color: 'text-primary' },
    { label: 'Orders (30d)', value: stats.totalOrders.toString(), icon: ShoppingCart, color: 'text-blue-600' },
    { label: 'Pending Fulfillment', value: stats.pendingOrders.toString(), icon: Package, color: 'text-orange-600' },
    { label: 'Total Products', value: stats.totalProducts.toString(), icon: Users, color: 'text-purple-600' },
    { label: 'Low Stock Alerts', value: stats.lowStockProducts.toString(), icon: AlertCircle, color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Performance overview for the last 30 days</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                </div>
                <c.icon className={`h-8 w-8 ${c.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle>Revenue (Last 30 Days)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle>Top Products by Revenue</CardTitle></CardHeader>
        <CardContent>
          {stats.topProducts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No sales data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.topProducts}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
