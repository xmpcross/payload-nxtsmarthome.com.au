/*
 * Sovrn Commerce (VigLink) loader, as Sovrn's install snippet does it: set the
 * vglnk key, then load vglnk.js asynchronously. The key comes from the
 * data-key attribute (components/VigLink.tsx), so the snippet text exists once
 * instead of again in the React payload.
 */
(function (d) {
  var me = d.currentScript;
  var key = me && me.getAttribute('data-key');
  if (!key || window.vglnk) return;
  window.vglnk = { key: key };
  var s = d.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  s.src = '//cdn.viglink.com/api/vglnk.js';
  var r = d.getElementsByTagName('script')[0];
  r.parentNode.insertBefore(s, r);
})(document);
