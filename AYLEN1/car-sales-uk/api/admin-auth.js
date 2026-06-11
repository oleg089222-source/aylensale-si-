/**
 * Admin authentication endpoint
 * POST { password } — login check
 * POST { action: 'change-password', currentPassword, newPassword, confirmPassword } — change password
 */
import {
  changeAdminPassword,
  isAdminPasswordConfigured,
  syncFirebaseAdminPassword,
  verifyAdminPassword
} from '../lib/server/admin-password.mjs';

const adminLoginLimits = new Map();
const changePasswordLimits = new Map();

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-client-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body || {};
}

function checkRateLimit(map, ip, maxAttempts) {
  const now = Date.now();
  const cutoff = now - 15 * 60 * 1000;
  const attempts = (map.get(ip) || []).filter((time) => time > cutoff);
  if (attempts.length >= maxAttempts) {
    map.set(ip, attempts);
    return false;
  }
  attempts.push(now);
  map.set(ip, attempts);
  return true;
}

async function handleChangePassword(req, res, body) {
  const clientIP = getClientIP(req);
  if (!checkRateLimit(changePasswordLimits, clientIP, 8)) {
    return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
  }

  if (!(await isAdminPasswordConfigured())) {
    return res.status(503).json({ error: 'Admin password is not configured on server.' });
  }

  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;
  const confirmPassword = body.confirmPassword;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Fill in current, new, and confirm password.' });
  }
  if (String(newPassword).trim() !== String(confirmPassword).trim()) {
    return res.status(400).json({ error: 'New password and confirmation do not match.' });
  }

  if (!(await verifyAdminPassword(currentPassword))) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  try {
    const result = await changeAdminPassword(currentPassword, newPassword);
    return res.status(200).json({
      success: true,
      message: 'Password updated. Use the new password on your next login on any device.',
      firebaseUpdated: result.firebaseUpdated
    });
  } catch (err) {
    console.error('[admin-auth] change-password', err);
    const msg = err.message || 'Could not change password.';
    const status = /incorrect|required|different|at least|too long|match/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = parseBody(req);
    if (body.action === 'change-password') {
      return handleChangePassword(req, res, body);
    }
    if (body.action === 'sync-firebase-admin') {
      const clientIP = getClientIP(req);
      if (!checkRateLimit(changePasswordLimits, clientIP, 8)) {
        return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
      }
      if (!(await isAdminPasswordConfigured())) {
        return res.status(503).json({ error: 'Admin password is not configured on server.' });
      }
      const password = body.password;
      if (!password) {
        return res.status(400).json({ error: 'Password required' });
      }
      try {
        const result = await syncFirebaseAdminPassword(password);
        return res.status(200).json({
          success: true,
          message: 'Firebase admin password synced.',
          email: result.email,
          firebaseCreated: result.created,
          firebaseUpdated: result.updated
        });
      } catch (err) {
        console.error('[admin-auth] sync-firebase-admin', err);
        const msg = err.message || 'Could not sync Firebase admin password.';
        const status = /incorrect|required|configured|characters/i.test(msg) ? 400 : 500;
        return res.status(status).json({ error: msg });
      }
    }
    if (body.action === 'audit') {
      const { handleAdminAudit } = await import('../lib/server/admin-audit-handlers.mjs');
      return handleAdminAudit(req, res);
    }

    const clientIP = getClientIP(req);
    if (!checkRateLimit(adminLoginLimits, clientIP, 6)) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait and try again.' });
    }

    const { password } = body;

    if (!password || String(password).length > 200) {
      return res.status(400).json({ error: 'Password required' });
    }

    if (!(await isAdminPasswordConfigured())) {
      console.error('Admin password is not configured (env or Firestore)');
      return res.status(500).json({ error: 'Admin auth is not configured' });
    }

    if (await verifyAdminPassword(password)) {
      return res.status(200).json({
        success: true,
        authenticated: true,
        message: 'Admin access granted'
      });
    }

    console.warn('Failed admin login attempt from', clientIP);
    return res.status(401).json({
      success: false,
      authenticated: false,
      error: 'Invalid password'
    });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
}
