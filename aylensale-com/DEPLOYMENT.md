# AYLENSALE.COM - Deployment Guide

## ✅ Project Status: READY FOR DEPLOYMENT

The complete AYLENSALE e-commerce platform has been created with all features integrated:

### ✨ What's Included

✅ **Auctions Section**
- 3-hour countdown timers
- Live bid tracking
- Auto-updating display

✅ **Shopping Cart**
- Add/remove items
- Quantity management
- persistent localStorage
- Order submission to Telegram

✅ **Product Management**
- Admin panel (click AYLENSALE)
- Password protected
- Add products with photos
- Photo upload and Base64 storage

✅ **Multi-Language Support**
- English, Hindi, Polish, Romanian, Urdu, Latvian
- Full UI translation
- Language switcher in header

✅ **Telegram Integration**
- Order notifications
- Custom message formatting
- Instant delivery

✅ **Weather Widget**
- Compact display
- Saturday/Sunday forecast
- Auto-updating

✅ **Responsive Design**
- Mobile-first
- Tailwind CSS
- Works on all devices

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Navigate to Project

```bash
cd /Users/olegyuryevich/Desktop/aylensale-si/aylensale-com
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Test Locally

```bash
npm run dev
```

Visit http://localhost:3000
- Test admin panel (password: `aylen2026`)
- Add a product
- Add to cart
- Submit order

### Step 4: Configure Telegram

**You already have:**
- ✅ Bot Token: `8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY`
- Bot Username: `@aylensale_bot`

**Still need:**
- ⏳ Your Telegram Chat ID

**To get Chat ID:**
1. Send a message to @aylensale_bot on Telegram
2. Visit: https://api.telegram.org/bot8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY/getUpdates
3. Look for `"chat":{"id":XXXXXX}` in the response
4. Copy that number

### Step 5: Create .env.local

```bash
# Create the file
cat > .env.local << 'EOF'
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY
NEXT_PUBLIC_TELEGRAM_CHAT_ID=YOUR_CHAT_ID_HERE
EOF
```

Replace `YOUR_CHAT_ID_HERE` with the actual ID from Step 4

### Step 6: Deploy to Vercel

```bash
# Install Vercel CLI globally (if not already)
npm install -g vercel

# Deploy to production
vercel --prod
```

Follow the prompts:
- Link to GitHub account
- Select project scope
- Accept deployment

### Step 7: Configure aylensale.com Domain

In Vercel Dashboard:
1. Go to Settings → Domains
2. Add `aylensale.com`
3. Follow DNS configuration instructions for your registrar

### Step 8: Add Environment Variables to Vercel

In Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN = 8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY
NEXT_PUBLIC_TELEGRAM_CHAT_ID = YOUR_CHAT_ID
```

---

## 🧪 Testing After Deployment

### Test 1: Visit Site
- Open https://aylensale.com
- Check all UI loads correctly

### Test 2: Admin Panel
- Click AYLENSALE logo
- Enter password: `aylen2026`
- Add a test product
- Verify it appears in Products section

### Test 3: Shopping
- Add items to cart
- Adjust quantities
- Submit order
- Check Telegram bot receives message

### Test 4: Languages
- Click each language button
- Verify all text translates

### Test 5: Auctions
- Check countdown timers work
- Timer should count down every second

---

## 📝 Quick Admin Guide

### Click AYLENSALE Logo to Open Admin

**Add Product:**
1. Title: e.g., "Fresh Apples"
2. Price: e.g., "12"
3. Category: Select from dropdown
4. Photo: Click button to upload
5. Click "Add Product"

**Products Auto-Save**
- All products saved to localStorage
- Persist across page reloads
- Can access from any device/browser (consider Firebase for cloud sync)

---

## 🔗 Project Links

- **GitHub**: https://github.com/oleg089222-source/aylensale-si-
- **Production**: https://aylensale.com (after DNS setup)
- **Vercel Dashboard**: https://vercel.com/olegyuryevich-5608s-projects/aylensale-com

---

## ⚙️ Configuration

### Telegram Bot Token
```
8755212472:AAGlOOBDtFfE5JKXbQubw1T9BQm_0ctiEXY
```

### Admin Password
```
aylen2026
```

### Supported Languages
- 🇬🇧 English
- 🇮🇳 हिंदी Hindi
- 🇵🇱 Polski Polish
- 🇷🇴 Română Romanian
- 🇵🇰 اردو Urdu
- 🇱🇻 Latviešu Latvian

### Default Products
6 sample products included (Fresh Apples, Carrots, Tomatoes, Bananas, Lettuce, Strawberries)

---

## 📞 Troubleshooting

### Orders not received on Telegram?
- [ ] Check Chat ID is correct
- [ ] Verify bot token is set in .env.local
- [ ] Send manual test: `https://api.telegram.org/botYOUR_TOKEN/sendMessage?chat_id=YOUR_CHAT_ID&text=Test`

### Products not saving?
- [ ] Check localStorage is enabled in browser
- [ ] Check browser console for errors (F12)
- [ ] Try clearing cache and refreshing

### Language not translating?
- [ ] Refresh page after changing language
- [ ] Check browser console for errors
- [ ] All text should switch automatically

---

## 🎉 You're Ready!

The AYLENSALE.COM e-commerce platform is fully functional and ready to deploy!

Next Steps:
1. ✅ Complete Telegram Chat ID setup
2. ✅ Deploy to Vercel with `vercel --prod`
3. ✅ Configure aylensale.com domain
4. ✅ Test all features
5. ✅ Add real product photos via admin panel
6. ✅ Go live! 🚀