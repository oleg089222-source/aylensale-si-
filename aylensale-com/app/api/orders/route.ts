import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { name, phone, email, items, total, language } = await request.json();

    // Validate required fields
    if (!name || !phone || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get Telegram credentials from environment variables
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramToken || !telegramChatId) {
      console.error('Telegram credentials not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Format order message
    const itemsList = items
      .map((item: any) => `  • ${item.title} x${item.quantity} = £${(item.price * item.quantity).toFixed(2)}`)
      .join('\n');

    const message = `
📦 NEW ORDER - AYLENSALE
================================
👤 Name: ${name}
📞 Phone: ${phone}
📧 Email: ${email || 'N/A'}
🌍 Language: ${language}

🛒 ORDER ITEMS:
${itemsList}

💰 TOTAL: £${total.toFixed(2)}
================================
⏰ Time: ${new Date().toLocaleString()}
`;

    // Send to Telegram Bot
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!telegramResponse.ok) {
      const error = await telegramResponse.json();
      console.error('Telegram API error:', error);
      return NextResponse.json(
        { error: 'Failed to send order via Telegram' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: true, 
        message: language === 'en' ? 'Order sent successfully!' : 'आपका आदेश सफलतापूर्वक भेज दिया गया!'
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Order submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
