/**
 * Admin — visit cards: QR, code, print-ready PNG/PDF.
 */
(function(global) {
  var CARD_W = 1004;
  var CARD_H = 650;
  var QR_LIB = '/js/vendor/qrcode.browser.min.js';
  var PDF_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
  var DEFAULT_LOGO = '/install-app-icon.jpeg';
  var DESIGN_KEY = 'aylen_vc_design_v8';
  var STANDARD_PRESET = {
    bgMode: 'site',
    cardStyle: 'classic-pink',
    bgColorSolid: '#070a14',
    bgColorTop: '#070a14',
    bgColorMid: '#0d1324',
    bgColorBottom: '#070a14',
    glowPink: '#e94560',
    glowBlue: '#0064d2',
    brandAccent: '#ff4f83',
    brandLight: '#ffd6e2',
    frontBgMode: 'default',
    frontBgImageUrl: '',
    frontBgOverlay: 35,
    backBgMode: 'default',
    backBgImageUrl: '',
    backBgOverlay: 35,
    frontLogoUrl: '/install-app-icon.jpeg',
    frontLogoSize: 88,
    frontLogoOpacity: 100,
    frontLogoEnabled: true,
    frontLogoOffsetX: 0,
    frontLogoOffsetY: 0,
    backLogoUrl: '',
    backLogoSize: 240,
    backLogoOpacity: 12,
    backLogoEnabled: true,
    backLogoPos: 'center',
    backLogoOffsetX: 0,
    backLogoOffsetY: 0,
    qrSize: 200,
    qrPos: 'br',
    qrOffsetX: 0,
    qrOffsetY: 0,
    backEbayEnabled: true,
    backEbayUrl: '',
    backEbayQrSize: 88,
    backContactPhone: '',
    backWhatsappPhone: '',
    backTelegramUrl: ''
  };

  function buildStyle(id, name, tag, frame, light, codeMode, colors) {
    return {
      id: id,
      name: name,
      tag: tag,
      frame: frame || 'standard',
      light: !!light,
      codeMode: codeMode || 'plain',
      preset: Object.assign({}, STANDARD_PRESET, colors || {}, { cardStyle: id })
    };
  }

  var CARD_STYLES = [
    buildStyle('classic-pink', 'Classic Pink', 'Signature', 'double', false, 'plain', {}),
    buildStyle('midnight-blue', 'Midnight Blue', 'Executive', 'minimal', false, 'plain', {
      bgColorTop: '#080f1c', bgColorMid: '#0c1a32', bgColorBottom: '#060b14',
      glowPink: '#1d4ed8', glowBlue: '#60a5fa', brandAccent: '#93c5fd', brandLight: '#dbeafe'
    }),
    buildStyle('warehouse-orange', 'Copper Bronze', 'Industrial luxe', 'standard', false, 'plain', {
      bgColorTop: '#141008', bgColorMid: '#1f1810', bgColorBottom: '#100c08',
      glowPink: '#b45309', glowBlue: '#d97706', brandAccent: '#d4a574', brandLight: '#fde8c8'
    }),
    buildStyle('clean-paper', 'Clean Paper', 'Editorial', 'light', true, 'plain', {
      bgMode: 'color', bgColorSolid: '#f8f6f3',
      bgColorTop: '#ffffff', bgColorMid: '#faf9f7', bgColorBottom: '#ece8e2',
      glowPink: '#e94560', glowBlue: '#64748b', brandAccent: '#1e293b', brandLight: '#64748b'
    }),
    buildStyle('emerald-tech', 'Emerald Tech', 'Refined green', 'minimal', false, 'plain', {
      bgColorTop: '#040f0c', bgColorMid: '#0a1a14', bgColorBottom: '#030a08',
      glowPink: '#059669', glowBlue: '#34d399', brandAccent: '#6ee7b7', brandLight: '#a7f3d0'
    }),
    buildStyle('burgundy', 'Burgundy', 'Premium dark', 'double', false, 'plain', {
      bgColorTop: '#120810', bgColorMid: '#1a0c14', bgColorBottom: '#0e060c',
      glowPink: '#9f1239', glowBlue: '#be123c', brandAccent: '#fb7185', brandLight: '#fecdd3'
    }),
    buildStyle('steel-mono', 'Platinum', 'Monochrome', 'minimal', false, 'plain', {
      bgColorTop: '#0c0c0e', bgColorMid: '#161618', bgColorBottom: '#08080a',
      glowPink: '#71717a', glowBlue: '#a1a1aa', brandAccent: '#e4e4e7', brandLight: '#fafafa'
    }),
    buildStyle('electric-purple', 'Royal Violet', 'Modern luxe', 'standard', false, 'plain', {
      bgColorTop: '#0c0618', bgColorMid: '#140a24', bgColorBottom: '#080410',
      glowPink: '#7c3aed', glowBlue: '#a78bfa', brandAccent: '#c4b5fd', brandLight: '#ede9fe'
    }),
    buildStyle('ocean-teal', 'Ocean Teal', 'Coastal', 'stripe', false, 'plain', {
      bgColorTop: '#031014', bgColorMid: '#081c24', bgColorBottom: '#020c10',
      glowPink: '#0d9488', glowBlue: '#22d3ee', brandAccent: '#5eead4', brandLight: '#ccfbf1'
    }),
    buildStyle('high-contrast', 'Champagne Gold', 'Luxury accent', 'double', false, 'plain', {
      bgMode: 'color', bgColorSolid: '#0a0a0a',
      bgColorTop: '#0a0a0a', bgColorMid: '#121212', bgColorBottom: '#060606',
      glowPink: '#a8842a', glowBlue: '#c9a227', brandAccent: '#d4af37', brandLight: '#f5e6b8'
    })
  ];

  var DEFAULT_DESIGN_RAW = Object.assign({
    frontBgImageDataUrl: null,
    backBgImageDataUrl: null,
    frontLogoDataUrl: null,
    backLogoDataUrl: null
  }, STANDARD_PRESET);
  var DEFAULT_DESIGN;
  var state = {
    code: '',
    design: null,
    panelMount: null,
    frontCanvas: null,
    backCanvas: null,
    lastFrontDataUrl: null,
    lastBackDataUrl: null
  };

  function migrateLegacyDesign(raw) {
    if (!raw || typeof raw !== 'object') return raw;
    var d = Object.assign({}, raw);
    if (d.bgImageUrl && !d.frontBgImageUrl) {
      d.frontBgImageUrl = d.bgImageUrl;
      if (d.bgMode === 'blend') d.frontBgMode = 'blend';
      else if (d.bgMode === 'photo') d.frontBgMode = 'photo';
    }
    if (d.bgOverlay != null && d.frontBgOverlay == null) {
      d.frontBgOverlay = d.bgOverlay;
    }
    if (d.bgMode === 'photo' || d.bgMode === 'blend') d.bgMode = 'site';
    if (d.logoSize != null && d.frontLogoSize == null) {
      d.frontLogoSize = d.logoSize;
      d.frontLogoOpacity = d.logoOpacity != null ? d.logoOpacity : 100;
    }
    if (d.backLogoSize == null && d.logoSize != null) {
      d.backLogoSize = Math.round(Number(d.logoSize) * 2.4) || 240;
      d.backLogoOpacity = Math.round((Number(d.logoOpacity) || 100) * 0.12) || 12;
    }
    return d;
  }

  function sideLogoDefaults(side) {
    var base = DEFAULT_DESIGN || STANDARD_PRESET;
    var p = side === 'back' ? 'back' : 'front';
    return {
      url: base[p + 'LogoUrl'] || DEFAULT_LOGO,
      size: base[p + 'LogoSize'] != null ? base[p + 'LogoSize'] : (side === 'back' ? 240 : 88),
      opacity: base[p + 'LogoOpacity'] != null ? base[p + 'LogoOpacity'] : (side === 'back' ? 12 : 100),
      enabled: base[p + 'LogoEnabled'] !== false,
      offsetX: base[p + 'LogoOffsetX'] || 0,
      offsetY: base[p + 'LogoOffsetY'] || 0,
      pos: side === 'back' ? (base.backLogoPos || 'center') : 'header'
    };
  }

  function cloneDesign(src) {
    var d = migrateLegacyDesign(src || DEFAULT_DESIGN_RAW);
    var def = DEFAULT_DESIGN || DEFAULT_DESIGN_RAW;
    var front = sideLogoDefaults('front');
    var back = sideLogoDefaults('back');
    return {
      bgMode: d.bgMode === 'color' ? 'color' : 'site',
      bgColorSolid: normalizeHex(d.bgColorSolid, def.bgColorSolid),
      bgColorTop: normalizeHex(d.bgColorTop, def.bgColorTop),
      bgColorMid: normalizeHex(d.bgColorMid, def.bgColorMid),
      bgColorBottom: normalizeHex(d.bgColorBottom, def.bgColorBottom),
      glowPink: normalizeHex(d.glowPink, def.glowPink),
      glowBlue: normalizeHex(d.glowBlue, def.glowBlue),
      brandAccent: normalizeHex(d.brandAccent, def.brandAccent),
      brandLight: normalizeHex(d.brandLight, def.brandLight),
      frontBgMode: d.frontBgMode || 'default',
      frontBgImageUrl: d.frontBgImageUrl || '',
      frontBgImageDataUrl: d.frontBgImageDataUrl || null,
      frontBgOverlay: typeof d.frontBgOverlay === 'number' ? d.frontBgOverlay : 35,
      backBgMode: d.backBgMode || 'default',
      backBgImageUrl: d.backBgImageUrl || '',
      backBgImageDataUrl: d.backBgImageDataUrl || null,
      backBgOverlay: typeof d.backBgOverlay === 'number' ? d.backBgOverlay : 35,
      frontLogoUrl: d.frontLogoUrl || front.url,
      frontLogoDataUrl: d.frontLogoDataUrl || null,
      frontLogoSize: typeof d.frontLogoSize === 'number' ? d.frontLogoSize : front.size,
      frontLogoOpacity: typeof d.frontLogoOpacity === 'number' ? d.frontLogoOpacity : front.opacity,
      frontLogoEnabled: d.frontLogoEnabled !== false,
      frontLogoOffsetX: typeof d.frontLogoOffsetX === 'number' ? d.frontLogoOffsetX : 0,
      frontLogoOffsetY: typeof d.frontLogoOffsetY === 'number' ? d.frontLogoOffsetY : 0,
      backLogoUrl: d.backLogoUrl != null ? d.backLogoUrl : '',
      backLogoDataUrl: d.backLogoDataUrl || null,
      backLogoSize: typeof d.backLogoSize === 'number' ? d.backLogoSize : back.size,
      backLogoOpacity: typeof d.backLogoOpacity === 'number' ? d.backLogoOpacity : back.opacity,
      backLogoEnabled: d.backLogoEnabled !== false,
      backLogoPos: d.backLogoPos || back.pos,
      backLogoOffsetX: typeof d.backLogoOffsetX === 'number' ? d.backLogoOffsetX : 0,
      backLogoOffsetY: typeof d.backLogoOffsetY === 'number' ? d.backLogoOffsetY : 0,
      qrSize: typeof d.qrSize === 'number' ? d.qrSize : 200,
      qrPos: d.qrPos || 'br',
      qrOffsetX: typeof d.qrOffsetX === 'number' ? d.qrOffsetX : 0,
      qrOffsetY: typeof d.qrOffsetY === 'number' ? d.qrOffsetY : 0,
      cardStyle: resolveStyleId(d.cardStyle || def.cardStyle),
      backEbayEnabled: d.backEbayEnabled !== false,
      backEbayUrl: d.backEbayUrl != null ? String(d.backEbayUrl) : '',
      backEbayQrSize: typeof d.backEbayQrSize === 'number' ? d.backEbayQrSize : 88,
      backContactPhone: d.backContactPhone != null ? String(d.backContactPhone) : '',
      backWhatsappPhone: d.backWhatsappPhone != null ? String(d.backWhatsappPhone) : '',
      backTelegramUrl: d.backTelegramUrl != null ? String(d.backTelegramUrl) : ''
    };
  }

  function resolveStyleId(id) {
    id = String(id || 'classic-pink');
    for (var i = 0; i < CARD_STYLES.length; i++) {
      if (CARD_STYLES[i].id === id) return id;
    }
    return 'classic-pink';
  }

  function getCardStyle() {
    var id = resolveStyleId(state.design && state.design.cardStyle);
    for (var i = 0; i < CARD_STYLES.length; i++) {
      if (CARD_STYLES[i].id === id) return CARD_STYLES[i];
    }
    return CARD_STYLES[0];
  }

  function getUiColors(style) {
    style = style || getCardStyle();
    if (style.light) {
      return {
        brandSub: '#64748b',
        tagline: state.design.brandAccent,
        name: '#1e293b',
        label: '#64748b',
        code: '#0f172a',
        hint: '#64748b',
        footer: '#94a3b8',
        body: 'rgba(30, 41, 59, 0.88)',
        backFooter: '#94a3b8'
      };
    }
    return {
      brandSub: 'rgba(255, 255, 255, 0.62)',
      tagline: 'rgba(255, 210, 225, 0.72)',
      name: 'rgba(255, 240, 245, 0.96)',
      label: 'rgba(186, 196, 210, 0.88)',
      code: '#ffffff',
      hint: 'rgba(148, 163, 184, 0.78)',
      footer: 'rgba(255, 255, 255, 0.48)',
      body: 'rgba(255, 255, 255, 0.82)',
      backFooter: 'rgba(255, 255, 255, 0.4)',
      accent: state.design.brandAccent
    };
  }

  DEFAULT_DESIGN = cloneDesign(DEFAULT_DESIGN_RAW);
  state.design = cloneDesign(DEFAULT_DESIGN);

  function normalizeHex(value, fallback) {
    var s = String(value || fallback || '#070a14').trim();
    if (/^[0-9a-fA-F]{6}$/.test(s)) s = '#' + s;
    if (!/^#[0-9a-fA-F]{6}$/.test(s)) return fallback || '#070a14';
    return s.toLowerCase();
  }

  function hexToRgba(hex, alpha) {
    var h = normalizeHex(hex, '#000000').slice(1);
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function setLetterSpacing(ctx, value) {
    try { ctx.letterSpacing = value; } catch (e) {}
  }

  function resetLetterSpacing(ctx) {
    try { ctx.letterSpacing = '0px'; } catch (e) {}
  }

  function drawInnerFrameHighlight(ctx, x, y, w, h, r, style) {
    if (style.frame === 'bold') return;
    ctx.save();
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(8, r - 2));
    ctx.strokeStyle = hexToRgba('#ffffff', style.light ? 0.42 : 0.09);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawCardVignette(ctx, style) {
    ctx.save();
    roundRect(ctx, 12, 12, CARD_W - 24, CARD_H - 24, 18);
    ctx.clip();
    var strength = style.light ? 0.05 : 0.26;
    var v = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, CARD_W * 0.12, CARD_W / 2, CARD_H / 2, CARD_W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.restore();
  }

  function drawCornerAccents(ctx, style) {
    if (style.frame === 'stripe') return;
    var pal = state.design;
    var len = style.frame === 'minimal' ? 22 : 28;
    var inset = 22;
    var color = hexToRgba(pal.brandLight, style.light ? 0.65 : 0.42);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'square';
    function corner(x1, y1, x2, y2, x3, y3) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.stroke();
    }
    corner(inset, inset + len, inset, inset, inset + len, inset);
    corner(CARD_W - inset - len, inset, CARD_W - inset, inset, CARD_W - inset, inset + len);
    corner(inset, CARD_H - inset - len, inset, CARD_H - inset, inset + len, CARD_H - inset);
    corner(CARD_W - inset - len, CARD_H - inset, CARD_W - inset, CARD_H - inset, CARD_W - inset, CARD_H - inset - len);
  }

  function drawLuxuryDivider(ctx, x, y, w, style) {
    if (w < 48) return;
    var pal = state.design;
    var cx = x + w / 2;
    var g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, hexToRgba(pal.brandAccent, 0));
    g.addColorStop(0.4, hexToRgba(pal.brandLight, style.light ? 0.5 : 0.32));
    g.addColorStop(0.6, hexToRgba(pal.brandAccent, style.light ? 0.45 : 0.5));
    g.addColorStop(1, hexToRgba(pal.brandAccent, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.fillStyle = hexToRgba(pal.brandAccent, 0.85);
    ctx.beginPath();
    ctx.moveTo(cx, y - 3);
    ctx.lineTo(cx + 3, y);
    ctx.lineTo(cx, y + 3);
    ctx.lineTo(cx - 3, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawSmallCapsLabel(ctx, text, x, y, color) {
    ctx.fillStyle = color;
    ctx.font = '600 11px system-ui, sans-serif';
    setLetterSpacing(ctx, '0.22em');
    ctx.fillText(String(text || '').toUpperCase(), x, y);
    resetLetterSpacing(ctx);
  }

  function drawSmallCapsLabelCentered(ctx, text, centerX, y, color) {
    ctx.font = '600 11px system-ui, sans-serif';
    setLetterSpacing(ctx, '0.18em');
    var label = String(text || '').toUpperCase();
    var w = ctx.measureText(label).width;
    resetLetterSpacing(ctx);
    drawSmallCapsLabel(ctx, label, centerX - w / 2, y, color);
  }

  function drawDiscountBadgeCentered(ctx, text, centerX, y, style, maxWidth) {
    if (!text) return y;
    maxWidth = maxWidth || CARD_W - 104;
    ctx.font = '700 11px system-ui, sans-serif';
    setLetterSpacing(ctx, '0.1em');
    var tw = ctx.measureText(String(text).toUpperCase()).width;
    resetLetterSpacing(ctx);
    var bw = Math.min(tw + 28, maxWidth);
    return drawDiscountBadge(ctx, text, centerX - bw / 2, y, style, maxWidth);
  }

  function drawDiscountBadge(ctx, text, x, y, style, maxWidth) {
    if (!text) return y;
    var pal = state.design;
    maxWidth = maxWidth || CARD_W;
    var label = truncateToWidth(ctx, text.toUpperCase(), maxWidth - 28, '700 11px system-ui, sans-serif', '0.1em');
    ctx.font = '700 11px system-ui, sans-serif';
    setLetterSpacing(ctx, '0.1em');
    var tw = ctx.measureText(label).width;
    resetLetterSpacing(ctx);
    var padX = 14;
    var bw = Math.min(tw + padX * 2, maxWidth);
    var bh = 24;
    roundRect(ctx, x, y, bw, bh, bh / 2);
    var bg = ctx.createLinearGradient(x, y, x + bw, y + bh);
    bg.addColorStop(0, hexToRgba(pal.brandLight, style.light ? 0.28 : 0.18));
    bg.addColorStop(1, hexToRgba(pal.brandAccent, style.light ? 0.12 : 0.14));
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = hexToRgba(pal.brandAccent, 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = style.light ? pal.brandAccent : pal.brandLight;
    ctx.font = '700 11px system-ui, sans-serif';
    setLetterSpacing(ctx, '0.1em');
    ctx.fillText(label, x + padX, y + 16);
    resetLetterSpacing(ctx);
    return y + bh + 10;
  }

  function drawStyleBorder(ctx, style) {
    var pal = state.design;
    var x = 12;
    var y = 12;
    var w = CARD_W - 24;
    var h = CARD_H - 24;
    var r = 18;
    if (style.frame === 'stripe') {
      roundRect(ctx, x, y, w, h, r);
      ctx.strokeStyle = hexToRgba(pal.brandAccent, 0.38);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.save();
      roundRect(ctx, x, y, w, h, r);
      ctx.clip();
      var stripe = ctx.createLinearGradient(x, y, x + w, y);
      stripe.addColorStop(0, hexToRgba(pal.brandLight, 0.95));
      stripe.addColorStop(1, pal.brandAccent);
      ctx.fillStyle = stripe;
      ctx.fillRect(x, y, w, 6);
      ctx.restore();
      ctx.fillStyle = hexToRgba(pal.brandAccent, 0.04);
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      drawInnerFrameHighlight(ctx, x, y, w, h, r, style);
      return;
    }
    if (style.frame === 'double') {
      roundRect(ctx, x, y, w, h, r);
      ctx.strokeStyle = hexToRgba(pal.brandAccent, 0.48);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      roundRect(ctx, x + 6, y + 6, w - 12, h - 12, r - 5);
      ctx.strokeStyle = hexToRgba(pal.brandLight, 0.22);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = hexToRgba(pal.brandAccent, 0.04);
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      drawInnerFrameHighlight(ctx, x, y, w, h, r, style);
      return;
    }
    if (style.frame === 'bold') {
      roundRect(ctx, x, y, w, h, r);
      ctx.strokeStyle = hexToRgba(pal.brandAccent, 0.85);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = hexToRgba(pal.brandAccent, 0.06);
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      return;
    }
    if (style.frame === 'minimal' || style.frame === 'light') {
      roundRect(ctx, x, y, w, h, r);
      ctx.strokeStyle = hexToRgba(pal.brandAccent, style.light ? 0.18 : 0.24);
      ctx.lineWidth = 1;
      ctx.stroke();
      if (!style.light) {
        ctx.fillStyle = hexToRgba(pal.brandAccent, 0.03);
        roundRect(ctx, x, y, w, h, r);
        ctx.fill();
      }
      drawInnerFrameHighlight(ctx, x, y, w, h, r, style);
      return;
    }
    roundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = hexToRgba(pal.brandAccent, 0.32);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = hexToRgba(pal.brandAccent, 0.04);
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    drawInnerFrameHighlight(ctx, x, y, w, h, r, style);
  }

  function drawFrontAccentLine(ctx, style) {
    if (style.frame === 'stripe') return;
    var pal = state.design;
    var y = 32;
    var g = ctx.createLinearGradient(56, 0, CARD_W - 56, 0);
    g.addColorStop(0, hexToRgba(pal.brandAccent, 0));
    g.addColorStop(0.4, hexToRgba(pal.brandLight, style.light ? 0.45 : 0.28));
    g.addColorStop(0.5, hexToRgba(pal.brandAccent, 0.55));
    g.addColorStop(0.6, hexToRgba(pal.brandLight, 0.35));
    g.addColorStop(1, hexToRgba(pal.brandAccent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(56, y, CARD_W - 112, 2);
  }

  function fillBrandTitle(ctx, text, x, y, font, style) {
    ctx.font = font;
    ctx.textAlign = 'left';
    setLetterSpacing(ctx, '0.12em');
    if (style.light) {
      ctx.fillStyle = state.design.brandAccent;
      ctx.fillText(text, x, y);
      resetLetterSpacing(ctx);
      return;
    }
    fillBrandGradientText(ctx, text, x, y, font);
    resetLetterSpacing(ctx);
  }

  function fillBrandTitleCentered(ctx, text, centerX, y, font, style) {
    ctx.font = font;
    ctx.textAlign = 'left';
    setLetterSpacing(ctx, '0.12em');
    var w = ctx.measureText(text).width;
    resetLetterSpacing(ctx);
    fillBrandTitle(ctx, text, centerX - w / 2, y, font, style);
  }

  function drawCodeDisplay(ctx, code, x, topY, style, ui, maxWidth) {
    maxWidth = maxWidth || CARD_W;
    code = truncateToWidth(ctx, code, maxWidth - 32, '700 44px Georgia, "Times New Roman", serif', '0.1em');
    var fit = fitCodeFontSize(ctx, code, maxWidth);
    var fontSize = fit.fontSize;
    var font = fit.font;
    var w = fit.textWidth;
    var boxW = Math.min(w + 32, maxWidth);
    var boxH = fontSize + 26;
    var boxY = topY;
    var yBaseline = topY + fontSize + 4;
    ctx.font = font;
    ctx.textAlign = 'left';
    roundRect(ctx, x - 2, boxY + 2, boxW + 4, boxH, 10);
    ctx.fillStyle = hexToRgba('#000000', style.light ? 0.04 : 0.18);
    ctx.fill();
    roundRect(ctx, x - 14, boxY, boxW, boxH, 10);
    var plate = ctx.createLinearGradient(x, boxY, x, boxY + boxH);
    plate.addColorStop(0, hexToRgba(state.design.brandLight, style.light ? 0.22 : 0.12));
    plate.addColorStop(1, hexToRgba(state.design.brandAccent, style.light ? 0.08 : 0.1));
    ctx.fillStyle = plate;
    ctx.fill();
    ctx.strokeStyle = hexToRgba(state.design.brandAccent, style.light ? 0.4 : 0.48);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = ui.code;
    ctx.font = font;
    setLetterSpacing(ctx, '0.1em');
    ctx.fillText(code, x, yBaseline);
    resetLetterSpacing(ctx);
    return topY + boxH;
  }

  function drawStyledQrFrame(ctx, qrX, qrY, qrSize, style) {
    var pal = state.design;
    var outerPad = 10;
    var ox = qrX - outerPad;
    var oy = qrY - outerPad;
    var ow = qrSize + outerPad * 2;
    roundRect(ctx, ox + 1, oy + 3, ow, ow, 14);
    ctx.fillStyle = hexToRgba('#000000', style.light ? 0.06 : 0.2);
    ctx.fill();
    roundRect(ctx, ox, oy, ow, ow, 14);
    ctx.fillStyle = style.light ? '#ffffff' : hexToRgba('#ffffff', 0.97);
    ctx.fill();
    roundRect(ctx, ox, oy, ow, ow, 14);
    ctx.strokeStyle = hexToRgba(pal.brandAccent, 0.75);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    roundRect(ctx, ox + 2, oy + 2, ow - 4, ow - 4, 12);
    ctx.strokeStyle = hexToRgba(pal.brandLight, style.light ? 0.35 : 0.2);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 6);
    ctx.fill();
  }

  function loadDesignFromStorage() {
    try {
      var raw = localStorage.getItem(DESIGN_KEY) ||
        localStorage.getItem('aylen_vc_design_v7') ||
        localStorage.getItem('aylen_vc_design_v6') ||
        localStorage.getItem('aylen_vc_design_v5') ||
        localStorage.getItem('aylen_vc_design_v4') ||
        localStorage.getItem('aylen_vc_design_v3') ||
        localStorage.getItem('aylen_vc_design_v2') ||
        localStorage.getItem('aylen_vc_design_v1');
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.cardTheme === 'vip' || normalizeHex(parsed.brandAccent, '') === '#d4af37') {
        parsed = Object.assign({}, STANDARD_PRESET, parsed);
      }
      delete parsed.cardTheme;
      state.design = cloneDesign(Object.assign({}, DEFAULT_DESIGN, parsed, {
        frontBgImageDataUrl: null,
        backBgImageDataUrl: null,
        frontLogoDataUrl: null,
        backLogoDataUrl: null
      }));
    } catch (e) {}
  }

  function saveDesignToStorage() {
    try {
      var d = state.design;
      localStorage.setItem(DESIGN_KEY, JSON.stringify({
        bgMode: d.bgMode,
        bgColorSolid: d.bgColorSolid,
        bgColorTop: d.bgColorTop,
        bgColorMid: d.bgColorMid,
        bgColorBottom: d.bgColorBottom,
        glowPink: d.glowPink,
        glowBlue: d.glowBlue,
        brandAccent: d.brandAccent,
        brandLight: d.brandLight,
        frontBgMode: d.frontBgMode,
        frontBgImageUrl: d.frontBgImageUrl,
        frontBgOverlay: d.frontBgOverlay,
        backBgMode: d.backBgMode,
        backBgImageUrl: d.backBgImageUrl,
        backBgOverlay: d.backBgOverlay,
        frontLogoUrl: d.frontLogoUrl,
        frontLogoSize: d.frontLogoSize,
        frontLogoOpacity: d.frontLogoOpacity,
        frontLogoEnabled: d.frontLogoEnabled,
        frontLogoOffsetX: d.frontLogoOffsetX,
        frontLogoOffsetY: d.frontLogoOffsetY,
        backLogoUrl: d.backLogoUrl,
        backLogoSize: d.backLogoSize,
        backLogoOpacity: d.backLogoOpacity,
        backLogoEnabled: d.backLogoEnabled,
        backLogoPos: d.backLogoPos,
        backLogoOffsetX: d.backLogoOffsetX,
        backLogoOffsetY: d.backLogoOffsetY,
        qrSize: d.qrSize,
        qrPos: d.qrPos,
        qrOffsetX: d.qrOffsetX,
        qrOffsetY: d.qrOffsetY,
        cardStyle: d.cardStyle,
        backEbayEnabled: d.backEbayEnabled,
        backEbayUrl: d.backEbayUrl,
        backEbayQrSize: d.backEbayQrSize,
        backContactPhone: d.backContactPhone,
        backWhatsappPhone: d.backWhatsappPhone,
        backTelegramUrl: d.backTelegramUrl
      }));
    } catch (e) {}
  }

  function esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s || '');
  }

  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function lookupCard(code) {
    var key = String(code || '').trim().toUpperCase();
    var cards = global.cardHolders || {};
    if (cards[key]) return cards[key];
    var keys = Object.keys(cards);
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i]).toUpperCase() === key) return cards[keys[i]];
    }
    return {};
  }

  async function loadQrLibrary() {
    if (global.QRCode && typeof global.QRCode.toDataURL === 'function') {
      return global.QRCode;
    }
    var key = 'qrcode';
    document.querySelectorAll('script[data-aylen-vc="' + key + '"]').forEach(function(el) {
      el.remove();
    });

    await new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = QR_LIB + (QR_LIB.indexOf('?') >= 0 ? '&' : '?') + 'v=202606062950';
      s.async = false;
      s.setAttribute('data-aylen-vc', key);
      s.onload = function() {
        if (global.QRCode && typeof global.QRCode.toDataURL === 'function') {
          resolve();
          return;
        }
        reject(new Error('QR library loaded but QRCode API is missing.'));
      };
      s.onerror = function() {
        s.setAttribute('data-aylen-vc-failed', '1');
        reject(new Error('Could not load QR library. Refresh the page and try again.'));
      };
      document.head.appendChild(s);
    });
    return global.QRCode;
  }

  function qrToDataUrl(text, opts) {
    return loadQrLibrary().then(function(QRCode) {
      return new Promise(function(resolve, reject) {
        QRCode.toDataURL(text, opts, function(err, url) {
          if (err) reject(err);
          else resolve(url);
        });
      });
    });
  }

  function loadScriptOnce(src, key) {
    key = key || src;
    return new Promise(function(resolve, reject) {
      if (global.__aylenVcScripts && global.__aylenVcScripts[key]) {
        resolve();
        return;
      }
      if (document.querySelector('script[data-aylen-vc="' + key + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-aylen-vc', key);
      s.onload = function() {
        global.__aylenVcScripts = global.__aylenVcScripts || {};
        global.__aylenVcScripts[key] = true;
        resolve();
      };
      s.onerror = function() { reject(new Error('Could not load ' + src)); };
      document.body.appendChild(s);
    });
  }

  async function ensureCardsLoaded(force) {
    if (!force && global.cardHolders && Object.keys(global.cardHolders).length) return;
    if (!global.FBDB || !global.FBDB.loadCards) return;
    if (global.FBDB.isAdmin && !global.FBDB.isAdmin()) {
      notifyMsg('Admin login required', 'error');
      return;
    }
    try {
      global.cardHolders = await global.FBDB.loadCards();
    } catch (e) {
      global.cardHolders = global.cardHolders || {};
      notifyMsg('Could not load discount codes: ' + (e.message || 'error'), 'error');
    }
  }

  function cardUrl(code) {
    return 'https://aylensale.com/?card=' + encodeURIComponent(String(code || '').trim().toUpperCase());
  }

  function discountLabel(card) {
    if (!card) return '';
    var type = card.discountType || 'percent';
    if (type === 'percent') return Number(card.discountValue || card.discount || 0) + '% OFF';
    if (type === 'fixed') return '£' + Number(card.discountValue || 0).toFixed(2) + ' OFF';
    if (type === 'wholesale') return 'WHOLESALE ACCESS';
    if (type === 'free_delivery') return 'FREE DELIVERY';
    return String(type).replace(/_/g, ' ').toUpperCase();
  }

  function loadImage(src) {
    return new Promise(function(resolve, reject) {
      if (!src) {
        reject(new Error('No image'));
        return;
      }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() { resolve(img); };
      img.onerror = function() { reject(new Error('Logo failed to load')); };
      img.src = src;
    });
  }

  async function resolveLogoSrc(side) {
    side = side === 'back' ? 'back' : 'front';
    var d = state.design;
    var dataKey = side + 'LogoDataUrl';
    var urlKey = side + 'LogoUrl';
    if (d[dataKey]) return d[dataKey];
    var url = String(d[urlKey] || '').trim();
    if (!url && side === 'back') {
      url = String(d.frontLogoUrl || '').trim();
    }
    if (!url) url = DEFAULT_LOGO;
    if (url.indexOf('http') !== 0 && url.indexOf('/') !== 0 && url.indexOf('data:') !== 0) {
      url = '/' + url.replace(/^\.?\//, '');
    }
    return url;
  }

  function getSideLogoConfig(side) {
    side = side === 'back' ? 'back' : 'front';
    var d = state.design;
    var def = side === 'back'
      ? { size: 240, opacity: 12, enabled: true, offsetX: 0, offsetY: 0, pos: 'center' }
      : { size: 88, opacity: 100, enabled: true, offsetX: 0, offsetY: 0, pos: 'header' };
    return {
      enabled: d[side + 'LogoEnabled'] !== false,
      size: Math.max(24, Math.min(320, Number(d[side + 'LogoSize']) || def.size)),
      opacity: Math.max(0, Math.min(100, Number(d[side + 'LogoOpacity']) || def.opacity)),
      offsetX: Number(d[side + 'LogoOffsetX']) || 0,
      offsetY: Number(d[side + 'LogoOffsetY']) || 0,
      pos: side === 'back' ? (d.backLogoPos || 'center') : 'header'
    };
  }

  function getFrontLogoPlace(cfg, textX) {
    return {
      x: textX + cfg.offsetX,
      y: 54 + cfg.offsetY
    };
  }

  function getBackLogoPlace(cfg) {
    var x;
    var y;
    if (cfg.pos === 'top-left') {
      x = 52;
      y = 36;
    } else if (cfg.pos === 'top-center') {
      x = CARD_W / 2 - cfg.size / 2;
      y = 36;
    } else {
      x = CARD_W / 2 - cfg.size / 2;
      y = CARD_H / 2 - cfg.size / 2;
    }
    return { x: x + cfg.offsetX, y: y + cfg.offsetY };
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function resolveEbayStoreUrl() {
    var custom = String(state.design.backEbayUrl || '').trim();
    if (custom) return custom;
    var ebay = global.siteSettings && global.siteSettings.ebay;
    if (ebay && ebay.enabled !== false && ebay.url) return String(ebay.url).trim();
    if (ebay && ebay.url) return String(ebay.url).trim();
    return '';
  }

  function resolveVisitCardContacts() {
    var d = state.design;
    var mp = (global.siteSettings && global.siteSettings.marketplace) || {};
    var lc = (global.siteSettings && global.siteSettings.legalContact) || {};
    var pub = lc.published || lc.draft || {};
    var contact = pub.contact || {};
    var phone = String(d.backContactPhone || contact.phone || '').trim();
    var whatsappPhone = String(d.backWhatsappPhone || '').trim();
    var telegramUrl = String(d.backTelegramUrl || mp.telegramUrl || '').trim();
    if (!whatsappPhone && mp.whatsappUrl) {
      var waMatch = String(mp.whatsappUrl).match(/wa\.me\/(\+?\d+)/);
      if (waMatch) whatsappPhone = waMatch[1].indexOf('+') === 0 ? waMatch[1] : '+' + waMatch[1];
    }
    return { phone: phone, whatsappPhone: whatsappPhone, telegramUrl: telegramUrl };
  }

  function formatTelegramLabel(url) {
    url = String(url || '').trim();
    if (!url) return '';
    var m = url.match(/t\.me\/([^/?#]+)/i);
    return m ? '@' + m[1] : url.replace(/^https?:\/\//i, '');
  }

  function getBackContactLines() {
    var lines = [];
    var c = resolveVisitCardContacts();
    if (c.phone) lines.push(c.phone);
    if (c.whatsappPhone) lines.push('WhatsApp: ' + c.whatsappPhone);
    if (c.telegramUrl) lines.push('Telegram: ' + formatTelegramLabel(c.telegramUrl));
    if (!lines.length) {
      lines.push('aylensale.com — contact & pickup info');
    }
    var lc = (global.siteSettings && global.siteSettings.legalContact) || {};
    var pub = lc.published || lc.draft || {};
    var contact = pub.contact || {};
    if (contact.contactEmail) lines.push(String(contact.contactEmail).trim());
    else if (contact.supportEmail) lines.push(String(contact.supportEmail).trim());
    return lines.slice(0, 4);
  }

  function shouldShowBackEbayPromo() {
    return state.design.backEbayEnabled !== false && !!resolveEbayStoreUrl();
  }

  async function drawSecondaryQr(ctx, url, x, y, size, style) {
    var qrDataUrl = await qrToDataUrl(url, {
      width: size,
      margin: 1,
      color: { dark: '#0a0f1c', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    });
    var qrImg = await loadImage(qrDataUrl);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x - 4, y - 4, size + 8, size + 8, 6);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(state.design.brandAccent, 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.drawImage(qrImg, x, y, size, size);
  }

  async function drawBackEbayPromoBox(ctx, style, ui) {
    if (!shouldShowBackEbayPromo()) return null;
    var url = resolveEbayStoreUrl();
    var qrSize = Math.max(72, Math.min(112, Number(state.design.backEbayQrSize) || 88));
    var innerW = qrSize + 28;
    var innerH = qrSize + 58;
    var boxX = CARD_W - CARD_PAD - innerW;
    var boxY = CARD_H - CARD_PAD - innerH - 36;
    var pal = state.design;

    roundRect(ctx, boxX - 6, boxY - 6, innerW + 12, innerH + 12, 12);
    ctx.fillStyle = hexToRgba(pal.brandAccent, style.light ? 0.06 : 0.1);
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = hexToRgba(pal.brandLight, style.light ? 0.45 : 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    drawSmallCapsLabel(ctx, 'Optional', boxX + 8, boxY + 12, ui.label);
    ctx.fillStyle = ui.body;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('Our eBay store', boxX + 8, boxY + 30);
    await drawSecondaryQr(ctx, url, boxX + (innerW - qrSize) / 2, boxY + 36, qrSize, style);
    ctx.fillStyle = ui.hint;
    ctx.font = '500 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('eBay listings only', boxX + innerW / 2, boxY + innerH - 10);
    ctx.fillText('Discount code \u2192 front', boxX + innerW / 2, boxY + innerH + 2);
    ctx.textAlign = 'left';

    return { left: boxX - 16, top: boxY - 8, width: innerW + 32, height: innerH + 48 };
  }

  function createCardCanvas() {
    var canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    canvas.className = 'aylen-vc-canvas';
    return canvas;
  }

  function drawPaletteBackground(ctx) {
    var pal = state.design;
    var style = getCardStyle();
    var glowMul = style.light ? 0.28 : 0.85;
    var bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    bg.addColorStop(0, pal.bgColorTop);
    bg.addColorStop(0.45, pal.bgColorMid);
    bg.addColorStop(1, pal.bgColorBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    var pinkGlow = ctx.createRadialGradient(CARD_W * 0.08, CARD_H * 0.08, 0, CARD_W * 0.08, CARD_H * 0.08, CARD_W * 0.5);
    pinkGlow.addColorStop(0, hexToRgba(pal.glowPink, 0.18 * glowMul));
    pinkGlow.addColorStop(1, hexToRgba(pal.glowPink, 0));
    ctx.fillStyle = pinkGlow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    var blueGlow = ctx.createRadialGradient(CARD_W * 0.94, CARD_H * 0.15, 0, CARD_W * 0.94, CARD_H * 0.15, CARD_W * 0.42);
    blueGlow.addColorStop(0, hexToRgba(pal.glowBlue, 0.14 * glowMul));
    blueGlow.addColorStop(1, hexToRgba(pal.glowBlue, 0));
    ctx.fillStyle = blueGlow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    if (!style.light) {
      var shimmer = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
      shimmer.addColorStop(0, hexToRgba(pal.glowPink, 0));
      shimmer.addColorStop(0.42, hexToRgba(pal.brandAccent, 0.05));
      shimmer.addColorStop(0.55, hexToRgba(pal.brandLight, 0.07));
      shimmer.addColorStop(0.68, hexToRgba(pal.glowBlue, 0.04));
      shimmer.addColorStop(1, hexToRgba(pal.glowPink, 0));
      ctx.fillStyle = shimmer;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
    }
  }

  function normalizeImageUrl(url) {
    url = String(url || '').trim();
    if (!url) return '';
    if (url.indexOf('http') !== 0 && url.indexOf('/') !== 0 && url.indexOf('data:') !== 0) {
      url = '/' + url.replace(/^\.?\//, '');
    }
    return url;
  }

  function resolveSideBackgroundSrc(side) {
    var d = state.design;
    var key = side === 'back' ? 'back' : 'front';
    if (d[key + 'BgImageDataUrl']) return d[key + 'BgImageDataUrl'];
    return normalizeImageUrl(d[key + 'BgImageUrl']);
  }

  async function drawSideBackgroundImage(ctx, src) {
    if (!src) return false;
    try {
      var img = await loadImage(src);
      ctx.save();
      roundRect(ctx, 12, 12, CARD_W - 24, CARD_H - 24, 18);
      ctx.clip();
      var scale = Math.max(CARD_W / img.width, CARD_H / img.height);
      var w = img.width * scale;
      var h = img.height * scale;
      var x = (CARD_W - w) / 2;
      var y = (CARD_H - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      return true;
    } catch (e) {
      return false;
    }
  }

  async function drawCardFrame(ctx, side) {
    var pal = state.design;
    var key = side === 'back' ? 'back' : 'front';
    var sideMode = pal[key + 'BgMode'] || 'default';
    var sideOverlay = Math.max(0, Math.min(90, Number(pal[key + 'BgOverlay']) || 0));

    if (pal.bgMode === 'color') {
      ctx.fillStyle = pal.bgColorSolid;
      ctx.fillRect(0, 0, CARD_W, CARD_H);
    } else {
      drawPaletteBackground(ctx);
    }

    if (sideMode !== 'default') {
      var src = resolveSideBackgroundSrc(side);
      var drew = await drawSideBackgroundImage(ctx, src);
      if (drew) {
        if (sideOverlay > 0) {
          ctx.fillStyle = hexToRgba(pal.bgColorTop, sideOverlay / 100);
          roundRect(ctx, 12, 12, CARD_W - 24, CARD_H - 24, 18);
          ctx.fill();
        }
        if (sideMode === 'blend') {
          ctx.save();
          roundRect(ctx, 12, 12, CARD_W - 24, CARD_H - 24, 18);
          ctx.clip();
          ctx.globalAlpha = 0.42;
          drawPaletteBackground(ctx);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      }
    }

    drawStyleBorder(ctx, getCardStyle());
    var cardStyle = getCardStyle();
    drawCardVignette(ctx, cardStyle);
    drawCornerAccents(ctx, cardStyle);
  }

  function fillBrandGradientText(ctx, text, x, y, font) {
    var pal = state.design;
    ctx.font = font;
    ctx.textAlign = 'left';
    var w = Math.max(ctx.measureText(text).width, 120);
    var g = ctx.createLinearGradient(x, y - 48, x + w, y);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.38, '#ffffff');
    g.addColorStop(0.62, pal.brandLight);
    g.addColorStop(1, pal.brandAccent);
    ctx.save();
    ctx.shadowColor = hexToRgba(pal.brandAccent, 0.18);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function fillBrandGradientTextCentered(ctx, text, centerX, y, font) {
    ctx.font = font;
    ctx.textAlign = 'left';
    var w = ctx.measureText(text).width;
    fillBrandGradientText(ctx, text, centerX - w / 2, y, font);
  }

  function getQrPlacement(size) {
    var pad = 52;
    var pos = state.design.qrPos || 'br';
    var ox = Number(state.design.qrOffsetX) || 0;
    var oy = Number(state.design.qrOffsetY) || 0;
    var coords = {
      br: { x: CARD_W - size - pad, y: CARD_H - size - pad },
      bl: { x: pad, y: CARD_H - size - pad },
      tr: { x: CARD_W - size - pad, y: 48 },
      tl: { x: pad, y: 48 },
      cr: { x: CARD_W - size - pad, y: (CARD_H - size) / 2 },
      cc: { x: (CARD_W - size) / 2, y: (CARD_H - size) / 2 }
    };
    var base = coords[pos] || coords.br;
    return {
      x: Math.max(24, Math.min(CARD_W - size - 24, base.x + ox)),
      y: Math.max(24, Math.min(CARD_H - size - 24, base.y + oy))
    };
  }

  function textColumnX(qrX, qrSize) {
    var pos = state.design.qrPos || 'br';
    if (pos === 'bl' || pos === 'tl') {
      return Math.max(52, qrX + qrSize + 32);
    }
    return 52;
  }

  var QR_FRAME_PAD = 12;
  var CARD_PAD = 52;

  function clipCardContent(ctx) {
    ctx.save();
    roundRect(ctx, 12, 12, CARD_W - 24, CARD_H - 24, 18);
    ctx.clip();
  }

  function getQrFrameBounds(qrX, qrY, qrSize) {
    return {
      left: qrX - QR_FRAME_PAD,
      top: qrY - QR_FRAME_PAD,
      right: qrX + qrSize + QR_FRAME_PAD,
      bottom: qrY + qrSize + QR_FRAME_PAD
    };
  }

  function columnsOverlapText(textX, maxWidth, qr) {
    return textX + maxWidth > qr.left && textX < qr.right;
  }

  function getFrontTextZone(qrPlace, qrSize, textX) {
    var qr = getQrFrameBounds(qrPlace.x, qrPlace.y, qrSize);
    var pos = state.design.qrPos || 'br';
    var maxW = CARD_W - CARD_PAD - textX;
    if (pos === 'br' || pos === 'tr' || pos === 'cr') {
      maxW = Math.min(maxW, qr.left - textX - 24);
    } else if (pos === 'bl' || pos === 'tl') {
      maxW = CARD_W - textX - CARD_PAD;
    } else if (pos === 'cc') {
      maxW = CARD_W - textX * 2;
    }
    maxW = Math.max(140, maxW);
    var contentBottom = CARD_H - CARD_PAD;
    var contentTop = 76;
    var overlapsX = columnsOverlapText(textX, maxW, qr);
    if (pos === 'cc') {
      contentBottom = Math.min(contentBottom, qr.top - 18);
    } else if (pos === 'cr' && overlapsX) {
      contentBottom = Math.min(contentBottom, qr.top - 18);
    }
    if ((pos === 'tr' || pos === 'tl') && overlapsX) {
      contentTop = Math.max(contentTop, qr.bottom + 22);
    }
    return {
      x: textX,
      maxWidth: maxW,
      contentTop: contentTop,
      contentBottom: contentBottom,
      qr: qr
    };
  }

  function measureWithTracking(ctx, text, font, tracking) {
    ctx.font = font;
    setLetterSpacing(ctx, tracking || '0px');
    var w = ctx.measureText(String(text || '')).width;
    resetLetterSpacing(ctx);
    return w;
  }

  function truncateToWidth(ctx, text, maxWidth, font, tracking) {
    text = String(text || '');
    if (font) ctx.font = font;
    function width(s) {
      return tracking ? measureWithTracking(ctx, s, font || ctx.font, tracking) : ctx.measureText(s).width;
    }
    if (width(text) <= maxWidth) return text;
    var ell = '\u2026';
    while (text.length > 1 && width(text + ell) > maxWidth) {
      text = text.slice(0, -1);
    }
    return text + ell;
  }

  function wrapTextLines(ctx, text, maxWidth, maxLines, font) {
    if (font) ctx.font = font;
    var words = String(text || '').split(/\s+/);
    var lines = [];
    var line = '';
    words.forEach(function(word) {
      if (!word) return;
      var test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = ctx.measureText(word).width <= maxWidth ? word : truncateToWidth(ctx, word, maxWidth);
      }
    });
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = truncateToWidth(ctx, lines[maxLines - 1], maxWidth);
    }
    return lines;
  }

  function drawWrappedLines(ctx, lines, x, baselineY, lineHeight, color, font) {
    if (!lines.length) return baselineY;
    ctx.font = font;
    ctx.fillStyle = color;
    var y = baselineY;
    lines.forEach(function(line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
    });
    return y;
  }

  function estimateCodeBlockHeight(ctx, code, maxWidth) {
    code = truncateToWidth(ctx, code, maxWidth - 32, '700 44px Georgia, "Times New Roman", serif', '0.1em');
    return fitCodeFontSize(ctx, code, maxWidth).fontSize + 26;
  }

  function fitCodeFontSize(ctx, code, maxWidth) {
    var sizes = [44, 38, 32, 28, 22, 18];
    var i;
    for (i = 0; i < sizes.length; i++) {
      var fs = sizes[i];
      var font = '700 ' + fs + 'px Georgia, "Times New Roman", serif';
      var w = measureWithTracking(ctx, code, font, '0.1em');
      if (w + 32 <= maxWidth) {
        return { fontSize: fs, font: font, textWidth: w };
      }
    }
    var lastFont = '700 18px Georgia, "Times New Roman", serif';
    var trimmed = truncateToWidth(ctx, code, maxWidth - 32, lastFont, '0.1em');
    return {
      fontSize: 18,
      font: lastFont,
      textWidth: measureWithTracking(ctx, trimmed, lastFont, '0.1em')
    };
  }

  function pickBrandFontSize(ctx, text, maxWidth) {
    var sizes = [44, 38, 32];
    var i;
    for (i = 0; i < sizes.length; i++) {
      var font = '900 ' + sizes[i] + 'px system-ui, -apple-system, Segoe UI, sans-serif';
      if (measureWithTracking(ctx, text, font, '0.12em') <= maxWidth) {
        return { size: sizes[i], font: font };
      }
    }
    return { size: 32, font: '900 32px system-ui, -apple-system, Segoe UI, sans-serif' };
  }

  async function drawLogoCircle(ctx, logoX, logoY, logoSize, opacity, side) {
    var alpha = Math.max(0, Math.min(1, (Number(opacity) || 100) / 100));
    if (alpha <= 0) return false;
    var pal = state.design;
    var cx = logoX + logoSize / 2;
    var cy = logoY + logoSize / 2;
    var rad = logoSize / 2;
    try {
      var logoSrc = await resolveLogoSrc(side);
      var logoImg = await loadImage(logoSrc);
      if (alpha >= 0.2) {
        ctx.save();
        var ringG = ctx.createLinearGradient(logoX, logoY, logoX + logoSize, logoY + logoSize);
        ringG.addColorStop(0, hexToRgba(pal.brandLight, 0.95));
        ringG.addColorStop(0.5, hexToRgba(pal.brandAccent, 0.85));
        ringG.addColorStop(1, hexToRgba(pal.brandLight, 0.95));
        ctx.strokeStyle = ringG;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, rad + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      ctx.restore();
      return true;
    } catch (logoErr) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.15, alpha);
      ctx.fillStyle = state.design.brandAccent;
      ctx.font = 'bold ' + Math.round(logoSize * 0.48) + 'px system-ui, sans-serif';
      ctx.fillText('\u26A1', logoX + logoSize * 0.25, logoY + logoSize * 0.72);
      ctx.restore();
      return false;
    }
  }

  async function drawVisitCardFront(code) {
    code = String(code || '').trim().toUpperCase();
    if (!code) throw new Error('Select a discount code first.');

    await loadQrLibrary();
    var card = lookupCard(code);
    var customerName = String(card.name || 'Customer').trim();
    var discount = discountLabel(card);
    var url = cardUrl(code);

    var style = getCardStyle();
    var ui = getUiColors(style);

    var canvas = createCardCanvas();
    var ctx = canvas.getContext('2d');
    await drawCardFrame(ctx, 'front');
    clipCardContent(ctx);

    drawFrontAccentLine(ctx, style);

    var qrSize = Math.max(120, Math.min(280, Number(state.design.qrSize) || 200));
    var qrPlace = getQrPlacement(qrSize);
    var textX = textColumnX(qrPlace.x, qrSize);
    var zone = getFrontTextZone(qrPlace, qrSize, textX);
    var maxW = zone.maxWidth;

    var footerDividerY = CARD_H - CARD_PAD - 22;
    var footerTextY = CARD_H - CARD_PAD - 2;
    var maxContentBottom = Math.min(footerDividerY - 14, zone.contentBottom);

    var rowTop = zone.contentTop;
    var rowBottom = rowTop;
    var brandX = textX;
    var headerBrandMaxW = maxW;

    var logoCfg = getSideLogoConfig('front');
    if (logoCfg.enabled && logoCfg.opacity > 0) {
      var logoX = textX + logoCfg.offsetX;
      var logoY = rowTop + logoCfg.offsetY;
      await drawLogoCircle(ctx, logoX, logoY, logoCfg.size, logoCfg.opacity, 'front');
      rowBottom = Math.max(rowBottom, logoY + logoCfg.size);
      brandX = logoX + logoCfg.size + 14;
      headerBrandMaxW = Math.max(100, maxW - (brandX - textX));
    }

    var brandFit = pickBrandFontSize(ctx, 'AYLENSALE', headerBrandMaxW);
    var brandBaseline = rowTop + Math.round(brandFit.size * 0.82);
    fillBrandTitle(ctx, 'AYLENSALE', brandX, brandBaseline, brandFit.font, style);
    rowBottom = Math.max(rowBottom, brandBaseline + 8);

    ctx.fillStyle = ui.brandSub;
    ctx.font = '500 15px Georgia, "Times New Roman", serif';
    var domainBaseline = brandBaseline + 26;
    ctx.fillText(truncateToWidth(ctx, 'aylensale.com', headerBrandMaxW), brandX, domainBaseline);
    rowBottom = Math.max(rowBottom, domainBaseline + 8);

    var curY = rowBottom + 16;

    var tagLines = wrapTextLines(
      ctx,
      'Amazon return pallets \u00B7 Cables & electronics',
      maxW,
      2,
      '500 13px system-ui, sans-serif'
    );
    curY = drawWrappedLines(ctx, tagLines, textX, curY + 12, 17, ui.tagline, '500 13px system-ui, sans-serif');
    curY += 10;
    drawLuxuryDivider(ctx, textX, curY, maxW, style);
    curY += 20;

    var nameLines = wrapTextLines(
      ctx,
      customerName,
      maxW,
      2,
      '500 22px Georgia, "Times New Roman", serif'
    );
    curY = drawWrappedLines(ctx, nameLines, textX, curY + 18, 26, ui.name, '500 22px Georgia, "Times New Roman", serif');
    curY += 10;

    if (discount) {
      curY = drawDiscountBadge(ctx, discount, textX, curY, style, maxW);
      curY += 6;
    }

    var codeBlockH = estimateCodeBlockHeight(ctx, code, maxW);
    var blockNeeded = 18 + codeBlockH + 18 + 14;
    if (curY + blockNeeded > maxContentBottom) {
      curY = Math.max(rowBottom + 12, maxContentBottom - blockNeeded);
    }

    drawSmallCapsLabel(ctx, 'Your personal code', textX, curY + 11, ui.label);
    curY += 22;
    curY = drawCodeDisplay(ctx, code, textX, curY, style, ui, maxW);
    curY += 10;

    if (curY + 12 <= footerDividerY - 6) {
      ctx.fillStyle = ui.hint;
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.fillText(truncateToWidth(ctx, 'Scan QR or enter code at checkout', maxW), textX, curY + 11);
    }

    drawLuxuryDivider(ctx, textX, footerDividerY, maxW, style);
    ctx.fillStyle = ui.footer;
    ctx.font = '500 11px system-ui, sans-serif';
    setLetterSpacing(ctx, '0.06em');
    ctx.fillText(
      truncateToWidth(ctx, 'MIXED WIRE & TECH JOB LOTS \u00B7 UK PICKUP', maxW, '500 11px system-ui, sans-serif', '0.06em'),
      textX,
      footerTextY
    );
    resetLetterSpacing(ctx);

    var qrDataUrl = await qrToDataUrl(url, {
      width: qrSize,
      margin: 1,
      color: { dark: '#0a0f1c', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    });
    var qrImg = await loadImage(qrDataUrl);
    drawStyledQrFrame(ctx, qrPlace.x, qrPlace.y, qrSize, style);
    ctx.drawImage(qrImg, qrPlace.x, qrPlace.y, qrSize, qrSize);

    ctx.restore();
    return canvas;
  }

  async function drawVisitCardBack(code) {
    code = String(code || '').trim().toUpperCase();
    var card = lookupCard(code);
    var discount = discountLabel(card);

    await loadQrLibrary();

    var style = getCardStyle();
    var ui = getUiColors(style);

    var canvas = createCardCanvas();
    var ctx = canvas.getContext('2d');
    await drawCardFrame(ctx, 'back');

    var backLogoCfg = getSideLogoConfig('back');
    if (backLogoCfg.enabled && backLogoCfg.opacity > 0) {
      var wmSize = Math.min(backLogoCfg.size, 180);
      var backPlace = getBackLogoPlace(Object.assign({}, backLogoCfg, { size: wmSize }));
      await drawLogoCircle(ctx, backPlace.x, backPlace.y, wmSize, backLogoCfg.opacity, 'back');
    }

    clipCardContent(ctx);

    var showEbay = shouldShowBackEbayPromo();
    var promoReserve = showEbay ? 188 : 0;
    var contentLeft = 56;
    var contentWidth = CARD_W - contentLeft - CARD_PAD - promoReserve;
    var footerDividerY = CARD_H - CARD_PAD - 22;
    var footerTextY = CARD_H - CARD_PAD - 2;
    var maxContentBottom = footerDividerY - 14;

    var curY = 58;
    fillBrandTitleCentered(ctx, 'AYLENSALE', CARD_W / 2, curY + 26, '900 30px system-ui, -apple-system, Segoe UI, sans-serif', style);
    curY += 40;
    drawSmallCapsLabelCentered(ctx, 'How to use your visit card', CARD_W / 2, curY + 11, state.design.brandAccent);
    curY += 22;
    drawLuxuryDivider(ctx, contentLeft, curY, contentWidth + (showEbay ? 0 : 0), style);
    curY += 22;

    var steps = [
      'Open aylensale.com or scan the QR on the front of this card',
      'Enter code ' + code + ' at the top of the site',
      'Shop cables, electronics & Amazon return pallets on aylensale.com'
    ];
    var stepFont = '500 15px Georgia, "Times New Roman", serif';
    steps.forEach(function(line, idx) {
      var lines = wrapTextLines(ctx, line, contentWidth - 28, 2, stepFont);
      var stepBaseline = curY + 16;
      ctx.fillStyle = hexToRgba(state.design.brandAccent, 0.9);
      ctx.font = '700 14px Georgia, serif';
      ctx.fillText(String(idx + 1) + '.', contentLeft, stepBaseline);
      curY = drawWrappedLines(ctx, lines, contentLeft + 24, stepBaseline, 19, ui.body, stepFont);
      curY += 8;
    });

    if (discount) {
      curY = drawDiscountBadgeCentered(ctx, 'Your benefit: ' + discount, contentLeft + contentWidth / 2, curY + 4, style, contentWidth);
      curY += 8;
    }

    curY += 4;
    drawLuxuryDivider(ctx, contentLeft, curY, contentWidth, style);
    curY += 20;
    drawSmallCapsLabel(ctx, 'Contact', contentLeft, curY + 11, ui.label);
    curY += 22;

    var contactFont = '500 13px system-ui, sans-serif';
    var contactLineH = 18;
    var contactLines = getBackContactLines();
    var maxContactLines = Math.max(1, Math.floor((maxContentBottom - curY - 10) / (contactLineH + 4)));
    contactLines.slice(0, maxContactLines).forEach(function(line) {
      var lines = wrapTextLines(ctx, line, contentWidth - 22, 1, contactFont);
      var lineBaseline = curY + 13;
      ctx.fillStyle = hexToRgba(state.design.brandAccent, 0.75);
      ctx.font = contactFont;
      ctx.fillText('\u2014', contentLeft, lineBaseline);
      curY = drawWrappedLines(ctx, lines, contentLeft + 18, lineBaseline, contactLineH, ui.body, contactFont);
      curY += 4;
    });

    if (showEbay) {
      await drawBackEbayPromoBox(ctx, style, ui);
    }

    drawLuxuryDivider(ctx, contentLeft, footerDividerY, CARD_W - contentLeft - CARD_PAD, style);
    ctx.fillStyle = ui.backFooter;
    ctx.font = '500 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    setLetterSpacing(ctx, '0.05em');
    ctx.fillText(
      truncateToWidth(ctx, 'AMAZON RETURN PALLETS \u00B7 CABLES & ELECTRONICS \u00B7 PICKUP', CARD_W - 112, '500 10px system-ui, sans-serif', '0.05em'),
      CARD_W / 2,
      footerDividerY + 18
    );
    resetLetterSpacing(ctx);
    ctx.fillText('Discount code on front \u00B7 eBay QR on back is optional', CARD_W / 2, footerTextY);
    ctx.textAlign = 'left';

    ctx.restore();
    return canvas;
  }

  async function drawBothSides(code) {
    var front = await drawVisitCardFront(code);
    var back = await drawVisitCardBack(code);
    state.frontCanvas = front;
    state.backCanvas = back;
    state.lastFrontDataUrl = front.toDataURL('image/png');
    state.lastBackDataUrl = back.toDataURL('image/png');
    state.code = code;
    return { front: front, back: back };
  }

  function mountPreview(frontCanvas, backCanvas) {
    var frame = document.getElementById('aylenVcPreviewFrame');
    if (!frame) return;
    frame.innerHTML =
      '<div class="aylen-vc-preview-duo">' +
        '<div class="aylen-vc-preview-side">' +
          '<span class="aylen-vc-preview-side-label">Front</span>' +
          '<div class="aylen-vc-preview-frame" id="aylenVcFrontMount"></div>' +
        '</div>' +
        '<div class="aylen-vc-preview-side">' +
          '<span class="aylen-vc-preview-side-label aylen-vc-preview-side-label--back">Back</span>' +
          '<div class="aylen-vc-preview-frame" id="aylenVcBackMount"></div>' +
        '</div>' +
      '</div>';
    var fm = document.getElementById('aylenVcFrontMount');
    var bm = document.getElementById('aylenVcBackMount');
    if (fm && frontCanvas) fm.appendChild(frontCanvas);
    if (bm && backCanvas) bm.appendChild(backCanvas);
  }

  async function refreshPreview() {
    var sel = document.getElementById('aylenVcCodeSelect');
    var code = sel ? String(sel.value || '').trim().toUpperCase() : state.code;
    var btn = document.getElementById('aylenVcRefreshBtn');
    if (!code) {
      var frame = document.getElementById('aylenVcPreviewFrame');
      if (frame) frame.innerHTML = '<p class="aylen-hint">Select a discount code first (e.g. 999)</p>';
      notifyMsg('Select a discount code from the list', 'error');
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading…';
    }
    try {
      await ensureCardsLoaded(true);
      var pair = await drawBothSides(code);
      mountPreview(pair.front, pair.back);
      var meta = document.getElementById('aylenVcMeta');
      if (meta) {
        var c = lookupCard(code);
        meta.innerHTML =
          '<b>Print size:</b> 85 \u00D7 55 mm \u00D7 2 sides (front + back)<br>' +
          '<b>QR link:</b> ' + esc(cardUrl(code)) + '<br>' +
          '<b>Customer:</b> ' + esc(c.name || '\u2014') + ' &middot; ' + esc(discountLabel(c));
      }
      notifyMsg('Preview ready', 'success');
    } catch (e) {
      console.error('[VisitCards]', e);
      notifyMsg(e.message || 'Preview failed', 'error');
      var frameErr = document.getElementById('aylenVcPreviewFrame');
      if (frameErr) {
        frameErr.innerHTML = '<p class="aylen-hint" style="color:#f87171">' + esc(e.message || 'Preview failed') + '</p>';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rotate"></i> Preview';
      }
    }
  }

  function bindAction(id, handler) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function() {
      Promise.resolve(handler()).catch(function(e) {
        console.error('[VisitCards]', e);
        notifyMsg(e.message || 'Action failed', 'error');
      });
    });
  }

  function downloadBlob(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 2000);
  }

  async function downloadPngSide(dataUrl, suffix) {
    var res = await fetch(dataUrl);
    var blob = await res.blob();
    downloadBlob(blob, 'AYLENSALE-visit-' + state.code + '-' + suffix + '.png');
  }

  async function downloadPng() {
    if (!state.lastFrontDataUrl || !state.lastBackDataUrl || !state.code) {
      await refreshPreview();
    }
    if (!state.lastFrontDataUrl || !state.lastBackDataUrl) return;
    await downloadPngSide(state.lastFrontDataUrl, 'front');
    await downloadPngSide(state.lastBackDataUrl, 'back');
    notifyMsg('Front + back PNG downloaded', 'success');
  }

  async function downloadPdf() {
    if (!state.lastFrontDataUrl || !state.lastBackDataUrl || !state.code) {
      await refreshPreview();
    }
    if (!state.lastFrontDataUrl || !state.lastBackDataUrl) return;
    try {
      await loadScriptOnce(PDF_LIB, 'jspdf');
      var jsPDF = global.jspdf && global.jspdf.jsPDF;
      if (!jsPDF) throw new Error('PDF library unavailable');
      var pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85, 55],
        compress: true
      });
      pdf.addImage(state.lastFrontDataUrl, 'PNG', 0, 0, 85, 55);
      pdf.addPage([85, 55], 'landscape');
      pdf.addImage(state.lastBackDataUrl, 'PNG', 0, 0, 85, 55);
      pdf.save('AYLENSALE-visit-' + state.code + '-2sides.pdf');
      notifyMsg('PDF downloaded — page 1 front, page 2 back (85×55 mm)', 'success');
    } catch (e) {
      notifyMsg(e.message || 'PDF failed', 'error');
    }
  }

  function printCard() {
    if (!state.lastFrontDataUrl || !state.lastBackDataUrl) {
      refreshPreview().then(printCard);
      return;
    }
    var sheet = document.getElementById('aylenVcPrintSheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'aylenVcPrintSheet';
      sheet.className = 'aylen-vc-print-sheet';
      document.body.appendChild(sheet);
    }
    sheet.innerHTML =
      '<div class="aylen-vc-print-page"><img src="' + state.lastFrontDataUrl + '" alt="Front"></div>' +
      '<div class="aylen-vc-print-page"><img src="' + state.lastBackDataUrl + '" alt="Back"></div>';
    document.body.classList.add('aylen-vc-print-mode');
    global.onafterprint = function() {
      document.body.classList.remove('aylen-vc-print-mode');
      global.onafterprint = null;
    };
    global.print();
  }

  function stylePickerHtml(currentId) {
    currentId = resolveStyleId(currentId);
    return '<div class="aylen-vc-section aylen-vc-section--styles">' +
      '<h4 class="aylen-vc-section-title">Card style — premium collection</h4>' +
      '<p class="aylen-hint">10 refined layouts. Pick one, preview, then export PNG or PDF.</p>' +
      '<div class="aylen-vc-style-grid" id="aylenVcStyleGrid">' +
      CARD_STYLES.map(function(st) {
        var active = st.id === currentId ? ' aylen-vc-style-chip--active' : '';
        var top = normalizeHex(st.preset.bgColorTop, '#070a14');
        var accent = normalizeHex(st.preset.brandAccent, '#ff4f83');
        return '<button type="button" class="aylen-vc-style-chip' + active + '" data-style-id="' + esc(st.id) + '">' +
          '<span class="aylen-vc-style-swatch" style="background:linear-gradient(135deg,' + esc(top) + ',' + esc(accent) + ')"></span>' +
          '<span class="aylen-vc-style-name">' + esc(st.name) + '</span>' +
          '<span class="aylen-vc-style-tag">' + esc(st.tag) + '</span>' +
        '</button>';
      }).join('') +
      '</div></div>';
  }

  function applyCardStyle(styleId) {
    styleId = resolveStyleId(styleId);
    var style = null;
    for (var i = 0; i < CARD_STYLES.length; i++) {
      if (CARD_STYLES[i].id === styleId) {
        style = CARD_STYLES[i];
        break;
      }
    }
    if (!style) return;
    var keep = {
      frontLogoDataUrl: state.design.frontLogoDataUrl,
      backLogoDataUrl: state.design.backLogoDataUrl,
      frontBgImageDataUrl: state.design.frontBgImageDataUrl,
      backBgImageDataUrl: state.design.backBgImageDataUrl,
      backEbayEnabled: state.design.backEbayEnabled,
      backEbayUrl: state.design.backEbayUrl,
      backEbayQrSize: state.design.backEbayQrSize,
      backContactPhone: state.design.backContactPhone,
      backWhatsappPhone: state.design.backWhatsappPhone,
      backTelegramUrl: state.design.backTelegramUrl
    };
    state.design = cloneDesign(Object.assign({}, style.preset, keep));
    saveDesignToStorage();
    if (state.panelMount) {
      renderPanel(state.panelMount);
      notifyMsg('Style applied: ' + style.name, 'success');
      return;
    }
    refreshPreview();
    notifyMsg('Style applied: ' + style.name, 'success');
  }

  function bindStylePicker() {
    var grid = document.getElementById('aylenVcStyleGrid');
    if (!grid || grid._aylenBound) return;
    grid._aylenBound = true;
    grid.addEventListener('click', function(e) {
      var btn = e.target.closest('.aylen-vc-style-chip');
      if (!btn) return;
      applyCardStyle(btn.getAttribute('data-style-id'));
    });
  }

  function colorField(id, label, value) {
    var hex = normalizeHex(value);
    return '<label class="aylen-label" for="' + id + '">' + label + '</label>' +
      '<div class="aylen-vc-color-row">' +
        '<input type="color" id="' + id + '" class="aylen-vc-color" value="' + esc(hex) + '">' +
        '<input type="text" id="' + id + 'Hex" class="aylen-input aylen-vc-color-hex" value="' + esc(hex) + '" maxlength="7" spellcheck="false">' +
      '</div>';
  }

  function sideLogoPanel(sideKey, title, d) {
    var cap = sideKey.charAt(0).toUpperCase() + sideKey.slice(1);
    var url = d[sideKey + 'LogoUrl'] || (sideKey === 'front' ? DEFAULT_LOGO : '');
    var size = d[sideKey + 'LogoSize'] != null ? d[sideKey + 'LogoSize'] : (sideKey === 'back' ? 240 : 88);
    var opacity = d[sideKey + 'LogoOpacity'] != null ? d[sideKey + 'LogoOpacity'] : (sideKey === 'back' ? 12 : 100);
    var enabled = d[sideKey + 'LogoEnabled'] !== false;
    var offsetX = d[sideKey + 'LogoOffsetX'] || 0;
    var offsetY = d[sideKey + 'LogoOffsetY'] || 0;
    var pos = d.backLogoPos || 'center';
    var posBlock = sideKey === 'back'
      ? '<label class="aylen-label" for="aylenVcBackLogoPos">Position</label>' +
        '<select id="aylenVcBackLogoPos" class="aylen-input">' +
          '<option value="center"' + (pos === 'center' ? ' selected' : '') + '>Center watermark</option>' +
          '<option value="top-center"' + (pos === 'top-center' ? ' selected' : '') + '>Top center</option>' +
          '<option value="top-left"' + (pos === 'top-left' ? ' selected' : '') + '>Top left</option>' +
        '</select>'
      : '';
    var sizeMax = sideKey === 'back' ? 320 : 180;
    var opacityMin = sideKey === 'back' ? 0 : 15;
    return '<div class="aylen-vc-section aylen-vc-section--' + sideKey + '-logo">' +
      '<h4 class="aylen-vc-section-title">' + title + '</h4>' +
      '<label class="aylen-label aylen-vc-check-label">' +
        '<input id="aylenVc' + cap + 'LogoEnabled" type="checkbox"' + (enabled ? ' checked' : '') + '> Show logo on ' + sideKey +
      '</label>' +
      '<label class="aylen-label" for="aylenVc' + cap + 'LogoUrl">Logo URL' +
        (sideKey === 'back' ? ' <span class="aylen-hint">(empty = same as front)</span>' : '') +
      '</label>' +
      '<input id="aylenVc' + cap + 'LogoUrl" class="aylen-input" type="text" value="' + esc(url) + '" placeholder="' + esc(DEFAULT_LOGO) + '">' +
      '<label class="aylen-label" for="aylenVc' + cap + 'LogoFile">Upload logo</label>' +
      '<input id="aylenVc' + cap + 'LogoFile" class="aylen-input" type="file" accept="image/jpeg,image/png,image/webp">' +
      posBlock +
      '<label class="aylen-label" for="aylenVc' + cap + 'LogoSize">Size: <span id="aylenVc' + cap + 'LogoSizeVal">' + esc(String(size)) + ' px</span></label>' +
      '<input id="aylenVc' + cap + 'LogoSize" class="aylen-vc-range" type="range" min="24" max="' + sizeMax + '" step="4" value="' + esc(String(size)) + '">' +
      '<label class="aylen-label" for="aylenVc' + cap + 'LogoOpacity">Opacity: <span id="aylenVc' + cap + 'LogoOpacityVal">' + esc(String(opacity)) + '%</span></label>' +
      '<input id="aylenVc' + cap + 'LogoOpacity" class="aylen-vc-range" type="range" min="' + opacityMin + '" max="100" step="5" value="' + esc(String(opacity)) + '">' +
      '<label class="aylen-label" for="aylenVc' + cap + 'LogoOffsetX">Shift left / right: <span id="aylenVc' + cap + 'LogoOffsetXVal">' + esc(String(offsetX)) + '</span></label>' +
      '<input id="aylenVc' + cap + 'LogoOffsetX" class="aylen-vc-range" type="range" min="-120" max="120" step="5" value="' + esc(String(offsetX)) + '">' +
      '<label class="aylen-label" for="aylenVc' + cap + 'LogoOffsetY">Shift up / down: <span id="aylenVc' + cap + 'LogoOffsetYVal">' + esc(String(offsetY)) + '</span></label>' +
      '<input id="aylenVc' + cap + 'LogoOffsetY" class="aylen-vc-range" type="range" min="-120" max="120" step="5" value="' + esc(String(offsetY)) + '">' +
    '</div>';
  }

  function applyPreset(raw, message) {
    state.design = cloneDesign(Object.assign({}, raw, {
      frontBgImageDataUrl: null,
      backBgImageDataUrl: null,
      frontLogoDataUrl: null,
      backLogoDataUrl: null
    }));
    saveDesignToStorage();
    if (state.panelMount) {
      renderPanel(state.panelMount);
      notifyMsg(message, 'success');
      return;
    }
    refreshPreview();
    notifyMsg(message, 'success');
  }


  function backPromoPanelHtml(d) {
    var ebayUrl = String(d.backEbayUrl || '').trim();
    if (!ebayUrl) {
      var ebay = global.siteSettings && global.siteSettings.ebay;
      if (ebay && ebay.url) ebayUrl = String(ebay.url).trim();
    }
    var ebayQr = d.backEbayQrSize != null ? d.backEbayQrSize : 88;
    return '<div class="aylen-vc-section aylen-vc-section--back-promo">' +
      '<h4 class="aylen-vc-section-title">Back of card — contact &amp; eBay</h4>' +
      '<p class="aylen-hint">Main shopping QR stays on the <b>front</b>. eBay promo QR is <b>back only</b> — buyers won\u2019t mix it up with your discount code.</p>' +
      '<label class="aylen-label" for="aylenVcBackContactPhone">Phone on card <span class="aylen-hint">(optional — add later)</span></label>' +
      '<input id="aylenVcBackContactPhone" class="aylen-input" type="text" value="' + esc(d.backContactPhone || '') + '" placeholder="+44 7xxx xxx xxx">' +
      '<label class="aylen-label" for="aylenVcBackWhatsappPhone">WhatsApp number <span class="aylen-hint">(optional)</span></label>' +
      '<input id="aylenVcBackWhatsappPhone" class="aylen-input" type="text" value="' + esc(d.backWhatsappPhone || '') + '" placeholder="+44 7xxx xxx xxx">' +
      '<label class="aylen-label" for="aylenVcBackTelegramUrl">Telegram link <span class="aylen-hint">(optional)</span></label>' +
      '<input id="aylenVcBackTelegramUrl" class="aylen-input" type="text" value="' + esc(d.backTelegramUrl || '') + '" placeholder="https://t.me/yourname">' +
      '<label class="aylen-label aylen-vc-check-label">' +
        '<input id="aylenVcBackEbayEnabled" type="checkbox"' + (d.backEbayEnabled !== false ? ' checked' : '') + '> Show eBay store QR on back' +
      '</label>' +
      '<label class="aylen-label" for="aylenVcBackEbayUrl">eBay store URL</label>' +
      '<input id="aylenVcBackEbayUrl" class="aylen-input" type="text" value="' + esc(ebayUrl) + '" placeholder="https://www.ebay.co.uk/usr/…">' +
      '<label class="aylen-label" for="aylenVcBackEbayQrSize">eBay QR size: <span id="aylenVcBackEbayQrSizeVal">' + esc(String(ebayQr)) + ' px</span></label>' +
      '<input id="aylenVcBackEbayQrSize" class="aylen-vc-range" type="range" min="72" max="112" step="4" value="' + esc(String(ebayQr)) + '">' +
    '</div>';
  }

  function sideBgPanel(sideKey, title, d) {
    var mode = d[sideKey + 'BgMode'] || 'default';
    var overlay = d[sideKey + 'BgOverlay'] != null ? d[sideKey + 'BgOverlay'] : 40;
    var url = d[sideKey + 'BgImageUrl'] || '';
    var cap = sideKey.charAt(0).toUpperCase() + sideKey.slice(1);
    var photoHidden = mode === 'default' ? ' hidden' : '';
    return '<div class="aylen-vc-section aylen-vc-section--' + sideKey + '">' +
      '<h4 class="aylen-vc-section-title">' + title + '</h4>' +
      '<label class="aylen-label" for="aylenVc' + cap + 'BgMode">Style</label>' +
      '<select id="aylenVc' + cap + 'BgMode" class="aylen-input">' +
        '<option value="default"' + (mode === 'default' ? ' selected' : '') + '>Gradient / colors only</option>' +
        '<option value="photo"' + (mode === 'photo' ? ' selected' : '') + '>My photo only</option>' +
        '<option value="blend"' + (mode === 'blend' ? ' selected' : '') + '>Photo + gradient blend</option>' +
      '</select>' +
      '<div id="aylenVc' + cap + 'PhotoFields"' + photoHidden + '>' +
        '<label class="aylen-label" for="aylenVc' + cap + 'BgUrl">Image URL</label>' +
        '<input id="aylenVc' + cap + 'BgUrl" class="aylen-input" type="text" value="' + esc(url) + '" placeholder="https://… or /images/bg.jpg">' +
        '<label class="aylen-label" for="aylenVc' + cap + 'BgFile">Upload image</label>' +
        '<input id="aylenVc' + cap + 'BgFile" class="aylen-input" type="file" accept="image/jpeg,image/png,image/webp">' +
        '<label class="aylen-label" for="aylenVc' + cap + 'BgOverlay">Dark overlay: <span id="aylenVc' + cap + 'BgOverlayVal">' + esc(String(overlay)) + '%</span></label>' +
        '<input id="aylenVc' + cap + 'BgOverlay" class="aylen-vc-range" type="range" min="0" max="90" step="5" value="' + esc(String(overlay)) + '">' +
      '</div>' +
    '</div>';
  }

  function syncDesignFromForm() {
    var d = state.design;
    var bgMode = document.getElementById('aylenVcBgMode');
    var qrSize = document.getElementById('aylenVcQrSize');
    var qrPos = document.getElementById('aylenVcQrPos');
    var qrOx = document.getElementById('aylenVcQrOffsetX');
    var qrOy = document.getElementById('aylenVcQrOffsetY');
    if (bgMode) d.bgMode = bgMode.value || 'site';
    if (qrSize) d.qrSize = Number(qrSize.value);
    if (qrPos) d.qrPos = qrPos.value || 'br';
    if (qrOx) d.qrOffsetX = Number(qrOx.value);
    if (qrOy) d.qrOffsetY = Number(qrOy.value);

    ['front', 'back'].forEach(function(side) {
      var cap = side.charAt(0).toUpperCase() + side.slice(1);
      var modeEl = document.getElementById('aylenVc' + cap + 'BgMode');
      var urlEl = document.getElementById('aylenVc' + cap + 'BgUrl');
      var overlayEl = document.getElementById('aylenVc' + cap + 'BgOverlay');
      var logoUrlEl = document.getElementById('aylenVc' + cap + 'LogoUrl');
      var logoSizeEl = document.getElementById('aylenVc' + cap + 'LogoSize');
      var logoOpacityEl = document.getElementById('aylenVc' + cap + 'LogoOpacity');
      var logoEnabledEl = document.getElementById('aylenVc' + cap + 'LogoEnabled');
      var logoOxEl = document.getElementById('aylenVc' + cap + 'LogoOffsetX');
      var logoOyEl = document.getElementById('aylenVc' + cap + 'LogoOffsetY');
      if (modeEl) d[side + 'BgMode'] = modeEl.value || 'default';
      if (urlEl) d[side + 'BgImageUrl'] = urlEl.value.trim();
      if (overlayEl) d[side + 'BgOverlay'] = Number(overlayEl.value);
      if (logoUrlEl) d[side + 'LogoUrl'] = logoUrlEl.value.trim();
      if (logoSizeEl) d[side + 'LogoSize'] = Number(logoSizeEl.value);
      if (logoOpacityEl) d[side + 'LogoOpacity'] = Number(logoOpacityEl.value);
      if (logoEnabledEl) d[side + 'LogoEnabled'] = logoEnabledEl.checked;
      if (logoOxEl) d[side + 'LogoOffsetX'] = Number(logoOxEl.value);
      if (logoOyEl) d[side + 'LogoOffsetY'] = Number(logoOyEl.value);
    });
    var backPosEl = document.getElementById('aylenVcBackLogoPos');
    if (backPosEl) d.backLogoPos = backPosEl.value || 'center';

    var backEbayEnabled = document.getElementById('aylenVcBackEbayEnabled');
    var backEbayUrl = document.getElementById('aylenVcBackEbayUrl');
    var backEbayQrSize = document.getElementById('aylenVcBackEbayQrSize');
    var backContactPhone = document.getElementById('aylenVcBackContactPhone');
    var backWhatsappPhone = document.getElementById('aylenVcBackWhatsappPhone');
    var backTelegramUrl = document.getElementById('aylenVcBackTelegramUrl');
    if (backEbayEnabled) d.backEbayEnabled = backEbayEnabled.checked;
    if (backEbayUrl) d.backEbayUrl = backEbayUrl.value.trim();
    if (backEbayQrSize) d.backEbayQrSize = Number(backEbayQrSize.value);
    if (backContactPhone) d.backContactPhone = backContactPhone.value.trim();
    if (backWhatsappPhone) d.backWhatsappPhone = backWhatsappPhone.value.trim();
    if (backTelegramUrl) d.backTelegramUrl = backTelegramUrl.value.trim();

    [
      ['aylenVcBgSolid', 'bgColorSolid'],
      ['aylenVcBgTop', 'bgColorTop'],
      ['aylenVcBgMid', 'bgColorMid'],
      ['aylenVcBgBottom', 'bgColorBottom'],
      ['aylenVcGlowPink', 'glowPink'],
      ['aylenVcGlowBlue', 'glowBlue'],
      ['aylenVcBrandAccent', 'brandAccent'],
      ['aylenVcBrandLight', 'brandLight']
    ].forEach(function(pair) {
      var picker = document.getElementById(pair[0]);
      var hexEl = document.getElementById(pair[0] + 'Hex');
      var val = picker ? picker.value : (hexEl ? hexEl.value : '');
      if (hexEl && hexEl === document.activeElement) val = hexEl.value;
      d[pair[1]] = normalizeHex(val, DEFAULT_DESIGN[pair[1]]);
      if (picker) picker.value = d[pair[1]];
      if (hexEl) hexEl.value = d[pair[1]];
    });

    saveDesignToStorage();
    updateDesignUiLabels();
  }

  function updateDesignUiLabels() {
    var qrSizeVal = document.getElementById('aylenVcQrSizeVal');
    var qrOxVal = document.getElementById('aylenVcQrOffsetXVal');
    var qrOyVal = document.getElementById('aylenVcQrOffsetYVal');
    var paletteFields = document.getElementById('aylenVcPaletteFields');
    var solidField = document.getElementById('aylenVcSolidField');
    ['Front', 'Back'].forEach(function(cap) {
      var side = cap.toLowerCase();
      var sizeVal = document.getElementById('aylenVc' + cap + 'LogoSizeVal');
      var opacityVal = document.getElementById('aylenVc' + cap + 'LogoOpacityVal');
      var oxVal = document.getElementById('aylenVc' + cap + 'LogoOffsetXVal');
      var oyVal = document.getElementById('aylenVc' + cap + 'LogoOffsetYVal');
      var overlayVal = document.getElementById('aylenVc' + cap + 'BgOverlayVal');
      var photoFields = document.getElementById('aylenVc' + cap + 'PhotoFields');
      var mode = state.design[side + 'BgMode'] || 'default';
      if (sizeVal) sizeVal.textContent = (state.design[side + 'LogoSize'] || 0) + ' px';
      if (opacityVal) opacityVal.textContent = (state.design[side + 'LogoOpacity'] || 0) + '%';
      if (oxVal) oxVal.textContent = String(state.design[side + 'LogoOffsetX'] || 0);
      if (oyVal) oyVal.textContent = String(state.design[side + 'LogoOffsetY'] || 0);
      if (overlayVal) overlayVal.textContent = (state.design[side + 'BgOverlay'] || 0) + '%';
      if (photoFields) photoFields.hidden = mode === 'default';
    });
    if (qrSizeVal) qrSizeVal.textContent = (state.design.qrSize || 200) + ' px';
    if (qrOxVal) qrOxVal.textContent = String(state.design.qrOffsetX || 0);
    if (qrOyVal) qrOyVal.textContent = String(state.design.qrOffsetY || 0);
    var backEbayQrVal = document.getElementById('aylenVcBackEbayQrSizeVal');
    if (backEbayQrVal) backEbayQrVal.textContent = (state.design.backEbayQrSize || 88) + ' px';
    if (paletteFields) {
      paletteFields.hidden = state.design.bgMode === 'color';
    }
    if (solidField) {
      solidField.hidden = state.design.bgMode !== 'color';
    }
  }

  function bindColorField(id, onChange) {
    var picker = document.getElementById(id);
    var hexEl = document.getElementById(id + 'Hex');
    function syncFromPicker() {
      if (hexEl && picker) hexEl.value = picker.value;
      onChange();
    }
    function syncFromHex() {
      if (!hexEl) return;
      var val = normalizeHex(hexEl.value, picker ? picker.value : '#070a14');
      hexEl.value = val;
      if (picker) picker.value = val;
      onChange();
    }
    if (picker && !picker._aylenBound) {
      picker._aylenBound = true;
      picker.addEventListener('input', syncFromPicker);
      picker.addEventListener('change', syncFromPicker);
    }
    if (hexEl && !hexEl._aylenBound) {
      hexEl._aylenBound = true;
      hexEl.addEventListener('change', syncFromHex);
      hexEl.addEventListener('blur', syncFromHex);
    }
  }

  function bindDesignControls() {
    var ids = [
      'aylenVcBgMode',
      'aylenVcFrontBgMode', 'aylenVcFrontBgUrl', 'aylenVcFrontBgOverlay',
      'aylenVcBackBgMode', 'aylenVcBackBgUrl', 'aylenVcBackBgOverlay',
      'aylenVcFrontLogoUrl', 'aylenVcFrontLogoSize', 'aylenVcFrontLogoOpacity',
      'aylenVcFrontLogoEnabled', 'aylenVcFrontLogoOffsetX', 'aylenVcFrontLogoOffsetY',
      'aylenVcBackLogoUrl', 'aylenVcBackLogoSize', 'aylenVcBackLogoOpacity',
      'aylenVcBackLogoEnabled', 'aylenVcBackLogoPos', 'aylenVcBackLogoOffsetX', 'aylenVcBackLogoOffsetY',
      'aylenVcQrSize', 'aylenVcQrPos', 'aylenVcQrOffsetX', 'aylenVcQrOffsetY',
      'aylenVcBackEbayEnabled', 'aylenVcBackEbayUrl', 'aylenVcBackEbayQrSize',
      'aylenVcBackContactPhone', 'aylenVcBackWhatsappPhone', 'aylenVcBackTelegramUrl'
    ];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el || el._aylenBound) return;
      el._aylenBound = true;
      el.addEventListener('input', function() {
        syncDesignFromForm();
        refreshPreview();
      });
      el.addEventListener('change', function() {
        syncDesignFromForm();
        refreshPreview();
      });
    });

    [
      'aylenVcBgSolid', 'aylenVcBgTop', 'aylenVcBgMid', 'aylenVcBgBottom',
      'aylenVcGlowPink', 'aylenVcGlowBlue', 'aylenVcBrandAccent', 'aylenVcBrandLight'
    ].forEach(function(id) {
      bindColorField(id, function() {
        syncDesignFromForm();
        refreshPreview();
      });
    });

    var resetBtn = document.getElementById('aylenVcResetPalette');
    if (resetBtn && !resetBtn._aylenBound) {
      resetBtn._aylenBound = true;
      resetBtn.addEventListener('click', function() {
        state.design.bgColorSolid = DEFAULT_DESIGN.bgColorSolid;
        state.design.bgColorTop = DEFAULT_DESIGN.bgColorTop;
        state.design.bgColorMid = DEFAULT_DESIGN.bgColorMid;
        state.design.bgColorBottom = DEFAULT_DESIGN.bgColorBottom;
        state.design.glowPink = DEFAULT_DESIGN.glowPink;
        state.design.glowBlue = DEFAULT_DESIGN.glowBlue;
        state.design.brandAccent = DEFAULT_DESIGN.brandAccent;
        state.design.brandLight = DEFAULT_DESIGN.brandLight;
        syncDesignFromForm();
        refreshPreview();
        notifyMsg('Site colors restored', 'success');
      });
    }

    var frontBgFile = document.getElementById('aylenVcFrontBgFile');
    if (frontBgFile && !frontBgFile._aylenBound) {
      frontBgFile._aylenBound = true;
      frontBgFile.addEventListener('change', function() {
        bindSideBgUpload('front', frontBgFile);
      });
    }
    var backBgFile = document.getElementById('aylenVcBackBgFile');
    if (backBgFile && !backBgFile._aylenBound) {
      backBgFile._aylenBound = true;
      backBgFile.addEventListener('change', function() {
        bindSideBgUpload('back', backBgFile);
      });
    }
    ['front', 'back'].forEach(function(side) {
      var cap = side.charAt(0).toUpperCase() + side.slice(1);
      var logoFile = document.getElementById('aylenVc' + cap + 'LogoFile');
      var logoUrl = document.getElementById('aylenVc' + cap + 'LogoUrl');
      if (logoFile && !logoFile._aylenBound) {
        logoFile._aylenBound = true;
        logoFile.addEventListener('change', function() {
          bindSideLogoUpload(side, logoFile);
        });
      }
      if (logoUrl && !logoUrl._aylenBound) {
        logoUrl._aylenBound = true;
        logoUrl.addEventListener('change', function() {
          state.design[side + 'LogoDataUrl'] = null;
          syncDesignFromForm();
          refreshPreview();
        });
      }
    });
    bindStylePicker();
    updateDesignUiLabels();
  }

  function bindSideLogoUpload(side, input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function() {
      state.design[side + 'LogoDataUrl'] = reader.result;
      saveDesignToStorage();
      refreshPreview();
    };
    reader.readAsDataURL(file);
  }

  function bindSideBgUpload(side, input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function() {
      state.design[side + 'BgImageDataUrl'] = reader.result;
      if (state.design[side + 'BgMode'] === 'default') {
        state.design[side + 'BgMode'] = 'blend';
        var cap = side.charAt(0).toUpperCase() + side.slice(1);
        var modeEl = document.getElementById('aylenVc' + cap + 'BgMode');
        if (modeEl) modeEl.value = 'blend';
      }
      saveDesignToStorage();
      updateDesignUiLabels();
      refreshPreview();
    };
    reader.readAsDataURL(file);
  }

  function codeOptions(selected) {
    var codes = Object.keys(global.cardHolders || {}).sort();
    if (!codes.length) {
      return '<option value="">— Create a code in Discount Codes first —</option>';
    }
    return codes.map(function(code) {
      var c = global.cardHolders[code] || {};
      var label = code + (c.name ? ' · ' + c.name : '');
      return '<option value="' + esc(code) + '"' + (code === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  async function renderPanel(mount) {
    if (!mount) return;
    state.panelMount = mount;
    loadDesignFromStorage();
    await ensureCardsLoaded();
    if (global.FBDB && global.FBDB.attachDiscountCardsListener) {
      global.FBDB.attachDiscountCardsListener();
    }

    var codes = Object.keys(global.cardHolders || {});
    var defaultCode = codes.length ? codes[0] : '';
    var d = state.design;

    mount.innerHTML =
      '<div class="aylen-vc-layout">' +
        '<div class="aylen-vc-controls aylen-panel-card">' +
          '<h3 style="margin:0 0 8px;font-size:16px">Visit cards</h3>' +
          '<p class="aylen-hint" style="margin:0 0 12px">Premium visit cards with QR — front &amp; back, print-ready.</p>' +
          stylePickerHtml(d.cardStyle) +
          '<label class="aylen-label" for="aylenVcCodeSelect">Discount code</label>' +
          '<select id="aylenVcCodeSelect" class="aylen-input">' + codeOptions(defaultCode) + '</select>' +
          sideLogoPanel('front', 'Front logo', d) +
          sideLogoPanel('back', 'Back logo', d) +
          '<div class="aylen-vc-section">' +
            '<h4 class="aylen-vc-section-title">Base colors</h4>' +
            '<label class="aylen-label" for="aylenVcBgMode">Base style</label>' +
            '<select id="aylenVcBgMode" class="aylen-input">' +
              '<option value="site"' + (d.bgMode === 'site' ? ' selected' : '') + '>Site gradient (editable palette)</option>' +
              '<option value="color"' + (d.bgMode === 'color' ? ' selected' : '') + '>Solid color</option>' +
            '</select>' +
            '<div id="aylenVcSolidField"' + (d.bgMode === 'color' ? '' : ' hidden') + '>' +
              colorField('aylenVcBgSolid', 'Solid background color', d.bgColorSolid) +
            '</div>' +
            '<div id="aylenVcPaletteFields"' + (d.bgMode === 'color' ? ' hidden' : '') + '>' +
              colorField('aylenVcBgTop', 'Gradient top', d.bgColorTop) +
              colorField('aylenVcBgMid', 'Gradient middle', d.bgColorMid) +
              colorField('aylenVcBgBottom', 'Gradient bottom', d.bgColorBottom) +
              colorField('aylenVcGlowPink', 'Pink glow', d.glowPink) +
              colorField('aylenVcGlowBlue', 'Blue glow', d.glowBlue) +
              colorField('aylenVcBrandAccent', 'Brand accent (pink)', d.brandAccent) +
              colorField('aylenVcBrandLight', 'Brand light (shimmer)', d.brandLight) +
              '<button type="button" class="aylen-btn aylen-btn-quiet aylen-vc-reset-palette" id="aylenVcResetPalette">Reset site colors</button>' +
            '</div>' +
          '</div>' +
          sideBgPanel('front', 'Front side background', d) +
          sideBgPanel('back', 'Back side background', d) +
          backPromoPanelHtml(d) +
          '<div class="aylen-vc-section">' +
            '<h4 class="aylen-vc-section-title">Front QR code (discount / shop)</h4>' +
            '<p class="aylen-hint" style="margin:0 0 8px">QR for aylensale.com + discount code. eBay QR is separate — back of card only.</p>' +
            '<label class="aylen-label" for="aylenVcQrSize">Size: <span id="aylenVcQrSizeVal">' + esc(String(d.qrSize)) + ' px</span></label>' +
            '<input id="aylenVcQrSize" class="aylen-vc-range" type="range" min="120" max="280" step="10" value="' + esc(String(d.qrSize)) + '">' +
            '<label class="aylen-label" for="aylenVcQrPos">Position on front</label>' +
            '<select id="aylenVcQrPos" class="aylen-input">' +
              '<option value="br"' + (d.qrPos === 'br' ? ' selected' : '') + '>Bottom right</option>' +
              '<option value="bl"' + (d.qrPos === 'bl' ? ' selected' : '') + '>Bottom left</option>' +
              '<option value="tr"' + (d.qrPos === 'tr' ? ' selected' : '') + '>Top right</option>' +
              '<option value="tl"' + (d.qrPos === 'tl' ? ' selected' : '') + '>Top left</option>' +
              '<option value="cr"' + (d.qrPos === 'cr' ? ' selected' : '') + '>Center right</option>' +
              '<option value="cc"' + (d.qrPos === 'cc' ? ' selected' : '') + '>Center</option>' +
            '</select>' +
            '<label class="aylen-label" for="aylenVcQrOffsetX">Shift left / right: <span id="aylenVcQrOffsetXVal">' + esc(String(d.qrOffsetX)) + '</span></label>' +
            '<input id="aylenVcQrOffsetX" class="aylen-vc-range" type="range" min="-120" max="120" step="5" value="' + esc(String(d.qrOffsetX)) + '">' +
            '<label class="aylen-label" for="aylenVcQrOffsetY">Shift up / down: <span id="aylenVcQrOffsetYVal">' + esc(String(d.qrOffsetY)) + '</span></label>' +
            '<input id="aylenVcQrOffsetY" class="aylen-vc-range" type="range" min="-120" max="120" step="5" value="' + esc(String(d.qrOffsetY)) + '">' +
          '</div>' +
          '<div class="aylen-vc-actions">' +
            '<button type="button" class="aylen-btn" id="aylenVcRefreshBtn"><i class="fas fa-rotate"></i> Preview</button>' +
            '<button type="button" class="aylen-btn aylen-btn-quiet" id="aylenVcPngBtn"><i class="fas fa-download"></i> PNG</button>' +
            '<button type="button" class="aylen-btn aylen-btn-quiet" id="aylenVcPdfBtn"><i class="fas fa-file-pdf"></i> PDF</button>' +
            '<button type="button" class="aylen-btn aylen-btn-quiet" id="aylenVcPrintBtn"><i class="fas fa-print"></i> Print</button>' +
          '</div>' +
          '<p class="aylen-vc-meta" id="aylenVcMeta"></p>' +
        '</div>' +
        '<div class="aylen-vc-preview-wrap">' +
          '<span class="aylen-vc-preview-label">Preview — front &amp; back (85 × 55 mm each)</span>' +
          '<div class="aylen-vc-preview-frame" id="aylenVcPreviewFrame">' +
            '<p class="aylen-hint">Select a code and click Preview</p>' +
          '</div>' +
        '</div>' +
      '</div>';

    var sel = document.getElementById('aylenVcCodeSelect');
    if (sel) {
      sel.addEventListener('change', function() { refreshPreview(); });
    }
    bindDesignControls();

    bindAction('aylenVcRefreshBtn', refreshPreview);
    bindAction('aylenVcPngBtn', downloadPng);
    bindAction('aylenVcPdfBtn', downloadPdf);
    bindAction('aylenVcPrintBtn', printCard);

    if (defaultCode) {
      setTimeout(function() { refreshPreview(); }, 120);
    }
  }

  global.AyelenAdminVisitCards = {
    renderPanel: renderPanel,
    refreshPreview: refreshPreview,
    cardUrl: cardUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
