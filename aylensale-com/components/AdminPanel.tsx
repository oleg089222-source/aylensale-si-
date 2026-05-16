'use client';

import { useState, useRef } from 'react';

interface AdminPanelProps {
  language: string;
  onAuthenticated: () => void;
}

export function AdminPanel({ language, onAuthenticated }: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [newProduct, setNewProduct] = useState({ title: '', price: '', category: 'Fruits', image: '' });
  const [products, setProducts] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = () => {
    if (password === 'aylen2026') {
      setIsAuthenticated(true);
      localStorage.setItem('aylensale-admin-auth', 'true');
      onAuthenticated();
    } else {
      alert(language === 'en' ? 'Incorrect password' : 'गलत पासवर्ड');
    }
  };

  const handleAddProduct = () => {
    if (!newProduct.title || !newProduct.price) {
      alert(language === 'en' ? 'Please fill in all fields' : 'कृपया सभी फील्ड भरें');
      return;
    }

    const product = { id: Date.now().toString(), ...newProduct };
    const updatedProducts = [...products, product];
    setProducts(updatedProducts);
    localStorage.setItem('aylensale-products', JSON.stringify(updatedProducts));
    setNewProduct({ title: '', price: '', category: 'Fruits', image: '' });
    alert(language === 'en' ? 'Product added!' : 'उत्पाद जोड़ा गया!');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewProduct({ ...newProduct, image: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h2 className="text-3xl font-bold mb-6">🔐 {language === 'en' ? 'Admin Panel' : 'एडमिन पैनल'}</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full border rounded-lg px-4 py-3 mb-4 text-lg"
            placeholder={language === 'en' ? 'Enter password' : 'पासवर्ड दर्ज करें'}
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-bold"
          >
            {language === 'en' ? 'Login' : 'लॉगिन'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 rounded-lg shadow-lg p-8 mb-8">
      <h2 className="text-3xl font-bold mb-6">🛠️ {language === 'en' ? 'Admin Panel' : 'एडमिन पैनल'}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Add Product Form */}
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-xl font-bold mb-4">
            ➕ {language === 'en' ? 'Add New Product' : 'नया उत्पाद जोड़ें'}
          </h3>

          <div className="space-y-4">
            <input
              type="text"
              value={newProduct.title}
              onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
              placeholder={language === 'en' ? 'Product title' : 'उत्पाद का नाम'}
            />

            <input
              type="number"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
              placeholder={language === 'en' ? 'Price (£)' : 'कीमत (£)'}
            />

            <select
              value={newProduct.category}
              onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
            >
              <option>Fruits</option>
              <option>Vegetables</option>
              <option>Dairy</option>
              <option>Bakery</option>
            </select>

            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handlePhotoUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                {language === 'en' ? '📸 Upload Photo' : '📸 फोटो अपलोड करें'}
              </button>
              {newProduct.image && <p className="text-sm text-green-600 mt-2">✓ Photo selected</p>}
            </div>

            <button
              onClick={handleAddProduct}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors font-bold"
            >
              {language === 'en' ? 'Add Product' : 'उत्पाद जोड़ें'}
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-xl font-bold mb-4">📊 {language === 'en' ? 'Stats' : 'आंकड़े'}</h3>
          <div className="space-y-3">
            <p className="text-lg">
              <span className="font-semibold">{language === 'en' ? 'Products:' : 'उत्पाद:'}</span> {products.length}
            </p>
            <p className="text-lg">
              <span className="font-semibold">{language === 'en' ? 'Admin:' : 'प्रशासक:'}</span> ✅ {language === 'en' ? 'Logged In' : 'लॉगिन किया'}
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('aylensale-admin-auth');
                setIsAuthenticated(false);
                setPassword('');
              }}
              className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors font-bold mt-4"
            >
              {language === 'en' ? 'Logout' : 'लॉगआउट'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-600 text-center mt-6">
        {language === 'en'
          ? '💡 Tip: Click on AYLENSALE name to close admin panel'
          : '💡 सुझाव: एडमिन पैनल बंद करने के लिए AYLENSALE पर क्लिक करें'}
      </p>
    </div>
  );
}