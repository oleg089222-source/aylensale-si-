/**
 * Starter VIP stock — 5 items per shop category (edit in Admin → VIP Members).
 */
(function(global) {
  var IMG = {
    pallet: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=640&h=400&q=70',
    boxes: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=640&h=400&q=70',
    warehouse: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=640&h=400&q=70',
    returns: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=640&h=400&q=70',
    mixed: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=640&h=400&q=70'
  };

  var CATEGORIES = [
    { id: 'electronics', label: 'Electronics' },
    { id: 'homeware', label: 'Homeware' },
    { id: 'clothing', label: 'Clothing' },
    { id: 'accessories', label: 'Accessories' },
    { id: 'general', label: 'General / Mixed' }
  ];

  var TEMPLATES = {
    electronics: [
      { title: 'Amazon returns electronics mix', desc: 'Small appliances, cables, gadgets — VIP preview lot.', vipPrice: 89, badge: 'VIP Early' },
      { title: 'Refurb-ready tech pallet', desc: 'Tested returns suitable for eBay/resale.', vipPrice: 120, badge: 'Hot' },
      { title: 'Phone & tablet accessories box', desc: 'Cases, chargers, holders — car boot friendly.', vipPrice: 45, badge: 'VIP' },
      { title: 'Smart home returns bundle', desc: 'Plugs, bulbs, small devices — mixed grades.', vipPrice: 65, badge: 'New' },
      { title: 'Electronics job lot — weekend special', desc: 'Limited VIP-only pallet before public listing.', vipPrice: 99, badge: '48h' }
    ],
    homeware: [
      { title: 'Homeware returns pallet', desc: 'Kitchen, décor, storage — Amazon liquidation style.', vipPrice: 75, badge: 'VIP' },
      { title: 'Kitchen essentials mix', desc: 'Utensils, small appliances, bundles.', vipPrice: 55, badge: 'VIP Early' },
      { title: 'Home décor job lot', desc: 'Frames, ornaments, seasonal — high turnover.', vipPrice: 40, badge: 'New' },
      { title: 'Storage & organisation box', desc: 'Bins, boxes, organisers — boot sale ready.', vipPrice: 35, badge: 'VIP' },
      { title: 'Homeware mystery pallet', desc: 'Unsorted returns — strong margin for traders.', vipPrice: 85, badge: 'Hot' }
    ],
    clothing: [
      { title: 'Clothing returns mix', desc: 'Tagged & untagged — grade A/B mix.', vipPrice: 60, badge: 'VIP' },
      { title: 'Kids clothing job lot', desc: 'Seasonal bundles — car boot favourite.', vipPrice: 45, badge: 'VIP Early' },
      { title: 'Menswear returns box', desc: 'Branded mix — inspect & sort.', vipPrice: 50, badge: 'New' },
      { title: 'Womenswear pallet preview', desc: 'VIP first look before shop listing.', vipPrice: 70, badge: '48h' },
      { title: 'Footwear & accessories mix', desc: 'Shoes, belts, bags — returns stock.', vipPrice: 55, badge: 'VIP' }
    ],
    accessories: [
      { title: 'Accessories returns bundle', desc: 'Bags, jewellery, watches — mixed.', vipPrice: 42, badge: 'VIP' },
      { title: 'Sunglasses & fashion accessories', desc: 'High impulse items for boot sales.', vipPrice: 38, badge: 'Hot' },
      { title: 'Beauty accessories job lot', desc: 'Tools, organisers, small items.', vipPrice: 48, badge: 'VIP Early' },
      { title: 'Travel accessories mix', desc: 'Luggage tags, pouches, adapters.', vipPrice: 36, badge: 'New' },
      { title: 'Accessories mystery box', desc: 'VIP-only preview — limited qty.', vipPrice: 52, badge: 'VIP' }
    ],
    general: [
      { title: 'Amazon general returns pallet', desc: 'Mixed category — ideal for experienced traders.', vipPrice: 95, badge: 'VIP' },
      { title: 'Car boot starter pallet', desc: 'Hand-picked lines for weekend sellers.', vipPrice: 80, badge: 'VIP Early' },
      { title: 'Wholesale mixed box', desc: 'Small items, fast turnover.', vipPrice: 50, badge: 'New' },
      { title: 'Liquidation mystery pallet', desc: 'VIP sees this 24–48h before public.', vipPrice: 110, badge: '48h' },
      { title: 'General merchandise job lot', desc: 'Editable template — update in admin.', vipPrice: 65, badge: 'VIP' }
    ]
  };

  var IMAGES = [IMG.pallet, IMG.boxes, IMG.warehouse, IMG.returns, IMG.mixed];

  function buildStarterItems() {
    var items = [];
    var order = 10;
    CATEGORIES.forEach(function(cat, ci) {
      var rows = TEMPLATES[cat.id] || [];
      rows.forEach(function(row, ri) {
        items.push({
          title: row.title,
          desc: row.desc,
          category: cat.id,
          categoryLabel: cat.label,
          vipPrice: row.vipPrice,
          badge: row.badge,
          imageUrl: IMAGES[(ci + ri) % IMAGES.length],
          visible: true,
          sortOrder: order
        });
        order += 10;
      });
    });
    return items;
  }

  global.AYLEN_VIP_SEED = {
    categories: CATEGORIES,
    buildStarterItems: buildStarterItems
  };
})(window);
