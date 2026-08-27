(function () {
  'use strict';

  var STYLE = [
    '#ips-fab{position:fixed;right:16px;bottom:16px;z-index:9999;width:48px;height:48px;border-radius:50%;',
    'background:var(--route,#0b3c6e);color:#fff;border:none;box-shadow:0 2px 10px rgba(0,0,0,0.3);',
    'display:flex;align-items:center;justify-content:center;font-size:1.3rem;cursor:pointer;}',
    '#ips-fab:active{transform:scale(0.94);}',
    '#ips-bar{position:fixed;left:0;right:0;bottom:0;z-index:10000;background:var(--surface,#fffdf7);',
    'border-top:1px solid var(--line,#ddd8c8);box-shadow:0 -2px 10px rgba(0,0,0,0.15);',
    'padding:0.6rem 0.6rem calc(0.6rem + env(safe-area-inset-bottom,0px));display:none;',
    'font-family:-apple-system,"Segoe UI","Pretendard","Noto Sans KR",sans-serif;}',
    '#ips-bar.ips-open{display:block;}',
    '#ips-row{display:flex;align-items:center;gap:0.4rem;}',
    '#ips-input{flex:1;min-width:0;padding:0.55rem 0.7rem;border:1px solid var(--line,#ddd8c8);',
    'border-radius:8px;font-size:16px;background:var(--bg-soft,#f7f5ec);color:var(--ink,#1e2a2f);}',
    '#ips-count{font-size:0.75rem;color:var(--ink-soft,#4c5a5f);white-space:nowrap;min-width:3.2em;text-align:center;}',
    '.ips-btn{border:1px solid var(--line,#ddd8c8);background:var(--surface,#fffdf7);color:var(--ink,#1e2a2f);',
    'border-radius:8px;width:2.3rem;height:2.3rem;display:flex;align-items:center;justify-content:center;',
    'font-size:1rem;cursor:pointer;flex:none;}',
    '.ips-btn:active{background:var(--bg-soft,#f7f5ec);}',
    '#ips-close{border:none;background:transparent;color:var(--ink-soft,#4c5a5f);font-size:1.3rem;',
    'width:2.3rem;height:2.3rem;flex:none;cursor:pointer;}',
    'mark.ips-hit{background:#ffe066;color:#1e2a2f;border-radius:2px;padding:0 1px;}',
    'mark.ips-hit.ips-current{background:#ff9800;color:#fff;}'
  ].join('');

  function injectStyle() {
    var s = document.createElement('style');
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function buildUI() {
    var fab = document.createElement('button');
    fab.id = 'ips-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', '페이지 내 검색');
    fab.innerHTML = '🔍';

    var bar = document.createElement('div');
    bar.id = 'ips-bar';
    bar.innerHTML =
      '<div id="ips-row">' +
      '<input id="ips-input" type="search" inputmode="search" placeholder="페이지 내 검색..." autocomplete="off">' +
      '<span id="ips-count"></span>' +
      '<button type="button" class="ips-btn" id="ips-prev" aria-label="이전">▲</button>' +
      '<button type="button" class="ips-btn" id="ips-next" aria-label="다음">▼</button>' +
      '<button type="button" id="ips-close" aria-label="닫기">✕</button>' +
      '</div>';

    document.body.appendChild(fab);
    document.body.appendChild(bar);
    return { fab: fab, bar: bar };
  }

  function isSkippable(node) {
    var tag = node.nodeName;
    return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA' ||
      tag === 'INPUT' || tag === 'MARK' || tag === 'SELECT' || tag === 'OPTION';
  }

  function collectTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        while (p) {
          if (p.nodeType === 1 && isSkippable(p)) return NodeFilter.FILTER_REJECT;
          if (p.id === 'ips-bar') return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function clearHighlights() {
    var marks = document.querySelectorAll('mark.ips-hit');
    marks.forEach(function (m) {
      var parent = m.parentNode;
      if (!parent) return;
      var text = document.createTextNode(m.textContent);
      parent.replaceChild(text, m);
      parent.normalize();
    });
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function openAncestorDetails(el) {
    var p = el;
    while (p) {
      if (p.nodeType === 1 && p.tagName === 'DETAILS' && !p.open) p.open = true;
      p = p.parentNode;
    }
  }

  var state = { matches: [], index: -1, lastQuery: '' };

  function runSearch(query) {
    clearHighlights();
    state.matches = [];
    state.index = -1;
    var countEl = document.getElementById('ips-count');
    if (!query || !query.trim()) {
      countEl.textContent = '';
      return;
    }
    var re;
    try {
      re = new RegExp(escapeRegExp(query), 'gi');
    } catch (e) {
      countEl.textContent = '';
      return;
    }
    var textNodes = collectTextNodes(document.body);
    textNodes.forEach(function (node) {
      var text = node.nodeValue;
      re.lastIndex = 0;
      if (!re.test(text)) return;
      re.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var lastEnd = 0;
      var m;
      while ((m = re.exec(text))) {
        if (m.index > lastEnd) frag.appendChild(document.createTextNode(text.slice(lastEnd, m.index)));
        var mark = document.createElement('mark');
        mark.className = 'ips-hit';
        mark.textContent = m[0];
        frag.appendChild(mark);
        state.matches.push(mark);
        lastEnd = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      if (lastEnd < text.length) frag.appendChild(document.createTextNode(text.slice(lastEnd)));
      node.parentNode.replaceChild(frag, node);
    });

    if (state.matches.length > 0) {
      state.index = 0;
      focusMatch(0);
    } else {
      countEl.textContent = '0 / 0';
    }
  }

  function focusMatch(i) {
    if (state.matches.length === 0) return;
    var prevCurrent = document.querySelector('mark.ips-hit.ips-current');
    if (prevCurrent) prevCurrent.classList.remove('ips-current');
    if (i < 0) i = state.matches.length - 1;
    if (i >= state.matches.length) i = 0;
    state.index = i;
    var el = state.matches[i];
    if (!el) return;
    el.classList.add('ips-current');
    openAncestorDetails(el);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // re-correct once more shortly after: async-loading map images/content can
    // shift layout right after the initial scroll and leave the match off-screen
    setTimeout(function () {
      if (document.querySelector('mark.ips-hit.ips-current') === el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 500);
    var countEl = document.getElementById('ips-count');
    countEl.textContent = (i + 1) + ' / ' + state.matches.length;
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function init() {
    injectStyle();
    var ui = buildUI();
    var input = document.getElementById('ips-input');
    var bar = ui.bar;
    var fab = ui.fab;

    var debouncedSearch = debounce(function () {
      runSearch(input.value);
    }, 200);

    fab.addEventListener('click', function () {
      bar.classList.add('ips-open');
      fab.style.display = 'none';
      input.focus();
    });

    document.getElementById('ips-close').addEventListener('click', function () {
      bar.classList.remove('ips-open');
      fab.style.display = 'flex';
      clearHighlights();
      state.matches = [];
      state.index = -1;
      input.value = '';
      document.getElementById('ips-count').textContent = '';
    });

    input.addEventListener('input', debouncedSearch);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) focusMatch(state.index - 1);
        else focusMatch(state.index + 1);
      } else if (e.key === 'Escape') {
        document.getElementById('ips-close').click();
      }
    });
    document.getElementById('ips-prev').addEventListener('click', function () { focusMatch(state.index - 1); });
    document.getElementById('ips-next').addEventListener('click', function () { focusMatch(state.index + 1); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
