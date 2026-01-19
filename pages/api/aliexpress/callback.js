export default async function handler(req, res) {
  console.log('OAuth callback called with query:', req.query);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error } = req.query;

  if (error) {
    console.error('OAuth error from AliExpress:', error);
    return res.redirect('/admin/suppliers?status=error&error=' + encodeURIComponent(error));
  }

  if (!code) {
    console.error('No authorization code received');
    return res.redirect('/admin/suppliers?status=error&error=No authorization code');
  }

  try {
    // Check environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    console.log('Environment check:', { 
      supabaseUrl: supabaseUrl ? 'present' : 'missing',
      supabaseAnonKey: supabaseAnonKey ? 'present' : 'missing'
    });
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing environment variables');
      return res.redirect('/admin/suppliers?status=error&error=' + encodeURIComponent('Server configuration error'));
    }
    
    const callbackUrl = `${supabaseUrl}/functions/v1/aliexpress-auth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`;
    console.log('Calling edge function:', callbackUrl);
    
    const response = await fetch(callbackUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Edge function response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase edge function error:', errorText);
      return res.redirect('/admin/suppliers?status=error&error=' + encodeURIComponent('Token exchange failed'));
    }

    // Parse JSON response from edge function
    const responseData = await response.json();
    console.log('Edge function response:', responseData);
    
    if (responseData.success) {
      console.log('OAuth successful, redirecting to success page');
      // Use window.location.replace to clear URL parameters
      return res.redirect('/admin/suppliers?status=connected&timestamp=' + Date.now());
    } else {
      console.error('OAuth failed:', responseData.error);
      return res.redirect('/admin/suppliers?status=error&error=' + encodeURIComponent(responseData.error || 'Unknown error') + '&timestamp=' + Date.now());
    }

  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.redirect('/admin/suppliers?status=error&error=' + encodeURIComponent('Callback failed'));
  }
}
