/**
 * GET /api/geocode-postcode?postcode=SW1A1AA
 * UK postcode → lat/lng proxy (avoids client-side fetch blocks).
 */
const ipBuckets = new Map();

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function rateOk(key, max, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const prev = (ipBuckets.get(key) || []).filter(function(t) { return t > cutoff; });
  if (prev.length >= max) {
    ipBuckets.set(key, prev);
    return false;
  }
  prev.push(now);
  ipBuckets.set(key, prev);
  return true;
}

function normalizePostcode(raw) {
  var s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length < 5 || s.length > 8) return '';
  if (s.length > 3) {
    return s.slice(0, -3) + ' ' + s.slice(-3);
  }
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);
  if (!rateOk('geo:' + ip, 40, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const clean = normalizePostcode(req.query?.postcode || req.query?.pc || '');
  if (!clean) {
    return res.status(400).json({ error: 'Invalid postcode' });
  }

  const tries = [clean, clean.replace(/\s/g, '')];
  for (let i = 0; i < tries.length; i++) {
    try {
      const url = 'https://api.postcodes.io/postcodes/' + encodeURIComponent(tries[i]);
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) continue;
      const data = await response.json();
      if (data && data.result) {
        return res.status(200).json({
          lat: Number(data.result.latitude),
          lng: Number(data.result.longitude),
          postcode: data.result.postcode || clean
        });
      }
    } catch (error) {
      console.warn('geocode-postcode proxy failed:', tries[i], error.message || error);
    }
  }

  return res.status(404).json({ error: 'Postcode not found' });
}
