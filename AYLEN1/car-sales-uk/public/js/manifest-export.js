/**
 * Manifest CSV export for B2B buyers (pallet / job lot listings).
 */
(function(global) {
  function escapeCsvCell(value) {
    return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  }

  function manifestToCsvRows(manifest, meta) {
    meta = meta || {};
    var m = manifest || {};
    var rows = [
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
    (Array.isArray(m.lines) ? m.lines : []).forEach(function(line) {
      rows.push([
        line.sku || '',
        line.title || '',
        String(line.qty || 0),
        Number(line.rrp || 0).toFixed(2),
        String(line.grade || '').toUpperCase(),
        line.condition || ''
      ]);
    });
    return rows;
  }

  function manifestToCsvString(manifest, meta) {
    var rows = manifestToCsvRows(manifest, meta);
    return rows.map(function(row) {
      return row.map(escapeCsvCell).join(',');
    }).join('\n');
  }

  function safeFilenamePart(str) {
    return String(str || 'manifest').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || 'manifest';
  }

  function downloadManifestCsv(manifest, options) {
    options = options || {};
    if (!manifest || !Array.isArray(manifest.lines) || !manifest.lines.length) {
      if (typeof global.notify === 'function') global.notify('No manifest to export', 'info');
      return false;
    }
    var csv = '\ufeff' + manifestToCsvString(manifest, {
      name: options.name,
      sku: options.sku,
      grade: options.grade,
      productId: options.productId,
      auctionId: options.auctionId
    });
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = options.filename ||
      ('aylensale-manifest-' + safeFilenamePart(options.sku || options.productId || options.name) + '.csv');
    link.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
    if (typeof global.notify === 'function') global.notify('Manifest CSV downloaded', 'success');
    return true;
  }

  global.manifestToCsvString = manifestToCsvString;
  global.downloadManifestCsv = downloadManifestCsv;
  global.AYLEN_MANIFEST_EXPORT = {
    manifestToCsvRows: manifestToCsvRows,
    manifestToCsvString: manifestToCsvString,
    downloadManifestCsv: downloadManifestCsv
  };
})(typeof window !== 'undefined' ? window : this);
