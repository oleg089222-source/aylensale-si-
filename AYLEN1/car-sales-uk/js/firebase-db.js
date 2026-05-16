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
    } else {
      console.warn('Firestore not available - using localStorage fallback');
    }
    
    // Get Storage reference
    if (typeof firebase.storage === 'function') {
      fbStorage = firebase.storage(fbApp);
      console.log('✓ Firebase Storage initialized');
    } else {
      console.warn('Storage not available');
    }
    
    // Set up real-time listeners
    setupFirestoreListeners();
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

/**
 * Image Upload/Download Functions for Firebase Storage
 */
FBDB.uploadImage = async function(file, productId) {
  if (!fbStorage) {
    console.warn('Firebase Storage not available');
    return { success: false, error: 'Storage not available' };
  }

  try {
    var timestamp = Date.now();
    var randomStr = Math.random().toString(36).substring(7);
    var fileName = 'products/' + productId + '/img_' + timestamp + '_' + randomStr + '.jpg';
    
    var storageRef = fbStorage.ref(fileName);
    await storageRef.put(file);
    
    // Get download URL
    var downloadURL = await storageRef.getDownloadURL();
    console.log('✓ Image uploaded:', downloadURL);
    
    return { success: true, url: downloadURL };
  } catch (error) {
    console.error('Error uploading image:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Convert File to base64 as fallback
 */
FBDB.fileToBase64 = function(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() {
      resolve(reader.result);
    };
    reader.onerror = function(error) {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Upload image with fallback to base64
 */
FBDB.uploadImageWithFallback = async function(file, productId) {
  try {
    // Try Firebase Storage first
    if (fbStorage) {
      var result = await FBDB.uploadImage(file, productId);
      if (result.success) {
        return result;
      }
    }
  } catch (error) {
    console.warn('Firebase Storage upload failed, using base64 fallback:', error.message);
  }
  
  // Fallback to base64
  try {
    var base64 = await FBDB.fileToBase64(file);
    console.log('✓ Image stored as base64 (fallback)');
    return { success: true, url: base64, isBase64: true };
  } catch (error) {
    console.error('Base64 conversion failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete image from Firebase Storage
 */
FBDB.deleteImage = async function(imageUrl) {
  if (!fbStorage || !imageUrl) {
    return true; // Can't delete, but don't fail
  }

  try {
    // Only delete if it's a Firebase Storage URL
    if (imageUrl.includes('firebasestorage.app') || imageUrl.includes('firebase.google.com')) {
      var fileRef = fbStorage.refFromURL(imageUrl);
      await fileRef.delete();
      console.log('✓ Image deleted from Storage');
    }
    return true;
  } catch (error) {
    console.warn('Error deleting image:', error);
    return true; // Don't fail even if delete fails
  }
};

// Make FBDB global so it can be used in other scripts
window.FBDB = FBDB;
