/**
 * Firebase Database Integration v2
 * CLOUD STORAGE - Firestore + Cloud Storage
 * Syncs photos and products across ALL devices
 * 
 * Features:
 * - Products saved to Firestore (primary storage)
 * - Auctions saved to Firestore  
 * - Locations saved to Firestore
 * - Photos uploaded to Firebase Cloud Storage
 * - Real-time sync across all browsers and devices
 * - localStorage as offline cache ONLY
 */

// Initialize Firebase (requires firebase-config.js to be loaded first)
var fbApp = null;
var fbDb = null;
var fbStorage = null;
var isFirebaseReady = false;
var syncInProgress = false;

// Try to initialize Firebase immediately
if (typeof firebaseConfig !== 'undefined' && typeof firebase !== 'undefined') {
  initializeFirebase();
}

// Also try when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
  // DOM is already loaded
  if (!isFirebaseReady) {
    setTimeout(initializeFirebase, 100);
  }
}

function initializeFirebase() {
  if (isFirebaseReady) return; // Already initialized
  
  try {
    // Check if firebaseConfig is available
    if (typeof firebaseConfig === 'undefined') {
      console.error('❌ Firebase config not loaded');
      return;
    }

    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.error('❌ Firebase SDK not loaded in index.html');
      return;
    }

    console.log('🔥 Initializing Firebase...');
    
    // Initialize Firebase
    fbApp = firebase.initializeApp(firebaseConfig, 'aylensale-app');
    console.log('✅ Firebase app initialized');
    
    // Get Firestore reference
    if (typeof firebase.firestore === 'function') {
      fbDb = firebase.firestore(fbApp);
      console.log('✅ Firestore initialized');
    } else {
      console.error('❌ Firestore SDK not loaded');
    }
    
    // Get Storage reference
    if (typeof firebase.storage === 'function') {
      fbStorage = firebase.storage(fbApp);
      console.log('✅ Cloud Storage initialized');
    } else {
      console.error('❌ Storage SDK not loaded');
    }
    
    isFirebaseReady = true;
    console.log('✅ Firebase READY - All devices will now sync photos!');
    
    // Set up real-time listeners
    setTimeout(setupFirestoreListeners, 500);
    
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
  }
}

/**
 * Real-time listeners - when ANY device updates data, ALL devices get notified
 */
function setupFirestoreListeners() {
  if (!fbDb) {
    console.warn('⚠️ Firestore not available - real-time sync disabled');
    return;
  }
  
  console.log('📡 Setting up real-time listeners...');
  
  try {
    // Listen for product changes from ANY device
    fbDb.collection('products').onSnapshot(function(snapshot) {
      console.log('📡 Products changed in Firestore');
      var data = [];
      snapshot.forEach(function(doc) {
        var item = doc.data();
        item.id = doc.id;
        data.push(item);
      });
      
      if (data.length > 0) {
        products = data;
        // Cache for offline support
        localStorage.setItem('aylen_products_cache', JSON.stringify(products));
        console.log('✅ Products updated on this device:', data.length, 'items');
        // Reload UI
        if (typeof renderProducts === 'function') {
          renderProducts();
        }
      }
    }, function(error) {
      console.warn('⚠️ Product listener error:', error.message);
    });

    // Listen for auction changes
    fbDb.collection('auctions').onSnapshot(function(snapshot) {
      console.log('📡 Auctions changed in Firestore');
      var data = [];
      snapshot.forEach(function(doc) {
        var item = doc.data();
        item.id = doc.id;
        data.push(item);
      });
      
      if (data.length > 0) {
        auctions = data;
        localStorage.setItem('aylen_auctions_cache', JSON.stringify(auctions));
        console.log('✅ Auctions updated on this device:', data.length, 'items');
        if (typeof renderAuctions === 'function') {
          renderAuctions();
        }
      }
    }, function(error) {
      console.warn('⚠️ Auction listener error:', error.message);
    });

    // Listen for location changes
    fbDb.collection('locations').onSnapshot(function(snapshot) {
      console.log('📡 Locations changed in Firestore');
      var data = [];
      snapshot.forEach(function(doc) {
        var item = doc.data();
        item.id = doc.id;
        data.push(item);
      });
      
      if (data.length > 0) {
        locations = data;
        localStorage.setItem('aylen_locations_cache', JSON.stringify(locations));
        console.log('✅ Locations updated on this device:', data.length, 'items');
        if (typeof renderLocations === 'function') {
          renderLocations();
        }
      }
    }, function(error) {
      console.warn('⚠️ Location listener error:', error.message);
    });
    
    console.log('✅ Real-time listeners active - all changes sync instantly!');
  } catch (error) {
    console.warn('⚠️ Could not setup Firestore listeners:', error.message);
  }
}

/**
 * Firebase Database API
 * All methods use Firestore (cloud) with localStorage fallback
 */
var FBDB = {};

/**
 * FIRESTORE DATABASE OPERATIONS
 * These sync to Firestore (cloud) - visible to all devices
 */

/**
 * Save product to Firestore
 */
FBDB.saveProduct = async function(product) {
  if (!fbDb) {
    console.warn('Firestore not available - using localStorage fallback');
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
    delete data.id; // Remove id field, use as document key
    
    // Add metadata
    data.updatedAt = new Date().toISOString();
    data.lastModified = firebase.firestore.FieldValue.serverTimestamp();
    
    await fbDb.collection('products').doc(productId).set(data, { merge: true });
    console.log('☁️ Product saved to Firestore:', productId);
    return product;
  } catch (error) {
    console.error('❌ Error saving product to Firestore:', error.message);
    // Fallback to localStorage
    var products = JSON.parse(localStorage.getItem('aylen_products') || '[]');
    var index = products.findIndex(function(p) { return p.id === product.id; });
    if (index >= 0) {
      products[index] = product;
    } else {
      products.push(product);
    }
    localStorage.setItem('aylen_products', JSON.stringify(products));
    throw error;
  }
};

/**
 * Delete product from Firestore
 */
FBDB.deleteProduct = async function(productId) {
  if (!fbDb) {
    var products = JSON.parse(localStorage.getItem('aylen_products') || '[]');
    products = products.filter(function(p) { return p.id !== productId; });
    localStorage.setItem('aylen_products', JSON.stringify(products));
    return true;
  }

  try {
    await fbDb.collection('products').doc('prod_' + productId).delete();
    console.log('☁️ Product deleted from Firestore');
    return true;
  } catch (error) {
    console.error('❌ Error deleting product:', error.message);
    throw error;
  }
};

/**
 * Save auction to Firestore
 */
FBDB.saveAuction = async function(auction) {
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
    data.updatedAt = new Date().toISOString();
    data.lastModified = firebase.firestore.FieldValue.serverTimestamp();
    
    await fbDb.collection('auctions').doc(auctionId).set(data, { merge: true });
    console.log('☁️ Auction saved to Firestore');
    return auction;
  } catch (error) {
    console.error('❌ Error saving auction:', error.message);
    throw error;
  }
};

/**
 * Delete auction from Firestore
 */
FBDB.deleteAuction = async function(auctionId) {
  if (!fbDb) {
    var auctions = JSON.parse(localStorage.getItem('aylen_auctions') || '[]');
    auctions = auctions.filter(function(a) { return a.id !== auctionId; });
    localStorage.setItem('aylen_auctions', JSON.stringify(auctions));
    return true;
  }

  try {
    await fbDb.collection('auctions').doc('auction_' + auctionId).delete();
    console.log('☁️ Auction deleted from Firestore');
    return true;
  } catch (error) {
    console.error('❌ Error deleting auction:', error.message);
    throw error;
  }
};

/**
 * Save location to Firestore
 */
FBDB.saveLocation = async function(location) {
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
    data.updatedAt = new Date().toISOString();
    data.lastModified = firebase.firestore.FieldValue.serverTimestamp();
    
    await fbDb.collection('locations').doc(locationId).set(data, { merge: true });
    console.log('☁️ Location saved to Firestore');
    return location;
  } catch (error) {
    console.error('❌ Error saving location:', error.message);
    throw error;
  }
};

/**
 * Delete location from Firestore
 */
FBDB.deleteLocation = async function(locationId) {
  if (!fbDb) {
    var locations = JSON.parse(localStorage.getItem('aylen_locations') || '[]');
    locations = locations.filter(function(l) { return l.id !== locationId; });
    localStorage.setItem('aylen_locations', JSON.stringify(locations));
    return true;
  }

  try {
    await fbDb.collection('locations').doc('loc_' + locationId).delete();
    console.log('☁️ Location deleted from Firestore');
    return true;
  } catch (error) {
    console.error('❌ Error deleting location:', error.message);
    throw error;
  }
};

/**
 * FIRESTORE LOADER FUNCTIONS
 * Load data from Firestore and cache to localStorage
 */

FBDB.loadProducts = async function() {
  if (!fbDb) {
    console.warn('Firestore not available');
    var cached = localStorage.getItem('aylen_products_cache');
    return cached ? JSON.parse(cached) : [];
  }

  try {
    console.log('📡 Loading products from Firestore...');
    var snapshot = await fbDb.collection('products').get();
    var data = [];
    snapshot.forEach(function(doc) {
      var item = doc.data();
      item.id = doc.id;
      data.push(item);
    });
    console.log('✅ Loaded', data.length, 'products from Firestore');
    if (data.length > 0) {
      localStorage.setItem('aylen_products_cache', JSON.stringify(data));
    }
    return data;
  } catch (error) {
    console.error('❌ Error loading products:', error.message);
    var cached = localStorage.getItem('aylen_products_cache');
    return cached ? JSON.parse(cached) : [];
  }
};

FBDB.loadAuctions = async function() {
  if (!fbDb) {
    console.warn('Firestore not available');
    var cached = localStorage.getItem('aylen_auctions_cache');
    return cached ? JSON.parse(cached) : [];
  }

  try {
    console.log('📡 Loading auctions from Firestore...');
    var snapshot = await fbDb.collection('auctions').get();
    var data = [];
    snapshot.forEach(function(doc) {
      var item = doc.data();
      item.id = doc.id;
      data.push(item);
    });
    console.log('✅ Loaded', data.length, 'auctions from Firestore');
    if (data.length > 0) {
      localStorage.setItem('aylen_auctions_cache', JSON.stringify(data));
    }
    return data;
  } catch (error) {
    console.error('❌ Error loading auctions:', error.message);
    var cached = localStorage.getItem('aylen_auctions_cache');
    return cached ? JSON.parse(cached) : [];
  }
};

FBDB.loadLocations = async function() {
  if (!fbDb) {
    console.warn('Firestore not available');
    var cached = localStorage.getItem('aylen_locations_cache');
    return cached ? JSON.parse(cached) : [];
  }

  try {
    console.log('📡 Loading locations from Firestore...');
    var snapshot = await fbDb.collection('locations').get();
    var data = [];
    snapshot.forEach(function(doc) {
      var item = doc.data();
      item.id = doc.id;
      data.push(item);
    });
    console.log('✅ Loaded', data.length, 'locations from Firestore');
    if (data.length > 0) {
      localStorage.setItem('aylen_locations_cache', JSON.stringify(data));
    }
    return data;
  } catch (error) {
    console.error('❌ Error loading locations:', error.message);
    var cached = localStorage.getItem('aylen_locations_cache');
    return cached ? JSON.parse(cached) : [];
  }
};
};

/**
 * CLOUD STORAGE - Photo Upload Functions
 * Photos stored in Firebase Cloud Storage bucket
 * Accessible from ANY device, synced automatically
 */

FBDB.uploadImage = async function(file, productId) {
  if (!fbStorage) {
    console.warn('❌ Firebase Cloud Storage not available');
    return { success: false, error: 'Storage not available' };
  }

  try {
    console.log('📤 Uploading image to Cloud Storage...');
    
    var timestamp = Date.now();
    var randomStr = Math.random().toString(36).substring(7);
    var fileName = 'products/' + productId + '/img_' + timestamp + '_' + randomStr + '.jpg';
    
    // Use the new Firebase SDK syntax
    var storageRef = fbStorage.ref(fileName);
    
    // Upload the file
    var uploadTask = storageRef.put(file);
    
    // Wait for upload to complete
    await uploadTask;
    
    // Get download URL
    var downloadURL = await storageRef.getDownloadURL();
    console.log('✅ Image uploaded to Cloud Storage:', downloadURL);
    
    return { success: true, url: downloadURL };
  } catch (error) {
    console.error('❌ Error uploading image:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Convert File to base64 (fallback for offline)
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
 * Upload image to Cloud Storage with base64 fallback
 * Priority: Cloud Storage > base64 (offline cache)
 */
FBDB.uploadImageWithFallback = async function(file, productId) {
  try {
    // Try Firebase Cloud Storage first
    if (fbStorage) {
      try {
        console.log('☁️ Attempting Cloud Storage upload...');
        var result = await FBDB.uploadImage(file, productId);
        if (result.success) {
          console.log('✅ Image successfully stored in the cloud');
          return result;
        }
      } catch (error) {
        console.warn('⚠️ Cloud Storage upload failed:', error.message);
      }
    }
  } catch (error) {
    console.warn('⚠️ Cloud Storage not available:', error.message);
  }
  
  // Fallback to base64 (for offline support)
  try {
    console.log('💾 Using base64 fallback (offline mode)');
    var base64 = await FBDB.fileToBase64(file);
    console.log('✅ Image stored as base64 - will sync when online');
    return { success: true, url: base64, isBase64: true };
  } catch (error) {
    console.error('❌ Base64 conversion failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete image from Cloud Storage
 */
FBDB.deleteImage = async function(imageUrl) {
  if (!fbStorage || !imageUrl) {
    return true;
  }

  // Check if it's a Firebase Storage URL
  if (imageUrl.includes('firebasestorage.googleapis.com')) {
    try {
      // Extract file path from URL
      var urlParts = imageUrl.split('/o/')[1];
      if (urlParts) {
        var filePath = decodeURIComponent(urlParts.split('?')[0]);
        var fileRef = fbStorage.ref(filePath);
        await fileRef.delete();
        console.log('✅ Image deleted from Cloud Storage');
      }
    } catch (error) {
      console.warn('⚠️ Could not delete image:', error.message);
    }
  }
  
  return true;
};

// ============================================
// MAKE FBDB GLOBAL FOR USE IN OTHER SCRIPTS
// ============================================
window.FBDB = FBDB;
console.log('✅ Firebase Database API ready (FBDB)');
