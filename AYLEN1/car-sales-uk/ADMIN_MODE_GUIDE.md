# Admin Mode Setup & Usage

## Architecture Change

The site has been restructured to use a **unified single-site architecture** with embedded admin mode instead of a separate admin.html file.

### What Changed

1. **Deleted**: `admin.html` - separate admin control panel
2. **Created**: `js/admin.js` - admin functionality embedded in main site
3. **Created**: `api/send-order.js` - serverless function for secure Telegram integration
4. **Updated**: `index.html` - now includes admin mode with Ctrl+Shift+A shortcut
5. **Updated**: `js/app.js` - render functions now show admin controls in admin mode
6. **Updated**: `js/app.js` - sendOrder() now uses /api/send-order endpoint

## How to Access Admin Mode

### Public Site (Default)
Visit https://www.aylensale.com - normal public experience

### Admin Mode Access
Press **Ctrl+Shift+A** (Windows/Linux) or **Cmd+Shift+A** (Mac) to open admin login dialog

**Default credentials:**
- Username: `admin`
- Password: `admin2024`

### What Admin Mode Does

When logged in, admin mode shows:
1. **Admin toolbar** in header with buttons to add new items
2. **Edit/Delete buttons** on each product card
3. **Edit/Delete buttons** on each auction card  
4. **Edit/Delete buttons** on each location card

Admin can:
- Add/Edit/Delete products
- Add/Edit/Delete auctions
- Add/Edit/Delete pickup locations
- All changes persist in localStorage

## Telegram Order Sending

### Previous Issue
Orders failed with "Network error" because:
- Direct Telegram API calls from browser (CORS issue)
- Bot token exposed in frontend code
- No error handling

### Solution Implemented
Created `/api/send-order.js` serverless function that:
- Handles order submission securely
- Keeps bot token in backend (environment variable)
- Properly formats message for Telegram
- Returns success/error status to frontend

### Setup for Production

**Vercel Environment Variables** (set in project settings):
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

These credentials are:
- NOT exposed in frontend code
- NOT stored in git
- Only accessible on Vercel serverless environment
- Sent via environment variables at runtime

### Testing Telegram Orders

1. Open site: https://www.aylensale.com
2. Add products to cart
3. Click checkout and fill in order form
4. Click "Send Order"
5. Check your Telegram chat - order should appear there

## File Structure

```
car-sales-uk/
├── index.html              (main site with embedded admin)
├── api/
│   └── send-order.js       (serverless Telegram handler)
├── js/
│   ├── admin.js            (admin functions)
│   ├── app.js              (public & admin UI)
│   ├── config.js           (admin credentials)
│   ├── data.js             (data layer)
│   ├── firebase-config.js
│   └── cloudinary-config.js
└── css/
    └── style.css
```

## Data Persistence

All data is stored in browser localStorage with `aylen_` prefix:
- `aylen_products` - product catalog
- `aylen_auctions` - auction listings
- `aylen_locations` - pickup locations
- `aylen_auctionBids` - bid history
- `aylen_system_initialized_v1` - initialization flag

Admin changes are immediately persisted and survive page reloads.

## Backend API Endpoint

### POST /api/send-order

**Request body:**
```javascript
{
  name: "Customer Name",
  phone: "+44123456789",
  pickup: "London Store",
  comment: "Optional comment",
  items: [
    {name: "Item 1", qty: 2, price: 29.99},
    {name: "Item 2", qty: 1, price: 49.99}
  ],
  total: "109.97",
  card: "CARD123" (optional),
  discount: 10 (optional)
}
```

**Response on success:**
```javascript
{
  success: true,
  message: "Order sent successfully!",
  messageId: 12345  // Telegram message ID
}
```

**Response on error:**
```javascript
{
  error: "Error description",
  details: "Additional error info"
}
```

## Security Notes

1. Admin login credentials hardcoded in config.js (for demo)
   - For production: implement proper auth system
   - Consider: API authentication, JWT tokens, etc.

2. Telegram bot token:
   - Never exposed in frontend
   - Always use Vercel environment variables
   - Rotate token if compromised

3. Data validation:
   - Frontend validates required fields
   - Backend validates again before sending
   - Consider: rate limiting, abuse detection

## Testing Locally

1. Open `index.html` in browser (or use local server)
2. Press Ctrl+Shift+A to open admin login
3. Login with admin/admin2024
4. Use toolbar buttons to add/edit/delete items
5. Disable admin mode by clicking "Exit" button

Note: Telegram orders will fail locally without real bot token & environment setup.

## Deployment Checklist

Before deploying to production:

- [ ] Set TELEGRAM_BOT_TOKEN env var on Vercel
- [ ] Set TELEGRAM_CHAT_ID env var on Vercel
- [ ] Test order submission in staging
- [ ] Verify Telegram messages arrive
- [ ] Check admin mode access works
- [ ] Test all CRUD operations
- [ ] Verify localStorage persistence
- [ ] Test on mobile devices

## Future Improvements

1. Implement real admin authentication (not hardcoded)
2. Add audit logging for admin actions
3. Add image upload from admin interface
4. Add product inventory management
5. Add order history/tracking
6. Add export functionality for orders
7. Add notification preferences
8. Add scheduled auctions
9. Implement role-based access (admin/moderator/user)
10. Add backup/restore functionality
