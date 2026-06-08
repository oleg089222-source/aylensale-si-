/**
 * VIP subscription alerts — Telegram admin channel.
 */
function escapeTelegram(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendTelegramHtml(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn('vip-notify: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing');
    return false;
  }
  const res = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(function() { return ''; });
    console.error('vip-notify telegram failed:', res.status, body.slice(0, 200));
    return false;
  }
  return true;
}

export function buildWhatsAppWelcomeUrl(whatsappUrl, email) {
  const base = String(whatsappUrl || 'https://wa.me/447471647771').trim();
  const msg = 'Hi AYLENSALE! I just subscribed to VIP STOCK (£9.99/mo). My email: ' + String(email || '').trim() + '. Please add me to VIP updates.';
  const sep = base.indexOf('?') === -1 ? '?' : '&';
  if (/wa\.me\/\d/i.test(base) && base.indexOf('text=') === -1) {
    return base + '?text=' + encodeURIComponent(msg);
  }
  if (base.indexOf('text=') !== -1) {
    return base.replace(/text=[^&]*/, 'text=' + encodeURIComponent(msg));
  }
  return base + sep + 'text=' + encodeURIComponent(msg);
}

export async function notifyAdminNewVipMember(record, settings) {
  if (!record || !record.email) return false;
  const tg = settings && settings.telegramUrl ? settings.telegramUrl : '';
  const lines = [
    '👑 <b>NEW VIP MEMBER — AYLENSALE</b>',
    '',
    '<b>Email:</b> ' + escapeTelegram(record.email),
    '<b>Status:</b> ' + escapeTelegram(record.status || 'active'),
    '<b>Amount:</b> £' + Number(record.amountGbp || 9.99).toFixed(2) + '/mo'
  ];
  if (record.stripeSubscriptionId) {
    lines.push('<b>Stripe sub:</b> ' + escapeTelegram(record.stripeSubscriptionId));
  }
  lines.push('');
  lines.push('Member page: https://aylensale.com/vip-stock.html');
  if (tg) lines.push('VIP Telegram: ' + escapeTelegram(tg));
  return sendTelegramHtml(lines.join('\n'));
}

export async function notifyAdminVipOrder(order, subscriber) {
  if (!order) return false;
  const lines = [
    '🛒 <b>NEW VIP ORDER — AYLENSALE</b>',
    '',
    '<b>Order:</b> ' + escapeTelegram(order.orderNumber || order.id),
    '<b>Item:</b> ' + escapeTelegram(order.itemTitle || 'VIP item'),
    '<b>Price:</b> £' + Number(order.vipPrice || 0).toFixed(2),
    '<b>Qty:</b> ' + Number(order.qty || 1),
    '<b>Channel:</b> ' + escapeTelegram(order.channel || 'whatsapp'),
    '<b>Member:</b> ' + escapeTelegram(order.email || (subscriber && subscriber.email) || '—'),
    '<b>Status:</b> requested'
  ];
  lines.push('');
  lines.push('Admin → VIP Members → VIP Orders');
  return sendTelegramHtml(lines.join('\n'));
}

export async function sendEmailViaResend(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'AYLENSALE VIP <onboarding@resend.dev>';
  if (!key || !to) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: from, to: [String(to)], subject: subject, html: html })
  });
  if (!res.ok) {
    const body = await res.text().catch(function() { return ''; });
    console.error('resend failed:', res.status, body.slice(0, 200));
    return false;
  }
  return true;
}

export async function sendVipMagicLinkEmail(email, url) {
  const html = '<p>Hi,</p><p>Click to open your VIP Member Hub (link valid 24 hours):</p>' +
    '<p><a href="' + String(url).replace(/"/g, '&quot;') + '">Open VIP access</a></p>' +
    '<p>If you did not request this, ignore this email.</p><p>AYLENSALE</p>';
  return sendEmailViaResend(email, 'Your VIP access link — AYLENSALE', html);
}

export async function notifyAdminMagicLinkFallback(email, url) {
  const lines = [
    '🔗 <b>VIP ACCESS LINK (forward to member)</b>',
    '',
    '<b>Email:</b> ' + escapeTelegram(email),
    '<b>Link:</b> ' + escapeTelegram(url),
    '',
    'Set RESEND_API_KEY on Vercel to email links automatically.'
  ];
  return sendTelegramHtml(lines.join('\n'));
}

export async function notifyMemberVipOrderUpdate(order, email) {
  if (!order || !email) return false;
  const note = order.adminNote ? '<p><b>Update:</b> ' + String(order.adminNote).replace(/</g, '&lt;') + '</p>' : '';
  const html = '<p>Your VIP order <b>' + String(order.orderNumber || '') + '</b> status: <b>' +
    String(order.status || '') + '</b>.</p>' + note +
    '<p><a href="https://aylensale.com/vip-stock.html">View My Orders</a></p>';
  return sendEmailViaResend(email, 'VIP order update — ' + (order.orderNumber || 'AYLENSALE'), html);
}

export async function notifyAdminVipOrderPaid(order) {
  if (!order) return false;
  const ship = order.shipping || {};
  const lines = [
    '💳 <b>VIP PAID — Royal Mail order</b>',
    '',
    '<b>Order:</b> ' + escapeTelegram(order.orderNumber || order.id),
    '<b>Item:</b> ' + escapeTelegram(order.itemTitle || ''),
    '<b>Total:</b> £' + Number(order.totalGbp || order.vipPrice || 0).toFixed(2),
    '<b>Member:</b> ' + escapeTelegram(order.email || ''),
    '<b>Ship to:</b> ' + escapeTelegram([ship.name, ship.line1, ship.city, ship.postcode].filter(Boolean).join(', '))
  ];
  lines.push('');
  lines.push('Admin → VIP Members → VIP Orders → add Royal Mail tracking');
  return sendTelegramHtml(lines.join('\n'));
}
