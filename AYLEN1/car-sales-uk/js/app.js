// AYLEN SALE - Main App
var cart = JSON.parse(localStorage.getItem('aylencart') || '[]');
var savedItems = JSON.parse(localStorage.getItem('aylensaved') || '[]');
var currentUser = JSON.parse(localStorage.getItem('aylenuser') || 'null');
var priceMode = 'retail';
var selectedProductImage = {};

document.addEventListener("DOMContentLoaded", async function() {
  await loadAllData();
  renderLocations();
  renderAuctions();
  showPrices('retail');
  updateCartCount();
  fillPickup();
  if (currentUser) showWelcome(currentUser);
});

function loginCard() {
  var num = document.getElementById('cardNumber').value.trim().toUpperCase();
  if (cardHolders[num]) {
    currentUser = {card: num, name: cardHolders[num].name, discount: cardHolders[num].discount};
    localStorage.setItem('aylenuser', JSON.stringify(currentUser));
    showWelcome(currentUser);
    renderProducts();
    notify('Welcome ' + currentUser.name + '! Discount: ' + currentUser.discount + '%', 'success');
  } else {
    notify('Card not found!', 'error');
  }
}

function showWelcome(u) {
  var old = document.querySelector('.welcome-banner');
  if (old) old.remove();
  var d = document.createElement('div');
  d.className = 'welcome-banner';
  d.innerHTML = 'Welcome, <b>' + u.name + '</b>! Discount: <span class="discount">' + u.discount + '% OFF</span> <button onclick="logout()" style="background:none;border:1px solid #fff;color:#fff;padding:3px 10px;border-radius:3px;cursor:pointer;margin-left:10px">Logout</button>';
  document.querySelector('header').after(d);
}

function logout() {
  currentUser = null;
  localStorage.removeItem('aylenuser');
  var b = document.querySelector('.welcome-banner');
  if (b) b.remove();
  renderProducts();
  notify('Logged out', 'success');
}

function renderLocations() {
  var row = document.getElementById('locationsRow');
  if (!row) return;
  row.innerHTML = '';
  for (var i = 0; i < locations.length; i++) {
    var loc = locations[i];
    var c = document.createElement('div');
    c.className = 'location-card' + (loc.active ? ' active' : '');
    var h = '<div class="loc-name">' + (loc.active ? '<i class="fas fa-check-circle" style="color:#00cc66"></i> ' : '<i class="fas fa-map-pin" style="color:#ccc"></i> ') + loc.name + '</div>';
    h += '<div class="loc-address"><i class="fas fa-location-dot"></i> ' + loc.address + '</div>';
    h += '<div class="loc-day"><i class="fas fa-calendar"></i> ' + loc.day.charAt(0).toUpperCase() + loc.day.slice(1) + ' | ' + loc.time + '</div>';
    h += '<div class="loc-status ' + (loc.active ? 'here' : 'not') + '">' + (loc.active ? '<i class="fas fa-star"></i> We are here this week!' : '<i class="fas fa-minus-circle"></i> Not this week') + '</div>';
    h += '<a class="map-link" href="https://www.google.com/maps?q=' + loc.lat + ',' + loc.lng + '" target="_blank"><i class="fas fa-map"></i> View on Map</a>';
    c.innerHTML = h;
    row.appendChild(c);
  }
}

function renderProducts() {
  var grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var activeIndex = (selectedProductImage[p.id] !== undefined ? selectedProductImage[p.id] : 0);
    if (!p.images) p.images = [];
    if (activeIndex < 0 || activeIndex >= p.images.length) activeIndex = 0;
    var card = document.createElement('div');
    card.className = 'product-card';
    var img = (p.images && p.images.length > 0) ? p.images[activeIndex] : (p.imageUrl || 'https://via.placeholder.com/300x200/1a1a2e/e94560?text=AYLEN');
    var desc = p.description || p.desc || '';
    var isSaved = savedItems.indexOf(p.id) !== -1;
    var h = '<div class="product-image-container">';
    h += '<img src="' + img + '" alt="' + p.name + '">';
    h += '<div class="product-badge' + (isSaved ? ' saved' : '') + '" onclick="toggleSaveProduct(' + p.id + ')" title="Save">' + (isSaved ? '★' : '☆') + '</div>';
    if (p.images && p.images.length > 1) {
      h += '<button class="product-arrow left" onclick="prevImage(' + p.id + ')"><i class="fas fa-chevron-left"></i></button>';
      h += '<button class="product-arrow right" onclick="nextImage(' + p.id + ')"><i class="fas fa-chevron-right"></i></button>';
    }
    h += '</div>';
    h += '<div class="product-info"><h3>' + p.name + '</h3>';
    h += '<p class="desc">' + desc + '</p>';
    
    // Price logic
    var retailPrice = parseFloat(p.price || p.retail || 0);
    var wholesalePrice = parseFloat(p.wholesale || 0);
    var displayPrice = (priceMode === 'wholesale') ? wholesalePrice : retailPrice;
    
    if (currentUser && currentUser.discount > 0) {
      var dp = (displayPrice * (1 - currentUser.discount / 100)).toFixed(2);
      h += '<div class="product-prices"><span class="price-original">£' + displayPrice.toFixed(2) + '</span> <span class="price-discount">£' + dp + '</span></div>';
    } else {
      h += '<div class="product-prices">';
      if (priceMode === 'wholesale' && wholesalePrice > 0) {
        h += '<span class="price-main">£' + wholesalePrice.toFixed(2) + '</span>';
        if (retailPrice > 0) h += '<span class="price-secondary">Retail: £' + retailPrice.toFixed(2) + '</span>';
      } else {
        h += '<span class="price-main">£' + retailPrice.toFixed(2) + '</span>';
        if (wholesalePrice > 0 && priceMode === 'retail') h += '<span class="price-secondary">Wholesale: £' + wholesalePrice.toFixed(2) + '</span>';
      }
      h += '</div>';
    }
    
    h += '<div class="stock-info">Stock: ' + (parseInt(p.stock) || 0) + '</div>';
    
    // Action buttons
    h += '<div class="action-buttons">';
    if (parseInt(p.stock) === 0) {
      h += '<div class="out-of-stock">Out of stock</div>';
    } else {
      h += '<button class="btn-action primary" onclick="addToCart(' + p.id + ')"><i class="fas fa-cart-plus"></i> Add to Cart</button>';
    }
    h += '</div>';
    
    // Notify buttons (only if out of stock)
    if (parseInt(p.stock) === 0) {
      h += '<p style="font-size:12px;color:#666;margin:8px 0 6px;line-height:1.4">Want to know when it\'s back in stock? Choose how we should notify you:</p>';
      h += '<div class="notify-line">';
      h += '<button class="notify-btn" onclick="requestNotify(' + p.id + ', \'email\')">Email</button>';
      h += '<button class="notify-btn" onclick="requestNotify(' + p.id + ', \'telegram\')">Telegram</button>';
      h += '<button class="notify-btn" onclick="requestNotify(' + p.id + ', \'whatsapp\')">WhatsApp</button>';
      h += '</div>';
    }
    
    if (p.images && p.images.length > 1) {
      h += '<div class="product-thumbnails">';
      var maxThumbs = 4;
      var visibleThumbs = Math.min(p.images.length, maxThumbs);
      for (var j = 0; j < visibleThumbs; j++) {
        var activeClass = (j === activeIndex) ? ' active' : '';
        h += '<img src="' + p.images[j] + '" class="product-thumb' + activeClass + '" onclick="selectProductImage(' + p.id + ',' + j + ')" alt="Photo ' + (j + 1) + '">';
      }
      if (p.images.length > maxThumbs) {
        var moreCount = p.images.length - maxThumbs;
        h += '<div class="product-thumb more" onclick="selectProductImage(' + p.id + ',' + maxThumbs + ')">+' + moreCount + '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
    card.innerHTML = h;
    grid.appendChild(card);
  }
}

function selectProductImage(productId, index) {
  selectedProductImage[productId] = index;
  renderProducts();
}

function prevImage(productId) {
  var p = products.find(function(item) { return item.id === productId; });
  if (!p || !p.images || p.images.length <= 1) return;
  var current = selectedProductImage[productId] || 0;
  var newIndex = current > 0 ? current - 1 : p.images.length - 1;
  selectedProductImage[productId] = newIndex;
  renderProducts();
}

function nextImage(productId) {
  var p = products.find(function(item) { return item.id === productId; });
  if (!p || !p.images || p.images.length <= 1) return;
  var current = selectedProductImage[productId] || 0;
  var newIndex = current < p.images.length - 1 ? current + 1 : 0;
  selectedProductImage[productId] = newIndex;
  renderProducts();
}

function toggleSaveProduct(productId) {
  var idx = savedItems.indexOf(productId);
  if (idx === -1) {
    savedItems.push(productId);
    notify('Product saved!', 'success');
  } else {
    savedItems.splice(idx, 1);
    notify('Product removed from saved', 'success');
  }
  localStorage.setItem('aylensaved', JSON.stringify(savedItems));
  renderProducts();
}

function showPrices(mode, btn) {
  priceMode = mode;
  var buttons = document.querySelectorAll('.tbtn');
  buttons.forEach(function(b) {
    b.classList.toggle('active', b === btn);
  });
  renderProducts();
}

function requestNotify(productId, method) {
  var p = products.find(function(item) { return item.id === productId; });
  if (!p) return;
  var promptLabel = 'Enter your ' + (method === 'email' ? 'email address' : 'contact phone/username') + ' for "' + p.name + '"';
  var contact = prompt(promptLabel + ':');
  if (!contact) return;
  if (method === 'email' && contact.indexOf('@') === -1) {
    notify('Please enter a valid email', 'error');
    return;
  }
  addNotifyRequest(productId, method, contact);
  notify('Notify request saved (' + method + ')', 'success');
}

function fillPickup() {
  var sel = document.getElementById('custPickup');
  if (!sel) return;
  for (var i = 0; i < locations.length; i++) {
    if (locations[i].active) {
      var opt = document.createElement('option');
      opt.value = locations[i].name + ' - ' + locations[i].address;
      opt.textContent = '✅ ' + locations[i].name + ' (' + locations[i].day + ')';
      sel.appendChild(opt);
    }
  }
  var od = document.createElement('option');
  od.value = 'Delivery';
  od.textContent = '🚚 Delivery';
  sel.appendChild(od);
}

function addToCart(id) {
  var p = null;
  for (var i = 0; i < products.length; i++) {
    if (products[i].id === id) { p = products[i]; break; }
  }
  if (!p) return;
  var price = p.price || p.retail || 0;
  if (currentUser && currentUser.discount > 0) price = price * (1 - currentUser.discount / 100);
  price = parseFloat(price.toFixed(2));
  var item = null;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === id) { item = cart[i]; break; }
  }
  if (item) { item.qty++; } else { cart.push({id: p.id, name: p.name, price: price, qty: 1}); }
  localStorage.setItem('aylencart', JSON.stringify(cart));
  updateCartCount();
  notify(p.name + ' added!', 'success');
}

function removeFromCart(id) {
  cart = cart.filter(function(item) { return item.id !== id; });
  localStorage.setItem('aylencart', JSON.stringify(cart));
  updateCartCount();
  renderCart();
}

function changeQty(id, d) {
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === id) {
      cart[i].qty += d;
      if (cart[i].qty <= 0) { removeFromCart(id); return; }
      break;
    }
  }
  localStorage.setItem('aylencart', JSON.stringify(cart));
  updateCartCount();
  renderCart();
}

function updateCartCount() {
  var c = 0;
  for (var i = 0; i < cart.length; i++) c += cart[i].qty;
  var el = document.getElementById('cartCount');
  if (el) el.textContent = c;
}

function getTotal() {
  var t = 0;
  for (var i = 0; i < cart.length; i++) t += cart[i].price * cart[i].qty;
  return t.toFixed(2);
}

function renderCart() {
  var div = document.getElementById('cartItems');
  if (!div) return;
  if (cart.length === 0) {
    div.innerHTML = '<p style="text-align:center;color:#999;padding:30px">Cart is empty</p>';
    document.getElementById('cartTotal').textContent = '£0.00';
    return;
  }
  var h = '';
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    h += '<div class="cart-item"><div class="cart-item-info"><h4>' + item.name + '</h4><span class="cart-item-price">£' + item.price.toFixed(2) + '</span></div><div class="cart-item-qty"><button onclick="changeQty(' + item.id + ',-1)">-</button><span>' + item.qty + '</span><button onclick="changeQty(' + item.id + ',1)">+</button></div></div>';
  }
  div.innerHTML = h;
  document.getElementById('cartTotal').textContent = '£' + getTotal();
}

function openCart() { renderCart(); document.getElementById('cartModal').classList.add('open'); }
function closeCart() { document.getElementById('cartModal').classList.remove('open'); }
function openCheckout() { closeCart(); document.getElementById('checkoutModal').classList.add('open'); }
function closeCheckout() { document.getElementById('checkoutModal').classList.remove('open'); }

function sendOrder(e) {
  e.preventDefault();
  if (cart.length === 0) { notify('Cart is empty!', 'error'); return; }
  var name = document.getElementById('custName').value;
  var phone = document.getElementById('custPhone').value;
  var pickup = document.getElementById('custPickup').value;
  var comment = document.getElementById('custComment').value;
  var text = 'NEW ORDER - AYLENSALE\n\nCustomer: ' + name + '\nPhone: ' + phone + '\nPickup: ' + (pickup || 'Not selected') + '\n';
  if (comment) text += 'Comment: ' + comment + '\n';
  if (currentUser) text += 'Card: ' + currentUser.card + ' (' + currentUser.name + ') -' + currentUser.discount + '%\n';
  text += '\nItems:\n';
  for (var i = 0; i < cart.length; i++) {
    text += '- ' + cart[i].name + ' x' + cart[i].qty + ' = £' + (cart[i].price * cart[i].qty).toFixed(2) + '\n';
  }
  text += '\nTOTAL: £' + getTotal();
  var url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
  var xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function() {
    var data = JSON.parse(xhr.responseText);
    if (data.ok) {
      notify('Order sent successfully!', 'success');
      cart = [];
      localStorage.setItem('aylencart', JSON.stringify(cart));
      updateCartCount();
      closeCheckout();
      document.getElementById('orderForm').reset();
    } else {
      notify('Error: ' + data.description, 'error');
    }
  };
  xhr.onerror = function() { notify('Network error', 'error'); };
  xhr.send(JSON.stringify({chat_id: TELEGRAM_CHAT_ID, text: text}));
}

function notify(msg, type) {
  var el = document.getElementById('notification');
  if (!el) return;
  el.textContent = msg;
  el.className = 'notification ' + type;
  setTimeout(function() { el.className = 'notification'; }, 3000);
}

// ===== AUCTIONS FUNCTIONS =====
function renderAuctions() {
  var grid = document.getElementById('auctionsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  for (var i = 0; i < auctions.length; i++) {
    var a = auctions[i];
    var card = document.createElement('div');
    card.className = 'auction-card';
    card.id = 'auction-' + a.id;
    
    var endTime = new Date(a.endTime);
    var now = new Date();
    var timeLeft = endTime - now;
    var isEnding = timeLeft < 3600000; // Less than 1 hour
    var isEnded = timeLeft <= 0;
    
    var h = '<div class="auction-header">';
    h += '<span><i class="fas fa-fire"></i> LIVE AUCTION</span>';
    h += '<span class="auction-badge">' + (a.bidsCount || 0) + ' bid' + (a.bidsCount !== 1 ? 's' : '') + '</span>';
    h += '</div>';
    
    h += '<div class="auction-image">';
    var img = (a.images && a.images.length > 0) ? a.images[0] : 'https://via.placeholder.com/300x200/1a1a2e/e94560?text=Auction';
    h += '<img src="' + img + '" alt="' + a.name + '">';
    h += '<div class="auction-status">' + (isEnded ? 'ENDED' : 'ACTIVE') + '</div>';
    h += '</div>';
    
    h += '<div class="auction-info">';
    h += '<div class="auction-title">' + a.name + '</div>';
    h += '<div class="auction-desc">' + (a.desc || '') + '</div>';
    
    h += '<div class="auction-price-section">';
    h += '<div class="auction-price-label">Current Price</div>';
    h += '<div class="auction-current-price">£' + a.currentPrice.toFixed(2) + '</div>';
    h += '<div class="auction-bids">Starting from: £' + a.startingPrice.toFixed(2) + '</div>';
    h += '</div>';
    
    // Timer
    if (!isEnded) {
      h += '<div class="auction-timer ' + (isEnding ? 'ending' : '') + '">';
      h += '<div class="timer-label"><i class="fas fa-hourglass-end"></i> Auction ends in</div>';
      h += '<div class="timer-display" id="timer-' + a.id + '">' + formatTimeLeft(timeLeft) + '</div>';
      h += '</div>';
    } else {
      h += '<div class="auction-timer ending">';
      h += '<div class="timer-label"><i class="fas fa-check-circle"></i> Auction Ended</div>';
      h += '</div>';
    }
    
    // Bid section
    if (!isEnded) {
      h += '<div class="bid-input-section">';
      h += '<input type="number" id="bid-amount-' + a.id + '" placeholder="Enter bid amount" min="' + (a.currentPrice + 1).toFixed(2) + '" step="0.01">';
      h += '<button onclick="submitBid(' + a.id + ')"><i class="fas fa-gavel"></i> Bid</button>';
      h += '</div>';
    }
    
    // Bid history
    var bids = auctionBids[a.id] || [];
    if (bids.length > 0) {
      h += '<div class="bid-history">';
      h += '<strong>Latest Bid:</strong> £' + bids[bids.length - 1].amount.toFixed(2) + ' by ' + bids[bids.length - 1].bidder;
      h += '</div>';
    }
    
    h += '</div>';
    card.innerHTML = h;
    grid.appendChild(card);
  }
  
  // Start timers
  startAuctionTimers();
}

function formatTimeLeft(ms) {
  if (ms <= 0) return '00:00:00';
  var hours = Math.floor(ms / 3600000);
  var mins = Math.floor((ms % 3600000) / 60000);
  var secs = Math.floor((ms % 60000) / 1000);
  return (hours < 10 ? '0' : '') + hours + ':' + (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
}

function startAuctionTimers() {
  // Clear any existing interval
  if (window.auctionTimerInterval) clearInterval(window.auctionTimerInterval);
  
  window.auctionTimerInterval = setInterval(function() {
    var now = new Date();
    for (var i = 0; i < auctions.length; i++) {
      var a = auctions[i];
      var el = document.getElementById('timer-' + a.id);
      if (!el) continue;
      
      var endTime = new Date(a.endTime);
      var timeLeft = endTime - now;
      
      if (timeLeft <= 0) {
        el.textContent = '00:00:00';
        // Re-render to show ended status
        var card = document.getElementById('auction-' + a.id);
        if (card) renderAuctions();
      } else {
        el.textContent = formatTimeLeft(timeLeft);
      }
    }
  }, 1000);
}

function submitBid(auctionId) {
  var a = auctions.find(function(item) { return item.id === auctionId; });
  if (!a) { notify('Auction not found!', 'error'); return; }
  
  var inputEl = document.getElementById('bid-amount-' + auctionId);
  var bidAmount = parseFloat(inputEl.value);
  
  if (!bidAmount || isNaN(bidAmount)) {
    notify('Please enter a valid bid amount', 'error');
    return;
  }
  
  if (bidAmount <= a.currentPrice) {
    notify('Bid must be higher than current price (£' + a.currentPrice.toFixed(2) + ')', 'error');
    return;
  }
  
  // Generate bidder name from current user or create a default one
  var bidderName = 'Bidder_' + Math.floor(Math.random() * 10000);
  if (currentUser && currentUser.name) {
    bidderName = currentUser.name;
  }
  
  if (placeBid(auctionId, bidAmount, bidderName)) {
    notify('✓ Bid placed! £' + bidAmount.toFixed(2) + ' by ' + bidderName, 'success');
    renderAuctions();
    inputEl.value = '';
  } else {
    notify('Error placing bid', 'error');
  }
}
