import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Truck, ExternalLink, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState<Tables<'suppliers'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [aliStatus, setAliStatus] = useState<'unknown' | 'inactive' | 'active' | 'expired' | 'error'>('unknown');
  const [aliAccount, setAliAccount] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string>('');
  const isAliConnected = aliStatus === 'active';
  const [aliConfig, setAliConfig] = useState<{ appKey: string; appSecret: string }>({ appKey: '', appSecret: '' });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const fetchAliConfig = React.useCallback(async () => {
    try {
      const { data } = await supabase.from('settings').select('value').eq('key', 'aliexpress_config').maybeSingle();
      if (data?.value && typeof data.value === 'object' && !Array.isArray(data.value)) {
        const value = data.value as Record<string, unknown>;
        setAliConfig({
          appKey: typeof value.app_key === 'string' ? value.app_key : '',
          appSecret: typeof value.app_secret === 'string' ? value.app_secret : '',
        });
      }
    } catch (err) { console.error('Error fetching Ali config:', err); }
  }, []);

  const handleSaveConfig = async () => {
    if (!aliConfig.appKey || !aliConfig.appSecret) { toast.error('App Key and Secret are required'); return; }
    setIsSavingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-aliexpress-config', {
        body: { appKey: aliConfig.appKey, appSecret: aliConfig.appSecret }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('AliExpress credentials saved successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration';
      toast.error(message);
    } finally { setIsSavingConfig(false); }
  };

  const checkAliConnection = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.from('settings').select('value').eq('key', 'aliexpress_tokens').maybeSingle();
      if (error) throw error;
      const val = data?.value as Record<string, unknown> | null;
      if (!val || typeof val.access_token !== 'string') {
        setAliStatus('inactive');
        setAliAccount('');
        return;
      }
      setAliAccount(typeof val.account === 'string' ? val.account : (typeof val.user_nick === 'string' ? val.user_nick : ''));
      const expiresAt = typeof val.access_token_expires_at === 'string' ? new Date(val.access_token_expires_at) : null;
      if (expiresAt && expiresAt.getTime() < Date.now()) {
        setAliStatus('expired');
      } else {
        setAliStatus('active');
      }
    } catch {
      setAliStatus('error');
    }
  }, []);

  const fetchSuppliers = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('sla_score', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSuppliers(data || []);
    } catch (e) {
      console.error('Failed to fetch suppliers', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchSuppliers();
    checkAliConnection();
    fetchAliConfig();

    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const errorParam = params.get('error');
    const directCode = params.get('code');

    if (status === 'connected') {
      toast.success('AliExpress account connected successfully!');
      setTimeout(() => checkAliConnection(), 1500);
      window.history.replaceState({}, '', '/admin/suppliers');
    } else if (status === 'error') {
      toast.error(`Connection failed: ${errorParam || 'Unknown error'}`);
      window.history.replaceState({}, '', '/admin/suppliers');
    }

    if (directCode) {
      (async () => {
        try {
          const { data: cfgData } = await supabase.from('settings').select('value').eq('key', 'aliexpress_config').maybeSingle();
          const config = cfgData?.value as { app_key?: string; app_secret?: string } | null;
          if (!config?.app_key) { toast.error('Save your AliExpress App Key first.'); return; }
          const { data, error } = await supabase.functions.invoke('aliexpress-auth-callback', { body: { code: directCode, state: window.location.origin } });
          if (error) { toast.error(`OAuth failed: ${error.message}`); return; }
          if (data?.success) { toast.success('AliExpress connected!'); setTimeout(() => checkAliConnection(), 1500); }
          window.history.replaceState({}, '', '/admin/suppliers');
        } catch { toast.error('OAuth failed'); }
      })();
    }
  }, [fetchSuppliers, checkAliConnection, fetchAliConfig]);

  const handleConnectAliExpress = () => {
    if (!aliConfig.appKey) { toast.error('Save your AliExpress App Key first.'); return; }
    // Persist viewport mode so we restore it after returning from AliExpress
    const isMobile = window.innerWidth < 768;
    localStorage.setItem('userDeviceMode', isMobile ? 'mobile' : 'desktop');
    const redirectUri = `${window.location.origin}/api/aliexpress/callback`;
    const state = encodeURIComponent(window.location.origin);
    window.location.href = `https://api-sg.aliexpress.com/oauth/authorize?response_type=code&client_id=${aliConfig.appKey}&redirect_uri=${encodeURIComponent(redirectUri)}&sp=ae&state=${state}`;
  };

  const handleImportProducts = async () => {
    setIsImporting(true);
    setImportMessage('Contacting AliExpress…');
    toast.info('Starting AliExpress product import…');
    try {
      const { data, error } = await supabase.functions.invoke('import-products', { body: { limit: 20 } });
      if (error) throw new Error(error.message);
      if (data?.success === false) throw new Error(data.error || 'Import failed');
      const imported = data?.imported ?? 0;
      const errs: string[] = data?.errors || [];
      if (imported > 0) {
        toast.success(`Imported ${imported} product${imported === 1 ? '' : 's'} from AliExpress.`);
        setImportMessage(`Last sync: ${imported} imported${errs.length ? `, ${errs.length} errors` : ''}`);
      } else {
        const detail = errs[0] ? ` First error: ${errs[0]}` : '';
        toast.error(`No products imported.${detail}`);
        setImportMessage(`No products imported.${detail}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to import products.';
      toast.error(msg);
      setImportMessage(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const currentRedirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/api/aliexpress/callback`
    : 'https://auracart-com.lovable.app/api/aliexpress/callback';

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2"><Truck className="h-6 w-6 text-primary" /> Supplier Management</h2>
          <p className="text-muted-foreground mt-1">Monitor supplier performance and AliExpress integration</p>
        </div>
        <Button variant="outline" onClick={fetchSuppliers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
        </Button>
      </div>

      {/* AliExpress Integration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle className="text-lg">AliExpress Connection</CardTitle><CardDescription>Authorize API access</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-white/40 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10 mb-4">
              <div className="flex items-center gap-3">
                {isAliConnected ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-amber-500" />}
                <div><p className="font-medium text-sm">Status</p><p className="text-xs text-muted-foreground">{isAliConnected ? 'Connected' : 'Not Connected'}</p></div>
              </div>
              <Badge variant="outline" className={isAliConnected ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-100 text-amber-800 border-amber-200"}>
                {isAliConnected ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
            </div>
            <div className="space-y-4">
              <Button onClick={handleConnectAliExpress} className="w-full btn-luxury" variant={isAliConnected ? "outline" : "default"}>
                <ExternalLink className="h-4 w-4 mr-2" /> {isAliConnected ? 'Reconnect' : 'Connect AliExpress'}
              </Button>
              <div className="p-3 bg-muted/30 rounded-lg text-[10px] font-mono break-all border border-border">
                <p className="text-muted-foreground mb-1 uppercase tracking-tighter">Redirect URI:</p>
                <p className="select-all">{currentRedirectUri}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">API Configuration</CardTitle><CardDescription>Enter your Application Keys</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <label className="font-medium block">App Key</label>
              <input type="text" value={aliConfig.appKey} onChange={(e) => setAliConfig(prev => ({ ...prev, appKey: e.target.value }))} placeholder="AliExpress App Key" className="w-full p-2 rounded-md border border-input bg-background text-foreground text-sm" />
            </div>
            <div className="space-y-2 text-sm">
              <label className="font-medium block">App Secret</label>
              <input type="password" value={aliConfig.appSecret} onChange={(e) => setAliConfig(prev => ({ ...prev, appSecret: e.target.value }))} placeholder="AliExpress App Secret" className="w-full p-2 rounded-md border border-input bg-background text-foreground text-sm" />
            </div>
            <Button onClick={handleSaveConfig} disabled={isSavingConfig} className="w-full" variant="outline">
              {isSavingConfig ? 'Saving...' : 'Save Configuration'}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-accent/20 bg-accent/5">
          <CardHeader><CardTitle className="text-lg">Global Catalog</CardTitle><CardDescription>Synchronize real products</CardDescription></CardHeader>
          <CardContent>
            <Button onClick={handleImportProducts} disabled={!isAliConnected || isImporting} className="w-full" variant="secondary">
              {isImporting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {isImporting ? 'Importing...' : 'Sync Catalog'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers Table */}
      <Card className="glass-card">
        <CardHeader><CardTitle>Supplier Performance</CardTitle></CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No suppliers yet. Connect AliExpress to start.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>SLA Score</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Avg Delivery</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.sla_score ?? '—'}</TableCell>
                      <TableCell>{s.total_orders ?? 0}</TableCell>
                      <TableCell>{s.rating ?? '—'}</TableCell>
                      <TableCell>{s.avg_delivery_days ? `${s.avg_delivery_days} days` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={s.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-muted text-muted-foreground'}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
