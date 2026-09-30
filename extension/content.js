// A "📘 Save recipe" button under every post that has text — Facebook,
// Instagram and TikTok on the web — and a floating one on a single reel or
// video page. Clicking it opens the post's "See more", takes the post's own
// text (never the comments) and opens My Kitchen Notes with it. It reads
// nothing until clicked, and sends nothing anywhere: the text travels after
// '#' in the app's address, which no server receives.
(function () {
  if (window.__mknLoaded) return;
  window.__mknLoaded = true;
  var LABEL = '📘 Save recipe to ' + MKN_APP_NAME;
  // Each build marks the posts it has done with its OWN tag: the family and
  // test builds side by side each put their button under every post (1.2 —
  // one tag for both let whichever came first stop the other).
  var TAG = (typeof MKN_TAG === 'string' && MKN_TAG) || 'live';
  var MARK = 'data-mkn-' + TAG, FLOAT = 'mkn-float-' + TAG;
  var host = location.hostname;

  // ── Each site: where its posts are, where a post's own text is, and which
  //    page shows a single reel or video.
  var SITES = {
    facebook: {
      posts: function () {
        return Array.prototype.filter.call(document.querySelectorAll('[role="article"]'), function (a) {
          return !(a.parentElement && a.parentElement.closest('[role="article"]'));     // posts, not comments
        });
      },
      marked: '[data-ad-preview="message"],[data-ad-comet-preview="message"]',
      isComment: function (e, post) { var inner = e.closest('[role="article"]'); return inner && inner !== post; },
      single: /\/(reel|watch|videos|share\/r|share\/v)\b/,
      link: 'a[href*="/posts/"],a[href*="/reel/"],a[href*="/videos/"],a[href*="/permalink"],a[href*="story_fbid"]',
    },
    instagram: {
      posts: function () {
        return Array.prototype.filter.call(document.querySelectorAll('article'), function (a) {
          return !(a.parentElement && a.parentElement.closest('article'));
        });
      },
      marked: 'h1',                                                   // Instagram puts the caption in an <h1>
      isComment: function (e) { return !!e.closest('ul li'); },      // comments are list items
      single: /\/(reel|reels|p|tv)\//,
      link: 'a[href*="/p/"],a[href*="/reel/"]',
      more: /^(more|… ?more|עוד|… ?עוד)$/i,                          // only inside the caption
    },
    tiktok: {
      posts: function () { return Array.prototype.slice.call(document.querySelectorAll('[data-e2e="recommend-list-item-container"]')); },
      marked: '[data-e2e="browse-video-desc"],[data-e2e="video-desc"]',
      isComment: function (e) { return !!e.closest('[data-e2e*="comment"]'); },
      single: /\/video\//,
      link: 'a[href*="/video/"]',
    },
  };
  var site = /instagram\.com$/.test(host) ? SITES.instagram : /tiktok\.com$/.test(host) ? SITES.tiktok : SITES.facebook;

  function postText(scope) {
    var m = scope.querySelector(site.marked);
    if (m && m.innerText.trim().length >= 20) return mknCleanText(m.innerText);
    var best = '';
    scope.querySelectorAll('[dir="auto"],span,h1').forEach(function (e) {
      if (site.isComment(e, scope) || e.closest('[role="navigation"],[role="banner"],nav,header button')) return;
      var t = (e.innerText || '').trim();
      if (t.length > best.length && t.length < 20000) best = t;
    });
    if (best.length < 40 && scope === document) {
      var og = document.querySelector('meta[property="og:description"]');
      if (og && og.content) best = og.content;
    }
    return mknCleanText(best);
  }
  function expand(scope) {
    var n = mknSeeMore(scope);
    if (site.more) {                                                  // a bare "more" — inside the caption only
      var cap = scope.querySelector(site.marked);
      var box = cap ? cap.parentElement : null;
      if (box) box.querySelectorAll('[role="button"],span,div,button').forEach(function (e) {
        var t = (e.textContent || '').trim();
        if (t.length < 10 && site.more.test(t) && e.offsetParent) { e.click(); n++; }
      });
    }
    return n;
  }
  function postLink(post) {
    var a = post && post.querySelector(site.link);
    return a ? a.href.replace(/[?&]__cft__[^#]*/, '') : location.href;
  }
  async function save(btn, post) {
    btn.disabled = true;
    var was = btn.textContent;
    btn.textContent = '⏳ Taking the text…';
    try {
      var sel = String(getSelection() || '').trim();
      var text = '';
      if (sel.length >= 40) text = mknCleanText(sel);
      else {
        for (var i = 0; i < 4 && expand(post || document); i++) await new Promise(function (r) { setTimeout(r, 600); });
        text = postText(post || document);
      }
      if (text.length < 20) { alert('No text found in this post. Select the recipe text, then press the button again.'); return; }
      mknOpenApp(MKN_APP, text, post ? postLink(post) : location.href);
    } finally { btn.disabled = false; btn.textContent = was; }
  }
  function button(onClick, extra) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mkn-save' + (extra ? ' ' + extra : '');
    b.textContent = LABEL;
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(b); });
    return b;
  }
  function decorate() {
    var posts = site.posts();
    posts.forEach(function (post) {
      if (post.getAttribute(MARK)) return;
      var anchor = post.querySelector(site.marked);
      if (!anchor || !anchor.innerText.trim()) {                        // no marked text: only a real block of it
        var t = postText(post);
        if (t.length < 60) return;
        anchor = Array.prototype.filter.call(post.querySelectorAll('[dir="auto"],span,h1'), function (e) {
          var s = (e.innerText || '').trim();
          return s && !site.isComment(e, post) && t.indexOf(s.slice(0, 40)) === 0;
        })[0];
        if (!anchor) return;
      }
      post.setAttribute(MARK, '1');
      anchor.insertAdjacentElement('afterend', button(function (btn) { save(btn, post); }));
    });
    var single = site.single.test(location.pathname) && !posts.length;
    var f = document.querySelector('.' + FLOAT);
    if (single && !f) document.body.appendChild(button(function (btn) { save(btn, null); }, 'mkn-float ' + FLOAT));
    if (!single && f) f.remove();
  }
  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; decorate(); }, 400);
  }).observe(document.body, { childList: true, subtree: true });
  decorate();
})();
