/* Demo log in / sign up. Stores only a display name; the password is checked for presence and never stored or read further. */
(function () {
  'use strict';
  const { esc } = DH;
  const main = DH.page({ title: 'Log in', active: '' });

  const SAFE_NEXT = /^[\w-]+\.html(\?.*)?$/;
  const nextRaw = DH.qs('next');
  const next = nextRaw && SAFE_NEXT.test(nextRaw) && !/^login\.html/.test(nextRaw) ? nextRaw : 'home.html';
  const u = DH.user();
  let mode = DH.qs('mode') === 'signup' ? 'signup' : 'login';

  const wrap = DH.h('<div class="lg-wrap"></div>');
  main.appendChild(wrap);

  function render() {
    const signup = mode === 'signup';
    wrap.innerHTML = `<section class="dh-card lg-card">
      <div class="lg-brand"><span class="dh-logo-mark"></span><span>deriv <b>hub</b></span></div>
      ${u ? `<div class="lg-already">Signed in as <b>${esc(u.name)}</b>. <a href="${esc(next)}">Continue ›</a></div>` : ''}
      <div class="lg-tabs"></div>
      <form class="lg-form" novalidate>
        <label>Email<input class="dh-input" name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label>
        ${signup ? '<label>Display name<input class="dh-input" name="name" maxlength="32" autocomplete="nickname" placeholder="Shown in the header"></label>' : ''}
        <label>Password<input class="dh-input" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required></label>
        <p class="lg-err down" hidden></p>
        <button class="dh-btn primary lg-submit" type="submit">${signup ? 'Create demo account' : 'Log in'}</button>
      </form>
      <p class="lg-note">Demo only — no account is created and no password is stored.</p>
    </section>`;
    DH.$('.lg-tabs', wrap).appendChild(
      DH.seg([['login', 'Log in'], ['signup', 'Sign up']], mode, (v) => {
        mode = v;
        render();
      }, 'tabs'),
    );
    DH.$('.lg-form', wrap).addEventListener('submit', submit);
    DH.$('[name="email"]', wrap).focus();
  }

  function submit(e) {
    e.preventDefault();
    const f = e.currentTarget;
    const err = DH.$('.lg-err', f);
    const field = (n) => f.elements.namedItem(n);
    const email = field('email').value.trim();
    const pw = field('password');
    // The password is only checked for presence, then cleared; it is never stored or sent anywhere.
    const hasPassword = pw.value.length > 0;
    pw.value = '';
    const fail = (msg) => {
      err.textContent = msg;
      err.hidden = false;
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address.');
    if (!hasPassword) return fail('Enter a password.');
    const local = email.split('@')[0].replace(/[^\w.-]/g, '').slice(0, 32) || 'Trader';
    const chosen = mode === 'signup' ? (field('name')?.value || '').trim().slice(0, 32) : '';
    DH.store.set('user', { name: chosen || local, since: Date.now() });
    location.href = next;
  }

  render();
})();
