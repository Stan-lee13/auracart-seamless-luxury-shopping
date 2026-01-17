#!/usr/bin/env node

/**
 * Quick Start Script for Continuous Product Sync
 * 
 * This script helps you get started with continuous product syncing
 * Automatically runs every 30 minutes
 * 
 * Usage: node setup-sync.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('\n╔════════════════════════════════════════════════════════════════════╗');
console.log('║  🚀 AuraCart Continuous Product Sync Setup                         ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

// Check for environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'ALIEXPRESS_API_KEY',
  'ALIEXPRESS_API_SECRET',
];

console.log('📋 Checking environment variables...\n');

let allSet = true;
for (const envVar of requiredEnvVars) {
  const isSet = !!process.env[envVar];
  const status = isSet ? '✅' : '❌';
  console.log(`  ${status} ${envVar}: ${isSet ? 'Set' : 'NOT SET'}`);
  if (!isSet) allSet = false;
}

if (!allSet) {
  console.log('\n❌ Missing environment variables!\n');
  console.log('Set them using:');
  console.log('  export SUPABASE_URL="your_url"');
  console.log('  export SUPABASE_SERVICE_KEY="your_key"');
  console.log('  export ALIEXPRESS_API_KEY="your_key"');
  console.log('  export ALIEXPRESS_API_SECRET="your_secret"\n');
  console.log('Or add to .env file and source it:\n');
  console.log('  source .env && node setup-sync.mjs\n');
  process.exit(1);
}

console.log('\n✅ All environment variables are set!\n');

// Offer options
console.log('Choose how to run continuous sync:\n');
console.log('  1️⃣  Standalone (simple, good for testing)');
console.log('     npm run sync:products\n');
console.log('  2️⃣  PM2 Daemon (recommended for production)');
console.log('     pm2 start ecosystem.config.mjs\n');
console.log('  3️⃣  Docker (best for containerized deployments)');
console.log('     docker-compose up -d product-sync\n');
console.log('  4️⃣  GitHub Actions (serverless scheduling)');
console.log('     See: CONTINUOUS_SYNC.md\n');

console.log('📊 Sync Details:\n');
console.log('  📦 Products per sync: 100-300 unique products');
console.log('  ⏱️  Sync interval: Every 30 minutes');
console.log('  📁 Categories: All active categories');
console.log('  🔑 Keywords per category: 8');
console.log('  📄 Pages per keyword: 3');
console.log('  💾 Products per page: 20\n');

console.log('📚 Documentation:\n');
console.log('  📖 Full guide: CONTINUOUS_SYNC.md');
console.log('  ⚙️ Configuration: server/aliexpress_product_sync_worker.mjs');
console.log('  🐳 Docker compose: docker-compose.yml');
console.log('  🔧 PM2 config: ecosystem.config.mjs\n');

console.log('🎯 Next Steps:\n');
console.log('  1. Choose a sync method above');
console.log('  2. Start the sync worker');
console.log('  3. Check logs for "Product inserted" messages');
console.log('  4. Verify products at http://localhost:5173/shop\n');

console.log('💡 Pro Tips:\n');
console.log('  • Monitor logs: npm run sync:products 2>&1 | tail -f');
console.log('  • Use PM2 for production: pm2 start ecosystem.config.mjs');
console.log('  • Scale to multiple workers: pm2 scale product-sync 3');
console.log('  • Check status: pm2 status');
console.log('  • View dashboard: pm2 web (http://localhost:9615)\n');

console.log('═══════════════════════════════════════════════════════════════════════\n');
