/**
 * SEO, Open Graph helpers & JSON-LD structured data.
 */
(function(global) {
  function site() {
    return global.AYLEN_SITE || {};
  }

  function absoluteUrl(path) {
    var base = (site().siteUrl || '').replace(/\/$/, '');
    if (!path) return base;
    if (/^https?:\/\//i.test(path)) return path;
    return base + (path.charAt(0) === '/' ? path : '/' + path);
  }

  function upsertMeta(attr, key, content) {
    if (!content) return;
    var selector = 'meta[' + attr + '="' + key + '"]';
    var el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function upsertJsonLd(id, data) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function initBaseMeta() {
    var cfg = site();
    var seo = cfg.seo || {};
    var title = seo.title || (cfg.brand + ' | UK Marketplace');
    var description = seo.description || cfg.tagline || '';
    var url = absoluteUrl('/');
    var image = absoluteUrl(cfg.defaultOgImage || '/og-image.svg');

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'keywords', seo.keywords || '');
    upsertMeta('name', 'robots', 'index,follow,max-image-preview:large');
    upsertMeta('name', 'author', cfg.brand || 'AYLENSALE');
    upsertMeta('name', 'geo.region', 'GB');
    upsertMeta('name', 'geo.placename', 'United Kingdom');

    var gsc = cfg.analytics && cfg.analytics.googleSearchConsoleVerification;
    if (gsc) upsertMeta('name', 'google-site-verification', gsc);

    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', cfg.brand || 'AYLENSALE');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:locale', cfg.locale || 'en_GB');

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', image);
    if (cfg.twitterHandle) upsertMeta('name', 'twitter:site', cfg.twitterHandle);

    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }

  function initOrganizationSchema() {
    var cfg = site();
    upsertJsonLd('aylen-schema-org', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: cfg.legalName || cfg.brand || 'AYLENSALE',
      url: absoluteUrl('/'),
      logo: absoluteUrl(cfg.defaultOgImage || '/og-image.svg'),
      email: cfg.contactEmail || undefined,
      telephone: cfg.phone || undefined,
      address: {
        '@type': 'PostalAddress',
        addressCountry: (cfg.address && cfg.address.country) || 'GB',
        streetAddress: (cfg.address && cfg.address.line1) || 'United Kingdom'
      },
      sameAs: []
    });

    upsertJsonLd('aylen-schema-website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: cfg.brand || 'AYLENSALE',
      url: absoluteUrl('/'),
      inLanguage: cfg.locale || 'en-GB',
      potentialAction: {
        '@type': 'SearchAction',
        target: absoluteUrl('/#products'),
        'query-input': 'required name=search_term_string'
      }
    });

    upsertJsonLd('aylen-schema-store', {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: cfg.brand || 'AYLENSALE',
      description: (cfg.seo && cfg.seo.description) || cfg.tagline,
      url: absoluteUrl('/'),
      image: absoluteUrl(cfg.defaultOgImage || '/og-image.svg'),
      priceRange: '££',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'GB'
      }
    });
  }

  function refreshProductSchema(productList) {
    var items = (Array.isArray(productList) ? productList : [])
      .filter(function(p) { return p && p.active !== false; })
      .slice(0, 48)
      .map(function(p, index) {
        var price = Number(p.price || p.retail || p.salePrice || 0);
        var image = (p.images && p.images[0]) ? p.images[0] : '';
        return {
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'Product',
            name: String(p.name || 'Product'),
            description: String(p.description || p.desc || '').slice(0, 500),
            image: image ? [image] : undefined,
            sku: p.sku || String(p.id || ''),
            offers: {
              '@type': 'Offer',
              priceCurrency: (site().currency || 'GBP'),
              price: price > 0 ? price.toFixed(2) : undefined,
              availability: (Number(p.stock) > 0)
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              url: absoluteUrl('/#products')
            }
          }
        };
      });

    upsertJsonLd('aylen-schema-products', {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'AYLENSALE Products',
      itemListElement: items
    });
  }

  function init() {
    initBaseMeta();
    initOrganizationSchema();
    if (typeof products !== 'undefined' && Array.isArray(products)) {
      refreshProductSchema(products);
    }
  }

  function onConsentApplied() {
    initBaseMeta();
  }

  global.AYLEN_SEO = {
    init: init,
    refreshProductSchema: refreshProductSchema,
    refreshOrganization: initOrganizationSchema,
    onConsentApplied: onConsentApplied,
    absoluteUrl: absoluteUrl
  };
})(typeof window !== 'undefined' ? window : this);
