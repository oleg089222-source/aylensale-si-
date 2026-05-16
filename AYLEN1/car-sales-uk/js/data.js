/**
 * UNIFIED DATA SYSTEM FOR AYLENSALE
 * Single source of truth for all data
 */

var DATA_VERSION = '1.0';
var SYSTEM_INITIALIZED_KEY = 'aylen_system_initialized_v1';

// Global data variables
var products = [];
var auctions = [];
var locations = [];
var cardHolders = {};
var auctionBids = {};
var notifyRequests = [];

// Fallback image
var FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" font-size="16" fill="%23999" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';

// Default data (ONLY DEFINED HERE)
var DEFAULT_PRODUCTS = [
  {id: 1, name: 'iPhone 15 Pro', desc: 'Latest Apple flagship', category: 'electronics', price: 999, retail: 999, wholesale: 799, stock: 5, images: [], createdAt: new Date().toISOString(), badge: 'NEW', active: true, discount: 0, salePrice: 999, sku: 'AYLE-PHONE-001'},
  {id: 2, name: 'Samsung 4K TV', desc: 'Smart 55" 4K television', category: 'electronics', price: 599, retail: 599, wholesale: 450, stock: 3, images: [], createdAt: new Date().toISOString(), badge: 'SALE', active: true, discount: 15, salePrice: 509, sku: 'AYLE-TV-002'},
  {id: 3, name: 'MacBook Pro', desc: 'M4 Pro powerful laptop', category: 'electronics', price: 1999, retail: 1999, wholesale: 1599, stock: 2, images: [], createdAt: new Date().toISOString(), badge: 'HOT', active: true, discount: 0, salePrice: 1999, sku: 'AYLE-LAPTOP-003'}
];

var DEFAULT_LOCATIONS = [
  {id: 1, name: 'Battersea Car Boot', address: 'Battersea Park, London SW11 4NJ', day: 'sunday', time: '8:00-14:00', lat: 51.4801, lng: -0.1567, active: true},
  {id: 2, name: 'Wimbledon Car Boot', address: 'Wimbledon Stadium, London SW17 0BA', day: 'saturday', time: '7:00-13:00', lat: 51.4234, lng: -0.1876, active: false},
  {id: 3, name: 'Holloway Car Boot', address: 'Holloway Road, London N7 6PA', day: 'saturday', time: '8:00-15:00', lat: 51.5567, lng: -0.1167, active: true},
  {id: 4, name: 'Kilburn Car Boot', address: 'Kilburn Square, London NW6 6JA', day: 'sunday', time: '7:00-14:00', lat: 51.5367, lng: -0.1967, active: false},
  {id: 5, name: 'Epsom Car Boot', address: 'Hook Road Arena, Epsom KT19 8QG', day: 'saturday', time: '6:30-12:00', lat: 51.3367, lng: -0.2667, active: false}
];

var DEFAULT_CARDS = {'AYLE001': {name: 'John Doe', discount: 10}, 'AYLE002': {name: 'Jane Smith', discount: 15}, 'AYLE003': {name: 'Test Card', discount: 20}};

var DEFAULT_AUCTIONS = [
  {id: 101, name: 'Vintage Rolex Watch', desc: 'Authentic vintage Rolex', category: 'watches', startingPrice: 500, currentPrice: 1250, endTime: new Date(Date.now() + 72*3600000).toISOString(), images: [], bidsCount: 0},
  {id: 102, name: 'Vintage Camera', desc: 'Classic film camera', category: 'electronics', startingPrice: 50, currentPrice: 185, endTime: new Date(Date.now() + 48*3600000).toISOString(), images: [], bidsCount: 0},
  {id: 103, name: 'Antique Lamp', desc: 'Art deco floor lamp', category: 'furniture', startingPrice: 30, currentPrice: 275, endTime: new Date(Date.now() + 24*3600000).toISOString(), images: [], bidsCount: 0}
];

// Database utility
var DB = {
  save: function(key, data) {
    try { 
      // Always save to localStorage for offline support
      localStorage.setItem('aylen_' + key, JSON.stringify(data));
      
      // Also save to Firebase Firestore if available
      if (window.FBDB && ['products', 'auctions', 'locations'].includes(key)) {
        // Save each item individually to Firestore
        if (Array.isArray(data)) {
          data.forEach(function(item) {
            if (item.id) {
              if (key === 'products') {
                window.FBDB.saveProduct(item);
              } else if (key === 'auctions') {
                window.FBDB.saveAuction(item);
              } else if (key === 'locations') {
                window.FBDB.saveLocation(item);
              }
            }
          });
        }
      }
      
      return true;
    }
    catch (e) { console.error('Failed to save ' + key, e); return false; }
  },
  load: function(key) {
    try { var data = localStorage.getItem('aylen_' + key); return data ? JSON.parse(data) : null; }
    catch (e) { console.error('Failed to load ' + key, e); return null; }
  },
  clear: function(key) {
    try { localStorage.removeItem('aylen_' + key); return true; }
    catch (e) { console.error('Failed to clear ' + key, e); return false; }
  }
};

// Initialize system (only on first load)
function initializeSystemIfNeeded() {
  if (localStorage.getItem(SYSTEM_INITIALIZED_KEY)) return true;
  if (!DB.load('products')) DB.save('products', DEFAULT_PRODUCTS);
  if (!DB.load('auctions')) DB.save('auctions', DEFAULT_AUCTIONS);
  if (!DB.load('locations')) DB.save('locations', DEFAULT_LOCATIONS);
  if (!DB.load('cardHolders')) DB.save('cardHolders', DEFAULT_CARDS);
  if (!DB.load('auctionBids')) DB.save('auctionBids', {});
  if (!DB.load('notifyRequests')) DB.save('notifyRequests', []);
  localStorage.setItem(SYSTEM_INITIALIZED_KEY, 'true');
  return true;
}

// Load data into memory
async function loadAllData() {
  try {
    // Priority 1: Try to load from Firebase Firestore first (primary storage)
    if (window.FBDB) {
      try {
        console.log('Loading data from Firebase Firestore...');
        var fbProducts = await window.FBDB.loadProducts();
        var fbAuctions = await window.FBDB.loadAuctions();
        var fbLocations = await window.FBDB.loadLocations();
        
        if (fbProducts && fbProducts.length > 0) {
          products = fbProducts;
          console.log('✓ Loaded', products.length, 'products from Firestore');
        }
        if (fbAuctions && fbAuctions.length > 0) {
          auctions = fbAuctions;
          console.log('✓ Loaded', auctions.length, 'auctions from Firestore');
        }
        if (fbLocations && fbLocations.length > 0) {
          locations = fbLocations;
          console.log('✓ Loaded', locations.length, 'locations from Firestore');
        }
      } catch (error) {
        console.warn('Firebase Firestore load failed, trying localStorage:', error.message);
      }
    }
    
    // Priority 2: Fallback to localStorage if Firestore data is empty
    if (!products || products.length === 0) {
      var cached = DB.load('products');
      products = cached || DEFAULT_PRODUCTS;
    }
    if (!auctions || auctions.length === 0) {
      var cached = DB.load('auctions');
      auctions = cached || DEFAULT_AUCTIONS;
    }
    if (!locations || locations.length === 0) {
      var cached = DB.load('locations');
      locations = cached || DEFAULT_LOCATIONS;
    }

    // Load other data from localStorage
    cardHolders = DB.load('cardHolders') || DEFAULT_CARDS;
    auctionBids = DB.load('auctionBids') || {};
    notifyRequests = DB.load('notifyRequests') || [];

    console.log('✓ Loaded', products.length, 'products,', auctions.length, 'auctions,', locations.length, 'locations');
    return true;
  } catch (e) { 
    console.error('Error loading data', e); 
    // Final fallback
    products = DEFAULT_PRODUCTS;
    auctions = DEFAULT_AUCTIONS;
    locations = DEFAULT_LOCATIONS;
    cardHolders = DEFAULT_CARDS;
    return false; 
  }
}

// Product functions
function addProductWithPhotos(name, desc, price, category, imageUrls, stock, wholesale) {
  var newId = 1;
  products.forEach(function(p) { if (p.id >= newId) newId = p.id + 1; });
  var product = {
    id: newId, 
    name: name, 
    desc: desc, 
    category: category, 
    price: price, 
    retail: price, 
    wholesale: wholesale || price, 
    stock: stock || 0, 
    images: imageUrls || [], 
    createdAt: new Date().toISOString(),
    badge: '',  // New field
    active: true,  // New field
    discount: 0,  // New field
    salePrice: price,  // New field
    sku: 'AYLE-' + String(newId).padStart(5, '0')  // New field - auto-generated
  };
  products.push(product);
  
  // Save to localStorage for instant feedback
  DB.save('products', products);
  
  // Save to Firestore for persistence
  if (window.FBDB) {
    window.FBDB.saveProduct(product).catch(function(e) {
      console.error('Error saving product to Firestore:', e);
      notify('Product saved locally, but server sync failed. Check your Firebase config.', 'error');
    });
  }
  
  return product;
}

function deleteProductById(id) {
  products = products.filter(function(p) { return p.id !== id; });
  DB.save('products', products);
  
  // Delete from Firestore
  if (window.FBDB) {
    window.FBDB.deleteProduct(id).catch(function(e) {
      console.error('Error deleting product from Firestore:', e);
    });
  }
}

function updateProductById(id, updates) {
  var product = products.find(function(p) { return p.id === Number(id); });
  if (product) { 
    Object.assign(product, updates);
    DB.save('products', products);
    
    // Update in Firestore
    if (window.FBDB) {
      window.FBDB.saveProduct(product).catch(function(e) {
        console.error('Error updating product in Firestore:', e);
      });
    }
    
    return product; 
  }
  return null;
}

// Auction functions
function addAuctionWithPhotos(name, desc, startingPrice, category, imageUrls, durationHours) {
  var newId = 101;
  auctions.forEach(function(a) { if (a.id >= newId) newId = a.id + 1; });
  var endTime = new Date(Date.now() + (durationHours || 24) * 3600000);
  var auction = {id: newId, name: name, desc: desc, category: category, startingPrice: startingPrice, currentPrice: startingPrice, endTime: endTime.toISOString(), images: imageUrls || [], bidsCount: 0, createdAt: new Date().toISOString()};
  auctions.push(auction);
  DB.save('auctions', auctions);
  
  // Save to Firestore
  if (window.FBDB) {
    window.FBDB.saveAuction(auction).catch(function(e) {
      console.error('Error saving auction to Firestore:', e);
    });
  }
  
  return auction;
}

function deleteAuctionById(id) {
  auctions = auctions.filter(function(a) { return a.id !== id; });
  if (auctionBids[id]) delete auctionBids[id];
  DB.save('auctions', auctions);
  DB.save('auctionBids', auctionBids);
  
  // Delete from Firestore
  if (window.FBDB) {
    window.FBDB.deleteAuction(id).catch(function(e) {
      console.error('Error deleting auction from Firestore:', e);
    });
  }
}

function updateAuctionById(id, updates) {
  var auction = auctions.find(function(a) { return a.id === Number(id); });
  if (auction) { 
    Object.assign(auction, updates);
    DB.save('auctions', auctions);
    
    // Update in Firestore
    if (window.FBDB) {
      window.FBDB.saveAuction(auction).catch(function(e) {
        console.error('Error updating auction in Firestore:', e);
      });
    }
    
    return auction; 
  }
  return null;
}

// Location functions
function addLocation(name, address, day, time, lat, lng, active) {
  var newId = 1;
  locations.forEach(function(l) { if (l.id >= newId) newId = l.id + 1; });
  var location = {id: newId, name: name, address: address, day: day, time: time, lat: lat || 0, lng: lng || 0, active: active || false};
  locations.push(location);
  DB.save('locations', locations);
  
  // Save to Firestore
  if (window.FBDB) {
    window.FBDB.saveLocation(location).catch(function(e) {
      console.error('Error saving location to Firestore:', e);
    });
  }
  
  return location;
}

function deleteLocationById(id) {
  locations = locations.filter(function(l) { return l.id !== id; });
  DB.save('locations', locations);
  
  // Delete from Firestore
  if (window.FBDB) {
    window.FBDB.deleteLocation(id).catch(function(e) {
      console.error('Error deleting location from Firestore:', e);
    });
  }
}

function updateLocationById(id, updates) {
  var location = locations.find(function(l) { return l.id === Number(id); });
  if (location) { 
    Object.assign(location, updates);
    DB.save('locations', locations);
    
    // Update in Firestore
    if (window.FBDB) {
      window.FBDB.saveLocation(location).catch(function(e) {
        console.error('Error updating location in Firestore:', e);
      });
    }
    
    return location; 
  }
  return null;
}

// Card functions
function addCard(code, name, discount) {
  if (cardHolders[code]) return null;
  cardHolders[code] = {name: name, discount: discount};
  DB.save('cardHolders', cardHolders);
  return cardHolders[code];
}

function deleteCard(code) {
  delete cardHolders[code];
  DB.save('cardHolders', cardHolders);
}

function updateCard(code, updates) {
  if (cardHolders[code]) { Object.assign(cardHolders[code], updates); DB.save('cardHolders', cardHolders); return cardHolders[code]; }
  return null;
}

// Bid functions
function placeBid(auctionId, bidAmount, bidderName) {
  var auction = auctions.find(function(a) { return a.id === Number(auctionId); });
  if (!auction) return false;
  if (bidAmount <= auction.currentPrice) return false;
  if (!auctionBids[auctionId]) auctionBids[auctionId] = [];
  var bid = {id: auctionId + '_' + Date.now(), auctionId: auctionId, amount: bidAmount, bidder: bidderName || 'Anonymous', timestamp: new Date().toISOString()};
  auctionBids[auctionId].push(bid);
  auction.currentPrice = bidAmount;
  auction.bidsCount = (auction.bidsCount || 0) + 1;
  DB.save('auctionBids', auctionBids);
  DB.save('auctions', auctions);
  return true;
}

// Notification functions
function addNotifyRequest(productId, method, contact) {
  var req = {productId: productId, method: method, contact: contact, date: new Date().toISOString()};
  notifyRequests.push(req);
  DB.save('notifyRequests', notifyRequests);
  return req;
}

// Utility functions
function getProductById(id) { return products.find(function(p) { return p.id === Number(id); }); }
function getAuctionById(id) { return auctions.find(function(a) { return a.id === Number(id); }); }
function getLocationById(id) { return locations.find(function(l) { return l.id === Number(id); }); }
function getBidsForAuction(auctionId) { return auctionBids[auctionId] || []; }
function getAllActiveLocations() { return locations.filter(function(l) { return l.active; }); }
