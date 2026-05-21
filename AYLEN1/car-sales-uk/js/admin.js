/**
 * Admin Mode Functions - UPDATED with Photo Upload Support
 * Handles edit/add/delete for products, auctions, locations
 * Integrates with Firebase Storage for photo uploads
 */

var isAdminMode = false;
var adminLoggedIn = false;
var uploadingFiles = {};
var currentEditingProductId = null;
var notifyRequestsUnsubscribe = null;

function syncAdminModeWithFirebaseAuth(user) {
  var allowed = Boolean(window.FBDB && window.FBDB.isAdmin && window.FBDB.isAdmin());
  adminLoggedIn = allowed;
  if (!allowed && isAdminMode) {
    isAdminMode = false;
    window.isAdminMode = false;
    removeAdminModeUI();
    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderAuctions === 'function') renderAuctions();
    if (typeof renderLocations === 'function') renderLocations();
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Generate unique SKU/Card number
 */
function generateSKU(productName, productId) {
  // Format: AYLE-XXXX-NNN where XXXX is category prefix and NNN is product ID
  var prefix = 'AYLE';
  var namePrefix = (productName || '').substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
  var idPart = String(productId || Date.now()).padStart(4, '0').substring(-3);
  return prefix + '-' + namePrefix + '-' + idPart;
}

/**
 * Calculate sale price from discount percentage
 */
function calculateSalePrice(retailPrice, discountPercent) {
  if (!retailPrice || retailPrice <= 0) return 0;
  if (!discountPercent || discountPercent <= 0) return parseFloat(retailPrice);
  var discountAmount = parseFloat(retailPrice) * (discountPercent / 100);
  return parseFloat((parseFloat(retailPrice) - discountAmount).toFixed(2));
}

// Initialize admin event listeners when document loads
document.addEventListener('DOMContentLoaded', function() {
  setupAdminAccessibility();
});

function setupAdminAccessibility() {
  // Keyboard shortcuts for admin login
  document.addEventListener('keydown', function(e) {
    // Ctrl+Shift+A (Windows/Linux)
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
      e.preventDefault();
      showAdminLoginModal();
      return;
    }
    
    // Cmd+Shift+A (Mac) - metaKey is the Command key
    if (e.metaKey && e.shiftKey && e.code === 'KeyA') {
      e.preventDefault();
      showAdminLoginModal();
      return;
    }
    
    // Alt+Shift+A (alternative)
    if (e.altKey && e.shiftKey && e.code === 'KeyA') {
      e.preventDefault();
      showAdminLoginModal();
      return;
    }
  });
  
  // Add visible admin button to header
  addAdminAccessButton();
  
  // Mobile admin button - triple tap on logo
  addMobileAdminButton();
}

/**
 * Add visible admin button to header
 */
function addAdminAccessButton() {
  var headerRight = document.querySelector('.header-right');
  if (!headerRight) return;
  
  var adminAccessDiv = document.createElement('div');
  adminAccessDiv.id = 'adminAccessDiv';
  adminAccessDiv.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
  `;
  
  // Admin button (hidden by default, visible when hovered/focused)
  var adminBtn = document.createElement('button');
  adminBtn.id = 'headerAdminBtn';
  adminBtn.innerHTML = '🔑';
  adminBtn.title = 'Admin Access (Cmd+Shift+A on Mac, Ctrl+Shift+A on Windows)';
  adminBtn.style.cssText = `
    background: rgba(233, 69, 96, 0.2);
    border: 1px solid #e94560;
    color: #e94560;
    padding: 6px 10px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s;
    opacity: 0.6;
  `;
  
  adminBtn.onmouseover = function() {
    this.style.opacity = '1';
    this.style.background = 'rgba(233, 69, 96, 0.5)';
  };
  
  adminBtn.onmouseout = function() {
    this.style.opacity = '0.6';
    this.style.background = 'rgba(233, 69, 96, 0.2)';
  };
  
  adminBtn.onclick = function(e) {
    e.stopPropagation();
    showAdminLoginModal();
  };
  
  adminAccessDiv.appendChild(adminBtn);
  headerRight.appendChild(adminAccessDiv);
}

function addMobileAdminButton() {
  // Create hidden admin button in bottom-right corner
  var adminBtn = document.createElement('button');
  adminBtn.id = 'mobileAdminBtn';
  adminBtn.innerHTML = '⚙️';
  adminBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: rgba(233, 69, 96, 0.3);
    border: 2px solid #e94560;
    color: #e94560;
    font-size: 24px;
    cursor: pointer;
    z-index: 9999;
    opacity: 0.5;
    transition: all 0.3s;
    display: none;
  `;
  
  adminBtn.onmouseover = function() { this.style.opacity = '1'; this.style.background = 'rgba(233, 69, 96, 0.8)'; };
  adminBtn.onmouseout = function() { this.style.opacity = '0.5'; this.style.background = 'rgba(233, 69, 96, 0.3)'; };
  adminBtn.onclick = function(e) { 
    e.stopPropagation();
    showAdminLoginModal(); 
  };
  
  document.body.appendChild(adminBtn);
  
  // Show admin button on triple-tap or long press on logo
  var tapCount = 0;
  var tapTimeout;
  var logoArea = document.querySelector('header') || document.body;
  
  logoArea.addEventListener('click', function() {
    tapCount++;
    clearTimeout(tapTimeout);
    
    if (tapCount === 1) {
      tapTimeout = setTimeout(function() { tapCount = 0; }, 500);
    } else if (tapCount === 3) {
      tapCount = 0;
      document.getElementById('mobileAdminBtn').style.display = 'block';
      showAdminLoginModal();
    }
  });
}

function showAdminLoginModal() {
  // Check if admin mode is already enabled
  if (adminLoggedIn) {
    toggleAdminMode();
    return;
  }
  
  var loginHtml = `
    <div id="adminLoginModal" class="modal" style="display:flex">
      <div class="modal-content" style="width:380px">
        <h2 style="color:#e94560;text-align:center">Admin Login</h2>
        <p style="color:#888;font-size:12px;margin:0 0 10px;text-align:center">Use <b style="color:#ccc">admin</b> or <b style="color:#ccc">admin@aylensale.com</b> with your admin password</p>
        <input type="text" id="adminUser" value="admin" autocomplete="username" placeholder="admin or admin@aylensale.com" style="width:100%;padding:12px;margin:10px 0;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="password" id="adminPass" autocomplete="current-password" placeholder="Password" style="width:100%;padding:12px;margin:10px 0;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <button onclick="verifyAdminLogin()" style="width:100%;padding:12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;margin:10px 0">Login</button>
        <button onclick="closeAdminLoginModal()" style="width:100%;padding:12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer;margin:5px 0">Cancel</button>
      </div>
    </div>
  `;
  
  if (window.AYLEN_MODAL) {
    window.AYLEN_MODAL.open(loginHtml, { id: 'adminLoginModal' });
    setTimeout(function() {
      var u = document.getElementById('adminUser');
      if (u) u.focus();
    }, 60);
    return;
  }
  document.body.insertAdjacentHTML('beforeend', loginHtml);
  document.getElementById('adminUser').focus();
}

function closeAdminLoginModal() {
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.close('adminLoginModal');
  else {
    var modal = document.getElementById('adminLoginModal');
    if (modal) modal.remove();
  }
}

async function verifyAdminLogin() {
  var user = (document.getElementById('adminUser').value || '').trim();
  var pass = document.getElementById('adminPass').value;
  
  if (user !== 'admin') {
    notify('Username must be: admin', 'error');
    return;
  }
  if (!pass) {
    notify('Enter your admin password', 'error');
    return;
  }
  
  try {
    notify('Checking admin credentials...', 'info');
    var response;
    try {
      response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });
    } catch (netErr) {
      throw new Error('Cannot reach /api/admin-auth. On localhost run: npx vercel dev (python server alone is not enough).');
    }

    var data = {};
    try {
      data = await response.json();
    } catch (parseErr) {
      if (response.status === 501 || response.status === 404) {
        throw new Error('Admin API not available on this server. Use https://aylensale.com or run: npx vercel dev');
      }
      throw new Error('Invalid server response (status ' + response.status + ')');
    }

    if (response.status === 429) {
      throw new Error('Too many attempts. Wait 15 minutes and try again.');
    }
    if (response.status === 500 && data.error && String(data.error).indexOf('not configured') !== -1) {
      throw new Error('ADMIN_PASSWORD is not set in Vercel → Project → Settings → Environment Variables.');
    }
    if (!response.ok || !data.authenticated) {
      if (response.status === 401) {
        throw new Error('Wrong password for website API. Check Vercel env variable ADMIN_PASSWORD.');
      }
      throw new Error(data.error || 'Login failed (HTTP ' + response.status + ')');
    }

    notify('API OK — signing in to Firebase...', 'info');
    if (!window.FBDB || !window.FBDB.signInAdmin) {
      throw new Error('Firebase Auth is not ready. Hard refresh the page (Cmd+Shift+R).');
    }
    await window.FBDB.signInAdmin(pass);
    adminLoggedIn = true;
    try { sessionStorage.setItem('aylen_admin_key', pass); } catch (e) {}
    closeAdminLoginModal();
    if (!isAdminMode) toggleAdminMode();
    notify('Admin mode enabled', 'success');
  } catch (error) {
    console.error('Admin login failed:', error);
    notify(error.message || 'Authentication failed', 'error');
  }
}

async function toggleAdminMode() {
  if (!isAdminMode && (!window.FBDB || !window.FBDB.isAdmin || !window.FBDB.isAdmin())) {
    showAdminLoginModal();
    return;
  }

  if (isAdminMode && window.FBDB && window.FBDB.signOutAdmin) {
    await window.FBDB.signOutAdmin();
    try { sessionStorage.removeItem('aylen_admin_key'); } catch (e) {}
  }
  if (isAdminMode && window.AYLEN_MODAL && window.AYLEN_MODAL.closeAll) {
    await window.AYLEN_MODAL.closeAll({ immediate: true });
  }

  isAdminMode = !isAdminMode;
  window.isAdminMode = isAdminMode; // Make it global
  
  if (isAdminMode) {
    addAdminModeUI();
    if (window.AyelenAdminDashboard && window.AyelenAdminDashboard.mount) {
      window.AyelenAdminDashboard.mount();
    }
  } else {
    removeAdminModeUI();
    if (window.AyelenAdminDashboard && window.AyelenAdminDashboard.close) {
      window.AyelenAdminDashboard.close();
    }
  }
  
  // Re-render to show/hide admin controls
  setTimeout(function() {
    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderAuctions === 'function') renderAuctions();
    if (typeof renderLocations === 'function') renderLocations();
    if (window.AYLEN_PERF && window.AYLEN_PERF.pauseEngagement && isAdminMode) {
      window.AYLEN_PERF.pauseEngagement();
    }
  }, 0);
}

function addAdminModeUI() {
  if (document.getElementById('adminToolbar')) return;
  // Add admin toolbar to header
  var headerRight = document.querySelector('.header-right');
  
  var adminToolbar = document.createElement('div');
  adminToolbar.id = 'adminToolbar';
  adminToolbar.style.cssText = 'display:flex;gap:8px;align-items:center;padding:0 10px;border-left:1px solid #555';
  
  adminToolbar.innerHTML = `
    <span style="color:#e94560;font-size:12px;font-weight:bold">ADMIN</span>
    <button onclick="AyelenAdminDashboard.open()" style="padding:8px 14px;background:#1a1a2e;color:#fff;border:2px solid #e94560;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold"><i class="fas fa-table-columns"></i> Admin Panel</button>
    <button onclick="openAddProductModal()" style="padding:8px 12px;background:#00cc66;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold">+ Product</button>
    <button id="notifyRequestsBtn" onclick="openNotifyRequestsModal()" style="position:relative;padding:8px 12px;background:#16a085;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold">
      <i class="fas fa-bell"></i> <span id="notifyRequestsBadge" style="display:none;position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#e94560;color:#fff;font-size:11px;line-height:20px;text-align:center;border:2px solid #1a1a2e">0</span>
    </button>
    <button onclick="downloadProductionBackup()" style="padding:8px 12px;background:#1d4ed8;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold" title="Backup Firestore JSON">Backup</button>
    <button onclick="toggleAdminMode()" style="padding:8px 12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold">Exit</button>
  `;
  
  headerRight.appendChild(adminToolbar);
  startNotifyRequestsWatch();
}

function removeAdminModeUI() {
  var toolbar = document.getElementById('adminToolbar');
  if (toolbar) toolbar.remove();
  stopNotifyRequestsWatch();
}

// ============ PRODUCT MANAGEMENT WITH PHOTO UPLOAD ============

var productSaveInFlight = false;

function getAdminModalPanel() {
  return window.AYLEN_MODAL && window.AYLEN_MODAL.getPanel ? window.AYLEN_MODAL.getPanel() : null;
}

function queryInAdminModal(selector) {
  var panel = getAdminModalPanel();
  if (panel) return panel.querySelector(selector);
  return document.querySelector(selector);
}

function clearProductUploadState() {
  uploadingFiles['product'] = [];
  Object.keys(uploadingFiles).forEach(function(key) {
    if (key.indexOf('editProduct_') === 0) delete uploadingFiles[key];
  });
}

function onAdminModalClosed() {
  currentEditingProductId = null;
  window.currentEditingProductId = null;
  clearProductUploadState();
  productSaveInFlight = false;
}

function adminMsg(message, type) {
  var text = String(message || '').replace(/^[\u274c\u2705\u23f3\u2139\ufe0f]+\s*/g, '').trim();
  if (type === 'error') notify(text || 'Something went wrong. Please try again.', 'error');
  else if (type === 'success') notify(text || 'Saved successfully.', 'success');
  else notify(text, type || 'info');
}

function openAdminModal(html, modalId, afterOpen) {
  clearProductUploadState();
  if (window.AYLEN_MODAL) {
    return window.AYLEN_MODAL.open(html, {
      id: modalId,
      panelClass: 'aylen-admin-form',
      onClose: onAdminModalClosed,
      afterOpen: afterOpen
    });
  }
  document.body.insertAdjacentHTML('beforeend', html);
  var el = document.getElementById(modalId);
  if (typeof afterOpen === 'function' && el) {
    try { afterOpen(el.querySelector('.modal-content') || el, modalId); } catch (e) { console.warn(e); }
  }
  return Promise.resolve(modalId);
}

function closeAdminModal(modalId) {
  if (window.AYLEN_MODAL) return window.AYLEN_MODAL.close(modalId);
  var el = document.getElementById(modalId);
  if (el) el.remove();
  onAdminModalClosed();
  return Promise.resolve();
}

function renderEditProductPhotoPreview(product, productId, modalId) {
  var preview = queryInAdminModal('#eprodPhotoPreview');
  if (!preview) return;
  var images = (product && product.images) ? product.images.slice() : [];
  if (!images.length) {
    preview.innerHTML = '<span class="aylen-photo-empty">No photos yet</span>';
    return;
  }
  var html = '';
  for (var i = 0; i < images.length; i++) {
    html += '<div style="position:relative;width:80px;height:80px;border:1px solid #444;border-radius:5px;overflow:hidden;background:#1a1f2e">';
    html += '<img src="' + images[i] + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">';
    html += '<button type="button" style="position:absolute;top:-5px;right:-5px;width:24px;height:24px;background:#e94560;color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:18px" onclick="removeProductPhoto(' + jsInlineArg(productId) + ',' + i + ',' + jsInlineArg(modalId) + ')">×</button></div>';
  }
  preview.innerHTML = html;
  var fileInput = queryInAdminModal('#eprodPhotoInput');
  if (fileInput) fileInput.disabled = images.length >= 10;
}

async function ensureAdminCanWrite() {
  if (window.FBDB && window.FBDB.isAdmin && window.FBDB.isAdmin()) return true;
  try {
    if (window.FBDB && window.FBDB.ensureAdminSession) {
      await window.FBDB.ensureAdminSession();
      adminLoggedIn = true;
      return true;
    }
  } catch (e) {
    notify('Admin login required: ' + (e.message || e), 'error');
    showAdminLoginModal();
    return false;
  }
  notify('Please log in to admin mode first.', 'error');
  showAdminLoginModal();
  return false;
}

function refreshCatalogAfterProductChange(saved) {
  if (saved && window.FBDB && window.FBDB.mergeProductIntoCatalog) {
    window.FBDB.mergeProductIntoCatalog(saved);
  }
  if (typeof renderProducts === 'function') renderProducts(true);
  if (window.AyelenAdminDashboard && window.AyelenAdminDashboard.reloadProducts) {
    window.AyelenAdminDashboard.reloadProducts(true);
  }
}

async function openAddProductModal() {
  if (!(await ensureAdminCanWrite())) return;
  if (window.FBDB && window.FBDB.loadListingPolicies && (!listingPolicies || !listingPolicies.length)) {
    try {
      await window.FBDB.loadListingPolicies();
      if (!listingPolicies.length && window.FBDB.seedListingPoliciesIfEmpty) {
        await window.FBDB.seedListingPoliciesIfEmpty();
        await window.FBDB.loadListingPolicies();
      }
    } catch (e) {
      console.warn('Listing policies preload:', e.message);
    }
  }
  var modalId = 'productModal_' + Date.now();
  var html = `
    <div id="${modalId}" class="modal">
      <div class="modal-content">
        <span class="close" data-aylen-close>&times;</span>
        <h2 class="aylen-modal-title"><i class="fas fa-plus-circle"></i> Add New Product</h2>
        <div class="aylen-form-section">
          <h3>Basic information</h3>
          <label class="aylen-label" for="prodName">Product name *</label>
          <input type="text" id="prodName" placeholder="Enter product name">
          <label class="aylen-label" for="prodDesc">Description</label>
          <textarea id="prodDesc" placeholder="Product description"></textarea>
          <div class="aylen-form-row">
            <div class="aylen-field">
              <label class="aylen-label" for="prodRetailPrice">Retail price £ *</label>
              <input type="number" id="prodRetailPrice" placeholder="0.00" step="0.01" min="0">
            </div>
            <div class="aylen-field">
              <label class="aylen-label" for="prodWholesalePrice">Wholesale price £</label>
              <input type="number" id="prodWholesalePrice" placeholder="0.00" step="0.01" min="0">
            </div>
          </div>
          <div class="aylen-form-row">
            <div class="aylen-field">
              <label class="aylen-label" for="prodCategory">Category *</label>
              <select id="prodCategory">
                <option value="">Select category</option>
                <option value="electronics">Electronics</option>
                <option value="homeware">Homeware</option>
                <option value="clothing">Clothing</option>
                <option value="accessories">Accessories</option>
                <option value="job-lots">Job lots / Mixed</option>
                <option value="cables">Cables</option>
                <option value="general">General</option>
              </select>
            </div>
            <div class="aylen-field">
              <label class="aylen-label" for="prodStock">Stock qty</label>
              <input type="number" id="prodStock" placeholder="0" min="0">
            </div>
          </div>
          <label class="aylen-label" for="prodPolicyId">Listing policy *</label>
          <select id="prodPolicyId">${(window.AYLEN_LISTING_POLICIES && window.AYLEN_LISTING_POLICIES.optionsHtml) ? window.AYLEN_LISTING_POLICIES.optionsHtml('') : '<option value="">— Select listing policy —</option>'}</select>
        </div>
        <button type="button" class="aylen-btn aylen-btn-ai aylen-ai-trigger" data-aylen-ai="trigger" onclick="openAiAdminAssistant({ autoApply: true, fromProductForm: true })"><i class="fas fa-robot"></i> AI Assistant</button>
        <div class="aylen-form-section">
          <h3><i class="fas fa-images"></i> Photos (max 10)</h3>
          <input type="file" id="prodPhotoInput" accept="image/*" multiple>
          <p class="aylen-hint-box">JPG, PNG, GIF, WebP — up to 5MB each</p>
          <div id="prodPhotoPreview" class="aylen-photo-preview"><span class="aylen-photo-empty">No photos yet</span></div>
        </div>
        <div class="aylen-form-actions">
          <button type="button" class="aylen-btn aylen-btn-primary" onclick="addProductWithUpload('${modalId}')"><i class="fas fa-save"></i> Save product</button>
          <button type="button" class="aylen-btn aylen-btn-secondary" data-aylen-close>Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  openAdminModal(html, modalId, function(panel) {
    var fileInput = panel.querySelector('#prodPhotoInput');
    if (fileInput) {
      fileInput.addEventListener('change', function(e) {
        handleProductPhotoUpload(e, modalId);
      });
    }
    var nameInput = panel.querySelector('#prodName');
    if (nameInput) nameInput.focus();
  });
}

function handleProductPhotoUpload(e, modalId) {
  var files = e.target.files;
  if (!files || files.length === 0) return;
  
  var maxFiles = 10;
  if (files.length > maxFiles) {
    notify('Maximum ' + maxFiles + ' photos allowed!', 'error');
    e.target.value = '';
    return;
  }
  
  // Store files in global object
  uploadingFiles['product'] = Array.from(files);
  
  // Show preview
  var preview = queryInAdminModal('#prodPhotoPreview');
  preview.innerHTML = '';
  
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var reader = new FileReader();
    
    reader.onload = (function(index, fname) {
      return function(event) {
        var div = document.createElement('div');
        div.style.cssText = 'position:relative;width:80px;height:80px;border:1px solid #444;border-radius:5px;overflow:hidden;background:#1a1f2e';
        div.innerHTML = '<img src="' + event.target.result + '" style="width:100%;height:100%;object-fit:cover">';
        
        var removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.style.cssText = 'position:absolute;top:-5px;right:-5px;width:24px;height:24px;background:#e94560;color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:18px;line-height:1';
        removeBtn.onclick = function(e) {
          e.preventDefault();
          // Remove from files
          var arr = Array.from(uploadingFiles['product'] || []);
          arr.splice(index, 1);
          uploadingFiles['product'] = arr;
          
          // Update preview
          e.target.closest('div').remove();
          if (!preview.querySelector('div')) {
            preview.innerHTML = '<span class="aylen-photo-empty">No photos</span>';
          }
        };
        div.appendChild(removeBtn);
        preview.appendChild(div);
      };
    })(i, file.name);
    
    reader.readAsDataURL(file);
  }
}

async function addProductWithUpload(modalId) {
  if (productSaveInFlight) return;
  if (!(await ensureAdminCanWrite())) return;
  if (typeof confirmAylenProductionWrite === 'function' && !confirmAylenProductionWrite('add product')) return;
  var nameEl = queryInAdminModal('#prodName');
  if (!nameEl) {
    notify('Add product form not found. Close and reopen the dialog.', 'error');
    return;
  }
  var name = nameEl.value.trim();
  var descEl = queryInAdminModal('#prodDesc');
  var desc = descEl ? descEl.value.trim() : '';
  var retailPrice = parseFloat((queryInAdminModal('#prodRetailPrice') || {}).value) || 0;
  var wholesalePrice = parseFloat((queryInAdminModal('#prodWholesalePrice') || {}).value) || 0;
  var categoryEl = queryInAdminModal('#prodCategory');
  var category = categoryEl ? categoryEl.value : '';
  var stock = parseInt((queryInAdminModal('#prodStock') || {}).value, 10) || 0;
  
  var policyEl = queryInAdminModal('#prodPolicyId');
  var policyId = policyEl ? policyEl.value : '';
  if (!policyId && listingPolicies.length) policyId = listingPolicies[0].id;
  if (!name || !category || retailPrice <= 0) {
    adminMsg('Fill all required fields (name, category, retail price).', 'error');
    return;
  }
  if (!policyId) {
    adminMsg('Create a listing policy first (Admin → Policies).', 'error');
    return;
  }

  productSaveInFlight = true;
  try {
    adminMsg('Saving product…', 'info');
    var imageUrls = [];
    if (uploadingFiles['product'] && uploadingFiles['product'].length > 0) {
      var files = uploadingFiles['product'];
      if (files.length > 10) {
        adminMsg('Maximum 10 photos per product.', 'error');
        return;
      }
      for (var i = 0; i < files.length; i++) {
        var result = await uploadImageToCloudinary(files[i]);
        if (result.success) {
          imageUrls.push(result.url);
          adminMsg('Uploading photo ' + (i + 1) + ' of ' + files.length + '…', 'info');
        } else {
          adminMsg('Photo ' + (i + 1) + ' upload failed. Try again.', 'error');
          return;
        }
      }
    }
    var product = await addProductWithPhotos(name, desc, retailPrice, category, imageUrls, stock, wholesalePrice, policyId);
    adminMsg('Product saved.', 'success');
    await closeAdminModal(modalId);
    refreshCatalogAfterProductChange(product);
  } catch (error) {
    adminMsg('Could not save product. Try again.', 'error');
    console.error('addProductWithUpload', error);
  } finally {
    productSaveInFlight = false;
  }
}

function editProduct(id) {
  (async function() {
  var productIdx = window.AYLEN_PRODUCTION
    ? window.AYLEN_PRODUCTION.findProductIndexById(products, id)
    : products.findIndex(function(p) { return sameId(p.id, id); });
  if (productIdx === -1 && window.FBDB && window.FBDB.loadProductById) {
    try {
      var loaded = await window.FBDB.loadProductById(id);
      if (loaded) {
        products.push(loaded);
        productIdx = products.length - 1;
      }
    } catch (e) {
      console.warn('Could not load product', e);
    }
  }
  var product = productIdx === -1 ? null : products[productIdx];
  if (!product) return;
  id = product.id;
  
  // Track which product we're editing for image uploads
  currentEditingProductId = id;
  window.currentEditingProductId = id;
  
  // Ensure all fields exist
  if (!product.badge) product.badge = '';
  if (product.active === undefined) product.active = true;
  if (!product.discount) product.discount = 0;
  if (!product.salePrice) product.salePrice = product.price || 0;
  if (!product.sku) product.sku = generateSKU(product.name, product.id);
  
  var modalId = 'productEditModal_' + Date.now();
  var photoHTML = '<span class="aylen-photo-empty">No photos yet</span>';
  
  if (product.images && product.images.length > 0) {
    photoHTML = '';
    for (var i = 0; i < product.images.length; i++) {
      photoHTML += '<div style="position:relative;width:80px;height:80px;border:1px solid #444;border-radius:5px;overflow:hidden;background:#1a1f2e">';
      photoHTML += '<img src="' + product.images[i] + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">';
      photoHTML += '<button style="position:absolute;top:-5px;right:-5px;width:24px;height:24px;background:#e94560;color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:18px" onclick="removeProductPhoto(' + jsInlineArg(id) + ',' + i + ',' + jsInlineArg(modalId) + ')">×</button></div>';
    }
  }
  
  var html = `
    <div id="${modalId}" class="modal">
      <div class="modal-content">
        <span class="close" data-aylen-close>&times;</span>
        <h2 class="aylen-modal-title"><i class="fas fa-edit"></i> Edit product</h2>
        <div class="aylen-form-section">
          <h3>Basic information</h3>
          <label class="aylen-label" for="eprodName">Product name *</label>
          <input type="text" id="eprodName" value="${product.name}">
          <label class="aylen-label" for="eprodDesc">Description</label>
          <textarea id="eprodDesc">${product.desc || ''}</textarea>
          <div class="aylen-form-row">
            <div class="aylen-field">
              <label class="aylen-label" for="eprodCategory">Category *</label>
              <select id="eprodCategory">
                <option value="electronics" ${product.category === 'electronics' ? 'selected' : ''}>Electronics</option>
                <option value="homeware" ${product.category === 'homeware' ? 'selected' : ''}>Homeware</option>
                <option value="clothing" ${product.category === 'clothing' ? 'selected' : ''}>Clothing</option>
                <option value="accessories" ${product.category === 'accessories' ? 'selected' : ''}>Accessories</option>
                <option value="general" ${product.category === 'general' ? 'selected' : ''}>General</option>
              </select>
            </div>
            <div class="aylen-field">
              <label class="aylen-label" for="eprodBadge">Badge / label</label>
              <input type="text" id="eprodBadge" value="${product.badge}" placeholder="NEW, SALE, HOT">
            </div>
          </div>
          <label class="aylen-label" for="eprodPolicyId">Listing policy *</label>
          <select id="eprodPolicyId">${(window.AYLEN_LISTING_POLICIES && window.AYLEN_LISTING_POLICIES.optionsHtml) ? window.AYLEN_LISTING_POLICIES.optionsHtml(product.policyId || product.listingPolicyId || '') : ''}</select>
        </div>
        <div class="aylen-form-section">
          <h3>Pricing &amp; discount</h3>
          <div class="aylen-form-row">
            <div class="aylen-field">
              <label class="aylen-label" for="eprodRetailPrice">Retail price £ *</label>
              <input type="number" id="eprodRetailPrice" value="${product.retail || product.price || 0}" step="0.01" min="0" onchange="updateSalePrice()" oninput="updateSalePrice()">
            </div>
            <div class="aylen-field">
              <label class="aylen-label" for="eprodWholesalePrice">Wholesale price £</label>
              <input type="number" id="eprodWholesalePrice" value="${product.wholesale || 0}" step="0.01" min="0">
            </div>
          </div>
          <label class="aylen-label">Discount</label>
          <div class="aylen-discount-row">
            <div class="aylen-field">
              <label class="aylen-label" for="eprodDiscount">Discount %</label>
              <input type="number" id="eprodDiscount" value="${product.discount || 0}" min="0" max="100" step="1" onchange="updateSalePrice()" oninput="updateSalePrice()">
            </div>
            <div class="aylen-field">
              <label class="aylen-label" for="eprodSalePrice">Sale price £</label>
              <input type="number" id="eprodSalePrice" value="${product.salePrice || 0}" step="0.01" min="0" readonly>
            </div>
            <button type="button" class="aylen-btn aylen-btn-primary" onclick="applySalePrice()">Apply</button>
          </div>
          <div class="aylen-hint-box">Discount <span id="discountDisplay">0%</span> — save £<span id="savingsDisplay">0.00</span></div>
        </div>
        <div class="aylen-form-section">
          <h3>Inventory &amp; visibility</h3>
          <div class="aylen-form-row">
            <div class="aylen-field">
              <label class="aylen-label" for="eprodStock">Stock quantity</label>
              <input type="number" id="eprodStock" value="${product.stock || 0}" min="0">
            </div>
            <div class="aylen-field">
              <label class="aylen-label" for="eprodActive">Visibility</label>
              <select id="eprodActive">
                <option value="true" ${product.active === true || product.active === 'true' ? 'selected' : ''}>Active (visible)</option>
                <option value="false" ${product.active === false || product.active === 'false' ? 'selected' : ''}>Inactive (hidden)</option>
              </select>
            </div>
          </div>
        </div>
        <div class="aylen-form-section">
          <h3>SKU / product number</h3>
          <div class="aylen-form-row">
            <div class="aylen-field">
              <label class="aylen-label" for="eprodSKU">Card number / SKU</label>
              <input type="text" id="eprodSKU" value="${product.sku}" placeholder="AYLE-XXXXX-NNN" style="font-family:monospace">
            </div>
            <button type="button" class="aylen-btn aylen-btn-secondary" onclick="generateNewSKU()">Generate</button>
          </div>
          <p class="aylen-hint-box">Format: AYLE-PREFIX-XXX</p>
        </div>
        <div class="aylen-form-section">
          <h3><i class="fas fa-images"></i> Photos (${(product.images || []).length}/10)</h3>
          <div id="eprodPhotoPreview" class="aylen-photo-preview">${photoHTML}</div>
          <label class="aylen-label" for="eprodPhotoInput">Add more photos</label>
          <input type="file" id="eprodPhotoInput" accept="image/*" multiple ${(product.images && product.images.length >= 10) ? 'disabled' : ''}>
        </div>
        <div class="aylen-form-actions">
          <button type="button" class="aylen-btn aylen-btn-primary" onclick="saveEditProduct('${id}','${modalId}')"><i class="fas fa-save"></i> Save changes</button>
          <button type="button" class="aylen-btn aylen-btn-secondary" data-aylen-close>Cancel</button>
        </div>
        <div class="aylen-form-actions">
          <button type="button" class="aylen-btn aylen-btn-danger" onclick="deleteProductConfirm('${id}')"><i class="fas fa-trash"></i> Delete product</button>
        </div>
      </div>
    </div>
  `;
  
  openAdminModal(html, modalId, function(panel) {
    var fileInput = panel.querySelector('#eprodPhotoInput');
    if (fileInput) {
      fileInput.addEventListener('change', function(e) {
        handleEditProductPhotoUpload(e, id, modalId);
      });
    }
    updateSalePrice();
  });
  })();
}

/**
 * Update sale price based on discount percentage
 */
function updateSalePrice() {
  var retailEl = queryInAdminModal('#eprodRetailPrice');
  if (!retailEl) return;
  var retailPrice = parseFloat(retailEl.value) || 0;
  var discount = parseFloat((queryInAdminModal('#eprodDiscount') || {}).value) || 0;
  var salePrice = calculateSalePrice(retailPrice, discount);
  var savings = (retailPrice - salePrice).toFixed(2);
  var saleEl = queryInAdminModal('#eprodSalePrice');
  var discDisp = queryInAdminModal('#discountDisplay');
  var saveDisp = queryInAdminModal('#savingsDisplay');
  if (saleEl) saleEl.value = salePrice.toFixed(2);
  if (discDisp) discDisp.textContent = discount.toFixed(0) + '%';
  if (saveDisp) saveDisp.textContent = savings;
}

/**
 * Apply calculated sale price to discount field or show message
 */
function applySalePrice() {
  var salePrice = parseFloat((queryInAdminModal('#eprodSalePrice') || {}).value) || 0;
  var retailPrice = parseFloat((queryInAdminModal('#eprodRetailPrice') || {}).value) || 0;
  
  if (salePrice >= retailPrice) {
    adminMsg('Sale price must be less than retail price.', 'error');
    return;
  }
  adminMsg('Sale price applied. Click Save to confirm.', 'success');
}

/**
 * Generate new SKU for product
 */
function generateNewSKU(productName) {
  if (!productName) {
    var nameEl = queryInAdminModal('#eprodName');
    productName = nameEl ? nameEl.value : 'Product';
  }
  var newSKU = generateSKU(productName, Date.now());
  var skuEl = queryInAdminModal('#eprodSKU');
  if (skuEl) skuEl.value = newSKU;
  adminMsg('SKU generated: ' + newSKU, 'success');
}

function handleEditProductPhotoUpload(e, productId, modalId) {
  var files = e.target.files;
  if (!files || files.length === 0) return;
  
  var product = products.find(function(p) { return p.id === productId; });
  if (!product) return;
  
  var currentCount = (product.images || []).length;
  var maxFiles = 10;
  var availableSlots = maxFiles - currentCount;
  
  if (files.length > availableSlots) {
    notify('Only ' + availableSlots + ' photos can be added (max 10 total)', 'error');
    e.target.value = '';
    return;
  }
  
  // Upload files
  uploadingFiles['editProduct_' + productId] = Array.from(files);
}

async function saveEditProduct(productId, modalId) {
  if (productSaveInFlight) return;
  if (!(await ensureAdminCanWrite())) return;
  if (typeof confirmAylenProductionWrite === 'function' && !confirmAylenProductionWrite('save product')) return;
  try {
    productSaveInFlight = true;
    adminMsg('Saving product…', 'info');
    productId = String(productId || '').trim();
    if (!productId) {
      adminMsg('Product not found. Close the dialog and try again.', 'error');
      productSaveInFlight = false;
      return;
    }
    
    var name = (queryInAdminModal('#eprodName') || {}).value;
    name = name ? String(name).trim() : '';
    var desc = queryInAdminModal('#eprodDesc');
    var descVal = desc ? desc.value.trim() : '';
    var retailPrice = parseFloat((queryInAdminModal('#eprodRetailPrice') || {}).value) || 0;
    var wholesalePrice = parseFloat((queryInAdminModal('#eprodWholesalePrice') || {}).value) || 0;
    var category = (queryInAdminModal('#eprodCategory') || {}).value || '';
    var stock = parseInt((queryInAdminModal('#eprodStock') || {}).value, 10) || 0;
    var badgeEl = queryInAdminModal('#eprodBadge');
    var badge = badgeEl ? badgeEl.value.trim() : '';
    var active = (queryInAdminModal('#eprodActive') || {}).value === 'true';
    var discount = parseFloat((queryInAdminModal('#eprodDiscount') || {}).value) || 0;
    var salePrice = parseFloat((queryInAdminModal('#eprodSalePrice') || {}).value) || retailPrice;
    var skuEl = queryInAdminModal('#eprodSKU');
    var sku = skuEl ? skuEl.value.trim() : '';
    var policyEl = queryInAdminModal('#eprodPolicyId');
    var policyId = policyEl ? policyEl.value : '';
    if (!policyId && listingPolicies.length) policyId = listingPolicies[0].id;
    
    if (!name || !category || retailPrice <= 0) {
      adminMsg('Fill all required fields (name, category, retail price).', 'error');
      productSaveInFlight = false;
      return;
    }
    if (!policyId) {
      adminMsg('Select a listing policy (Admin → Policies).', 'error');
      productSaveInFlight = false;
      return;
    }
    
    if (!sku) {
      adminMsg('SKU / card number is required.', 'error');
      productSaveInFlight = false;
      return;
    }
    
    var productIdx = window.AYLEN_PRODUCTION
      ? window.AYLEN_PRODUCTION.findProductIndexById(products, productId)
      : products.findIndex(function(p) { return sameId(p.id, productId); });
    var product = productIdx === -1 ? null : products[productIdx];
    if (!product) {
      adminMsg('Product not found. Refresh the page and try again.', 'error');
      productSaveInFlight = false;
      return;
    }
    if (!policyId) policyId = product.policyId || product.listingPolicyId || '';
    productId = product.id;
    var previousStock = Number(product.stock || 0);
    
    var imageUrls = (product.images || product.photos || []).slice();
    
    // Upload new files if any
    var fileInputId = 'eprodPhotoInput';
    var fileInput = queryInAdminModal('#' + fileInputId);
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      if (imageUrls.length + fileInput.files.length > 10) {
        adminMsg('Maximum 10 photos per product.', 'error');
        productSaveInFlight = false;
        return;
      }
      for (var i = 0; i < fileInput.files.length; i++) {
        var result = await uploadImageToCloudinary(fileInput.files[i]);
        if (result.success) {
          imageUrls.push(result.url);
          adminMsg('Uploading photo ' + (i + 1) + ' of ' + fileInput.files.length + '…', 'info');
        } else {
          adminMsg('Photo upload failed. Try again.', 'error');
          productSaveInFlight = false;
          return;
        }
      }
    }
    
    Object.assign(product, {
      name: name,
      title: name,
      desc: descVal,
      description: descVal,
      price: retailPrice,
      retail: retailPrice,
      retailPrice: retailPrice,
      wholesale: wholesalePrice,
      wholesalePrice: wholesalePrice,
      category: category,
      stock: stock,
      images: imageUrls,
      photos: imageUrls,
      badge: badge,
      active: active,
      status: active ? 'active' : 'hidden',
      discount: discount,
      salePrice: salePrice,
      sku: sku,
      policyId: policyId,
      listingPolicyId: policyId,
      updatedAt: new Date().toISOString()
    });

    if (!window.FBDB || !window.FBDB.updateProduct) {
      throw new Error('Firebase is not ready. Product was not saved.');
    }
    var saved = await window.FBDB.updateProduct(product.id, product);
    products[productIdx] = saved;
    if (previousStock <= 0 && stock > 0) {
      await processRestockNotifications(product);
    }
    
    adminMsg('Product saved.', 'success');
    await closeAdminModal(modalId);
    refreshCatalogAfterProductChange(saved);
  } catch (error) {
    console.error('Product save failed:', error);
    adminMsg('Could not save product. Try again.', 'error');
  } finally {
    productSaveInFlight = false;
  }
}

async function removeProductPhoto(productId, photoIndex, modalId) {
  var idx = window.AYLEN_PRODUCTION
    ? window.AYLEN_PRODUCTION.findProductIndexById(products, productId)
    : products.findIndex(function(p) { return sameId(p.id, productId); });
  var product = idx === -1 ? null : products[idx];
  if (!product || !product.images) return;
  
  if (!confirm('Remove this photo?')) return;
  try {
    product.images.splice(photoIndex, 1);
    product.photos = product.images;
    if (!window.FBDB || !window.FBDB.updateProduct) {
      throw new Error('Firebase is not ready. Product was not updated.');
    }
    var saved = await window.FBDB.updateProduct(product.id, product);
    products[idx] = saved;
    if (window.AYLEN_MODAL && window.AYLEN_MODAL.getCurrentId() === modalId) {
      renderEditProductPhotoPreview(saved, productId, modalId);
    } else {
      editProduct(product.id);
    }
    adminMsg('Photo removed.', 'success');
    refreshCatalogAfterProductChange(saved);
  } catch (error) {
    adminMsg('Could not remove photo. Try again.', 'error');
  }
}

async function deleteProductConfirm(id) {
  var product = products.find(function(p) { return sameId(p.id, id); });
  if (!product) return;
  
  if (confirm('Delete "' + product.name + '"? This cannot be undone.')) {
    try {
      if (!(await ensureAdminCanWrite())) return;
      if (!id) throw new Error('Missing productId. Product was not deleted.');
      if (!window.FBDB || !window.FBDB.deleteProduct) {
        throw new Error('Firebase is not ready. Product was not deleted.');
      }
      await window.FBDB.deleteProduct(id);
      products = products.filter(function(p) { return !sameId(p.id, id); });
      notify('Product deleted', 'success');
      if (window.AYLEN_MODAL) await window.AYLEN_MODAL.closeAll({ immediate: true });
      else onAdminModalClosed();
      refreshCatalogAfterProductChange();
    } catch (error) {
      notify('Delete failed: ' + (error.message || error), 'error');
    }
  }
}

// ============ AUCTION MANAGEMENT ============

function openAddAuctionModal() {
  var modalId = 'auctionModal_' + Date.now();
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:550px;max-height:85vh;overflow-y:auto">
        <span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px"><i class="fas fa-gavel"></i> Add Auction</h2>
        
        <input type="text" id="auctName" placeholder="Item Name *" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <textarea id="auctDesc" placeholder="Description" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px;height:60px;resize:vertical"></textarea>
        <input type="number" id="auctStartPrice" placeholder="Starting Price £ *" step="0.01" min="0" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <select id="auctCategory" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
          <option value="">Select Category *</option>
          <option value="electronics">Electronics</option>
          <option value="collectibles">Collectibles</option>
          <option value="homeware">Homeware</option>
        </select>
        <input type="number" id="auctDuration" placeholder="Duration (hours)" value="24" min="1" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="file" id="auctPhotoInput" accept="image/*" multiple style="width:100%;padding:10px;margin:5px 0 10px;border:1px dashed #e94560;background:#1a1f2e;color:#e0e0e0;border-radius:5px;cursor:pointer">
        
        <div id="auctPhotoPreview" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;min-height:60px;border:1px solid #333;border-radius:5px;padding:10px;background:#0f1419">
          <span style="color:#666;width:100%;text-align:center;line-height:60px">No photos</span>
        </div>
        
        <div style="display:flex;gap:10px">
          <button onclick="addAuctionWithUpload('${modalId}')" style="flex:1;padding:12px;background:#3498db;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold"><i class="fas fa-save"></i> Create</button>
          <button onclick="AYLEN_MODAL.close()" style="flex:1;padding:12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('auctPhotoInput').addEventListener('change', function(e) {
    handleAuctionPhotoUpload(e, modalId);
  });
  document.getElementById('auctName').focus();
}

function handleAuctionPhotoUpload(e, modalId) {
  var files = e.target.files;
  if (!files || files.length === 0) return;
  
  uploadingFiles['auction'] = Array.from(files);
  var preview = document.getElementById('auctPhotoPreview');
  preview.innerHTML = '';
  
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var reader = new FileReader();
    
    reader.onload = (function(index) {
      return function(event) {
        var div = document.createElement('div');
        div.style.cssText = 'position:relative;width:70px;height:70px;border:1px solid #444;border-radius:5px;overflow:hidden;background:#1a1f2e';
        div.innerHTML = '<img src="' + event.target.result + '" style="width:100%;height:100%;object-fit:cover">';
        
        var removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.style.cssText = 'position:absolute;top:-5px;right:-5px;width:24px;height:24px;background:#e94560;color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:18px;line-height:1';
        removeBtn.onclick = function(e) {
          e.preventDefault();
          var arr = Array.from(uploadingFiles['auction'] || []);
          arr.splice(index, 1);
          uploadingFiles['auction'] = arr;
          e.target.closest('div').remove();
          if (!preview.querySelector('div')) preview.innerHTML = '<span style="color:#666;width:100%;text-align:center;line-height:60px">No photos</span>';
        };
        div.appendChild(removeBtn);
        preview.appendChild(div);
      };
    })(i);
    
    reader.readAsDataURL(file);
  }
}

async function addAuctionWithUpload(modalId) {
  var name = document.getElementById('auctName').value.trim();
  var desc = document.getElementById('auctDesc').value.trim();
  var startPrice = parseFloat(document.getElementById('auctStartPrice').value) || 0;
  var category = document.getElementById('auctCategory').value;
  var duration = parseInt(document.getElementById('auctDuration').value) || 24;
  
  if (!name || !category || startPrice <= 0) {
    notify('Fill all required fields!', 'error');
    return;
  }
  
  var imageUrls = [];
  
  if (uploadingFiles['auction'] && uploadingFiles['auction'].length > 0) {
    var files = uploadingFiles['auction'];
    for (var i = 0; i < Math.min(files.length, 10); i++) {
      var result = await uploadImageToCloudinary(files[i]);
      if (result.success) {
        imageUrls.push(result.url);
      } else {
        notify('Error uploading photo ' + (i + 1), 'error');
        return;
      }
    }
  }
  
  var auction = addAuctionWithPhotos(name, desc, startPrice, category, imageUrls, duration);
  if (auction) {
    notify('Auction created!', 'success');
    uploadingFiles['auction'] = [];
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    else document.getElementById(modalId).remove();
    renderAuctions();
  } else {
    notify('Failed to create auction', 'error');
  }
}

function editAuction(id) {
  var auction = auctions.find(function(a) { return sameId(a.id, id); });
  if (!auction) return;
  notify('Edit functionality coming soon', 'info');
}

function deleteAuctionConfirm(id) {
  var auction = auctions.find(function(a) { return sameId(a.id, id); });
  if (!auction) return;
  
  if (confirm('Delete this auction? This cannot be undone.')) {
    deleteAuctionById(id);
    notify('Auction deleted', 'success');
    renderAuctions();
  }
}

async function adminFinalizeAuction(id) {
  try {
    if (await finalizeAuction(id)) {
      notify('Auction finalized', 'success');
      renderAuctions();
    } else {
      notify('Auction is not ended yet or has no winner', 'error');
    }
  } catch (error) {
    notify('Finalize failed: ' + error.message, 'error');
  }
}

async function adminSendAuctionWinner(id) {
  var auction = auctions.find(function(a) { return sameId(a.id, id); });
  if (!auction || !auction.winner) {
    notify('No auction winner to send', 'error');
    return;
  }

  var order = {
    type: 'auction_winner',
    name: auction.winner.bidderName || 'Winner',
    phone: auction.winner.bidderPhone || 'Not provided',
    method: 'Admin follow-up',
    pickup: 'Admin will arrange pickup/delivery',
    comment: auction.winner.bidderContact || '',
    auctionId: auction.id,
    auctionName: auction.name,
    finalPrice: Number(auction.currentPrice || auction.winner.amount || 0),
    bidId: auction.winner.bidId || ''
  };

  try {
    notify('Sending winner to Telegram...', 'info');
    var response = await fetch('/api/send-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
    var data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Telegram send failed');
    }
    order.telegramMessageId = data.messageId || null;
    if (await saveAuctionWinnerOrder(id, order)) {
      notify('Winner sent to Telegram', 'success');
      renderAuctions();
    }
  } catch (error) {
    notify('Telegram failed: ' + error.message, 'error');
  }
}

async function adminMarkAuctionCompleted(id) {
  try {
    if (await markAuctionCompleted(id)) {
      notify('Auction marked completed', 'success');
      renderAuctions();
    }
  } catch (error) {
    notify('Complete failed: ' + error.message, 'error');
  }
}

async function adminReopenAuction(id) {
  if (!confirm('Reopen this auction for 24 hours?')) return;
  try {
    if (await reopenAuction(id, 24)) {
      notify('Auction reopened for 24 hours', 'success');
      renderAuctions();
    }
  } catch (error) {
    notify('Reopen failed: ' + error.message, 'error');
  }
}

// ============ LOCATION MANAGEMENT ============

async function geocodePostcodeForPickup(postcode) {
  var clean = String(postcode || '').trim().toUpperCase();
  if (!clean) return null;
  try {
    var response = await fetch('https://api.postcodes.io/postcodes/' + encodeURIComponent(clean));
    if (!response.ok) return null;
    var data = await response.json();
    if (!data || !data.result) return null;
    return {
      lat: Number(data.result.latitude || 0),
      lng: Number(data.result.longitude || 0)
    };
  } catch (error) {
    console.warn('Postcode geocode failed:', error.message || error);
    return null;
  }
}

function locationWeatherStatus(satRain, sunRain) {
  var maxRain = Math.max(Number(satRain || 0), Number(sunRain || 0));
  if (maxRain >= 55) return 'BAD';
  if (maxRain >= 25) return 'OK';
  return 'GOOD';
}

function pickupWeatherDays(value) {
  var clean = String(value || '').toLowerCase();
  var hasSat = clean.indexOf('sat') !== -1 || clean.indexOf('both') !== -1 || clean.indexOf('weekend') !== -1;
  var hasSun = clean.indexOf('sun') !== -1 || clean.indexOf('both') !== -1 || clean.indexOf('weekend') !== -1;
  if (!hasSat && !hasSun) hasSat = true;
  return { saturday: hasSat, sunday: hasSun };
}

function selectedWeatherStatus(days, saturdayRainPct, sundayRainPct) {
  var values = [];
  if (days.saturday) values.push(Number(saturdayRainPct || 0));
  if (days.sunday) values.push(Number(sundayRainPct || 0));
  var maxRain = values.length ? Math.max.apply(Math, values) : 0;
  if (maxRain >= 55) return 'BAD';
  if (maxRain >= 25) return 'OK';
  return 'GOOD';
}

async function fetchWeekendForecastForPickup(lat, lng, selectedDays) {
  if (!lat || !lng) return {};
  try {
    var dates = nextWeekendDates();
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) +
      '&longitude=' + encodeURIComponent(lng) +
      '&daily=precipitation_probability_max,weather_code,temperature_2m_max' +
      '&timezone=Europe%2FLondon&start_date=' + dates.saturday + '&end_date=' + dates.sunday;
    var response = await fetch(url);
    if (!response.ok) return {};
    var data = await response.json();
    var daily = data.daily || {};
    var rain = daily.precipitation_probability_max || [];
    var temps = daily.temperature_2m_max || [];
    var saturdayRainPct = Math.round(Number(rain[0] || 0));
    var sundayRainPct = Math.round(Number(rain[1] || 0));
    var days = selectedDays || { saturday: true, sunday: true };
    return {
      saturdayTemp: Math.round(Number(temps[0] || 0)),
      sundayTemp: Math.round(Number(temps[1] || temps[0] || 0)),
      saturdayRainPct: saturdayRainPct,
      sundayRainPct: sundayRainPct,
      weatherDays: days,
      weatherStatus: selectedWeatherStatus(days, saturdayRainPct, sundayRainPct),
      lastWeatherUpdate: new Date().toISOString(),
      weatherSource: 'open-meteo'
    };
  } catch (error) {
    console.warn('Weekend forecast fetch failed:', error.message || error);
    return {};
  }
}

async function enrichPickupLocationWeather(location) {
  var postcode = String(location.postcode || '').trim().toUpperCase();
  var coords = null;
  if (postcode) {
    coords = await geocodePostcodeForPickup(postcode);
    if (!coords) {
      location.weatherError = 'Invalid postcode / Weather unavailable';
      location.weatherStatus = '';
      throw new Error('Invalid postcode / Weather unavailable');
    }
  }
  if (!coords && location.lat && location.lng) {
    coords = { lat: Number(location.lat), lng: Number(location.lng) };
  }
  if (coords && coords.lat && coords.lng) {
    location.lat = coords.lat;
    location.lng = coords.lng;
    location.lon = coords.lng;
    var selectedDays = pickupWeatherDays(location.days || location.day);
    location.weatherDays = selectedDays;
    location.weatherError = '';
    Object.assign(location, await fetchWeekendForecastForPickup(coords.lat, coords.lng, selectedDays));
  }
  return location;
}

function openAddLocationModal() {
  var modalId = 'locationModal_' + Date.now();
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:500px">
        <span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px"><i class="fas fa-map-marker-alt"></i> Add Location</h2>
        
        <input type="text" id="locName" placeholder="Location Name *" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="text" id="locAddress" placeholder="Address *" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="text" id="locPostcode" placeholder="Postcode for automatic weather, e.g. CM12 9TZ" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <select id="locDay" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
          <option value="Saturday">Saturday</option>
          <option value="Sunday">Sunday</option>
          <option value="Saturday and Sunday">Saturday and Sunday</option>
        </select>
        <input type="text" id="locTime" placeholder="Time (e.g. 8:00-14:00) *" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="text" id="locNote" placeholder="Optional note for customers" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="number" id="locSortOrder" placeholder="Manual order (0 = default)" step="1" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <div style="font-size:12px;color:#999;margin:-4px 0 10px">Latitude/longitude and weekend forecast are fetched automatically from postcode.</div>
        <label style="display:block;color:#e0e0e0;font-weight:bold;margin-top:5px"><i class="fas fa-image"></i> Location photo</label>
        <input type="file" id="locPhoto" accept="image/*" style="width:100%;padding:10px;margin:5px 0 10px;border:1px dashed #e94560;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        
        <div style="margin-bottom:15px">
          <label style="color:#e0e0e0"><input type="checkbox" id="locActive" style="cursor:pointer"> Active this week</label>
          <label style="color:#e0e0e0;margin-left:12px"><input type="checkbox" id="locPinned" style="cursor:pointer"> Pin to top</label>
        </div>
        
        <div style="display:flex;gap:10px">
          <button onclick="addLocationWithData('${modalId}')" style="flex:1;padding:12px;background:#f39c12;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold"><i class="fas fa-save"></i> Add</button>
          <button onclick="AYLEN_MODAL.close()" style="flex:1;padding:12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('locName').focus();
}

async function addLocationWithData(modalId) {
  var name = document.getElementById('locName').value.trim();
  var address = document.getElementById('locAddress').value.trim();
  var postcode = document.getElementById('locPostcode').value.trim().toUpperCase();
  var day = document.getElementById('locDay').value.trim();
  var time = document.getElementById('locTime').value.trim();
  var note = document.getElementById('locNote').value.trim();
  var sortOrder = parseInt(document.getElementById('locSortOrder').value, 10) || 0;
  var active = document.getElementById('locActive').checked;
  var pinned = document.getElementById('locPinned').checked;
  
  if (!name || !address || !day || !time) {
    notify('Fill all required fields!', 'error');
    return;
  }
  
  var newId = 'loc_' + Date.now();

  var photoUrl = '';
  var photoInput = document.getElementById('locPhoto');
  if (photoInput && photoInput.files && photoInput.files[0]) {
    currentEditingProductId = 'location_' + newId;
    window.currentEditingProductId = currentEditingProductId;
    var upload = await uploadImageToCloudinary(photoInput.files[0]);
    if (upload.success) {
      photoUrl = upload.url;
    } else {
      notify('Location photo upload failed', 'error');
      return;
    }
  }
  
  var location = {
    id: newId,
    name: name,
    address: address,
    postcode: postcode,
    day: day,
    days: day,
    time: time,
    lat: 0,
    lng: 0,
    lon: 0,
    active: active,
    goingThisWeekend: active,
    pinned: pinned,
    sortOrder: sortOrder,
    note: note,
    useCount: 0,
    photoUrl: photoUrl,
    mapLink: 'https://maps.google.com?q=' + encodeURIComponent(postcode || address)
  };
  
  try {
    if (!window.FBDB || !window.FBDB.saveLocation) {
      throw new Error('Firebase is not ready. Location was not saved.');
    }
    notify('Saving location and loading weather...', 'info');
    location = await enrichPickupLocationWeather(location);
    var saved = await window.FBDB.saveLocation(location);
    locations.push(saved);
    notify('Location added!', 'success');
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    else document.getElementById(modalId).remove();
    renderLocations();
    fillPickup();
  } catch (error) {
    console.error('Location add failed:', error);
    notify('Save failed: ' + (error.message || error), 'error');
  }
}

function editLocation(id) {
  var loc = locations.find(function(l) { return sameId(l.id, id); });
  if (!loc) return;

  var modalId = 'editLocationModal_' + Date.now();
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:520px;max-height:90vh;overflow-y:auto">
        <span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px"><i class="fas fa-map-marker-alt"></i> Edit Location</h2>

        <input type="text" id="elocName" value="${escapeHtml(loc.name)}" placeholder="Location Name *" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="text" id="elocAddress" value="${escapeHtml(loc.address)}" placeholder="Address *" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="text" id="elocPostcode" value="${escapeHtml(loc.postcode || '')}" placeholder="Postcode for automatic weather" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <select id="elocDay" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
          <option value="Saturday" ${String(loc.days || loc.day || '').toLowerCase().indexOf('sat') !== -1 && String(loc.days || loc.day || '').toLowerCase().indexOf('sun') === -1 ? 'selected' : ''}>Saturday</option>
          <option value="Sunday" ${String(loc.days || loc.day || '').toLowerCase().indexOf('sun') !== -1 && String(loc.days || loc.day || '').toLowerCase().indexOf('sat') === -1 ? 'selected' : ''}>Sunday</option>
          <option value="Saturday and Sunday" ${String(loc.days || loc.day || '').toLowerCase().indexOf('sat') !== -1 && String(loc.days || loc.day || '').toLowerCase().indexOf('sun') !== -1 ? 'selected' : ''}>Saturday and Sunday</option>
        </select>
        <input type="text" id="elocTime" value="${escapeHtml(loc.time || '')}" placeholder="Time" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="text" id="elocNote" value="${escapeHtml(loc.note || '')}" placeholder="Optional note for customers" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="number" id="elocSortOrder" value="${Number(loc.sortOrder || 0)}" placeholder="Manual order (0 = default)" step="1" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <div style="font-size:12px;color:#999;margin:-4px 0 10px">Coordinates and weekend forecast refresh automatically from postcode when you save.</div>

        ${loc.photoUrl ? `<img src="${escapeHtml(loc.photoUrl)}" style="width:100%;max-height:160px;object-fit:cover;border-radius:6px;margin:5px 0 10px">` : ''}
        <label style="display:block;color:#e0e0e0;font-weight:bold;margin-top:5px"><i class="fas fa-image"></i> Replace location photo</label>
        <input type="file" id="elocPhoto" accept="image/*" style="width:100%;padding:10px;margin:5px 0 10px;border:1px dashed #e94560;background:#1a1f2e;color:#e0e0e0;border-radius:5px">

        <div style="margin-bottom:15px">
          <label style="color:#e0e0e0"><input type="checkbox" id="elocActive" ${loc.active ? 'checked' : ''} style="cursor:pointer"> Active / going this weekend</label>
          <label style="color:#e0e0e0;margin-left:12px"><input type="checkbox" id="elocPinned" ${loc.pinned ? 'checked' : ''} style="cursor:pointer"> Pin to top</label>
        </div>

        <div style="display:flex;gap:10px">
          <button onclick="saveEditLocation('${id}','${modalId}')" style="flex:1;padding:12px;background:#f39c12;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold"><i class="fas fa-save"></i> Save</button>
          <button onclick="AYLEN_MODAL.close()" style="flex:1;padding:12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;

  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
}

async function saveEditLocation(id, modalId) {
  try {
    var loc = locations.find(function(l) { return sameId(l.id, id); });
    if (!loc) {
      notify('Location not found. Refresh page and try again.', 'error');
      return;
    }

    var name = document.getElementById('elocName').value.trim();
    var address = document.getElementById('elocAddress').value.trim();
    var postcode = document.getElementById('elocPostcode').value.trim().toUpperCase();
    var day = document.getElementById('elocDay').value.trim();
    var time = document.getElementById('elocTime').value.trim();
    var note = document.getElementById('elocNote').value.trim();
    var sortOrder = parseInt(document.getElementById('elocSortOrder').value, 10) || 0;

    if (!name || !address || !day || !time) {
      notify('Fill all required fields!', 'error');
      return;
    }

    var photoUrl = loc.photoUrl || '';
    var photoInput = document.getElementById('elocPhoto');
    if (photoInput && photoInput.files && photoInput.files[0]) {
      currentEditingProductId = 'location_' + id;
      window.currentEditingProductId = currentEditingProductId;
      var upload = await uploadImageToCloudinary(photoInput.files[0]);
      if (upload.success) {
        photoUrl = upload.url;
      } else {
        notify('Location photo upload failed: ' + (upload.error || 'upload failed'), 'error');
        return;
      }
    }

    Object.assign(loc, {
      name: name,
      address: address,
      postcode: postcode,
      day: day,
      days: day,
      time: time,
      active: document.getElementById('elocActive').checked,
      goingThisWeekend: document.getElementById('elocActive').checked,
      pinned: document.getElementById('elocPinned').checked,
      sortOrder: sortOrder,
      note: note,
      photoUrl: photoUrl,
      mapLink: 'https://maps.google.com?q=' + encodeURIComponent(postcode || address),
      updatedAt: new Date().toISOString()
    });

    if (!window.FBDB || !window.FBDB.saveLocation) {
      throw new Error('Firebase is not ready. Location was not saved.');
    }
    notify('Saving location and refreshing weather...', 'info');
    loc = await enrichPickupLocationWeather(loc);
    await window.FBDB.saveLocation(loc);
    notify('Location saved!', 'success');
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    else document.getElementById(modalId).remove();
    renderLocations();
    fillPickup();
  } catch (error) {
    console.error('Location save failed:', error);
    notify('Save failed: ' + (error.message || error), 'error');
  }
}

async function deleteLocationConfirm(id) {
  var loc = locations.find(function(l) { return sameId(l.id, id); });
  if (!loc) return;
  
  if (confirm('Delete this location? This cannot be undone.')) {
    try {
      if (!id) throw new Error('Missing locationId. Location was not deleted.');
      if (!window.FBDB || !window.FBDB.deleteLocation) {
        throw new Error('Firebase is not ready. Location was not deleted.');
      }
      await window.FBDB.deleteLocation(id);
      locations = locations.filter(function(l) { return !sameId(l.id, id); });
      notify('Location deleted', 'success');
      renderLocations();
      fillPickup();
    } catch (error) {
      notify('Delete failed: ' + (error.message || error), 'error');
    }
  }
}

// ============ OUT OF STOCK NOTIFY REQUESTS ============

function notifyMessageForProduct(productName) {
  return 'Good news! ' + productName + ' is back in stock at AYLENSALE. Order here: https://aylensale.com/';
}

function pendingNotifyRequests(requests) {
  return (Array.isArray(requests) ? requests : []).filter(function(req) {
    return req && req.notified !== true && req.status !== 'sent';
  });
}

function notifyRequestsByProduct(requests) {
  var grouped = {};
  pendingNotifyRequests(requests).forEach(function(req) {
    var name = req.productName || 'Product';
    if (!grouped[name]) grouped[name] = 0;
    grouped[name]++;
  });
  return grouped;
}

function updateNotifyRequestsBadge(requests) {
  var badge = document.getElementById('notifyRequestsBadge');
  var btn = document.getElementById('notifyRequestsBtn');
  if (!badge || !btn) return;

  var pending = pendingNotifyRequests(requests);
  if (!pending.length) {
    badge.style.display = 'none';
    badge.textContent = '0';
    btn.title = 'No waiting customers';
    return;
  }

  badge.style.display = 'inline-block';
  badge.textContent = pending.length > 99 ? '99+' : String(pending.length);
  var grouped = notifyRequestsByProduct(pending);
  btn.title = pending.length + ' waiting customers: ' + Object.keys(grouped).map(function(name) {
    return name + ' (' + grouped[name] + ')';
  }).join(', ');
}

function startNotifyRequestsWatch() {
  stopNotifyRequestsWatch();
  if (!window.FBDB || !window.FBDB.listenNotifyRequests || !window.FBDB.isAdmin || !window.FBDB.isAdmin()) {
    updateNotifyRequestsBadge([]);
    return;
  }
  try {
    notifyRequestsUnsubscribe = window.FBDB.listenNotifyRequests(function(requests) {
      notifyRequests = requests;
      updateNotifyRequestsBadge(requests);
    });
  } catch (error) {
    console.warn('Could not start notify requests watch:', error.message || error);
  }
}

function stopNotifyRequestsWatch() {
  if (typeof notifyRequestsUnsubscribe === 'function') {
    notifyRequestsUnsubscribe();
  }
  notifyRequestsUnsubscribe = null;
}

function whatsappNotifyLink(contact, productName) {
  var digits = String(contact || '').replace(/\D/g, '');
  if (!digits) return '';
  return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(notifyMessageForProduct(productName));
}

function telegramManualLink(contact) {
  var username = String(contact || '').trim().replace(/^@/, '');
  return username ? 'https://t.me/' + encodeURIComponent(username) : '';
}

function emailNotifyLink(contact, productName) {
  return 'mailto:' + encodeURIComponent(contact) +
    '?subject=' + encodeURIComponent(productName + ' is back in stock') +
    '&body=' + encodeURIComponent(notifyMessageForProduct(productName));
}

function notifyActionUrl(req) {
  var method = String(req.method || '').toLowerCase();
  var contact = String(req.contact || '').trim();
  var productName = req.productName || 'Product';
  if (req.adminActionUrl) return req.adminActionUrl;
  if (method === 'email') return emailNotifyLink(contact, productName);
  if (method === 'whatsapp') return whatsappNotifyLink(contact, productName);
  if (method === 'telegram' && contact.charAt(0) === '@') return telegramManualLink(contact);
  return '';
}

function notifyActionLabel(req) {
  var method = String(req.method || '').toLowerCase();
  if (method === 'email') return 'Email';
  if (method === 'whatsapp') return 'WhatsApp';
  if (method === 'telegram') return 'Telegram';
  return 'Open';
}

function copyNotifyContact(contact) {
  var text = String(contact || '');
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      notify('Contact copied', 'success');
    }).catch(function() {
      fallbackCopyNotifyContact(text);
    });
  } else {
    fallbackCopyNotifyContact(text);
  }
}

function fallbackCopyNotifyContact(text) {
  var input = document.createElement('input');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
  notify('Contact copied', 'success');
}

async function updateNotifyRequest(id, updates) {
  if (!window.FBDB || !window.FBDB.updateNotifyRequest) {
    throw new Error('Firebase notify requests are not ready.');
  }
  await window.FBDB.updateNotifyRequest(id, updates);
}

async function markNotifyRequestDone(id, modalId) {
  try {
    await updateNotifyRequest(id, {
      notified: true,
      status: 'sent',
      notifiedAt: new Date().toISOString(),
      error: ''
    });
    notify('Notify request marked as sent', 'success');
    updateNotifyRequestsBadge(pendingNotifyRequests(notifyRequests).filter(function(req) { return !sameId(req.id, id); }));
    if (modalId) await renderNotifyRequestsList(modalId);
  } catch (error) {
    notify('Could not update notify request: ' + error.message, 'error');
  }
}

async function processSingleNotifyRequest(req, product) {
  var productName = product.name || req.productName || 'Product';
  var method = String(req.method || '').toLowerCase();
  var contact = String(req.contact || '').trim();
  var message = notifyMessageForProduct(productName);

  if (method === 'telegram') {
    if (contact.charAt(0) === '@') {
      await updateNotifyRequest(req.id, {
        status: 'manual_telegram',
        adminActionUrl: telegramManualLink(contact),
        adminMessage: message,
        error: 'Telegram Bot API needs numeric chat_id for auto-send. Use this @username manually or ask user for chat_id.'
      });
      return 'manual';
    }

    var response = await fetch('/api/send-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'telegram', contact: contact, productName: productName })
    });
    var data = await response.json();
    if (!response.ok || !data.success) {
      await updateNotifyRequest(req.id, {
        status: 'failed',
        error: data.error || 'Telegram send failed',
        lastTriedAt: new Date().toISOString()
      });
      return 'failed';
    }
    await updateNotifyRequest(req.id, {
      notified: true,
      status: 'sent',
      notifiedAt: new Date().toISOString(),
      provider: 'telegram',
      providerMessageId: data.messageId || null,
      error: ''
    });
    return 'sent';
  }

  if (method === 'whatsapp') {
    await updateNotifyRequest(req.id, {
      status: 'pending_whatsapp',
      adminActionUrl: whatsappNotifyLink(contact, productName),
      adminMessage: message,
      error: 'WhatsApp API is not configured. Open the link from admin panel and send manually.'
    });
    return 'manual';
  }

  if (method === 'email') {
    await updateNotifyRequest(req.id, {
      status: 'pending_email',
      adminActionUrl: emailNotifyLink(contact, productName),
      adminMessage: message,
      error: 'Email provider is not configured. Use the email link from admin panel or configure an email API.'
    });
    return 'manual';
  }

  await updateNotifyRequest(req.id, { status: 'failed', error: 'Unknown notify method' });
  return 'failed';
}

async function processRestockNotifications(product) {
  if (!window.FBDB || !window.FBDB.loadPendingNotifyRequests) return;
  var pending = await window.FBDB.loadPendingNotifyRequests(product.id);
  if (!pending.length) return;

  var sent = 0;
  var manual = 0;
  var failed = 0;
  for (var i = 0; i < pending.length; i++) {
    try {
      var result = await processSingleNotifyRequest(pending[i], product);
      if (result === 'sent') sent++;
      else if (result === 'manual') manual++;
      else failed++;
    } catch (error) {
      failed++;
      await updateNotifyRequest(pending[i].id, {
        status: 'failed',
        error: error.message || String(error),
        lastTriedAt: new Date().toISOString()
      });
    }
  }
  notify('Restock notifications: sent ' + sent + ', manual ' + manual + ', failed ' + failed, failed ? 'error' : 'success');
  startNotifyRequestsWatch();
}

async function renderNotifyRequestsList(modalId) {
  var list = document.getElementById('notifyRequestsList_' + modalId);
  if (!list) return;
  list.innerHTML = '<div style="color:#999;padding:16px;text-align:center">Loading notify requests...</div>';

  try {
    var requests = await window.FBDB.loadNotifyRequests();
    notifyRequests = requests;
    updateNotifyRequestsBadge(requests);
    if (!requests.length) {
      list.innerHTML = '<div style="color:#999;text-align:center;padding:20px;border:1px dashed #333;border-radius:6px">No notify requests yet</div>';
      return;
    }

    var pending = pendingNotifyRequests(requests);
    var grouped = notifyRequestsByProduct(requests);
    var summary = '<div style="background:#111827;border:1px solid #263244;border-radius:10px;padding:12px;margin-bottom:12px;color:#e0e0e0">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">' +
        '<b>Waiting Customers: <span style="color:#e94560">' + pending.length + '</span></b>' +
        '<span style="font-size:12px;color:#9ca3af">Admin gets this badge live while admin mode is open.</span>' +
      '</div>';
    var productNames = Object.keys(grouped);
    if (productNames.length) {
      summary += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">';
      productNames.forEach(function(name) {
        summary += '<span style="background:#1f2937;border:1px solid #374151;border-radius:999px;padding:6px 9px;font-size:12px">' + escapeHtml(name) + ': <b style="color:#fbbf24">' + grouped[name] + '</b></span>';
      });
      summary += '</div>';
    }
    summary += '</div>';

    var html = summary + '<div style="display:grid;gap:10px">';
    requests.forEach(function(req) {
      var status = req.notified ? 'sent' : (req.status || 'waiting');
      var actionUrl = notifyActionUrl(req);
      var action = '';
      if (actionUrl) {
        action += '<a href="' + escapeHtml(actionUrl) + '" target="_blank" rel="noopener" style="padding:9px 11px;background:#3498db;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:bold;display:inline-flex;align-items:center;gap:6px"><i class="fas fa-up-right-from-square"></i> ' + escapeHtml(notifyActionLabel(req)) + '</a>';
      }
      action += '<button onclick="copyNotifyContact(' + jsInlineArg(req.contact || '') + ')" style="padding:9px 11px;background:#6b7280;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold"><i class="fas fa-copy"></i> Copy Contact</button>';
      if (!req.notified) {
        action += '<button onclick="markNotifyRequestDone(' + jsInlineArg(req.id) + ',' + jsInlineArg(modalId) + ')" style="padding:9px 11px;background:#00cc66;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold"><i class="fas fa-check"></i> Mark sent</button>';
      }
      html += '<div style="background:#0f1419;border:1px solid ' + (req.notified ? '#222' : '#e94560') + ';border-radius:10px;padding:12px;color:#e0e0e0">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>' + escapeHtml(req.productName || 'Product') + '</b><span style="color:' + (req.notified ? '#00cc66' : '#f39c12') + ';font-weight:bold">' + escapeHtml(status) + '</span></div>' +
        '<div style="font-size:13px;color:#ccc;margin-top:6px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">' +
          '<span>Method: <b>' + escapeHtml(req.method) + '</b></span>' +
          '<span>Contact: <b style="word-break:break-all">' + escapeHtml(req.contact) + '</b></span>' +
          '<span>Product ID: <b style="word-break:break-all">' + escapeHtml(req.productId || '') + '</b></span>' +
        '</div>' +
        (req.error ? '<div style="font-size:12px;color:#ffb3b3;margin-top:6px">' + escapeHtml(req.error) + '</div>' : '') +
        (req.adminMessage ? '<textarea readonly style="width:100%;margin-top:8px;padding:8px;background:#111;color:#ddd;border:1px solid #333;border-radius:4px">' + escapeHtml(req.adminMessage) + '</textarea>' : '') +
        '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' + action + '</div>' +
      '</div>';
    });
    html += '</div>';
    list.innerHTML = html;
  } catch (error) {
    list.innerHTML = '<div style="color:#ffb3b3;padding:16px">Could not load notify requests: ' + escapeHtml(error.message || error) + '</div>';
  }
}

function openNotifyRequestsModal() {
  var modalId = 'notifyRequestsModal_' + Date.now();
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:min(760px,96vw);max-height:90vh;overflow-y:auto">
        <span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#16a085;margin-bottom:12px"><i class="fas fa-bell"></i> Notify Requests / Waiting Customers</h2>
        <p style="color:#999;font-size:13px;margin-bottom:12px">New waiting customers appear here with a red badge in admin mode. Email, WhatsApp and Telegram @username have quick open and copy actions.</p>
        <button onclick="renderNotifyRequestsList('${modalId}')" style="width:100%;padding:10px;background:#16a085;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;margin-bottom:12px">Refresh Requests</button>
        <div id="notifyRequestsList_${modalId}"></div>
      </div>
    </div>
  `;
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
  renderNotifyRequestsList(modalId);
}

// ============ CLIENT CARD MANAGEMENT ============

function cardCodeClean(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
}

function cardDomId(code) {
  return String(code || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function clientCardLink(code) {
  return 'https://aylensale.com?card=' + encodeURIComponent(cardCodeClean(code));
}

function clientCardQrUrl(code) {
  return 'https://quickchart.io/qr?size=220&text=' + encodeURIComponent(clientCardLink(code));
}

function formatOrderDate(value) {
  try {
    var date = value && value.toDate ? value.toDate() : (value ? new Date(value) : null);
    return date && !isNaN(date.getTime()) ? date.toLocaleString('en-GB') : '-';
  } catch (e) {
    return '-';
  }
}

function orderTimeMs(value) {
  if (value && value.toMillis) return value.toMillis();
  var date = value ? new Date(value) : null;
  return date && !isNaN(date.getTime()) ? date.getTime() : 0;
}

function buildCustomerStats(orders) {
  var stats = {};
  (Array.isArray(orders) ? orders : []).forEach(function(order) {
    var code = cardCodeClean(order.card);
    if (!code) return;
    if (!stats[code]) {
      stats[code] = {
        orders: [],
        orderCount: 0,
        totalSpend: 0,
        firstOrder: null,
        lastOrder: null,
        contacts: {}
      };
    }
    var s = stats[code];
    var ts = orderTimeMs(order.createdAt);
    s.orders.push(order);
    s.orderCount++;
    s.totalSpend += Number(order.total || 0);
    if (!s.firstOrder || ts < orderTimeMs(s.firstOrder)) s.firstOrder = order.createdAt;
    if (!s.lastOrder || ts > orderTimeMs(s.lastOrder)) s.lastOrder = order.createdAt;
    var contactKey = (order.name || 'Customer') + ' | ' + (order.phone || '');
    s.contacts[contactKey] = true;
  });
  return stats;
}

async function loadCustomerStats() {
  if (!window.FBDB || !window.FBDB.loadOrders) return {};
  try {
    return buildCustomerStats(await window.FBDB.loadOrders());
  } catch (error) {
    console.warn('Could not load customer stats:', error.message || error);
    return {};
  }
}

async function loadPrivateCardNotes() {
  if (!window.FBDB || !window.FBDB.loadCardNotes) return {};
  try {
    return await window.FBDB.loadCardNotes();
  } catch (error) {
    console.warn('Could not load private card notes:', error.message || error);
    return {};
  }
}

function openCardsModal() {
  var modalId = 'cardsModal_' + Date.now();
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:min(980px,96vw);max-height:90vh;overflow-y:auto">
        <span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:10px"><i class="fas fa-id-card"></i> Client Cards</h2>
        <p style="color:#999;font-size:13px;margin-bottom:14px">Manual unique codes, QR links, discount levels, private notes and customer order stats. Codes are saved in Firestore.</p>

        <div style="background:#0f1419;border:1px solid #222;border-radius:10px;padding:12px;margin-bottom:12px">
          <div style="display:grid;grid-template-columns:1fr 1fr 110px 120px;gap:8px;margin-bottom:8px">
            <input type="text" id="newCardCode" placeholder="Manual code e.g. TESTCODE" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px;text-transform:uppercase">
            <input type="text" id="newCardName" placeholder="Customer name / description" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
            <input type="number" id="newCardDiscount" placeholder="%" min="0" max="100" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
            <select id="newCardStatus" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
              <option value="unused">unused</option>
              <option value="active">active</option>
              <option value="blocked">blocked</option>
            </select>
          </div>
          <textarea id="bulkCardCodes" placeholder="Bulk import: one card code per line" style="width:100%;min-height:72px;padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px;margin-bottom:8px"></textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="createClientCards('${modalId}')" style="padding:10px 13px;background:#9b59b6;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold">Add Code(s)</button>
            <button onclick="exportClientCardsCsv()" style="padding:10px 13px;background:#3498db;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold"><i class="fas fa-download"></i> Export Codes CSV</button>
            <button onclick="printClientCards()" style="padding:10px 13px;background:#1a1a2e;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold"><i class="fas fa-print"></i> Print / Save PDF</button>
            <button onclick="renderCardsList('${modalId}')" style="padding:10px 13px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold">Refresh Stats</button>
          </div>
        </div>

        <div id="topCustomers_${modalId}"></div>
        <div id="cardsList_${modalId}"></div>
      </div>
    </div>
  `;

  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
  renderCardsList(modalId);
}

async function renderCardsList(modalId) {
  var list = document.getElementById('cardsList_' + modalId);
  var top = document.getElementById('topCustomers_' + modalId);
  if (!list) return;
  list.innerHTML = '<div style="color:#999;text-align:center;padding:18px">Loading client cards and customer stats...</div>';

  var stats = await loadCustomerStats();
  var privateNotes = await loadPrivateCardNotes();
  var codes = Object.keys(cardHolders || {}).sort();
  var topCodes = codes.filter(function(code) {
    return stats[code] && stats[code].orderCount > 0;
  }).sort(function(a, b) {
    var sa = stats[a];
    var sb = stats[b];
    return (sb.totalSpend - sa.totalSpend) || (sb.orderCount - sa.orderCount) || (orderTimeMs(sb.lastOrder) - orderTimeMs(sa.lastOrder));
  }).slice(0, 8);

  if (top) {
    top.innerHTML = topCodes.length ? '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px;margin-bottom:12px;color:#7c2d12">' +
      '<b>Top Customers</b><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      topCodes.map(function(code) {
        var s = stats[code];
        return '<span style="background:#ffedd5;border:1px solid #fdba74;border-radius:999px;padding:6px 9px;font-size:12px"><b>' + escapeHtml(code) + '</b> · ' + s.orderCount + ' orders · £' + s.totalSpend.toFixed(2) + '</span>';
      }).join('') + '</div></div>' : '';
  }

  if (codes.length === 0) {
    list.innerHTML = '<div style="color:#999;text-align:center;padding:20px;border:1px dashed #333;border-radius:6px">No client card codes yet</div>';
    return;
  }

  var html = '<div style="display:grid;gap:10px">';
  codes.forEach(function(code) {
    var card = cardHolders[code] || {};
    card.note = privateNotes[code] || card.note || '';
    var id = cardDomId(code);
    var status = card.status || (card.active === false ? 'blocked' : 'unused');
    var s = stats[code] || { orderCount: 0, totalSpend: 0, contacts: {}, orders: [] };
    var contacts = Object.keys(s.contacts || {}).join('<br>');
    var ordersHtml = (s.orders || []).slice(0, 5).map(function(order) {
      return '<div style="font-size:12px;color:#ccc;border-top:1px solid #222;padding-top:5px;margin-top:5px">' +
        formatOrderDate(order.createdAt) + ' · £' + Number(order.total || 0).toFixed(2) + ' · ' + escapeHtml(order.pickup || '') +
      '</div>';
    }).join('');
    html += `
      <div style="background:#0f1419;border:1px solid #222;border-radius:10px;padding:12px;color:#e0e0e0">
        <div style="display:grid;grid-template-columns:96px 1fr;gap:12px">
          <div>
            <img src="${escapeHtml(clientCardQrUrl(code))}" alt="QR ${escapeHtml(code)}" style="width:96px;height:96px;background:#fff;border-radius:6px;padding:4px">
            <a href="${escapeHtml(clientCardLink(code))}" target="_blank" style="display:block;color:#93c5fd;font-size:11px;word-break:break-all;margin-top:6px">Open link</a>
          </div>
          <div>
            <div style="display:grid;grid-template-columns:1fr 1fr 90px 110px;gap:8px;margin-bottom:8px">
              <input value="${escapeHtml(code)}" disabled style="padding:8px;border:1px solid #333;background:#111;color:#999;border-radius:4px;font-weight:bold">
              <input id="cardName_${modalId}_${id}" value="${escapeHtml(card.name || '')}" placeholder="Customer / description" style="padding:8px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:4px">
              <input id="cardDiscount_${modalId}_${id}" type="number" min="0" max="100" value="${Number(card.discount || 0)}" style="padding:8px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:4px">
              <select id="cardStatus_${modalId}_${id}" style="padding:8px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:4px">
                <option value="unused" ${status === 'unused' ? 'selected' : ''}>unused</option>
                <option value="active" ${status === 'active' ? 'selected' : ''}>active</option>
                <option value="blocked" ${status === 'blocked' ? 'selected' : ''}>blocked</option>
              </select>
            </div>
            <textarea id="cardNote_${modalId}_${id}" placeholder="Private admin note" style="width:100%;min-height:54px;padding:8px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:4px;margin-bottom:8px">${escapeHtml(card.note || '')}</textarea>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;font-size:12px;color:#ccc;margin-bottom:8px">
              <span>Orders: <b>${s.orderCount || 0}</b></span>
              <span>Total: <b>£${Number(s.totalSpend || 0).toFixed(2)}</b></span>
              <span>First: <b>${formatOrderDate(s.firstOrder)}</b></span>
              <span>Last: <b>${formatOrderDate(s.lastOrder)}</b></span>
            </div>
            ${contacts ? '<div style="font-size:12px;color:#aaa;margin-bottom:8px">Contacts:<br>' + contacts + '</div>' : ''}
            ${ordersHtml}
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">
              <button onclick="saveClientCard(${jsInlineArg(code)},'${modalId}')" style="padding:8px 10px;background:#00cc66;color:#fff;border:none;border-radius:5px;cursor:pointer">Save</button>
              <button onclick="blockClientCard(${jsInlineArg(code)},'${modalId}')" style="padding:8px 10px;background:#f39c12;color:#fff;border:none;border-radius:5px;cursor:pointer">Block</button>
              <button onclick="copyNotifyContact(${jsInlineArg(clientCardLink(code))})" style="padding:8px 10px;background:#6b7280;color:#fff;border:none;border-radius:5px;cursor:pointer">Copy Link</button>
              <button onclick="removeClientCard(${jsInlineArg(code)},'${modalId}')" style="padding:8px 10px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer">Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  list.innerHTML = html;
}

async function createClientCards(modalId) {
  var single = cardCodeClean(document.getElementById('newCardCode').value);
  var bulk = String(document.getElementById('bulkCardCodes').value || '').split(/\r?\n/).map(cardCodeClean).filter(Boolean);
  var codes = [];
  if (single) codes.push(single);
  bulk.forEach(function(code) {
    if (codes.indexOf(code) === -1) codes.push(code);
  });
  var name = document.getElementById('newCardName').value.trim();
  var discount = parseFloat(document.getElementById('newCardDiscount').value) || 0;
  var status = document.getElementById('newCardStatus').value || 'unused';

  if (!codes.length || discount < 0 || discount > 100) {
    notify('Enter at least one unique code and discount 0-100%', 'error');
    return;
  }

  var added = 0;
  var skipped = 0;
  for (var i = 0; i < codes.length; i++) {
    var code = codes[i];
    if (cardHolders[code]) {
      skipped++;
      continue;
    }
    var card = {
      name: name || 'Customer',
      discount: discount,
      status: status,
      active: status !== 'blocked',
      note: ''
    };
    if (window.FBDB && window.FBDB.saveCard) {
      await window.FBDB.saveCard(code, card);
    }
    cardHolders[code] = Object.assign({ code: code }, card);
    added++;
  }

  document.getElementById('newCardCode').value = '';
  document.getElementById('bulkCardCodes').value = '';
  renderCardsList(modalId);
  notify('Client cards added: ' + added + (skipped ? ', duplicates skipped: ' + skipped : ''), skipped ? 'info' : 'success');
}

async function saveClientCard(code, modalId) {
  try {
    var id = cardDomId(code);
    var name = document.getElementById('cardName_' + modalId + '_' + id).value.trim() || 'Customer';
    var discount = parseFloat(document.getElementById('cardDiscount_' + modalId + '_' + id).value) || 0;
    var status = document.getElementById('cardStatus_' + modalId + '_' + id).value || 'unused';
    var note = document.getElementById('cardNote_' + modalId + '_' + id).value.trim();
    if (discount < 0 || discount > 100) {
      notify('Discount must be 0-100%', 'error');
      return;
    }
    cardHolders[code] = { code: code, name: name, discount: discount, status: status, active: status !== 'blocked' };
    if (window.FBDB && window.FBDB.saveCard) {
      await window.FBDB.saveCard(code, cardHolders[code]);
    }
    if (window.FBDB && window.FBDB.saveCardNote) {
      await window.FBDB.saveCardNote(code, note);
    }
    validateCurrentUserCard();
    recalculateCartPrices();
    renderProducts();
    renderCart();
    notify('Client card saved', 'success');
  } catch (error) {
    notify('Save failed: ' + (error.message || error), 'error');
  }
}

async function blockClientCard(code, modalId) {
  cardHolders[code] = Object.assign({}, cardHolders[code] || {}, { status: 'blocked', active: false });
  if (window.FBDB && window.FBDB.saveCard) {
    await window.FBDB.saveCard(code, cardHolders[code]);
  }
  renderCardsList(modalId);
  notify('Client card blocked', 'success');
}

async function removeClientCard(code, modalId) {
  if (!confirm('Delete client card ' + code + '?')) return;
  if (window.FBDB && window.FBDB.deleteCard) {
    await window.FBDB.deleteCard(code);
  }
  delete cardHolders[code];
  renderCardsList(modalId);
  notify('Client card deleted', 'success');
}

function exportClientCardsCsv() {
  var rows = [['card code', 'direct link', 'QR-code', 'status']];
  Object.keys(cardHolders || {}).sort().forEach(function(code) {
    var card = cardHolders[code] || {};
    rows.push([code, clientCardLink(code), clientCardQrUrl(code), card.status || 'unused']);
  });
  var csv = rows.map(function(row) {
    return row.map(function(value) {
      return '"' + String(value || '').replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'aylensale-client-cards.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function printClientCards() {
  var cards = Object.keys(cardHolders || {}).sort().map(function(code) {
    var card = cardHolders[code] || {};
    return '<div class="card"><img src="' + clientCardQrUrl(code) + '"><h2>' + escapeHtml(code) + '</h2><p>' + escapeHtml(clientCardLink(code)) + '</p><p>Status: ' + escapeHtml(card.status || 'unused') + '</p></div>';
  }).join('');
  var html = '<!doctype html><html><head><title>AYLENSALE Client Cards</title><style>body{font-family:Arial;padding:20px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}.card{border:1px solid #ddd;border-radius:12px;padding:14px;text-align:center;break-inside:avoid}.card img{width:150px;height:150px}.card h2{margin:8px 0;color:#e94560}.card p{font-size:11px;word-break:break-all}</style></head><body><h1>AYLENSALE Client Cards</h1><div class="grid">' + cards + '</div><script>window.print()<\/script></body></html>';
  var win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

// ============ EBAY STORE SETTINGS ============

// ============ PRICE LIST ADMIN ============

function priceListItemFormHtml(prefix, item) {
  item = item || {};
  return '<input id="' + prefix + 'Name" value="' + escapeHtml(item.name || '') + '" placeholder="Item name *" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">' +
    '<textarea id="' + prefix + 'Desc" placeholder="Description" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px;min-height:60px">' + escapeHtml(item.desc || '') + '</textarea>' +
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' +
      '<input id="' + prefix + 'Retail" type="number" step="0.01" min="0" value="' + Number(item.retailPrice || 0) + '" placeholder="Retail £" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">' +
      '<input id="' + prefix + 'Wholesale" type="number" step="0.01" min="0" value="' + Number(item.wholesalePrice || 0) + '" placeholder="Wholesale £" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">' +
      '<input id="' + prefix + 'MinQty" type="number" step="1" min="1" value="' + Number(item.minQty || 1) + '" placeholder="Min qty" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 100px 120px;gap:8px">' +
      '<input id="' + prefix + 'Status" value="' + escapeHtml(item.stockStatus || 'available') + '" placeholder="Stock/status" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">' +
      '<input id="' + prefix + 'Order" type="number" step="1" value="' + Number(item.sortOrder || 0) + '" placeholder="Order" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">' +
      '<label style="color:#e0e0e0;display:flex;align-items:center;gap:6px"><input id="' + prefix + 'Visible" type="checkbox" ' + (item.visible === false ? '' : 'checked') + '> Show</label>' +
    '</div>' +
    '<input id="' + prefix + 'Note" value="' + escapeHtml(item.note || '') + '" placeholder="Note" style="padding:10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">' +
    '<input id="' + prefix + 'Photo" type="file" accept="image/*" style="padding:10px;border:1px dashed #e94560;background:#1a1f2e;color:#e0e0e0;border-radius:5px">';
}

function readPriceListItemForm(prefix, existing) {
  existing = existing || {};
  return {
    id: existing.id || '',
    sourceProductId: existing.sourceProductId || '',
    name: document.getElementById(prefix + 'Name').value.trim(),
    desc: document.getElementById(prefix + 'Desc').value.trim(),
    retailPrice: parseFloat(document.getElementById(prefix + 'Retail').value) || 0,
    wholesalePrice: parseFloat(document.getElementById(prefix + 'Wholesale').value) || 0,
    minQty: parseInt(document.getElementById(prefix + 'MinQty').value, 10) || 1,
    stockStatus: document.getElementById(prefix + 'Status').value.trim() || 'available',
    sortOrder: parseInt(document.getElementById(prefix + 'Order').value, 10) || 0,
    visible: document.getElementById(prefix + 'Visible').checked,
    note: document.getElementById(prefix + 'Note').value.trim(),
    images: existing.images || [],
    photoUrl: existing.photoUrl || ''
  };
}

function openPriceListAdminModal() {
  var modalId = 'priceListAdmin_' + Date.now();
  var options = products.map(function(p) {
    return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name || 'Product') + '</option>';
  }).join('');
  var html = '<div id="' + modalId + '" class="modal" style="display:flex">' +
    '<div class="modal-content" style="width:min(980px,96vw);max-height:90vh;overflow-y:auto;background:#101522;color:#e0e0e0">' +
      '<span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer;color:#fff">&times;</span>' +
      '<h2 style="color:#e94560;margin-bottom:10px"><i class="fas fa-file-invoice"></i> Price List Admin</h2>' +
      '<p style="color:#aaa;font-size:13px;margin-bottom:12px">Price list is separate from Our Products. Add custom items or copy from Products.</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">' +
        '<div style="background:#0f1419;border:1px solid #222;border-radius:10px;padding:12px">' +
          '<h3 style="margin:0 0 10px;color:#fff">Add from Products</h3>' +
          '<select id="priceProductSelect_' + modalId + '" style="width:100%;padding:10px;background:#1a1f2e;color:#e0e0e0;border:1px solid #333;border-radius:5px;margin-bottom:8px">' + options + '</select>' +
          '<button onclick="addPriceListFromProduct(' + jsInlineArg(modalId) + ')" style="width:100%;padding:10px;background:#3498db;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold">Add from Products</button>' +
        '</div>' +
        '<div style="background:#0f1419;border:1px solid #222;border-radius:10px;padding:12px">' +
          '<h3 style="margin:0 0 10px;color:#fff">Add Custom Item</h3>' +
          '<div style="display:grid;gap:8px">' + priceListItemFormHtml('newPrice_', {}) +
          '<button onclick="addCustomPriceListItem(' + jsInlineArg(modalId) + ')" style="padding:10px;background:#00cc66;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold">Add Custom Item</button></div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
        '<button onclick="renderPriceListAdminItems(' + jsInlineArg(modalId) + ')" style="padding:9px 12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer">Refresh</button>' +
        '<button onclick="downloadPriceList()" style="padding:9px 12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer">Download HTML</button>' +
        '<button onclick="printPriceList()" style="padding:9px 12px;background:#1a1a2e;color:#fff;border:1px solid #555;border-radius:5px;cursor:pointer">Print / Save PDF</button>' +
        '<button onclick="downloadPriceListCsv()" style="padding:9px 12px;background:#3498db;color:#fff;border:none;border-radius:5px;cursor:pointer">Download CSV</button>' +
      '</div>' +
      '<div id="priceListAdminItems_' + modalId + '"></div>' +
    '</div></div>';
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
  renderPriceListAdminItems(modalId);
}

async function addPriceListFromProduct(modalId) {
  var productId = document.getElementById('priceProductSelect_' + modalId).value;
  var p = products.find(function(item) { return sameId(item.id, productId); });
  if (!p) return notify('Product not found', 'error');
  var item = {
    id: 'pli_' + Date.now(),
    sourceProductId: p.id,
    name: p.name,
    desc: p.desc || p.description || '',
    retailPrice: Number(p.retailPrice || p.retail || p.price || 0),
    wholesalePrice: Number(p.wholesalePrice || p.wholesale || 0),
    minQty: 1,
    stockStatus: Number(p.stock || 0) > 0 ? 'in stock' : 'out of stock',
    note: '',
    images: p.images || [],
    photoUrl: (p.images && p.images[0]) || '',
    visible: true,
    sortOrder: priceListItems.length + 1
  };
  await savePriceListItemAndRefresh(item, modalId);
}

async function addCustomPriceListItem(modalId) {
  var item = readPriceListItemForm('newPrice_', { id: 'pli_' + Date.now(), sortOrder: priceListItems.length + 1 });
  await uploadPriceListPhotoIfNeeded(item, 'newPrice_Photo');
  await savePriceListItemAndRefresh(item, modalId);
}

async function uploadPriceListPhotoIfNeeded(item, inputId) {
  var input = document.getElementById(inputId);
  if (input && input.files && input.files[0]) {
    currentEditingProductId = 'price-list_' + (item.id || Date.now());
    window.currentEditingProductId = currentEditingProductId;
    var upload = await uploadImageToCloudinary(input.files[0]);
    if (!upload.success) throw new Error(upload.error || 'Photo upload failed');
    item.images = [upload.url];
    item.photoUrl = upload.url;
  }
}

async function savePriceListItemAndRefresh(item, modalId) {
  if (!item.name || item.retailPrice <= 0) return notify('Name and retail price are required', 'error');
  if (!window.FBDB || !window.FBDB.savePriceListItem) throw new Error('Firebase price list is not ready.');
  var saved = await window.FBDB.savePriceListItem(item);
  var idx = priceListItems.findIndex(function(existing) { return sameId(existing.id, saved.id); });
  if (idx >= 0) priceListItems[idx] = saved;
  else priceListItems.push(saved);
  renderPriceListAdminItems(modalId);
  notify('Price list item saved', 'success');
}

function renderPriceListAdminItems(modalId) {
  var wrap = document.getElementById('priceListAdminItems_' + modalId);
  if (!wrap) return;
  var list = (priceListItems || []).slice().sort(function(a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); });
  if (!list.length) {
    wrap.innerHTML = '<div style="color:#999;text-align:center;padding:18px;border:1px dashed #333;border-radius:8px">Price list is empty</div>';
    return;
  }
  wrap.innerHTML = list.map(function(item) {
    var prefix = 'pli_' + cardDomId(item.id) + '_';
    var img = item.photoUrl || (item.images && item.images[0]) || PRODUCT_FALLBACK_IMAGE;
    return '<div style="display:grid;grid-template-columns:90px 1fr;gap:10px;background:#0f1419;border:1px solid #222;border-radius:10px;padding:10px;margin-bottom:10px">' +
      '<img src="' + escapeHtml(img) + '" style="width:90px;height:90px;object-fit:cover;border-radius:8px;background:#1a1a2e">' +
      '<div style="display:grid;gap:8px">' + priceListItemFormHtml(prefix, item) +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          '<button onclick="saveExistingPriceListItem(' + jsInlineArg(item.id) + ',' + jsInlineArg(prefix) + ',' + jsInlineArg(modalId) + ')" style="padding:8px 10px;background:#00cc66;color:#fff;border:none;border-radius:5px;cursor:pointer">Save</button>' +
          '<button onclick="deletePriceListItem(' + jsInlineArg(item.id) + ',' + jsInlineArg(modalId) + ')" style="padding:8px 10px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer">Delete</button>' +
        '</div></div></div>';
  }).join('');
}

async function saveExistingPriceListItem(id, prefix, modalId) {
  var existing = priceListItems.find(function(item) { return sameId(item.id, id); });
  if (!existing) return notify('Price list item not found', 'error');
  var item = readPriceListItemForm(prefix, existing);
  await uploadPriceListPhotoIfNeeded(item, prefix + 'Photo');
  await savePriceListItemAndRefresh(item, modalId);
}

async function deletePriceListItem(id, modalId) {
  if (!confirm('Delete this price list item?')) return;
  if (!window.FBDB || !window.FBDB.deletePriceListItem) throw new Error('Firebase price list is not ready.');
  await window.FBDB.deletePriceListItem(id);
  priceListItems = priceListItems.filter(function(item) { return !sameId(item.id, id); });
  renderPriceListAdminItems(modalId);
  notify('Price list item deleted', 'success');
}

function openEbaySettingsModal() {
  var modalId = 'ebaySettingsModal_' + Date.now();
  var settings = Object.assign({
    enabled: false,
    url: '',
    buttonText: 'Shop on eBay',
    description: 'Prefer eBay? You can also buy from our official AYLENSALE eBay store.'
  }, (siteSettings && siteSettings.ebay) || {});
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:min(560px,94vw);max-height:90vh;overflow-y:auto">
        <span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#0064d2;margin-bottom:12px"><i class="fas fa-store"></i> eBay Store Block</h2>
        <p style="color:#777;font-size:13px;margin-bottom:14px">This controls the homepage eBay card and header button. Settings are saved in Firebase.</p>
        <label style="display:block;color:#1a1a2e;font-weight:bold;margin-bottom:6px">eBay Store URL</label>
        <input id="ebayStoreUrl_${modalId}" type="url" value="${escapeHtml(settings.url || '')}" placeholder="https://www.ebay.co.uk/str/your-store" style="width:100%;padding:11px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px">
        <label style="display:block;color:#1a1a2e;font-weight:bold;margin-bottom:6px">Button Text</label>
        <input id="ebayButtonText_${modalId}" value="${escapeHtml(settings.buttonText || 'Shop on eBay')}" placeholder="Shop on eBay" style="width:100%;padding:11px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px">
        <label style="display:block;color:#1a1a2e;font-weight:bold;margin-bottom:6px">Description</label>
        <textarea id="ebayDescription_${modalId}" style="width:100%;min-height:84px;padding:11px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px">${escapeHtml(settings.description || '')}</textarea>
        <label style="display:flex;align-items:center;gap:8px;color:#1a1a2e;font-weight:bold;margin-bottom:14px">
          <input id="ebayEnabled_${modalId}" type="checkbox" ${settings.enabled ? 'checked' : ''} style="width:auto;margin:0"> Show eBay block and header button
        </label>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button onclick="saveEbaySettings('${modalId}')" style="flex:1;min-width:180px;padding:12px;background:#0064d2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold">Save eBay Settings</button>
          <button onclick="AYLEN_MODAL.close()" style="flex:1;min-width:120px;padding:12px;background:#555;color:#fff;border:none;border-radius:8px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
}

async function saveEbaySettings(modalId) {
  try {
    var url = document.getElementById('ebayStoreUrl_' + modalId).value.trim();
    var buttonText = document.getElementById('ebayButtonText_' + modalId).value.trim() || 'Shop on eBay';
    var description = document.getElementById('ebayDescription_' + modalId).value.trim() || 'Prefer eBay? You can also buy from our official AYLENSALE eBay store.';
    var enabled = document.getElementById('ebayEnabled_' + modalId).checked;
    if (enabled && !validEbayUrl(url)) {
      notify('Please enter a valid https eBay store URL', 'error');
      return;
    }
    if (!window.FBDB || !window.FBDB.saveEbaySettings) {
      throw new Error('Firebase settings are not ready.');
    }
    var saved = await window.FBDB.saveEbaySettings({
      enabled: enabled,
      url: url,
      buttonText: buttonText,
      description: description
    });
    siteSettings.ebay = Object.assign({}, siteSettings.ebay, saved);
    renderEbayPromo();
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    else document.getElementById(modalId).remove();
    notify('eBay settings saved', 'success');
  } catch (error) {
    notify('Save failed: ' + (error.message || error), 'error');
  }
}

function openMarketplaceSettingsModal() {
  var modalId = 'marketplaceSettingsModal_' + Date.now();
  var settings = Object.assign({
    newArrivalsEnabled: true,
    telegramUrl: 'https://t.me/aylensale',
    whatsappUrl: 'https://wa.me/?text=Hi%20AYLENSALE!%20I%27m%20interested%20in%20your%20wholesale%20stock%20and%20weekend%20car%20boot%20deals.%20Please%20send%20availability%20and%20prices.%20Thank%20you!'
  }, (siteSettings && siteSettings.marketplace) || {});
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:min(560px,94vw);max-height:90vh;overflow-y:auto">
        <span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:12px"><i class="fas fa-wand-magic-sparkles"></i> Marketplace Style</h2>
        <p style="color:#999;font-size:13px;margin-bottom:14px">Controls live marketplace visual sections. Settings are saved in Firebase.</p>
        <label style="display:flex;align-items:center;gap:8px;color:#fff;font-weight:bold;margin-bottom:14px">
          <input id="newArrivalsEnabled_${modalId}" type="checkbox" ${settings.newArrivalsEnabled !== false ? 'checked' : ''} style="width:auto;margin:0"> Show New Arrivals carousel
        </label>
        <label style="display:block;color:#fff;font-weight:bold;margin-bottom:6px">Telegram Button URL</label>
        <input id="telegramUrl_${modalId}" type="url" value="${escapeHtml(settings.telegramUrl || 'https://t.me/aylensale')}" placeholder="https://t.me/aylensale" style="width:100%;padding:11px;border:1px solid #333;border-radius:8px;margin-bottom:14px">
        <label style="display:block;color:#fff;font-weight:bold;margin-bottom:6px">WhatsApp Button URL</label>
        <input id="whatsappUrl_${modalId}" type="url" value="${escapeHtml(settings.whatsappUrl || 'https://wa.me/?text=Hi%20AYLENSALE!%20I%27m%20interested%20in%20your%20wholesale%20stock%20and%20weekend%20car%20boot%20deals.%20Please%20send%20availability%20and%20prices.%20Thank%20you!')}" placeholder="https://wa.me/447..." style="width:100%;padding:11px;border:1px solid #333;border-radius:8px;margin-bottom:14px">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button onclick="saveMarketplaceSettings('${modalId}')" style="flex:1;min-width:180px;padding:12px;background:#e94560;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold">Save Marketplace Style</button>
          <button onclick="AYLEN_MODAL.close()" style="flex:1;min-width:120px;padding:12px;background:#555;color:#fff;border:none;border-radius:8px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(html, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', html);
}

async function saveMarketplaceSettings(modalId) {
  try {
    var newArrivalsEnabled = document.getElementById('newArrivalsEnabled_' + modalId).checked;
    var telegramUrl = document.getElementById('telegramUrl_' + modalId).value.trim() || 'https://t.me/aylensale';
    var whatsappUrl = document.getElementById('whatsappUrl_' + modalId).value.trim() || 'https://wa.me/?text=Hi%20AYLENSALE!%20I%27m%20interested%20in%20your%20wholesale%20stock%20and%20weekend%20car%20boot%20deals.%20Please%20send%20availability%20and%20prices.%20Thank%20you!';
    if (!/^https:\/\/t\.me\/[a-z0-9_]{3,64}\/?$/i.test(telegramUrl)) {
      notify('Please enter a valid Telegram link like https://t.me/aylensale', 'error');
      return;
    }
    if (!/^https:\/\/(wa\.me\/|api\.whatsapp\.com\/send\?)/i.test(whatsappUrl)) {
      notify('Please enter a valid WhatsApp link like https://wa.me/447...', 'error');
      return;
    }
    if (!window.FBDB || !window.FBDB.saveMarketplaceSettings) {
      throw new Error('Firebase settings are not ready.');
    }
    var saved = await window.FBDB.saveMarketplaceSettings({
      newArrivalsEnabled: newArrivalsEnabled,
      telegramUrl: telegramUrl,
      whatsappUrl: whatsappUrl
    });
    siteSettings.marketplace = Object.assign({}, siteSettings.marketplace, saved);
    if (typeof renderNewArrivals === 'function') renderNewArrivals();
    if (typeof renderTelegramLinks === 'function') renderTelegramLinks();
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    else document.getElementById(modalId).remove();
    notify('Marketplace style saved', 'success');
  } catch (error) {
    notify('Save failed: ' + (error.message || error), 'error');
  }
}

// ============ LISTING POLICIES ============

async function openListingPoliciesModal() {
  try {
    if (window.FBDB && window.FBDB.seedListingPoliciesIfEmpty && !listingPolicies.length) {
      await window.FBDB.seedListingPoliciesIfEmpty();
    } else if (window.FBDB && window.FBDB.loadListingPolicies) {
      await window.FBDB.loadListingPolicies();
    }
  } catch (e) {
    notify('Could not load policies: ' + (e.message || e), 'error');
  }
  var modalId = 'listingPoliciesModal_' + Date.now();
  var rows = listingPolicies.slice().sort(function(a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
  var listHtml = rows.length ? rows.map(function(p) {
    return '<div style="border:1px solid #333;border-radius:8px;padding:10px;margin-bottom:8px;background:#0f1419">' +
      '<b style="color:#fff">' + escapeHtml(p.title) + '</b>' +
      (p.jobLot ? ' <span style="color:#fbbf24;font-size:11px">JOB LOT</span>' : '') +
      '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
        '<button onclick="editListingPolicy(' + jsInlineArg(p.id) + ',\'' + modalId + '\')" style="padding:6px 10px;background:#3498db;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Edit</button>' +
        '<button onclick="deleteListingPolicy(' + jsInlineArg(p.id) + ',\'' + modalId + '\')" style="padding:6px 10px;background:#e94560;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Delete</button>' +
      '</div></div>';
  }).join('') : '<p style="color:#999">No policies yet. Add one or seed defaults.</p>';

  var policiesHtml = '<div id="' + modalId + '" class="modal">' +
      '<div class="modal-content" style="width:min(720px,94vw);max-height:90vh;overflow-y:auto">' +
        '<span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>' +
        '<h2 style="color:#e94560"><i class="fas fa-scale-balanced"></i> Listing Policies</h2>' +
        '<p style="color:#999;font-size:13px">UK Consumer Rights Act 2015 — policies cannot remove statutory rights for misdescribed goods.</p>' +
        '<div style="margin:12px 0">' + listHtml + '</div>' +
        '<button onclick="editListingPolicy(\'\',\'' + modalId + '\')" style="width:100%;padding:10px;background:#00cc66;color:#1a1f2e;border:none;border-radius:6px;font-weight:bold;cursor:pointer;margin-bottom:8px">+ New policy</button>' +
        '<button onclick="seedDefaultListingPolicies(\'' + modalId + '\')" style="width:100%;padding:10px;background:#b45309;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer">Seed UK default policies</button>' +
      '</div></div>';
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(policiesHtml, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', policiesHtml);
}

function editListingPolicy(policyId, parentModalId) {
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(parentModalId || null);
  var existing = policyId ? getListingPolicyById(policyId) : null;
  var modalId = 'listingPolicyEdit_' + Date.now();
  var p = existing || { title: '', conditionText: '', returnPolicy: '', warrantyText: '', deliveryRules: '', ukDisclaimer: '', jobLot: false, sortOrder: 0 };
  var policyEditHtml = '<div id="' + modalId + '" class="modal">' +
      '<div class="modal-content" style="width:min(640px,94vw);max-height:90vh;overflow-y:auto">' +
        '<span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>' +
        '<h2 style="color:#e94560">' + (existing ? 'Edit policy' : 'New policy') + '</h2>' +
        '<label style="color:#ccc;font-weight:bold">Title</label><input id="lpTitle_' + modalId + '" value="' + escapeHtml(p.title) + '" style="width:100%;padding:10px;margin:6px 0 12px;border:1px solid #333;background:#1a1f2e;color:#fff;border-radius:5px">' +
        '<label style="color:#ccc;font-weight:bold">Condition text</label><textarea id="lpCondition_' + modalId + '" style="width:100%;padding:10px;margin:6px 0 12px;border:1px solid #333;background:#1a1f2e;color:#fff;border-radius:5px;height:70px">' + escapeHtml(p.conditionText) + '</textarea>' +
        '<label style="color:#ccc;font-weight:bold">Return policy</label><textarea id="lpReturn_' + modalId + '" style="width:100%;padding:10px;margin:6px 0 12px;border:1px solid #333;background:#1a1f2e;color:#fff;border-radius:5px;height:70px">' + escapeHtml(p.returnPolicy) + '</textarea>' +
        '<label style="color:#ccc;font-weight:bold">Warranty text</label><textarea id="lpWarranty_' + modalId + '" style="width:100%;padding:10px;margin:6px 0 12px;border:1px solid #333;background:#1a1f2e;color:#fff;border-radius:5px;height:60px">' + escapeHtml(p.warrantyText) + '</textarea>' +
        '<label style="color:#ccc;font-weight:bold">Delivery / collection</label><textarea id="lpDelivery_' + modalId + '" style="width:100%;padding:10px;margin:6px 0 12px;border:1px solid #333;background:#1a1f2e;color:#fff;border-radius:5px;height:60px">' + escapeHtml(p.deliveryRules) + '</textarea>' +
        '<label style="color:#ccc;font-weight:bold">UK disclaimer</label><textarea id="lpDisclaimer_' + modalId + '" style="width:100%;padding:10px;margin:6px 0 12px;border:1px solid #333;background:#1a1f2e;color:#fff;border-radius:5px;height:50px">' + escapeHtml(p.ukDisclaimer) + '</textarea>' +
        '<label style="color:#ccc"><input type="checkbox" id="lpJobLot_' + modalId + '" ' + (p.jobLot ? 'checked' : '') + '> Job lot / bulk policy</label>' +
        '<div style="display:flex;gap:8px;margin-top:14px">' +
          '<button onclick="saveListingPolicy(' + jsInlineArg(policyId || '') + ',\'' + modalId + '\',\'' + parentModalId + '\')" style="flex:1;padding:12px;background:#00cc66;color:#1a1f2e;border:none;border-radius:6px;font-weight:bold;cursor:pointer">Save policy</button>' +
          '<button onclick="AYLEN_MODAL.close()" style="flex:1;padding:12px;background:#555;color:#fff;border:none;border-radius:6px;cursor:pointer">Cancel</button>' +
        '</div></div></div>';
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(policyEditHtml, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', policyEditHtml);
}

async function saveListingPolicy(policyId, modalId, parentModalId) {
  try {
    var payload = {
      id: policyId || ('policy_' + Date.now()),
      title: document.getElementById('lpTitle_' + modalId).value.trim(),
      conditionText: document.getElementById('lpCondition_' + modalId).value.trim(),
      returnPolicy: document.getElementById('lpReturn_' + modalId).value.trim(),
      warrantyText: document.getElementById('lpWarranty_' + modalId).value.trim(),
      deliveryRules: document.getElementById('lpDelivery_' + modalId).value.trim(),
      ukDisclaimer: document.getElementById('lpDisclaimer_' + modalId).value.trim(),
      jobLot: document.getElementById('lpJobLot_' + modalId).checked
    };
    if (!payload.title) { notify('Policy title is required', 'error'); return; }
    await window.FBDB.saveListingPolicy(payload);
    if (window.AYLEN_MODAL) window.AYLEN_MODAL.close(modalId);
    else document.getElementById(modalId).remove();
    if (parentModalId) openListingPoliciesModal();
    notify('Policy saved', 'success');
  } catch (e) {
    notify('Policy save failed: ' + (e.message || e), 'error');
  }
}

async function deleteListingPolicy(policyId, parentModalId) {
  if (!confirm('Delete this listing policy?')) return;
  try {
    await window.FBDB.deleteListingPolicy(policyId);
    if (parentModalId) openListingPoliciesModal();
    notify('Policy deleted', 'success');
  } catch (e) {
    notify('Delete failed: ' + (e.message || e), 'error');
  }
}

async function seedDefaultListingPolicies(parentModalId) {
  try {
    await window.FBDB.seedListingPoliciesIfEmpty();
    if (parentModalId) openListingPoliciesModal();
    notify('Default policies ready', 'success');
  } catch (e) {
    notify('Seed failed: ' + (e.message || e), 'error');
  }
}

function openAuctionBidHistoryModal(auctionId) {
  var auction = auctions.find(function(a) { return sameId(a.id, auctionId); });
  if (!auction) return;
  var bids = (auctionBids[String(auction.id)] || auction.bids || []).slice().sort(function(a, b) {
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });
  var participants = {};
  bids.forEach(function(b) {
    var key = b.bidderName || b.bidder || 'Anonymous';
    if (!participants[key]) participants[key] = { name: key, count: 0, max: 0 };
    participants[key].count++;
    participants[key].max = Math.max(participants[key].max, Number(b.amount || 0));
  });
  var participantList = Object.keys(participants).map(function(k) { return participants[k]; });
  var rows = bids.map(function(b) {
    return '<tr><td>' + escapeHtml(b.bidderName || b.bidder || '—') + '</td><td>£' + Number(b.amount || 0).toFixed(2) + '</td><td>' + escapeHtml(b.timestamp ? new Date(b.timestamp).toLocaleString('en-GB') : '—') + '</td></tr>';
  }).join('') || '<tr><td colspan="3" style="color:#999">No bids yet</td></tr>';
  var modalId = 'auctionBids_' + Date.now();
  var bidHtml = '<div id="' + modalId + '" class="modal"><div class="modal-content" style="width:min(680px,94vw);max-height:90vh;overflow-y:auto">' +
      '<span class="close" onclick="AYLEN_MODAL.close()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>' +
      '<h2 style="color:#e94560"><i class="fas fa-gavel"></i> Bid history — ' + escapeHtml(auction.name) + '</h2>' +
      '<p style="color:#999">Participants: <b style="color:#fff">' + participantList.length + '</b> · Bids: <b style="color:#fff">' + bids.length + '</b></p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:10px 0 14px"><thead><tr style="color:#aaa;text-align:left"><th>Bidder</th><th>Amount</th><th>Time</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div style="font-size:12px;color:#ccc"><b>Participants</b><br>' +
      (participantList.map(function(p) { return escapeHtml(p.name) + ' (' + p.count + ' bids, max £' + p.max.toFixed(2) + ')'; }).join('<br>') || '—') +
      '</div></div></div>';
  if (window.AYLEN_MODAL) window.AYLEN_MODAL.open(bidHtml, { id: modalId });
  else document.body.insertAdjacentHTML('beforeend', bidHtml);
}

// Helper functions
function getProductById(id) {
  var idx = window.AYLEN_PRODUCTION
    ? window.AYLEN_PRODUCTION.findProductIndexById(products, id)
    : products.findIndex(function(p) { return sameId(p.id, id); });
  return idx === -1 ? null : products[idx];
}

async function downloadProductionBackup() {
  try {
    if (!window.FBDB || !window.FBDB.downloadProductionBackup) {
      throw new Error('Firebase backup is not ready.');
    }
    notify('Creating backup…', 'info');
    await window.FBDB.downloadProductionBackup();
    notify('Backup downloaded', 'success');
  } catch (error) {
    notify('Backup failed: ' + (error.message || error), 'error');
  }
}

// ============ FIREBASE STORAGE IMAGE UPLOAD ============
// This function uploads only to Firebase Storage and returns a public URL.
async function uploadImageToCloudinary(file) {
  if (window.FBDB && window.FBDB.uploadImage) {
    var productId = currentEditingProductId || Date.now();
    var result = await window.FBDB.uploadImage(file, productId);
    var isFirebaseUrl = result.url &&
      result.url.indexOf('data:') !== 0 &&
      (
        result.url.indexOf('firebasestorage.googleapis.com') !== -1 ||
        result.url.indexOf('storage.googleapis.com') !== -1
      );
    if (result.success && isFirebaseUrl) {
      return result;
    }
    return { success: false, error: result.error || 'Firebase Storage upload failed' };
  }

  return { success: false, error: 'Firebase Storage is not ready. Please refresh and try again.' };
}
