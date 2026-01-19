// Vercel Serverless Function - AliExpress OAuth Callback Handler
// This endpoint handles the OAuth callback from AliExpress

export default async function handler(req, res) {
  console.log('=== AliExpress OAuth Callback Started ===');
  console.log('Method:', req.method);
  console.log('Query params:', JSON.stringify(req.query));
  
  // Only accept GET requests (OAuth redirect)
  if (req.method !== 'GET') {
    console.error('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error: oauthError } = req.query;

  // Handle OAuth errors from AliExpress
  if (oauthError) {
    console.error('OAuth error from AliExpress:', oauthError);
    return res.redirect(`/admin/suppliers?status=error&error=${encodeURIComponent(oauthError)}&timestamp=${Date.now()}`);
  }

  // Validate authorization code
  if (!code) {
    console.error('No authorization code received');
    return res.redirect(`/admin/suppliers?status=error&error=${encodeURIComponent('No authorization code received')}&timestamp=${Date.now()}`);
  }

  console.log('Authorization code received:', code.substring(0, 10) + '...');
  console.log('State parameter:', state);

  try {
    // Get environment variables
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    console.log('Environment check:', { 
      supabaseUrl: supabaseUrl ? 'present' : 'missing',
      supabaseAnonKey: supabaseAnonKey ? 'present' : 'missing'
    });
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      return res.redirect(`/admin/suppliers?status=error&error=${encodeURIComponent('Server configuration error - missing Supabase credentials')}&timestamp=${Date.now()}`);
    }
    
    // Call the Supabase edge function to exchange the code for tokens
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/aliexpress-auth-callback`;
    console.log('Calling edge function:', edgeFunctionUrl);
    
    // Pass code and state as query parameters (GET request to edge function)
    const callbackUrl = `${edgeFunctionUrl}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || 'https://auracartcom.vercel.app')}`;
    
    const response = await fetch(callbackUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Edge function response status:', response.status);
    
    // Get response text first for debugging
    const responseText = await response.text();
    console.log('Edge function response body:', responseText);
    
    // Try to parse as JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse edge function response:', parseError);
      return res.redirect(`/admin/suppliers?status=error&error=${encodeURIComponent('Invalid response from token exchange')}&timestamp=${Date.now()}`);
    }
    
    if (!response.ok) {
      console.error('Edge function error:', responseData);
      const errorMessage = responseData?.error || 'Token exchange failed';
      return res.redirect(`/admin/suppliers?status=error&error=${encodeURIComponent(errorMessage)}&timestamp=${Date.now()}`);
    }

    // Check for success in response
    if (responseData.success) {
      console.log('OAuth successful! Account:', responseData.account);
      return res.redirect(`/admin/suppliers?status=connected&account=${encodeURIComponent(responseData.account || '')}&timestamp=${Date.now()}`);
    } else {
      console.error('OAuth flow failed:', responseData.error);
      return res.redirect(`/admin/suppliers?status=error&error=${encodeURIComponent(responseData.error || 'Unknown error')}&timestamp=${Date.now()}`);
    }

  } catch (error) {
    console.error('OAuth callback exception:', error);
    return res.redirect(`/admin/suppliers?status=error&error=${encodeURIComponent(error.message || 'Callback processing failed')}&timestamp=${Date.now()}`);
  }
}
