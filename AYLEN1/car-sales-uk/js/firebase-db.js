/**
 * Firebase Database Integration
 * Persistent storage using Firestore
 * Syncs across all devices and browsers
 * 
 * Features:
 * - Products saved to Firestore
 * - Auctions saved to Firestore  
 * - Locations saved to Firestore
 * - Images uploaded to Cloudinary/Firebase Storage
 * - Real-time sync across devices
 * - localStorage as cache for speed
 */

// Initialize Firebase (requires firebase-config.js to be loaded first)
var fbApp = null;
var fbDb = null;
var fbStorage = null;
var isFirebaseReady = false;
var syncInProgress = false;

// Initialize Firebase when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
  initializeFirebase();
}

function initializeFirebase() {
  try {
    // Check if firebaseConfig is available
    if (typeof firebaseConfig === 'undefined') {
      console.warn('Firebase config not loaded - using localStorage fallback');
      return;
    }

    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded - using localStorage fallback');
      console.log('Add to index.html: <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js"></script>');
      return;
    }

    // Initialize Firebase
    fbApp = firebase.initializeApp(firebaseConfig);
    
    // Get Firestore reference
    if (typeof firebase.firestore === 'function') {
      fbDb = firebase.firestore(fbApp);
      isFirebaseReady = true;
      console.log('✓ Firebase Firestore initialized');
      
      // Set up real-time listeners
      setupFirestoreListeners();
    } else {
      console.warn('Firestore not available - using localStorage fallback');
    }
  } catch (error) {
    console.warn('Firebase initialization failed:', error);
    console.log('Using localStorage fallback');
  }
}

/**
 * Setup real-time listeners for data changes
 */
function setupFirestoreListeners() {
  if (!fbDb) return;
  
  try {
    // Listen for product changes
    fbDb.collection('products').onSnapshot(function(snapshot) {
      var data = [];
      snapshot.forEach(function(doc) {
        data.push(Object.assign({ id: doc.id }, doc.data()));
      });
      if (data.length > 0) {
        products = data;
        localStorage.setItem('aylen_products_cache', JSON.stringify(products));
        if (typeof renderProducts === 'function') {
          renderProducts();
        }
      }
    });

    // Listen for auction changes
    fbDb.collection('auctions').onSnapshot(function(snapshot) {
      var data = [];
      snapshot.forEach(function(doc) {
        data.push(Object.assign({ id: doc.id }, doc.data()));
      });
      if (data.length > 0) {
        auctions = data;
        localStorage.setItem('aylen_auctions_cache', JSON.stringify(auctions));
        if (typeof renderAuctions === 'function') {
          renderAuctions();
        }
      }
    });

    // Listen for location changes
    fbDb.collection('locations').onSnapshot(function(snapshot) {
      var data = [];
      snapshot.forEach(function(doc) {
        data.push(Object.assign({ id: doc.id }, doc.data()));
      });
      if (data.length > 0) {
        locations = data;
        localStorage.setItem('aylen_locations_cache', JSON.stringify(locations));
        if (typeof renderLocations === 'function') {
          renderLocations();
        }
      }
    });
  } catch (error) {
    console.warn('Could not setup Firestore listeners:', error);
  }
}

/**
 * Enhanced Database Utility with Firestore Support
 */
var FBDB = {
  // Save product to Firestore
  saveProduct: async function(product) {
    if (!fbDb) {
      // Fallback to localStorage
      var products = JSON.parse(localStorage.getItem('aylen_products') || '[]');
      var index = products.findIndex(function(p) { return p.id === product.id; });
      if (index >= 0) {
        products[index] = product;
      } else {
        products.push(product);
      }
      localStorage.setItem('aylen_products', JSON.stringify(products));
      return product;
    }

    try {
      var productId = 'prod_' + (product.id || Date.now());
      var data = Object.assign({}, product);
      delete data.id;
      
      await fbDb.collection('products').doc(productId).set(data, { merge: true });
      return product;
    } catch (error) {
      console.error('Error saving product to Firestore:', error);
      // Fallback to localStorage
      var products = JSON.parse(localStorage.getItem('aylen_products') || '[]');
      var index = products.findIndex(function(p) { return p.id === product.id; });
      if (index >= 0) {
        products[index] = product;
      } else {
        products.push(product);
      }
      localStorage.setItem('aylen_products', JSON.stringify(products));
      return product;
    }
  },

  // Delete product from Firestore
  deleteProduct: async function(productId) {
    if (!fbDb) {
      // Fallback to localStorage
      var products = JSON.parse(localStorage.getItem('aylen_products') || '[]');
      products = products.filter(function(p) { return p.id !== productId; });
      localStorage.setItem('aylen_products', JSON.stringify(products));
      return true;
    }

    try {
      await fbDb.collection('products').doc('prod_' + productId).delete();
      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      // Fallback to localStorage
      var products = JSON.parse(localStorage.getItem('aylen_products') || '[]');
      products = products.filter(function(p) { return p.id !== productId; });
      localStorage.setItem('aylen_products', JSON.stringify(products));
      return true;
    }
  },

  // Save auction to Firestore
  saveAuction: async function(auction) {
    if (!fbDb) {
      var auctions = JSON.parse(localStorage.getItem('aylen_auctions') || '[]');
      var index = auctions.findIndex(function(a) { return a.id === auction.id; });
      if (index >= 0) {
        auctions[index] = auction;
      } else {
        auctions.push(auction);
      }
      localStorage.setItem('aylen_auctions', JSON.stringify(auctions));
      return auction;
    }

    try {
      var auctionId = 'auction_' + (auction.id || Date.now());
      var data = Object.assign({}, auction);
      delete data.id;
      
      await fbDb.collection('auctions').doc(auctionId).set(data, { merge: true });
      return auction;
    } catch (error) {
      console.error('Error saving auction:', error);
      var auctions = JSON.parse(localStorage.getItem('aylen_auctions') || '[]');
      var index = auctions.findIndex(function(a) { return a.id === auction.id; });
      if (index >= 0) {
        auctions[index] = auction;
      } else {
        auctions.push(auction);
      }
      localStorage.setItem('aylen_auctions', JSON.stringify(auctions));
      return auction;
    }
  },

  // Delete auction from Firestore
  deleteAuction: async function(auctionId) {
    if (!fbDb) {
      var auctions = JSON.parse(localStorage.getItem('aylen_auctions') || '[]');
      auctions = auctions.filter(function(a) { return a.id !== auctionId; });
      localStorage.setItem('aylen_auctions', JSON.stringify(auctions));
      return true;
    }

    try {
      await fbDb.collection('auctions').doc('auction_' + auctionId).delete();
      return true;
    } catch (error) {
      console.error('Error deleting auction:', error);
      var auctions = JSON.parse(localStorage.getItem('aylen_auctions') || '[]');
      auctions = auctions.filter(function(a) { return a.id !== auctionId; });
      localStorage.setItem('aylen_auctions', JSON.stringify(auctions));
      return true;
    }
  },

  // Save location to Firestore
  saveLocation: async function(location) {
    if (!fbDb) {
      var locations = JSON.parse(localStorage.getItem('aylen_locations') || '[]');
      var index = locations.findIndex(function(l) { return l.id === location.id; });
      if (index >= 0) {
        locations[index] = location;
      } else {
        locations.push(location);
      }
      localStorage.setItem('aylen_locations', JSON.stringify(locations));
      return location;
    }

    try {
      var locationId = 'loc_' + (location.id || Date.now());
      var data = Object.assign({}, location);
      delete data.id;
      
      await fbDb.collection('locations').doc(locationId).set(data, { merge: true });
      return location;
    } catch (error) {
      console.error('Error saving location:', error);
      var locations = JSON.parse(localStorage.getItem('aylen_locations') || '[]');
      var index = locations.findIndex(function(l) { return l.id === location.id; });
      if (index >= 0) {
        locations[index] = location;
      } else {
        locations.push(location);
      }
      localStorage.setItem('aylen_locations', JSON.stringify(locations));
      return location;
    }
  },

  // Delete location from Firestore
  deleteLocation: async function(locationId) {
    if (!fbDb) {
      var locations = JSON.parse(localStorage.getItem('aylen_locations') || '[]');
      locations = locations.filter(function(l) { return l.id !== locationId; });
      localStorage.setItem('aylen_locations', JSON.stringify(locations));
      return true;
    }

    try {
      await fbDb.collection('locations').doc('loc_' + locationId).delete();
      return true;
    } catch (error) {
      console.error('Error deleting location:', error);
      var locations = JSON.parse(localStorage.getItem('aylen_locations') || '[]');
      locations = locations.filter(function(l) { return l.id !== locationId; });
      localStorage.setItem('aylen_locations', JSON.stringify(locations));
      return true;
    }
  },

  // Load products from Firestore
  loadProducts: async function() {
    if (!fbDb) {
      var cached = localStorage.getItem('aylen_products_cache');
      return cached ? JSON.parse(cached) : [];
    }

    try {
      var snapshot = await fbDb.collection('products').get();
      var data = [];
      snapshot.forEach(function(doc) {
        data.push(Object.assign({ id: doc.id }, doc.data()));
      });
      if (data.length > 0) {
        localStorage.setItem('aylen_products_cache', JSON.stringify(data));
      }
      return data;
    } catch (error) {
      console.error('Error loading products:', error);
      var cached = localStorage.getItem('aylen_products_cache');
      return cached ? JSON.parse(cached) : [];
    }
  },

  // Load auctions from Firestore
  loadAuctions: async function() {
    if (!fbDb) {
      var cached = localStorage.getItem('aylen_auctions_cache');
      return cached ? JSON.parse(cached) : [];
    }

    try {
      var snapshot = await fbDb.collection('auctions').get();
      var data = [];
      snapshot.forEach(function(doc) {
        data.push(Object.assign({ id: doc.id }, doc.data()));
      });
      if (data.length > 0) {
        localStorage.setItem('aylen_auctions_cache', JSON.stringify(data));
      }
      return data;
    } catch (error) {
      console.error('Error loading auctions:', error);
      var cached = localStorage.getItem('aylen_auctions_cache');
      return cached ? JSON.parse(cached) : [];
    }
  },

  // Load locations from Firestore
  loadLocations: async function() {
    if (!fbDb) {
      var cached = localStorage.getItem('aylen_locations_cache');
      return cached ? JSON.parse(cached) : [];
    }

    try {
      var snapshot = await fbDb.collection('locations').get();
      var data = [];
      snapshot.forEach(function(doc) {
        data.push(Object.assign({ id: doc.id }, doc.data()));
      });
      if (data.length > 0) {
        localStorage.setItem('aylen_locations_cache', JSON.stringify(data));
      }
      return data;
    } catch (error) {
      console.error('Error loading locations:', error);
      var cached = localStorage.getItem('aylen_locations_cache');
      return cached ? JSON.parse(cached) : [];
    }
  }
};

// Make FBDB global so it can be used in other scripts
window.FBDB = FBDB;
