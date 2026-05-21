/**
 * Configuration - Production Ready
 * Admin credentials are now environment-based for security
 * 
 * For local development: Create .env.local with:
 * VITE_ADMIN_LOGIN=admin
 * VITE_ADMIN_PASS=your_secure_password_here
 * 
 * For production: Set via Vercel Dashboard environment variables
 */

// Admin login hint only. Password is verified by /api/admin-auth.
var ADMIN_LOGIN = window.__ENV?.ADMIN_LOGIN || 'admin';
var ADMIN_PASS = '';

// Rate limiting settings (client-side hints)
var RATE_LIMIT_ORDERS_PER_HOUR = 5;
var RATE_LIMIT_FORMS_PER_MINUTE = 3;

// Validation settings
var PHONE_REGEX = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Note: Telegram credentials are now handled securely on backend via Vercel environment variables
// Frontend no longer has direct access to bot token - all orders go through /api/send-order

