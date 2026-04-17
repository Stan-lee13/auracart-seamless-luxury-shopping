import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Loader2, Save, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

type Product = Tables<'products'>;

const blankProduct: TablesInsert<'products'> = {
  name: '',
  slug: '',
  description: '',
  base_cost: 0,
  shipping_cost: 0,
  buffer_fee: 0,
  profit_margin: 0.3,
  customer_price: 0,
  stock_quantity: 0,
  is_active: true,
  is_featured: false,
  images: [],
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function calcCustomerPrice(p: Pick<TablesInsert<'products'>, 'base_cost' | 'shipping_cost' | 'buffer_fee' | 'profit_margin'>) {
  const cost = Number(p.base_cost || 0) + Number(p.shipping_cost || 0) + Number(p.buffer_fee || 0);
  return Math.ceil(cost * (1 + Number(p.profit_margin || 0)) * 100) / 100;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TablesInsert<'products'>>(blankProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imagesText, setImagesText] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setEditing(blankProduct);
    setEditingId(null);
    setImagesText('');
    setOpen(true);
  }

  function startEdit(p: Product) {
    setEditing({
      name: p.name,
      slug: p.slug,
      description: p.description || '',
      short_description: p.short_description || '',
      base_cost: p.base_cost,
      shipping_cost: p.shipping_cost,
      buffer_fee: p.buffer_fee,
      profit_margin: p.profit_margin,
      customer_price: p.customer_price,
      stock_quantity: p.stock_quantity ?? 0,
      is_active: p.is_active ?? true,
      is_featured: p.is_featured ?? false,
      thumbnail_url: p.thumbnail_url || '',
      images: p.images || [],
    });
    setEditingId(p.id);
    setImagesText((p.images || []).join('\n'));
    setOpen(true);
  }

  async function save() {
    if (!editing.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const slug = editing.slug || slugify(editing.name);
      const images = imagesText.split('\n').map(s => s.trim()).filter(Boolean);
      const customer_price = calcCustomerPrice(editing);
      const payload: TablesInsert<'products'> = {
        ...editing,
        slug,
        images,
        thumbnail_url: editing.thumbnail_url || images[0] || null,
        customer_price,
      };

      if (editingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Product updated');
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
        toast.success('Product created');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', p.id);
      if (error) throw error;
      toast.success('Product deleted');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Products</h2>
          <p className="text-muted-foreground mt-1">Create, edit, and manage your catalog</p>
        </div>
        <Button onClick={startNew} className="btn-luxury">
          <Plus className="h-4 w-4 mr-2" /> New product
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle>All products ({products.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : products.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No products yet. Create one or import from AliExpress.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.thumbnail_url ? (
                          <img src={p.thumbnail_url} alt={p.name} className="h-12 w-12 rounded object-cover" />
                        ) : (
                          <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-xs truncate">{p.name}</TableCell>
                      <TableCell className="price-display">₦{Number(p.customer_price).toLocaleString()}</TableCell>
                      <TableCell>{p.stock_quantity ?? 0}</TableCell>
                      <TableCell>{p.is_active ? '✓' : '—'}</TableCell>
                      <TableCell className="space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit product' : 'New product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value, slug: editing.slug || slugify(e.target.value) })} />
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input value={editing.slug} onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })} />
            </div>
            <div>
              <Label>Short description</Label>
              <Input value={editing.short_description || ''} onChange={e => setEditing({ ...editing, short_description: e.target.value })} />
            </div>
            <div>
              <Label>Full description</Label>
              <Textarea rows={4} value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Base cost (USD)</Label>
                <Input type="number" step="0.01" value={editing.base_cost} onChange={e => setEditing({ ...editing, base_cost: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Shipping cost</Label>
                <Input type="number" step="0.01" value={editing.shipping_cost} onChange={e => setEditing({ ...editing, shipping_cost: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Buffer fee</Label>
                <Input type="number" step="0.01" value={editing.buffer_fee} onChange={e => setEditing({ ...editing, buffer_fee: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Profit margin (e.g. 0.30)</Label>
                <Input type="number" step="0.01" value={editing.profit_margin} onChange={e => setEditing({ ...editing, profit_margin: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="bg-muted/50 p-3 rounded">
              <Label className="text-xs">Auto-calculated customer price</Label>
              <p className="font-semibold text-lg price-display">₦{calcCustomerPrice(editing).toLocaleString()}</p>
            </div>
            <div>
              <Label>Stock quantity</Label>
              <Input type="number" value={editing.stock_quantity ?? 0} onChange={e => setEditing({ ...editing, stock_quantity: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Image URLs (one per line)</Label>
              <Textarea rows={3} value={imagesText} onChange={e => setImagesText(e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={!!editing.is_active} onCheckedChange={v => setEditing({ ...editing, is_active: v })} />
                <Label>Active (visible in shop)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!editing.is_featured} onCheckedChange={v => setEditing({ ...editing, is_featured: v })} />
                <Label>Featured</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}><X className="h-4 w-4 mr-2" />Cancel</Button>
              <Button onClick={save} disabled={saving} className="btn-luxury">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
