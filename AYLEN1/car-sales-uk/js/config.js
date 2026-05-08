var ADMIN_LOGIN = 'admin';
var ADMIN_PASS = 'admin2024';
var TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN';
var TELEGRAM_CHAT_ID = 'YOUR_CHAT_ID';

// Initialize default products
if (typeof products === 'undefined') var products = [];
if (typeof locations === 'undefined') var locations = [];
if (typeof cardHolders === 'undefined') var cardHolders = {};
if (typeof auctions === 'undefined') var auctions = [];
if (typeof auctionBids === 'undefined') var auctionBids = {};

var DEFAULT_PRODUCTS = [{id:1,name:'iPhone 15 Pro',desc:'Latest Apple flagship',images:['https://via.placeholder.com/300x300?text=iPhone1','https://via.placeholder.com/300x300?text=iPhone2'],price:999,retail:999,wholesale:799,stock:5,category:'electronics'},{id:2,name:'Samsung 4K TV',desc:'Smart 55" 4K television',images:['https://via.placeholder.com/300x300?text=Samsung1','https://via.placeholder.com/300x300?text=Samsung2'],price:599,retail:599,wholesale:450,stock:3,category:'electronics'},{id:3,name:'MacBook Pro',desc:'M4 Pro Laptop',images:['https://via.placeholder.com/300x300?text=Mac1','https://via.placeholder.com/300x300?text=Mac2'],price:1999,retail:1999,wholesale:1599,stock:2,category:'electronics'}];
var DEFAULT_LOCATIONS = [{id:1,name:'Battersea Car Boot',address:'Battersea Park, London SW11 4NJ',day:'sunday',time:'8:00-14:00',lat:51.4801,lng:-0.1567,active:true},{id:2,name:'Wimbledon Car Boot',address:'Wimbledon Stadium, London SW17 0BA',day:'saturday',time:'7:00-13:00',lat:51.4234,lng:-0.1876,active:false},{id:3,name:'Holloway Car Boot',address:'Holloway Road, London N7 6PA',day:'saturday',time:'8:00-15:00',lat:51.5567,lng:-0.1167,active:true},{id:4,name:'Kilburn Car Boot',address:'Kilburn Square, London NW6 6JA',day:'sunday',time:'7:00-14:00',lat:51.5367,lng:-0.1967,active:false},{id:5,name:'Epsom Car Boot',address:'Hook Road Arena, Epsom KT19 8QG',day:'saturday',time:'6:30-12:00',lat:51.3367,lng:-0.2667,active:false}];
var DEFAULT_AUCTIONS = [{id:101,name:'Vintage Rolex Watch',desc:'Authentic vintage Rolex Submariner',images:['https://via.placeholder.com/300x300?text=Rolex1','https://via.placeholder.com/300x300?text=Rolex2'],startingPrice:500,currentPrice:1250,endTime:new Date(Date.now()+72*3600000).toISOString(),category:'watches',bidsCount:12},{id:102,name:'Vintage Camera',desc:'Classic SLR film camera',images:['https://via.placeholder.com/300x300?text=Camera1'],startingPrice:50,currentPrice:185,endTime:new Date(Date.now()+48*3600000).toISOString(),category:'electronics',bidsCount:8},{id:103,name:'Antique Lamp',desc:'Beautiful art deco floor lamp',images:['https://via.placeholder.com/300x300?text=Lamp1','https://via.placeholder.com/300x300?text=Lamp2'],startingPrice:30,currentPrice:275,endTime:new Date(Date.now()+24*3600000).toISOString(),category:'furniture',bidsCount:15}];

// Ensure products always have defaults
if (!localStorage.getItem('aylen_products')) localStorage.setItem('aylen_products', JSON.stringify(DEFAULT_PRODUCTS));
if (!localStorage.getItem('aylen_locations')) localStorage.setItem('aylen_locations', JSON.stringify(DEFAULT_LOCATIONS));
if (!localStorage.getItem('aylen_auctions')) localStorage.setItem('aylen_auctions', JSON.stringify(DEFAULT_AUCTIONS));

// Auto-load on page start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof loadAllData === 'function') loadAllData().catch(e => {
      products = localStorage.getItem('aylen_products') ? JSON.parse(localStorage.getItem('aylen_products')) : DEFAULT_PRODUCTS;
      if (!products || products.length === 0) products = DEFAULT_PRODUCTS;
    });
  });
} else {
  if (typeof loadAllData === 'function') loadAllData().catch(e => {
    products = localStorage.getItem('aylen_products') ? JSON.parse(localStorage.getItem('aylen_products')) : DEFAULT_PRODUCTS;
    if (!products || products.length === 0) products = DEFAULT_PRODUCTS;
  });
}
