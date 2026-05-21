/**
 * Admin authentication endpoint
 * Validates admin credentials and returns authentication status
 * Prevents exposing admin password in frontend code
 */

const adminLoginLimits = new Map();

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-client-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

function checkAdminRateLimit(ip) {
  const now = Date.now();
  const cutoff = now - 15 * 60 * 1000;
  const attempts = (adminLoginLimits.get(ip) || []).filter(time => time > cutoff);
  if (attempts.length >= 6) {
    adminLoginLimits.set(ip, attempts);
    return false;
  }
  attempts.push(now);
  adminLoginLimits.set(ip, attempts);
  return true;
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clientIP = getClientIP(req);
    if (!checkAdminRateLimit(clientIP)) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait and try again.' });
    }

    const { password } = req.body;

    if (!password || String(password).length > 200) {
      return res.status(400).json({ error: 'Password required' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD environment variable is not configured');
      return res.status(500).json({ error: 'Admin auth is not configured' });
    }

    if (String(password) === adminPassword) {
      return res.status(200).json({
        success: true,
        authenticated: true,
        message: 'Admin access granted'
      });
    } else {
      // Log failed attempt (useful for security monitoring)
      console.warn('Failed admin login attempt from', clientIP);
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
