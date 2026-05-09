/**
 * Admin Mode Functions
 * Handles edit/add/delete for products, auctions, locations
 * Integrates with the main application
 */

var isAdminMode = false;
var adminLoggedIn = false;

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
        <input type="text" id="adminUser" placeholder="Username" style="width:100%;padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:5px">
        <input type="password" id="adminPass" placeholder="Password" style="width:100%;padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:5px">
        <button onclick="verifyAdminLogin()" style="width:100%;padding:12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold;margin:10px 0">Login</button>
        <button onclick="closeAdminLoginModal()" style="width:100%;padding:12px;background:#ddd;color:#333;border:none;border-radius:5px;cursor:pointer;margin:5px 0">Cancel</button>
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
  
  // Check against config (ADMIN_LOGIN and ADMIN_PASS from config.js)
  if (user === ADMIN_LOGIN && pass === ADMIN_PASS) {
    adminLoggedIn = true;
    closeAdminLoginModal();
    toggleAdminMode();
    showToast('Admin mode enabled', 'success');
  } else {
    showToast('Invalid credentials', 'error');
  }
}

function toggleAdminMode() {
  isAdminMode = !isAdminMode;
  localStorage.setItem('adminMode', isAdminMode ? 'true' : 'false');
  
  if (isAdminMode) {
    addAdminModeUI();
  } else {
    removeAdminModeUI();
  }
  
  // Re-render to show/hide admin controls
  renderProducts();
  renderAuctions();
  renderLocations();
}

function addAdminModeUI() {
  // Add admin toolbar to header
  var headerRight = document.querySelector('.header-right');
  
  var adminToolbar = document.createElement('div');
  adminToolbar.id = 'adminToolbar';
  adminToolbar.style.cssText = 'display:flex;gap:8px;align-items:center;padding:0 10px;border-left:1px solid #555';
  
  adminToolbar.innerHTML = `
    <span style="color:#e94560;font-size:12px;font-weight:bold">ADMIN MODE</span>
    <button onclick="openAddProductModal()" style="padding:8px 12px;background:#00cc66;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px">+ Product</button>
    <button onclick="openAddAuctionModal()" style="padding:8px 12px;background:#3498db;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px">+ Auction</button>
    <button onclick="openAddLocationModal()" style="padding:8px 12px;background:#f39c12;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px">+ Location</button>
    <button onclick="toggleAdminMode()" style="padding:8px 12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:12px">Exit</button>
  `;
  
  headerRight.appendChild(adminToolbar);
}

function removeAdminModeUI() {
  var toolbar = document.getElementById('adminToolbar');
  if (toolbar) toolbar.remove();
}

// ============ PRODUCT MANAGEMENT ============

function openAddProductModal() {
  var html = `
    <div id="productModal" class="modal" style="display:flex">
      <div class="modal-content" style="width:500px">
        <span class="close" onclick="closeProductModal()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px">Add Product</h2>
        <input type="text" id="prodName" placeholder="Product Name" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <textarea id="prodDesc" placeholder="Description" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px;height:60px"></textarea>
        <input type="number" id="prodRetailPrice" placeholder="Retail Price" step="0.01" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <input type="number" id="prodWholesalePrice" placeholder="Wholesale Price" step="0.01" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <select id="prodCategory" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
          <option value="">Select Category</option>
          <option value="electronics">Electronics</option>
          <option value="homeware">Homeware</option>
          <option value="clothing">Clothing</option>
          <option value="accessories">Accessories</option>
        </select>
        <input type="number" id="prodStock" placeholder="Stock" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <input type="text" id="prodImages" placeholder="Image URLs (comma-separated)" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <div style="display:flex;gap:10px">
          <button onclick="addProduct()" style="flex:1;padding:12px;background:#00cc66;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold">Add Product</button>
          <button onclick="closeProductModal()" style="flex:1;padding:12px;background:#ddd;color:#333;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  var existing = document.getElementById('productModal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('prodName').focus();
}

function closeProductModal() {
  var modal = document.getElementById('productModal');
  if (modal) modal.remove();
}

function addProduct() {
  var name = document.getElementById('prodName').value.trim();
  var desc = document.getElementById('prodDesc').value.trim();
  var retailPrice = parseFloat(document.getElementById('prodRetailPrice').value);
  var wholesalePrice = parseFloat(document.getElementById('prodWholesalePrice').value);
  var category = document.getElementById('prodCategory').value;
  var stock = parseInt(document.getElementById('prodStock').value) || 0;
  var imageUrls = document.getElementById('prodImages').value.trim().split(',').map(u => u.trim()).filter(u => u);
  
  if (!name || !category) {
    showToast('Name and category required', 'error');
    return;
  }
  
  addProductWithPhotos(name, desc, retailPrice, category, imageUrls, stock, wholesalePrice);
  
  showToast('Product added successfully', 'success');
  closeProductModal();
  renderProducts();
}

// Product edit/delete in card
function editProduct(id) {
  var product = getProductById(id);
  if (!product) return;
  
  var html = `
    <div id="productModal" class="modal" style="display:flex">
      <div class="modal-content" style="width:500px">
        <span class="close" onclick="closeProductModal()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px">Edit Product</h2>
        <input type="text" id="prodName" placeholder="Product Name" value="${product.name || ''}" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <textarea id="prodDesc" placeholder="Description" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px;height:60px">${product.desc || ''}</textarea>
        <input type="number" id="prodRetailPrice" placeholder="Retail Price" value="${product.price || 0}" step="0.01" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <input type="number" id="prodWholesalePrice" placeholder="Wholesale Price" value="${product.wholesale || 0}" step="0.01" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <select id="prodCategory" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
          <option value="">Select Category</option>
          <option value="electronics" ${product.category === 'electronics' ? 'selected' : ''}>Electronics</option>
          <option value="homeware" ${product.category === 'homeware' ? 'selected' : ''}>Homeware</option>
          <option value="clothing" ${product.category === 'clothing' ? 'selected' : ''}>Clothing</option>
          <option value="accessories" ${product.category === 'accessories' ? 'selected' : ''}>Accessories</option>
        </select>
        <input type="number" id="prodStock" placeholder="Stock" value="${product.stock || 0}" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <input type="text" id="prodImages" placeholder="Image URLs (comma-separated)" value="${(product.images || []).join(', ')}" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <div style="display:flex;gap:10px">
          <button onclick="saveProductEdit('${id}')" style="flex:1;padding:12px;background:#00cc66;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold">Save</button>
          <button onclick="deleteProductConfirm('${id}')" style="flex:1;padding:12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer">Delete</button>
          <button onclick="closeProductModal()" style="flex:1;padding:12px;background:#ddd;color:#333;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  var existing = document.getElementById('productModal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', html);
}

function saveProductEdit(id) {
  var name = document.getElementById('prodName').value.trim();
  var desc = document.getElementById('prodDesc').value.trim();
  var retailPrice = parseFloat(document.getElementById('prodRetailPrice').value);
  var wholesalePrice = parseFloat(document.getElementById('prodWholesalePrice').value);
  var category = document.getElementById('prodCategory').value;
  var stock = parseInt(document.getElementById('prodStock').value) || 0;
  var imageUrls = document.getElementById('prodImages').value.trim().split(',').map(u => u.trim()).filter(u => u);
  
  if (!name || !category) {
    showToast('Name and category required', 'error');
    return;
  }
  
  updateProductById(id, {
    name: name,
    desc: desc,
    price: retailPrice,
    wholesale: wholesalePrice,
    category: category,
    stock: stock,
    images: imageUrls
  });
  
  showToast('Product saved', 'success');
  closeProductModal();
  renderProducts();
}

function deleteProductConfirm(id) {
  if (confirm('Are you sure? This cannot be undone.')) {
    deleteProductById(id);
    showToast('Product deleted', 'success');
    closeProductModal();
    renderProducts();
  }
}

// ============ AUCTION MANAGEMENT ============

function openAddAuctionModal() {
  var html = `
    <div id="auctionModal" class="modal" style="display:flex">
      <div class="modal-content" style="width:500px">
        <span class="close" onclick="closeAuctionModal()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px">Add Auction</h2>
        <input type="text" id="auctName" placeholder="Item Name" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <textarea id="auctDesc" placeholder="Description" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px;height:60px"></textarea>
        <input type="number" id="auctStartPrice" placeholder="Starting Price" step="0.01" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <select id="auctCategory" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
          <option value="">Select Category</option>
          <option value="electronics">Electronics</option>
          <option value="homeware">Homeware</option>
          <option value="collectibles">Collectibles</option>
        </select>
        <input type="number" id="auctDuration" placeholder="Duration (hours)" value="24" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <input type="text" id="auctImages" placeholder="Image URLs (comma-separated)" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <div style="display:flex;gap:10px">
          <button onclick="addAuction()" style="flex:1;padding:12px;background:#3498db;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold">Add Auction</button>
          <button onclick="closeAuctionModal()" style="flex:1;padding:12px;background:#ddd;color:#333;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  var existing = document.getElementById('auctionModal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('auctName').focus();
}

function closeAuctionModal() {
  var modal = document.getElementById('auctionModal');
  if (modal) modal.remove();
}

function addAuction() {
  var name = document.getElementById('auctName').value.trim();
  var desc = document.getElementById('auctDesc').value.trim();
  var startPrice = parseFloat(document.getElementById('auctStartPrice').value);
  var category = document.getElementById('auctCategory').value;
  var duration = parseInt(document.getElementById('auctDuration').value) || 24;
  var imageUrls = document.getElementById('auctImages').value.trim().split(',').map(u => u.trim()).filter(u => u);
  
  if (!name || !category) {
    showToast('Name and category required', 'error');
    return;
  }
  
  addAuctionWithPhotos(name, desc, startPrice, category, imageUrls, duration);
  
  showToast('Auction added', 'success');
  closeAuctionModal();
  renderAuctions();
}

function editAuction(id) {
  var auction = getAuctionById(id);
  if (!auction) return;
  
  var html = `
    <div id="auctionModal" class="modal" style="display:flex">
      <div class="modal-content" style="width:500px">
        <span class="close" onclick="closeAuctionModal()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px">Edit Auction</h2>
        <input type="text" id="auctName" placeholder="Item Name" value="${auction.name || ''}" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <textarea id="auctDesc" placeholder="Description" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px;height:60px">${auction.desc || ''}</textarea>
        <input type="number" id="auctStartPrice" placeholder="Starting Price" value="${auction.startingPrice || 0}" step="0.01" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <select id="auctCategory" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
          <option value="">Select Category</option>
          <option value="electronics" ${auction.category === 'electronics' ? 'selected' : ''}>Electronics</option>
          <option value="homeware" ${auction.category === 'homeware' ? 'selected' : ''}>Homeware</option>
          <option value="collectibles" ${auction.category === 'collectibles' ? 'selected' : ''}>Collectibles</option>
        </select>
        <input type="text" id="auctImages" placeholder="Image URLs (comma-separated)" value="${(auction.images || []).join(', ')}" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <div style="display:flex;gap:10px">
          <button onclick="saveAuctionEdit('${id}')" style="flex:1;padding:12px;background:#3498db;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold">Save</button>
          <button onclick="deleteAuctionConfirm('${id}')" style="flex:1;padding:12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer">Delete</button>
          <button onclick="closeAuctionModal()" style="flex:1;padding:12px;background:#ddd;color:#333;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  var existing = document.getElementById('auctionModal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', html);
}

function saveAuctionEdit(id) {
  var name = document.getElementById('auctName').value.trim();
  var desc = document.getElementById('auctDesc').value.trim();
  var startPrice = parseFloat(document.getElementById('auctStartPrice').value);
  var category = document.getElementById('auctCategory').value;
  var imageUrls = document.getElementById('auctImages').value.trim().split(',').map(u => u.trim()).filter(u => u);
  
  if (!name || !category) {
    showToast('Name and category required', 'error');
    return;
  }
  
  updateAuctionById(id, {
    name: name,
    desc: desc,
    startingPrice: startPrice,
    category: category,
    images: imageUrls
  });
  
  showToast('Auction saved', 'success');
  closeAuctionModal();
  renderAuctions();
}

function deleteAuctionConfirm(id) {
  if (confirm('Delete this auction? All bids will be lost.')) {
    deleteAuctionById(id);
    showToast('Auction deleted', 'success');
    closeAuctionModal();
    renderAuctions();
  }
}

// ============ LOCATION MANAGEMENT ============

function openAddLocationModal() {
  var html = `
    <div id="locationModal" class="modal" style="display:flex">
      <div class="modal-content" style="width:500px">
        <span class="close" onclick="closeLocationModal()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px">Add Pickup Location</h2>
        <input type="text" id="locName" placeholder="Location Name" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <input type="text" id="locAddress" placeholder="Address" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <input type="text" id="locMapLink" placeholder="Google Maps Link" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <div style="margin:10px 0">
          <label style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="locActive" checked>
            <span>Active This Week</span>
          </label>
        </div>
        <input type="text" id="locDays" placeholder="Days (e.g. Mon-Fri)" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <div style="display:flex;gap:10px">
          <button onclick="addLocation()" style="flex:1;padding:12px;background:#f39c12;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold">Add Location</button>
          <button onclick="closeLocationModal()" style="flex:1;padding:12px;background:#ddd;color:#333;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  var existing = document.getElementById('locationModal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('locName').focus();
}

function closeLocationModal() {
  var modal = document.getElementById('locationModal');
  if (modal) modal.remove();
}

function addLocation() {
  var name = document.getElementById('locName').value.trim();
  var address = document.getElementById('locAddress').value.trim();
  var mapLink = document.getElementById('locMapLink').value.trim();
  var active = document.getElementById('locActive').checked;
  var days = document.getElementById('locDays').value.trim();
  
  if (!name || !address) {
    showToast('Name and address required', 'error');
    return;
  }
  
  var locations = DB.load('locations') || [];
  var id = 'loc_' + Date.now();
  
  locations.push({
    id: id,
    name: name,
    address: address,
    mapLink: mapLink || '#',
    active: active,
    days: days,
    createdAt: new Date().toISOString()
  });
  
  DB.save('locations', locations);
  
  showToast('Location added', 'success');
  closeLocationModal();
  renderLocations();
}

function editLocation(id) {
  var locations = DB.load('locations') || [];
  var location = locations.find(l => l.id === id);
  
  if (!location) return;
  
  var html = `
    <div id="locationModal" class="modal" style="display:flex">
      <div class="modal-content" style="width:500px">
        <span class="close" onclick="closeLocationModal()" style="position:absolute;top:10px;right:15px;font-size:24px;cursor:pointer">&times;</span>
        <h2 style="color:#e94560;margin-bottom:20px">Edit Location</h2>
        <input type="text" id="locName" placeholder="Location Name" value="${location.name || ''}" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <input type="text" id="locAddress" placeholder="Address" value="${location.address || ''}" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <input type="text" id="locMapLink" placeholder="Google Maps Link" value="${location.mapLink || ''}" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <div style="margin:10px 0">
          <label style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="locActive" ${location.active ? 'checked' : ''}>
            <span>Active This Week</span>
          </label>
        </div>
        <input type="text" id="locDays" placeholder="Days (e.g. Mon-Fri)" value="${location.days || ''}" style="width:100%;padding:10px;margin:8px 0;border:1px solid #ddd;border-radius:5px">
        <div style="display:flex;gap:10px">
          <button onclick="saveLocationEdit('${id}')" style="flex:1;padding:12px;background:#f39c12;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:bold">Save</button>
          <button onclick="deleteLocationConfirm('${id}')" style="flex:1;padding:12px;background:#e94560;color:#fff;border:none;border-radius:5px;cursor:pointer">Delete</button>
          <button onclick="closeLocationModal()" style="flex:1;padding:12px;background:#ddd;color:#333;border:none;border-radius:5px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  var existing = document.getElementById('locationModal');
  if (existing) existing.remove();
  
  document.body.insertAdjacentHTML('beforeend', html);
}

function saveLocationEdit(id) {
  var name = document.getElementById('locName').value.trim();
  var address = document.getElementById('locAddress').value.trim();
  var mapLink = document.getElementById('locMapLink').value.trim();
  var active = document.getElementById('locActive').checked;
  var days = document.getElementById('locDays').value.trim();
  
  if (!name || !address) {
    showToast('Name and address required', 'error');
    return;
  }
  
  var locations = DB.load('locations') || [];
  var idx = locations.findIndex(l => l.id === id);
  
  if (idx !== -1) {
    locations[idx] = {
      ...locations[idx],
      name: name,
      address: address,
      mapLink: mapLink || '#',
      active: active,
      days: days
    };
    DB.save('locations', locations);
  }
  
  showToast('Location saved', 'success');
  closeLocationModal();
  renderLocations();
}

function deleteLocationConfirm(id) {
  if (confirm('Delete this location?')) {
    var locations = DB.load('locations') || [];
    locations = locations.filter(l => l.id !== id);
    DB.save('locations', locations);
    showToast('Location deleted', 'success');
    closeLocationModal();
    renderLocations();
  }
}

// Helper to show admin controls on cards
function getAdminButtonsHtml(id, type) {
  if (!isAdminMode) return '';
  
  if (type === 'product') {
    return `
      <div style="display:flex;gap:5px;margin-top:8px">
        <button onclick="editProduct('${id}')" style="flex:1;padding:6px;background:#3498db;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Edit</button>
        <button onclick="if(confirm('Delete?')) { deleteProductById('${id}'); renderProducts(); }" style="flex:1;padding:6px;background:#e94560;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Delete</button>
      </div>
    `;
  } else if (type === 'auction') {
    return `
      <div style="display:flex;gap:5px;margin-top:8px">
        <button onclick="editAuction('${id}')" style="flex:1;padding:6px;background:#3498db;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Edit</button>
        <button onclick="if(confirm('Delete?')) { deleteAuctionById('${id}'); renderAuctions(); }" style="flex:1;padding:6px;background:#e94560;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Delete</button>
      </div>
    `;
  } else if (type === 'location') {
    return `
      <div style="display:flex;gap:5px;margin-top:8px">
        <button onclick="editLocation('${id}')" style="flex:1;padding:6px;background:#f39c12;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Edit</button>
        <button onclick="if(confirm('Delete?')) { deleteLocationConfirm('${id}'); }" style="flex:1;padding:6px;background:#e94560;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">Delete</button>
      </div>
    `;
  }
  return '';
}
