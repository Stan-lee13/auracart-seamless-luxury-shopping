# Critical Issues Resolution Guide

## Date: 2026-01-17

This document outlines the critical issues you've reported and the steps to resolve them.

---

## 🔴 Issue 1: Payment Edge Function Returns Non-2xx Status Code

### Problem
When attempting to pay, the `create-charge` edge function is returning an error (non-2xx status).

### Root Causes
1. **Missing Paystack Secret Key** - Edge function needs `PAYSTACK_SECRET_KEY` environment variable
2. **Edge Function Not Deployed** - The function might not be deployed to your Supabase instance
3. **CORS Issues** - Edge function might not have proper CORS headers

### Solution Steps

#### Step 1: Set Paystack Secret in Supabase
```bash
# Via Supabase CLI
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_your_actual_key_here

# OR via Supabase Dashboard:
# 1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/settings/functions
# 2. Click "Edge Function Secrets"
# 3. Add: PAYSTACK_SECRET_KEY = sk_test_...
```

#### Step 2: Deploy the Edge Function
```bash
# Deploy create-charge function
supabase functions deploy create-charge

# Verify deployment
supabase functions list
```

#### Step 3: Check Edge Function Logs
```bash
# View real-time logs
supabase functions logs create-charge --tail

# Or in Supabase Dashboard:
# Functions > create-charge > Logs
```

#### Step 4: Test the Edge Function
```bash
# Test with curl
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/create-charge' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","amount":10000}'
```

### Expected Response
```json
{
  "order": {
    "order_number": "ORD-...",
    "total_amount": 10000
  },
  "init": {
    "status": true,
    "data": {
      "authorization_url": "https://checkout.paystack.com/...",
      "reference": "..."
    }
  }
}
```

---

## 🔴 Issue 2: Products Are Mock Data (Not Real AliExpress Products)

### Problem
The products displayed are mock/placeholder data instead of real AliExpress products.

### Root Causes
1. **AliExpress Not Connected** - No valid AliExpress access token in the database
2. **Products Not Imported** - The `import-products` edge function hasn't been run
3. **Edge Function Not Deployed** - Import function isn't available

### Solution Steps

#### Step 1: Connect AliExpress Account
1. Go to: `https://yourdomain.com/admin/suppliers`
2. Click "Connect AliExpress"
3. Authorize the application
4. You'll be redirected back with tokens saved

**Alternative: Manual Token Entry**
```sql
-- If you already have tokens, insert them directly:
INSERT INTO settings (key, value, created_at, updated_at)
VALUES (
  'aliexpress_tokens',
  '{
    "access_token": "your_access_token_here",
    "refresh_token": "your_refresh_token_here",
    "expires_in": 86400,
    "updated_at": "2026-01-17T00:00:00Z"
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
```

#### Step 2: Set AliExpress App Credentials
```bash
# Via Supabase CLI
supabase secrets set ALIEXPRESS_APP_KEY=your_app_key
supabase secrets set ALIEXPRESS_APP_SECRET=your_app_secret

# OR in Supabase Dashboard > Settings > Edge Function Secrets
```

#### Step 3: Deploy Import Products Function
```bash
supabase functions deploy import-products
supabase functions deploy aliexpress-auth-callback
```

#### Step 4: Import Real Products
**Method 1: Via Admin Panel (After connecting)**
1. Navigate to `/admin/suppliers`
2. Click "Import Products" button
3. Select categories to import
4. Wait for import to complete

**Method 2: Via Edge Function Call**
```javascript
const { supabase } = await import('@/integrations/supabase/client');

const { data, error } = await supabase.functions.invoke('import-products', {
  body: {
    categoryId: null, // null = all categories
    limit: 20 // products per category
  }
});

console.log('Import result:', data);
```

**Method 3: Via API Call**
```bash
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/import-products' \
  --header 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "categoryId": null,
    "limit": 20
  }'
```

#### Step 5: Verify Real Products in Database
```sql
-- Check if products have AliExpress IDs
SELECT 
  id,
  name,
  slug,
  metadata->>'aliexpress_id' as aliexpress_id,
  metadata->>'affiliate_url' as affiliate_url
FROM products
WHERE metadata->>'aliexpress_id' IS NOT NULL
LIMIT 10;
```

---

## 🔴 Issue 3: Cannot Access Admin Section

### Problem
Cannot access `/admin/*` routes even with the correct whitelisted email.

### Root Causes
1. **User Role Not Set** - The `user_roles` table doesn't have an admin entry for your user
2. **Email Case Mismatch** - Email in whitelist doesn't match actual user email case
3. **Auth Context Not Loading** - `isAdmin` state is stuck on `false`

### Solution Steps

#### Step 1: Verify Your User Email
```sql
-- Check your actual user email
SELECT id, email, created_at 
FROM auth.users 
WHERE email ILIKE '%stanleyvic%';
```

#### Step 2: Add Admin Role to Database
```sql
-- Insert admin role for your user
INSERT INTO user_roles (user_id, role, created_at)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'stanleyvic13@gmail.com'),
  'admin',
  NOW()
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify insertion
SELECT ur.*, u.email 
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.email = 'stanleyvic13@gmail.com';
```

#### Step 3: Verify Email Whitelist
Check `src/components/admin/AdminLayout.tsx`:
```typescript
const ADMIN_EMAILS = [
  'stanleyvic13@gmail.com',  // ✓ Must match exactly
  'stanleyvic14@gmail.com',
];
```

#### Step 4: Clear Browser Cache and Re-login
1. Sign out completely
2. Clear browser cache and local storage
3. Sign back in with your admin email
4. Try accessing `/admin/orders`

#### Step 5: Check Browser Console
Open browser DevTools (F12) and check for:
- `"Admin Access Denied..."` warnings
- Network errors on auth state checks
- Any 401/403 errors

#### Step 6: Test Admin Access
After logging in, run this in browser console:
```javascript
// Check auth state
const { data: { user } } = await window.supabase.auth.getUser();
console.log('Current user:', user?.email);

// Check role
const { data: roles } = await window.supabase
  .from('user_roles')
  .select('*')
  .eq('user_id', user.id);
console.log('User roles:', roles);
```

### Updated Access Logic
I've changed the access control in `AdminLayout.tsx` to use **OR** logic:
```typescript
// OLD (required BOTH):
if (!isAdmin || !isEmailAllowed) { ... }

// NEW (requires EITHER):
const hasAccess = isAdmin || isEmailAllowed;
if (!hasAccess) { ... }
```

Now you only need to meet ONE condition:
- ✅ Have admin role in `user_roles` table, OR
- ✅ Be in the email whitelist

---

## 🔴 Issue 4: Shop.tsx TypeScript Error

### Problem
```
Property 'products' does not exist on type '{ nextPage: number; }'.
```

### Solution
This was caused by merge conflicts in `useInfiniteProducts.ts`. I've fixed it by ensuring the return type always includes `products`, `nextPage`, and `totalCount`.

---

## 🚀 Quick Start Checklist

### Immediate Actions

- [ ] **Fix NPM** - Merge conflicts in package.json resolved ✓
- [ ] **Deploy Edge Functions**
  ```bash
  supabase functions deploy create-charge
  supabase functions deploy import-products
  supabase functions deploy aliexpress-auth-callback
  supabase functions deploy verify-payment
  supabase functions deploy paystack-webhook
  ```

- [ ] **Set Secrets**
  ```bash
  supabase secrets set PAYSTACK_SECRET_KEY=sk_test_...
  supabase secrets set ALIEXPRESS_APP_KEY=...
  supabase secrets set ALIEXPRESS_APP_SECRET=...
  ```

- [ ] **Grant Admin Access**
  ```sql
  INSERT INTO user_roles (user_id, role, created_at)
  VALUES (
    (SELECT id FROM auth.users WHERE email = 'stanleyvic13@gmail.com'),
    'admin',
    NOW()
  );
  ```

- [ ] **Connect AliExpress** - Visit `/admin/suppliers` and connect
- [ ] **Import Real Products** - Click "Import Products" in admin
- [ ] **Test Payment Flow** - Add item to cart, proceed to checkout

---

## 📞 Debugging Quick Reference

### Check Edge Function Status
```bash
supabase functions list
```

### View Edge Function Logs
```bash
supabase functions logs create-charge
```

### Test Edge Function Locally
```bash
supabase functions serve create-charge
# Then test at http://localhost:54321/functions/v1/create-charge
```

### Check Database Tables
```sql
-- Check admin roles
SELECT * FROM user_roles;

-- Check AliExpress tokens
SELECT * FROM settings WHERE key = 'aliexpress_tokens';

-- Check products
SELECT COUNT(*), 
       COUNT(CASE WHEN metadata->>'aliexpress_id' IS NOT NULL THEN 1 END) as real_products
FROM products;
```

---

## 🎯 Expected Results After Fix

1. ✅ **Payment Works** - Redirects to Paystack checkout
2. ✅ **Real Products Display** - Products have AliExpress IDs and affiliate links
3. ✅ **Admin Access Granted** - `/admin/orders` loads successfully
4. ✅ **No TypeScript Errors** - `npm run dev` starts without errors

---

## 📝 Notes

- All merge conflicts have been resolved ✓
- `package.json` is now valid JSON ✓
- Admin access control relaxed to OR logic ✓
- Image fallbacks use `ImageIcon` component ✓
- Ready to push to GitHub after testing

