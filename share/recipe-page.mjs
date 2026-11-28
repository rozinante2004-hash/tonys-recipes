// v40.21 — A SENT RECIPE'S OWN PAGE: <the app's address>/r/<id>
//
// Tony, 27 Nov 2026: "When sending a recipe via WhatsApp, it is sent as text. However, I would like to be able to send
// it fuller and richer, like the web page I get when I select this option when sharing." Of the two ways: "I accept your
// recommendation. Option 2 seems safer" — a link to the recipe on the server, which WhatsApp shows as a card with its
// photo and name, and which opens as the whole recipe in any browser, no app needed.
//
// Served by Cloudflare Pages (functions/r/[[path]].js) on the copy's own address, so the card reads
// mykitchennotes.community. The page is drawn here, on the server, because WhatsApp's preview reads only what the
// server sends — the app draws its pages in the browser, and a link to it shows no photo.
//
// What it reads: the sent copy (recipeGifts/<id>) and its photo (recipeGiftPhotos/<id>), as anyone holding the link
// may (firestore.rules: the long random id is the key; signed out; never listed). Nothing is written, nothing kept.
// Expired (6 months for a link) or taken back: a page that says so, and a pointer to the app.
//
//   /r/<id>          the recipe (?l=<language> for the page's own words; otherwise the browser's language)
//   /r/<id>/card     the small picture for the preview card (the full photo when there is no small one)
//   /r/<id>/photo    the recipe's photo
//
// The copy's Firebase project and address come from share-page.json, written into the copy by tools/build.js.

const FS_BASE = 'https://firestore.googleapis.com';
const ID_RE = /^[A-Za-z0-9]{20,40}$/;
const LANGS = ['en', 'he', 'ar', 'de', 'es', 'fr', 'hu', 'it', 'ja', 'pt', 'ru', 'zh'];
const RTL = { he: 1, ar: 1 };

// The page's own words, by hand in every language of the app (the recipe itself is shown as it was written).
const WORDS = {
  en: { ing: 'Ingredients', method: 'Method', notes: 'Notes', source: 'Source', contents: 'Contents', top: '↑ Contents',
        serves: 'Serves {1}', sentBy: 'Sent by {1}', save: '📥 Save to my recipes', keeps: 'This link keeps until {1}.',
        pitch: 'Keep it for good in My Kitchen Notes — your recipes in one place, on every device.',
        what: 'What is My Kitchen Notes?', nIng: '{1} ingredients', from: 'A recipe from {1}',
        expired: 'This recipe link has expired', expiredText: 'A recipe sent as a link keeps for 6 months, or until the kitchen that sent it takes it back. Ask them to send it again.',
        none: 'There is no recipe at this address', noneText: 'Check that the whole link was copied.',
        later: 'The recipe could not be read just now', laterText: 'Try again in a moment.', open: 'Open My Kitchen Notes', shared: 'Shared with My Kitchen Notes' },
  he: { ing: 'מרכיבים', method: 'אופן ההכנה', notes: 'הערות', source: 'מקור', contents: 'תוכן', top: '↑ תוכן עניינים',
        serves: '{1} מנות', sentBy: 'נשלח מאת {1}', save: '📥 שמרו במתכונים שלי', keeps: 'הקישור הזה בתוקף עד {1}.',
        pitch: 'שמרו אותו לתמיד ב־My Kitchen Notes — כל המתכונים שלכם במקום אחד, בכל מכשיר.',
        what: 'מה זה My Kitchen Notes?', nIng: '{1} מרכיבים', from: 'מתכון מאת {1}',
        expired: 'תוקף הקישור למתכון הזה פג', expiredText: 'מתכון שנשלח כקישור נשמר חצי שנה, או עד שהמטבח ששלח אותו לוקח אותו בחזרה. בקשו שישלחו אותו שוב.',
        none: 'אין מתכון בכתובת הזאת', noneText: 'בדקו שהקישור הועתק במלואו.',
        later: 'לא ניתן לקרוא את המתכון כרגע', laterText: 'נסו שוב בעוד רגע.', open: 'פתחו את My Kitchen Notes', shared: 'שותף באמצעות My Kitchen Notes' },
  ar: { ing: 'المكوّنات', method: 'الطريقة', notes: 'ملاحظات', source: 'المصدر', contents: 'المحتويات', top: '↑ المحتويات',
        serves: 'يكفي {1}', sentBy: 'أرسله {1}', save: '📥 احفظها في وصفاتي', keeps: 'يبقى هذا الرابط صالحًا حتى {1}.',
        pitch: 'احتفظ بها إلى الأبد في My Kitchen Notes — وصفاتك في مكان واحد، على كل جهاز.',
        what: 'ما هو My Kitchen Notes؟', nIng: '{1} مكوّنات', from: 'وصفة من {1}',
        expired: 'انتهت صلاحية رابط هذه الوصفة', expiredText: 'تبقى الوصفة المرسلة كرابط ستة أشهر، أو حتى يسحبها المطبخ الذي أرسلها. اطلب منهم إرسالها مرة أخرى.',
        none: 'لا توجد وصفة على هذا العنوان', noneText: 'تأكد من نسخ الرابط كاملًا.',
        later: 'تعذّرت قراءة الوصفة الآن', laterText: 'حاول مرة أخرى بعد قليل.', open: 'افتح My Kitchen Notes', shared: 'تمت المشاركة عبر My Kitchen Notes' },
  de: { ing: 'Zutaten', method: 'Zubereitung', notes: 'Notizen', source: 'Quelle', contents: 'Inhalt', top: '↑ Inhalt',
        serves: 'Für {1}', sentBy: 'Gesendet von {1}', save: '📥 In meinen Rezepten speichern', keeps: 'Dieser Link gilt bis {1}.',
        pitch: 'Bewahre es für immer in My Kitchen Notes auf — deine Rezepte an einem Ort, auf jedem Gerät.',
        what: 'Was ist My Kitchen Notes?', nIng: '{1} Zutaten', from: 'Ein Rezept von {1}',
        expired: 'Dieser Rezept-Link ist abgelaufen', expiredText: 'Ein als Link gesendetes Rezept bleibt 6 Monate erhalten oder bis die Küche, die es gesendet hat, es zurücknimmt. Bitte sie, es noch einmal zu senden.',
        none: 'Unter dieser Adresse gibt es kein Rezept', noneText: 'Prüfe, ob der ganze Link kopiert wurde.',
        later: 'Das Rezept konnte gerade nicht gelesen werden', laterText: 'Versuche es gleich noch einmal.', open: 'My Kitchen Notes öffnen', shared: 'Geteilt mit My Kitchen Notes' },
  es: { ing: 'Ingredientes', method: 'Método', notes: 'Notas', source: 'Fuente', contents: 'Contenido', top: '↑ Contenido',
        serves: 'Para {1}', sentBy: 'Enviada por {1}', save: '📥 Guardar en mis recetas', keeps: 'Este enlace vale hasta el {1}.',
        pitch: 'Guárdala para siempre en My Kitchen Notes: tus recetas en un solo lugar, en todos tus dispositivos.',
        what: '¿Qué es My Kitchen Notes?', nIng: '{1} ingredientes', from: 'Una receta de {1}',
        expired: 'Este enlace a la receta ha caducado', expiredText: 'Una receta enviada como enlace se conserva 6 meses, o hasta que la cocina que la envió la retire. Pídeles que la envíen de nuevo.',
        none: 'No hay ninguna receta en esta dirección', noneText: 'Comprueba que se copió el enlace completo.',
        later: 'No se pudo leer la receta en este momento', laterText: 'Vuelve a intentarlo en un momento.', open: 'Abrir My Kitchen Notes', shared: 'Compartida con My Kitchen Notes' },
  fr: { ing: 'Ingrédients', method: 'Préparation', notes: 'Notes', source: 'Source', contents: 'Sommaire', top: '↑ Sommaire',
        serves: 'Pour {1}', sentBy: 'Envoyée par {1}', save: '📥 Enregistrer dans mes recettes', keeps: 'Ce lien est valable jusqu’au {1}.',
        pitch: 'Gardez-la pour toujours dans My Kitchen Notes : vos recettes au même endroit, sur tous vos appareils.',
        what: 'Qu’est-ce que My Kitchen Notes ?', nIng: '{1} ingrédients', from: 'Une recette de {1}',
        expired: 'Ce lien vers la recette a expiré', expiredText: 'Une recette envoyée par lien est gardée 6 mois, ou jusqu’à ce que la cuisine qui l’a envoyée la reprenne. Demandez-leur de la renvoyer.',
        none: 'Il n’y a pas de recette à cette adresse', noneText: 'Vérifiez que le lien a été copié en entier.',
        later: 'La recette n’a pas pu être lue pour le moment', laterText: 'Réessayez dans un instant.', open: 'Ouvrir My Kitchen Notes', shared: 'Partagée avec My Kitchen Notes' },
  hu: { ing: 'Hozzávalók', method: 'Elkészítés', notes: 'Jegyzetek', source: 'Forrás', contents: 'Tartalom', top: '↑ Tartalom',
        serves: '{1} adag', sentBy: 'Küldte: {1}', save: '📥 Mentés a receptjeim közé', keeps: 'Ez a link eddig érvényes: {1}.',
        pitch: 'Őrizd meg örökre a My Kitchen Notesban — a receptjeid egy helyen, minden eszközödön.',
        what: 'Mi az a My Kitchen Notes?', nIng: '{1} hozzávaló', from: 'Recept tőle: {1}',
        expired: 'Ennek a receptnek a linkje lejárt', expiredText: 'A linkként küldött recept 6 hónapig marad meg, vagy amíg a küldő konyha vissza nem vonja. Kérd meg őket, hogy küldjék el újra.',
        none: 'Ezen a címen nincs recept', noneText: 'Nézd meg, hogy a teljes linket másoltad-e ki.',
        later: 'A receptet most nem sikerült beolvasni', laterText: 'Próbáld újra egy perc múlva.', open: 'A My Kitchen Notes megnyitása', shared: 'Megosztva a My Kitchen Notesszal' },
  it: { ing: 'Ingredienti', method: 'Procedimento', notes: 'Note', source: 'Fonte', contents: 'Indice', top: '↑ Indice',
        serves: 'Per {1}', sentBy: 'Inviata da {1}', save: '📥 Salva nelle mie ricette', keeps: 'Questo link vale fino al {1}.',
        pitch: 'Conservala per sempre in My Kitchen Notes: le tue ricette in un solo posto, su ogni dispositivo.',
        what: 'Che cos’è My Kitchen Notes?', nIng: '{1} ingredienti', from: 'Una ricetta di {1}',
        expired: 'Il link a questa ricetta è scaduto', expiredText: 'Una ricetta inviata come link resta per 6 mesi, o finché la cucina che l’ha inviata non la ritira. Chiedi di inviarla di nuovo.',
        none: 'A questo indirizzo non c’è nessuna ricetta', noneText: 'Controlla che il link sia stato copiato per intero.',
        later: 'Al momento non è stato possibile leggere la ricetta', laterText: 'Riprova tra un attimo.', open: 'Apri My Kitchen Notes', shared: 'Condivisa con My Kitchen Notes' },
  ja: { ing: '材料', method: '作り方', notes: 'メモ', source: '出典', contents: '目次', top: '↑ 目次',
        serves: '{1}人分', sentBy: '{1}から', save: '📥 マイレシピに保存', keeps: 'このリンクは{1}まで有効です。',
        pitch: 'My Kitchen Notes にずっと残せます — レシピを一か所に、どのデバイスでも。',
        what: 'My Kitchen Notes とは？', nIng: '材料{1}品', from: '{1}のレシピ',
        expired: 'このレシピのリンクは期限切れです', expiredText: 'リンクで送ったレシピは6か月、または送ったキッチンが取り消すまで保存されます。もう一度送ってもらってください。',
        none: 'このアドレスにレシピはありません', noneText: 'リンク全体がコピーされているか確認してください。',
        later: '今はレシピを読み込めませんでした', laterText: '少ししてからもう一度お試しください。', open: 'My Kitchen Notes を開く', shared: 'My Kitchen Notes で共有' },
  pt: { ing: 'Ingredientes', method: 'Preparação', notes: 'Notas', source: 'Fonte', contents: 'Índice', top: '↑ Índice',
        serves: 'Serve {1}', sentBy: 'Enviada por {1}', save: '📥 Salvar nas minhas receitas', keeps: 'Este link vale até {1}.',
        pitch: 'Guarde-a para sempre no My Kitchen Notes — suas receitas num só lugar, em todos os aparelhos.',
        what: 'O que é o My Kitchen Notes?', nIng: '{1} ingredientes', from: 'Uma receita de {1}',
        expired: 'O link desta receita expirou', expiredText: 'Uma receita enviada por link fica guardada 6 meses, ou até a cozinha que a enviou retirá-la. Peça que a enviem de novo.',
        none: 'Não há nenhuma receita neste endereço', noneText: 'Verifique se o link foi copiado inteiro.',
        later: 'Não foi possível ler a receita agora', laterText: 'Tente de novo daqui a pouco.', open: 'Abrir o My Kitchen Notes', shared: 'Compartilhada com o My Kitchen Notes' },
  ru: { ing: 'Ингредиенты', method: 'Способ приготовления', notes: 'Заметки', source: 'Источник', contents: 'Содержание', top: '↑ Содержание',
        serves: 'Порций: {1}', sentBy: 'Отправитель: {1}', save: '📥 Сохранить в мои рецепты', keeps: 'Ссылка действует до {1}.',
        pitch: 'Сохраните его навсегда в My Kitchen Notes — все ваши рецепты в одном месте, на любом устройстве.',
        what: 'Что такое My Kitchen Notes?', nIng: 'Ингредиентов: {1}', from: 'Рецепт от: {1}',
        expired: 'Срок действия ссылки на этот рецепт истёк', expiredText: 'Рецепт, отправленный ссылкой, хранится 6 месяцев или пока отправившая его кухня не отзовёт его. Попросите отправить его ещё раз.',
        none: 'По этому адресу нет рецепта', noneText: 'Проверьте, что ссылка скопирована полностью.',
        later: 'Сейчас не удалось прочитать рецепт', laterText: 'Попробуйте ещё раз через минуту.', open: 'Открыть My Kitchen Notes', shared: 'Отправлено через My Kitchen Notes' },
  zh: { ing: '食材', method: '做法', notes: '备注', source: '来源', contents: '目录', top: '↑ 目录',
        serves: '{1}人份', sentBy: '来自 {1}', save: '📥 保存到我的食谱', keeps: '此链接有效期至 {1}。',
        pitch: '在 My Kitchen Notes 中永久保存 — 你的食谱集中一处，所有设备都能用。',
        what: '什么是 My Kitchen Notes？', nIng: '{1} 种食材', from: '来自 {1} 的食谱',
        expired: '此食谱链接已过期', expiredText: '以链接发送的食谱保留 6 个月，或直到发送它的厨房将其撤回。请让对方再发送一次。',
        none: '此地址没有食谱', noneText: '请检查链接是否已完整复制。',
        later: '暂时无法读取此食谱', laterText: '请稍后再试。', open: '打开 My Kitchen Notes', shared: '通过 My Kitchen Notes 分享' }
};

export function pageLang(url, request) {
  const q = (url.searchParams.get('l') || '').toLowerCase().slice(0, 5).split('-')[0];
  if (LANGS.includes(q)) return q;
  const al = String((request && request.headers && request.headers.get('Accept-Language')) || '');
  for (const part of al.split(',')) {
    const l = part.trim().toLowerCase().split(/[-;]/)[0];
    if (LANGS.includes(l)) return l;
  }
  return 'en';
}
function w(lang, key, a) { const s = (WORDS[lang] || WORDS.en)[key] || WORDS.en[key] || ''; return a == null ? s : s.replace('{1}', a); }

export function esc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// A number with a fraction kept whole: beside Hebrew, "1½ כוסות" otherwise shows as "½1 כוסות" (the app's bidiFrac).
export function bidiFrac(s) {
  return String(s == null ? '' : s).replace(/\d+(?:[.,]\d+)?\s?[\u00BC-\u00BE\u2150-\u215E]|[\u00BC-\u00BE\u2150-\u215E]/g, function (m) { return '\u2066' + m + '\u2069'; });
}
// **bold**, as the app writes it, on text already escaped (and a fraction kept whole)
const BOLD_RE = /\*\*(?=\S)([\s\S]*?\S)\*\*/g;
function escB(v) { return bidiFrac(esc(v).replace(BOLD_RE, '<strong>$1</strong>')); }
function noBold(v) { return String(v == null ? '' : v).replace(BOLD_RE, '$1'); }

// Firestore's REST answer → plain values
export function fsDecode(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return String(v.stringValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue) || 0;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(fsDecode);
  if ('mapValue' in v) { const o = {}, f = (v.mapValue && v.mapValue.fields) || {}; for (const k of Object.keys(f)) o[k] = fsDecode(f[k]); return o; }
  return null;
}
function fsDoc(j) { const o = {}, f = (j && j.fields) || {}; for (const k of Object.keys(f)) o[k] = fsDecode(f[k]); return o; }

async function readDoc(env, project, path) {
  const base = (env && env.FIRESTORE_BASE) || FS_BASE;
  const r = await fetch(base + '/v1/projects/' + encodeURIComponent(project) + '/databases/(default)/documents/' + path,
    { headers: { Accept: 'application/json' } });
  if (r.status === 200) return { ok: true, d: fsDoc(await r.json()) };
  // The rules answer 403 for one that has expired; 404 for one that never was or was taken back.
  return { ok: false, status: r.status };
}

async function siteConfig(request, env) {
  if (env && env.SHARE_CONFIG) return env.SHARE_CONFIG;                      // tests
  if (!env || !env.ASSETS) return null;
  try {
    const r = await env.ASSETS.fetch(new URL('/share-page.json', request.url));
    if (!r.ok) return null;
    const c = await r.json();
    return c && c.projectId && c.site ? c : null;
  } catch (e) { return null; }
}

// The lines of a recipe or of one of a collection's parts, headings included
function isSub(x) { return !!(x && typeof x === 'object' && typeof x.sub === 'string' && x.sub !== ''); }
function stepText(s) { return typeof s === 'string' ? s : (s && typeof s.t === 'string' ? s.t : ''); }
function ingList(list) {
  return '<ul class="ing">' + (Array.isArray(list) ? list : []).map(function (i) {
    if (isSub(i)) return '<li class="sub" dir="auto">' + escB(i.sub) + '</li>';
    if (!i || typeof i !== 'object') return '';
    return '<li' + (i.ind ? ' class="ind"' : '') + '><span dir="auto">' + escB(i.n) + '</span><b dir="auto">' + escB(i.a) + '</b></li>';
  }).join('') + '</ul>';
}
// Each step's number a badge beside its text — not the browser's list number, which a narrow margin cuts in a
// right-to-left page and the text runs over (Tony, of the saved web page: "the step numbers are overwritten by the text").
function stepList(list) {
  let out = '', open = false, n = 0;
  (Array.isArray(list) ? list : []).forEach(function (s) {
    if (isSub(s)) { if (open) out += '</ol>'; out += '<h4 dir="auto">' + escB(s.sub) + '</h4>'; open = false; return; }
    const t = stepText(s); if (!t) return;
    if (!open) { out += '<ol class="steps">'; open = true; }
    n++; out += '<li><span class="n">' + n + '</span><div class="t" dir="auto">' + escB(t) + '</div></li>';
  });
  return out + (open ? '</ol>' : '');
}
function countIngredients(r) {
  const all = Array.isArray(r.parts) && r.parts.length ? [].concat.apply([], r.parts.map(function (p) { return p.ingredients || []; })) : (r.ingredients || []);
  return all.filter(function (i) { return i && typeof i === 'object' && !isSub(i) && i.n; }).length;
}
function body(r, lang) {
  const parts = Array.isArray(r.parts) && r.parts.length > 1 ? r.parts : null;
  if (!parts) {
    const one = Array.isArray(r.parts) && r.parts.length === 1 ? r.parts[0] : r;
    return '<h2>' + esc(w(lang, 'ing')) + '</h2>' + ingList(one.ingredients) + '<h2>' + esc(w(lang, 'method')) + '</h2>' + stepList(one.steps);
  }
  return '<nav class="toc" id="toc"><b>' + esc(w(lang, 'contents')) + '</b><ol>'
    + parts.map(function (p, i) { return '<li><a href="#part' + i + '" dir="auto">' + esc(noBold(p.name)) + '</a></li>'; }).join('') + '</ol></nav>'
    + parts.map(function (p, i) {
        return '<section class="part" id="part' + i + '"><h3 dir="auto">' + escB(p.name) + '</h3>'
          + '<h2>' + esc(w(lang, 'ing')) + '</h2>' + ingList(p.ingredients) + '<h2>' + esc(w(lang, 'method')) + '</h2>' + stepList(p.steps)
          + (p.notes ? '<div class="notes" dir="auto">' + escB(p.notes) + '</div>' : '')
          + '<div class="totop"><a href="#toc">' + esc(w(lang, 'top')) + '</a></div></section>';
      }).join('');
}
// The recipe is laid out in its own direction, as the app lays it out (right to left when its letters are mostly
// Hebrew or Arabic), whatever the language of the page's own words.
export function recipeDir(name, r) {
  const parts = Array.isArray(r.parts) && r.parts.length ? r.parts : [r];
  const sample = [name].concat.apply([name], parts.map(function (p) {
    return (p.ingredients || []).slice(0, 12).map(function (i) { return (i && (i.n || i.sub)) || ''; })
      .concat((p.steps || []).slice(0, 6).map(stepText));
  })).join(' ');
  const rtl = (sample.match(/[\u0590-\u05FF\u0600-\u06FF]/g) || []).length, ltr = (sample.match(/[A-Za-z\u00C0-\u024F\u0400-\u04FF]/g) || []).length;
  return rtl > ltr ? 'rtl' : 'ltr';
}
function dayText(ms, lang) {
  try { return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms)); }
  catch (e) { return new Date(ms).toISOString().slice(0, 10); }
}
const STYLE = 'body{margin:0;background:#FAF7F2;color:#1C1A18;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans Hebrew","Noto Sans Arabic",sans-serif;line-height:1.65;}'
  + '.wrap{max-width:640px;margin:0 auto;background:#fff;box-shadow:0 2px 24px rgba(0,0,0,.08);min-height:100vh;}'
  + '.brand{display:flex;align-items:center;gap:8px;padding:10px 18px;background:#5C3D2E;color:#fff;font-weight:600;font-size:14px;text-decoration:none;}'
  + '.brand img{width:22px;height:22px;border-radius:5px;}'
  + '.hero{width:100%;display:block;max-height:70vh;object-fit:cover;}'
  + '.pad{padding:22px 22px 30px;}'
  + 'h1{font-family:Georgia,serif;font-size:30px;line-height:1.25;margin:0 0 6px;color:#5C3D2E;unicode-bidi:plaintext;text-align:start;}'
  + '.meta{color:#6F6A60;font-size:13.5px;margin-bottom:14px;}'
  + '.from{background:#FAF7F2;border:1px solid #EFE6DA;border-radius:10px;padding:10px 13px;font-size:14px;margin:12px 0 4px;}'
  + '.from q{display:block;margin-top:4px;font-style:italic;unicode-bidi:plaintext;}'
  + 'h2{font-family:Georgia,serif;font-size:18px;color:#5C3D2E;margin:24px 0 10px;border-bottom:1px solid #eee;padding-bottom:6px;}'
  + 'h3{font-family:Georgia,serif;font-size:21px;color:#5C3D2E;margin:32px 0 2px;unicode-bidi:plaintext;text-align:start;}'
  + 'h4{font-size:15px;color:#5C3D2E;margin:14px 0 6px;unicode-bidi:plaintext;text-align:start;}'
  + 'ul.ing{list-style:none;padding:0;margin:0;}'
  + 'ul.ing li{display:flex;justify-content:space-between;gap:14px;padding:7px 0;border-bottom:1px dashed #eee;}'
  + 'ul.ing li span{min-width:0;text-align:start;}'
  + 'ul.ing li.ind{padding-inline-start:16px;}'
  + 'ul.ing li.sub{display:block;font-weight:700;color:#5C3D2E;border-bottom:none;padding-top:12px;unicode-bidi:plaintext;text-align:start;}'
  + 'ul.ing li b{color:#C1440E;white-space:nowrap;flex:none;}'
  + 'ol.steps{list-style:none;padding:0;margin:0;}ol.steps li{display:flex;align-items:flex-start;gap:12px;margin-bottom:11px;}'
  + 'ol.steps .n{flex:none;min-width:26px;height:26px;padding:0 4px;box-sizing:border-box;border-radius:13px;background:#C1440E;color:#fff;font-size:13px;font-weight:700;line-height:26px;text-align:center;margin-top:2px;}'
  + 'ol.steps .t{flex:1;min-width:0;unicode-bidi:plaintext;text-align:start;}'
  + '.toc ol{padding-inline-start:24px;}'
  + '.notes{background:#FFF8E8;border-inline-start:3px solid #D4A843;padding:12px 14px;margin-top:22px;font-size:14px;white-space:pre-wrap;unicode-bidi:plaintext;text-align:start;}'
  + '.toc{border:1px solid #eee;border-radius:10px;padding:12px 18px;margin:8px 0;}.toc b{color:#5C3D2E;}.toc ol{margin:6px 0 0;}'
  + '.totop{text-align:end;font-size:12.5px;margin-top:8px;}a{color:#C1440E;}'
  + '.src{color:#6F6A60;font-size:13px;margin-top:18px;word-break:break-word;}'
  + '.keep{margin-top:26px;border:1px solid #EFE6DA;border-radius:12px;padding:16px;background:#FFFBF5;text-align:center;}'
  + '.keep p{margin:0 0 12px;font-size:14.5px;}'
  + '.btn{display:inline-block;background:#C1440E;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:12px 22px;border-radius:10px;}'
  + '.small{font-size:12.5px;color:#6F6A60;margin-top:10px;}'
  + '.foot{text-align:center;font-size:12px;color:#8A8278;padding:16px;}'
  + '.msg{padding:40px 24px;text-align:center;}.msg h1{text-align:center;}'
  + '@media print{body{background:#fff}.wrap{box-shadow:none}.keep,.brand,.totop{display:none}}';

function shell(o) {
  const lang = o.lang, dir = RTL[lang] ? 'rtl' : 'ltr';
  return '<!doctype html><html lang="' + lang + '" dir="' + dir + '"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow">'
    + '<title>' + esc(o.title) + '</title>'
    + '<meta name="description" content="' + esc(o.description) + '">'
    + '<meta property="og:type" content="article"><meta property="og:site_name" content="My Kitchen Notes">'
    + '<meta property="og:title" content="' + esc(o.ogTitle || o.title) + '">'
    + '<meta property="og:description" content="' + esc(o.description) + '">'
    + (o.url ? '<meta property="og:url" content="' + esc(o.url) + '">' : '')
    + '<meta property="og:image" content="' + esc(o.image) + '">'
    + '<meta property="og:image:alt" content="' + esc(o.ogTitle || o.title) + '">'
    + '<meta name="twitter:card" content="' + (o.bigImage ? 'summary_large_image' : 'summary') + '">'
    + '<meta name="theme-color" content="#5C3D2E"><link rel="icon" href="/icons/icon-512.png">'
    + '<style>' + STYLE + '</style></head><body><div class="wrap">'
    + '<a class="brand" href="' + esc(o.site) + '"><img src="/icons/icon-512.png" alt=""> My Kitchen Notes</a>'
    + o.inner + '<div class="foot">' + esc(w(lang, 'shared')) + '</div></div></body></html>';
}
function page(html, status, extra) {
  return new Response(html, { status: status, headers: Object.assign({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  }, extra || {}) });
}
function message(o, lang, cfg, url, key, status) {
  return page(shell({ lang: lang, site: cfg.site, title: w(lang, key) + ' — My Kitchen Notes', description: w(lang, key + 'Text'),
    image: url.origin + '/icons/icon-512.png',
    inner: '<div class="msg"><h1>' + esc(w(lang, key)) + '</h1><p>' + esc(w(lang, key + 'Text')) + '</p>'
      + '<p style="margin-top:22px;"><a class="btn" href="' + esc(cfg.site) + '">' + esc(w(lang, 'open')) + '</a></p></div>' }), status);
}

// The app's own words for a recipe's category and difficulty ("Dessert", "Medium" → "קינוח", "בינוני"), from the
// copy's i18n/<lang>.json, read once per language while this server instance lives.
const DICTS = new Map();
export async function pageDict(request, env, lang) {
  if (lang === 'en' || !env || !env.ASSETS) return {};
  if (DICTS.has(lang)) return DICTS.get(lang);
  let d = {};
  try {
    const r = await env.ASSETS.fetch(new URL('/i18n/' + lang + '.json', request.url));
    if (r.ok) { const j = await r.json(); d = (j && j.strings) || {}; }
  } catch (e) {}
  DICTS.set(lang, d);
  return d;
}
export function recipePage(g, id, lang, cfg, url, dict) {
  dict = dict || {};
  const tr = function (x) { return typeof dict[x] === 'string' && dict[x] ? dict[x] : x; };
  const r = (g && g.recipe && typeof g.recipe === 'object') ? g.recipe : {};
  const name = String(g.name || r.name || 'A recipe').slice(0, 200);
  const kitchen = String(g.fromName || '').slice(0, 80);
  const self = url.origin + url.pathname.replace(/\/+$/, '');
  const photo = g.photo ? self + '/photo' : '', card = g.photo ? self + '/card' : url.origin + '/icons/icon-512.png';
  const n = countIngredients(r);
  const bits = [r.prep, n > 1 ? w(lang, 'nIng', n) : '', r.servings ? w(lang, 'serves', r.servings) : ''].filter(Boolean).map(String);
  const description = (g.note ? '“' + noBold(g.note).slice(0, 160) + '”' + (kitchen ? ' — ' + kitchen : '') : (kitchen ? w(lang, 'from', kitchen) : ''))
    + (bits.length ? (g.note || kitchen ? ' · ' : '') + bits.join(' · ') : '');
  const meta = [r.category ? tr(String(r.category)) : '', r.difficulty ? tr(String(r.difficulty)) : '', r.prep, r.servings ? w(lang, 'serves', r.servings) : '']
    .filter(Boolean).map(function (x) { return '<bdi>' + bidiFrac(esc(x)) + '</bdi>'; }).join(' · ');
  const save = cfg.site + '?recipe=' + id, pageDir = RTL[lang] ? 'rtl' : 'ltr';
  const inner = (photo ? '<img class="hero" src="' + esc(photo) + '" alt="' + esc(noBold(name)) + '">' : '')
    + '<div class="pad" dir="' + recipeDir(name, r) + '"><h1 dir="auto">' + escB(name) + '</h1>'
    + (meta ? '<div class="meta">' + meta + '</div>' : '')
    + (kitchen || g.note ? '<div class="from" dir="' + pageDir + '">' + (kitchen ? '📨 ' + esc(w(lang, 'sentBy', kitchen)) : '')
        + (g.note ? '<q dir="auto">' + escB(g.note) + '</q>' : '') + '</div>' : '')
    + body(r, lang)
    + (r.notes ? '<h2>' + esc(w(lang, 'notes')) + '</h2><div class="notes" dir="auto">' + escB(r.notes) + '</div>' : '')
    + (r.source ? '<div class="src" dir="auto">' + esc(w(lang, 'source')) + ': '
        + (/^https?:\/\/\S+$/.test(String(r.source).trim()) ? '<a href="' + esc(String(r.source).trim()) + '" rel="noopener nofollow">' + esc(r.source) + '</a>' : esc(r.source)) + '</div>' : '')
    + '<div class="keep" dir="' + pageDir + '"><p>' + esc(w(lang, 'pitch')) + '</p><a class="btn" href="' + esc(save) + '">' + esc(w(lang, 'save')) + '</a>'
    + (g.expireAt ? '<div class="small">' + esc(w(lang, 'keeps', dayText(g.expireAt, lang))) + '</div>' : '')
    + '<div class="small"><a href="' + esc(cfg.site) + '">' + esc(w(lang, 'what')) + '</a></div></div>'
    + '</div>';
  return shell({ lang: lang, site: cfg.site, title: noBold(name) + ' — My Kitchen Notes', ogTitle: noBold(name),   // v40.22 — no emoji (Tony: "We do not need it")
    description: description || w(lang, 'shared'), url: self, image: card, bigImage: !!g.photo, inner: inner });
}

function b64Bytes(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function picture(env, cfg, id, which) {
  const p = await readDoc(env, cfg.projectId, 'recipeGiftPhotos/' + id);
  if (!p.ok) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const src = String((which === 'card' && p.d.thumb) || p.d.data || '');
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(src);
  if (m) return new Response(b64Bytes(m[2]), { status: 200, headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' } });
  if (/^https:\/\/[^\s"'<>]{8,600}$/.test(src)) return Response.redirect(src, 302);
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

// The one entry point (the Pages function hands every /r/… request here).
export async function handleShare(request, env) {
  const url = new URL(request.url);
  const m = /^\/r\/([^/]+)(?:\/(card|photo))?\/?$/.exec(url.pathname);
  const lang = pageLang(url, request);
  const cfg = await siteConfig(request, env);
  if (!cfg) return new Response('This copy does not serve recipe pages.', { status: 404 });
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  if (!m || !ID_RE.test(m[1])) return message(null, lang, cfg, url, 'none', 404);
  const id = m[1];
  try {
    if (m[2]) return await picture(env, cfg, id, m[2]);
    const g = await readDoc(env, cfg.projectId, 'recipeGifts/' + id);
    if (!g.ok) return message(null, lang, cfg, url, g.status === 403 ? 'expired' : g.status === 404 ? 'none' : 'later', g.status === 403 ? 410 : g.status === 404 ? 404 : 503);
    if (g.d.expireAt && g.d.expireAt < Date.now()) return message(null, lang, cfg, url, 'expired', 410);
    return page(recipePage(g.d, id, lang, cfg, url, await pageDict(request, env, lang)), 200);
  } catch (e) {
    return message(null, lang, cfg, url, 'later', 503);
  }
}
