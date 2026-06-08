/**
 * Persist shop orders server-side (Firestore Admin SDK).
 */
import { getFirestoreAdmin } from './firebase-admin-app.mjs';

export async function saveShopOrderToFirestore(order) {
  const db = getFirestoreAdmin();
  const data = {
    name: String(order.name || '').trim().slice(0, 100),
    phone: String(order.phone || '').trim().slice(0, 30),
    pickup: String(order.pickup || '').trim().slice(0, 160),
    comment: String(order.comment || '').trim().slice(0, 500),
    items: Array.isArray(order.items) ? order.items.slice(0, 50).map(function(item) {
      return {
        id: String(item.id || '').slice(0, 120),
        name: String(item.name || '').slice(0, 120),
        qty: Number(item.qty || 0),
        price: Number(item.price || 0)
      };
    }) : [],
    total: Number(order.total || 0),
    card: order.card ? String(order.card).trim().toUpperCase().slice(0, 40) : '',
    discount: Number(order.discount || 0),
    status: String(order.status || 'new').slice(0, 40),
    adminNote: String(order.adminNote || '').slice(0, 500),
    vipMember: !!order.vipMember,
    telegramMessageId: order.telegramMessageId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!data.name || !data.phone || !data.items.length) {
    throw new Error('Invalid order data');
  }
  const ref = await db.collection('orders').add(data);
  return Object.assign({ id: ref.id }, data);
}
