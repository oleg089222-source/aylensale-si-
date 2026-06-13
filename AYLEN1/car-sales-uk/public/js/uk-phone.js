/**
 * Client UK phone canonicalization (mirrors lib/server/uk-phone.mjs).
 */
(function(global) {
  function canonicalUkPhoneDigits(phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';

    if (digits.indexOf('0044') === 0) {
      digits = digits.slice(2);
    }

    if (digits.charAt(0) === '0' && digits.length >= 10 && digits.length <= 11) {
      digits = '44' + digits.slice(1);
    }

    return digits;
  }

  function ukPhonesMatch(a, b) {
    var left = canonicalUkPhoneDigits(a);
    var right = canonicalUkPhoneDigits(b);
    if (!left || !right || left.length < 10 || right.length < 10) return false;
    return left === right;
  }

  global.AYLEN_UK_PHONE = {
    canonicalUkPhoneDigits: canonicalUkPhoneDigits,
    ukPhonesMatch: ukPhonesMatch
  };
})(window);
