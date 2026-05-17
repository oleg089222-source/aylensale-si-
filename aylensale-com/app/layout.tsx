import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AYLENSALE - Best Deals in UK | Cloud Storage',
  description: 'Buy and sell products with live auctions, photos in the cloud, and instant checkout',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Firebase SDK for cloud storage - Load first */}
        <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js" async></script>
        <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js" async></script>
        <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-storage.js" async></script>
        {/* Firebase Config - Load after SDK */}
        <script src="/js/firebase-config.js" defer></script>
      </head>
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}