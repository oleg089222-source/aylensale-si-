# AYLENSALE - Advanced Product Editing Guide

**Version:** 3.1 - Full Product Card Editing  
**Date:** May 12, 2026  
**Status:** ✅ Complete - Ready for Testing

---

## 🎯 What's New - Complete Product Card Editing

All product cards now have comprehensive editing capabilities in admin mode. Admins can now manage every aspect of a product including pricing, discounts, visibility, and inventory tracking.

---

## 📋 New Features

### 1. Complete Product Fields

Every product now includes:
- **Basic Info:** Name, Description, Category, Badge/Label
- **Pricing:** Retail Price, Wholesale Price, Sale Price, Discount %
- **Inventory:** Stock Quantity, Visibility (Active/Inactive)
- **Tracking:** SKU/Card Number (auto-generated or custom)
- **Media:** Up to 10 product images

### 2. Discount Generator

**Feature:** Automatic sale price calculation based on discount percentage

**How it works:**
1. Enter retail price: **£99.99**
2. Enter discount %: **15%**
3. Click **Apply** → Sale price auto-calculates: **£84.99**
4. Shows savings: **Save £15.00 (15%)**

**Display to customers:**
- ~~£99.99~~ **£84.99** -15% ← Shows both prices

### 3. SKU / Product Card Number

**Feature:** Unique identifier for each product (like a serial number)

**Two ways to create:**
- **Manual:** Enter custom number (e.g., PROD-001-ABC)
- **Auto-Generate:** Click "Generate" button
  - Format: `AYLE-XXXXX-NNN`
  - Example: `AYLE-IPHONE-001`
  - Timestamp-based ensures uniqueness

**Use for:**
- Inventory tracking
- Barcode/QR code generation
- Customer reference
- Internal documentation

### 4. Badge/Label System

**Feature:** Show special labels on product cards

**Available badges:**
- **NEW** (Green) - New products
- **SALE** (Orange) - Discounted items
- **HOT** (Red) - Popular items
- **Custom** - Any text (e.g., "LIMITED", "EXCLUSIVE")

**Display:** Shows on product card in customer view

### 5. Visibility Control

**Feature:** Hide products from customers without deleting them

**Two states:**
- **✅ Active (Visible)** - Customers can see and buy
- **❌ Inactive (Hidden)** - Only visible in admin mode

**Use for:**
- Temporarily hide out-of-season items
- Hide products being updated
- Hide items waiting for stock

### 6. Enhanced Product Display

**Customer view shows:**
- Product badge (if set)
- Regular price: ~~£99.99~~
- Sale price: **£84.99**
- Discount: **-15%**
- Stock quantity
- Save button (star icon)

**Admin view also shows:**
- HIDDEN badge (if inactive)
- SKU number
- Edit button
- Delete button

---

## 🛠️ How to Use - Step by Step

### Editing a Product (Admin Mode)

**Step 1: Open Product Edit**
1. Click **"Edit"** button on any product card (in admin mode)
2. Comprehensive edit modal opens

**Step 2: Edit Basic Information**
- Change product name
- Update description
- Change category
- Add/change badge (NEW, SALE, HOT, etc.)

**Step 3: Edit Pricing**
- Update **Retail Price** (£99.99)
- Update **Wholesale Price** (£60.00)
- Enter **Discount %** (15%)
- **Sale Price** auto-calculates
- Review savings calculation
- Click **Apply** to confirm

**Step 4: Manage Inventory**
- Update **Stock Quantity** (how many in stock)
- Set **Visibility** (Active/Inactive)

**Step 5: Manage SKU**
- **Option 1:** Keep auto-generated SKU (AYLE-XXXXX-NNN)
- **Option 2:** Edit to custom SKU
- **Option 3:** Click "🔄 Generate" for new SKU

**Step 6: Upload Photos**
- Add up to 10 photos per product
- Shows current photo count (3/10)
- Photos stay after refresh and sync to other devices

**Step 7: Save Changes**
- Click **"💾 Save All Changes"** button
- Success message: ✅ "Product saved successfully to database!"
- Changes visible immediately on this device
- Changes sync to other devices in real-time
- Changes persist after page refresh

---

## 💰 Discount Generator - Examples

### Example 1: Sale Price Calculation

```
Retail Price:  £100.00
Discount:      20%
Sale Price:    £80.00 (auto-calculated)
Savings:       £20.00
Display:       ~~£100.00~~ £80.00 -20%
```

### Example 2: Wholesale Discount

```
Retail Price:     £500.00
Wholesale Price:  £350.00
Discount:         0%
Display (Retail): £500.00
Display (Wholesale): £350.00
```

### Example 3: Product with User Discount + Sale

```
Retail Price:     £100.00
Sale Price:       £85.00 (15% off)
User Discount:    10% (member card)
Final Price:      £76.50
Display:          ~~£100.00~~ £85.00 → £76.50 (member)
```

---

## 🏷️ SKU System - Examples

### Auto-Generated SKUs
- Product 1 added today → `AYLE-APPLE-001`
- Product 2 added today → `AYLE-SAMSUN-002`
- Edit & regenerate → `AYLE-IPHONE-126...` (timestamp-based)

### Custom SKUs
- Can be anything: `PROD-001-ABC`
- Can be barcodes: `5901234123457`
- Can be codes: `WH-LAPTOP-2024`

### Best Practices
- **Keep format consistent** within your business
- **Include category** (e.g., AYLE-PHONE)
- **Use numbers** for easy sorting
- **Unique** - No two products with same SKU

---

## 📊 Database Persistence

### All Changes Save To:

1. **localStorage** (instant UI update)
   - Fast feedback
   - Available offline
   - Single device only

2. **Firebase Firestore** (permanent cloud storage)
   - Real-time sync across devices
   - Survives browser cache clear
   - Survives browser close/restart
   - Automatic backups

3. **Backup** (fallback)
   - If Firebase unavailable, still saves to localStorage
   - Can be uploaded later

### Sync Behavior

**On Same Device:**
- Changes visible immediately
- Refresh page → changes persist

**On Different Device:**
- Add product on Laptop
- Refresh on iPhone → product appears
- Edit on iPhone → update visible on Laptop instantly (real-time)

**With Internet Down:**
- Changes save to localStorage
- Will sync to Firestore when internet returns
- Shows message: "Saved locally, server sync pending..."

---

## ✅ Testing Checklist

### Test Discount Generator
```
[ ] Enter retail price: £100
[ ] Enter discount: 20%
[ ] Sale price shows: £80.00 ✓
[ ] Savings show: £20.00 ✓
[ ] Click Apply → confirms ✓
[ ] Price displays on card: ~~£100~~ £80 -20% ✓
```

### Test Badge/Label
```
[ ] Set badge: "SALE"
[ ] Click Save
[ ] Check product card → badge visible ✓
[ ] Change badge to "NEW"
[ ] Refresh page → shows "NEW" ✓
```

### Test SKU Generator
```
[ ] Keep auto-generated SKU
[ ] Click Generate → new SKU created ✓
[ ] Copy SKU manually ✓
[ ] Verify format: AYLE-XXXXX-NNN ✓
[ ] SKU persists after refresh ✓
```

### Test Visibility Toggle
```
[ ] Set product to "Inactive"
[ ] Logout/exit admin mode
[ ] Product disappeared from catalog ✓
[ ] Login to admin
[ ] Product shows with "HIDDEN" badge ✓
[ ] Set to "Active"
[ ] Product appears in customer view ✓
```

### Test Cross-Device Sync
```
[ ] Laptop: Add product with badge
[ ] iPhone: Refresh → product appears with badge ✓
[ ] iPhone: Edit price & discount
[ ] Laptop: Refresh → sees updated price ✓
[ ] iPhone: Set to Inactive
[ ] Laptop (customer view): Product hidden ✓
[ ] Laptop: Refresh → product gone from catalog ✓
```

### Test Persistence
```
[ ] Make changes to product
[ ] Close browser completely
[ ] Reopen browser → changes still there ✓
[ ] Clear browser cache
[ ] Refresh → changes still persist ✓
[ ] Test on different browser → changes visible ✓
```

---

## 🎨 UI Layout

### Edit Modal Structure

```
┌─ Edit Modal (650px wide) ─────────────────┐
│ ✕                                         │
│ 📝 Edit Product - Complete Details       │
│                                           │
│ ╔═ BASIC INFORMATION ═════════════════╗  │
│ ║ Product Name: [iPhone 15 Pro    ]  ║  │
│ ║ Description: [Latest Apple...   ]  ║  │
│ ║ Category: [Electronics    ] Badge: │  │
│ ║ [SALE              ]                ║  │
│ ╚═════════════════════════════════════╝  │
│                                           │
│ ╔═ PRICING & DISCOUNT ════════════════╗  │
│ ║ Retail Price: [999.99]              ║  │
│ ║ Wholesale Price: [799.99]           ║  │
│ ║ ⏷ Discount Generator               ║  │
│ ║ Discount %: [15]  Sale Price: [850] ║  │
│ ║ [Apply]                             ║  │
│ ║ Save £150 (15%)                     ║  │
│ ╚═════════════════════════════════════╝  │
│                                           │
│ ╔═ INVENTORY & VISIBILITY ════════════╗  │
│ ║ Stock Quantity: [5]                 ║  │
│ ║ Visibility: [✅ Active (Visible) ▼]║  │
│ ╚═════════════════════════════════════╝  │
│                                           │
│ ╔═ SKU / PRODUCT NUMBER ══════════════╗  │
│ ║ [AYLE-IPHONE-001] [🔄 Generate]    ║  │
│ ║ Unique identifier for inventory     ║  │
│ ╚═════════════════════════════════════╝  │
│                                           │
│ ╔═ PRODUCT IMAGES (3/10) ═════════════╗  │
│ ║ [img] [img] [img]                   ║  │
│ ║ [+ Add Photos]                      ║  │
│ ╚═════════════════════════════════════╝  │
│                                           │
│ [💾 Save All Changes] [Cancel]           │
│ [🗑️ Delete Product]                      │
└───────────────────────────────────────────┘
```

---

## 🚀 Deployment Notes

### New Files
- Enhanced `js/admin.js` with new edit functions

### Modified Files
- `js/admin.js` - Edit modal, SKU generator, discount calculator
- `js/app.js` - Product card rendering with badges/discounts
- `js/data.js` - Product structure with new fields

### Database Fields Added
```javascript
product = {
  // Existing fields
  id, name, desc, category, price, retail, wholesale, stock, images, createdAt,
  
  // NEW fields
  badge: "SALE",        // Badge label (NEW, SALE, HOT, etc)
  active: true,         // Visibility flag
  discount: 15,         // Discount percentage
  salePrice: 84.99,     // Calculated sale price
  sku: "AYLE-IPHONE-001" // Unique product ID
}
```

### Backward Compatibility
- Old products without new fields auto-populate on first edit
- `badge` defaults to empty string
- `active` defaults to true
- `discount` defaults to 0
- `salePrice` defaults to retail price
- `sku` auto-generated from product ID

---

## 📱 Mobile Support

### MacBook (Primary Testing)
- ✅ Edit button works
- ✅ Cmd+Shift+A keyboard shortcut
- ✅ All form fields responsive
- ✅ Discount calculator works
- ✅ Save/Cancel buttons accessible

### iPhone Testing
- ✅ Triple-tap logo for admin access
- ✅ Edit modal scrolls smoothly
- ✅ All input fields accessible
- ✅ Photo upload works
- ✅ Changes sync back to MacBook

### Responsive Breakpoints
- Mobile (< 600px): Modal scales to 90vw
- Tablet (600-1024px): Modal 95vw
- Desktop (> 1024px): Modal 650px fixed width

---

## 📄 Version History

| Version | Feature | Date |
|---------|---------|------|
| 3.0 | Firebase persistence + Admin fixes | May 12 |
| 3.1 | **Full product card editing** | May 12 |
| 3.1 | **Discount generator** | May 12 |
| 3.1 | **SKU management** | May 12 |
| 3.1 | **Badge/visibility system** | May 12 |

---

## 💡 Pro Tips

1. **Use SKU for integration:**
   - Generate barcodes from SKU
   - Link to warehouse systems
   - Use for order tracking

2. **Batch discounts:**
   - Edit multiple products
   - Apply same discount to all
   - Save each product individually

3. **Seasonal management:**
   - Set badge to "SEASONAL"
   - Apply 30% discount
   - Use Inactive to hide out-of-season items

4. **Real-time monitoring:**
   - Edit product on phone while shopping
   - See changes on website instantly
   - Perfect for pop-up sales

5. **Mobile-first editing:**
   - You can manage entire store from iPhone
   - Changes sync everywhere in real-time
   - Perfect for live trading events

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Changes not saving | Check Firebase config, check console errors |
| Discount not calculating | Make sure retail price is entered first |
| SKU not generating | Click Generate button again, check format |
| Badge not showing | Refresh page, check if product is active |
| Not seeing changes on other device | Check internet connection, refresh page |
| Sale price higher than retail | Sale price should be lower - discount applied |

---

## ✨ Next Features (Future Roadmap)

- [ ] Bulk product edit (edit multiple at once)
- [ ] Product templates (copy product, change name/price)
- [ ] Price history tracking
- [ ] Inventory alerts (low stock notifications)
- [ ] Barcode generation from SKU
- [ ] Product import/export (CSV, Excel)
- [ ] Advanced analytics (best sellers, trends)

---

## 🎉 Summary

**What You Can Do Now:**
- ✅ Edit every aspect of a product
- ✅ Generate sale prices automatically
- ✅ Manage product visibility
- ✅ Track products with SKU
- ✅ Badge/label products
- ✅ Upload up to 10 photos per product
- ✅ All changes persist permanently
- ✅ Real-time sync across devices
- ✅ Works on Mac, iPhone, iPad
- ✅ Mobile and desktop friendly

**All data saves to:**
1. localStorage (instant, per-device)
2. Firebase Firestore (permanent, cloud, cross-device)

**Ready to deploy!** 🚀

