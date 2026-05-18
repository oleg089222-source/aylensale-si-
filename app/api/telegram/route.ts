import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json(
        { error: "Telegram не настроен на сервере" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text, title, phone, items, total } = body as {
      text?: string;
      title?: string;
      phone?: string;
      items?: { name: string; qty: number; price: number }[];
      total?: number;
    };

    let message = text;
    if (!message && title) {
      message = `🛒 <b>AYLENSALE</b>\n\n<b>${title}</b>`;
      if (phone) message += `\n📞 ${phone}`;
      if (items?.length) {
        message += "\n\n<b>Товары:</b>\n";
        for (const item of items) {
          message += `• ${item.name} x${item.qty} = £${(item.price * item.qty).toFixed(2)}\n`;
        }
      }
      if (total != null) message += `\n<b>Итого:</b> £${total.toFixed(2)}`;
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json(
        { error: data.description ?? "Ошибка Telegram API" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageId: data.result?.message_id });
  } catch (error) {
    console.error("Telegram route error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
