/**
 * Admin authentication endpoint
 * Validates admin credentials and returns authentication status
 * Prevents exposing admin password in frontend code
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    // Get admin password from environment variables
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin2024';

    // Compare passwords (in production, use bcrypt)
    if (password === adminPassword) {
      return res.status(200).json({
        success: true,
        authenticated: true,
        message: 'Admin access granted'
      });
    } else {
      // Log failed attempt (useful for security monitoring)
      console.warn('Failed admin login attempt from', req.headers['x-forwarded-for'] || 'unknown');
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: 'Invalid password'
      });
    }

  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
}
