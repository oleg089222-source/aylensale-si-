/**
 * Product detail URLs — shared by grid cards and product.html
 */
(function(global) {
  function productPageUrl(productId) {
    if (productId === undefined || productId === null || productId === '') return '/#products';
    return '/product.html?id=' + encodeURIComponent(String(productId));
  }

  function openProductPage(productId, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    var url = productPageUrl(productId);
    if (!productId) return false;
    global.location.href = url;
    return false;
  }

  function findProductById(productId) {
    var list = typeof global.products !== 'undefined' ? global.products : [];
    var id = String(productId || '');
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === id) return list[i];
    }
    return null;
  }

  function productIdFromLocation(loc) {
    loc = loc || global.location;
    try {
      var params = new URLSearchParams(loc.search || '');
      var id = params.get('id') || params.get('product') || '';
      if (id) return id;
    } catch (e) { /* ignore */ }
    var hash = String(loc.hash || '');
    if (hash.indexOf('product=') !== -1) {
      return decodeURIComponent(hash.split('product=')[1].split('&')[0]);
    }
    return '';
  }

  global.productPageUrl = productPageUrl;
  global.openProductPage = openProductPage;
  global.findProductById = findProductById;
  global.productIdFromLocation = productIdFromLocation;
})(typeof window !== 'undefined' ? window : global);
