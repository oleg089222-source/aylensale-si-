/**
 * AYLENSALE — site-wide business, SEO & analytics configuration.
 * Update legal/contact details here before production launch.
 */
(function(global) {
  var origin = '';
  try {
    origin = global.location && global.location.origin ? global.location.origin : '';
  } catch (e) {}

  var config = {
    brand: 'AYLENSALE',
    legalName: 'AYLENSALE',
    tagline: 'UK warehouse marketplace for Amazon returns, wholesale & car boot deals',
    siteUrl: origin || 'https://aylensale.com',
    locale: 'en-GB',
    region: 'GB',
    currency: 'GBP',
    contactEmail: 'contact@aylensale.com',
    supportEmail: 'support@aylensale.com',
    phone: '',
    address: {
      line1: 'United Kingdom',
      locality: '',
      region: '',
      postalCode: '',
      country: 'GB'
    },
    companyNumber: '',
    vatNumber: '',
    defaultOgImage: '/og-image.svg',
    twitterHandle: '@aylensale',
    analytics: {
      googleAnalyticsId: 'G-8XWD4DQFDX',
      googleSearchConsoleVerification: '',
      googleTagManagerId: ''
    },
    seo: {
      title: 'AYLENSALE | UK Amazon Returns, Wholesale & Car Boot Deals',
      description: 'Shop Amazon returns, wholesale electronics and weekend car boot pickup deals across the UK. Live auctions, pickup points, retail & trade prices from AYLENSALE.',
      keywords: 'Amazon returns UK, wholesale electronics, car boot deals, warehouse marketplace, AYLENSALE, UK pickup'
    },
    consumerRightsNote: 'Your statutory rights under UK consumer law are not affected by our terms.',
    cookiePolicyVersion: '1.0',
    features: {
      pwa: true,
      internationalVisitors: true,
      futureAccounts: true,
      futureMerchant: true
    }
  };

  global.AYLEN_SITE = config;
})(typeof window !== 'undefined' ? window : this);
