/**
 * Admin Mode Functions - UPDATED with Photo Upload Support
 * Handles edit/add/delete for products, auctions, locations
 * Integrates with Cloudinary for photo uploads
 */

var isAdminMode = false;
var adminLoggedIn = false;
var uploadingFiles = {};

// Initialize admin event listeners when document loads
document.addEventListener('DOMContentLoaded', function() {
  setupAdminAccessibility();
});

function setupAdminAccessibility() {
  // Secret keyboard shortcut: Ctrl+Shift+A to open admin login
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
      e.preventDefault();
      showAdminLoginModal();
    }
  });
  
  // Mobile admin button - triple tap on logo
  addMobileAdminButton();
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
        <input type="text" id="adminUser" placeholder="Username" style="width:100%;padding:12px;margin:10px 0;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="password" id="adminPass" placeholder="Password" style="width:100%;padding:12px;margin:10px 0;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <button onclick="verifyAdminLogin()" style="width:100%;padding:12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;margin:10px 0">Login</button>
        <button onclick="closeAdminLoginModal()" style="width:100%;padding:12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer;margin:5px 0">Cancel</button>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  var existing = document.getElementById('adminLoginModal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', loginHtml);
  document.getElementById('adminUser').focus();
}

function closeAdminLoginModal() {
  var modal = document.getElementById('adminLoginModal');
  if (modal) modal.remove();
}

function verifyAdminLogin() {
  var user = document.getElementById('adminUser').value;
  var pass = document.getElementById('adminPass').value;
  
  // For security, only check username locally
  // Password is validated on the server
  if (user !== 'admin') {
    notify('Invalid username', 'error');
    return;
  }
  
  // Send password to server for validation
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/admin-auth', true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  
  xhr.onload = function() {
    try {
      var data = JSON.parse(xhr.responseText);
      if (data.authenticated) {
        adminLoggedIn = true;
        closeAdminLoginModal();
        toggleAdminMode();
        notify('Admin mode enabled', 'success');
      } else {
        notify(data.error || 'Invalid credentials', 'error');
      }
    } catch (e) {
      notify('Authentication error: ' + e.message, 'error');
    }
  };
  
  xhr.onerror = function() {
    notify('Network error - check connection', 'error');
  };
  
  xhr.send(JSON.stringify({ password: pass }));
}

function toggleAdminMode() {
  isAdminMode = !isAdminMode;
  window.isAdminMode = isAdminMode; // Make it global
  localStorage.setItem('adminMode', isAdminMode ? 'true' : 'false');
  
  if (isAdminMode) {
    addAdminModeUI();
  } else {
    removeAdminModeUI();
  }
  
  // Re-render to show/hide admin controls
  setTimeout(function() {
    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderAuctions === 'function') renderAuctions();
    if (typeof renderLocations === 'function') renderLocations();
  }, 0);
}

function addAdminModeUI() {
  // Add admin toolbar to header
  var headerRight = document.querySelector('.header-right');
  
  var adminToolbar = document.createElement('div');
  adminToolbar.id = 'adminToolbar';
  adminToolbar.style.cssText = 'display:flex;gap:8px;align-items:center;padding:0 10px;border-left:1px solid #555';
  
  adminToolbar.innerHTML = `
    <span style="color:#e94560;font-size:12px;font-weight:bold">ADMIN</span>
    <button onclick="openAddProductModal()" style="padding:8px 12px;background:#00cc66;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold">+ Product</button>
    <button onclick="openAddAuctionModal()" style="padding:8px 12px;background:#3498db;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold">+ Auction</button>
    <button onclick="openAddLocationModal()" style="padding:8px 12px;background:#f39c12;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold">+ Location</button>
    <button onclick="toggleAdminMode()" style="padding:8px 12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold">Exit</button>
  `;
  
  headerRight.appendChild(adminToolbar);
}

function removeAdminModeUI() {
  var toolbar = document.getElementById('adminToolbar');
  if (toolbar) toolbar.remove();
}

// ============ PRODUCT MANAGEMENT WITH PHOTO UPLOAD ============

function openAddProductModal() {
  var modalId = 'productModal_' + Date.now();
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:600px;max-height:85vh;overflow-y:auto">
        <span class="close" onclick="document.getElementById('${modalId}').remove()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px"><i class="fas fa-plus-circle"></i> Add New Product</h2>
        
        <label style="color:#e0e0e0;font-weight:bold">Product Name *</label>
        <input type="text" id="prodName" placeholder="Enter product name" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        
        <label style="color:#e0e0e0;font-weight:bold">Description</label>
        <textarea id="prodDesc" placeholder="Product description" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px;height:60px;resize:vertical"></textarea>
        
        <div style="display:flex;gap:15px">
          <div style="flex:1">
            <label style="color:#e0e0e0;font-weight:bold">Retail Price £ *</label>
            <input type="number" id="prodRetailPrice" placeholder="0.00" step="0.01" min="0" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
          </div>
          <div style="flex:1">
            <label style="color:#e0e0e0;font-weight:bold">Wholesale Price £</label>
            <input type="number" id="prodWholesalePrice" placeholder="0.00" step="0.01" min="0" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
          </div>
        </div>
        
        <div style="display:flex;gap:15px">
          <div style="flex:1">
            <label style="color:#e0e0e0;font-weight:bold">Category *</label>
            <select id="prodCategory" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
              <option value="">Select category</option>
              <option value="electronics">Electronics</option>
              <option value="homeware">Homeware</option>
              <option value="clothing">Clothing</option>
              <option value="accessories">Accessories</option>
              <option value="general">General</option>
            </select>
          </div>
          <div style="flex:1">
            <label style="color:#e0e0e0;font-weight:bold">Stock Qty</label>
            <input type="number" id="prodStock" placeholder="0" min="0" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
          </div>
        </div>
        
        <label style="color:#e0e0e0;font-weight:bold"><i class="fas fa-images"></i> Upload Photos (max 10)</label>
        <input type="file" id="prodPhotoInput" accept="image/*" multiple style="width:100%;padding:10px;margin:5px 0 10px;border:1px dashed #e94560;background:#1a1f2e;color:#e0e0e0;border-radius:5px;cursor:pointer">
        <small style="color:#888;display:block;margin-bottom:15px">Accepted: JPG, PNG, GIF, WebP up to 5MB each</small>
        
        <div id="prodPhotoPreview" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;min-height:80px;border:1px solid #333;border-radius:5px;padding:10px;background:#0f1419">
          <span style="color:#666;width:100%;text-align:center;line-height:80px">No photos yet</span>
        </div>
        
        <div style="display:flex;gap:10px">
          <button onclick="addProductWithUpload('${modalId}')" style="flex:1;padding:12px;background:#00cc66;color:#1a1f2e;border:none;border-radius:5px;cursor:pointer;font-weight:bold"><i class="fas fa-save"></i> Save Product</button>
          <button onclick="document.getElementById('${modalId}').remove()" style="flex:1;padding:12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
  
  // Setup file input handler
  document.getElementById('prodPhotoInput').addEventListener('change', function(e) {
    handleProductPhotoUpload(e, modalId);
  });
  
  document.getElementById('prodName').focus();
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
  var preview = document.getElementById('prodPhotoPreview');
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
            preview.innerHTML = '<span style="color:#666;width:100%;text-align:center;line-height:80px">No photos</span>';
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
  var name = document.getElementById('prodName').value.trim();
  var desc = document.getElementById('prodDesc').value.trim();
  var retailPrice = parseFloat(document.getElementById('prodRetailPrice').value) || 0;
  var wholesalePrice = parseFloat(document.getElementById('prodWholesalePrice').value) || 0;
  var category = document.getElementById('prodCategory').value;
  var stock = parseInt(document.getElementById('prodStock').value) || 0;
  
  if (!name || !category || retailPrice <= 0) {
    notify('Fill all required fields!', 'error');
    return;
  }
  
  var imageUrls = [];
  
  // Upload files if any
  if (uploadingFiles['product'] && uploadingFiles['product'].length > 0) {
    var files = uploadingFiles['product'];
    for (var i = 0; i < files.length; i++) {
      var result = await uploadImageToCloudinary(files[i]);
      if (result.success) {
        imageUrls.push(result.url);
        notify('Uploading photo ' + (i + 1) + '/' + files.length, 'info');
      } else {
        notify('Error uploading photo ' + (i + 1) + ': ' + result.error, 'error');
        return;
      }
    }
  }
  
  // Add product with photos
  var product = addProductWithPhotos(name, desc, retailPrice, category, imageUrls, stock, wholesalePrice);
  if (product) {
    notify('Product added successfully!', 'success');
    uploadingFiles['product'] = [];
    document.getElementById(modalId).remove();
    renderProducts();
  } else {
    notify('Failed to save product', 'error');
  }
}

function editProduct(id) {
  var product = products.find(function(p) { return p.id === id; });
  if (!product) return;
  
  var modalId = 'productEditModal_' + Date.now();
  var photoHTML = '<span style="color:#666;width:100%;text-align:center;line-height:80px">No photos yet</span>';
  
  if (product.images && product.images.length > 0) {
    photoHTML = '';
    for (var i = 0; i < product.images.length; i++) {
      photoHTML += '<div style="position:relative;width:80px;height:80px;border:1px solid #444;border-radius:5px;overflow:hidden;background:#1a1f2e">';
      photoHTML += '<img src="' + product.images[i] + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\'">';
      photoHTML += '<button style="position:absolute;top:-5px;right:-5px;width:24px;height:24px;background:#e94560;color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:18px" onclick="removeProductPhoto(' + id + ',' + i + ',' + modalId + ')">×</button></div>';
    }
  }
  
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:600px;max-height:85vh;overflow-y:auto">
        <span class="close" onclick="document.getElementById('${modalId}').remove()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px"><i class="fas fa-edit"></i> Edit Product</h2>
        
        <label style="color:#e0e0e0;font-weight:bold">Product Name *</label>
        <input type="text" id="eprodName" value="${product.name}" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        
        <label style="color:#e0e0e0;font-weight:bold">Description</label>
        <textarea id="eprodDesc" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px;height:60px;resize:vertical">${product.desc || ''}</textarea>
        
        <div style="display:flex;gap:15px">
          <div style="flex:1">
            <label style="color:#e0e0e0;font-weight:bold">Retail Price £ *</label>
            <input type="number" id="eprodRetailPrice" value="${product.price || 0}" step="0.01" min="0" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
          </div>
          <div style="flex:1">
            <label style="color:#e0e0e0;font-weight:bold">Wholesale Price £</label>
            <input type="number" id="eprodWholesalePrice" value="${product.wholesale || 0}" step="0.01" min="0" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
          </div>
        </div>
        
        <div style="display:flex;gap:15px">
          <div style="flex:1">
            <label style="color:#e0e0e0;font-weight:bold">Category *</label>
            <select id="eprodCategory" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
              <option value="electronics" ${product.category === 'electronics' ? 'selected' : ''}>Electronics</option>
              <option value="homeware" ${product.category === 'homeware' ? 'selected' : ''}>Homeware</option>
              <option value="clothing" ${product.category === 'clothing' ? 'selected' : ''}>Clothing</option>
              <option value="accessories" ${product.category === 'accessories' ? 'selected' : ''}>Accessories</option>
              <option value="general" ${product.category === 'general' ? 'selected' : ''}>General</option>
            </select>
          </div>
          <div style="flex:1">
            <label style="color:#e0e0e0;font-weight:bold">Stock Qty</label>
            <input type="number" id="eprodStock" value="${product.stock || 0}" min="0" style="width:100%;padding:10px;margin:5px 0 15px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
          </div>
        </div>
        
        <label style="color:#e0e0e0;font-weight:bold"><i class="fas fa-images"></i> Current Photos (${(product.images || []).length}/10)</label>
        <div id="eprodPhotoPreview" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;min-height:80px;border:1px solid #333;border-radius:5px;padding:10px;background:#0f1419">
          ${photoHTML}
        </div>
        
        <label style="color:#e0e0e0;font-weight:bold">Add More Photos</label>
        <input type="file" id="eprodPhotoInput" accept="image/*" multiple style="width:100%;padding:10px;margin:5px 0 10px;border:1px dashed #e94560;background:#1a1f2e;color:#e0e0e0;border-radius:5px;cursor:pointer" ${(product.images && product.images.length >= 10) ? 'disabled' : ''}>
        
        <div style="display:flex;gap:10px">
          <button onclick="saveEditProduct('${id}','${modalId}')" style="flex:1;padding:12px;background:#00cc66;color:#1a1f2e;border:none;border-radius:5px;cursor:pointer;font-weight:bold"><i class="fas fa-save"></i> Save</button>
          <button onclick="deleteProductConfirm('${id}')" style="flex:1;padding:12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer"><i class="fas fa-trash"></i> Delete</button>
          <button onclick="document.getElementById('${modalId}').remove()" style="flex:1;padding:12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
  
  // Setup file input for editing
  var fileInput = document.getElementById('eprodPhotoInput');
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      handleEditProductPhotoUpload(e, id, modalId);
    });
  }
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
  var name = document.getElementById('eprodName').value.trim();
  var desc = document.getElementById('eprodDesc').value.trim();
  var retailPrice = parseFloat(document.getElementById('eprodRetailPrice').value) || 0;
  var wholesalePrice = parseFloat(document.getElementById('eprodWholesalePrice').value) || 0;
  var category = document.getElementById('eprodCategory').value;
  var stock = parseInt(document.getElementById('eprodStock').value) || 0;
  
  if (!name || !category || retailPrice <= 0) {
    notify('Fill all required fields!', 'error');
    return;
  }
  
  var product = products.find(function(p) { return p.id === productId; });
  if (!product) return;
  
  var imageUrls = product.images || [];
  
  // Upload new files if any
  var fileInputId = 'eprodPhotoInput';
  var fileInput = document.getElementById(fileInputId);
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    for (var i = 0; i < fileInput.files.length; i++) {
      var result = await uploadImageToCloudinary(fileInput.files[i]);
      if (result.success) {
        imageUrls.push(result.url);
        notify('Uploading photo ' + (i + 1) + '/' + fileInput.files.length, 'info');
      } else {
        notify('Error uploading photo ' + (i + 1), 'error');
        return;
      }
    }
  }
  
  // Update product
  updateProductById(productId, {
    name: name,
    desc: desc,
    price: retailPrice,
    retail: retailPrice,
    wholesale: wholesalePrice,
    category: category,
    stock: stock,
    images: imageUrls
  });
  
  notify('Product saved successfully!', 'success');
  document.getElementById(modalId).remove();
  renderProducts();
}

function removeProductPhoto(productId, photoIndex, modalId) {
  var product = products.find(function(p) { return p.id === productId; });
  if (!product || !product.images) return;
  
  if (confirm('Remove this photo?')) {
    product.images.splice(photoIndex, 1);
    DB.save('products', products);
    document.getElementById(modalId).remove();
    editProduct(productId);
    notify('Photo removed', 'info');
  }
}

function deleteProductConfirm(id) {
  var product = products.find(function(p) { return p.id === id; });
  if (!product) return;
  
  if (confirm('Delete "' + product.name + '"? This cannot be undone.')) {
    deleteProductById(id);
    notify('Product deleted', 'success');
    var modal = document.querySelector('.modal');
    if (modal) modal.remove();
    renderProducts();
  }
}

// ============ AUCTION MANAGEMENT ============

function openAddAuctionModal() {
  var modalId = 'auctionModal_' + Date.now();
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:550px;max-height:85vh;overflow-y:auto">
        <span class="close" onclick="document.getElementById('${modalId}').remove()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
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
          <button onclick="document.getElementById('${modalId}').remove()" style="flex:1;padding:12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
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
    document.getElementById(modalId).remove();
    renderAuctions();
  } else {
    notify('Failed to create auction', 'error');
  }
}

function editAuction(id) {
  var auction = auctions.find(function(a) { return a.id === id; });
  if (!auction) return;
  notify('Edit functionality coming soon', 'info');
}

function deleteAuctionConfirm(id) {
  var auction = auctions.find(function(a) { return a.id === id; });
  if (!auction) return;
  
  if (confirm('Delete this auction? This cannot be undone.')) {
    deleteAuctionById(id);
    notify('Auction deleted', 'success');
    renderAuctions();
  }
}

// ============ LOCATION MANAGEMENT ============

function openAddLocationModal() {
  var modalId = 'locationModal_' + Date.now();
  var html = `
    <div id="${modalId}" class="modal" style="display:flex">
      <div class="modal-content" style="width:500px">
        <span class="close" onclick="document.getElementById('${modalId}').remove()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px"><i class="fas fa-map-marker-alt"></i> Add Location</h2>
        
        <input type="text" id="locName" placeholder="Location Name *" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="text" id="locAddress" placeholder="Address *" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="text" id="locDay" placeholder="Day (e.g. Saturday) *" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="text" id="locTime" placeholder="Time (e.g. 8:00-14:00) *" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="number" id="locLat" placeholder="Latitude" step="0.0001" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        <input type="number" id="locLng" placeholder="Longitude" step="0.0001" style="width:100%;padding:10px;margin:5px 0 10px;border:1px solid #333;background:#1a1f2e;color:#e0e0e0;border-radius:5px">
        
        <div style="margin-bottom:15px">
          <label style="color:#e0e0e0"><input type="checkbox" id="locActive" style="cursor:pointer"> Active this week</label>
        </div>
        
        <div style="display:flex;gap:10px">
          <button onclick="addLocationWithData('${modalId}')" style="flex:1;padding:12px;background:#f39c12;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold"><i class="fas fa-save"></i> Add</button>
          <button onclick="document.getElementById('${modalId}').remove()" style="flex:1;padding:12px;background:#555;color:#fff;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('locName').focus();
}

function addLocationWithData(modalId) {
  var name = document.getElementById('locName').value.trim();
  var address = document.getElementById('locAddress').value.trim();
  var day = document.getElementById('locDay').value.trim();
  var time = document.getElementById('locTime').value.trim();
  var lat = parseFloat(document.getElementById('locLat').value) || 0;
  var lng = parseFloat(document.getElementById('locLng').value) || 0;
  var active = document.getElementById('locActive').checked;
  
  if (!name || !address || !day || !time) {
    notify('Fill all required fields!', 'error');
    return;
  }
  
  var newId = 1;
  locations.forEach(function(l) { if (l.id >= newId) newId = l.id + 1; });
  
  locations.push({
    id: newId,
    name: name,
    address: address,
    day: day,
    time: time,
    lat: lat,
    lng: lng,
    active: active,
    mapLink: 'https://maps.google.com?q=' + encodeURIComponent(address)
  });
  
  DB.save('locations', locations);
  notify('Location added!', 'success');
  document.getElementById(modalId).remove();
  renderLocations();
  fillPickup();
}

function editLocation(id) {
  var loc = locations.find(function(l) { return l.id === id; });
  if (!loc) return;
  notify('Edit functionality coming soon', 'info');
}

function deleteLocationConfirm(id) {
  var loc = locations.find(function(l) { return l.id === id; });
  if (!loc) return;
  
  if (confirm('Delete this location? This cannot be undone.')) {
    deleteLocationById(id);
    notify('Location deleted', 'success');
    renderLocations();
    fillPickup();
  }
}

// Helper functions
function getProductById(id) {
  return products.find(function(p) { return p.id === id; });
}
