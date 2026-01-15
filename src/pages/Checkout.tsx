import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';

export default function Checkout() {
  const [email, setEmail] = React.useState('');
  const [amount, setAmount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();
  const cart = useCart();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        email,
        amount,
        line_items: cart.items.map(i => ({ product_name: i.name, unit_price: i.price, unit_cost: 0, quantity: i.quantity, product_id: i.productId, variant_id: i.variantId }))
      };
      const res = await fetch('/api/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      const authUrl = json?.init?.data?.authorization_url || json?.init?.authorization_url || json?.authorization_url || null;
      const reference = json?.order?.order_number || payload.reference || (json?.init?.data?.reference || null);
      if (authUrl) {
        localStorage.setItem('last_order_reference', reference || '');
        window.location.href = authUrl;
      } else if (reference) {
        navigate(`/order/${encodeURIComponent(reference)}`);
      } else {
        navigate('/account');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Checkout</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">Email</span>
          <input className="mt-1 block w-full" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>

        <label className="block">
          <span className="text-sm">Amount (NGN)</span>
          <input type="number" className="mt-1 block w-full" value={amount} onChange={e => setAmount(Number(e.target.value))} required />
        </label>

        <button className="btn btn-primary" disabled={loading} type="submit">
          {loading ? 'Processing...' : 'Pay with Paystack'}
        </button>
      </form>
    </div>
  );
}
