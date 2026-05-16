import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AYLENSALE - Auctions & Products',
  description: 'Buy and sell products with live auctions and instant checkout',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        {children}
      </body>
    </html>
  );
}