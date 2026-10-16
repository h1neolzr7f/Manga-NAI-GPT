/* Backend route: NovelAI and the user's own local/self-hosted services vs third-party image services (GPT).
 * The tool never filters or rewrites prompts on any route. Third-party route only shows a one-time reminder
 * that the provider's own usage rules apply (the provider may refuse on its own). */
(function (root) {
  'use strict';
  const OWN = { novelai: true, local: true, cutout: true, 'self-hosted': true };
  const shown = {};
  function routeOf(service) { return OWN[String(service || '').toLowerCase()] ? 'own' : 'third-party'; }
  function noticeText(service) {
    const name = service === 'gpt' ? 'GPT 图像服务' : String(service || '第三方服务');
    return '提醒：这次请求发往 ' + name + '，请遵守该服务的使用规则；它可能自行拒绝部分请求。本工具不会过滤或改写你的提示词。';
  }
  /** Returns the reminder text once per session per third-party service, else ''. Shows it via toast when available. */
  function notice(service) {
    if (routeOf(service) === 'own' || shown[service]) return '';
    shown[service] = true;
    const t = noticeText(service);
    if (typeof root.createToast === 'function') { try { root.createToast('第三方服务', t); } catch (e) { /* ignore */ } }
    return t;
  }
  function _reset() { Object.keys(shown).forEach(k => delete shown[k]); }
  root.ProviderRoute = Object.freeze({ routeOf, notice, noticeText, _reset });
})(typeof window !== 'undefined' ? window : globalThis);
