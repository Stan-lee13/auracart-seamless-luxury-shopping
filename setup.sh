#!/bin/bash
# Quick setup script for AuraCart
# Usage: bash setup.sh

set -e

echo "🚀 AuraCart Setup Script"
echo "======================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. You can still continue, but will need to push migrations manually."
fi

# Check environment variables
echo ""
echo "🔑 Checking environment variables..."

if [ -z "$SUPABASE_URL" ]; then
    echo "❌ SUPABASE_URL not set"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_KEY not set"
    exit 1
fi

if [ -z "$ALIEXPRESS_API_KEY" ]; then
    echo "⚠️  ALIEXPRESS_API_KEY not set - product sync will fail"
fi

if [ -z "$ALIEXPRESS_API_SECRET" ]; then
    echo "⚠️  ALIEXPRESS_API_SECRET not set - product sync will fail"
fi

echo "✅ Environment variables configured"
echo ""

# Push database migrations
echo "📊 Pushing database migrations..."

if command -v supabase &> /dev/null; then
    supabase db push --linked
    echo "✅ Migrations pushed"
else
    echo "⚠️  Supabase CLI not available. Push migrations using:"
    echo "   supabase db push --linked"
    echo "   OR manually run: supabase/migrations/20260116_setup_admin_and_products.sql"
fi

echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent
echo "✅ Dependencies installed"

echo ""

# Offer to sync products
echo "🛍️  Ready to sync products from AliExpress"
read -p "Start product sync now? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "⏳ Syncing products (this may take a few minutes)..."
    npm run sync:products
    echo ""
    echo "✅ Product sync complete!"
else
    echo ""
    echo "💡 To sync products later, run: npm run sync:products"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Make sure you signed up with: stanleyvic13@gmail.com or stanleyvic14@gmail.com"
echo "2. Log in and go to /admin to access the dashboard"
echo "3. Go to /shop to see products"
echo ""
echo "📚 For more details, see: ADMIN_SETUP.md"
