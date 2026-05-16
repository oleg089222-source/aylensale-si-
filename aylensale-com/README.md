# AYLENSALE - E-Commerce Platform with Auctions

Modern e-commerce platform built with Next.js 16, featuring live auctions with countdown timers, shopping cart, multi-language support, admin panel, and Telegram bot integration.

## ✨ Features

- 🔨 **Live Auctions** - 3-hour countdown timers, bid tracking
- 🛍️ **Product Catalog** - Browse and add items to cart
- 🛒 **Shopping Cart** - Persistent localStorage storage
- 🗣️ **Multi-Language Support** - English, Hindi, Polish, Romanian, Urdu, Latvian
- ⚙️ **Admin Panel** - Add/edit products, upload photos (click AYLENSALE to access)
- 🌤️ **Weather Widget** - Compact Saturday/Sunday forecast
- 📱 **Telegram Integration** - Orders sent directly to Telegram bot
- 📦 **Fully Responsive** - Mobile, tablet, desktop

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd aylensale-com
npm install
```

### 2. Create `.env.local`

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Telegram bot credentials:
- `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` - Your bot token
- `NEXT_PUBLIC_TELEGRAM_CHAT_ID` - Your chat ID

### 3. Get Telegram Bot Token

1. Open Telegram and message **@BotFather**
2. Send `/newbot`
3. Follow the prompts to create a bot
4. Copy the token (looks like: `123456789:ABC-DEF...`)

### 4. Get Your Telegram Chat ID

1. Send a message to your newly created bot
2. Visit: `https://api.telegram.org/bot{YOUR_TOKEN}/getUpdates`
3. Replace `{YOUR_TOKEN}` with your actual token
4. Find your chat ID in the response (look for `"chat":{"id":123456789}`)
5. Add it to `.env.local` as `NEXT_PUBLIC_TELEGRAM_CHAT_ID`

### 5. Run Locally

```bash
npm run dev
```

Open http://localhost:3000

**Admin Access:**
- Click on "AYLENSALE" logo to open admin panel
- Password: `aylen2026`

## 📋 Admin Panel Guide

### Add Products
1. Click AYLENSALE name
2. Enter password: `aylen2026`
3. Fill product details:
   - Title (e.g., "Fresh Apples")
   - Price (e.g., "12")
   - Category (Fruits, Vegetables, Dairy, Bakery)
   - Photo (click to upload)
4. Click "Add Product"

### Upload Photos
- Click "📸 Upload Photo" button
- Select an image from your device
- It will be saved as Base64 in localStorage
- Works offline and persists across sessions

## 🛒 Shopping Features

### Browse Products
- View all products with photos
- Filter by category
- See prices and descriptions

### Add to Cart
- Click "Add to Cart" on any product
- Quantity shown on product card
- Cart items auto-save to localStorage

### Checkout
1. Go to "Your Cart" tab
2. Adjust quantities (+ / −)
3. Fill in your details:
   - Name (required)
   - Phone (required)
   - Email (optional)
4. Click "Place Order"
5. Order sent to Telegram bot instantly!

## 🔨 Auctions

- Active auctions with 3-hour countdown
- Current bid tracking
- Number of bids shown
- Countdown timer updates every second
- Auto-ends when timer reaches zero

## 🌍 Languages

Press language buttons in header to switch:
- 🇬🇧 English
- 🇮🇳 हिंदी (Hindi)
- 🇵🇱 Polski (Polish)
- 🇷🇴 Română (Romanian)
- 🇵🇰 اردو (Urdu)
- 🇱🇻 Latviešu (Latvian)

All text dynamically translates including:
- Navigation tabs
- Product titles
- Cart items
- Messages
- Admin panel

## 📦 Deployment to Vercel

### 1. Connect GitHub

```bash
git init
git add .
git commit -m "Initial AYLENSALE setup"
git remote add origin https://github.com/YOUR_USERNAME/aylensale-com.git
git push -u origin main
```

### 2. Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Or connect on vercel.com and auto-deploy from GitHub

### 3. Add Environment Variables

In Vercel dashboard:
1. Project Settings → Environment Variables
2. Add:
   - `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`: Your token
   - `NEXT_PUBLIC_TELEGRAM_CHAT_ID`: Your chat ID

### 4. Configure Custom Domain

In Vercel dashboard:
1. Settings → Domains
2. Add `aylensale.com`
3. Update your domain DNS to point to Vercel

## 📁 Project Structure

```
aylensale-com/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page
│   └── globals.css         # Global styles
├── components/
│   ├── Header.tsx          # Language switcher & admin toggle
│   ├── Weather.tsx         # Weather widget
│   ├── Auctions.tsx        # Live auctions section
│   ├── Products.tsx        # Product catalog
│   ├── Cart.tsx            # Shopping cart
│   └── AdminPanel.tsx      # Admin interface
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── vercel.json
```

## 🔧 Customization

### Change Admin Password

Edit `AdminPanel.tsx`:
```typescript
if (password === 'aylen2026') {  // Change this
```

### Add More Products

Edit `Products.tsx` - add to the `products` array:
```typescript
{ id: '7', title: 'New Item', price: 20, image: '🍎', category: 'Fruits' }
```

### Add More Languages

Edit `Header.tsx` and other components:
```typescript
if (language === 'new-code') {
  // Add translation here
}
```

### Customize Weather

Edit `Weather.tsx` to add real API integration or more locations

## 📞 Support

For Telegram bot issues:
- Check token format (should start with numbers)
- Verify chat ID is correct
- Test with: `https://api.telegram.org/bot{TOKEN}/getMe`

## 📄 License

MIT - Use freely for personal and commercial projects

---

**Made with ❤️ for AYLENSALE**