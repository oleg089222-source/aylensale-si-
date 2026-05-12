/**
 * Serverless function to send order to Telegram
 * Solves CORS issues and keeps bot token secure
 * Includes rate limiting and spam protection
 * 
 * Usage: POST /api/send-order
 * Body: { name, phone, pickup, comment, items, total, card, discount }
 */

// Simple in-memory rate limiting (resets on server restart)
// In production, use Redis or database
const orderRateLimits = new Map();
const ipRateLimits = new Map();

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-client-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  
  if (!ipRateLimits.has(ip)) {
    ipRateLimits.set(ip, []);
  }
  
  let attempts = ipRateLimits.get(ip);
  attempts = attempts.filter(time => time > oneHourAgo);
  
  if (attempts.length >= 5) {
    return false;
  }
  
  attempts.push(now);
  ipRateLimits.set(ip, attempts);
  return true;
}

/**
 * Simple bot detection
 */
function detectBot(name, phone, email, comment) {
  let suspicion = 0;
  
  // Name validation
  if (!name || name.trim().length < 2) suspicion += 2;
  if (name && /^\d+$/.test(name.replace(/\s/g, ''))) suspicion += 3;
  
  // Phone validation
  const digitsOnly = (phone || '').replace(/\D/g, '');
  if (digitsOnly.length < 8) suspicion += 1;
  if (digitsOnly.length > 15) suspicion += 1;
  
  // Spam keywords
  const spamKeywords = ['viagra', 'casino', 'lottery', 'bitcoin', 'forex', 'crypto'];
  const contentLower = (name + ' ' + comment).toLowerCase();
  for (const keyword of spamKeywords) {
    if (contentLower.includes(keyword)) suspicion += 3;
  }
  
  // Suspicious URLs
  const urlMatches = (comment || '').match(/https?:\/\//g) || [];
  if (urlMatches.length > 1) suspicion += 5;
  
  return suspicion >= 5;
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clientIP = getClientIP(req);
    
    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ 
        error: 'Too many requests. Please wait before placing another order.' 
      });
    }

    const { name, phone, pickup, comment, items, total, card, discount } = req.body;

    // Validate required fields
    if (!name || !phone || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: name, phone, items' });
    }

    // Validate name format
    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ error: 'Invalid name format' });
    }

    // Validate phone format
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    // Check for bot-like behavior
    if (detectBot(name, phone, '', comment)) {
      return res.status(400).json({ error: 'Submission appears to be automated or invalid' });
    }

    // Validate items array
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }

    for (const item of items) {
      if (!item.name || !item.qty || !item.price) {
        return res.status(400).json({ error: 'Invalid item format' });
      }
    }

    // Get Telegram credentials from environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Telegram credentials not configured');
      return res.status(500).json({ error: 'Telegram not configured' });
    }

    // Build the message
    let text = '🎉 <b>NEW ORDER - AYLENSALE</b>\n\n';
    text += `<b>Customer:</b> ${name}\n`;
    text += `<b>Phone:</b> ${phone}\n`;
    text += `<b>Pickup:</b> ${pickup || 'Not selected'}\n`;
    
    if (comment) {
      text += `<b>Comment:</b> ${comment}\n`;
    }
    
    if (card) {
      text += `<b>Card:</b> ${card}${discount ? ' (-' + discount + '%)' : ''}\n`;
    }
    
    text += '\n<b>Items:</b>\n';
    let validTotal = 0;
    for (const item of items) {
      const itemTotal = (parseFloat(item.price) * parseInt(item.qty)).toFixed(2);
      validTotal += parseFloat(itemTotal);
      text += `• ${item.name} x${item.qty} = £${itemTotal}\n`;
    }
    
    text += `\n<b>TOTAL:</b> £${validTotal.toFixed(2)}`;

    // Send to Telegram
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram API error:', data);
      return res.status(500).json({ 
        error: 'Failed to send order',
        details: data.description || 'Unknown error'
      });
    }

    // Success!
    return res.status(200).json({ 
      success: true, 
      message: 'Order sent successfully!',
      messageId: data.result.message_id 
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
}
