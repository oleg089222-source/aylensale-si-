/**
 * Serverless function to send order to Telegram
 * Solves CORS issues and keeps bot token secure
 * Includes rate limiting and spam protection
 * 
 * Usage: POST /api/send-order
 * Body: regular order or { type: 'auction_winner', ...auction winner fields }
 */

// Simple in-memory rate limiting (resets on serverless instance restart).
const ipRateLimits = new Map();
const sessionRateLimits = new Map();

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-client-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

function checkRateLimit(bucket, key, maxAttempts, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (!bucket.has(key)) {
    bucket.set(key, []);
  }

  let attempts = bucket.get(key).filter(time => time > cutoff);
  if (attempts.length >= maxAttempts) {
    bucket.set(key, attempts);
    return false;
  }

  attempts.push(now);
  bucket.set(key, attempts);
  return true;
}

function cleanString(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function countUrls(value) {
  return (String(value || '').match(/https?:\/\//gi) || []).length;
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
  const spamKeywords = ['viagra', 'casino', 'lottery', 'bitcoin', 'forex', 'crypto', 'loan', 'porn', 'hack', 'click here', 'free money'];
  const contentLower = (name + ' ' + comment).toLowerCase();
  for (const keyword of spamKeywords) {
    if (contentLower.includes(keyword)) suspicion += 3;
  }
  
  // Suspicious URLs
  const urlMatches = (comment || '').match(/https?:\/\//g) || [];
  if (urlMatches.length > 1) suspicion += 5;
  
  return suspicion >= 5;
}

function validateSecurityMeta(security) {
  if (!security || typeof security !== 'object') return true;
  if (security.website) return false;

  const startedAt = Number(security.formStartedAt || 0);
  const submittedAt = Number(security.submittedAt || 0);
  if (startedAt && submittedAt && submittedAt - startedAt < 1000) return false;

  return true;
}

function validateItem(item) {
  if (!item || typeof item !== 'object') return false;
  const name = cleanString(item.name, 120);
  const qty = Number(item.qty);
  const price = Number(item.price);
  return Boolean(name) && Number.isFinite(qty) && qty > 0 && qty <= 99 && Number.isFinite(price) && price >= 0 && price < 100000;
}

function escapeTelegram(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clientIP = getClientIP(req);
    
    const { name, phone, pickup, comment, items, total, card, discount, type, security } = req.body || {};
    const sessionId = cleanString(security?.sessionId, 80) || 'no-session';

    // Check rate limits by IP and browser session.
    if (!checkRateLimit(ipRateLimits, clientIP, 5, 3600000) || !checkRateLimit(sessionRateLimits, sessionId, 5, 3600000)) {
      return res.status(429).json({ 
        error: 'Too many requests. Please wait before placing another order.' 
      });
    }

    if (!validateSecurityMeta(security)) {
      return res.status(400).json({ error: 'Submission blocked.' });
    }

    const safeName = cleanString(name, 100);
    const safePhone = cleanString(phone, 30);
    const safePickup = cleanString(pickup, 160);
    const safeComment = cleanString(comment, 500);

    // Validate required fields
    if (!safeName || !safePhone) {
      return res.status(400).json({ error: 'Missing required fields: name, phone' });
    }

    if (type !== 'auction_winner' && (!items || items.length === 0)) {
      return res.status(400).json({ error: 'Missing required fields: items' });
    }

    // Validate name format
    if (safeName.length < 2 || safeName.length > 100 || !/^[a-zA-Z0-9\s\-'.]+$/.test(safeName)) {
      return res.status(400).json({ error: 'Invalid name format' });
    }

    // Validate phone format
    const phoneDigits = safePhone.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    if (countUrls(safeComment) > 1) {
      return res.status(400).json({ error: 'Too many links in message' });
    }

    // Check for bot-like behavior
    if (detectBot(safeName, safePhone, '', safeComment)) {
      return res.status(400).json({ error: 'Submission appears to be automated or invalid' });
    }

    // Validate items array
    if (type !== 'auction_winner' && !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }

    if (type !== 'auction_winner') {
      if (items.length > 50) {
        return res.status(400).json({ error: 'Too many items in order' });
      }
      for (const item of items) {
        if (!validateItem(item)) {
          return res.status(400).json({ error: 'Invalid item format' });
        }
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
    let text = '';
    if (type === 'auction_winner') {
      const {
        auctionName,
        auctionId,
        bidId,
        finalPrice,
        method,
        address,
        postcode
      } = req.body;

      const safeMethod = cleanString(method, 20);
      const safeAddress = cleanString(address, 220);
      const safePostcode = cleanString(postcode, 20);
      const safeAuctionName = cleanString(auctionName || 'Auction item', 140);

      if (safeMethod !== 'Pickup' && safeMethod !== 'Delivery') {
        return res.status(400).json({ error: 'Invalid winner method' });
      }
      if (safeMethod === 'Delivery' && (!safeAddress || !safePostcode)) {
        return res.status(400).json({ error: 'Missing delivery details' });
      }

      text = '🏆 <b>AUCTION WINNER - AYLENSALE</b>\n\n';
      text += `<b>Auction:</b> ${escapeTelegram(safeAuctionName)}\n`;
      text += `<b>Final Price:</b> £${Number(finalPrice || 0).toFixed(2)}\n`;
      text += `<b>Winner:</b> ${escapeTelegram(safeName)}\n`;
      text += `<b>Phone:</b> ${escapeTelegram(safePhone)}\n`;
      text += `<b>Method:</b> ${escapeTelegram(safeMethod)}\n`;
      if (safeMethod === 'Delivery') {
        text += `<b>Address:</b> ${escapeTelegram(safeAddress)}\n`;
        text += `<b>Postcode:</b> ${escapeTelegram(safePostcode)}\n`;
      } else {
        text += `<b>Pickup:</b> ${escapeTelegram(safePickup || 'Not selected')}\n`;
      }
      if (safeComment) {
        text += `<b>Comment:</b> ${escapeTelegram(safeComment)}\n`;
      }
      text += `\n<b>Auction ID:</b> ${escapeTelegram(auctionId || '')}\n`;
      text += `<b>Bid ID:</b> ${escapeTelegram(bidId || '')}`;
    } else {
      text = '🎉 <b>NEW ORDER - AYLENSALE</b>\n\n';
      text += `<b>Customer:</b> ${escapeTelegram(safeName)}\n`;
      text += `<b>Phone:</b> ${escapeTelegram(safePhone)}\n`;
      text += `<b>Pickup:</b> ${escapeTelegram(safePickup || 'Not selected')}\n`;
      
      if (safeComment) {
        text += `<b>Comment:</b> ${escapeTelegram(safeComment)}\n`;
      }
      
      if (card) {
        text += `<b>Card:</b> ${escapeTelegram(card)}${discount ? ' (-' + discount + '%)' : ''}\n`;
      }
      
      text += '\n<b>Items:</b>\n';
      let validTotal = 0;
      for (const item of items) {
        const itemTotal = (parseFloat(item.price) * parseInt(item.qty)).toFixed(2);
        validTotal += parseFloat(itemTotal);
        text += `• ${escapeTelegram(item.name)} x${item.qty} = £${itemTotal}\n`;
      }
      
      text += `\n<b>TOTAL:</b> £${validTotal.toFixed(2)}`;
    }

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
