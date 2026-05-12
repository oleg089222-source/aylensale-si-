# AYLENSALE - Quick Reference Guide

**Production URL:** https://car-sales-uk.vercel.app  
**Version:** 1.0.0 Production Ready  
**Last Updated:** May 12, 2026

---

## 🚀 Production Checklist

### Before Going Live:

- [x] Admin panel secured with password
- [x] Spam protection and rate limiting enabled
- [x] Form validation on client and server
- [x] Telegram bot integration working
- [x] Image uploads with fallback support
- [x] Data persistence in localStorage
- [x] Mobile responsive design
- [x] HTTPS enforced on Vercel
- [x] Environment variables secured

### What's Production Ready:

| Feature | Status | Notes |
|---------|--------|-------|
| Product Catalog | ✅ Ready | Add/Edit/Delete products |
| Auctions | ✅ Ready | Create live auctions |
| Locations | ✅ Ready | Manage pickup points |
| Admin Panel | ✅ Ready | Ctrl+Shift+A or triple-tap logo |
| Orders | ✅ Ready | Send to Telegram immediately |
| Photos | ✅ Ready | Upload JPG/PNG/GIF/WebP |
| Cart | ✅ Ready | Add/remove items |
| Discounts | ✅ Ready | Card-based discounts |
| Mobile | ✅ Ready | Fully responsive |
| Security | ✅ Ready | Rate limiting, validation, bot protection |

---

## 👨‍💼 Admin Access

### Desktop/Mac:
```
Ctrl+Shift+A  (Windows/Linux)
⌘+Shift+A     (Mac)

Username: admin
Password: [From ADMIN_PASSWORD env var]
```

### Mobile (iPhone/Android):
```
1. Triple-tap AYLENSALE logo
2. Tap ⚙️ settings button
3. Login with admin credentials
```

---

## 📦 Managing Products

### Add Product:
```
1. Admin Mode → "+ Product" button
2. Fill in: Name, Price, Stock, Photos
3. Click "Add Product"
```

### Edit Product:
```
1. Find product in Admin Mode
2. Click "Edit" button
3. Modify any field
4. Save
```

### Delete Product:
```
1. Find product in Admin Mode
2. Click "Delete" button
3. Confirm
```

---

## 📩 Order Processing

### How Orders Work:
1. Customer adds items to cart
2. Clicks checkout
3. Fills: Name, Phone, Pickup location
4. Clicks "Send Order"
5. Order validated on server
6. Sent to Telegram immediately
7. You receive notification

### Order Details in Telegram:
```
Customer name
Phone number  
Pickup location
Items ordered
Total price
Discount (if applicable)
Any special comments
```

---

## 🔐 Security

### Built-in Protection:
- Rate limiting (5 orders/hour per IP)
- Phone/email/name validation
- Bot detection (spam filtering)
- No password stored in frontend
- HTTPS encryption
- Secure credential storage

### What to Monitor:
- Check Vercel logs for errors
- Monitor Telegram for suspicious orders
- Review rate limiting stats
- Keep admin password changed

---

## 🌍 Deployment

### Current Setup:
```
Platform: Vercel (Static + Serverless)
Domain: https://car-sales-uk.vercel.app
Build: Static HTML/JS (no build needed)
API: Serverless functions in /api
```

### Deploy Changes:
```bash
# Via Git push (if connected to GitHub)
git add .
git commit -m "Update: ..."
git push

# Or via Vercel CLI
vercel --prod
```

### Environment Variables Needed:
```
ADMIN_PASSWORD          → Admin panel access
TELEGRAM_BOT_TOKEN      → Send orders to Telegram
TELEGRAM_CHAT_ID        → Where to send orders
```

---

## 📊 Data Storage

### What's Stored Where:
```
Products      → Browser localStorage (all devices)
Auctions      → Browser localStorage (all devices)
Locations     → Browser localStorage (all devices)
Cart          → Browser localStorage (per device)
Orders        → Telegram chat (permanent backup)
```

### Backup Your Data:
```javascript
// Open browser DevTools (F12)
// Go to Console tab
// Run this:
var data = {
  products: localStorage.getItem('aylen_products'),
  auctions: localStorage.getItem('aylen_auctions'),
  locations: localStorage.getItem('aylen_locations')
};
console.log(JSON.stringify(data));
// Copy and save to file
```

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Admin won't login | Check ADMIN_PASSWORD in Vercel settings |
| Orders not in Telegram | Verify TELEGRAM_BOT_TOKEN and CHAT_ID |
| Photos won't upload | Check file size <5MB, format JPG/PNG/GIF/WebP |
| Data lost after reload | Use backup/export feature to restore |
| Site slow | Check network in DevTools F12 |
| Mobile layout broken | Clear cache, try different browser |

---

## 📞 Important Links

| Resource | Link |
|----------|------|
| Production Site | https://car-sales-uk.vercel.app |
| Vercel Dashboard | https://vercel.com/dashboard |
| Telegram Bot | @aylensale_bot |
| GitHub Repository | [Your repo URL] |
| Full Deployment Guide | [PRODUCTION_DEPLOYMENT_COMPLETE.md](PRODUCTION_DEPLOYMENT_COMPLETE.md) |

---

## ✅ Production Readiness Verification

Before announcing to customers:

```bash
# 1. Test admin access
# → Ctrl+Shift+A should work

# 2. Add test product with photo
# → Photo should upload and display

# 3. Test order submission
# → Should receive in Telegram within 2 seconds

# 4. Test mobile access
# → Open on iPhone/Android
# → All features should work

# 5. Check Vercel logs
# → No errors in function logs

# 6. Verify environment variables
# → All required vars set in Vercel
```

---

## 🔄 Regular Maintenance

### Daily:
- Monitor Telegram for orders
- Review suspicious orders
- Check Vercel status

### Weekly:
- Backup product data
- Review analytics
- Update products as needed

### Monthly:
- Change admin password
- Review security logs
- Update documentation

---

**Status:** ✅ Production Ready  
**Last Deployed:** [Date of last deployment]  
**Next Review:** [Next maintenance date]

For detailed information, see [PRODUCTION_DEPLOYMENT_COMPLETE.md](PRODUCTION_DEPLOYMENT_COMPLETE.md)
