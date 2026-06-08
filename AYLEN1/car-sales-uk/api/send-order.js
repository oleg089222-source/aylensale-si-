/**
 * Serverless function to send order to Telegram
 * Solves CORS issues and keeps bot token secure
 * Includes rate limiting and spam protection
 * 
 * Usage: POST /api/send-order
 * Body: regular order or { type: 'auction_winner', ...auction winner fields }
 */
import {
  cleanString,
  countUrls,
  detectBot,
  guardPublicForm
} from './lib/spam-guard.mjs';
import { getFirestoreAdmin } from './lib/firebase-admin-app.mjs';
import { isAdminConfigured } from './lib/firestore-admin.mjs';

async function saveOrderActivity(message, productId) {
  if (!isAdminConfigured()) return;
  try {
    const db = getFirestoreAdmin();
    await db.collection('activityFeed').add({
      message: cleanString(message, 160),
      type: 'order',
      productId: cleanString(productId, 120),
      createdAt: new Date().toISOString(),
      createdAtMs: Date.now()
    });
  } catch (err) {
    console.warn('[send-order] activity feed skipped:', err.message);
  }
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
    const { name, phone, pickup, comment, items, total, card, discount, type, security } = req.body || {};

    const guard = await guardPublicForm(req, {
      scope: type === 'auction_winner' ? 'auction-winner' : 'order',
      maxAttempts: type === 'auction_winner' ? 3 : 5,
      windowMs: 3600000,
      minimumMs: 1200,
      rateMessage: 'Too many requests. Please wait before placing another order.'
    });
    if (!guard.ok) {
      return res.status(guard.status).json({ error: guard.error });
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
    let orderTotal = parseFloat(total) || 0;
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
      orderTotal = validTotal;
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
    let firestoreOrderId = null;
    if (type !== 'auction_winner') {
      const firstItem = Array.isArray(items) && items[0] ? items[0] : null;
      await saveOrderActivity(
        'Someone ordered ' + cleanString(firstItem && firstItem.name ? firstItem.name : 'AYLENSALE item', 120),
        firstItem && firstItem.id ? firstItem.id : ''
      );
      try {
        const { saveShopOrderToFirestore } = await import('./lib/save-shop-order.mjs');
        const saved = await saveShopOrderToFirestore({
          name: safeName,
          phone: safePhone,
          pickup: safePickup,
          comment: safeComment,
          items: items,
          total: orderTotal,
          card: card || '',
          discount: discount || 0,
          status: 'new',
          vipMember: !!(card && String(card).toUpperCase() === 'VIPSTOCK') || !!req.body.vipMember,
          telegramMessageId: data.result.message_id || null
        });
        firestoreOrderId = saved.id;
      } catch (persistErr) {
        console.error('Order Firestore persist failed:', persistErr.message);
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Order sent successfully!',
      messageId: data.result.message_id,
      orderId: firestoreOrderId
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
}
