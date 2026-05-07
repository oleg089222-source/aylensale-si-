var products = [];
var locations = [];
var cardHolders = {};
var notifyRequests = [];
var auctions = [];
var auctionBids = {};

var DEFAULT_PRODUCTS = [
  {id: 1, name: 'iPhone 15 Pro', desc: 'Latest Apple flagship', images: ['https://via.placeholder.com/300x300?text=iPhone1', 'https://via.placeholder.com/300x300?text=iPhone2'], price: 999, retail: 999, wholesale: 799, stock: 5, category: 'electronics'},
  {id: 2, name: 'Samsung 4K TV', desc: 'Smart 55" 4K television', images: ['https://via.placeholder.com/300x300?text=Samsung1', 'https://via.placeholder.com/300x300?text=Samsung2'], price: 599, retail: 599, wholesale: 450, stock: 3, category: 'electronics'},
  {id: 3, name: 'MacBook Pro', desc: 'M4 Pro Laptop', images: ['https://via.placeholder.com/300x300?text=Mac1', 'https://via.placeholder.com/300x300?text=Mac2'], price: 1999, retail: 1999, wholesale: 1599, stock: 2, category: 'electronics'}
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
  {id: 101, name: 'Vintage Rolex Watch', desc: 'Authentic vintage Rolex Submariner', images: ['https://via.placeholder.com/300x300?text=Rolex1', 'https://via.placeholder.com/300x300?text=Rolex2'], startingPrice: 500, currentPrice: 1250, endTime: new Date(Date.now() + 72*3600000).toISOString(), category: 'watches', bidsCount: 12},
  {id: 102, name: 'Vintage Camera', desc: 'Classic SLR film camera', images: ['https://via.placeholder.com/300x300?text=Camera1'], startingPrice: 50, currentPrice: 185, endTime: new Date(Date.now() + 48*3600000).toISOString(), category: 'electronics', bidsCount: 8},
  {id: 103, name: 'Antique Lamp', desc: 'Beautiful art deco floor lamp', images: ['https://via.placeholder.com/300x300?text=Lamp1', 'https://via.placeholder.com/300x300?text=Lamp2'], startingPrice: 30, currentPrice: 275, endTime: new Date(Date.now() + 24*3600000).toISOString(), category: 'furniture', bidsCount: 15}
];

var DB = {
  save: function(key, data) { localStorage.setItem('aylen_' + key, JSON.stringify(data)); },
  load: function(key) { var data = localStorage.getItem('aylen_' + key); return data ? JSON.parse(data) : null; }
};

function initializeData() {
  if (!DB.load('products')) DB.save('products', DEFAULT_PRODUCTS);
  if (!DB.load('locations')) DB.save('locations', DEFAULT_LOCATIONS);
  if (!DB.load('cardHolders')) DB.save('cardHolders', DEFAULT_CARDS);
  if (!DB.load('auctions')) DB.save('auctions', DEFAULT_AUCTIONS);
  if (!DB.load('auctionBids')) DB.save('auctionBids', {});
}

async function loadAllData() {
  initializeData();
  products = DB.load('products') || DEFAULT_PRODUCTS;
  locations = DB.load('locations') || DEFAULT_LOCATIONS;
  cardHolders = DB.load('cardHolders') || DEFAULT_CARDS;
  notifyRequests = DB.load('notifyRequests') || [];
  auctions = DB.load('auctions') || DEFAULT_AUCTIONS;
  auctionBids = DB.load('auctionBids') || {};
  if (!products || products.length === 0) { products = DEFAULT_PRODUCTS; DB.save('products', products); }
  if (!locations || locations.length === 0) { locations = DEFAULT_LOCATIONS; DB.save('locations', locations); }
  if (!auctions || auctions.length === 0) { auctions = DEFAULT_AUCTIONS; DB.save('auctions', auctions); }
}

function addProductWithPhotos(name, desc, price, category, imageUrls, stock, wholesale) {
  var newId = 1;
  products.forEach(function(p) { if (p.id >= newId) newId = p.id + 1; });
  var product = {id: newId, name: name, desc: desc, description: desc, price: price, retail: price, wholesale: wholesale, category: category, images: imageUrls, stock: stock, imageUrl: imageUrls[0] || null};
  products.push(product);
  DB.save('products', products);
  return product;
}

function deleteProductById(id) {
  products = products.filter(function(p) { return p.id !== id; });
  DB.save('products', products);
}

function addNotifyRequest(productId, method, contact) {
  var req = {productId: productId, method: method, contact: contact, date: new Date().toISOString()};
  notifyRequests.push(req);
  DB.save('notifyRequests', notifyRequests);
}

function placeBid(auctionId, bidAmount, bidderName) {
  var auction = auctions.find(function(a) { return a.id === auctionId; });
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
