'use client';

import { useState, useEffect } from 'react';

interface AuctionsProps {
  language: string;
}

interface Auction {
  id: string;
  title: string;
  currentBid: number;
  bids: number;
  endsAt: Date;
  image: string;
}

export function Auctions({ language }: AuctionsProps) {
  const [auctions, setAuctions] = useState<Auction[]>([
    {
      id: '1',
      title: language === 'en' ? 'Vintage Watch' : 'विंटेज घड़ी',
      currentBid: 150,
      bids: 12,
      endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      image: '⌚',
    },
    {
      id: '2',
      title: language === 'en' ? 'Leather Jacket' : 'चमड़ा जैकेट',
      currentBid: 85,
      bids: 8,
      endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      image: '🧥',
    },
  ]);

  const [timeLeft, setTimeLeft] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft: { [key: string]: string } = {};
      auctions.forEach((auction) => {
        const now = new Date().getTime();
        const end = auction.endsAt.getTime();
        const distance = end - now;

        if (distance > 0) {
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          newTimeLeft[auction.id] = `${hours}h ${minutes}m ${seconds}s`;
        } else {
          newTimeLeft[auction.id] = language === 'en' ? 'Ended' : 'समाप्त';
        }
      });
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [auctions, language]);

  return (
    <section className="py-8">
      <h2 className="text-3xl font-bold mb-6">
        🔨 {language === 'en' ? 'Active Auctions' : 'सक्रिय नीलाम'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {auctions.map((auction) => (
          <div key={auction.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-orange-400 to-red-600 h-32 flex items-center justify-center text-6xl">
              {auction.image}
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2">{auction.title}</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  {language === 'en' ? 'Current Bid' : 'वर्तमान बोली'}
                </p>
                <p className="text-3xl font-bold text-green-600">£{auction.currentBid}</p>
                <p className="text-sm text-gray-600">
                  {auction.bids} {language === 'en' ? 'bids' : 'बोलियाँ'}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600">
                  {language === 'en' ? 'Time Remaining' : 'बचा हुआ समय'}
                </p>
                <p className="text-2xl font-bold text-red-600">{timeLeft[auction.id] || 'Loading...'}</p>
              </div>
              <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
                {language === 'en' ? 'Place Bid' : 'बोली लगाएँ'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}