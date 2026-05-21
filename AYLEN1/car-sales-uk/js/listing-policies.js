/**
 * Listing policies — UK Consumer Rights Act 2015 aware templates.
 */
var listingPolicies = [];

function policyEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

var DEFAULT_LISTING_POLICIES = [
  {
    id: 'policy_amazon_returns',
    title: 'Amazon Returns / Untested Job Lot',
    conditionText: 'Mixed Amazon customer returns and warehouse clearance. Items are sold as untested job lots; condition varies item to item.',
    returnPolicy: 'Returns accepted if the lot is materially not as described. Individual item returns are not offered for untested bulk lots. Your statutory UK consumer rights still apply where goods are not as described, not of satisfactory quality, or not fit for purpose.',
    warrantyText: 'No individual item warranty is provided for untested bulk lots. Any manufacturer warranty may still apply to specific items where transferable.',
    deliveryRules: 'Collection from advertised UK pickup points is preferred. Delivery may be arranged by agreement; risk passes on collection or confirmed delivery.',
    ukDisclaimer: 'This policy does not remove your rights under the UK Consumer Rights Act 2015. We cannot exclude liability for goods not as described.',
    jobLot: true,
    sortOrder: 1
  },
  {
    id: 'policy_faulty_parts',
    title: 'Faulty / For Parts',
    conditionText: 'Sold for repair, spares, or parts only. Item may be faulty, incomplete, or untested.',
    returnPolicy: 'Returns accepted within 14 days if the item is materially not as described. No guarantee of working order.',
    warrantyText: 'Sold without warranty unless expressly stated otherwise on the listing.',
    deliveryRules: 'UK collection or courier by arrangement. Buyer is responsible for checking compatibility before purchase.',
    ukDisclaimer: 'Consumer Rights Act 2015 applies. Faulty/for-parts listings must still match their description.',
    jobLot: false,
    sortOrder: 2
  },
  {
    id: 'policy_used_tested',
    title: 'Used Tested',
    conditionText: 'Used item tested for basic function before listing unless stated otherwise.',
    returnPolicy: '30-day returns if not as described. Statutory consumer rights apply for faults not disclosed in the listing.',
    warrantyText: 'No new manufacturer warranty unless stated. 30-day AYLENSALE return window for misdescription.',
    deliveryRules: 'Collection or UK delivery options as shown at checkout / order confirmation.',
    ukDisclaimer: 'Your legal rights under the Consumer Rights Act 2015 are not affected by this policy summary.',
    jobLot: false,
    sortOrder: 3
  },
  {
    id: 'policy_new_open_box',
    title: 'New / Open Box',
    conditionText: 'New or open-box item. Packaging may be opened for inspection; accessories as pictured.',
    returnPolicy: '14-day change-of-mind style returns where stated, plus full statutory rights if faulty or not as described.',
    warrantyText: 'Manufacturer warranty may apply where included. Contact us with order details for warranty support.',
    deliveryRules: 'Standard UK collection points or agreed delivery.',
    ukDisclaimer: 'We do not limit statutory remedies for defective or misdescribed goods.',
    jobLot: false,
    sortOrder: 4
  },
  {
    id: 'policy_collection_only',
    title: 'Collection Only',
    conditionText: 'Item must be collected from the advertised UK pickup location. Not available for postal delivery unless agreed in writing.',
    returnPolicy: 'Returns per listing condition text and UK consumer law where goods are not as described.',
    warrantyText: 'As stated on the individual product listing.',
    deliveryRules: 'Collection only from published car boot / warehouse pickup points.',
    ukDisclaimer: 'Collection terms do not remove consumer rights for misdescribed goods.',
    jobLot: false,
    sortOrder: 5
  },
  {
    id: 'policy_job_lot_no_individual_returns',
    title: 'No Individual Item Returns for Job Lots',
    conditionText: 'Bulk job lot / pallet / mixed box. Buyer receives a random or mixed selection as shown. Items are untested unless stated.',
    returnPolicy: 'No returns on individual items from the lot. Whole-lot return only if the lot is materially not as described (wrong category, empty box, etc.).',
    warrantyText: 'No per-item warranty on bulk untested lots.',
    deliveryRules: 'Collection strongly recommended due to weight/volume. Buyer must inspect lot at collection where possible.',
    ukDisclaimer: 'Job-lot terms cannot override rights when the entire lot is not as described under UK consumer law.',
    jobLot: true,
    sortOrder: 6
  }
];

function normalizeListingPolicy(docId, raw) {
  var item = raw || {};
  return {
    id: docId,
    title: item.title || 'Listing policy',
    conditionText: item.conditionText || item.condition || '',
    returnPolicy: item.returnPolicy || '',
    warrantyText: item.warrantyText || '',
    deliveryRules: item.deliveryRules || item.delivery || '',
    ukDisclaimer: item.ukDisclaimer || item.disclaimer || '',
    jobLot: item.jobLot === true,
    sortOrder: Number(item.sortOrder || 0),
    updatedAt: item.updatedAt || null
  };
}

function getListingPolicyById(policyId) {
  var id = String(policyId || '').trim();
  if (!id) return null;
  for (var i = 0; i < listingPolicies.length; i++) {
    if (listingPolicies[i].id === id) return listingPolicies[i];
  }
  return null;
}

function listingPolicyOptionsHtml(selectedId) {
  var html = '<option value="">— Select listing policy —</option>';
  var list = listingPolicies.slice().sort(function(a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    html += '<option value="' + policyEscapeHtml(p.id) + '"' + (String(selectedId) === String(p.id) ? ' selected' : '') + '>' +
      policyEscapeHtml(p.title) + '</option>';
  }
  return html;
}

function renderListingPolicySummary(policy) {
  if (!policy) return '';
  var lines = [
    policy.conditionText,
    policy.returnPolicy,
    policy.warrantyText,
    policy.deliveryRules
  ].filter(Boolean);
  var body = lines.join('\n\n');
  return '<div class="listing-policy-box">' +
    '<div class="listing-policy-title"><i class="fas fa-scale-balanced"></i> ' + policyEscapeHtml(policy.title) + '</div>' +
    '<div class="listing-policy-text listing-policy-clamp">' + policyEscapeHtml(body).replace(/\n/g, '<br>') + '</div>' +
    '<div class="listing-policy-disclaimer">' + policyEscapeHtml(policy.ukDisclaimer || '') + '</div>' +
  '</div>';
}

window.AYLEN_LISTING_POLICIES = {
  defaults: DEFAULT_LISTING_POLICIES,
  normalize: normalizeListingPolicy,
  getById: getListingPolicyById,
  optionsHtml: listingPolicyOptionsHtml,
  renderSummary: renderListingPolicySummary
};
