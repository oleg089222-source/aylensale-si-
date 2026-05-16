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
        {/* Firebase SDK for cloud storage */}
        <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js" defer></script>
        <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js" defer></script>
        <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-storage.js" defer></script>
        {/* Firebase Config */}
        <script src="/js/firebase-config.js" defer></script>
      </head>
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}