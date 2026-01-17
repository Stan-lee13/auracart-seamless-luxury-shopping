@echo off
REM Quick setup script for AuraCart (Windows)
REM Usage: setup.bat

echo.
echo ========================================
echo 🚀 AuraCart Setup Script (Windows)
echo ========================================
echo.

REM Check Node.js
echo 📋 Checking prerequisites...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js first.
    exit /b 1
)
echo ✅ Node.js found

REM Check environment variables
echo.
echo 🔑 Checking environment variables...

if "%SUPABASE_URL%"=="" (
    echo ❌ SUPABASE_URL not set
    exit /b 1
)

if "%SUPABASE_SERVICE_KEY%"=="" (
    echo ❌ SUPABASE_SERVICE_KEY not set
    exit /b 1
)

if "%ALIEXPRESS_API_KEY%"=="" (
    echo ⚠️  ALIEXPRESS_API_KEY not set - product sync will fail
)

if "%ALIEXPRESS_API_SECRET%"=="" (
    echo ⚠️  ALIEXPRESS_API_SECRET not set - product sync will fail
)

echo ✅ Environment variables configured

REM Install dependencies
echo.
echo 📦 Installing dependencies...
call npm install --silent
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    exit /b 1
)
echo ✅ Dependencies installed

REM Push migrations
echo.
echo 📊 Pushing database migrations...
echo To push migrations manually, run one of:
echo   - supabase db push --linked
echo   - psql "$DATABASE_URL" -f supabase/migrations/20260116_setup_admin_and_products.sql

REM Offer to sync products
echo.
echo 🛍️  Ready to sync products from AliExpress
set /p SYNC="Start product sync now? (y/n) "

if /i "%SYNC%"=="y" (
    echo.
    echo ⏳ Syncing products (this may take a few minutes)...
    call npm run sync:products
    echo.
    echo ✅ Product sync complete!
) else (
    echo.
    echo 💡 To sync products later, run: npm run sync:products
)

echo.
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo 1. Make sure you signed up with: stanleyvic13@gmail.com or stanleyvic14@gmail.com
echo 2. Log in and go to /admin to access the dashboard
echo 3. Go to /shop to see products
echo.
echo 📚 For more details, see: ADMIN_SETUP.md
echo.
pause
