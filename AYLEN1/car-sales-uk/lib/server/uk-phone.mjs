/**
 * UK phone canonicalization — +44 / 0044 / 07… treated as the same number.
 */
export function canonicalUkPhoneDigits(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0044')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0') && digits.length >= 10 && digits.length <= 11) {
    digits = '44' + digits.slice(1);
  }

  return digits;
}

export function ukPhonesMatch(a, b) {
  const left = canonicalUkPhoneDigits(a);
  const right = canonicalUkPhoneDigits(b);
  if (!left || !right || left.length < 10 || right.length < 10) return false;
  return left === right;
}
