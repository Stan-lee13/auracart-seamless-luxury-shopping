# AuraCart

A production-grade dropshipping platform integrated with AliExpress and Paystack.

## Features

- **AI-Powered Product Curation**: Smart recommendations personalized for your customers.
- **AliExpress Integration**: Seamless product syncing and order fulfillment.
- **Secure Payments**: Integrated with Paystack for reliable transactions.
- **Admin Dashboard**: Comprehensive management of orders, refunds, and suppliers.
- **Global Delivery**: Built for worldwide shipping operations.

## Technology Stack

- **Frontend**: Vite, React, TypeScript, Tailwind CSS, shadcn/ui.
- **Backend**: Supabase (Auth, Database, Edge Functions).
- **Payments**: Paystack.
- **Supplier**: AliExpress API.

## Getting Started

### Prerequisites

- Node.js & npm
- Supabase CLI (for local development and deployments)
- Paystack Account
- AliExpress Developer Account

### Installation

1. Clone the repository:
   ```sh
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Start the development server:
   ```sh
   npm run dev
   ```

## Deployment

### Edge Functions

Deploy the necessary Supabase Edge Functions:
```bash
supabase functions deploy create-charge
supabase functions deploy import-products
supabase functions deploy aliexpress-auth-callback
supabase functions deploy verify-payment
supabase functions deploy paystack-webhook
```

### Environment Variables

Set the following secrets in your Supabase project:
- `PAYSTACK_SECRET_KEY`
- `ALIEXPRESS_APP_KEY`
- `ALIEXPRESS_APP_SECRET`

## Testing

Run the test suite with Vitest:
```bash
npm test
```
