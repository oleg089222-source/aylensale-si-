/**
 * Admin Settings — change password (current → new, synced to Firebase + server store).
 */
(function(global) {
  function notifyMsg(msg, type) {
    if (typeof notify === 'function') notify(msg, type);
  }

  function bindPasswordToggle(inputId, btnId) {
    var input = document.getElementById(inputId);
    var btn = document.getElementById(btnId);
    if (!input || !btn || btn._aylenBound) return;
    btn._aylenBound = true;
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.innerHTML = show
        ? '<i class="fas fa-eye-slash" aria-hidden="true"></i>'
        : '<i class="fas fa-eye" aria-hidden="true"></i>';
    });
  }

  function bindForm() {
    bindPasswordToggle('aylenPwdCurrent', 'aylenPwdCurrentToggle');
    bindPasswordToggle('aylenPwdNew', 'aylenPwdNewToggle');
    bindPasswordToggle('aylenPwdConfirm', 'aylenPwdConfirmToggle');

    var form = document.getElementById('aylenChangePasswordForm');
    if (!form || form._aylenBound) return;
    form._aylenBound = true;
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      submitChangePassword();
    });
  }

  function passwordField(id, toggleId, label, autocomplete) {
    return (
      '<label class="aylen-label" for="' + id + '">' + label + '</label>' +
      '<div class="aylen-password-wrap">' +
        '<input type="password" id="' + id + '" class="aylen-password-input aylen-admin-input" autocomplete="' + autocomplete + '" required minlength="8" maxlength="200">' +
        '<button type="button" id="' + toggleId + '" class="aylen-password-toggle" aria-label="Show password" aria-pressed="false">' +
          '<i class="fas fa-eye" aria-hidden="true"></i>' +
        '</button>' +
      '</div>'
    );
  }

  function renderPanel(mount) {
    if (!mount) return;
    mount.innerHTML =
      '<section class="aylen-panel-card aylen-password-card">' +
        '<h3 class="aylen-page-title" style="margin:0 0 8px;font-size:18px">Admin password</h3>' +
        '<p class="aylen-hint" style="margin:0 0 14px">Change your CMS login password. Updates Firebase sign-in immediately — no Vercel redeploy needed.</p>' +
        '<form id="aylenChangePasswordForm" class="aylen-password-form" novalidate>' +
          passwordField('aylenPwdCurrent', 'aylenPwdCurrentToggle', 'Current password', 'current-password') +
          passwordField('aylenPwdNew', 'aylenPwdNewToggle', 'New password (min 8 characters)', 'new-password') +
          passwordField('aylenPwdConfirm', 'aylenPwdConfirmToggle', 'Confirm new password', 'new-password') +
          '<button type="submit" id="aylenPwdSubmit" class="aylen-btn" style="margin-top:12px;width:100%">Save new password</button>' +
        '</form>' +
      '</section>';
    bindForm();
  }

  async function submitChangePassword() {
    var currentEl = document.getElementById('aylenPwdCurrent');
    var newEl = document.getElementById('aylenPwdNew');
    var confirmEl = document.getElementById('aylenPwdConfirm');
    var submitBtn = document.getElementById('aylenPwdSubmit');
    if (!currentEl || !newEl || !confirmEl) return;

    var currentPassword = currentEl.value;
    var newPassword = newEl.value;
    var confirmPassword = confirmEl.value;

    if (!currentPassword) {
      notifyMsg('Enter your current password.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      notifyMsg('New password must be at least 8 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      notifyMsg('New password and confirmation do not match.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
    }

    try {
      var res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-password',
          currentPassword: currentPassword,
          newPassword: newPassword,
          confirmPassword: confirmPassword
        })
      });
      var data = {};
      try {
        data = await res.json();
      } catch (e2) {}

      if (!res.ok) {
        throw new Error(data.error || 'Could not change password.');
      }

      var login = 'admin';
      if (global.AYLEN_ADMIN_SESSION && global.AYLEN_ADMIN_SESSION.getSessionLogin) {
        login = global.AYLEN_ADMIN_SESSION.getSessionLogin() || login;
      }
      var remember = global.AYLEN_ADMIN_SESSION && global.AYLEN_ADMIN_SESSION.hasRememberEnabled
        ? global.AYLEN_ADMIN_SESSION.hasRememberEnabled()
        : true;

      if (global.AYLEN_ADMIN_SESSION && global.AYLEN_ADMIN_SESSION.persistSession) {
        global.AYLEN_ADMIN_SESSION.persistSession(login, newPassword, remember);
      }

      if (global.FBDB && global.FBDB.signInAdmin) {
        try {
          await global.FBDB.signInAdmin(newPassword, login);
        } catch (signErr) {
          console.warn('[AYLEN] Re-sign-in after password change:', signErr);
        }
      }

      currentEl.value = '';
      newEl.value = '';
      confirmEl.value = '';
      notifyMsg(data.message || 'Password updated successfully.', 'success');
    } catch (err) {
      notifyMsg(err.message || 'Could not change password.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save new password';
      }
    }
  }

  global.AyelenAdminPassword = {
    renderPanel: renderPanel
  };
})(typeof window !== 'undefined' ? window : globalThis);
