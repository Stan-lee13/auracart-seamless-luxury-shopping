import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Package, MapPin, Heart, Settings, LogOut, ChevronRight, Trash2, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Address = Tables<'addresses'>;

type AddressForm = {
  label: string;
  full_name: string;
  phone: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

const EMPTY_ADDRESS_FORM: AddressForm = {
  label: '',
  full_name: '',
  phone: '',
  street_address: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Nigeria',
};

export default function Account() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressForm>(EMPTY_ADDRESS_FORM);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAddressForm((prev) => ({
        ...prev,
        full_name: prev.full_name || profile.full_name || '',
        phone: prev.phone || profile.phone || '',
      }));
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;

    const fetchAddresses = async () => {
      setIsLoadingAddresses(true);
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load addresses:', error);
        toast.error('Unable to load addresses');
      } else {
        setAddresses(data || []);
      }
      setIsLoadingAddresses(false);
    };

    void fetchAddresses();
  }, [user]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      const { error } = await updateProfile({
        full_name: fullName,
        phone,
      });
      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const refreshAddresses = async () => {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error) {
      setAddresses(data || []);
    }
  };

  const handleSaveAddress = async () => {
    if (!addressForm.full_name || !addressForm.phone || !addressForm.street_address || !addressForm.city || !addressForm.state) {
      toast.error('Please complete all required address fields');
      return;
    }

    setIsSavingAddress(true);
    try {
      const isFirstAddress = addresses.length === 0;
      const { error } = await supabase.from('addresses').insert({
        user_id: user.id,
        ...addressForm,
        is_default: isFirstAddress,
        postal_code: addressForm.postal_code || null,
        label: addressForm.label || null,
      });

      if (error) throw error;
      toast.success('Address saved successfully');
      setAddressForm({
        ...EMPTY_ADDRESS_FORM,
        full_name: fullName || '',
        phone: phone || '',
      });
      setShowAddressForm(false);
      await refreshAddresses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save address');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to delete address');
      return;
    }

    toast.success('Address removed');
    await refreshAddresses();
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    const { error: unsetError } = await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', user.id);

    if (unsetError) {
      toast.error('Failed to update default address');
      return;
    }

    const { error: setError } = await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', addressId)
      .eq('user_id', user.id);

    if (setError) {
      toast.error('Failed to set default address');
      return;
    }

    toast.success('Default address updated');
    await refreshAddresses();
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/');
  };

  const getInitials = () => {
    if (fullName) {
      return fullName.split(' ').map((n) => n[0]).join('').toUpperCase();
    }
    return user.email?.[0].toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-serif text-2xl font-bold">
                {profile?.full_name || 'Welcome'}
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </motion.div>

        <Tabs defaultValue="profile" className="space-y-6 md:space-y-8">
          <TabsList className="bg-muted/50 p-1 w-full flex overflow-x-auto no-scrollbar justify-start md:justify-center h-auto">
            <TabsTrigger value="profile" className="gap-2 flex-shrink-0 py-2 px-4">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 flex-shrink-0 py-2 px-4">
              <Package className="h-4 w-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="addresses" className="gap-2 flex-shrink-0 py-2 px-4">
              <MapPin className="h-4 w-4" />
              Addresses
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="gap-2 flex-shrink-0 py-2 px-4">
              <Heart className="h-4 w-4" />
              Wishlist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user.email || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 xxx xxx xxxx" />
                  </div>
                  <Button onClick={handleUpdateProfile} disabled={isUpdating}>{isUpdating ? 'Saving...' : 'Save Changes'}</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account Settings</CardTitle>
                  <CardDescription>Manage your account preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Link to="/forgot-password" className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-muted-foreground" />
                      <span>Change Password</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                  <button onClick={handleSignOut} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                    <div className="flex items-center gap-3">
                      <LogOut className="h-5 w-5" />
                      <span>Sign Out</span>
                    </div>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>View and track your orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">View all orders</h3>
                  <p className="text-muted-foreground text-sm mb-4">Track and manage your orders from the dedicated page.</p>
                  <Button asChild><Link to="/orders">View Orders</Link></Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="addresses">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Saved Addresses</CardTitle>
                  <CardDescription>Manage your shipping addresses</CardDescription>
                </div>
                <Button onClick={() => setShowAddressForm((prev) => !prev)}>
                  <Plus className="h-4 w-4 mr-1" /> {showAddressForm ? 'Cancel' : 'Add Address'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {showAddressForm && (
                  <div className="border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input placeholder="Label (Home, Office)" value={addressForm.label} onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))} />
                    <Input placeholder="Full name" value={addressForm.full_name} onChange={(e) => setAddressForm((prev) => ({ ...prev, full_name: e.target.value }))} />
                    <Input placeholder="Phone" value={addressForm.phone} onChange={(e) => setAddressForm((prev) => ({ ...prev, phone: e.target.value }))} />
                    <Input placeholder="Street address" value={addressForm.street_address} onChange={(e) => setAddressForm((prev) => ({ ...prev, street_address: e.target.value }))} />
                    <Input placeholder="City" value={addressForm.city} onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))} />
                    <Input placeholder="State" value={addressForm.state} onChange={(e) => setAddressForm((prev) => ({ ...prev, state: e.target.value }))} />
                    <Input placeholder="Postal code" value={addressForm.postal_code} onChange={(e) => setAddressForm((prev) => ({ ...prev, postal_code: e.target.value }))} />
                    <Input placeholder="Country" value={addressForm.country} onChange={(e) => setAddressForm((prev) => ({ ...prev, country: e.target.value }))} />
                    <div className="md:col-span-2">
                      <Button onClick={handleSaveAddress} disabled={isSavingAddress}>{isSavingAddress ? 'Saving...' : 'Save Address'}</Button>
                    </div>
                  </div>
                )}

                {isLoadingAddresses ? (
                  <p className="text-muted-foreground">Loading addresses...</p>
                ) : addresses.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No addresses saved</h3>
                    <p className="text-muted-foreground text-sm">Add a shipping address for faster checkout.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((address) => (
                      <div key={address.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium flex items-center gap-2">
                            {address.label || 'Address'}
                            {address.is_default && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Default</span>}
                          </p>
                          <p className="text-sm">{address.full_name}</p>
                          <p className="text-sm text-muted-foreground">{address.street_address}, {address.city}, {address.state}</p>
                          <p className="text-sm text-muted-foreground">{address.phone}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!address.is_default && (
                            <Button variant="outline" size="sm" onClick={() => handleSetDefaultAddress(address.id)}>Set Default</Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteAddress(address.id)} aria-label="Delete address">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wishlist">
            <Card>
              <CardHeader>
                <CardTitle>My Wishlist</CardTitle>
                <CardDescription>Items you've saved for later</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">Manage your wishlist</h3>
                  <p className="text-muted-foreground text-sm mb-4">View saved items on your dedicated wishlist page.</p>
                  <Button asChild><Link to="/wishlist">Open Wishlist</Link></Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
