/**
 * AYLENSALE Security Module
 * Provides spam protection, rate limiting, and input validation
 * 
 * Features:
 * - Order submission rate limiting (max 5 per hour per IP/session)
 * - Form submission rate limiting (max 3 per minute)
 * - Bot detection using simple heuristics
 * - Input validation for phone, email, names
 * - Blocking empty or fake submissions
 */

var SECURITY = {
  // Rate limiting storage
  orderAttempts: [],
  formAttempts: [],
  lastSubmissionTime: 0,
  sessionId: generateSessionId(),
  
  /**
   * Generate unique session ID for rate limiting
   */
  generateSessionId: function() {
    if (window.sessionStorage && sessionStorage.getItem('aylen_session_id')) {
      return sessionStorage.getItem('aylen_session_id');
    }
    var id = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    if (window.sessionStorage) {
      sessionStorage.setItem('aylen_session_id', id);
    }
    return id;
  },
  
  /**
   * Check if order submission should be rate limited
   * Max 5 orders per hour
   */
  checkOrderRateLimit: function() {
    var now = Date.now();
    var oneHourAgo = now - 3600000;
    
    // Clean old attempts
    this.orderAttempts = this.orderAttempts.filter(function(time) {
      return time > oneHourAgo;
    });
    
    // Check limit
    if (this.orderAttempts.length >= 5) {
      return {
        allowed: false,
        reason: 'Too many orders sent. Please wait before placing another order (max 5 per hour).',
        remaining: 0
      };
    }
    
    // Record this attempt
    this.orderAttempts.push(now);
    localStorage.setItem('aylen_order_attempts', JSON.stringify(this.orderAttempts));
    
    return {
      allowed: true,
      remaining: 5 - this.orderAttempts.length
    };
  },
  
  /**
   * Check if form submission should be rate limited
   * Max 3 per minute (for notify requests, feedback, etc)
   */
  checkFormRateLimit: function() {
    var now = Date.now();
    var oneMinuteAgo = now - 60000;
    
    // Clean old attempts
    this.formAttempts = this.formAttempts.filter(function(time) {
      return time > oneMinuteAgo;
    });
    
    // Check limit
    if (this.formAttempts.length >= 3) {
      return {
        allowed: false,
        reason: 'Too many requests. Please wait a moment before trying again.',
        remaining: 0
      };
    }
    
    // Record this attempt
    this.formAttempts.push(now);
    
    return {
      allowed: true,
      remaining: 3 - this.formAttempts.length
    };
  },
  
  /**
   * Detect potential bot submissions using simple heuristics
   */
  detectBot: function(name, email, phone, comment) {
    var suspicion = 0;
    
    // Check for extremely short names
    if (name && name.trim().length < 2) suspicion += 2;
    
    // Check for names that are too long
    if (name && name.trim().length > 100) suspicion += 1;
    
    // Check for only numbers in name
    if (name && /^\d+$/.test(name.replace(/\s/g, ''))) suspicion += 3;
    
    // Check for spam keywords in name
    var spamKeywords = ['viagra', 'casino', 'lottery', 'bitcoin', 'forex', 'crypto', 'xxx', 'porn', 'sex', 'hack', 'crack', 'free money', 'nigerian'];
    var nameLower = (name || '').toLowerCase();
    for (var i = 0; i < spamKeywords.length; i++) {
      if (nameLower.indexOf(spamKeywords[i]) !== -1) {
        suspicion += 5;
      }
    }
    
    // Check for email issues
    if (email && email.indexOf('@') === -1) suspicion += 2;
    if (email && email.split('@').length > 2) suspicion += 2;
    
    // Check for suspicious emails
    var suspiciousEmailPatterns = ['test@', 'fake@', 'spam@', 'bot@', 'admin@admin'];
    var emailLower = (email || '').toLowerCase();
    for (var i = 0; i < suspiciousEmailPatterns.length; i++) {
      if (emailLower.indexOf(suspiciousEmailPatterns[i]) !== -1) {
        suspicion += 3;
      }
    }
    
    // Check phone format
    if (phone && phone.replace(/\D/g, '').length < 8) suspicion += 1;
    if (phone && phone.replace(/\D/g, '').length > 15) suspicion += 1;
    
    // Check for repeating patterns in phone
    if (phone && /(.)\1{4,}/.test(phone)) suspicion += 2;
    
    // Check for spam in comment
    var commentLower = (comment || '').toLowerCase();
    var spamPhrases = ['click here', 'buy now', 'click link', 'free money', 'guaranteed', 'you won', 'congratulations', 'claim prize'];
    for (var i = 0; i < spamPhrases.length; i++) {
      if (commentLower.indexOf(spamPhrases[i]) !== -1) {
        suspicion += 3;
      }
    }
    
    // Check for too many URLs in comment
    var urlMatches = (comment || '').match(/https?:\/\//g) || [];
    if (urlMatches.length > 1) suspicion += 5;
    
    // Result
    return {
      isBot: suspicion >= 5,
      suspicion: suspicion,
      reason: suspicion >= 5 ? 'Submission appears to be automated or spam' : null
    };
  },
  
  /**
   * Validate customer name
   */
  validateName: function(name) {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Name is required' };
    }
    
    var trimmed = name.trim();
    
    if (trimmed.length < 2) {
      return { valid: false, error: 'Name must be at least 2 characters' };
    }
    
    if (trimmed.length > 100) {
      return { valid: false, error: 'Name is too long' };
    }
    
    // Check for valid characters (letters, numbers, spaces, hyphens, apostrophes)
    if (!/^[a-zA-Z0-9\s\-\']+$/.test(trimmed)) {
      return { valid: false, error: 'Name contains invalid characters' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate phone number
   */
  validatePhone: function(phone) {
    if (!phone || phone.trim().length === 0) {
      return { valid: false, error: 'Phone number is required' };
    }
    
    var trimmed = phone.trim();
    var digitsOnly = trimmed.replace(/\D/g, '');
    
    if (digitsOnly.length < 8) {
      return { valid: false, error: 'Phone number must have at least 8 digits' };
    }
    
    if (digitsOnly.length > 15) {
      return { valid: false, error: 'Phone number is too long' };
    }
    
    // Basic phone format check
    var phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(trimmed)) {
      return { valid: false, error: 'Phone number format is invalid' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate email (optional field)
   */
  validateEmail: function(email) {
    if (!email || email.trim().length === 0) {
      return { valid: true }; // Optional field
    }
    
    var trimmed = email.trim();
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmed)) {
      return { valid: false, error: 'Email format is invalid' };
    }
    
    if (trimmed.length > 100) {
      return { valid: false, error: 'Email is too long' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate comment (optional field)
   */
  validateComment: function(comment) {
    if (!comment || comment.trim().length === 0) {
      return { valid: true }; // Optional field
    }
    
    var trimmed = comment.trim();
    
    if (trimmed.length > 500) {
      return { valid: false, error: 'Comment is too long (max 500 characters)' };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate all order form data
   */
  validateOrderForm: function(name, phone, pickup, comment) {
    // Validate each field
    var nameValidation = this.validateName(name);
    if (!nameValidation.valid) {
      return nameValidation;
    }
    
    var phoneValidation = this.validatePhone(phone);
    if (!phoneValidation.valid) {
      return phoneValidation;
    }
    
    var commentValidation = this.validateComment(comment);
    if (!commentValidation.valid) {
      return commentValidation;
    }
    
    // Check for bot behavior
    var botCheck = this.detectBot(name, '', phone, comment);
    if (botCheck.isBot) {
      return { valid: false, error: botCheck.reason };
    }
    
    return { valid: true };
  },
  
  /**
   * Initialize rate limiting from stored data
   */
  init: function() {
    try {
      var stored = localStorage.getItem('aylen_order_attempts');
      if (stored) {
        this.orderAttempts = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not load rate limit data', e);
    }
    
    this.sessionId = this.generateSessionId();
  }
};

// Generate session ID function
function generateSessionId() {
  if (window.sessionStorage && sessionStorage.getItem('aylen_session_id')) {
    return sessionStorage.getItem('aylen_session_id');
  }
  var id = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  if (window.sessionStorage) {
    try {
      sessionStorage.setItem('aylen_session_id', id);
    } catch (e) {
      console.warn('sessionStorage not available');
    }
  }
  return id;
}

// Initialize security module on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    SECURITY.init();
  });
} else {
  SECURITY.init();
}
