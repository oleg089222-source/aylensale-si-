'use client';

import { useState, useEffect } from 'react';

interface CartProps {
  language: string;
}

interface CartItem {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
}

export function Cart({ language }: CartProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderEmail, setOrderEmail] = useState('');

  const allProducts = [
    { id: '1', title: language === 'en' ? 'Fresh Apples' : 'ताजे सेब', price: 12, image: '🍎' },
    { id: '2', title: language === 'en' ? 'Organic Carrots' : 'जैविक गाजर', price: 8, image: '🥕' },
    { id: '3', title: language === 'en' ? 'Tomatoes' : 'टमाटर', price: 6, image: '🍅' },
    { id: '4', title: language === 'en' ? 'Bananas' : 'केले', price: 10, image: '🍌' },
    { id: '5', title: language === 'en' ? 'Lettuce' : 'सलाद पत्ता', price: 5, image: '🥬' },
    { id: '6', title: language === 'en' ? 'Strawberries' : 'स्ट्रॉबेरी', price: 15, image: '🍓' },
  ];

  useEffect(() => {
    const savedCart = localStorage.getItem('aylensale-cart');
    if (savedCart) {
      const cartData = JSON.parse(savedCart);
      const items = Object.entries(cartData).map(([productId, quantity]: [string, any]) => {
        const product = allProducts.find((p) => p.id === productId);
        return {
          ...(product || { id: productId, title: 'Unknown', price: 0, image: '?' }),
          quantity,
        } as CartItem;
      });
      setCartItems(items);
    }
  }, []);

  const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      const newCart = cartItems.filter((item) => item.id !== productId);
      setCartItems(newCart);
      const cartData = Object.fromEntries(newCart.map((item) => [item.id, item.quantity]));
      localStorage.setItem('aylensale-cart', JSON.stringify(cartData));
    } else {
      const newCart = cartItems.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      );
      setCartItems(newCart);
      const cartData = Object.fromEntries(newCart.map((item) => [item.id, item.quantity]));
      localStorage.setItem('aylensale-cart', JSON.stringify(cartData));
    }
  };

  const submitOrder = async () => {
    if (!orderName || !orderPhone) {
      alert(language === 'en' ? 'Please fill in all fields' : 'कृपया सभी फील्ड भरें');
      return;
    }

    if (cartItems.length === 0) {
      alert(language === 'en' ? 'Your cart is empty' : 'आपकी कार्ट खाली है');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orderName,
          phone: orderPhone,
          email: orderEmail,
          items: cartItems,
          total: totalPrice,
          language: language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit order');
      }

      alert(language === 'en' ? 'Order sent! We will contact you soon.' : 'आपका आदेश भेज दिया गया!');
      localStorage.removeItem('aylensale-cart');
      setCartItems([]);
      setOrderName('');
      setOrderPhone('');
      setOrderEmail('');
    } catch (error) {
      console.error('Error sending order:', error);
      alert(language === 'en' ? 'Error sending order' : 'आदेश भेजने में त्रुटि');
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <section className="py-16 text-center">
        <p className="text-2xl text-gray-600">
          {language === 'en' ? 'Your cart is empty' : 'आपकी कार्ट खाली है'}
        </p>
      </section>
    );
  }

  return (
    <section className="py-8">
      <h2 className="text-3xl font-bold mb-6">
        🛒 {language === 'en' ? 'Your Cart' : 'आपकी कार्ट'}
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {cartItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-md p-6 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-5xl">{item.image}</div>
                <div>
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className="text-gray-600">£{item.price} each</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400"
                >
                  −
                </button>
                <span className="font-bold text-xl w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400"
                >
                  +
                </button>
                <span className="font-bold text-xl min-w-24 text-right">
                  £{(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 h-fit sticky top-8">
          <h3 className="text-2xl font-bold mb-6">
            {language === 'en' ? 'Order Summary' : 'आदेश सारांश'}
          </h3>
          
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">
              {language === 'en' ? 'Name' : 'नाम'}
            </label>
            <input
              type="text"
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 mb-4"
              placeholder={language === 'en' ? 'Your name' : 'आपका नाम'}
            />

            <label className="block text-sm font-semibold mb-2">
              {language === 'en' ? 'Phone' : 'फोन'}
            </label>
            <input
              type="tel"
              value={orderPhone}
              onChange={(e) => setOrderPhone(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 mb-4"
              placeholder={language === 'en' ? 'Your phone' : 'आपका फोन'}
            />

            <label className="block text-sm font-semibold mb-2">
              {language === 'en' ? 'Email (optional)' : 'ईमेल (वैकल्पिक)'}
            </label>
            <input
              type="email"
              value={orderEmail}
              onChange={(e) => setOrderEmail(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 mb-4"
              placeholder={language === 'en' ? 'Your email' : 'आपका ईमेल'}
            />
          </div>

          <div className="border-t pt-4 mb-6">
            <div className="flex justify-between mb-2">
              <span>{language === 'en' ? 'Subtotal' : 'उप-कुल'}:</span>
              <span>£{totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-4 font-bold text-xl">
              <span>{language === 'en' ? 'Total' : 'कुल'}:</span>
              <span className="text-green-600">£{totalPrice.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={submitOrder}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-bold disabled:bg-gray-400"
          >
            {loading
              ? language === 'en' ? 'Sending...' : 'भेज रहे हैं...'
              : language === 'en' ? 'Place Order' : 'आदेश दें'}
          </button>
          
          <p className="text-xs text-gray-600 text-center mt-4">
            {language === 'en'
              ? 'We will contact you via phone'
              : 'हम आपसे फोन के माध्यम से संपर्क करेंगे'}
          </p>
        </div>
      </div>
    </section>
  );
}