import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

type Order = { id?: string; order_number?: string; grand_total?: number | string; status?: string; created_at?: string };

export default function Orders() {
  const { user, isLoading } = useAuth();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/orders');
      const j = await res.json();
      setOrders(j.data || []);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Your Orders</h1>
      <button className="btn mt-2 mb-4" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
      <table className="w-full">
        <thead><tr><th>order</th><th>total</th><th>status</th><th>created</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t">
              <td>{o.order_number}</td>
              <td>{o.grand_total}</td>
              <td>{o.status}</td>
              <td>{o.created_at ? new Date(o.created_at).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
