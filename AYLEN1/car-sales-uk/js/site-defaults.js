/**
 * Default site content for Legal & Contact (used when Firestore has no published data).
 */
(function(global) {
  var WHATSAPP_DEFAULT = 'https://wa.me/?text=Hi%20AYLENSALE!%20I%27m%20interested%20in%20your%20wholesale%20stock%20and%20weekend%20car%20boot%20deals.%20Please%20send%20availability%20and%20prices.%20Thank%20you!';

  var LEGAL_BODY = {
    privacy: '<p>AYLENSALE ("we", "us", "our") respects your privacy and processes personal data in accordance with UK GDPR and the Data Protection Act 2018.</p>' +
      '<h2>Who we are</h2><p>Data controller: AYLENSALE<br>Contact: <a href="mailto:contact@aylensale.com">contact@aylensale.com</a><br>Country: United Kingdom</p>' +
      '<h2>What data we collect</h2><ul><li>Name, phone number and order details when you place an order</li><li>Client card codes and discount information linked to your purchases</li><li>Notification preferences (email, Telegram, WhatsApp) for stock alerts</li><li>Technical data: device type, browser, approximate usage analytics (with consent)</li><li>Messages sent via Telegram/WhatsApp when you contact us</li></ul>' +
      '<h2>How we use your data</h2><ul><li>To process orders and arrange pickup or delivery</li><li>To manage auctions, bids and customer accounts</li><li>To send service messages and stock notifications you request</li><li>To prevent fraud, spam and abuse</li><li>To improve our website and marketplace (analytics, with consent)</li></ul>' +
      '<h2>Legal bases</h2><p>We rely on contract performance, legitimate interests (security, fraud prevention, business operations), legal obligations, and consent where required (e.g. non-essential cookies and marketing).</p>' +
      '<h2>Sharing your data</h2><p>We use trusted processors including hosting (Vercel), database/storage (Google Firebase), and messaging providers (e.g. Telegram). We do not sell your personal data.</p>' +
      '<h2>International transfers</h2><p>Some providers may process data outside the UK. Where this occurs, we use appropriate safeguards such as UK IDTA/adequacy decisions or standard contractual clauses.</p>' +
      '<h2>Retention</h2><p>We keep order and customer records as long as needed for legal, tax and business purposes, then delete or anonymise them.</p>' +
      '<h2>Your rights</h2><p>You may request access, rectification, erasure, restriction, portability, or object to processing. You may withdraw consent at any time. You may complain to the ICO (ico.org.uk).</p>' +
      '<h2>Cookies</h2><p>See our <a href="/cookie-policy.html">Cookie Policy</a> for details and preference controls.</p>',
    terms: '<p>These terms govern your use of aylensale.com and purchases from AYLENSALE. By using our website you agree to these terms.</p>' +
      '<h2>About us</h2><p>AYLENSALE operates a UK-based warehouse marketplace for Amazon returns, wholesale lots, retail sales, auctions and car boot pickup points.</p>' +
      '<h2>Orders &amp; contract</h2><p>A contract is formed when we confirm your order. We may refuse or cancel orders for stock errors, pricing mistakes, suspected fraud or abuse.</p>' +
      '<h2>Pricing &amp; payment</h2><p>Prices are shown in GBP unless stated otherwise. Wholesale and card discounts apply only when valid codes are used. You are responsible for providing accurate contact and pickup details.</p>' +
      '<h2>Pickup &amp; delivery</h2><p>Pickup times and locations are shown on the website. You must collect within the stated window unless agreed otherwise. Risk passes on collection or delivery completion.</p>' +
      '<h2>Auctions</h2><p>Auction terms, highest bidder rules and collection deadlines are shown on each listing. Unpaid or uncollected auction wins may be cancelled and relisted.</p>' +
      '<h2>Product condition</h2><p>Many items are returns, job lots or graded stock. Descriptions and photos are provided in good faith. Please inspect at pickup where possible.</p>' +
      '<h2>Consumer rights (UK)</h2><p>If you are a consumer, you have legal rights under the Consumer Rights Act 2015, including rights relating to faulty goods and misdescription. Nothing in these terms limits those statutory rights. See our <a href="/returns-policy.html">Returns Policy</a>.</p>' +
      '<h2>Liability</h2><p>We do not exclude liability for death or personal injury caused by negligence, fraud, or any liability that cannot be excluded by law. Otherwise our liability is limited to the price paid for the relevant order.</p>' +
      '<h2>Website use</h2><p>You must not misuse the site, attempt unauthorised access, scrape content, or interfere with security features. Admin areas are restricted to authorised users.</p>' +
      '<h2>Contact</h2><p><a href="mailto:contact@aylensale.com">contact@aylensale.com</a></p>',
    returns: '<p>We want you to shop with confidence. This policy works alongside your statutory rights under UK consumer law.</p>' +
      '<h2>Your statutory rights</h2><p>If you are a UK consumer, goods must be as described, of satisfactory quality and fit for purpose. You may be entitled to a repair, replacement or refund depending on the issue and timing.</p>' +
      '<h2>Returns &amp; job lots</h2><p>Many products are sold as returns, pallets or mixed job lots. Where stated, items may be sold with limited returns except where faulty or not as described. Clear photos and descriptions are provided before purchase.</p>' +
      '<h2>Faulty or misdescribed items</h2><p>Contact us promptly at <a href="mailto:support@aylensale.com">support@aylensale.com</a> with your order details and photos. We will review fair resolutions including partial credit, replacement where possible, or refund.</p>' +
      '<h2>Collection &amp; missed pickups</h2><p>If you miss an agreed pickup window, we may charge storage or relist stock. Auction and clearance items may be non-returnable once collected.</p>' +
      '<h2>How to request a return</h2><ul><li>Email support with order reference, phone number and issue description</li><li>Do not dispose of packaging until we confirm next steps</li><li>Return shipping may be your responsibility unless we agree otherwise</li></ul>' +
      '<h2>Refunds</h2><p>Approved refunds are issued to the original payment method where possible within a reasonable period. B2B/wholesale orders may be subject to separate commercial terms.</p>',
    cookies: '<p>This policy explains how AYLENSALE uses cookies and similar technologies on our website.</p>' +
      '<h2>What are cookies?</h2><p>Cookies are small text files stored on your device. They help websites function, remember preferences and understand usage.</p>' +
      '<h2>How we use cookies</h2><ul><li><strong>Strictly necessary</strong> — security, cart/session features, fraud prevention (always on)</li><li><strong>Analytics</strong> — Google Analytics to understand traffic and improve performance (only with consent)</li><li><strong>Functional</strong> — saved preferences such as cookie choices</li></ul>' +
      '<h2>Managing preferences</h2><p>When you first visit, you can accept all cookies, accept essential only, or choose analytics. You can reopen preferences from the website footer ("Cookie settings").</p>' +
      '<h2>Third parties</h2><p>We may use Google (Analytics, Firebase), Vercel (hosting) and messaging platforms. Their policies apply to their services.</p>' +
      '<h2>Contact</h2><p>Questions: <a href="mailto:contact@aylensale.com">contact@aylensale.com</a></p>'
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    Object.keys(source).forEach(function(key) {
      var val = source[key];
      if (val && typeof val === 'object' && !Array.isArray(val) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        deepMerge(target[key], val);
      } else if (val !== undefined) {
        target[key] = val;
      }
    });
    return target;
  }

  function getDefaultLegalContactContent() {
    return {
      contact: {
        contactEmail: 'contact@aylensale.com',
        supportEmail: 'support@aylensale.com',
        telegramUrl: 'https://t.me/aylensale',
        whatsappUrl: WHATSAPP_DEFAULT,
        phone: '',
        regionLabel: 'United Kingdom · GBP · English (UK)'
      },
      business: {
        legalName: 'AYLENSALE',
        companyNumber: '',
        vatNumber: '',
        registeredAddress: 'United Kingdom',
        businessEmail: 'contact@aylensale.com'
      },
      footer: {
        brandDescription: 'UK warehouse marketplace for Amazon returns, wholesale electronics, live auctions and weekend car boot pickup points.',
        consumerRightsHtml: 'UK Consumer Rights apply. <a href="/returns-policy.html">Returns Policy</a>',
        returnsText: '',
        copyrightName: 'AYLENSALE',
        tagline: 'Built for UK & international visitors'
      },
      legal: {
        privacy: {
          title: 'Privacy Policy',
          updated: 'Last updated: May 2026',
          notice: 'Template notice: This policy should be reviewed by a qualified UK legal adviser before relying on it for regulatory compliance.',
          bodyHtml: LEGAL_BODY.privacy
        },
        terms: {
          title: 'Terms & Conditions',
          updated: 'Last updated: May 2026',
          notice: 'Template notice: Review with a UK legal adviser. Your customers\' statutory rights are not affected.',
          bodyHtml: LEGAL_BODY.terms
        },
        returns: {
          title: 'Returns & Refunds Policy',
          updated: 'Last updated: May 2026',
          notice: 'Template notice: Align this policy with your actual inspection, refund and collection procedures.',
          bodyHtml: LEGAL_BODY.returns
        },
        cookies: {
          title: 'Cookie Policy',
          updated: 'Last updated: May 2026',
          notice: '',
          bodyHtml: LEGAL_BODY.cookies
        }
      },
      cookie: {
        bannerTitle: 'Cookies & privacy',
        bannerBodyHtml: 'We use essential cookies to run the site and optional analytics to improve AYLENSALE. See our <a href="/cookie-policy.html">Cookie Policy</a> and <a href="/privacy-policy.html">Privacy Policy</a>.',
        analyticsLabel: 'Analytics cookies (Google Analytics)',
        settingsLinkText: 'Cookie settings'
      }
    };
  }

  global.SITE_LEGAL_DEFAULTS = {
    getDefaultLegalContactContent: getDefaultLegalContactContent,
    cloneLegalContactContent: function(override) {
      return deepMerge(getDefaultLegalContactContent(), clone(override || {}));
    },
    deepMergeLegalContact: deepMerge,
    clone: clone
  };
})(typeof window !== 'undefined' ? window : this);
