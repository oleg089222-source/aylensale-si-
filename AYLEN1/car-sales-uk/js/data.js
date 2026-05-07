var products = [];
var locations = [];
var cardHolders = {};
var notifyRequests = [];
var auctions = [];
var auctionBids = {};

var DB = {
  save: function(key, data) {
    localStorage.setItem('aylen_' + key, JSON.stringify(data));
  },
  load: function(key) {
    var data = localStorage.getItem('aylen_' + key);
    return data ? JSON.parse(data) : null;
  }
};

async function loadAllData() {
  products = DB.load('products') || [
    {id: 1, name: 'Test product', desc: 'Test desc', images: ['https://via.placeholder.com/300x300?text=Test1', 'https://via.placeholder.com/300x300?text=Test2', 'https://via.placeholder.com/300x300?text=Test3', 'https://via.placeholder.com/300x300?text=Test4', 'https://via.placeholder.com/300x300?text=Test5'], price: 12, retail: 12, wholesale: 6, stock: 0, category: 'test'},
    {id: 2, name: 'Admin test edited', desc: 'Admin desc', images: ['https://via.placeholder.com/300x300?text=Admin1', 'https://via.placeholder.com/300x300?text=Admin2'], price: 15, retail: 15, wholesale: 10, stock: 0, category: 'admin'}
  ];
  
  locations = DB.load('locations') || [
    {id: 1, name: 'Battersea Car Boot', address: 'Battersea Park, London SW11 4NJ', day: 'sunday', time: '8:00-14:00', lat: 51.4801, lng: -0.1567, active: true},
    {id: 2, name: 'Wimbledon Car Boot', address: 'Wimbledon Stadium, London SW17 0BA', day: 'saturday', time: '7:00-13:00', lat: 51.4234, lng: -0.1876, active: false},
    {id: 3, name: 'Holloway Car Boot', address: 'Holloway Road, London N7 6PA', day: 'saturday', time: '8:00-15:00', lat: 51.5567, lng: -0.1167, active: true},
    {id: 4, name: 'Kilburn Car Boot', address: 'Kilburn Square, London NW6 6JA', day: 'sunday', time: '7:00-14:00', lat: 51.5367, lng: -0.1967, active: false},
    {id: 5, name: 'Epsom Car Boot', address: 'Hook Road Arena, Epsom KT19 8QG', day: 'saturday', time: '6:30-12:00', lat: 51.3367, lng: -0.2667, active: false}
  ];
  
  cardHolders = DB.load('cardHolders') || {
    'AYLE001': {name: 'John Doe', discount: 10},
    'AYLE002': {name: 'Jane Smith', discount: 15}
  };
  
  notifyRequests = DB.load('notifyRequests') || [];
  
  // Load auctions
  auctions = DB.load('auctions') || [
    {id: 101, name: 'Vintage Rolex Watch', desc: 'Authentic vintage Rolex Submariner', images: ['https://via.placeholder.com/300x300?text=Rolex1', 'https://via.placeholder.com/300x300?text=Rolex2'], startingPrice: 500, currentPrice: 1250, endTime: new Date(Date.now() + 72*3600000).toISOString(), category: 'watches', bidsCount: 12},
    {id: 102, name: 'Vintage Camera', desc: 'Classic SLR film camera', images: ['https://via.placeholder.com/300x300?text=Camera1'], startingPrice: 50, currentPrice: 185, endTime: new Date(Date.now() + 48*3600000).toISOString(), category: 'electronics', bidsCount: 8},
    {id: 103, name: 'Antique Lamp', desc: 'Beautiful art deco floor lamp', images: ['https://via.placeholder.com/300x300?text=Lamp1', 'https://via.placeholder.com/300x300?text=Lamp2'], startingPrice: 30, currentPrice: 275, endTime: new Date(Date.now() + 24*3600000).toISOString(), category: 'furniture', bidsCount: 15}
  ];
  
  auctionBids = DB.load('auctionBids') || {};
}

function addProductWithPhotos(name, desc, price, category, imageUrls, stock, wholesale) {
  var newId = 1;
  products.forEach(function(p) { if (p.id >= newId) newId = p.id + 1; });
  
  var product = {
    id: newId,
    name: name,
    desc: desc,
    description: desc,
    price: price,
    retail: price,
    wholesale: wholesale,
    category: category,
    images: imageUrls,
    stock: stock,
    imageUrl: imageUrls[0] || null
  };
  
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
  
  var bid = {
    id: auctionId + '_' + Date.now(),
    auctionId: auctionId,
    amount: bidAmount,
    bidder: bidderName || 'Anonymous',
    timestamp: new Date().toISOString()
  };
  
  auctionBids[auctionId].push(bid);
  auction.currentPrice = bidAmount;
  auction.bidsCount = (auction.bidsCount || 0) + 1;
  
  DB.save('auctionBids', auctionBids);
  DB.save('auctions', auctions);
  
  return true;
}
