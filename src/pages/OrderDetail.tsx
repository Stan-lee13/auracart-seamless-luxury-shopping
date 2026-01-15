import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function OrderDetail() {
  const { id } = useParams();
  const { user, isLoading } = useAuth();
  type Item = { id?: string; product_name?: string; variant_name?: string; quantity?: number | string; unit_price?: number | string; line_total?: number | string };
  type Order = { order_number?: string; subtotal?: number | string; tax_total?: number | string; shipping_total?: number | string; discount_total?: number | string; grand_total?: number | string; status?: string };
  type Tx = { status?: string };

  const [order, setOrder] = React.useState<Order | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [tx, setTx] = React.useState<Tx | null>(null);

  React.useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const ref = decodeURIComponent(id);
        const res = await fetch(`/api/confirm?reference=${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${localStorage.getItem('supabase.auth.token') || ''}` } });
        const j = await res.json();
        setOrder(j.order || null);
        setItems(j.items || []);
        setTx(j.transaction || null);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }
    })();
  }, [id]);

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  if (!order) return <div className="p-4">Order not found.</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Order {order.order_number}</h1>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2">
          <h2 className="text-lg font-semibold">Items</h2>
          <ul className="mt-2">
            {items.map((it) => (
              <li key={it.id} className="border-b py-2 flex justify-between">
                <div>
                  <div className="font-semibold">{it.product_name}</div>
                  <div className="text-sm text-muted-foreground">{it.variant_name}</div>
                </div>
                <div className="text-right">
                  <div>{it.quantity} × {it.unit_price}</div>
                  <div className="text-sm">{it.line_total}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <aside className="col-span-1 bg-card p-4 rounded-lg">
          <h2 className="text-lg font-semibold">Summary</h2>
          <div className="mt-2">
            <div className="flex justify-between"><span>Subtotal</span><span>{order.subtotal}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{order.tax_total}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{order.shipping_total}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>-{order.discount_total}</span></div>
            <hr className="my-2" />
            <div className="flex justify-between font-semibold"><span>Total</span><span>{order.grand_total}</span></div>
            <div className="mt-2 text-sm text-muted-foreground">Status: {order.status}</div>
            {tx && <div className="mt-2 text-sm">Transaction status: {tx.status}</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
