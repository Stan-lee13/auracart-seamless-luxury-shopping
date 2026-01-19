export default async function handler(req, res) {
  console.log('Test API route called');
  
  return res.status(200).json({
    message: 'API route is working',
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'present' : 'missing',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'present' : 'missing'
    }
  });
}
