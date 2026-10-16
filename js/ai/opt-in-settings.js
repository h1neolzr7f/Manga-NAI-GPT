/* Opt-in experiment switches in 服务设置 (all default OFF): <input type=checkbox data-optin="localStorage key">.
 * Checked = '1', unchecked = key removed, so nothing changes for users who never touch them. */
(function (root) {
  'use strict';
  function get(k) { try { return root.localStorage && root.localStorage.getItem(k) === '1'; } catch (e) { return false; } }
  function set(k, on) { try { if (on) root.localStorage.setItem(k, '1'); else root.localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  function bind(doc) {
    (doc || root.document).querySelectorAll('input[data-optin]').forEach(el => {
      const k = el.getAttribute('data-optin'); el.checked = get(k);
      el.addEventListener('change', () => { set(k, el.checked); if (root.dispatchEvent && root.CustomEvent) root.dispatchEvent(new root.CustomEvent('mnai-optin', { detail: { key: k, on: el.checked } })); });
    });
  }
  root.MangaOptIn = Object.freeze({ get, set, bind, KEYS: ['mnai.naiProfileP', 'mnai.charAutoNeg', 'mnai.eraseSceneText', 'mnai.perspectiveText'] });
  if (root.document && root.document.addEventListener) root.document.addEventListener('DOMContentLoaded', () => bind());
})(typeof window !== 'undefined' ? window : globalThis);
