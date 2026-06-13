/**
 * Dynamic PWA manifest (Firestore branding icons + static fallback).
 */
import { loadBrandingDoc } from './branding-store.mjs';

const STATIC_MANIFEST = {
  id: '/',
  name: 'AYLENSALE — UK Warehouse Marketplace',
  short_name: 'AYLENSALE',
  description: 'Amazon returns, wholesale electronics, live auctions and UK car boot pickup deals.',
  start_url: '/?source=pwa',
  scope: '/',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui', 'browser'],
  orientation: 'any',
  background_color: '#070a14',
  theme_color: '#070a14',
  lang: 'en-GB',
  dir: 'ltr',
  categories: ['shopping', 'business'],
  prefer_related_applications: false
};

function iconEntry(src, sizes, purpose) {
  return { src, sizes, type: 'image/png', purpose: purpose || 'any' };
}

function buildIcons(branding) {
  if (!branding || !branding.icons) return null;
  const i = branding.icons;
  const v = branding.cacheVersion || 1;
  const q = '?v=' + v;
  const bump = function(url) {
    if (!url) return url;
    return url.indexOf('?') >= 0 ? url + '&v=' + v : url + q;
  };
  const list = [];
  if (i['icon-192']) list.push(iconEntry(bump(i['icon-192']), '192x192', 'any'));
  if (i['icon-512']) list.push(iconEntry(bump(i['icon-512']), '512x512', 'any'));
  if (i['maskable-192']) list.push(iconEntry(bump(i['maskable-192']), '192x192', 'maskable'));
  if (i['maskable-512']) list.push(iconEntry(bump(i['maskable-512']), '512x512', 'maskable'));
  if (i['apple-touch-icon']) list.push(iconEntry(bump(i['apple-touch-icon']), '180x180', 'any'));
  return list.length ? list : null;
}

const FALLBACK_ICONS = [
  iconEntry('/icon-192.png', '192x192', 'any'),
  iconEntry('/icon-512.png', '512x512', 'any'),
  iconEntry('/maskable-192.png', '192x192', 'maskable'),
  iconEntry('/maskable-512.png', '512x512', 'maskable'),
  iconEntry('/apple-touch-icon.png', '180x180', 'any')
];

export async function servePwaManifest(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let branding = null;
    try {
      branding = await loadBrandingDoc();
    } catch (e) {
      console.warn('[manifest] branding load skipped:', e.message);
    }

    const icons = buildIcons(branding);
    const shortcutIcon = icons && icons[0] ? icons[0].src : '/icon-192.png';

    const manifest = Object.assign({}, STATIC_MANIFEST, {
      background_color: (branding && branding.backgroundColor) || STATIC_MANIFEST.background_color,
      theme_color: (branding && branding.themeColor) || STATIC_MANIFEST.theme_color,
      icons: icons || FALLBACK_ICONS,
      shortcuts: [
        { name: 'Shop products', short_name: 'Products', url: '/#products', icons: [{ src: shortcutIcon, sizes: '192x192', type: 'image/png' }] },
        { name: 'Pickup points', short_name: 'Pickup', url: '/#pickup', icons: [{ src: shortcutIcon, sizes: '192x192', type: 'image/png' }] }
      ]
    });

    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    return res.status(200).json(manifest);
  } catch (err) {
    console.error('[manifest]', err);
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    return res.status(200).json(Object.assign({}, STATIC_MANIFEST, { icons: FALLBACK_ICONS }));
  }
}
