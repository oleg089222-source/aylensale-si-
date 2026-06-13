/**
 * Server-side manifest CSV (B2B download via API).
 */
function escapeCsvCell(value) {
  return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
}

export function manifestToCsv(manifest, meta) {
  meta = meta || {};
  const m = manifest || {};
  const rows = [
    ['AYLENSALE Manifest Export'],
    ['Listing', meta.name || ''],
    ['Product ID', meta.productId || meta.auctionId || ''],
    ['SKU', meta.sku || ''],
    ['Grade', meta.grade || ''],
    ['Generated', m.generatedAt || new Date().toISOString()],
    ['Total Units', String(m.totalUnits || 0)],
    ['Total RRP GBP', Number(m.totalRrp || 0).toFixed(2)],
    [],
    ['SKU', 'Title', 'Qty', 'RRP GBP', 'Grade', 'Condition']
  ];
  (Array.isArray(m.lines) ? m.lines : []).forEach((line) => {
    rows.push([
      line.sku || '',
      line.title || '',
      String(line.qty || 0),
      Number(line.rrp || 0).toFixed(2),
      String(line.grade || '').toUpperCase(),
      line.condition || ''
    ]);
  });
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}
