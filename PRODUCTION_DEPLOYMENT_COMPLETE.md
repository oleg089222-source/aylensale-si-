# AYLENSALE - Production Deployment Guide

**Status:** Production Ready  
**Platform:** Vercel (Static + Serverless Functions)  
**Current URL:** https://car-sales-uk.vercel.app  
**Date:** May 12, 2026

---

## 📋 Table of Contents

1. [Quick Start (3 minutes)](#quick-start)
2. [Environment Variables](#environment-variables)
3. [Local Development](#local-development)
4. [Deployment to Production](#deployment-to-production)
5. [Admin Panel Setup](#admin-panel-setup)
6. [Editing Products](#editing-products)
7. [Telegram Integration](#telegram-integration)
8. [Security Features](#security-features)
9. [Data Persistence](#data-persistence)
10. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start (3 minutes)

### For First-Time Setup:

```bash
# 1. Navigate to the project directory
cd /Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk

# 2. Install dependencies
npm install

# 3. Create .env.local with your credentials
cp .env.local.example .env.local
# Edit .env.local and add:
#   TELEGRAM_BOT_TOKEN=your_token
#   TELEGRAM_CHAT_ID=your_chat_id
#   ADMIN_PASSWORD=your_secure_password

# 4. Test locally
npm run dev
# Open http://localhost:3000

# 5. Deploy to Vercel
vercel --prod
```

---

## 🔑 Environment Variables

### Required Variables (Production)

All these must be set in Vercel Project Settings:

```
ADMIN_PASSWORD          → Admin panel password (change from default!)
TELEGRAM_BOT_TOKEN      → Your Telegram bot token from @BotFather
TELEGRAM_CHAT_ID        → Chat ID where orders will be sent
```

### Optional Variables

```
CLOUDINARY_CLOUD_NAME   → For advanced image upload (optional)
CLOUDINARY_API_KEY      → For advanced image upload (optional)
CLOUDINARY_API_SECRET   → For advanced image upload (optional)
```

### How to Get These:

#### Telegram Credentials:
1. Message @BotFather on Telegram
2. Create a new bot (command: `/newbot`)
3. Copy the API token provided
4. Get Chat ID:
   - Message your bot
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find the `chat` → `id` value

#### Vercel Environment Variables:
1. Go to [Vercel Dashboard](https://vercel.com)
2. Select "car-sales-uk" project
3. Project Settings → Environment Variables
4. Add all required variables

---

## 💻 Local Development

### Setup:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:3000
```

### Access Admin Panel Locally:

**Desktop:**
- Press `Ctrl+Shift+A` (Windows) or `⌘+Shift+A` (Mac)
- Username: `admin`
- Password: (from ADMIN_PASSWORD in .env.local)

**Mobile:**
- Triple-tap the AYLENSALE logo
- Tap the ⚙️ settings button
- Enter credentials

### Test Data:

Default products, auctions, and locations are loaded from localStorage on first visit.

---

## 🌐 Deployment to Production

### Option 1: Via Vercel Dashboard (Easiest)

1. Push code to GitHub
2. Connect GitHub repo to Vercel
3. Add environment variables in Project Settings
4. Auto-deploys on every push to main branch

### Option 2: Via Vercel CLI (Recommended)

```bash
# First time setup
vercel

# Deploy to production
vercel --prod

# Check deployment status
vercel inspect
```

### Verify Deployment:

1. Visit https://car-sales-uk.vercel.app
2. Test admin access (Ctrl+Shift+A or triple-tap logo)
3. Test order submission (check Telegram for test order)
4. Test image upload (add a product with photo)

---

## 👨‍💼 Admin Panel Setup

### First Login:

1. **Desktop:** `Ctrl+Shift+A` or **Mobile:** Triple-tap logo
2. **Username:** `admin` (fixed)
3. **Password:** Check ADMIN_PASSWORD in Vercel environment variables

### Change Admin Password:

1. Update ADMIN_PASSWORD in Vercel Project Settings
2. Redeploy or wait for next deployment
3. New password takes effect immediately

### Admin Features:

| Feature | Access |
|---------|--------|
| Add Product | Click "+ Product" button in admin toolbar |
| Edit Product | Click "Edit" on any product card |
| Delete Product | Click "Delete" on any product card |
| Add Auction | Click "+ Auction" button |
| Add Location | Click "+ Location" button |
| Upload Photos | Use photo upload in product form |
| Export Data | All data saved in localStorage |

---

## 📦 Editing Products

### Add New Product:

1. Enter Admin Mode (Ctrl+Shift+A or triple-tap)
2. Click "+ Product" button
3. Fill in:
   - **Product Name:** Required
   - **Description:** Optional
   - **Retail Price:** Price for regular customers
   - **Wholesale Price:** Price for bulk orders
   - **Stock:** Number available
   - **Category:** Select from dropdown
   - **Photos:** Upload up to 10 images (JPG, PNG, GIF, WebP)
4. Click "Add Product"

### Edit Existing Product:

1. In Admin Mode, find the product card
2. Click "Edit" button
3. Modify any fields
4. Click "Save Changes"

### Delete Product:

1. In Admin Mode, find the product card
2. Click "Delete" button
3. Confirm deletion

### Bulk Operations:

To export/import all products:

```javascript
// In browser console (F12)
// Export
JSON.stringify(products, null, 2)

// Import
products = [...]; // paste here
localStorage.setItem('aylen_products', JSON.stringify(products));
location.reload();
```

---

## 📱 Telegram Integration

### How It Works:

1. Customer fills order form
2. Clicks "Send Order"
3. Order is validated on server
4. Order is sent to Telegram bot
5. You receive notification immediately

### Telegram Message Format:

```
🎉 NEW ORDER - AYLENSALE

Customer: John Doe
Phone: +447911 123456
Pickup: Battersea Car Boot
Comment: Please pack carefully

Items:
• iPhone 15 Pro x1 = £999.00
• Samsung TV x1 = £599.00

TOTAL: £1598.00
```

### Troubleshooting Telegram:

**Not receiving orders?**
- Check Telegram bot token in Vercel settings
- Check chat ID is correct
- Test: Send message to @aylensale_bot manually
- Check Vercel function logs: https://vercel.com/docs/observability/logging

**Orders stuck in queue?**
- Check internet connection
- Clear browser cache
- Try again - has automatic retry

---

## 🔒 Security Features

### Built-In Protection:

1. **Rate Limiting:** Max 5 orders per hour per IP
2. **Form Validation:** Phone, name, email format validation
3. **Bot Detection:** Simple ML heuristics to block spam
4. **Input Sanitization:** XSS protection on all inputs
5. **Secure Credentials:** Passwords stored in Vercel env vars only
6. **HTTPS:** All traffic encrypted
7. **CORS:** API endpoints protected

### Best Practices:

- ✅ Change ADMIN_PASSWORD immediately
- ✅ Keep Telegram credentials secret
- ✅ Review orders in Telegram before processing
- ✅ Never commit .env.local to Git
- ✅ Use strong admin password (min 12 characters)
- ✅ Monitor Vercel logs for suspicious activity

---

## 💾 Data Persistence

### Where Data Is Stored:

| Data | Storage | Persistence |
|------|---------|-------------|
| Products | Browser localStorage | Per device, synced across tabs |
| Auctions | Browser localStorage | Per device, synced across tabs |
| Locations | Browser localStorage | Per device, synced across tabs |
| Cart | Browser localStorage | Per device only |
| User Session | Browser sessionStorage | Current session only |
| Orders | Telegram (backup) | Telegram chat history |

### Backup Your Data:

```javascript
// Export all data
var backup = {
  products: JSON.parse(localStorage.getItem('aylen_products')),
  auctions: JSON.parse(localStorage.getItem('aylen_auctions')),
  locations: JSON.parse(localStorage.getItem('aylen_locations'))
};
console.log(JSON.stringify(backup));
// Copy output to file
```

### Restore From Backup:

```javascript
// In browser console
var backup = { /* your saved data */ };
localStorage.setItem('aylen_products', JSON.stringify(backup.products));
localStorage.setItem('aylen_auctions', JSON.stringify(backup.auctions));
localStorage.setItem('aylen_locations', JSON.stringify(backup.locations));
location.reload();
```

---

## 🧪 Testing Checklist

Before going live, verify:

- [ ] Admin access works (Ctrl+Shift+A)
- [ ] Can add/edit/delete products
- [ ] Can upload product photos
- [ ] Can add auctions and locations
- [ ] Orders send to Telegram successfully
- [ ] Rate limiting works (try 6 orders in 1 hour)
- [ ] Form validation works (try empty/invalid inputs)
- [ ] Mobile layout responsive (test on iPhone 12+, Android)
- [ ] Cart functionality works
- [ ] Price calculations correct (with discounts)
- [ ] Data persists (reload page, data stays)
- [ ] Works offline (partial functionality)

---

## 🐛 Troubleshooting

### Common Issues:

#### "Admin login not working"
```
✓ Check ADMIN_PASSWORD in Vercel settings
✓ Make sure to use username "admin"
✓ Check browser console (F12) for errors
✓ Clear browser cache and try again
```

#### "Photos not uploading"
```
✓ Check file size (max 5MB)
✓ Check file format (JPG, PNG, GIF, WebP)
✓ Check Cloudinary credentials if using advanced upload
✓ Try Firefox/Chrome instead of Safari
```

#### "Orders not going to Telegram"
```
✓ Check TELEGRAM_BOT_TOKEN in Vercel
✓ Check TELEGRAM_CHAT_ID is correct
✓ Test bot token: curl https://api.telegram.org/bot{TOKEN}/getMe
✓ Check Vercel function logs for errors
```

#### "Data disappeared after refresh"
```
✓ This is expected - localStorage is per-device
✓ Use export/backup feature to save data
✓ Consider adding cloud database (Firebase, MongoDB)
```

#### "Site loads slowly on mobile"
```
✓ Check network in DevTools (F12 → Network)
✓ Minify/compress images before upload
✓ Enable browser caching in Vercel settings
```

---

## 📞 Support Resources

- **Vercel Docs:** https://vercel.com/docs
- **Telegram Bot API:** https://core.telegram.org/bots
- **JavaScript Storage:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- **Status Page:** https://car-sales-uk.vercel.app/status

---

## 🔄 Deployment Checklist

Before production:

```bash
# 1. Update version
git tag v1.0.0

# 2. Set environment variables in Vercel
# - Go to Project Settings > Environment Variables
# - Add: ADMIN_PASSWORD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

# 3. Deploy
vercel --prod

# 4. Verify
# - Test all features
# - Check Vercel logs
# - Test on mobile
# - Verify Telegram integration

# 5. Commit
git add .
git commit -m "Production deployment v1.0.0"
git push
```

---

**Last Updated:** May 12, 2026  
**Version:** 1.0.0 Production Ready  
**Status:** ✅ All systems operational
