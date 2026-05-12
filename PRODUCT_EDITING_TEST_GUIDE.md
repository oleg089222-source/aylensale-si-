# AYLENSALE v3.1 - TESTING & DEPLOYMENT GUIDE

**Status:** ✅ Ready for Testing & Production Deployment  
**Version:** 3.1 - Full Product Editing  
**Date:** May 12, 2026

---

## 🧪 LOCAL TESTING (MacBook)

### Prerequisites
```bash
cd /Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk
npm install
```

### Test 1: Admin Access & Product Edit

**Step 1: Start Server**
```bash
npm run dev
# Opens http://localhost:3000
```

**Step 2: Open Admin Panel**
- Mac: Press `⌘ + Shift + A`
- Or click 🔑 button in header
- Enter admin password
- ✅ Admin panel appears

**Step 3: Edit Existing Product**
1. Find "iPhone 15 Pro" product
2. Click "Edit" button
3. Comprehensive edit modal opens ✓

**Step 4: Test Discount Calculator**
1. Change Retail Price: 999 → 1200
2. Enter Discount %: 15
3. Watch Sale Price auto-calculate: 1020
4. See savings: £180
5. Click "Apply" ✓

**Step 5: Edit SKU**
1. Current: AYLE-IPHONE-001
2. Click "Generate" button
3. SKU changes to new value ✓
4. Copy and manually edit to: TEST-PROD-001 ✓

**Step 6: Add Badge**
1. Badge field: (empty)
2. Type: "NEW"
3. Click Save ✓

**Step 7: Save Changes**
1. Click "💾 Save All Changes"
2. See message: ✅ "Product saved successfully to database!"
3. Modal closes
4. Product card updates ✓

**Step 8: Verify Changes Persist**
1. Refresh page (Cmd+R)
2. Product shows NEW badge ✓
3. Price shows discount ✓
4. SKU shows TEST-PROD-001 ✓

---

### Test 2: Visibility Toggle

**Step 1: Set Product Inactive**
1. Click Edit on a product
2. Visibility: Set to "❌ Inactive (Hidden)"
3. Click Save
4. Modal closes ✓

**Step 2: Check Customer View**
1. Exit admin mode (close modal or click elsewhere)
2. Product should disappear from catalog ✓

**Step 3: Check Admin View**
1. Reopen admin panel
2. Product shows with "HIDDEN" badge ✓

**Step 4: Reactivate**
1. Click Edit
2. Visibility: Set to "✅ Active (Visible)"
3. Click Save
4. Product reappears in customer view ✓

---

### Test 3: Photo Management

**Step 1: Add Photos**
1. Click Edit on product
2. Scroll to "PRODUCT IMAGES" section
3. Click "Add More Photos"
4. Select 2-3 JPG files
5. Wait for upload ✓

**Step 2: Verify Photos**
1. Photos appear in preview
2. Count increases (e.g., 5/10) ✓

**Step 3: Remove Photo**
1. Click ✕ on one of the thumbnail
2. Confirm deletion
3. Photo count decreases ✓

**Step 4: Persist Check**
1. Refresh page (Cmd+R)
2. Photos still there ✓

---

### Test 4: Multiple Discounts

**Scenario:** Product with two discounts
1. Create new product: "Test Item" - £100
2. Edit → Set discount 20% → Sale price = £80
3. Save ✓

**Check display:**
- Customer view: ~~£100~~ **£80** **-20%** ✓
- Shows old price crossed out
- Shows new price in green
- Shows discount percentage in orange

---

### Test 5: Mobile-Like Testing (on MacBook)

**Using Chrome DevTools:**
1. Press F12 (DevTools)
2. Press Ctrl+Shift+M (Mobile View)
3. Set to iPhone 12/13/14
4. Test:
   - Edit button accessible ✓
   - Edit modal scrolls ✓
   - Input fields accessible ✓
   - Save button works ✓
   - Changes persist ✓

---

## 📱 iPhone TESTING

### Setup
1. On MacBook: Run `npm run dev`
2. Get local IP: Run `ifconfig | grep "inet "`
3. On iPhone: Open `http://[YOUR_IP]:3000`

### Test 1: Admin Access on iPhone

**Step 1: Open Admin**
- Triple-tap AYLENSALE logo
- Or click 🔑 button
- Admin login appears ✓

**Step 2: Edit Product**
1. Login to admin
2. Find any product
3. Click Edit button ✓
4. Modal opens full-screen on phone ✓

**Step 3: Scroll Modal**
1. Scroll up/down in modal
2. All sections accessible ✓
3. No parts hidden off-screen ✓

**Step 4: Edit Fields**
1. Change product name ✓
2. Enter discount ✓
3. Click Save ✓
4. Changes apply immediately ✓

---

### Test 2: Cross-Device Sync (Critical!)

**Setup:** 
- MacBook with dev server running
- iPhone viewing same localhost URL

**Test A: Add Product on iPhone**
1. On iPhone: Edit product, add badge "HOT"
2. On MacBook: Refresh page
3. ✅ Laptop sees "HOT" badge ✓

**Test B: Edit Product on Laptop**
1. On MacBook: Edit, change price 100→200
2. On iPhone: Refresh page
3. ✅ iPhone shows new price ✓

**Test C: Hide Product**
1. On MacBook admin: Set product to Inactive
2. On iPhone (customer view): Refresh
3. ✅ Product disappears ✓

**Test D: Real-time Sync** (Firestore only)
1. Open same product edit on both devices
2. Change field on laptop
3. ✅ iPhone shows change immediately (if Firestore connected)
4. Or ✅ shows on refresh (if using localStorage fallback)

---

## 🌐 PRODUCTION TESTING (Vercel)

### Step 1: Deploy to Vercel

```bash
cd /Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk
git push origin main
# Vercel auto-deploys on push
# Wait 2-3 minutes
```

### Step 2: Verify Deployment

1. Visit production URL: https://car-sales-uk.vercel.app
2. Check browser console (F12)
3. Should see: `✓ Firebase Firestore initialized`
4. ✅ No errors

---

### Test 1: Production Admin Access

**Test on Desktop:**
1. Visit https://car-sales-uk.vercel.app
2. Press `⌘ + Shift + A` (Mac) or `Ctrl + Shift + A` (Windows)
3. Admin login appears ✓
4. Enter admin password
5. Click "Edit" on product
6. Edit modal opens ✓
7. Change discount, save
8. Check product card shows discount ✓
9. Refresh page → changes persist ✓

**Test on iPhone:**
1. Visit https://car-sales-uk.vercel.app on iPhone
2. Triple-tap logo → admin button appears
3. Click admin button → login
4. Click Edit on product
5. Modal opens, fully accessible ✓
6. Make changes, save
7. Changes visible ✓

---

### Test 2: Production Cross-Device Sync

**Requirement:** Firebase must be set up with real credentials

**Setup:**
1. Laptop: Open https://car-sales-uk.vercel.app
2. iPhone: Open same URL
3. Login admin on both

**Test:**
1. Laptop: Edit product, add badge "SALE"
2. iPhone: Refresh page
3. ✅ Badge appears on iPhone
4. iPhone: Change price 100→150
5. Laptop: Refresh page
6. ✅ Laptop sees new price
7. Both can simultaneously edit, changes visible to both

---

### Test 3: Data Persistence Across Sessions

**Test:**
1. Add product on production
2. Close browser completely
3. Reopen browser
4. ✅ Product still there (from Firestore cloud)
5. Close laptop
6. Open on iPhone
7. ✅ Product visible (same Firestore data)

---

### Test 4: Full Product Lifecycle

```
1. Create new product
   ✓ Name: "Test Widget"
   ✓ Price: £99.99
   ✓ Discount: 10%
   ✓ Sale Price: £89.99
   ✓ Badge: "NEW"
   ✓ Stock: 5
   ✓ Upload 2 photos
   ✓ Click Save
   ✅ Product appears on site

2. Edit product (multiple times)
   ✓ Change price to £129.99
   ✓ Change discount to 20%
   ✓ Sale price updates to £103.99
   ✓ Add "HOT" badge
   ✓ Upload 2 more photos
   ✓ Click Save
   ✅ All changes visible

3. Set to Inactive
   ✓ Visibility: Inactive
   ✓ Click Save
   ✅ Product disappears from customer view

4. Reactivate
   ✓ Edit → Active
   ✓ Click Save
   ✅ Product reappears with all changes intact

5. Verify Persistence
   ✓ Refresh page
   ✓ Close browser, reopen
   ✓ Test on different device
   ✅ Everything still there
```

---

## ✅ COMPLETE TEST CHECKLIST

### Admin Access
- [ ] Mac Cmd+Shift+A works
- [ ] Windows Ctrl+Shift+A works
- [ ] 🔑 Button visible and works
- [ ] Mobile triple-tap works
- [ ] iPhone admin button works

### Product Editing
- [ ] Edit button visible on each product
- [ ] Edit modal opens (desktop)
- [ ] Edit modal opens (mobile)
- [ ] All fields editable
- [ ] Modal scrolls on mobile
- [ ] Cancel button works
- [ ] Save button works

### Discount Calculator
- [ ] Discount % field works
- [ ] Sale price auto-calculates
- [ ] Savings calculation correct
- [ ] Apply button confirms
- [ ] Discount displays on card: -20%
- [ ] Old price shows crossed out
- [ ] New price highlighted in green

### SKU Management
- [ ] SKU auto-generated on new products
- [ ] Manual edit works
- [ ] Generate button creates new SKU
- [ ] Format is AYLE-XXXXX-NNN
- [ ] SKU persists after save
- [ ] SKU unique for each product

### Badge System
- [ ] Badge field editable
- [ ] Badge displays on product card
- [ ] "NEW" badge = green
- [ ] "SALE" badge = orange
- [ ] "HOT" badge = red
- [ ] Custom badges work
- [ ] Empty badge is valid

### Visibility Control
- [ ] Active/Inactive selector works
- [ ] Inactive products hide from customer
- [ ] Inactive products show in admin with "HIDDEN" tag
- [ ] Toggle works multiple times
- [ ] Reactivation restores product

### Photos
- [ ] Can add photos
- [ ] Can upload multiple
- [ ] Max 10 photos enforced
- [ ] Photos visible in preview
- [ ] Can remove individual photos
- [ ] Photos persist after save
- [ ] Photos sync to other devices

### Data Persistence (CRITICAL)
- [ ] Save product → refresh → still there
- [ ] Edit product → refresh → changes remain
- [ ] Add on device A → visible on device B
- [ ] Clear browser cache → data persists
- [ ] Logout/login → data still there
- [ ] Firebase shows data in Collections

### Cross-Device Sync
- [ ] Add product on MacBook
- [ ] Refresh on iPhone → appears
- [ ] Edit price on iPhone
- [ ] Refresh on MacBook → price updated
- [ ] Real-time if Firestore connected
- [ ] Works on production URL

### Performance
- [ ] Page loads < 2 seconds
- [ ] Edit modal opens < 1 second
- [ ] Save completes < 2 seconds
- [ ] No lag in typing
- [ ] Smooth scrolling
- [ ] No jank in animations

### Error Handling
- [ ] Fill required fields validation
- [ ] Save without name shows error
- [ ] Save without price shows error
- [ ] Upload large image handles
- [ ] Network error shows message
- [ ] Firebase offline falls back to localStorage

### User Experience
- [ ] Success message after save: ✅
- [ ] Progress messages show during upload
- [ ] Error messages clear
- [ ] Can't exceed 10 photos (disabled)
- [ ] Modal closes after save
- [ ] Product card updates immediately

---

## 🚀 PRODUCTION DEPLOYMENT CHECKLIST

Before deploying:

```
Code:
☑ All changes committed
☑ No console errors
☑ All tests pass locally
☑ Code pushed to GitHub main branch

Firebase (If Using Real DB):
☑ Firebase project set up
☑ Firebase credentials in firebaseConfig.js
☑ Firestore database created
☑ Security rules configured
☑ Test collections created

Environment:
☑ ADMIN_PASSWORD set in Vercel env vars
☑ TELEGRAM_BOT_TOKEN set (if using Telegram)
☑ TELEGRAM_CHAT_ID set
☑ CLOUDINARY config set (if using cloud upload)

Vercel:
☑ Code deployed (auto-deploys from main branch)
☑ Build succeeds (no errors)
☑ Production URL loads
☑ Console shows no errors
☑ Firebase initializes on load

Testing:
☑ Test on production URL (desktop)
☑ Test on production URL (mobile)
☑ Admin access works
☑ Product editing works
☑ Changes persist
☑ Data syncs across devices

Documentation:
☑ Update team wiki/docs
☑ Create admin instructions
☑ Record demo video (optional)
☑ Test another team member

Release:
☑ Mark as v3.1 in code
☑ Create Git tag: git tag v3.1
☑ Document changes
☑ Notify team/customers
☑ Monitor for issues 24h
```

---

## 📝 Testing Report Template

```
═══════════════════════════════════════════════════════════
AYLENSALE v3.1 - TESTING REPORT
═══════════════════════════════════════════════════════════

Date: _______________
Tester: ______________
Device: ______________
OS/Browser: __________

RESULTS:
☐ ✅ ALL PASS - Ready for production
☐ ⚠️ SOME ISSUES - Document below
☐ ❌ FAILED - Do not deploy

ISSUES FOUND:
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

PASSED TESTS:
✅ Admin access
✅ Product editing
✅ Discount calculator
✅ SKU management
✅ Data persistence
✅ Cross-device sync
✅ Mobile responsive

NOTES:
_________________________________________________

APPROVAL:
Tester Signature: _______________
Date: _______________

═══════════════════════════════════════════════════════════
```

---

## 🎯 Success Criteria

### All features work when:

1. **Admin can edit product completely**
   - All 8 fields editable
   - Save persists changes
   - Refresh shows changes

2. **Discount calculator works**
   - Auto-calculates sale price
   - Shows savings
   - Displays correctly on card

3. **SKU system works**
   - Auto-generates unique SKUs
   - Can be manually edited
   - Persists after save

4. **Badge system works**
   - Displays on product card
   - Colors match badge type
   - Persists after refresh

5. **Visibility control works**
   - Inactive products hide
   - Admin still sees with HIDDEN badge
   - Can toggle on/off

6. **Cross-device sync works**
   - Add on device A → visible on device B
   - Edit on A → changes visible on B
   - Works on production URL

7. **Data persists**
   - Refresh page → changes stay
   - Close/reopen browser → changes stay
   - 24 hours later → changes still there
   - Firebase shows data

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Admin button not showing | Refresh page, check browser console |
| Edit modal doesn't open | Try keyboard shortcut instead |
| Discount not calculating | Make sure retail price is entered first |
| Changes not saving | Check console for errors, verify Firebase |
| Not seeing changes on other device | Refresh page, check internet connection |
| Photos not uploading | Check file size (< 5MB), try different format |
| Visibility toggle not working | Refresh page, check Firebase connection |
| SKU not generating | Click Generate again, clear localStorage |

---

## ✨ Deployment Commands

```bash
# From project directory
cd /Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk

# Ensure everything is committed
git status

# Push to main (auto-deploys to Vercel)
git push origin main

# Check Vercel deployment
# Visit: https://vercel.com/yourname/car-sales-uk
# Wait for "Production - Ready" status

# Test production
open https://car-sales-uk.vercel.app
```

---

**Ready to test?** Start with "LOCAL TESTING" on MacBook! 🚀

