export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error } = req.query;

  if (error) {
    return res.redirect('/admin/suppliers?status=error&error=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect('/admin/suppliers?status=error&error=No authorization code');
  }

  try {
    // Call your Supabase edge function with the authorization code
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    const callbackUrl = `${supabaseUrl}/functions/v1/aliexpress-auth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`;
    
    const response = await fetch(callbackUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase edge function error:', errorText);
      return res.redirect('/admin/suppliers?status=error&error=' + encodeURIComponent('Token exchange failed'));
    }

    // Parse JSON response from edge function
    const responseData = await response.json();
    console.log('Edge function response:', responseData);
    
    if (responseData.success) {
      return res.redirect('/admin/suppliers?status=connected');
    } else {
      return res.redirect('/admin/suppliers?status=error&error=' + encodeURIComponent(responseData.error || 'Unknown error'));
    }

  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.redirect('/admin/suppliers?status=error&error=' + encodeURIComponent('Callback failed'));
  }
}
