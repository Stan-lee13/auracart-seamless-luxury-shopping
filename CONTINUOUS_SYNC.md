# Continuous Product Sync Guide

## Overview

The product sync worker now runs **continuously every 30 minutes**, automatically fetching **100+ new/different products** per sync cycle from AliExpress.

**Key Features:**
- ✅ Runs every 30 minutes automatically
- ✅ Pulls 100+ unique products per sync
- ✅ Multiple search keywords per category
- ✅ Multiple pages per keyword (3 offsets)
- ✅ 20 products per request
- ✅ Keeps products fresh and varied

---

## 3 Ways to Run Continuous Sync

### Option 1: Standalone Node Process (Simplest)

```bash
# Terminal 1: Run the sync daemon continuously
npm run sync:products

# This will:
# - Start syncing immediately
# - Sync every 30 minutes
# - Keep running until you press Ctrl+C
# - Log all activity to console
```

**Best for:** Local development, testing

---

### Option 2: Docker Container (Production)

```bash
# Build and run in Docker
docker-compose up -d product-sync

# View logs
docker-compose logs -f product-sync

# Stop the service
docker-compose down product-sync
```

**Best for:** Production deployments, cloud hosting

---

### Option 3: Background Process with PM2 (Recommended)

```bash
# Install PM2 globally (one time)
npm install -g pm2

# Start sync worker with PM2
pm2 start server/aliexpress_product_sync_worker.mjs --name "product-sync"

# View logs
pm2 logs product-sync

# Monitor resources
pm2 monit

# Stop the worker
pm2 stop product-sync

# Restart the worker
pm2 restart product-sync

# View all running processes
pm2 list

# Start on system boot (Linux/Mac)
pm2 startup
pm2 save
```

**Best for:** Production servers, always-on syncing

---

## What Gets Synced

### Per Sync Cycle:
- **Categories:** All active categories
- **Keywords per category:** 8 keywords
- **Pages per keyword:** 3 pages (offset)
- **Products per page:** 20 products
- **Total per cycle:** 8 × 3 × 20 = **480+ products**
- **After deduplication:** 100-300 unique new/updated products
- **Frequency:** Every 30 minutes

### Example:
```
Category: jewelry-watches
├── Keyword 1: luxury watches → 20 products
├── Keyword 1: luxury watches (page 2) → 20 products
├── Keyword 1: luxury watches (page 3) → 20 products
├── Keyword 2: diamond rings → 20 products
└── ... (continues for all keywords)

Result: 100+ new/different products added to your store
```

---

## Configuration

### Customize Sync Interval

**Default:** 30 minutes (1800000 milliseconds)

```bash
# Sync every 15 minutes
SYNC_INTERVAL=900000 npm run sync:products

# Sync every hour
SYNC_INTERVAL=3600000 npm run sync:products

# Sync every 6 hours
SYNC_INTERVAL=21600000 npm run sync:products
```

### Add/Modify Search Keywords

Edit `server/aliexpress_product_sync_worker.mjs`:

```javascript
const CATEGORY_KEYWORDS = {
  'jewelry-watches': [
    'luxury watches',           // ← Keyword 1
    'diamond rings',            // ← Keyword 2
    'premium timepieces',       // ← Keyword 3
    'gold watches',             // ← Add more keywords
    'elegant jewelry',
    'silver jewelry',
    'custom rings',
    'bracelet watches',
  ],
  // Add more categories...
};
```

**More keywords = More product variety**

### Adjust Products Per Request

Edit line 151 in the sync worker:

```javascript
const searchResult = await aliExpress.searchProducts(keyword, {
  limit: 20,  // ← Change this number (max 20)
  offset: offset * 20,
  sortBy: 'total_tranpro_cask',
});
```

### Change Profit Margin

Edit line 107:

```javascript
const profitMargin = 0.40; // ← Change from 40% to your desired margin
```

---

## Monitoring & Logs

### View Live Logs

```bash
# If using npm directly
npm run sync:products
# Logs appear in terminal

# If using PM2
pm2 logs product-sync

# If using Docker
docker-compose logs -f product-sync
```

### Log Format

```json
{
  "msg": "Product inserted",
  "name": "Luxury Diamond Watch",
  "timestamp": "2026-01-16T10:30:45Z",
  "level": "debug"
}
```

### Example Output

```
Starting AliExpress product sync [timestamp]
Searching AliExpress: category=jewelry-watches, keyword=luxury watches, offset=0
Product inserted: Luxury Diamond Watch
Product inserted: Gold Bracelet Watch
...
Product updated: Premium Timepiece
Searching AliExpress: category=jewelry-watches, keyword=diamond rings, offset=0
...
AliExpress product sync completed
Total synced: 145
Total failed: 3
Timestamp: 2026-01-16T10:30:45Z
```

---

## Verify Sync is Working

### Check Database

```bash
# In Supabase SQL Editor, run:
SELECT 
  COUNT(*) as total_products,
  MAX(created_at) as last_added,
  COUNT(DISTINCT category_id) as categories
FROM products
WHERE is_active = true;
```

Expected output:
```
total_products | last_added              | categories
--------|----------------------|----------
500+    | 2026-01-16 10:30:45 | 28
```

### Check Logs for Errors

```bash
# Look for sync runs
pm2 logs product-sync | grep "completed"

# Check for failures
pm2 logs product-sync | grep "error"
```

### Monitor Database Growth

```bash
# Check how many products were added
SELECT DATE(created_at), COUNT(*) 
FROM products 
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;
```

---

## Deployment Options

### Vercel Cron (Serverless)

Create `.vercel/crons/sync-products.json`:

```json
{
  "path": "/api/cron/sync-products",
  "schedule": "*/30 * * * *"
}
```

### AWS Lambda (Every 30 min)

```bash
# Use AWS CloudWatch Events to trigger Lambda every 30 minutes
# Lambda should run: node server/aliexpress_product_sync_worker.mjs
# Set environment variables in Lambda configuration
```

### GitHub Actions (Every 30 min)

Create `.github/workflows/sync-products.yml`:

```yaml
name: Sync Products Every 30 Minutes
on:
  schedule:
    - cron: '*/30 * * * *'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run sync:products:once
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          ALIEXPRESS_API_KEY: ${{ secrets.ALIEXPRESS_API_KEY }}
          ALIEXPRESS_API_SECRET: ${{ secrets.ALIEXPRESS_API_SECRET }}
```

### Heroku Scheduler

```bash
# Add free Heroku Scheduler add-on
heroku addons:create scheduler:standard

# Add job to run every 30 minutes
heroku addons:open scheduler

# In Scheduler UI, add task:
# Command: npm run sync:products:once
# Frequency: Every 30 minutes
```

### Railway / Render (VPS)

```bash
# Deploy as always-running background worker
# Set start command: npm run sync:products

# Railway automatically keeps it running
# Logs visible in dashboard
```

---

## Troubleshooting

### Sync Not Running

```bash
# Check if process is running
pm2 list

# Check logs for errors
pm2 logs product-sync

# Verify environment variables
echo $ALIEXPRESS_API_KEY
echo $SUPABASE_URL
```

### No New Products

```bash
# Check if sync is finding products
pm2 logs product-sync | grep "Product inserted"

# Verify API keys are valid
# Check AliExpress API quota

# Check database permissions
psql "$DATABASE_URL" -c "SELECT * FROM products LIMIT 1;"
```

### Too Slow

```bash
# Increase interval between API calls
# Edit line 139 in sync worker: setTimeout(resolve, 500)

# Or reduce products per request
# Edit line 151: limit: 20 → limit: 10

# Or reduce keywords per category
# Edit CATEGORY_KEYWORDS object
```

### Rate Limited

```bash
# API returns error: "rate_limit_exceeded"

# Solution 1: Increase delays
# Edit line 139: 500 → 2000 (500ms → 2000ms)

# Solution 2: Reduce requests
# Edit line 151: limit: 20 → limit: 5
```

---

## Pricing Calculation (Per Product)

```
AliExpress Base Cost:    $10.00
+ Shipping Cost:          $3.00
+ Buffer Fee (5%):        $0.65
+ Profit Margin (40%):    $5.46
─────────────────────────────────
= Customer Price:        $19.11 (~₦12,000)
```

**Edit profit margin:** Line 113 in sync worker

---

## API Rate Limits

**AliExpress API:** ~100 requests per minute

**Our strategy:**
- 500ms delay between products = 2 requests/sec = 120 requests/min ✅
- Stays well within limits

**If hitting limits:**
- Increase delay: `setTimeout(resolve, 1000)`
- Or reduce products: `limit: 10`

---

## Database Size

**Expected database growth:**
- Initial sync: ~100-200 products
- After 1 day (48 syncs): ~500-1000 products
- After 1 week: ~2000-3000 products
- After 1 month: ~5000+ products

**Storage:** ~50MB per 10,000 products (Supabase provides 1GB)

---

## Support

### Check these first:
1. ✅ API keys configured correctly
2. ✅ Environment variables set
3. ✅ Supabase database accessible
4. ✅ AliExpress API key has valid quota

### Common errors:

| Error | Solution |
| --- | --- |
| `Missing required environment variables` | Set SUPABASE_URL, SUPABASE_SERVICE_KEY, ALIEXPRESS_API_KEY, ALIEXPRESS_API_SECRET |
| `Failed to fetch categories` | Check database connection |
| `AliExpress search failed` | Verify API keys, check quota |
| `rate_limit_exceeded` | Increase delays in sync worker |
| `No products synced` | Check if search keywords return results |

---

## Next Steps

1. ✅ Start sync: `npm run sync:products`
2. ✅ Check logs: `pm2 logs product-sync`
3. ✅ Verify products: Visit `/shop`
4. ✅ Deploy to production using one of the options above
5. ✅ Monitor weekly to ensure it's running

**Happy continuous syncing! 🚀**
