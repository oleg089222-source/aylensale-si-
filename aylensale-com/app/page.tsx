'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Weather } from '@/components/Weather';
import { Auctions } from '@/components/Auctions';
import { Products } from '@/components/Products';
import { Cart } from '@/components/Cart';
import { AdminPanel } from '@/components/AdminPanel';

export default function Home() {
  const [activeTab, setActiveTab] = useState('products');
  const [language, setLanguage] = useState('en');
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);

  useEffect(() => {
    // Check if admin password is stored in localStorage
    const adminAuth = localStorage.getItem('aylensale-admin-auth');
    if (adminAuth === 'true') {
      setAdminAuthenticated(true);
    }
  }, []);

  const toggleAdmin = () => {
    if (!adminAuthenticated) {
      setShowAdmin(!showAdmin);
    } else {
      setShowAdmin(!showAdmin);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <Header 
        language={language} 
        onLanguageChange={setLanguage}
        onAdminToggle={toggleAdmin}
      />
      
      <Weather language={language} />

      <div className="container mx-auto px-4 py-8">
        {/* Admin Section */}
        {showAdmin && (
          <AdminPanel 
            language={language}
            onAuthenticated={() => {
              setAdminAuthenticated(true);
              setShowAdmin(true);
            }}
          />
        )}

        {!showAdmin && (
          <>
            {/* Tabs */}
            <div className="flex gap-4 mb-8 border-b">
              <button
                onClick={() => setActiveTab('auctions')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'auctions'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🔨 {language === 'en' ? 'Auctions' : language === 'hi' ? 'नीलाम' : 'Aukcje'}
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'products'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🛍️ {language === 'en' ? 'Products' : language === 'hi' ? 'उत्पाद' : 'Produkty'}
              </button>
              <button
                onClick={() => setActiveTab('cart')}
                className={`px-6 py-3 font-semibold transition-colors ${
                  activeTab === 'cart'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🛒 {language === 'en' ? 'Your Cart' : language === 'hi' ? 'आपकी कार्ट' : 'Twój Koszyk'}
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'auctions' && <Auctions language={language} />}
            {activeTab === 'products' && <Products language={language} />}
            {activeTab === 'cart' && <Cart language={language} />}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2026 AYLENSALE. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}