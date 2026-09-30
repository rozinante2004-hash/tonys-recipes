// A "📘 Save recipe" button under every Facebook post that has text, and a
// floating one on a reel or video page. Clicking it opens the post's "See
// more", takes the post's own text — never the comments — and opens My
// Kitchen Notes with it. It reads nothing until clicked, and sends nothing
// anywhere: the text travels after '#' in the app's address, which no server
// receives.
(function () {
  if (window.__mknLoaded) return;
  window.__mknLoaded = true;
  var LABEL = '📘 Save recipe to ' + MKN_APP_NAME;
  var MESSAGE = '[data-ad-preview="message"],[data-ad-comet-preview="message"]';

  function topArticles() {
    return Array.prototype.filter.call(document.querySelectorAll('[role="article"]'), function (a) {
      return !(a.parentElement && a.parentElement.closest('[role="article"]'));   // posts, not comments
    });
  }
  // The post's own text: Facebook marks it; otherwise the longest text block
  // that is not inside a comment.
  function postText(post) {
    var m = post.querySelector(MESSAGE);
    if (m && m.innerText.trim()) return mknCleanText(m.innerText);
    var best = '';
    post.querySelectorAll('[dir="auto"]').forEach(function (e) {
      var inner = e.closest('[role="article"]');
      if (inner && inner !== post) return;                                      // a comment
      var t = (e.innerText || '').trim();
      if (t.length > best.length && t.length < 20000) best = t;
    });
    return mknCleanText(best);
  }
  function postLink(post) {
    var a = post && post.querySelector('a[href*="/posts/"],a[href*="/reel/"],a[href*="/videos/"],a[href*="/permalink"],a[href*="story_fbid"]');
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
        for (var i = 0; i < 4 && mknSeeMore(post || document); i++) await new Promise(function (r) { setTimeout(r, 600); });
        text = post ? postText(post) : pageText();
      }
      if (text.length < 20) { alert('No text found in this post. Select the recipe text, then press the button again.'); return; }
      mknOpenApp(MKN_APP, text, post ? postLink(post) : location.href);
    } finally { btn.disabled = false; btn.textContent = was; }
  }
  // A reel or video page: its caption, wherever Facebook put it.
  function pageText() {
    var m = document.querySelector(MESSAGE);
    if (m && m.innerText.trim()) return mknCleanText(m.innerText);
    var best = '';
    document.querySelectorAll('[dir="auto"]').forEach(function (e) {
      if (e.closest('[role="article"] [role="article"]') || e.closest('[role="navigation"],[role="banner"]')) return;
      var t = (e.innerText || '').trim();
      if (t.length > best.length && t.length < 20000 && e.offsetParent) best = t;
    });
    if (best.length < 40) {
      var og = document.querySelector('meta[property="og:description"]');
      if (og && og.content) best = og.content;
    }
    return mknCleanText(best);
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
    topArticles().forEach(function (post) {
      if (post.getAttribute('data-mkn')) return;
      var m = post.querySelector(MESSAGE);
      var anchor = m || null;
      if (!anchor) {                         // no marked text: only posts with a real block of it
        var t = postText(post);
        if (t.length < 60) return;
        anchor = Array.prototype.filter.call(post.querySelectorAll('[dir="auto"]'), function (e) {
          return (e.innerText || '').trim() && t.indexOf((e.innerText || '').trim().slice(0, 40)) === 0;
        })[0];
        if (!anchor) return;
      }
      post.setAttribute('data-mkn', '1');
      var b = button(function (btn) { save(btn, post); });
      anchor.insertAdjacentElement('afterend', b);
    });
    var single = /\/(reel|watch|videos|share\/r|share\/v)\b/.test(location.pathname) && !topArticles().length;
    var f = document.querySelector('.mkn-float');
    if (single && !f) document.body.appendChild(button(function (btn) { save(btn, null); }, 'mkn-float'));
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
