/**
 * Serverless function to send order to Telegram
 * Solves CORS issues and keeps bot token secure
 * 
 * Usage: POST /api/send-order
 * Body: { name, phone, pickup, comment, items, total, card, discount }
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, phone, pickup, comment, items, total, card, discount } = req.body;

    // Validate required fields
    if (!name || !phone || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: name, phone, items' });
    }

    // Get Telegram credentials from environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Telegram credentials not configured');
      return res.status(500).json({ error: 'Telegram not configured' });
    }

    // Build the message
    let text = 'NEW ORDER - AYLENSALE\n\n';
    text += `Customer: ${name}\n`;
    text += `Phone: ${phone}\n`;
    text += `Pickup: ${pickup || 'Not selected'}\n`;
    
    if (comment) {
      text += `Comment: ${comment}\n`;
    }
    
    if (card) {
      text += `Card: ${card}${discount ? ' (-' + discount + '%)' : ''}\n`;
    }
    
    text += '\nItems:\n';
    if (Array.isArray(items)) {
      for (const item of items) {
        const itemTotal = (parseFloat(item.price) * parseInt(item.qty)).toFixed(2);
        text += `- ${item.name} x${item.qty} = £${itemTotal}\n`;
      }
    }
    
    text += `\nTOTAL: £${total || '0.00'}`;

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
        error: 'Failed to send Telegram message',
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
