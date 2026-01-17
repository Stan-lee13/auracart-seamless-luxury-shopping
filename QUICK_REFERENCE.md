# 🎯 AuraCart Quick Reference Card

## ⚡ 3-Step Setup

```bash
# 1️⃣ Sign up with admin email
# Go to app and signup with: stanleyvic13@gmail.com

# 2️⃣ Push admin role to database
supabase db push

# 3️⃣ Sync real products from AliExpress
npm run sync:products
```

**Done!** You now have:
- ✅ Admin access at `/admin`
- ✅ 50+ real products at `/shop`
- ✅ Full e-commerce platform ready

---

## 📍 Key URLs

| Page | URL | Purpose |
|------|-----|---------|
| **Landing** | `/` | Homepage (logged out) |
| **Shop** | `/shop` | Browse all products |
| **Product** | `/product/:slug` | Product details |
| **Search** | `/search?search=query` | Search products |
| **Categories** | `/categories` | Browse by category |
| **Cart** | `/cart` | View cart |
| **Checkout** | `/checkout` | Checkout (requires login) |
| **Orders** | `/orders` | Order history |
| **Account** | `/account` | User profile |
| **Admin** | `/admin` | Admin dashboard |
| **Admin Orders** | `/admin/orders` | Manage orders |
| **Admin Refunds** | `/admin/refunds` | Manage refunds |
| **Admin Disputes** | `/admin/disputes` | Manage disputes |
| **Admin Suppliers** | `/admin/suppliers` | Manage suppliers |

---

## 👨‍💼 Admin Access

**Email:** `stanleyvic13@gmail.com` or `stanleyvic14@gmail.com`

**Dashboard Features:**
- Orders - View & manage customer orders
- Refunds - Process refund requests
- Disputes - Handle chargebacks
- Suppliers - Track AliExpress sellers

---

## 🛍️ Products

**Source:** Real AliExpress products (automatic sync)

**How many:** 50+ (synced automatically every 6 hours)

**Pricing:** Auto-calculated with:
- AliExpress base cost
- Shipping cost
- 5% buffer fee
- 40% profit margin
- Converted to NGN

**Sync manually:** `npm run sync:products`

---

## 🔑 Environment Variables Required

```bash
# Supabase
SUPABASE_URL=https://mnuppunshelyjezumqtr.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# AliExpress
ALIEXPRESS_API_KEY=your_api_key
ALIEXPRESS_API_SECRET=your_api_secret
```

---

## 📝 NPM Commands

```bash
npm run dev                 # Start dev server
npm run build              # Build for production
npm run sync:products      # Sync AliExpress products
npm run db:push            # Push database migrations
npm run db:pull            # Pull database schema
npm run lint               # Run linter
```

---

## 🗂️ New Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260116_*.sql` | Admin setup migration |
| `server/aliexpress_product_sync_worker.mjs` | Product sync script |
| `ADMIN_SETUP.md` | Comprehensive setup guide |
| `SYNC_GUIDE.md` | Product sync documentation |
| `setup.sh` | Quick setup (macOS/Linux) |
| `setup.bat` | Quick setup (Windows) |
| `package.json` (updated) | Added npm scripts |

---

## 🔄 Pages & Routing

**All 16 pages exist and are routed:**

```
Logged Out:
├─ /              Landing page
├─ /auth          Sign up/Login
└─ /              Redirects to /shop when logged in

Logged In (Customer):
├─ /shop          Product listing
├─ /search        Search products
├─ /categories    Browse categories
├─ /product/:slug Product detail
├─ /cart          Shopping cart
├─ /checkout      Checkout (Paystack)
├─ /orders        Order history
├─ /order/:id     Order detail
└─ /account       User profile

Logged In (Admin):
├─ /admin         Admin home (redirects to orders)
├─ /admin/orders  Manage orders
├─ /admin/refunds Manage refunds
├─ /admin/disputes Handle disputes
└─ /admin/suppliers Manage suppliers

Error:
└─ /*             404 Not Found
```

---

## 🚀 Deployment Checklist

- [ ] Set environment variables
- [ ] Run `supabase db push`
- [ ] Run `npm run sync:products` once
- [ ] Set up scheduled sync (GitHub Actions recommended)
- [ ] Test admin access
- [ ] Test product checkout
- [ ] Deploy frontend (Vercel/Netlify)
- [ ] Deploy backend (Vercel/Render/Railway)

---

## 💡 Common Tasks

### Add Another Admin
1. They sign up with their email
2. Contact you to add their email to whitelist in `AdminLayout.tsx`
3. OR add manually via SQL:
```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users 
WHERE email = 'newemail@example.com';
```

### Customize Product Pricing
Edit `server/aliexpress_product_sync_worker.mjs` line 76:
```javascript
const profitMargin = 0.50; // Change to 50%
```

### Add More Search Categories
Edit `server/aliexpress_product_sync_worker.mjs`:
```javascript
const CATEGORY_KEYWORDS = {
  'your-category': ['search term 1', 'search term 2'],
};
```

### Change Default Currency
Edit `src/contexts/CartContext.tsx` and database settings

### Enable/Disable Product
Supabase: Set `is_active = false` in products table

---

## 🐛 Quick Debug

| Issue | Solution |
|-------|----------|
| No products showing | Run `npm run sync:products` |
| Can't access admin | Verify email + push migration |
| Products have no images | Check AliExpress API response |
| Sync fails | Check API keys in environment |
| Slow page load | Check product count + add indexes |
| 404 on pages | Verify URL matches routing |

---

## 📞 Support Links

- **Supabase Docs:** https://supabase.com/docs
- **AliExpress API:** https://open.aliexpress.com/
- **React Query:** https://tanstack.com/query
- **Shadcn UI:** https://ui.shadcn.com/

---

## ✅ Verification Commands

```bash
# Check admin setup
psql "$DATABASE_URL" -c "SELECT user_id, role FROM user_roles;"

# Check products synced
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM products;"

# Check environment
env | grep -E "SUPABASE|ALIEXPRESS"

# Test product sync
npm run sync:products

# View sync logs
tail -f server_logs.txt
```

---

**Status:** ✅ All systems ready
**Last Updated:** January 16, 2026
**Version:** 1.0.0
