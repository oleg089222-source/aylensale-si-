# 🔐 AYLENSALE Admin Panel Guide

## How to Access Admin Panel

### 🖥️ Desktop / Laptop

**Press: `Ctrl + Shift + A`**

This opens the admin login modal.

**Credentials:**
- Username: `admin`
- Password: `admin2024`

### 📱 Mobile / Tablet

1. **Triple-tap** on the AYLENSALE logo (located in the header)
2. An admin button (⚙️) will appear in the bottom-right corner
3. Tap the admin button to open login modal
4. Enter credentials:
   - Username: `admin`
   - Password: `admin2024`

---

## Admin Features

Once logged in, you can manage:

### ➕ Products
- Add new products
- Edit existing products
- Delete products
- Upload photos (up to 10 per product)
- Set wholesale and retail prices
- Manage stock levels

### 🏆 Auctions
- Create live auctions
- Set starting prices
- Set auction duration
- Edit auction details

### 📍 Pickup Locations
- Add pickup points
- Edit location details
- Set pickup schedules

### 📸 Photo Uploads
- Supports JPG, PNG, GIF, WebP
- Max 5MB per image
- Up to 10 photos per product
- Auto-uploaded to Cloudinary
- Fallback to base64 if needed

---

## Product Information

### Required Fields
- Product Name
- Description
- Retail Price
- Wholesale Price
- Category
- Stock Quantity

### Optional Fields
- Photos (1-10)
- Special notes

---

## Telegram Integration

All orders are automatically sent to: **@aylensale_bot**

Order details include:
- Customer name and phone
- Selected items with quantities
- Total price
- Pickup location preference
- Card/discount information

---

## Troubleshooting

**Admin panel not opening?**
- Desktop: Make sure Ctrl+Shift+A is working (some apps may block it)
- Mobile: Try triple-tapping the logo multiple times
- Alternative: Refresh page and try again

**Photo upload not working?**
- Check file size (max 5MB)
- Check file format (JPG, PNG, GIF, WebP)
- Cloudinary config: Check if internet connection is stable
- Fallback will automatically encode as base64 if needed

**Changes not showing?**
- Refresh the page (F5)
- Clear browser cache
- Check browser console for errors

---

## Site Information

**Live Site**: https://car-sales-uk.vercel.app

**Local Development**: http://localhost:3000

**Platform**: Next.js + Vercel

**Photo Storage**: Cloudinary (oleg_yuryevich account)

---

Last Updated: May 12, 2026
