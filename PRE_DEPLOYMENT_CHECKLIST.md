# AYLENSALE - Pre-Deployment Checklist

**Version:** 2.0.0 Production Release  
**Date:** May 12, 2026  
**Duration:** ~25 minutes to complete all steps

---

## ⏰ Timeline

| Task | Time | Status |
|------|------|--------|
| Set Vercel Env Variables | 5 min | ⏳ |
| Create Telegram Bot | 5 min | ⏳ |
| Deploy to Production | 2 min | ⏳ |
| Verify Deployment | 5 min | ⏳ |
| Test All Features | 10 min | ⏳ |
| Document & Go Live | 2 min | ⏳ |
| **TOTAL** | **29 min** | ⏳ |

---

## 📝 Pre-Deployment Checklist

### Step 1: Prepare Telegram Bot (5 minutes)

```
⏳ Step 1a: Create Bot
  ☐ Message @BotFather on Telegram
  ☐ Send: /newbot
  ☐ Enter bot name: "AYLENSALE Bot" (or your choice)
  ☐ Enter username: "aylensale_orders_bot" (must be unique)
  ☐ Copy bot token (starts with numbers:)
  ☐ Paste here: ___________________________________
  
⏳ Step 1b: Create Orders Channel
  ☐ Create new Telegram group or channel
  ☐ Add bot to group/channel
  ☐ Get Chat ID:
    • Message your bot
    • Visit: https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
    • Look for "chat": { "id": xxxxxx }
    • Copy the ID number
  ☐ Chat ID: ___________________________________
  
⏳ Step 1c: Test Bot
  ☐ Send message to bot: /start
  ☐ Bot should respond
  ☐ Send message to group should appear
```

### Step 2: Set Vercel Environment Variables (5 minutes)

```
⏳ Step 2a: Open Vercel Dashboard
  ☐ Go to https://vercel.com/dashboard
  ☐ Click on "car-sales-uk" project
  ☐ Click "Settings" tab
  ☐ Select "Environment Variables"
  
⏳ Step 2b: Add Required Variables
  ☐ Click "Add Environment Variable"
  ☐ Add ADMIN_PASSWORD:
     Name: ADMIN_PASSWORD
     Value: [Create strong password: at least 12 chars, mix of letters/numbers/symbols]
     Value: ___________________________________
     Environments: Production + Development + Preview
     ☐ Click Add
     
  ☐ Click "Add Environment Variable"
  ☐ Add TELEGRAM_BOT_TOKEN:
     Name: TELEGRAM_BOT_TOKEN
     Value: [Paste from Step 1a]
     Value: ___________________________________
     Environments: Production only (optional: Preview)
     ☐ Click Add
     
  ☐ Click "Add Environment Variable"
  ☐ Add TELEGRAM_CHAT_ID:
     Name: TELEGRAM_CHAT_ID
     Value: [Paste from Step 1b]
     Value: ___________________________________
     Environments: Production only
     ☐ Click Add
     
⏳ Step 2c: Verify Variables Set
  ☐ Refresh the page
  ☐ Verify all 3 variables appear in list
  ☐ Verify "Production" is checked for all
```

### Step 3: Deploy to Production (2 minutes)

```
⏳ Step 3a: Deploy via GitHub (if connected)
  ☐ All changes already committed (done earlier)
  ☐ Push to main branch:
     git push origin main
  ☐ Vercel will auto-deploy
  ☐ Wait for deployment to complete
  
  OR
  
⏳ Step 3b: Deploy via Vercel CLI
  ☐ Open terminal
  ☐ Navigate to: cd /Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk
  ☐ Run: vercel --prod
  ☐ Follow prompts (confirm project, build settings)
  ☐ Wait for deployment: "✓ Production"
  
⏳ Step 3c: Verify Deployment
  ☐ Go to https://vercel.com/dashboard
  ☐ Check "car-sales-uk" shows "✓ Ready"
  ☐ Check Deployments tab shows latest with green checkmark
  ☐ Click on latest deployment to view build logs
  ☐ Verify no errors in logs
```

### Step 4: Test in Production (10 minutes)

```
⏳ Test 4a: Access Production Site
  ☐ Visit: https://car-sales-uk.vercel.app
  ☐ Page loads (should be < 2 seconds)
  ☐ Logo displays "AYLENSALE"
  ☐ Navigation visible
  ☐ Products visible
  
⏳ Test 4b: Test Admin Access
  Desktop:
  ☐ Press Ctrl+Shift+A (Windows) or ⌘+Shift+A (Mac)
  ☐ Login modal appears
  ☐ Enter: admin / [ADMIN_PASSWORD from Step 2b]
  ☐ Click "Login"
  ☐ ✓ Admin mode should activate (see toolbar)
  
  Mobile:
  ☐ Open site on iPhone or Android
  ☐ Triple-tap AYLENSALE logo
  ☐ Tap ⚙️ settings button
  ☐ Enter same credentials
  ☐ ✓ Admin mode should activate
  
⏳ Test 4c: Add Test Product
  ☐ Click "+ Product" button
  ☐ Fill in test product:
     Name: "Test Product"
     Price: £99.99
     Stock: 1
  ☐ Click "Add Product"
  ☐ ✓ Product should appear in catalog
  
⏳ Test 4d: Test Order Submission
  ☐ Click on test product → "Add to Cart"
  ☐ Click shopping cart icon
  ☐ Click "Order" button
  ☐ Fill in test order:
     Name: "Test Customer"
     Phone: "+447911123456"
     Pickup: "Select a location"
  ☐ Click "Send Order"
  ☐ ✓ Should see "Order sent successfully!"
  
⏳ Test 4e: Verify Telegram Notification
  ☐ Check your Telegram group/channel
  ☐ ✓ Should see order message within 2 seconds:
     Customer: Test Customer
     Phone: +447911123456
     Items: Test Product x1 = £99.99
     Total: £99.99
     
⏳ Test 4f: Test Rate Limiting
  ☐ Try to submit 6 orders in a row
  ☐ 5th order should succeed
  ☐ 6th order should fail with: "Too many orders"
  ☐ Wait 1 hour, try again
  ☐ ✓ Should work after cooldown
  
⏳ Test 4g: Test Form Validation
  ☐ Try to submit order with empty name
  ☐ ✓ Should fail with validation error
  ☐ Try to submit with invalid phone
  ☐ ✓ Should fail with validation error
  
⏳ Test 4h: Test on Mobile
  ☐ Open https://car-sales-uk.vercel.app on iPhone
  ☐ ✓ Layout should be responsive
  ☐ ✓ All buttons should be clickable
  ☐ ✓ Forms should be usable
  ☐ ✓ No horizontal scrolling
  
⏳ Test 4i: Test Data Persistence
  ☐ Add another test product
  ☐ Reload the page (Cmd+R or Ctrl+R)
  ☐ ✓ Products should still be there
  ☐ ✓ Cart should persist
```

### Step 5: Go Live! (2 minutes)

```
⏳ Step 5a: Final Checks
  ☐ All tests from Step 4 passed
  ☐ Telegram notifications working
  ☐ Admin access working
  ☐ No errors in Vercel logs
  
⏳ Step 5b: Announce to Customers
  ☐ Update status: "✅ LIVE"
  ☐ Share link: https://car-sales-uk.vercel.app
  ☐ Send to stakeholders:
     "AYLENSALE is now live! Orders go directly to Telegram."
     
⏳ Step 5c: Monitor First Day
  ☐ Keep Telegram open
  ☐ Respond to test orders
  ☐ Monitor Vercel logs for errors
  ☐ Note any issues for fixes
```

---

## ⚠️ Common Issues & Quick Fixes

### Issue: Admin Login Not Working

```
Check 1: Verify ADMIN_PASSWORD in Vercel
  ☐ Go to Vercel Dashboard → Settings → Environment Variables
  ☐ Find ADMIN_PASSWORD
  ☐ Verify it's set for Production environment
  
Check 2: Clear browser cache
  ☐ Press Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
  ☐ Clear "Cached images and files"
  
Check 3: Check browser console for errors
  ☐ Press F12
  ☐ Click "Console" tab
  ☐ Look for red error messages
  ☐ Try admin login again
  ☐ See what error appears
```

### Issue: Orders Not Reaching Telegram

```
Check 1: Verify TELEGRAM_BOT_TOKEN
  ☐ Go to Vercel Dashboard → Settings → Environment Variables
  ☐ Verify TELEGRAM_BOT_TOKEN matches what @BotFather gave you
  
Check 2: Verify TELEGRAM_CHAT_ID
  ☐ Message your bot again
  ☐ Check getUpdates API again
  ☐ Verify Chat ID is correct (negative for groups)
  
Check 3: Check Vercel function logs
  ☐ Go to Vercel Dashboard → Functions
  ☐ Click "send-order" function
  ☐ Check logs for error messages
  ☐ Look for "Telegram error" or similar
  
Check 4: Test bot token manually
  ☐ Open: https://api.telegram.org/bot{TOKEN}/getMe
  ☐ Should return JSON with bot info
  ☐ If error appears, token is invalid
```

### Issue: Site Loading Slowly

```
Check 1: Network performance
  ☐ Press F12
  ☐ Go to "Network" tab
  ☐ Reload page
  ☐ Check which files are slow (red/orange)
  
Check 2: Check image sizes
  ☐ Make sure product images are < 500KB
  ☐ Compress images before uploading
  
Check 3: Check Vercel performance
  ☐ Go to Vercel Dashboard → Analytics
  ☐ Check if functions are timing out
  ☐ Check if there are many errors
```

---

## 🔐 Security Reminders

Before going live:

```
⚠️ CRITICAL:
  ☐ ADMIN_PASSWORD is NOT "admin2024"
  ☐ ADMIN_PASSWORD is minimum 12 characters
  ☐ ADMIN_PASSWORD has mix of letters/numbers/symbols
  ☐ TELEGRAM_BOT_TOKEN is kept secret
  ☐ Never share TELEGRAM_BOT_TOKEN publicly
  
  ☐ .env.local is NOT committed to Git
  ☐ Check .gitignore includes .env*.local
  ☐ No credentials in Git history
  
  ☐ Vercel environment variables are set to Production
  ☐ Database credentials (if any) are in env vars, not code
  ☐ API keys are not hardcoded anywhere
```

---

## 📋 Sign-Off Checklist

```
☐ Step 1: Telegram bot created and tested
☐ Step 2: Vercel environment variables set (all 3)
☐ Step 3: Code deployed to production
☐ Step 4a: Site loads in browser
☐ Step 4b: Admin access works (desktop & mobile)
☐ Step 4c: Can add products
☐ Step 4d: Orders submit successfully
☐ Step 4e: Telegram receives orders
☐ Step 4f: Rate limiting works
☐ Step 4g: Form validation works
☐ Step 4h: Mobile layout responsive
☐ Step 4i: Data persists after reload
☐ Step 5: Ready for customers

SIGNED OFF BY: ________________________  DATE: ___________

✅ APPROVED FOR PRODUCTION
```

---

## 📞 Emergency Contacts

If something goes wrong:

1. **Check Status Page:** https://www.vercelstatus.com/
2. **Vercel Support:** https://vercel.com/support
3. **Telegram Bot Issues:** @BotFather
4. **Check Logs:** https://vercel.com/dashboard → Functions → Logs

---

## 🚀 Ready to Go Live?

Print this checklist and work through it step by step. Don't skip any steps!

**Estimated time:** 25 minutes  
**Difficulty:** Easy (no coding required)  
**Success rate:** 99% (if all steps followed)

---

**Next Step:** Follow the steps above in order. If you get stuck, check "Common Issues & Quick Fixes" section.

**Good luck! 🚀**
