# Telegram Integration Setup Guide

## Status: ⚠️ NOT YET CONFIGURED

The Telegram integration code is **ready** in `/api/send-order.js`, but you need to:
1. Create a Telegram Bot via BotFather
2. Get Bot Token and Chat ID
3. Configure environment variables in Vercel

---

## Step 1: Create Telegram Bot with BotFather

1. **Open Telegram** and search for `@BotFather`
2. **Start the bot** and send `/start`
3. **Send command** `/newbot`
4. **BotFather will ask**:
   - **Name**: "AYLENSALE Orders" (or your choice)
   - **Username**: "aylensale_orders_bot" (must end with `_bot`)
5. **BotFather responds** with:
   ```
   Done! Congratulations on your new bot. You will find it at t.me/aylensale_orders_bot. 
   You can now add a description, about section and commands. 
   Commands you can add with /setcommands.
   
   Use this token to access the HTTP API:
   123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
   ```
   **SAVE THIS TOKEN!** This is your `TELEGRAM_BOT_TOKEN`

---

## Step 2: Get Your Chat ID

1. **Send a message to your bot** at `t.me/aylensale_orders_bot`
   - Send any text, like "test"
2. **Get Chat ID** by visiting this URL in browser:
   ```
   https://api.telegram.org/bot123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh/getUpdates
   ```
   Replace `123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh` with your bot token
3. **Look for** in the JSON response:
   ```json
   {
     "ok": true,
     "result": [
       {
         "message": {
           "chat": {
             "id": -987654321,
             ...
           }
         }
       }
     ]
   }
   ```
   The `"id": -987654321` is your `TELEGRAM_CHAT_ID`

---

## Step 3: Set Vercel Environment Variables

### Local Development (for testing)

Create file: `AYLEN1/car-sales-uk/.env.local`
```
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh
TELEGRAM_CHAT_ID=-987654321
```

### Vercel Production

1. **Go to**: https://vercel.com/dashboard/projects
2. **Select** car-sales-uk project
3. **Go to** Settings → Environment Variables
4. **Add two variables**:
   - Name: `TELEGRAM_BOT_TOKEN`
     Value: `123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh`
   - Name: `TELEGRAM_CHAT_ID`
     Value: `-987654321`
5. **Click** "Save"
6. **Redeploy** the project (Settings → Deployments → Redeploy)

---

## Step 4: Test the Integration

### Local Test (if running locally):

```bash
cd /Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk
python3 -m http.server 8000
```

Then:
1. Open http://localhost:8000/index.html?v=2
2. Add product to cart
3. Click "Checkout"
4. Fill in form and click "Send Order"
5. Check if order appears in your Telegram bot

### Production Test (Vercel):

1. Go to your Vercel deployment URL
2. Add product to cart
3. Complete checkout
4. Check if order appears in your Telegram bot

---

## Verification Checklist

- [ ] BotFather created bot ✅
- [ ] Bot Token obtained (starts with numbers:) ✅
- [ ] Chat ID obtained (negative number) ✅
- [ ] Environment variables set in Vercel ✅
- [ ] Vercel project redeployed ✅
- [ ] Test order received in Telegram ✅

---

## Troubleshooting

**Problem**: "Telegram not configured" error
- **Solution**: Check that TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in Vercel environment

**Problem**: Order doesn't appear in Telegram
- **Solution**: 
  - Verify bot token is correct (test URL from Step 2)
  - Verify chat_id is correct (should be negative number)
  - Check that `/api/send-order` is reachable

**Problem**: "Method not allowed" error
- **Solution**: Make sure you're sending a POST request, not GET

---

## Current Status

**Backend API (`/api/send-order.js`)**: ✅ Ready
```javascript
- Receives order data
- Validates required fields
- Sends formatted message to Telegram
- Returns success/error response
```

**Frontend (`sendOrder()`)**: ✅ Ready
```javascript
- Collects order data from form
- Sends POST to /api/send-order
- Shows success/error notification
- Clears cart on success
```

**Environment Variables**: ❌ Not configured yet
- Need to create Telegram bot
- Need to set in Vercel

---

## Next Steps

1. Create Telegram bot with BotFather (Steps 1-2)
2. Set environment variables in Vercel (Step 3)
3. Test the integration (Step 4)
4. Verify photos are also being saved (separate process)
5. Full end-to-end testing

---

**Need help?** Check:
- Telegram Bot API docs: https://core.telegram.org/bots/api
- Vercel environment variables: https://vercel.com/docs/concepts/projects/environment-variables
