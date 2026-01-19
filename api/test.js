// Vercel Serverless Function - API Health Check
export default async function handler(req, res) {
  console.log('Test API route called');
  
  return res.status(200).json({
    message: 'AuraCart API is working',
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'present' : 'missing',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'present' : 'missing',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'present' : 'missing',
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'present' : 'missing'
    }
  });
}
