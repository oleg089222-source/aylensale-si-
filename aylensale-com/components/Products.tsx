'use client';

import { useState, useEffect } from 'react';

interface ProductsProps {
  language: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  image: string;
  category: string;
}

export function Products({ language }: ProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{ [key: string]: number }>({});

  // Default products (fallback when Firebase is unavailable)
  const DEFAULT_PRODUCTS: Product[] = [
    { id: '1', title: language === 'en' ? 'Fresh Apples' : 'ताजे सेब', price: 12, image: '🍎', category: 'Fruits' },
    { id: '2', title: language === 'en' ? 'Organic Carrots' : 'जैविक गाजर', price: 8, image: '🥕', category: 'Vegetables' },
    { id: '3', title: language === 'en' ? 'Tomatoes' : 'टमाटर', price: 6, image: '🍅', category: 'Vegetables' },
    { id: '4', title: language === 'en' ? 'Bananas' : 'केले', price: 10, image: '🍌', category: 'Fruits' },
    { id: '5', title: language === 'en' ? 'Lettuce' : 'सलाद पत्ता', price: 5, image: '🥬', category: 'Vegetables' },
    { id: '6', title: language === 'en' ? 'Strawberries' : 'स्ट्रॉबेरी', price: 15, image: '🍓', category: 'Fruits' },
  ];

  useEffect(() => {
    // Try to load products from Firebase
    const loadProductsFromFirebase = async () => {
      try {
        // Wait for Firebase to be available
        const waitForFirebase = async () => {
          let attempts = 0;
          while (attempts < 10 && typeof (window as any).firebase === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          return typeof (window as any).firebase !== 'undefined';
        };

        const fbReady = await waitForFirebase();
        if (!fbReady) {
          console.warn('Firebase not available, using default products');
          setProducts(DEFAULT_PRODUCTS);
          setLoading(false);
          return;
        }

        // Load from Firestore if available
        const firebase = (window as any).firebase;
        const fbDb = firebase.firestore();
        const snapshot = await fbDb.collection('products').get();
        
        if (!snapshot.empty) {
          const fbProducts = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            title: doc.data().name || 'Untitled',
            price: doc.data().price || 0,
            image: doc.data().images && doc.data().images[0] ? doc.data().images[0] : '📦',
            category: doc.data().category || 'Other'
          }));
          setProducts(fbProducts);
          console.log('✅ Products loaded from Firebase:', fbProducts.length);
        } else {
          console.warn('No products in Firestore, using defaults');
          setProducts(DEFAULT_PRODUCTS);
        }
      } catch (error) {
        console.error('Error loading products:', error);
        setProducts(DEFAULT_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };

    loadProductsFromFirebase();
  }, []);

  // Restore cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('aylensale-cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  const addToCart = (productId: string) => {
    const newCart = { ...cart };
    newCart[productId] = (newCart[productId] || 0) + 1;
    setCart(newCart);
    localStorage.setItem('aylensale-cart', JSON.stringify(newCart));
  };

  const displayProducts = products.length > 0 ? products : DEFAULT_PRODUCTS;

  return (
    <section className="py-8">
      <h2 className="text-3xl font-bold mb-6">
        🛍️ {language === 'en' ? 'Fresh Products' : 'ताजे उत्पाद'}
        {loading && <span className="text-sm text-gray-500 ml-2">(loading...)</span>}
        {products.length > 0 && <span className="text-sm text-green-600 ml-2">(✅ from cloud)</span>}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
            <div className="bg-gradient-to-r from-green-400 to-green-600 h-40 flex items-center justify-center text-6xl">
              {product.image}
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2">{product.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{product.category}</p>
              <div className="flex items-center justify-between mb-4">
                <p className="text-2xl font-bold text-green-600">£{product.price}</p>
                {cart[product.id] && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {cart[product.id]} in cart
                  </span>
                )}
              </div>
              <button
                onClick={() => addToCart(product.id)}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold"
              >
                {language === 'en' ? 'Add to Cart' : 'कार्ट में जोड़ें'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}