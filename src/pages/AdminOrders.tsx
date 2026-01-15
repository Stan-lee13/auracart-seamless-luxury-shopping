import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

type Refund = { id?: string; order_id?: string; refund_amount?: number; status?: string };
type Dispute = { id?: string; order_id?: string; provider_ref?: string; status?: string };
type Order = { id?: string; order_number?: string; grand_total?: number | string; status?: string; created_at?: string };

export default function AdminOrders() {
  const { isAdmin, isLoading } = useAuth();
  const [refunds, setRefunds] = React.useState<Refund[]>([]);
  const [disputes, setDisputes] = React.useState<Dispute[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  async function load() {
    setLoading(true);
    try {
      const r0 = await fetch('/api/admin/orders');
      const j0 = await r0.json();
      setOrders(j0.data || []);
      const r1 = await fetch('/api/admin/refunds');
      const j1 = await r1.json();
      setRefunds(j1.data || []);

      const r2 = await fetch('/api/admin/disputes');
      const j2 = await r2.json();
      setDisputes(j2.data || []);
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
  if (!isAdmin) return <Navigate to="/auth" replace />;

  async function issueRefund(refundAmount: number, orderId: string) {
    try {
      const res = await fetch('/api/admin/refunds/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, refund_amount: refundAmount }),
      });
      const j = await res.json();
      // eslint-disable-next-line no-console
      console.log('refund issued', j);
      load();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Admin — Refunds & Disputes</h1>
      <button className="btn mt-2 mb-4" onClick={load} disabled={loading}>
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>

      <section className="mb-6">
        <h2 className="text-xl font-semibold">Refunds</h2>
        <table className="w-full mt-2">
          <thead>
            <tr>
              <th>id</th>
              <th>order_id</th>
              <th>amount</th>
              <th>status</th>
              <th>action</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((r) => (
              <tr key={r.id} className="border-t">
                <td>{r.id}</td>
                <td>{r.order_id}</td>
                <td>{r.refund_amount}</td>
                <td>{r.status}</td>
                <td>{r.status === 'requested' ? <button className="btn btn-sm" onClick={() => issueRefund(r.refund_amount || 0, r.order_id || '')}>Issue Refund</button> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Disputes</h2>
        <table className="w-full mt-2">
          <thead>
            <tr>
              <th>id</th>
              <th>order_id</th>
              <th>provider_ref</th>
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {disputes.map((d) => (
              <tr key={d.id} className="border-t">
                <td>{d.id}</td>
                <td>{d.order_id}</td>
                <td>{d.provider_ref}</td>
                <td>{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Orders</h2>
        <table className="w-full mt-2">
          <thead>
            <tr>
              <th>id</th>
              <th>order_number</th>
              <th>grand_total</th>
              <th>status</th>
              <th>created_at</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td>{o.id}</td>
                <td>{o.order_number}</td>
                <td>{o.grand_total}</td>
                <td>{o.status}</td>
                <td>{o.created_at ? new Date(o.created_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
