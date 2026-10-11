/* 2.0 history: name an undo step by diffing two saved canvas states (pure, unit-tested).
 * Used when no command announced itself; e.g. "添加文字「早上好」", "移动 图片", "删除 气泡". */
(function (root) {
  'use strict';
  const GEOM = ['left', 'top', 'scaleX', 'scaleY', 'angle', 'width', 'height', 'skewX', 'skewY', 'flipX', 'flipY'];
  function kind(o) {
    if (!o) return '对象';
    if (o.aiFill) return 'AI 填充层';
    if (o.autoSwap) return '换角色层';
    const t = String(o.type || '').toLowerCase();
    if (/text/.test(t)) return '文字' + (o.text ? '「' + String(o.text).replace(/\s+/g, ' ').slice(0, 10) + '」' : '');
    if (t === 'image') return o.name && !/^图片 \d+$/.test(o.name) ? '图层「' + String(o.name).slice(0, 12) + '」' : '图片';
    if (o.isSpeechBubble || /bubble/i.test(o.name || '') || (t === 'group' && o.guids)) return '气泡';
    if (t === 'path') return '笔画';
    if (t === 'rect' || t === 'polygon') return o.isPanel ? '分格' : '形状';
    return o.name ? '「' + String(o.name).slice(0, 12) + '」' : t || '对象';
  }
  function key(o, i) { return o && (o.guid || o.id) ? String(o.guid || o.id) : 'i' + i; }
  function sameJSON(a, b, skip) {
    const ka = Object.keys(a || {}), kb = Object.keys(b || {});
    for (const k of new Set(ka.concat(kb))) { if (skip && skip.includes(k)) continue; if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false; }
    return true;
  }
  function describe(prev, cur) { return raw(prev, cur).replace(/([\u4e00-\u9fff])([A-Za-z])/g, '$1 $2'); }
  function raw(prev, cur) {
    const A = (prev && prev.objects) || [], B = (cur && cur.objects) || [];
    if (!prev) return '开始';
    const ka = new Map(A.map((o, i) => [key(o, i), o])), kb = new Map(B.map((o, i) => [key(o, i), o]));
    const added = B.filter((o, i) => !ka.has(key(o, i))), removed = A.filter((o, i) => !kb.has(key(o, i)));
    if (added.length && !removed.length) return added.length === 1 ? '添加' + kind(added[0]) : '添加 ' + added.length + ' 个对象（' + kind(added[added.length - 1]) + '…）';
    if (removed.length && !added.length) return removed.length === 1 ? '删除' + kind(removed[0]) : '删除 ' + removed.length + ' 个对象';
    if (added.length && removed.length) return added.length === 1 && removed.length === 1 && added[0].type === removed[0].type ? '替换' + kind(added[0]) : '修改 ' + (added.length + removed.length) + ' 个对象';
    const changed = [];
    for (const [k, b] of kb) { const a = ka.get(k); if (a && !sameJSON(a, b)) changed.push([a, b]); }
    // same objects, different order -> layer order
    if (!changed.length) {
      const order = A.map(key).join('|') !== B.map(key).join('|');
      if (order) return '调整图层顺序';
      if (JSON.stringify(prev.background || prev.backgroundColor) !== JSON.stringify(cur.background || cur.backgroundColor)) return '修改背景';
      return '修改页面';
    }
    if (changed.length > 1) return changed.every(([a, b]) => sameJSON(a, b, GEOM)) ? '移动 / 变形 ' + changed.length + ' 个对象' : '修改 ' + changed.length + ' 个对象';
    const [a, b] = changed[0];
    if (a.visible !== b.visible && sameJSON(a, b, ['visible'])) return (b.visible === false ? '隐藏' : '显示') + kind(b);
    if (a.text !== b.text && b.text !== undefined) return '修改文字「' + String(b.text).replace(/\s+/g, ' ').slice(0, 10) + '」';
    if (a.opacity !== b.opacity && sameJSON(a, b, ['opacity'])) return '不透明度 ' + Math.round((b.opacity == null ? 1 : b.opacity) * 100) + '% · ' + kind(b);
    if (sameJSON(a, b, GEOM)) {
      const moved = a.left !== b.left || a.top !== b.top, scaled = a.scaleX !== b.scaleX || a.scaleY !== b.scaleY || a.width !== b.width || a.height !== b.height, rot = a.angle !== b.angle;
      return (rot ? '旋转' : scaled ? '缩放' : moved ? '移动' : '变形') + kind(b);
    }
    if (a.aiFill && b.aiFill && a.aiFill.chosen !== b.aiFill.chosen) return 'AI 填充：换成第 ' + (b.aiFill.chosen + 1) + ' 张';
    if (a.fill !== b.fill || a.stroke !== b.stroke) return '改颜色 · ' + kind(b);
    return '修改' + kind(b);
  }
  root.HistoryLabels = { describe, kind };
})(typeof window !== 'undefined' ? window : globalThis);
