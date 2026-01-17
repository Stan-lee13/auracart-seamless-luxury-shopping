# AuraCart Setup Guide - Admin & Products

## 🔑 Admin Setup

### Step 1: Sign Up with Admin Email

Use one of these emails to create your admin account:

- `stanleyvic13@gmail.com`
- `stanleyvic14@gmail.com`

Go to the app and sign up with one of these emails.

### Step 2: Apply Admin Migration

Push the admin setup migration to your Supabase database:

```bash
# Using Supabase CLI
supabase db push

# Or if using psql directly
psql "$DATABASE_URL" -f supabase/migrations/20260116_setup_admin_and_products.sql
```

The migration will:
- ✅ Automatically detect your user account and grant admin role
- ✅ Create default suppliers
- ✅ Prepare the database for product sync

After this, you should see the **Admin Dashboard** at `/admin`

---

## 📦 Real Products from AliExpress

Instead of adding products manually, use the **automatic product sync worker**.

### Requirements

Make sure these environment variables are set in your `.env.local` or system environment:

```bash
# Supabase
SUPABASE_URL=https://mnuppunshelyjezumqtr.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here

# AliExpress API (from your AliExpress app)
ALIEXPRESS_API_KEY=your_api_key
ALIEXPRESS_API_SECRET=your_api_secret
```

### Sync Products

Run the product sync worker:

```bash
npm run sync:products
```

This will:
1. Search AliExpress for trending products in each category
2. Fetch product details (price, images, description)
3. Calculate pricing with your profit margin (40% default)
4. Insert products into your Supabase database
5. Continue syncing on schedule

**Output example:**
```
Starting AliExpress product sync
Searching AliExpress: category=jewelry-watches keyword=luxury watches
Product inserted: Luxury Diamond Watch - SKU: aliexpress-123456
Searching AliExpress: category=bags-luggage keyword=designer handbags
...
AliExpress product sync completed - synced: 45, failed: 2
```

### Customize Categories & Keywords

Edit the search keywords in `server/aliexpress_product_sync_worker.mjs`:

```javascript
const CATEGORY_KEYWORDS = {
  'jewelry-watches': ['luxury watches', 'diamond rings', 'premium timepieces'],
  'bags-luggage': ['designer handbags', 'luxury backpacks', 'premium luggage'],
  // Add more categories...
};
```

---

## 🎯 Product Pricing

The sync worker automatically calculates prices with:

| Component | Amount |
|-----------|--------|
| AliExpress Cost | From API |
| Shipping Cost | From API |
| Buffer Fee | 5% |
| Profit Margin | 40% |
| **Customer Price** | Displayed in NGN |

Example:
- AliExpress cost: $10
- Shipping: $3
- Buffer (5%): $0.65
- Profit (40% of $13.65): $5.46
- **Total: $19.11 (~₦12,000)**

---

## 🗓️ Scheduled Syncing

For production, set up a scheduled job to run product sync automatically:

### Option 1: Vercel Cron (if deployed on Vercel)

Create `.vercel/crons/sync-products.json`:

```json
{
  "path": "/api/cron/sync-products",
  "schedule": "0 */6 * * *"
}
```

### Option 2: GitHub Actions

Create `.github/workflows/sync-products.yml`:

```yaml
name: Sync AliExpress Products
on:
  schedule:
    - cron: '0 */6 * * *'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run sync:products
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          ALIEXPRESS_API_KEY: ${{ secrets.ALIEXPRESS_API_KEY }}
          ALIEXPRESS_API_SECRET: ${{ secrets.ALIEXPRESS_API_SECRET }}
```

### Option 3: Heroku Scheduler

```bash
heroku addons:create scheduler:standard
heroku addons:open scheduler
# Add job: npm run sync:products
```

---

## ✅ Verify Setup

After completing the setup:

1. **Admin Access:**
   - ✅ Log in with `stanleyvic13@gmail.com` or `stanleyvic14@gmail.com`
   - ✅ You should see **Admin Dashboard** in navbar
   - ✅ Access admin at `/admin/orders`, `/admin/refunds`, etc.

2. **Products:**
   - ✅ Go to `/shop` and see products
   - ✅ Products have images, prices, and descriptions
   - ✅ Can filter by category
   - ✅ Can search products

3. **Database:**
   - ✅ Check Supabase dashboard → products table
   - ✅ Should have 50+ products
   - ✅ Each product has supplier, pricing, and images

---

## 🐛 Troubleshooting

### Products not showing

1. Check sync ran successfully:
   ```bash
   npm run sync:products
   ```

2. Verify API keys are correct:
   ```bash
   echo $ALIEXPRESS_API_KEY
   echo $SUPABASE_SERVICE_KEY
   ```

3. Check Supabase logs:
   - Go to Supabase dashboard → Database → Query Editor
   - Run: `SELECT COUNT(*) FROM products;`
   - Should see more than 0

### Can't access admin

1. Verify you signed up with correct email (stanleyvic13@gmail.com)
2. Check `user_roles` table in Supabase:
   ```sql
   SELECT user_id, role FROM user_roles WHERE role = 'admin';
   ```
3. Clear browser cache and log out/back in

### Products have no images

1. Check AliExpress API is returning images
2. Verify image URLs are accessible
3. Check browser console for CORS errors

---

## 📚 API Reference

### Search Products Endpoint

```javascript
const aliExpress = new AliExpressClient(API_KEY, API_SECRET);

const result = await aliExpress.searchProducts('luxury watches', {
  limit: 20,
  offset: 0,
  sortBy: 'total_tranpro_cask' // popular products
});

// Returns: { items: [], total: 100 }
```

### Sync Worker Output

```json
{
  "msg": "AliExpress product sync completed",
  "totalSynced": 45,
  "totalFailed": 2,
  "timestamp": "2026-01-16T10:30:00Z"
}
```

---

## 💡 Next Steps

1. ✅ Run `npm run sync:products` to populate products
2. ✅ Log in as admin to verify access
3. ✅ Set up scheduled product sync (GitHub Actions recommended)
4. ✅ Configure profit margins based on your business model
5. ✅ Add more categories/keywords as needed
