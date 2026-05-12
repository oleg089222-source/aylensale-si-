# QUICK TEST - Image Storage Fix

**Run this to verify the fix works locally and on production.**

---

## Prerequisites
- macOS with Terminal
- npm installed
- Browser (Chrome, Safari, Firefox)
- iPhone or iPad (for cross-device test)

---

## Test 1: Local Upload & Persistence (5 mins)

```bash
# Terminal
cd /Users/olegyuryevich/Desktop/aylensale-si/AYLEN1/car-sales-uk
npm run dev
# Opens http://localhost:3000
```

**In Browser:**
1. Open Developer Tools: Press `F12`
2. Open Console tab
3. Press `Cmd + Shift + A` to open admin panel
4. Find any product card, click **Edit** button
5. Scroll to "PRODUCT IMAGES" section
6. Click **"Add More Photos"** button
7. Select any JPG/PNG from your Mac (download one if needed)
8. **Verify:**
   - Console shows: `"✅ Image uploaded"` (or similar success message)
   - Thumbnail appears in modal
   - No red errors in console
   - Click **"Save All Changes"**
   - Modal closes
   - Product card shows new image
   - No broken image icon (?)

**Persistence Test:**
1. Refresh page: Press `Cmd + R` or `Cmd + Shift + R`
2. **Verify:**
   - Product still shows image (didn't disappear)
   - Image displays correctly
   - No broken links

✅ **PASSED** if image persists after refresh

---

## Test 2: Cross-Device Sync (5 mins)

**Setup:**
- MacBook with http://localhost:3000 already running
- iPhone on same WiFi network

**MacBook:**
1. Upload new image to any product (Test 1 steps above)
2. Verify image appears on MacBook card
3. Note the product name

**iPhone:**
1. Open browser
2. Navigate to: `http://192.168.X.X:3000` (replace with MacBook IP)
   - Find MacBook IP: System Settings → Network → WiFi → IP Address
3. **Verify:** Product shows same image as MacBook
4. Scroll and find the product you edited
5. **Verify:** Image is visible (same as MacBook)

**Now test reverse:**
1. On iPhone: Edit different product (click Edit, change price, click Save)
2. On MacBook: Refresh page
3. **Verify:** Price change from iPhone visible on MacBook

✅ **PASSED** if images and changes sync between devices

---

## Test 3: Fallback Image (3 mins)

**Goal:** Verify broken images show placeholder, not question mark

**In Browser Console (F12):**

```javascript
// Simulate broken image URL
products[0].images[0] = 'https://broken-url-invalid-12345.example/image.jpg';
renderProducts();  // Re-render products
```

**Verify:**
- Product card loads
- No broken image icon (?)
- Shows AYLEN placeholder image instead
- No red errors in console

✅ **PASSED** if placeholder shows gracefully

---

## Test 4: Production Deployment (10 mins)

```bash
# Terminal
cd /Users/olegyuryevich/Desktop/aylensale-si
git push origin main
# Wait for Vercel (2-3 minutes)
```

**In Browser:**
1. Navigate to: https://car-sales-uk.vercel.app
2. Open Console: F12 → Console tab
3. Look for message: `"✓ Firebase Firestore initialized"` ✓ GOOD
4. Or if you see: `"Firebase config not loaded"` ✗ PROBLEM
5. Press `Cmd + Shift + A` to open admin (with password)
6. Upload new image to any product
7. **Verify:**
   - Upload succeeds (no error)
   - Image displays on card
   - Console shows success message
8. Refresh page (`Cmd + R`)
9. **Verify:**
   - Image still there (persists)
10. Open on iPhone:
    - Navigate to: https://car-sales-uk.vercel.app
    - Triple-tap logo to open admin
    - Check if product image from MacBook is visible
11. **Verify:**
    - Same image visible on iPhone
    - Images sync across devices

✅ **PASSED** if production works like local

---

## Test 5: Multiple Images (3 mins)

1. In admin mode, edit a product
2. Upload 3-4 different images
3. Product card should show main image with arrow buttons
4. Click **< >** arrows to cycle through images
5. **Verify:**
   - All images load
   - No broken icons
   - Arrows work
   - Thumbnails display at bottom

✅ **PASSED** if all images work and cycle

---

## Troubleshooting

### ❌ Upload button doesn't work

**Check:**
- Is Cloudinary working? Open network tab (F12 → Network), try upload, look for `api.cloudinary.com` requests
- Does it say "failing"? Could be rate limit or API issue

**Fix:**
- Refresh page
- Try with smaller image (< 1MB)
- Check internet connection

### ❌ Image shows question mark after refresh

**Cause:** Image stored as base64 (old version)

**Fix:**
- Re-upload image (should use Vercel Blob this time)
- Check console for warnings about "base64 fallback"

### ❌ Console shows "Firebase Firestore initialized" but images still not syncing

**Cause:** Firestore rules might not allow writes

**Fix:**
- For development/testing: Make Firestore rules public (NOT for production)
- For production: Implement proper authentication

### ❌ Localhost upload works but production doesn't

**Cause:** Vercel Blob might not be enabled on Vercel dashboard

**Fix:**
1. Go to: https://vercel.com/dashboard
2. Select: `car-sales-uk` project
3. Check Settings → Storage → Blob
4. Enable if not already enabled
5. Re-deploy: `git push origin main`

---

## Success Indicators ✅

If ALL tests pass, you should see:

✅ Images upload via admin panel  
✅ Images display on product cards  
✅ Images persist after page refresh  
✅ Broken images show placeholder (not ?)  
✅ Images visible on other devices (MacBook ↔ iPhone)  
✅ Multiple images work with thumbnails  
✅ No red errors in console  
✅ Console shows "✓ Firebase Firestore initialized"  
✅ Works on production URL  
✅ Works on localhost  

If **ALL ✅**, system is working perfectly! 🎉

---

## Quick Checklist

- [ ] Test 1: Local upload & persistence ✅
- [ ] Test 2: Cross-device sync ✅  
- [ ] Test 3: Fallback image ✅
- [ ] Test 4: Production deployment ✅
- [ ] Test 5: Multiple images ✅
- [ ] No errors in console ✅
- [ ] Firestore initialized message ✅

---

**If all tests pass:** System is ready for production!

**If any test fails:** Check troubleshooting section and retry, or check IMAGE_STORAGE_FIX.md for detailed info.

---

## Contact Info

For issues:
1. Check browser console (F12 → Console) for error messages
2. Read IMAGE_STORAGE_FIX.md troubleshooting section
3. Check git status for uncommitted changes
4. Review latest commit: `git show HEAD`

---

**Version:** 3.2  
**Date:** May 13, 2026  
**Status:** Ready for testing ✅
