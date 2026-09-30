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

  // The post's own text. For the whole page (a single reel, or a reels feed)
  // only what is ON SCREEN counts, the one nearest the middle first: a feed
  // keeps the reels you scrolled past, and the next ones, in the page (1.3 —
  // Tony got an old challah instead of the aglio e olio he was watching).
  function postText(scope) {
    var page = scope === document;
    var marks = Array.prototype.filter.call(scope.querySelectorAll(site.marked), function (m) {
      return (m.innerText || '').trim().length >= 20 && (!page || mknOnScreen(m));
    });
    if (page) marks.sort(function (a, b) { return mknFromCentre(a) - mknFromCentre(b); });
    if (marks.length) return mknCleanText(marks[0].innerText);
    var best = '', bestEl = null;
    scope.querySelectorAll('[dir="auto"],span,h1').forEach(function (e) {
      if (site.isComment(e, scope) || e.closest('[role="navigation"],[role="banner"],nav,header button')) return;
      if (page && !mknOnScreen(e)) return;
      var t = (e.innerText || '').trim();
      if (t.length > best.length && t.length < 20000) { best = t; bestEl = e; }
    });
    if (best.length < 40 && page) best = mknOwnSummary() || best;
    return mknCleanText(best);
  }
  // "See more" / Instagram's bare "more" — for the whole page, only on screen;
  // a bare "more" only where it ends a caption (never a menu called More).
  function expand(scope) {
    var page = scope === document;
    var n = mknSeeMore(scope, page);
    if (site.more) {
      scope.querySelectorAll('[role="button"],span,div,button').forEach(function (e) {
        var t = (e.textContent || '').trim();
        if (t.length >= 10 || !site.more.test(t) || !e.offsetParent) return;
        if (page && !mknOnScreen(e)) return;
        if (e.closest('nav,[role="navigation"],[role="banner"],header')) return;
        var box = e.parentElement;
        if (!box || (box.textContent || '').trim().length < t.length + 25) return;   // not the end of a caption
        e.click(); n++;
      });
    }
    return n;
  }
  function postLink(post) {
    var a = post && post.querySelector(site.link);
    return a ? a.href.replace(/[?&]__cft__[^#]*/, '') : location.href;
  }
  // What to send: the selection, else the post (or, for the page, what is on screen).
  async function collect(post) {
    var sel = String(getSelection() || '').trim();
    if (sel.length >= 40) return { text: mknCleanText(sel), url: post ? postLink(post) : location.href };
    for (var i = 0; i < 4 && expand(post || document); i++) await new Promise(function (r) { setTimeout(r, 600); });
    return { text: postText(post || document), url: post ? postLink(post) : location.href };
  }
  // The post nearest the middle of the screen (for the toolbar button).
  function centralPost() {
    var on = site.posts().filter(mknOnScreen);
    on.sort(function (a, b) { return mknFromCentre(a) - mknFromCentre(b); });
    return on[0] || null;
  }
  async function save(btn, post) {
    btn.disabled = true;
    var was = btn.textContent;
    btn.textContent = '⏳ Taking the text…';
    try {
      var got = await collect(post);
      if (got.text.length < 20) { alert('No text found in this post. Select the recipe text, then press the button again.'); return; }
      mknOpenApp(MKN_APP, got.text, got.url);
    } finally { btn.disabled = false; btn.textContent = was; }
  }
  // The toolbar button / right-click menu on these sites ask this script, so
  // they read the post on screen the same way (1.3); the extension opens the app.
  chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
    if (!msg || msg.mkn !== 'take') return;
    collect(centralPost()).then(function (got) { reply(got); }, function () { reply(null); });
    return true;
  });
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
