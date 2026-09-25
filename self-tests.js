// Tony's Recipes — the self-test suite (extracted from index.html in v36.15)
//
// WHY THIS IS A SEPARATE FILE
// It is ~590 KB, which was 36% of everything index.html made every device
// download on every version update — on a phone that is parse time nobody but
// Tony was ever going to use. It is now fetched ON DEMAND and only on devices
// where the ⚙️ Settings toggle is on (default OFF).
//
// HOW IT STILL REACHES THE APP
// This is a classic script, so it shares the page's global scope. `var` and
// function declarations in index.html are window properties; top-level `let`
// and `const` there (CATS, recipes, ...) live in the shared global lexical
// environment and are reachable by name from here just the same. Nothing had to
// be exported for this split.
//
// index.html declares `var SELF_TESTS = []` so the app can reference it before
// this file lands; assigning window.SELF_TESTS below rebinds that same global.
//
// Run it headlessly with tests/run-self-tests.js, which calls loadSelfTests()
// first. Do not add an entry here that index.html could not run — the whole
// point is that the app works identically whether or not this file was fetched.

window.SELF_TESTS = [
  // ── UI ELEMENTS ────────────────────────────────────────────────────────────
  { id:'ui_header',      group:'UI',      name:'Header renders',
    test: async()=>{ const h=document.querySelector('.header'); if(!h) throw new Error('No .header element'); if(h.offsetHeight<30) throw new Error('Header height too small: '+h.offsetHeight+'px'); } },
  { id:'ui_filterbar',   group:'UI',      name:'Filter bar renders',
    test: async()=>{ const f=document.getElementById('filterBar'); if(!f) throw new Error('filterBar element missing'); if(!f.innerHTML.trim()) throw new Error('filterBar is empty'); } },
  { id:'ui_recipegrid',  group:'UI',      name:'Recipe grid renders',
    test: async()=>{ const g=document.getElementById('recipeGrid'); if(!g) throw new Error('recipeGrid missing'); if(!g.innerHTML.trim()) throw new Error('recipeGrid empty — no recipes rendered'); } },
  { id:'ui_searchbar',   group:'UI',      name:'Search bar present',
    test: async()=>{ const s=document.getElementById('searchInput'); if(!s) throw new Error('searchInput missing'); } },
  { id:'ui_modals',      group:'UI',      name:'All overlays present',
    test: async()=>{
      const required=['viewOverlay','editOverlay','translateOverlay','calcOverlay','bringOverlay','urlImportOverlay','selfTestOverlay'];
      const missing=required.filter(id=>!document.getElementById(id));
      if(missing.length) throw new Error('Missing overlays: '+missing.join(', '));
    }
  },

  // ── CORE FUNCTIONS ─────────────────────────────────────────────────────────
  { id:'fn_render',      group:'Core',    name:'renderGrid() works',
    test: async()=>{ if(typeof renderGrid!=='function') throw new Error('renderGrid not defined'); renderGrid(); const g=document.getElementById('recipeGrid'); if(!g.innerHTML.trim()) throw new Error('renderGrid produced empty output'); } },
  { id:'fn_filters',     group:'Core',    name:'Filter functions work',
    test: async()=>{
      if(typeof renderFilters!=='function') throw new Error('renderFilters not defined');
      if(typeof resetFilters!=='function') throw new Error('resetFilters not defined');
      if(typeof toggleFavFilter!=='function') throw new Error('toggleFavFilter not defined');
      if(typeof toggleClipsFilter!=='function') throw new Error('toggleClipsFilter not defined');
      renderFilters();
    }
  },
  { id:'fn_search',      group:'Core',    name:'Search filters recipes',
    test: async()=>{
      const inp=document.getElementById('searchInput');
      if(!inp) throw new Error('searchInput missing');
      const before=document.getElementById('recipeGrid').children.length;
      inp.value='XQZJK99_SELFTEST_NOMATCH_7749';
      renderGrid();
      const grid=document.getElementById('recipeGrid');
      const after=grid.children.length;
      // Check if the empty state is shown (no results) or 0 children
      const hasEmptyState=grid.innerHTML.includes('No recipes');
      inp.value=''; renderGrid();
      if(after>0 && !hasEmptyState) throw new Error('Search filter not working — still showing '+after+' results for garbage query');
    }
  },

  // ── RECIPE CRUD ────────────────────────────────────────────────────────────
  { id:'crud_add',       group:'CRUD',    name:'Add recipe modal opens',
    test: async()=>{
      if(typeof openAddModal!=='function') throw new Error('openAddModal not defined');
      openAddModal(null);
      await wait(300);
      const o=document.getElementById('editOverlay');
      if(!o || !o.classList.contains('open')) throw new Error('Add modal did not open');
      closeM('editOverlay');
    }
  },
  { id:'crud_save',      group:'CRUD',    name:'Save & delete test recipe',
    test: async()=>{
      const before=recipes.length;
      // Create test recipe directly
      const testId=nextId++;
      const testRecipe={id:testId,name:'🧪 TEST RECIPE — DELETE ME',emoji:'🧪',photo:'',source:'',
        category:'Dinner',difficulty:'Easy',prep:'1 min',servings:'1',
        bg:'#FFF0E8',fav:false,ingredients:[{a:'1',n:'test ingredient'}],
        steps:['Test step'],diets:[],notes:'Auto-generated by Self Test',
        isClip:false,updatedAt:Date.now()};
      recipes.unshift(testRecipe);
      saveLocal();
      if(recipes.length!==before+1) throw new Error('Recipe not added to array');
      // Delete it
      recipes=recipes.filter(r=>r.id!==testId);
      saveLocal();
      if(recipes.length!==before) throw new Error('Recipe not deleted properly');
      renderGrid();
    }
  },
  { id:'crud_view',      group:'CRUD',    name:'View recipe modal opens',
    test: async()=>{
      if(!recipes.length) throw new Error('No recipes to view');
      if(typeof openView!=='function') throw new Error('openView not defined');
      openView(recipes[0].id);
      await wait(300);
      const o=document.getElementById('viewOverlay');
      if(!o || !o.classList.contains('open')) throw new Error('View modal did not open');
      closeM('viewOverlay');
    }
  },
  { id:'crud_fav',       group:'CRUD',    name:'Favourite toggle works',
    test: async()=>{
      // Its OWN recipe (v36.57). This used recipes[0] — Tony's first real
      // recipe — and "reverted" by stamping it modified now, so the next save
      // wrote his chestnut collection to the family cloud on every run.
      const id=888960;
      recipes.unshift(normalizeRecipe({id:id,name:'FavTest',ingredients:[{a:'1',n:'x'}],steps:['s'],updatedAt:1}));
      try {
        const r=recipes[0], was=r.fav;
        r.fav=!was; r.updatedAt=Date.now(); saveLocal();
        if(r.fav===was) throw new Error('Fav toggle did not change');
      } finally { recipes=recipes.filter(function(x){ return x.id!==id; }); saveLocal(); }
    }
  },

  // ── MODALS ─────────────────────────────────────────────────────────────────
  { id:'modal_calc',     group:'Modals',  name:'Measurement converter opens',
    test: async()=>{
      if(typeof openCalcModal!=='function') throw new Error('openCalcModal not defined');
      openCalcModal();
      await wait(300);
      const o=document.getElementById('calcOverlay');
      if(!o || !o.classList.contains('open')) throw new Error('Calc modal did not open');
      // Test a conversion
      const fromEl=document.getElementById('calcFrom');
      const toEl=document.getElementById('calcTo');
      if(!fromEl||!toEl) throw new Error('Calc inputs missing');
      fromEl.value='100'; doCalc();
      if(!toEl.value) throw new Error('Conversion produced no result');
      closeM('calcOverlay');
    }
  },
  { id:'modal_translate', group:'Modals', name:'Translate modal opens',
    test: async()=>{
      if(typeof openTranslate!=='function') throw new Error('openTranslate not defined');
      if(!recipes.length) throw new Error('No recipes to translate');
      openTranslate(recipes[0].id);
      await wait(300);
      const o=document.getElementById('translateOverlay');
      if(!o || !o.classList.contains('open')) throw new Error('Translate modal did not open');
      closeM('translateOverlay');
    }
  },
  { id:'modal_bring',    group:'Modals',  name:'Send to Bring! modal opens',
    test: async()=>{
      if(typeof openBringModal!=='function') throw new Error('openBringModal not defined');
      if(!recipes.length) throw new Error('No recipes');
      openBringModal(recipes[0].id);
      await wait(300);
      const o=document.getElementById('bringOverlay');
      if(!o || !o.classList.contains('open')) throw new Error('Bring modal did not open');
      closeM('bringOverlay');
    }
  },
  { id:'modal_help',     group:'Modals',  name:'Help assistant opens',
    test: async()=>{
      if(typeof openHelp!=='function') throw new Error('openHelp not defined');
      openHelp();
      await wait(300);
      const o=document.getElementById('helpOverlay');
      if(!o || !o.classList.contains('open')) throw new Error('Help modal did not open');
      closeM('helpOverlay');
    }
  },
  { id:'modal_explore',  group:'Modals',  name:'Explore modal opens',
    test: async()=>{
      if(typeof openExploreModal!=='function') throw new Error('openExploreModal not defined');
      openExploreModal();
      await wait(300);
      const o=document.getElementById('exploreOverlay');
      if(!o || !o.classList.contains('open')) throw new Error('Explore modal did not open');
      closeM('exploreOverlay');
    }
  },

  // ── NETWORK / API ──────────────────────────────────────────────────────────
  { id:'net_worker',     group:'Network', name:'Cloudflare Worker reachable',
    test: async()=>{
      // Send a minimal AI request as a worker health check
      const r=await fetch(WORKER_ENDPOINT,{
        method:'POST',headers: workerHeaders(),
        body: workerBody({
          model: AI_MODEL,
          max_tokens:5,
          messages:[{role:'user',content:'Reply OK'}]
        }),signal:AbortSignal.timeout(10000)});
      // 200 or 529 (overloaded) both mean worker is reachable
      if(r.status!==200 && r.status!==529 && r.status!==400) throw new Error('Worker returned '+r.status);
    }
  },
  { id:'net_ai',         group:'Network', name:'AI call (recipe extraction)',
    test: async()=>{
      if(typeof aiCall!=='function') throw new Error('aiCall not defined');
      const result=await aiCall('Reply with exactly the word: PASS',50);
      if(!result||!result.includes('PASS')) throw new Error('AI did not return expected response. Got: '+result?.slice(0,50));
    }
  },
  { id:'net_url_import', group:'Network', name:'URL import (test recipe URL)',
    test: async()=>{
      // Use a known accessible recipe URL provided for testing
      const resp=await fetch(WORKER_ENDPOINT,{
        method:'POST',headers: workerHeaders(),
        body: workerBody({action:'fetch-url',url:'https://mazon-izun.com/recipes/fermented-cucumbers/'}),
        signal:AbortSignal.timeout(20000)});
      if(!resp.ok) throw new Error('fetch-url returned '+resp.status);
      const data=await resp.json();
      // Worker returns { text } not { content }
      if(!data.text || data.text.length < 50) throw new Error('No content returned from URL fetch. Worker fetch-url action may be broken. Response: '+JSON.stringify(data).slice(0,120));
    }
  },
  { id:'net_photo',      group:'Network', name:'Photo search (Pixabay)',
    test: async()=>{
      const resp=await fetch(WORKER_ENDPOINT,{
        method:'POST',headers: workerHeaders(),
        body: workerBody({action:'photo-search',query:'pasta'}),
        signal:AbortSignal.timeout(10000)});
      if(!resp.ok) throw new Error('photo-search returned '+resp.status);
      const data=await resp.json();
      if(!data.images||!data.images.length) throw new Error('No photos returned');
    }
  },
  { id:'net_instagram',  group:'Network', name:'Instagram fetch (test post)',
    test: async()=>{
      // Use a known stable public post
      const resp=await fetch(WORKER_ENDPOINT,{
        method:'POST',headers: workerHeaders(),
        body: workerBody({action:'instagram-fetch',shortcode:'C5IHqgqoFMo'}),
        signal:AbortSignal.timeout(10000)});
      // Instagram's oEmbed API now requires auth — Worker returns 404 (not 500) when unavailable.
      // Accept 200 or 404; only fail on 500 (true Worker crash).
      if(resp.status===500) throw new Error('Worker crashed on instagram-fetch (500)');
      // Any other status (200, 404) means worker is handling the action correctly
    }
  },

  // ── STORAGE ────────────────────────────────────────────────────────────────
  { id:'ver_order',      group:'Storage', name:'The update banner only fires for a NEWER version',
    test: async()=>{
      if(typeof versionIsNewer!=='function') throw new Error('versionIsNewer not defined');
      // v32.3 — v32.2 shipped with version.json left at v32.1, so a device that
      // had the new build was told "you are running v32.2, v32.1 is ready" and
      // was told again on every check, because Update Now reloads the same build.
      // An ordered comparison is the only thing that can tell those apart.
      // (These version numbers are the historical record. A release bump must
      // never blanket-replace them — doing exactly that is how this comment came
      // to claim v32.3 was the release that shipped broken.)
      if(versionIsNewer('v32.1','v32.2')) throw new Error('an OLDER server version was reported as an available update — this is the v32.2 nag loop');
      if(!versionIsNewer('v32.2','v32.1')) throw new Error('a genuinely newer server version was not offered as an update');
      if(versionIsNewer('v32.2','v32.2')) throw new Error('the same version was offered as an update — the banner would never stop');
      // Numeric, not lexicographic: '9' > '10' as strings.
      if(!versionIsNewer('v32.10','v32.9')) throw new Error('v32.10 was judged older than v32.9 — the comparison is comparing strings, not numbers');
      if(!versionIsNewer('v33.0','v32.99')) throw new Error('a major bump was missed');
      // A version we cannot read is not grounds for claiming an update.
      if(versionIsNewer('garbage','v32.3')||versionIsNewer('v32.3','garbage')) throw new Error('an unparseable version produced an update prompt');
      if(parseVersion('v1.2.3').join()!=='1,2,3') throw new Error('a three-part version does not parse');
      if(parseVersion('v1.2').join()!=='1,2,0') throw new Error('a two-part version must imply a .0 patch');
    } },

  { id:'ver_manifest',   group:'Storage', name:'version.json matches the build it ships with',
    test: async()=>{
      // The banner reads version.json; if a release bumps index.html and forgets
      // that file, every device is told the wrong thing. CI checks this too, but
      // CI only runs AFTER the push — this catches it in the browser as well.
      var r=await fetch(new URL('version.json?t='+Date.now(), location.href), {cache:'no-store'});
      if(!r.ok) throw new Error('version.json could not be read ('+r.status+') — the update banner has nothing to compare against');
      var declared=(await r.json()).version;
      if(declared!==APP_VERSION) throw new Error('version.json says '+declared+' but this build is '+APP_VERSION+' — devices would be told to "update" to a version older than the one they are running');

      // There are FIVE version strings and this compared only two of them, so
      // v36.1 shipped with the HTML comment and one badge still reading v36.0:
      // green here, red in CI, after the push. CI catching it is not the same
      // as catching it — check in the browser what CI checks, first.
      var page=await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'});
      if(page.ok){
        var src=await page.text(), found={};
        var c=src.match(/<!-- Tony's Recipes Collection (v[\d.]+) -->/);
        if(!c) throw new Error('the version comment on line 1 is gone, so nothing pins the build');
        found[c[1]]=true;
        var badges=src.match(/letter-spacing:0\.5px;">(v[\d.]+)<\/div>/g)||[];
        if(badges.length<2) throw new Error('found '+badges.length+' version badge(s) in the markup, expected 2');
        badges.forEach(function(b){ found[b.match(/(v[\d.]+)/)[1]]=true; });
        var versions=Object.keys(found);
        if(versions.length!==1 || versions[0]!==APP_VERSION)
          throw new Error('APP_VERSION is '+APP_VERSION+' but the page itself carries: '+versions.join(', ')
            +' — a release that bumps some of the five strings and not the others fails CI after the push');
      }
    } },

  { id:'stor_local',     group:'Storage', name:'localStorage read/write',
    test: async()=>{
      const key='selftest_ping_'+Date.now();
      localStorage.setItem(key,'ok');
      const val=localStorage.getItem(key);
      localStorage.removeItem(key);
      if(val!=='ok') throw new Error('localStorage write/read failed');
    }
  },
  { id:'stor_save',      group:'Storage', name:'saveLocal() persists data',
    test: async()=>{
      if(typeof saveLocal!=='function') throw new Error('saveLocal not defined');
      const before=JSON.stringify(recipes);
      saveLocal();
      const stored=localStorage.getItem('tonys_recipes_v1');
      if(!stored) throw new Error('saveLocal did not write to localStorage');
      const parsed=JSON.parse(stored);
      if(!Array.isArray(parsed)) throw new Error('Stored data is not an array');
    }
  },
  { id:'stor_firebase',  group:'Storage', name:'Firebase connection',
    test: async()=>{
      if(!window._fbUser) throw new Error('Not signed in to Firebase — sign in first');
      if(!window._fbDb)   throw new Error('Firestore not initialised');
      // A lightweight read of `shared/meta` — a live document this app writes on
      // every save. Until v32.3 this read `shared/recipes`, which is now deleted;
      // a read of a MISSING document still resolves, so that form of the check
      // would have passed against an entirely empty collection.
      const snap=await window._fbDb.collection('shared').doc('meta').get();
      if(!snap) throw new Error('Firestore read returned nothing');
      if(!snap.exists) throw new Error('shared/meta is missing — either the collection has never been written, or the rules refuse this account');
    }
  },

  // ── BACKUP ─────────────────────────────────────────────────────────────────
  { id:'backup_fn',      group:'Backup',  name:'Backup functions defined',
    test: async()=>{
      const fns=['backupSave','backupRestore','backupRestoreFile'];
      const missing=fns.filter(f=>typeof window[f]!=='function');
      if(missing.length) throw new Error('Missing backup functions: '+missing.join(', '));
    }
  },

  // ── CSS ─────────────────────────────────────────────────────────────────────
  { id:'css_vars',       group:'CSS',     name:'CSS variables loaded',
    test: async()=>{
      const cream=getComputedStyle(document.documentElement).getPropertyValue('--cream').trim();
      const brown=getComputedStyle(document.documentElement).getPropertyValue('--warm-brown').trim();
      if(!cream) throw new Error('--cream CSS variable not set');
      if(!brown) throw new Error('--warm-brown CSS variable not set');
    }
  },
  { id:'css_header',     group:'CSS',     name:'Header has correct styling',
    test: async()=>{
      const h=document.querySelector('.header');
      if(!h) throw new Error('.header not found');
      const bg=getComputedStyle(h).backgroundColor;
      if(bg==='rgba(0, 0, 0, 0)'||bg==='transparent') throw new Error('Header background is transparent — CSS may not have loaded');
    }
  },

  // ── NEW FEATURES (v16) ──────────────────────────────────────────────────────
  { id:'feat_sort',      group:'Features', name:'Sort options work',
    test: async()=>{
      if(typeof setSort!=='function') throw new Error('setSort not defined');
      if(typeof sortMode==='undefined') throw new Error('sortMode variable not declared');
      const before = sortMode;
      setSort('alpha'); if(sortMode!=='alpha') throw new Error('sortMode not updated');
      setSort(before); // revert
    }
  },
  { id:'feat_recent',    group:'Features', name:'Recently viewed tracking',
    test: async()=>{
      if(typeof toggleRecentFilter!=='function') throw new Error('toggleRecentFilter not defined');
      if(!recipes.length) throw new Error('No recipes to test with');
      const before = localStorage.getItem('recent_views');
      openView(recipes[0].id);
      await wait(200);
      closeM('viewOverlay');
      const after = JSON.parse(localStorage.getItem('recent_views')||'[]');
      if(!after.includes(recipes[0].id)) throw new Error('Recipe not added to recent_views');
      if(before!==null) localStorage.setItem('recent_views', before);
    }
  },
  { id:'feat_cook',      group:'Features', name:'Cook count (mark as cooked)',
    test: async()=>{
      if(typeof markCooked!=='function') throw new Error('markCooked not defined');
      if(typeof commitCooked!=='function') throw new Error('commitCooked not defined');
      // Its OWN recipe (v36.57). With recipes[0] the count and the log were put
      // back but lastCooked was not, so Tony's chestnut collection was marked
      // cooked at the time of every run — and written to the cloud that way.
      const id=888961;
      recipes.unshift(normalizeRecipe({id:id,name:'CookTest',ingredients:[{a:'1',n:'x'}],steps:['s'],updatedAt:1}));
      const r=recipes[0]; const before=r.cookCount||0; const logBefore=(r.cookLog||[]).length;
      try {
        markCooked(r.id);
        await wait(150);
        if(!document.getElementById('cookLogOverlay').classList.contains('open')) throw new Error('markCooked should offer to record how it went');
        skipCookLog();          // the one-tap path must still work
        if((r.cookCount||0)!==before+1) throw new Error('cookCount not incremented');
        if((r.cookLog||[]).length!==logBefore+1) throw new Error('the attempt was not added to the cooking log');
      } finally {
        closeM('cookLogOverlay'); closeM('viewOverlay');
        recipes=recipes.filter(function(x){ return x.id!==id; }); saveLocal();
      }
    }
  },
  { id:'feat_cook_log', group:'Features', name:'Cook notes & ratings per attempt',
    test: async()=>{
      if(typeof avgRating!=='function') throw new Error('avgRating not defined');
      if(!document.getElementById('cookLogOverlay')) throw new Error('#cookLogOverlay missing');
      var testId=888907;
      recipes.unshift(normalizeRecipe({id:testId,name:'CookLogTest',servings:'4',ingredients:[{a:'1',n:'x'}],steps:['s'],updatedAt:Date.now()}));
      var r=recipes.find(function(x){return x.id===testId;});
      try {
        commitCooked(testId,5,'too salty — halve the soy');
        commitCooked(testId,3,'');
        commitCooked(testId,0,'');            // unrated cook
        if(r.cookCount!==3) throw new Error('expected 3 cooks, got '+r.cookCount);
        if(r.cookLog.length!==3) throw new Error('expected 3 log entries, got '+r.cookLog.length);
        if(Math.abs(avgRating(r)-4)>0.001) throw new Error('unrated cooks must not drag the average down; expected 4, got '+avgRating(r));
        // A note is a note — deleting one must not rewrite how many times it was cooked.
        if(new Set(r.cookLog.map(function(e){return e.id;})).size!==3) throw new Error('log entries logged in the same millisecond must still be distinguishable');
        deleteCookLogEntry(testId, r.cookLog[0].id);
        if(r.cookLog.length!==2) throw new Error('the entry was not removed');
        if(r.cookCount!==3) throw new Error('deleting a note must not change cookCount');
        // Ratings survive a save/normalise round trip.
        var round=normalizeRecipe(JSON.parse(JSON.stringify(r)));
        if(round.cookLog.length!==2||round.cookLog[0].rating!==3) throw new Error('the log did not survive normalizeRecipe');
        // Junk in the log must not crash the view.
        var junk=normalizeRecipe({id:1,cookLog:[null,{rating:'99',note:5},'nope']});
        if(junk.cookLog.length!==1||junk.cookLog[0].rating!==0) throw new Error('a malformed log entry was not sanitised');
      } finally { recipes=recipes.filter(function(x){return x.id!==testId;}); saveData(); renderGrid(); }
    } },
  { id:'feat_scale',     group:'Features', name:'Scaling memory persists',
    test: async()=>{
      if(!recipes.length) throw new Error('No recipes');
      const id=recipes[0].id;
      const prev=localStorage.getItem('scale_'+id);
      try {
        // Exercise the REAL flow: tapping ×3 must persist, and reopening must restore it.
        // (Previously this test wrote the key itself, so it passed even though setMult
        // never saved anything and the feature did not actually work.)
        openView(id); await wait(150);
        setMult(3);
        if(localStorage.getItem('scale_'+id)!=='3') throw new Error('setMult did not persist the scale — reopening the recipe will not restore it');
        closeM('viewOverlay');
        viewMult=1;
        openView(id); await wait(150);
        if(viewMult!==3) throw new Error('Scale not restored on reopen — got '+viewMult+' expected 3');
        closeM('viewOverlay');
      } finally {
        if(prev===null) localStorage.removeItem('scale_'+id); else localStorage.setItem('scale_'+id,prev);
        viewMult=1;
      }
    }
  },
  { id:'feat_wakelock',  group:'Features', name:'Wake lock API available',
    test: async()=>{
      if(!('wakeLock' in navigator)) throw new Error('Wake Lock API not supported in this browser');
      if(typeof requestWakeLock!=='function') throw new Error('requestWakeLock not defined');
      // Just verify API is available — actual lock requires user interaction on some browsers
    }
  },
  { id:'feat_autophotos',group:'Features', name:'Auto-fetch photos function exists',
    test: async()=>{
      if(typeof autoFetchMissingPhotos!=='function') throw new Error('autoFetchMissingPhotos not defined');
    }
  },

  // ── IMPORT / EXPORT ─────────────────────────────────────────────────────────
  { id:'import_url_modal', group:'Import/Export', name:'URL import modal opens',
    test: async()=>{
      if(typeof openUrlImportModal!=='function') throw new Error('openUrlImportModal not defined');
      openUrlImportModal();
      await wait(300);
      const o=document.getElementById('urlImportOverlay');
      if(!o||!o.classList.contains('open')) throw new Error('URL import modal did not open');
      closeM('urlImportOverlay');
    }
  },
  { id:'import_freehand', group:'Import/Export', name:'Free-hand import modal opens',
    test: async()=>{
      if(typeof openFreehandModal!=='function') throw new Error('openFreehandModal not defined');
      openFreehandModal();
      await wait(300);
      const o=document.getElementById('freehandOverlay');
      if(!o||!o.classList.contains('open')) throw new Error('Freehand modal did not open');
      closeM('freehandOverlay');
    }
  },
  { id:'import_freehand_prefill', group:'Import/Export', name:'Free-hand importer accepts shared text',
    test: async()=>{
      if(typeof openFreehandModal!=='function') throw new Error('openFreehandModal not defined');
      openFreehandModal('Shared recipe text for extraction');
      var v=document.getElementById('freehandText').value;
      closeM('freehandOverlay');
      document.getElementById('freehandText').value='';
      if(v!=='Shared recipe text for extraction') throw new Error('openFreehandModal did not accept prefilled text — text shares would arrive empty');
    }
  },
  { id:'import_camera',   group:'Import/Export', name:'Camera import function exists',
    test: async()=>{
      if(typeof openCameraImport!=='function') throw new Error('openCameraImport not defined');
    }
  },
  { id:'perf_lazy_libs',  group:'Performance', name:'Heavy libraries are not loaded eagerly (5.11)',
    test: async()=>{
      // xlsx and mammoth are the two biggest dependencies and matter only when
      // someone imports a spreadsheet or a Word file. If either creeps back into
      // a <script> tag in <head>, every visit silently pays for it again.
      var eager=Array.prototype.slice.call(document.querySelectorAll('head script[src]'))
        .map(function(t){ return t.getAttribute('src')||''; })
        .filter(function(src){ return /xlsx|mammoth|qrcode/i.test(src); });
      if(eager.length) throw new Error('loaded eagerly in <head>: '+eager.join(', ')+' — these must load on first use');
      if(typeof loadScriptOnce!=='function') throw new Error('loadScriptOnce not defined — nothing would fetch them on demand');
      // A failed fetch must reject rather than silently resolve, or the caller
      // proceeds to call into a library that is not there.
      var threw=false;
      try{ await loadScriptOnce('https://127.0.0.1:9/nope.js','__NoSuchGlobal__'); }catch(e){ threw=true; }
      if(!threw) throw new Error('loadScriptOnce resolved for a script that could not load');
    }
  },
  { id:'export_word',     group:'Import/Export', name:'Export Word function exists',
    test: async()=>{
      if(typeof exportAllWord!=='function') throw new Error('exportAllWord not defined');
    }
  },
  { id:'import_save_recipe', group:'Import/Export', name:'saveRecipe function exists',
    test: async()=>{
      if(typeof saveRecipe!=='function') throw new Error('saveRecipe not defined');
    }
  },
  { id:'feat_autotag',    group:'Features', name:'AI auto-tag diet types exists',
    test: async()=>{
      if(typeof aiTagAllDiets!=='function') throw new Error('aiTagAllDiets not defined');
    }
  },
  { id:'import_file',     group:'Import/Export', name:'From File import function exists',
    test: async()=>{
      if(typeof importFromFile!=='function') throw new Error('importFromFile not defined');
      const el = document.getElementById('fileIn');
      if(!el) throw new Error('#fileIn input element missing');
      const accept = el.getAttribute('accept')||'';
      if(!accept.includes('.docx')) throw new Error('fileIn does not accept .docx');
      if(!accept.includes('.xlsx')) throw new Error('fileIn does not accept .xlsx');
      if(!accept.includes('.pdf'))  throw new Error('fileIn does not accept .pdf');
    }
  },
  { id:'share_modal',     group:'Features', name:'Share recipe modal exists',
    test: async()=>{
      if(typeof toggleShare!=='function') throw new Error('toggleShare not defined');
      const o = document.getElementById('shareRecipeOverlay');
      if(!o) throw new Error('#shareRecipeOverlay not found');
      if(!document.getElementById('shareWaBtn'))   throw new Error('#shareWaBtn missing');
      if(!document.getElementById('shareMailBtn'))  throw new Error('#shareMailBtn missing');
      if(!document.getElementById('shareCopyBtn'))  throw new Error('#shareCopyBtn missing');
    }
  },

  // ── STORAGE (IndexedDB photo storage) ────────────────────────────────────────
  { id:'stor_idb_avail', group:'Storage', name:'IndexedDB available',
    test: async()=>{
      if(typeof indexedDB==='undefined'||!indexedDB) throw new Error('IndexedDB not supported by this browser — photos fall back to localStorage');
      if(typeof idbGetAll!=='function') throw new Error('idbGetAll not defined');
    } },
  { id:'stor_idb_roundtrip', group:'Storage', name:'IndexedDB photo read/write',
    test: async()=>{
      if(!_idbAvailable) throw new Error('IndexedDB unavailable — running in localStorage fallback mode');
      var testId=999999;
      await idbPut({id:testId, photo:'data:test/roundtrip', originalPhoto:''});
      var rows=await idbGetAll();
      var found=rows.some(function(r){ return r.id===testId; });
      await idbDelete(testId);
      if(!found) throw new Error('A photo written to IndexedDB could not be read back');
    } },
  { id:'stor_local_photofree', group:'Storage', name:'localStorage stays photo-free',
    test: async()=>{
      if(!_idbAvailable) return; // fallback mode intentionally keeps photos inline
      if(typeof stripPhotosLocal!=='function') throw new Error('stripPhotosLocal not defined');
      var slim=stripPhotosLocal([{id:1,name:'x',photo:'data:image/jpeg;base64,AAAA',originalPhoto:''}]);
      if(slim[0].photo!=='') throw new Error('stripPhotosLocal left photo data in the localStorage payload');
      if(slim[0]._ph!==1) throw new Error('stripPhotosLocal did not flag the photo (_ph) for hydration');
    } },
  { id:'stor_hydrate_fn', group:'Storage', name:'Photo hydrate/offload functions present',
    test: async()=>{
      if(typeof hydratePhotosFromIDB!=='function') throw new Error('hydratePhotosFromIDB not defined');
      if(typeof savePhotosToIDB!=='function') throw new Error('savePhotosToIDB not defined');
    } },

  // ── CLOUD SYNC (Firestore photo split) ───────────────────────────────────────
  { id:'cloud_strip', group:'Cloud Sync', name:'Photos stripped from the per-recipe doc',
    test: async()=>{
      if(typeof slimRecipeForCloud!=='function') throw new Error('slimRecipeForCloud not defined');
      var slim=slimRecipeForCloud({id:1,name:'x',photo:'data:image/jpeg;base64,AAAA',originalPhoto:'data:big',updatedAt:1});
      if(slim.photo!=='') throw new Error('photo not blanked in the per-recipe document');
      if(slim.originalPhoto!==undefined) throw new Error('originalPhoto must never be sent to the cloud');
      if(slim._ph!==1) throw new Error('_ph (photo-lives-elsewhere) flag not set for cloud hydration');
      if('hp' in slim) throw new Error('the old `hp` name is still being written — 5.8 unified it to _ph');
      // v32.3 — slimRecipeForCloud takes ONE argument. It used to take a
      // `keepHistory` flag, false for the legacy single document; passing a
      // second argument must no longer be able to strip history.
      if(slimRecipeForCloud.length!==1) throw new Error('slimRecipeForCloud takes '+slimRecipeForCloud.length+' arguments — the legacy history-stripping flag is back');
      if(typeof window.stripPhotosForCloud==='function') throw new Error('stripPhotosForCloud is back — that was the legacy `shared/recipes` shape and it is deleted');
    } },
  { id:'cloud_bytelen', group:'Cloud Sync', name:'byteLen measures UTF-8 size',
    test: async()=>{
      if(typeof byteLen!=='function') throw new Error('byteLen not defined');
      if(byteLen('abc')!==3) throw new Error('byteLen wrong for ASCII');
      if(byteLen('é')!==2) throw new Error('byteLen wrong for a multi-byte character');
    } },
  { id:'cloud_sizeerr', group:'Cloud Sync', name:'Firestore 1 MiB error detected',
    test: async()=>{
      if(typeof isSizeError!=='function') throw new Error('isSizeError not defined');
      if(!isSizeError({code:'invalid-argument'})) throw new Error('did not flag invalid-argument as a size error');
      if(!isSizeError({message:'is longer than 1048487 bytes'})) throw new Error('did not flag the size message');
      if(isSizeError({code:'unavailable'})) throw new Error('false positive: offline error treated as size error');
    } },
  { id:'cloud_fns', group:'Cloud Sync', name:'Cloud sync functions present',
    test: async()=>{
      ['syncCloudPhotos','attachCloudPhotos','handleFirestoreSaveError','saveToFirestore','loadFromFirestore'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
    } },

  // ── 5.4 — ONE DOCUMENT PER RECIPE ────────────────────────────────────────────
  // These drive the real functions against an in-memory stand-in for Firestore.
  // They are unit tests and cannot prove the live behaviour on their own — the
  // two-browser checks in PLAN-5.4-per-recipe-docs.md §7 still have to be done by
  // hand — but every rule below is one whose breakage is silent in production.
  { id:'ui_skip_link', group:'UI', name:'Skip link reaches the recipes in two keystrokes (5c.1c)',
    test: async()=>{
      var link=document.querySelector('.skip-link');
      if(!link) throw new Error('no skip link — reaching the first recipe takes ~67 tab presses');
      if(link!==document.body.firstElementChild && !document.body.contains(link)) throw new Error('the skip link is not in the document');
      if(typeof focusFirstRecipe!=='function') throw new Error('focusFirstRecipe not defined');
      // It must be the FIRST thing Tab reaches, or it saves nothing.
      var focusables=focusablesIn(document.body);
      if(focusables.length && focusables[0]!==link) throw new Error('the skip link is not the first focusable element, so Tab reaches it too late to help');
      var prevView=viewMode;
      try{
        setView('grid');
        focusFirstRecipe();
        if(!document.activeElement || !document.activeElement.classList.contains('recipe-card'))
          throw new Error('the skip link does not land on a recipe card');
      } finally { setView(prevView); }
    } },

  { id:'ui_focus_ring', group:'CSS', name:'The keyboard focus ring actually paints (5c.1)',
    test: async()=>{
      // Reported by Tony: tabbing to a card showed no ring. The :focus-visible
      // rule was there, but a `.recipe-card:focus { outline: none }` at equal
      // specificity sat AFTER it and won every time. Asserting the rule exists is
      // not enough — this checks the cascade result, which is what he sees.
      var prevView=viewMode, prevStored=null;
      try{ prevStored=localStorage.getItem('tonys_view_mode'); }catch(e){}
      try{
        setView('grid');
        var card=document.querySelector('.recipe-card');
        if(!card) throw new Error('no recipe card rendered');
        var reset=null, ring=null;   // ring = the first focus-visible rule that sets a real outline
        for(var i=0;i<document.styleSheets.length;i++){
          var rules; try{ rules=document.styleSheets[i].cssRules; }catch(e){ continue; }
          for(var j=0;j<rules.length;j++){
            var sel=rules[j].selectorText||'';
            if(/\.recipe-card:focus-visible/.test(sel)){
              var css=rules[j].cssText||'';
              // several focus-visible rules exist (one only sets transform) —
              // keep the one that actually draws something.
              if(!ring && /outline\s*:/.test(css) && !/outline\s*:\s*none/.test(css)) ring={i:j, css:css};
            }
            // a bare :focus reset that does NOT exempt :focus-visible will win
            if(/\.recipe-card:focus(?![-a-z])/.test(sel) && !/not\(:focus-visible\)/.test(sel)
               && (rules[j].style.outline==='none'||rules[j].style.outlineStyle==='none')) reset={i:j};
          }
        }
        if(!ring) throw new Error('no :focus-visible rule for .recipe-card draws an outline — nothing paints when you tab to a card');
        if(reset) throw new Error('a bare .recipe-card:focus outline reset still exists — it overrides the ring and nothing paints');
        if(reset && ring && reset.i > ring.i)
          throw new Error('an outline reset comes after the ring rule and overrides it');
      } finally {
        setView(prevView);
        try{ if(prevStored===null) localStorage.removeItem('tonys_view_mode'); else localStorage.setItem('tonys_view_mode',prevStored); }catch(e){}
      }
    } },

  { id:'ui_focus_trap', group:'UI', name:'An open dialog takes focus and gives it back (5c.1b)',
    test: async()=>{
      ['trapFocus','releaseFocus','focusablesIn'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      if(!recipes.length) throw new Error('no recipes to open');
      var grid=document.querySelector('.recipe-card, .recipe-list-item');
      if(grid) grid.focus();
      var before=document.activeElement;
      try{
        openView(recipes[0].id);
        await wait(140);
        var ov=document.getElementById('viewOverlay');
        if(!ov.contains(document.activeElement))
          throw new Error('focus stayed outside the open recipe — Tab would walk the grid behind it');
      } finally { closeM('viewOverlay'); }
      await wait(60);
      if(before && document.contains(before) && document.activeElement!==before)
        throw new Error('focus was not returned to the card that opened the recipe');
    } },

  { id:'i18n_rtl_columns', group:'UI', name:'Hebrew recipes put ingredients on the right (5b.4)',
    test: async()=>{
      if(typeof recipeIsRTL!=='function') throw new Error('recipeIsRTL not defined');
      if(recipeIsRTL({name:'Shakshuka', ingredients:[{n:'eggs'}], steps:['fry']}))
        throw new Error('an English recipe was judged right-to-left');
      if(!recipeIsRTL({name:'שקשוקה', ingredients:[{n:'ביצים'}], steps:['לטגן את הבצל']}))
        throw new Error('a Hebrew recipe was not judged right-to-left');
      // The common awkward case: English title, Hebrew body. The body wins.
      if(!recipeIsRTL({name:'Shakshuka', ingredients:[{n:'ביצים'},{n:'עגבניות'}], steps:['לטגן את הבצל','להוסיף עגבניות']}))
        throw new Error('a Hebrew-bodied recipe with an English title was judged left-to-right');
      try{
        openView(recipes[0].id);
        var cols=document.querySelector('#viewOverlay .recipe-columns');
        if(!cols) throw new Error('.recipe-columns missing');
        var wasRTL=cols.getAttribute('dir')==='rtl';
        if(recipeIsRTL(recipes[0])!==wasRTL)
          throw new Error('the columns dir attribute disagrees with the recipe language');
      } finally { closeM('viewOverlay'); }
    } },

  { id:'feat_instagram', group:'Features', name:'Instagram failure offers a way forward (5f.1)',
    test: async()=>{
      if(typeof showInstagramCaptionFallback!=='function') throw new Error('showInstagramCaptionFallback not defined');
      var res=document.getElementById('urlImportResult');
      if(!res) throw new Error('#urlImportResult missing');
      var before=res.innerHTML;
      try{
        showInstagramCaptionFallback('https://www.instagram.com/p/ABC123/', {author:'someone'});
        var t=res.textContent||'';
        // A dead end is treated as a bug here, so the pane must offer a route on.
        if(!/paste/i.test(t)) throw new Error('the Instagram fallback does not offer the paste route');
        if(!res.querySelector('a[href*="instagram.com"]')) throw new Error('no link to open the actual post');
        if(!/bookmark/i.test(t)) throw new Error('no option to just keep the post as a bookmark');
        // ...and it must not blame Instagram for blocking us when it simply did
        // not hand over the caption. Honest error messages, per CLAUDE.md.
        if(/blocked|denied|refused/i.test(t)) throw new Error('the message claims Instagram blocked us, which is not what happened');
        if(res.innerHTML.indexOf('<script')>-1) throw new Error('unescaped markup in the fallback pane');
      } finally { res.innerHTML=before; }
    } },

  { id:'vis_sync_health', group:'UI', name:'Sync health reports observed state, never guesses (5e.1)',
    test: async()=>{
      ['syncHealth','openSyncHealth','renderSyncHealth','getReadsToday'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var h=syncHealth();
      ['signedIn','online','lastSyncOkAt','offlineQueued','pendingDeletes','conflicts',
       'schema','localRecipes','cloudRecipes','readsToday','readsBudget'].forEach(function(k){
        if(!(k in h)) throw new Error('syncHealth() does not report '+k);
      });
      if(h.localRecipes!==recipes.length) throw new Error('the panel disagrees with the actual recipe count');

      // The panel and the "No photo" chip must count the same thing. They did not:
      // the chip excludes clips (a video card has no photograph by design, and the
      // auto-fetch skips them too) while the panel counted them as missing. Tony
      // saw "30 of 44" beside "No photo (9)" and reasonably asked which was
      // lying — during a photo incident being diagnosed from these very numbers.
      var savedHR=recipes;
      try{
        recipes=[{ id:1, name:'has one', photo:'data:image/jpeg;base64,A' },
                 { id:2, name:'bare' },
                 { id:3, name:'also bare' },
                 { id:4, name:'a clip', isClip:true },
                 { id:5, name:'another clip', isClip:true }];
        var h2=syncHealth();
        if(!('photoless' in h2)) throw new Error('syncHealth() does not report how many recipes are missing a photo');
        // The chip's own predicate, written out here so the two are compared
        // rather than assumed equal.
        var chip=recipes.filter(function(r){ return !r.photo; }).length;
        if(h2.photoless!==chip)
          throw new Error('the panel says '+h2.photoless+' are missing a photo but the "No photo" chip says '+chip+' — one is wrong and the user cannot tell which');
        // Four: two bare recipes AND two bare clips. A clip can carry a photo as
        // of v33.9, so excluding them here would put the panel back at odds with
        // the chip and under-report what the auto-fetch will actually go after.
        if(h2.photoless!==4) throw new Error('expected 4 recipes missing a photo (clips included), got '+h2.photoless);
        if(h2.clips!==2) throw new Error('the panel does not say how many are clips, so the composition cannot be read');
        // ...and it must actually PRINT it. Computing the honest figure and not
        // showing it leaves the user reading the same misleading line as before.
        var txt=syncHealthText();
        if(txt.indexOf('missing a photo: 4')===-1)
          throw new Error('the panel never shows how many recipes are missing a photo — the figure is computed and thrown away');
        if(txt.indexOf('clips')===-1)
          throw new Error('the panel does not report the clip count, so the composition of the headline cannot be read');
      } finally { recipes=savedHR; }

      // Tony's standing rule: never assert what the code has not verified. Signed
      // out, the cloud has not been observed at all, so it must say so.
      renderSyncHealth();
      var body=document.getElementById('syncHealthBody');
      if(!body||!body.innerHTML) throw new Error('the panel rendered nothing');
      if(!h.signedIn && body.textContent.indexOf('unknown')===-1)
        throw new Error('signed out, the panel states a cloud figure it cannot possibly know');
      // The reads tally must roll over per day rather than accumulate forever.
      var prev=null; try{ prev=localStorage.getItem(CLOUD_READS_KEY); }catch(e){}
      try{
        localStorage.setItem(CLOUD_READS_KEY, JSON.stringify({day:'2000-01-01', n:9999}));
        if(getReadsToday()!==0) throw new Error("yesterday's read tally leaked into today, got "+getReadsToday());
      } finally {
        try{ if(prev===null) localStorage.removeItem(CLOUD_READS_KEY); else localStorage.setItem(CLOUD_READS_KEY,prev); }catch(e){}
      }
      if(!document.querySelector('#settingsDrop button[onclick*="openSyncHealth"]')) throw new Error('Sync Health is not reachable from Settings');
      // v32.5 — the ONLY input for the Bring! shared secret lives inside the
      // bookmarklet modal, and nothing in Settings opened it. Worse, the modal
      // refused to open until a secret was set, and the refusal pointed at
      // "Settings -> Bring!", which did not exist: a closed loop with no way in.
      // Tony went looking in Settings, reasonably, and found nothing.
      if(!document.querySelector('#settingsDrop button[onclick*="showBringBookmarklet"]'))
        throw new Error('Bring! is not reachable from Settings — the shared secret can only be entered there');
    } },

  { id:'safety_backup_age', group:'Backup', name:'Backup age is tracked and nagged about (5d.1)',
    test: async()=>{
      ['getLastBackupAt','backupIsOverdue','backupAgeDays'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var prev=null; try{ prev=localStorage.getItem(BACKUP_AT_KEY); }catch(e){}
      var bk=_backupRecordForTest();
      try{
        // Never backed up, with a real collection -> overdue. v36.61: nowhere
        // in the family either, or a PC that backed up yesterday answers for it.
        _backupRecordRestoreForTest({});
        if(recipes.length>5 && !backupIsOverdue()) throw new Error('a collection that has never been backed up is not reported as overdue');
        if(backupAgeDays()!==null) throw new Error('backupAgeDays should be null when there has never been a backup');
        // Just backed up -> not overdue, and the age reads 0.
        localStorage.setItem(BACKUP_AT_KEY,String(Date.now()));
        if(backupIsOverdue()) throw new Error('a backup taken just now is reported as overdue');
        if(backupAgeDays()!==0) throw new Error('a backup taken just now should read 0 days, got '+backupAgeDays());
        // 40 days ago -> overdue again.
        localStorage.setItem(BACKUP_AT_KEY,String(Date.now()-40*24*60*60*1000));
        if(recipes.length>5 && !backupIsOverdue()) throw new Error('a 40-day-old backup is not reported as overdue');
        if(backupAgeDays()!==40) throw new Error('expected an age of 40 days, got '+backupAgeDays());
      } finally {
        try{ if(prev===null) localStorage.removeItem(BACKUP_AT_KEY); else localStorage.setItem(BACKUP_AT_KEY,prev); }catch(e){}
        _backupRecordRestoreForTest(bk);
      }
    } },

  { id:'safety_backup_folder', group:'Backup', name:'A chosen folder gets dated snapshots, and only ours are pruned (v36.20)',
    test: async()=>{
      // v36.61 — this presses Back up now for real (into a fake folder), which
      // stamps "last backup" on the device. Parked, so the real device does not
      // come away believing it was backed up.
      var _bk=_backupRecordForTest();
      try { await (async()=>{
      ['chooseBackupFolder','forgetBackupFolder','backupDirLoad','autoBackupIfDue',
       'writeBackupToFolder','pruneBackupFolder','backupJson','backupNagLevel'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      // A fake directory handle. The File System Access API is not available in
      // every browser this suite runs in, and even where it is, a real picker
      // needs a click — so drive the shape the code actually uses.
      function fakeDir(names){
        var files = {};
        (names||[]).forEach(function(n){ files[n] = ''; });
        return {
          name:'Backups', files: files, removed: [], wrote: null,
          async queryPermission(){ return 'granted'; },
          async getFileHandle(n){ var self=this; return { async createWritable(){ return {
            async write(d){ self.wrote = { name:n, data:d }; },
            async close(){ self.files[n] = self.wrote ? self.wrote.data : ''; } }; } }; },
          async removeEntry(n){ this.removed.push(n); delete this.files[n]; },
          entries: function(){
            var ks = Object.keys(files), i = 0;
            return { [Symbol.asyncIterator]: function(){ return { next: async function(){
              return i < ks.length ? { value:[ks[i++], {}], done:false } : { value:undefined, done:true };
            } }; } };
          }
        };
      }

      // (1) A write lands under today's date and holds the real backup.
      var d = fakeDir([]);
      var name = await writeBackupToFolder(d, backupJson());
      var today = new Date().toISOString().slice(0,10);
      if(name !== 'tonys-recipes-backup-'+today+'.json')
        throw new Error('the snapshot is not named for today: '+name);
      var parsed = JSON.parse(d.files[name] || '{}');
      if(!Array.isArray(parsed.recipes) || parsed.recipes.length !== recipes.length)
        throw new Error('the file written is not a real backup ('+(parsed.recipes||[]).length+' recipes)');
      if(!parsed.version) throw new Error('the written backup has no version field, so restore would refuse it');

      // (2) Pruning keeps the newest and touches NOTHING else. The folder is the
      // person's; deleting anything in it that is not ours would be unforgivable.
      var old = [];
      for(var i=1; i<=BACKUP_KEEP+4; i++)
        old.push('tonys-recipes-backup-2020-01-' + String(i).padStart(2,'0') + '.json');
      var mixed = old.concat(['my-tax-return.json','tonys-recipes-backup-notadate.json','holiday.jpg']);
      var d2 = fakeDir(mixed);
      var dropped = await pruneBackupFolder(d2);
      if(dropped.length !== 4) throw new Error('expected 4 old snapshots to go, got '+dropped.length);
      if(dropped.join()!==old.slice(0,4).join()) throw new Error('the wrong ones were dropped: '+dropped.join());
      ['my-tax-return.json','tonys-recipes-backup-notadate.json','holiday.jpg'].forEach(function(f){
        if(d2.removed.indexOf(f)!==-1) throw new Error('pruning deleted "'+f+'", which is not ours');
      });
      if(Object.keys(d2.files).length !== BACKUP_KEEP + 3)
        throw new Error('after pruning the folder holds '+Object.keys(d2.files).length+' files, expected '+(BACKUP_KEEP+3));
      // The newest must survive — pruning that eats the backup it just wrote is
      // worse than no pruning at all.
      var newest = old[old.length-1];
      if(d2.removed.indexOf(newest)!==-1) throw new Error('pruning deleted the newest snapshot');
      var d2b = fakeDir(old.slice(0, BACKUP_KEEP));
      var justWrote = await writeBackupToFolder(d2b, backupJson());
      if(!d2b.files[justWrote]) throw new Error('the snapshot it had just written was pruned away');

      // (3) The automatic one never writes without a folder, and never twice in
      // a week. Both were the point: it must be quiet, not eager.
      var prevAuto=null; try{ prevAuto=localStorage.getItem(BACKUP_AUTO_KEY); }catch(e){}
      var realLoad = window.backupDirLoad, realToast = window.toast;
      try{
        window.toast=function(){};
        window.backupDirLoad = function(){ return Promise.resolve(null); };
        try{ localStorage.removeItem(BACKUP_AUTO_KEY); }catch(e){}
        if(await autoBackupIfDue() !== 'no folder connected')
          throw new Error('with no folder connected the automatic backup did something');

        var d3 = fakeDir([]);
        window.backupDirLoad = function(){ return Promise.resolve({ handle:d3, name:'Backups' }); };
        if(await autoBackupIfDue() !== 'written') throw new Error('a connected folder did not receive a backup');
        if(!Object.keys(d3.files).length) throw new Error('it reported success without writing a file');
        if(await autoBackupIfDue() !== 'not due yet')
          throw new Error('it backed up twice in a row — it would write on every single app start');

        // A folder whose permission has lapsed must NOT prompt from a page load.
        // The prompt must not even be ASKED for: requestPermission outside a
        // user gesture is rejected by the browser anyway, and a permission
        // dialog thrown at someone who was only opening their recipes is the
        // behaviour this silent path exists to avoid. So the assertion is that
        // it was never called, not merely that nothing was written — a version
        // that asks and is refused would pass the weaker check.
        var d4 = fakeDir([]), asked = false;
        d4.queryPermission = async function(){ return 'prompt'; };
        d4.requestPermission = async function(){ asked = true; return 'granted'; };
        window.backupDirLoad = function(){ return Promise.resolve({ handle:d4, name:'Backups' }); };
        try{ localStorage.removeItem(BACKUP_AUTO_KEY); }catch(e){}
        var why = await autoBackupIfDue();
        if(asked) throw new Error('the automatic backup asked for permission from a page load');
        if(why !== 'permission needs a click')
          throw new Error('a lapsed permission did not stop the silent backup (got "'+why+'")');
        if(Object.keys(d4.files).length) throw new Error('it wrote without permission');
      } finally {
        window.backupDirLoad = realLoad; window.toast = realToast;
        try{ if(prevAuto===null) localStorage.removeItem(BACKUP_AUTO_KEY); else localStorage.setItem(BACKUP_AUTO_KEY, prevAuto); }catch(e){}
      }

      // (3b) The BUTTON must use the folder too. If only the automatic path did,
      // pressing Back up now would quietly keep filling the download folder
      // while the panel claimed a folder was connected.
      var realLoad2 = window.backupDirLoad, realToast2 = window.toast, realCreate = document.createElement.bind(document);
      var seen = [], clicks = 0;
      try{
        window.toast = function(t){ seen.push(String(t)); };
        document.createElement = function(t){ var el = realCreate(t); if(t === 'a') el.click = function(){ clicks++; }; return el; };
        var got = null;
        var healthy = fakeDir([]);
        healthy.getFileHandle = async function(n){ return { async createWritable(){ return {
          async write(d){ got = { name:n, len:d.length }; }, async close(){} }; } }; };
        window.backupDirLoad = function(){ return Promise.resolve({ handle:healthy, name:'Backups' }); };
        await backupSave();
        if(!got) throw new Error('Back up now did not write into the connected folder');
        if(clicks !== 0) throw new Error('it wrote to the folder AND started a download');
        if(!seen.some(function(t){ return /Backup saved to "Backups\//.test(t); }))
          throw new Error('it did not say where the file went: ' + seen.join(' | '));

        // A folder that cannot be written falls back to the download AND says so.
        seen.length = 0; clicks = 0;
        var broken = fakeDir([]);
        broken.getFileHandle = async function(){ throw new Error('disk is full'); };
        window.backupDirLoad = function(){ return Promise.resolve({ handle:broken, name:'Backups' }); };
        await backupSave();
        if(clicks !== 1) throw new Error('a failed folder write did not fall back to a download');
        if(!seen.some(function(t){ return /Could not write to "Backups"/.test(t) && /downloads instead/.test(t); }))
          throw new Error('the fallback was silent — a file appeared somewhere unexpected: ' + seen.join(' | '));
      } finally {
        window.backupDirLoad = realLoad2; window.toast = realToast2; document.createElement = realCreate;
        try{ if(prevAuto===null) localStorage.removeItem(BACKUP_AUTO_KEY); else localStorage.setItem(BACKUP_AUTO_KEY, prevAuto); }catch(e){}
      }

      // (4) The nudge escalates rather than staying a 12-second toast forever.
      if(backupNagLevel(31)!=='toast')  throw new Error('a month overdue should still be a toast');
      if(backupNagLevel(61)!=='sticky') throw new Error('two months overdue is still a disappearing toast');
      if(backupNagLevel(120)!=='modal') throw new Error('four months overdue never interrupts');

      // (5) It is reachable. A safety net behind no menu item is no safety net.
      if(!document.querySelector('#settingsDrop button[onclick*="showBackupPanel"]'))
        throw new Error('Backups is not in the Settings menu');
      })(); } finally { _backupRecordRestoreForTest(_bk); }
    } },

  { id:'safety_backup_family', group:'Backup', name:'A backup taken on the PC counts on the phone (v36.61, audit E2)',
    test: async()=>{
      ['newestBackupAt','familyBackupFetch','familyBackupNote','familyBackupRemember','backupWhereText']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var bk=_backupRecordForTest(), realDb=window._fbDb, realUser=window._fbUser,
          realSupported=window.backupFolderSupported, realToast=window.toast, realToastAction=window.toastAction,
          realAuto=window.autoBackupIfDue, realR=recipes, cloudWas=_cloudSnapshotForTest();
      var DAY=24*60*60*1000;
      // A fake cloud holding one document, so both directions can be seen.
      var cloud={}, wrote=[];
      function fakeDb(refuse){ return { collection:function(c){ return { doc:function(id){ return {
        get:async function(){ var d=cloud[c+'/'+id]; return { exists:!!d, data:function(){ return d; } }; },
        set:async function(v){ if(refuse) throw new Error('Missing or insufficient permissions.');
                               wrote.push({ path:c+'/'+id, v:v }); cloud[c+'/'+id]=v; } }; } }; } }; }
      try{
        _backupRecordRestoreForTest({});                     // a device that has never backed up
        // (1) The phone has never backed up, but the PC did so yesterday,
        // automatically. That is a backed-up family, not an overdue one.
        cloud['shared/backups']={ at:Date.now()-DAY, device:'a computer', auto:true };
        window._fbUser={ email:'x@example.com' }; window._fbDb=fakeDb(false);
        await familyBackupFetch();
        if(newestBackupAt()===null) throw new Error('the family record was read but not adopted');
        if(backupAgeDays()!==1) throw new Error('expected the PC backup to read 1 day old, got '+backupAgeDays());
        if(backupIsOverdue()) throw new Error('a phone whose family backed up yesterday is still told it is overdue');
        if(backupWhereText()!=='on a computer (automatic)') throw new Error('where it came from reads "'+backupWhereText()+'"');
        // …and its own older backup does not win over the newer family one.
        localStorage.setItem(BACKUP_AT_KEY, String(Date.now()-10*DAY));
        if(backupAgeDays()!==1) throw new Error('the older local backup won over the newer family one');
        // A newer local one does, and says so.
        localStorage.setItem(BACKUP_AT_KEY, String(Date.now()));
        if(backupAgeDays()!==0 || backupWhereText()!=='on this device') throw new Error('the newer local backup did not win');

        // (2) It only moves forward, and never into the future — a device with
        // its clock a year ahead must not silence every reminder in the family.
        _backupRecordRestoreForTest({});
        familyBackupRemember({ at:Date.now()-5*DAY, device:'a computer' });
        if(familyBackupRemember({ at:Date.now()-50*DAY, device:'an iPhone' })) throw new Error('an OLDER record replaced a newer one');
        if(familyBackupRemember({ at:Date.now()+365*DAY, device:'a computer' })) throw new Error('a record from the future was accepted');
        if(familyBackupRemember({ at:'yesterday' })) throw new Error('a malformed record was accepted');
        if(backupAgeDays()!==5) throw new Error('expected 5 days, got '+backupAgeDays());

        // (3) Backing up here records it for everyone: when and on what, and
        // nothing else — no file name, no path, no email.
        _backupRecordRestoreForTest({}); wrote.length=0;
        var res=await familyBackupNote(true);
        if(res!=='recorded') throw new Error('the backup was not recorded in the cloud: '+res);
        if(wrote.length!==1 || wrote[0].path!=='shared/backups') throw new Error('wrote to the wrong place: '+JSON.stringify(wrote));
        var keys=Object.keys(wrote[0].v).sort().join(',');
        if(keys!=='at,auto,device') throw new Error('the shared record carries more than when and where: '+keys);
        // A read-only member is refused by the rules; their backup still counts here.
        _backupRecordRestoreForTest({}); window._fbDb=fakeDb(true);
        if(await familyBackupNote(false)!=='local only') throw new Error('a refused write was reported as recorded');
        if(backupAgeDays()!==0) throw new Error('a refused cloud write lost the local record of the backup');
        // Signed out: the last value seen still answers.
        window._fbUser=null;
        if(!(await familyBackupFetch())) throw new Error('signed out, the last known family backup was forgotten');

        // (4) The reminder itself stays quiet when the family is backed up, and
        // names where the backup was when it is not.
        recipes=realR.concat([1,2,3,4,5,6].map(function(i){ return normalizeRecipe({ id:888990+i, name:'b'+i, ingredients:[], steps:['x'] }); }));
        window.autoBackupIfDue=async function(){ return 'no folder connected'; };
        var said=[]; window.toast=function(t){ said.push(String(t)); };
        window.toastAction=function(t){ said.push(String(t)); };
        _backupRecordRestoreForTest({}); familyBackupRemember({ at:Date.now()-2*DAY, device:'a computer', auto:true });
        await checkBackupOverdue();
        if(said.length) throw new Error('nagged although the computer backed up two days ago: '+said.join(' | '));
        _backupRecordRestoreForTest({}); familyBackupRemember({ at:Date.now()-40*DAY, device:'a computer', auto:true });
        await checkBackupOverdue();
        if(!said.some(function(t){ return /40 days ago, on a computer/.test(t); }))
          throw new Error('the overdue reminder does not say where the last backup was: '+said.join(' | '));

        // (5) The phone's Backups panel says the computer is the backup device,
        // rather than looking permanently unprotected.
        window.backupFolderSupported=function(){ return false; };
        await renderBackupPanel();
        var note=document.getElementById('backupNoFolderNote');
        if(!note || !/Automatic backups happen on the computer/.test(note.textContent))
          throw new Error('the Backups panel on a phone does not say where automatic backups happen');
        var w=document.getElementById('backupWhere');
        if(!w || !/on a computer/.test(w.textContent)) throw new Error('the panel does not say where the last backup was taken');
      } finally {
        window._fbDb=realDb; window._fbUser=realUser; window.backupFolderSupported=realSupported;
        window.toast=realToast; window.toastAction=realToastAction; window.autoBackupIfDue=realAuto; recipes=realR;
        _backupRecordRestoreForTest(bk);
        try{ await renderBackupPanel(); }catch(e){}
        _cloudRestoreForTest(cloudWas);   // the fake reads were counted
      }
    } },

  { id:'storage_audit_block3', group:'Storage', name:'One language per device, bounded bins, storage shown (v36.61)',
    test: async()=>{
      // Everything this touches is parked: Tony's device has real languages.
      var parked={};
      Object.keys(localStorage).forEach(function(k){ if(/^tonys_i18n_/.test(k)) parked[k]=localStorage.getItem(k); });
      var putBack=function(){
        Object.keys(localStorage).forEach(function(k){ if(/^tonys_i18n_/.test(k) && !(k in parked)) localStorage.removeItem(k); });
        Object.keys(parked).forEach(function(k){ localStorage.setItem(k, parked[k]); });
      };
      var langs=Object.keys(I18N_LANGS); if(langs.length<2) throw new Error('need two languages to test with');
      var A=langs[0], B=langs[1];
      try{
        // (1) Only the language in use stays; the others are remembered as
        // translated, so the menu does not offer a paid run for them.
        localStorage.removeItem(I18N_KNOWN_KEY);
        localStorage.setItem('tonys_i18n_'+A, JSON.stringify({ strings:{ Hello:'a' } }));
        localStorage.setItem('tonys_i18n_'+B, JSON.stringify({ strings:{ Hello:'b' } }));
        localStorage.setItem('tonys_i18n_zz', 'not a dictionary');
        localStorage.setItem(I18N_BIN_PREFIX+A, '{}');
        var gone=i18nPruneCaches([B]);
        if(localStorage.getItem('tonys_i18n_'+A)!==null) throw new Error('the unused language '+A+' was kept');
        if(!localStorage.getItem('tonys_i18n_'+B)) throw new Error('the language in use was pruned');
        if(gone.join()!==A) throw new Error('pruned the wrong things: '+gone.join());
        if(localStorage.getItem('tonys_i18n_zz')===null) throw new Error('pruning deleted a key that is not a dictionary');
        if(localStorage.getItem(I18N_BIN_PREFIX+A)===null) throw new Error('pruning deleted a translation bin');
        if(localStorage.getItem(I18N_KNOWN_KEY)===null) throw new Error('pruning deleted the list of known languages');
        if(i18nKnownLangs().indexOf(A)===-1) throw new Error('a pruned language is no longer known to be translated');
        renderLangMenu();
        var menu=document.getElementById('langMenu');
        var row=menu && Array.from(menu.querySelectorAll('button')).filter(function(b){ return (b.getAttribute('onclick')||'').indexOf("'"+A+"'")!==-1; })[0];
        if(!row) throw new Error('no menu row for '+A);
        if(!/ready/.test(row.textContent)) throw new Error('the menu no longer calls a pruned language ready: "'+row.textContent+'"');
        // Switching to English keeps none but English.
        i18nPruneCaches([]);
        if(localStorage.getItem('tonys_i18n_'+B)!==null) throw new Error('English kept a foreign dictionary');

        // (2) The bins are bounded: newest 1000, for 90 days.
        localStorage.removeItem(I18N_BIN_PREFIX+A); localStorage.removeItem(I18N_BIN_AT_PREFIX+A);
        var big={}; for(var i=0;i<I18N_BIN_MAX+100;i++) big['k'+i]='v'+i;
        var n=i18nEdStash(A, big);
        if(n!==I18N_BIN_MAX) throw new Error('the bin holds '+n+', not '+I18N_BIN_MAX);
        var bin=i18nEdBin(A);
        if(bin.k0 || !bin['k'+(I18N_BIN_MAX+99)]) throw new Error('the bin dropped the NEWEST entries instead of the oldest');
        localStorage.setItem(I18N_BIN_AT_PREFIX+A, String(Date.now()-(I18N_BIN_DAYS+1)*86400000));
        if(Object.keys(i18nEdBin(A)).length) throw new Error('a bin older than '+I18N_BIN_DAYS+' days was kept');
        if(localStorage.getItem(I18N_BIN_PREFIX+A)!==null) throw new Error('the expired bin was hidden but not deleted');
        // …and a fresh one is not thrown away.
        i18nEdStash(A, { x:'y' });
        if(!i18nEdBin(A).x) throw new Error('a fresh bin was thrown away');

        // (3) How full the device is, by what, in Sync Health and its report.
        var r0=deviceStorageReport();
        localStorage.setItem('tonys_i18n_'+A, 'x'.repeat(50000));
        var r1=deviceStorageReport();
        if(r1.cats.languages-r0.cats.languages<50000) throw new Error('a 50,000-character language was not counted as a language');
        var sum=Object.keys(r1.cats).reduce(function(a,k){ return a+r1.cats[k]; },0);
        if(sum!==r1.total) throw new Error('the categories do not add up to the total ('+sum+' vs '+r1.total+')');
        if(!(r1.budget>=2000000)) throw new Error('implausible budget '+r1.budget);
        if(!/% of about/.test(deviceStorageLine(r1))) throw new Error('the storage line reads "'+deviceStorageLine(r1)+'"');
        renderSyncHealth();
        var body=document.getElementById('syncHealthBody');
        if(!body || body.textContent.indexOf('Device storage used')===-1) throw new Error('Sync Health does not show device storage');
        if(syncHealthText().indexOf('device storage: ')===-1) throw new Error('the Sync Health report does not include device storage');
      } finally { putBack(); }
    } },

  { id:'safety_restore_merge', group:'Backup', name:'Restore can add back only what is missing (v36.21)',
    test: async()=>{
      ['backupMergePlan','applyBackupMerge','mergeKeyName','currentRecipeKeys'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      // Restore used to be all or nothing, which is why recovering one clip
      // meant reading the JSON by hand: the only button on offer would have
      // thrown away everything else to get it back.
      var snapshot = recipes.slice(), snapId = nextId;
      var realSave = window.saveLocal, realGrid = window.renderGrid, realFilters = window.renderFilters;
      try{
        window.saveLocal=function(){}; window.renderGrid=function(){}; window.renderFilters=function(){};
        recipes = [
          { id: 9001, name: 'Onion Soup',  ingredients:[{a:'2',n:'onions'}], steps:['fry'] },
          { id: 9002, name: 'Sunday Roast', ingredients:[], steps:[], parts:[
              { uid:'p1', name:'Gravy',        ingredients:[{a:'1',n:'stock'}], steps:['stir'] },
              { uid:'p2', name:'Roast Potatoes', ingredients:[{a:'1kg',n:'potatoes'}], steps:['roast'] } ] }
        ].map(normalizeRecipe);
        nextId = 9100;

        var incoming = [
          { id: 9001, name: 'Onion Soup',      ingredients:[], steps:['x'] },   // same id
          { id: 7,    name: 'onion  SOUP!',    ingredients:[], steps:['x'] },   // same name, different id
          { id: 8,    name: 'Gravy',           ingredients:[], steps:['x'] },   // now a PART of a collection
          { id: 9,    name: 'The Lost Clip',   ingredients:[], steps:[], source:'https://x.test/v', isClip:true },
          { id: 10,   name: 'The Lost Clip',   ingredients:[], steps:[], source:'https://x.test/v', isClip:true }, // twice in the file
          { id: 11,   name: 'Borscht',         ingredients:[{a:'1',n:'beet'}], steps:['boil'] }
        ];
        var plan = backupMergePlan(incoming);
        var names = plan.add.map(function(r){ return r.name; });
        if(plan.add.length !== 2)
          throw new Error('expected 2 recipes to be missing, got '+plan.add.length+': '+names.join(', '));
        if(names.indexOf('The Lost Clip')===-1 || names.indexOf('Borscht')===-1)
          throw new Error('the wrong ones were picked: '+names.join(', '));
        if(plan.already.length !== 4)
          throw new Error(plan.already.length+' were treated as already here, expected 4');
        // Each exclusion for its own reason, so one broken rule cannot hide behind another.
        var skipped = plan.already.map(function(r){ return r.id; });
        [9001, 7, 8, 10].forEach(function(id){
          if(skipped.indexOf(id)===-1) throw new Error('recipe '+id+' should have been recognised as already here');
        });

        // Applying it ADDS and never touches what is here.
        var before = recipes.map(function(r){ return JSON.stringify(r); });
        var added = await applyBackupMerge(plan);
        if(added.length!==2) throw new Error('applied '+added.length+' recipes, expected 2');
        if(recipes.length!==4) throw new Error('the collection holds '+recipes.length+' recipes, expected 4');
        before.forEach(function(json, i){
          if(JSON.stringify(recipes[i])!==json)
            throw new Error('an existing recipe was modified by a merge that only adds: '+recipes[i].name);
        });
        // Fresh ids. Reusing a backup's id silently attaches the restored recipe
        // to whatever now holds that number — including its cloud photo document.
        added.forEach(function(r){
          if(r.id === 9 || r.id === 11) throw new Error('an added recipe kept the backup’s id ('+r.id+')');
          if(r.id < 9100) throw new Error('an added recipe got id '+r.id+', below nextId');
        });
        if(added[0].id === added[1].id) throw new Error('two added recipes share an id');
        // The clip's whole value is its source — the field the original incident lost.
        var clip = added.filter(function(r){ return r.name==='The Lost Clip'; })[0];
        if(!clip || clip.source !== 'https://x.test/v')
          throw new Error('the clip came back without its source, which is the entire recipe');
      } finally {
        recipes = snapshot; nextId = snapId;
        window.saveLocal=realSave; window.renderGrid=realGrid; window.renderFilters=realFilters;
      }

      // Name matching has to survive the differences that actually occur.
      if(mergeKeyName('Onion Soup') !== mergeKeyName('onion  soup!'))
        throw new Error('case and punctuation defeat the name match');
      if(mergeKeyName('מרק בצל') !== mergeKeyName('מרק  בצל'))
        throw new Error('Hebrew names are not matched — the collection is half Hebrew');
      if(mergeKeyName('Onion Soup') === mergeKeyName('Onion Soup 2'))
        throw new Error('two different recipes collapse to the same key');
      if(mergeKeyName('') !== '') throw new Error('an empty name should produce an empty key, never a match-all');

      // The dialog offers three answers, and the SAFE one is the default.
      var realAsk = window.askConfirm, shown = null;
      try{
        window.askConfirm = function(o){ shown = o; return Promise.resolve(false); };
        var inp = document.getElementById('backupRestoreInput');
        await backupRestoreFile({ target: { files: [ new File(
          [JSON.stringify({version:1, recipes:[{id:1,name:'Zzz Test Only',ingredients:[],steps:[]}]})],
          'b.json', {type:'application/json'}) ], value:'' } });
        if(!shown) throw new Error('the restore never asked anything');
        if(!shown.altLabel) throw new Error('there is no third option — it is still replace-or-cancel');
        if(!/Add what is missing/.test(shown.okLabel||''))
          throw new Error('the primary button is not the non-destructive one: '+shown.okLabel);
        if(!/Replace everything/.test(shown.altLabel||''))
          throw new Error('replace is no longer offered at all: '+shown.altLabel);
        if(!shown.altDanger) throw new Error('the destructive option is not marked as destructive');
      } finally { window.askConfirm = realAsk; }
    } },

  { id:'safety_bulk_undo', group:'Backup', name:'Splitting, merging and a destructive import can be undone (v36.22)',
    test: async()=>{
      ['stashBulkUndo','undoBulk','clearBulkUndo'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      var snapshot = recipes.slice(), snapId = nextId;
      var realSave=window.saveData, realGrid=window.renderGrid, realF=window.renderFilters,
          realToast=window.toast, realQ=window.queueCloudDelete, realU=window.unqueueCloudDelete;
      var queued=[], unqueued=[];
      try{
        window.saveData=function(){}; window.renderGrid=function(){}; window.renderFilters=function(){};
        window.toast=function(){};
        window.queueCloudDelete=function(id){ queued.push(id); };
        window.unqueueCloudDelete=function(id){ unqueued.push(id); };

        // (1) A split: the collection goes, three recipes appear. Undo puts the
        // collection back, removes the three, and cleans up after itself in the
        // cloud both ways.
        recipes = [ normalizeRecipe({ id:8001, name:'Sunday Roast', ingredients:[], steps:[], parts:[
            { uid:'a', name:'Gravy',    ingredients:[{a:'1',n:'stock'}], steps:['stir'] },
            { uid:'b', name:'Potatoes', ingredients:[{a:'1kg',n:'spuds'}], steps:['roast'] } ] }) ];
        nextId = 8100;
        stashBulkUndo('the split');
        var made = recipeParts(recipes[0]).map(function(p){ return recipeFromPart(recipes[0], p); });
        made.slice().reverse().forEach(function(r){ recipes.unshift(r); });
        queueCloudDelete(8001);
        recipes = recipes.filter(function(r){ return r.id !== 8001; });
        if(recipes.length!==2) throw new Error('the fixture split did not behave as the app does');
        var idsMade = made.map(function(r){ return r.id; });

        queued.length=0; unqueued.length=0;
        undoBulk();
        if(recipes.length!==1 || recipes[0].id!==8001)
          throw new Error('undo did not put the collection back: '+JSON.stringify(recipes.map(function(r){return r.id;})));
        if(recipeParts(recipes[0]).length!==2) throw new Error('the collection came back without its parts');
        idsMade.forEach(function(id){
          if(queued.indexOf(id)===-1)
            throw new Error('recipe '+id+' was created by the split and left in the cloud — the next load brings it back');
        });
        if(unqueued.indexOf(8001)===-1)
          throw new Error('the collection is still queued for cloud deletion, so undo is undone on the next sync');
        if(nextId < 8100+idsMade.length)
          throw new Error('nextId was wound back to '+nextId+' — an id that already owns a cloud photo document would be handed out again');

        // (2) A record edited IN PLACE. The list snapshot holds the same object,
        // so this is the case a naive undo silently misses.
        recipes = [ normalizeRecipe({ id:8201, name:'Borscht', ingredients:[{a:'1',n:'beet'}], steps:['boil'], notes:'gran’s' }) ];
        var live = recipes[0];
        stashBulkUndo('the update', [live]);
        live.ingredients = [{a:'99',n:'turnip'}];
        live.steps = ['ruin it'];
        live.notes = '';
        live.somethingNew = 'added by the import';
        undoBulk();
        if(recipes[0] !== live) throw new Error('undo replaced the object instead of restoring it — everything holding a reference now points at a ghost');
        if(live.ingredients.length!==1 || live.ingredients[0].n!=='beet')
          throw new Error('the overwritten ingredients did not come back');
        if(live.steps[0]!=='boil') throw new Error('the overwritten method did not come back');
        if(live.notes!=='gran’s') throw new Error('a field cleared by the import stayed cleared');
        if('somethingNew' in live) throw new Error('a field the import ADDED survived the undo');

        // (3) Undo is one-shot, and a cleared stash offers nothing.
        var said=[]; window.toast=function(t){ said.push(String(t)); };
        undoBulk();
        if(!said.some(function(t){ return /Nothing to undo/.test(t); }))
          throw new Error('undo ran twice — the second one would rewind an unrelated change');
        stashBulkUndo('x'); clearBulkUndo(); said.length=0; undoBulk();
        if(!said.some(function(t){ return /Nothing to undo/.test(t); }))
          throw new Error('clearBulkUndo did not clear the stash');
      } finally {
        recipes = snapshot; nextId = snapId;
        window.saveData=realSave; window.renderGrid=realGrid; window.renderFilters=realF;
        window.toast=realToast; window.queueCloudDelete=realQ; window.unqueueCloudDelete=realU;
      }

      // (4) Every operation that rearranges the list offers it, and none of them
      // still claims it cannot be undone.
      var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'})).text();
      var offers = (src.match(/'↩︎ Undo', undoBulk/g) || []).length;
      if(offers < 4) throw new Error('only '+offers+' operations offer Undo — expected split, collect, and both import updates');
      // Comments quote the old wording on purpose — the point is what the app
      // SAYS, so scan the code with the commentary taken out.
      var code = src.replace(/^\s*\/\/.*$/gm, '');
      if(/This cannot be undone from here/.test(code))
        throw new Error('something still tells the user it cannot be undone');
    } },

  { id:'safety_orphan_sweep', group:'Cloud Sync', name:'Orphaned photo documents can be swept (5d.2)',
    test: async()=>{
      if(typeof sweepOrphanPhotos!=='function') throw new Error('sweepOrphanPhotos not defined');
      // It must only ever target photos whose recipe is gone. Deleting a photo
      // belonging to a live recipe would be silent, permanent data loss.
      var src=String(sweepOrphanPhotos);
      if(src.indexOf('_cloudPhotoIds')===-1) throw new Error('the sweep does not consult the known cloud photo set');
      if(src.indexOf('live[')===-1) throw new Error('the sweep does not exclude photos belonging to live recipes');
      if(src.indexOf('permission-denied')===-1) throw new Error('the sweep does not handle an admin-only refusal honestly');
      if(!document.querySelector('#settingsDrop button[onclick*="sweepOrphanPhotos"]')) throw new Error('the sweep is not reachable from Settings');
    } },

  { id:'ui_keyboard_cards', group:'UI', name:'Recipe cards are reachable by keyboard (5c.1)',
    test: async()=>{
      // There was not one tabindex in the whole file: the grid could not be
      // reached or opened without a mouse.
      var prevView=viewMode, prevStored=null;
      try{ prevStored=localStorage.getItem('tonys_view_mode'); }catch(e){}
      try{
        setView('grid');
        var card=document.querySelector('.recipe-card');
        if(!card) throw new Error('no recipe card rendered');
        if(card.getAttribute('tabindex')!=='0') throw new Error('recipe cards are not focusable — the grid has no keyboard path');
        if(card.getAttribute('role')!=='button') throw new Error('a card behaves as a button but does not say so to assistive tech');
        if(!card.getAttribute('aria-label')) throw new Error('a focusable card with no accessible name is unusable by screen reader');
        if((card.getAttribute('onkeydown')||'').indexOf('cardKey')===-1) throw new Error('cards are focusable but Enter/Space do nothing');
        if(typeof cardKey!=='function') throw new Error('cardKey not defined');
        setView('list');
        var row=document.querySelector('.recipe-list-item');
        if(row && row.getAttribute('tabindex')!=='0') throw new Error('list rows are not keyboard-reachable either');
      } finally {
        setView(prevView);
        try{ if(prevStored===null) localStorage.removeItem('tonys_view_mode'); else localStorage.setItem('tonys_view_mode',prevStored); }catch(e){}
      }
    } },

  { id:'ui_swipe_fav', group:'UI', name:'Swipe favourites only — never deletes (5c.2)',
    test: async()=>{
      ['swipeStart','swipeMove','swipeEnd'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      // The explicit requirement: a swipe must never be able to destroy a recipe.
      var src=String(swipeEnd)+String(swipeStart)+String(swipeMove);
      ['deleteRecipe','deleteSelected','queueCloudDelete','recipes.splice'].forEach(function(bad){
        if(src.indexOf(bad)>-1) throw new Error('the swipe handler can reach '+bad+' — swipe must only ever toggle a favourite');
      });
      if(src.indexOf('fav')===-1) throw new Error('the swipe handler does not touch the favourite flag, so what does it do?');
      // Vertical movement must abandon the gesture, or scrolling the grid flips
      // hearts. Driven with synthetic touches rather than grepping swipeMove for
      // 'Math.abs(dy) > Math.abs(dx)', which survives the comparison being
      // inverted or dead (the false-green shape swept out in v34.1).
      var swKeep=recipes, swSave=window.saveData, swGrid=window.renderGrid, swT=window.toast;
      try{
        window.saveData=function(){}; window.renderGrid=function(){}; window.toast=function(){};
        recipes=[normalizeRecipe({ id:9401, name:'Swipe target', fav:false, ingredients:[], steps:['x'] })];
        var card=document.createElement('div');
        function touch(x,y){ return { touches:[{ clientX:x, clientY:y }],
                                      changedTouches:[{ clientX:x, clientY:y }],
                                      currentTarget:card, target:card, preventDefault:function(){} }; }
        // A mostly-VERTICAL drag is a scroll: it must not toggle anything.
        // dx must EXCEED SWIPE_MIN here, or the threshold is what stops the
        // toggle and the vertical guard could be deleted freely — the first
        // version used dx 10 and survived exactly that mutation (v34.2).
        swipeStart(touch(100,100), 9401);
        swipeMove(touch(240,400));           // dx 140 (over the 55px threshold), dy 300 — a scroll
        swipeEnd(touch(240,400));
        if(recipes[0].fav)
          throw new Error('scrolling the grid vertically toggled a favourite — swipeMove does not abandon a vertical drag');
        // A mostly-HORIZONTAL drag past the threshold is a real swipe.
        swipeStart(touch(100,100), 9401);
        swipeMove(touch(240,110));           // dx 140 > dy 10
        swipeEnd(touch(240,110));
        if(!recipes[0].fav)
          throw new Error('a deliberate horizontal swipe did not toggle the favourite, so the gesture does nothing at all');
      } finally {
        recipes=swKeep; window.saveData=swSave; window.renderGrid=swGrid; window.toast=swT;
      }
    } },

  { id:'css_hebrew_font', group:'CSS', name:'Hebrew has a real typeface, not an OS fallback',
    test: async()=>{
      // Playfair Display and DM Sans carry no Hebrew glyphs. Without a Hebrew
      // face in the stack every Hebrew title renders in whatever generic serif
      // the OS picks, beside an English title in Playfair — the grid reads as
      // two different apps. This is a bilingual collection; it matters.
      var link=Array.prototype.slice.call(document.querySelectorAll('link[href*="fonts.googleapis.com"]'))
        .map(function(l){ return l.getAttribute('href')||''; }).join(' ');
      if(!/Frank\+Ruhl\+Libre/.test(link)) throw new Error('Frank Ruhl Libre is not being requested — Hebrew titles have no serif face');
      if(!/Heebo/.test(link)) throw new Error('Heebo is not being requested — Hebrew body text has no sans face');
      // And the stacks must actually name them, after the Latin face so that CSS
      // per-glyph fallback puts each script in its own typeface.
      var t=document.querySelector('.card-title')||document.querySelector('h1,h2');
      var stacks=[];
      if(t) stacks.push(window.getComputedStyle(t).fontFamily);
      var b=document.body; stacks.push(window.getComputedStyle(b).fontFamily);
      var joined=stacks.join(' ');
      if(!/Frank Ruhl Libre|Heebo/i.test(joined))
        throw new Error('no Hebrew face in the resolved font stacks ('+joined+') — the link alone does nothing');
    } },

  { id:'css_phone_card', group:'CSS', name:'Phone grid card drops prep/servings, keeps the rest',
    test: async()=>{
      // Read the real CSSOM rather than matching text, and read it from the
      // phone media block specifically — the desktop grid still shows this line.
      var phoneRules=[];
      for(var i=0;i<document.styleSheets.length;i++){
        var rules; try{ rules=document.styleSheets[i].cssRules; }catch(e){ continue; }
        for(var j=0;j<rules.length;j++){
          if(rules[j].type===4 && /max-width:\s*700px/.test(rules[j].conditionText||rules[j].media.mediaText)){
            for(var k=0;k<rules[j].cssRules.length;k++) phoneRules.push(rules[j].cssRules[k]);
          }
        }
      }
      var meta=phoneRules.filter(function(r){ return (r.selectorText||'')==='.recipe-grid .card-meta'; })[0];
      if(!meta) throw new Error('no phone-width rule for .recipe-grid .card-meta — prep/servings are back on the phone card');
      if(meta.style.display!=='none') throw new Error('.card-meta is "'+meta.style.display+'" on phones, expected none');
      // Nothing else on the card may be hidden at phone width. Checked here in
      // the CSSOM rather than by querySelector, because display:none leaves the
      // element in the DOM — an existence check would sail straight past it.
      var keep={'card-category-badge':'the category badge','difficulty':'the difficulty pill',
                'fav-btn':'the favourite heart','card-image':'the photo tile','card-title':'the recipe name'};
      phoneRules.forEach(function(r){
        if(r.style && r.style.display==='none'){
          Object.keys(keep).forEach(function(cls){
            if((r.selectorText||'').indexOf('.'+cls)>-1)
              throw new Error(keep[cls]+' is hidden on phones by "'+r.selectorText+'" — it is one of the four things that should stay');
          });
        }
      });
      // ...and the things that must survive are still rendered. Desktop defaults
      // to list view, so switch to grid deliberately and put it back afterwards.
      var prevView=viewMode, prevStored=null;
      try{ prevStored=localStorage.getItem('tonys_view_mode'); }catch(e){}
      try{
        setView('grid');
        var card=document.querySelector('.recipe-grid .recipe-card');
        if(!card) throw new Error('no recipe card rendered in grid view');
        if(!card.querySelector('.card-category-badge')) throw new Error('the category badge is gone from the card');
        if(!card.querySelector('.difficulty')) throw new Error('the difficulty pill is gone from the card');
        if(!card.querySelector('.fav-btn')) throw new Error('the favourite heart is gone from the card');
        if(!card.querySelector('.card-image')) throw new Error('the photo/emoji tile is gone from the card');
        if(!card.querySelector('.card-title')) throw new Error('the recipe name is gone from the card — it is what you pick by');
      } finally {
        setView(prevView);
        try{ if(prevStored===null) localStorage.removeItem('tonys_view_mode'); else localStorage.setItem('tonys_view_mode',prevStored); }catch(e){}
      }
    } },

  { id:'ui_owner_contrast', group:'CSS', name:'Owner row stays readable in BOTH themes',
    test: async()=>{
      // The owner row hard-coded a cream background while .access-name is
      // var(--ink) — which inverts to near-white in dark mode, so the name
      // vanished. Checking both themes is the point: a single-theme check is
      // exactly what let this through.
      var parse=function(c){
        var m=(c||'').match(/[\d.]+/g)||[];
        return { r:+m[0]||0, g:+m[1]||0, b:+m[2]||0, a:(m.length>3?+m[3]:(c==='transparent'?0:1)) };
      };
      // A translucent tint has to be composited over what is behind it, or the
      // measurement is of a colour nobody ever sees. Walk up to the first opaque
      // layer, then blend back down.
      var effBg=function(el){
        var layers=[];
        for(var n=el; n && n.nodeType===1; n=n.parentElement){
          var c=parse(window.getComputedStyle(n).backgroundColor);
          if(c.a>0){ layers.push(c); if(c.a>=1) break; }
        }
        var out=layers.length?layers[layers.length-1]:{r:255,g:255,b:255};
        for(var i=layers.length-2;i>=0;i--){
          var t=layers[i];
          out={ r:t.r*t.a+out.r*(1-t.a), g:t.g*t.a+out.g*(1-t.a), b:t.b*t.a+out.b*(1-t.a) };
        }
        return out;
      };
      var lum=function(c){
        var v=['r','g','b'].map(function(k){ var x=c[k]/255; return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4); });
        return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
      };
      var prev=getTheme(), worst=null;
      try{
        ['light','dark'].forEach(function(t){
          setTheme(t);
          var name=document.querySelector('#accessOverlay .access-name');
          var row=name && name.closest('.access-row');
          if(!name||!row) throw new Error('the owner row is gone from Family Access');
          var a=lum(parse(window.getComputedStyle(name).color)), b=lum(effBg(row));
          var ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
          if(worst===null||ratio<worst.ratio) worst={theme:t,ratio:ratio};
        });
      } finally { setTheme(prev); }
      if(worst.ratio<4.5) throw new Error('owner name contrast is '+worst.ratio.toFixed(2)+':1 in '+worst.theme+' mode (needs 4.5:1) — it is unreadable there');
    } },

  { id:'ui_rules_cta', group:'UI', name:'The Firestore rules step is legible, not a footnote',
    test: async()=>{
      // Publishing the rules is the only step that actually grants anyone
      // access, and at 12px in --muted this was missed altogether. Pinned so a
      // later tidy-up cannot quietly shrink it back.
      var btn=Array.prototype.slice.call(document.querySelectorAll('button'))
        .filter(function(b){ return (b.getAttribute('onclick')||'').indexOf('toggleAccessRules')>-1; })[0];
      if(!btn) throw new Error('the "Show Firestore security rules" button is gone');
      var fs=parseFloat(window.getComputedStyle(btn).fontSize);
      if(!(fs>=14)) throw new Error('the rules toggle is '+fs+'px — too small for the one step that activates access');
      var note=document.querySelector('#accessRulesPanel div');
      if(!note) throw new Error('the "copy these rules to..." note is gone');
      var nfs=parseFloat(window.getComputedStyle(note).fontSize);
      if(!(nfs>=13)) throw new Error('the Firebase Console instruction is '+nfs+'px — that is footnote size');
      var link=note.querySelector('a[href*="security/rules"]');
      if(!link) throw new Error('the note no longer links to the Firebase rules editor');
    } },

  { id:'cloud_doc_range', group:'Cloud Sync', name:'The recipe_* range reads recipes and nothing else',
    test: async()=>{
      if(typeof RECIPE_DOC_LO!=='string'||typeof RECIPE_DOC_HI!=='string') throw new Error('the recipe_* document-id bounds are not defined');
      var inRange=function(id){ return id>=RECIPE_DOC_LO && id<RECIPE_DOC_HI; };
      ['recipe_1','recipe_12','recipe_999999'].forEach(function(id){
        if(!inRange(id)) throw new Error(id+' should be inside the recipe_* range but is not');
      });
      // Every other document that shares the `shared` collection. Any of these
      // falling inside the range would be parsed as a recipe — silently, and with
      // whatever nonsense that produces. `recipes` is the deleted legacy document
      // and stays on this list: the bound was chosen to exclude it, so a change
      // that let it back in is a change to the bound itself.
      ['recipes','photo_1','meta','access','chat_x','chatpart_x_1'].forEach(function(id){
        if(inRange(id)) throw new Error(id+' falls inside the recipe_* range and would be parsed as a recipe');
      });
    } },

  { id:'cloud_stale_base', group:'Cloud Sync', name:'A stale-base write is refused, not applied',
    test: async()=>{
      if(typeof cloudWriteAllowed!=='function') throw new Error('cloudWriteAllowed not defined');
      if(!cloudWriteAllowed(null,123)) throw new Error('the first write of a recipe (no cloud document yet) must be allowed');
      if(!cloudWriteAllowed(500,500)) throw new Error('writing over the exact version we read must be allowed');
      if(!cloudWriteAllowed(400,500)) throw new Error('a cloud copy older than our base must be writable');
      // The whole point of 5.4: someone else wrote after we last read.
      if(cloudWriteAllowed(600,500)) throw new Error('a write whose base is older than the cloud copy was allowed — this is the lost-edit bug');
      if(cloudWriteAllowed(600,undefined,123)) throw new Error('writing over a genuinely different cloud copy with no base must be refused');
      // v29.2 — but "no base" is NOT the same as "conflict". If the cloud copy is
      // the same version we hold, we ARE up to date and the write is safe.
      if(!cloudWriteAllowed(600,undefined,600)) throw new Error('refused a write although our copy is the same version as the cloud — this is what refused an entire collection in v29.1');
    } },

  { id:'cloud_nextid', group:'Cloud Sync', name:'nextId never regresses',
    test: async()=>{
      if(mergeNextId(10,20)!==20) throw new Error('a higher cloud nextId must win');
      if(mergeNextId(20,10)!==20) throw new Error('a higher local nextId must win');
      if(mergeNextId(0,7)!==7||mergeNextId(7,0)!==7) throw new Error('a missing side must not drag nextId to 0');
      if(mergeNextId(undefined,undefined)!==0) throw new Error('two missing sides should be 0, not NaN');
      var s=_cloudSnapshotForTest();
      try{
        var db=_fakeFirestore({ meta:{ nextId:99, ids:[], schema:2 } });
        await writeCloudMeta([{id:1}], 5, db);
        if(db._docs.meta.nextId!==99) throw new Error('writeCloudMeta lowered nextId from 99 to '+db._docs.meta.nextId+' — two devices would then mint the same recipe id');
      } finally { _cloudRestoreForTest(s); }
    } },

  { id:'cloud_delete_docs', group:'Cloud Sync', name:'Deleting a recipe removes its doc AND its photo doc',
    test: async()=>{
      var s=_cloudSnapshotForTest();
      try{
        var db=_fakeFirestore({ recipe_7:{ r:'{}', updatedAt:1 }, photo_7:{ photo:'x' }, recipe_8:{ r:'{}', updatedAt:1 } });
        window._pendingCloudDeletes={}; queueCloudDelete(7);
        await flushCloudDeletes(db);
        if(db._docs.recipe_7) throw new Error('recipe_7 survived the delete');
        if(db._docs.photo_7) throw new Error('photo_7 was orphaned — its recipe is gone but the photo document remains, and nothing will ever clean it up');
        if(!db._docs.recipe_8) throw new Error('deleting one recipe removed another');
        if(Object.keys(window._pendingCloudDeletes).length) throw new Error('the delete queue was not cleared after flushing');
      } finally { _cloudRestoreForTest(s); }
    } },

  { id:'cloud_history_split', group:'Cloud Sync', name:'History always travels to the cloud',
    test: async()=>{
      var r={id:1,name:'x',history:[{name:'old'}],photo:'',updatedAt:1};
      // 3.4 — per-recipe documents have no shared ceiling, so history travels.
      if(!slimRecipeForCloud(r).history) throw new Error('history is missing from the per-recipe document — 5.4 was the whole reason it could start syncing');
      // v32.3 — the second shape is gone, so a stray extra argument must be
      // inert rather than quietly reverting to the history-free legacy copy.
      if(!slimRecipeForCloud(r,false).history) throw new Error('a second argument still strips history — the legacy shape has come back');
    } },

  { id:'cloud_read_cache', group:'Cloud Sync', name:'An unchanged cloud is not re-read (5.9)',
    test: async()=>{
      // 5.4 traded writes for reads; without this the foreground refresh cost
      // ~350 reads every time the app was focused. The rule has to be strict in
      // both directions: skip when genuinely unchanged, never skip on doubt.
      if(typeof canSkipCloudFanout!=='function') throw new Error('canSkipCloudFanout not defined');
      var meta={updatedAt:500, ids:[1,2,3]};
      if(!canSkipCloudFanout(meta,3,500,false,true)) throw new Error('an unchanged cloud was re-read in full — 5.9 is not working');
      if(canSkipCloudFanout(meta,3,499,false,true)) throw new Error('a MOVED cloud was skipped — this device would show stale recipes');
      if(canSkipCloudFanout(meta,3,500,true,true)) throw new Error('skipped while offline edits were queued — they would never be pushed');
      if(canSkipCloudFanout(meta,0,500,false,true)) throw new Error('skipped with nothing held locally — the grid would stay empty');
      if(canSkipCloudFanout(meta,2,500,false,true)) throw new Error('skipped while the cloud lists more recipes than we hold — the local copy is incomplete');
      if(canSkipCloudFanout(meta,3,null,false,true)) throw new Error('skipped without ever having done a full read on this device');
      if(canSkipCloudFanout({ids:[1]},1,500,false,true)) throw new Error('skipped on a meta document with no updatedAt to compare');
      // v29.3 — the one that caused the stuck loop: skipping the read without
      // holding the base means the next save has nothing to compare and refuses
      // the whole collection, and the next load skips again. Never skip blind.
      if(canSkipCloudFanout(meta,3,500,false,false)) throw new Error('skipped the read without holding the concurrency base — every save would then be refused, on every load, forever');
      // The stamp has to survive a reload, or every cold start pays full price.
      if(typeof setLastCloudMetaAt!=='function'||typeof loadLastCloudMetaAt!=='function') throw new Error('the high-water mark is not persisted');
      var prev=null; try{ prev=localStorage.getItem(CLOUD_META_AT_KEY); }catch(e){}
      try{
        setLastCloudMetaAt(4242); loadLastCloudMetaAt();
        if(_lastCloudMetaAt!==4242) throw new Error('the high-water mark did not survive a reload — every cold start would re-read everything');
      } finally {
        try{ if(prev===null) localStorage.removeItem(CLOUD_META_AT_KEY); else localStorage.setItem(CLOUD_META_AT_KEY,prev); }catch(e){}
        loadLastCloudMetaAt();
      }
    } },

  { id:'cloud_base_persist', group:'Cloud Sync', name:'The concurrency base survives a reload (v29.2)',
    test: async()=>{
      // The v29.1 failure, reproduced: 5.9 skips re-reading an unchanged cloud, so
      // nothing populated the base map on a fresh load; every recipe then looked
      // like a conflict and the whole collection was refused, on every load.
      ['saveCloudBase','loadCloudBase','hashStr'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var s=_cloudSnapshotForTest();
      var prev=null; try{ prev=localStorage.getItem(CLOUD_BASE_KEY); }catch(e){}
      try{
        window._cloudRecipeBase={7:1700}; window._cloudRecipeStamp={7:hashStr('x')};
        saveCloudBase();
        // simulate a reload: memory cleared, storage intact
        window._cloudRecipeBase={}; window._cloudRecipeStamp={};
        loadCloudBase();
        if(_cloudRecipeBase[7]!==1700)
          throw new Error('the base did not survive a reload — every save would be refused as a conflict');
        if(_cloudRecipeStamp[7]!==hashStr('x'))
          throw new Error('the change stamp did not survive a reload — every recipe would be rewritten on every save');
        // and the stamp must be a digest, not the whole recipe, or persisting it
        // would roughly double what localStorage already holds.
        if(hashStr(JSON.stringify({a:1})).length>24) throw new Error('the stamp is not a compact digest');
      } finally {
        _cloudRestoreForTest(s);
        try{ if(prev===null) localStorage.removeItem(CLOUD_BASE_KEY); else localStorage.setItem(CLOUD_BASE_KEY,prev); }catch(e){}
        loadCloudBase();
      }
    } },

  { id:'wa_folder_listing', group:'WhatsApp', name:'A chat folder is listed, so index.json is optional (5f.7)',
    test: async()=>{
      ['waRepoFromBase','waListFolder','waMergeFolderList'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var r=waRepoFromBase('https://rozinante2004-hash.github.io/tonys-recipes/whatsapp/');
      if(!r||r.owner!=='rozinante2004-hash'||r.repo!=='tonys-recipes'||r.path!=='whatsapp')
        throw new Error('the Pages URL did not resolve to the right repo/path: '+JSON.stringify(r));
      // a non-Pages folder must fall through to index.json, not guess a repo
      if(waRepoFromBase('https://example.com/chats/')) throw new Error('a non-GitHub folder was treated as a repo');
      // uploading a file must be enough on its own
      var merged=waMergeFolderList(['a.zip','b.txt'], null);
      if(merged.length!==2) throw new Error('a folder listing alone did not produce a usable list');
      // ...and index.json keeps its job of naming groups nicely
      var merged2=waMergeFolderList(['a.zip','b.txt'], [{file:'a.zip', group:'Family Food'}]);
      var a=merged2.filter(function(e){ return (e.file||e)==='a.zip'; })[0];
      if(!a||a.group!=='Family Food') throw new Error('index.json labels were lost when the folder was listed');
      // a file only index.json knows about (private repo, listing unavailable) survives
      var merged3=waMergeFolderList(['a.zip'], [{file:'c.txt', group:'Other'}]);
      if(merged3.length!==2) throw new Error('a file named only in index.json was dropped');
      // and no duplicates when both sources name the same file
      var merged4=waMergeFolderList(['a.zip'], ['a.zip']);
      if(merged4.length!==1) throw new Error('the same file was listed twice');
      // v29.7 — the folder also holds the guides, their pictures and the
      // Shortcut. Listing dragged all of them in as chats and reported four
      // failures for files that were never exports. Reported by Tony.
      if(typeof waFilterListing!=='function') throw new Error('waFilterListing not defined');
      // Drive the real listing shape the GitHub API returns, not the helper on
      // its own: an earlier version of this test checked only the predicate and
      // passed while waListFolder still used the old name-based filter.
      var listing=[
        { type:'file', name:'Meat_Whatsapp.txt' },
        { type:'file', name:'UPLOAD-FROM-IPHONE.md' },
        { type:'file', name:'upload-guide.html' },
        { type:'file', name:'upload.html' },
        { type:'file', name:'Send-chat-to-Recipes.shortcut' },
        { type:'file', name:'index.json' },
        { type:'file', name:'README.md' },
        { type:'dir',  name:'img' }
      ];
      var kept=waFilterListing(listing);
      if(kept.length!==1||kept[0]!=='Meat_Whatsapp.txt')
        throw new Error('the folder listing kept files that are not chats: '+JSON.stringify(kept));
      // ...and waListFolder must actually apply it. Grepping its source for
      // 'waFilterListing' is satisfied by `return (false ? waFilterListing(j) : j)`,
      // which ships the unfiltered listing with the suite green (proved by
      // mutation, v34.1). Drive it with a stubbed fetch instead.
      var realFetch=window.fetch;
      try{
        window.fetch=function(){ return Promise.resolve({ ok:true, json:function(){ return Promise.resolve(listing); } }); };
        var viaRoute=await waListFolder('https://rozinante2004-hash.github.io/tonys-recipes/whatsapp/');
        if(!viaRoute) throw new Error('waListFolder returned nothing for a listing it should have parsed');
        if(viaRoute.length!==1||viaRoute[0]!=='Meat_Whatsapp.txt')
          throw new Error('waListFolder returned the UNFILTERED listing: '+JSON.stringify(viaRoute));
      } finally { window.fetch=realFetch; }
      // ...without rejecting real exports. WhatsApp's download can arrive with
      // no extension at all, which is why this is a denylist and not .txt/.zip.
      ['Meat_Whatsapp.txt','_chat.zip','WhatsApp Chat with Family.txt','download',
       'שאלות בשר.txt'].forEach(function(n){
        if(!waLooksLikeChatFile(n)) throw new Error(n+' was rejected but is a plausible export');
      });
    } },

  { id:'wa_cloud_ids', group:'WhatsApp', name:'Cloud chat ids are stable, ASCII, and never collide (5f.8)',
    test: async()=>{
      ['waSlug','waChatDocId','waChatPartId','waChunkText'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      // A Hebrew file name strips to nothing under a naive ASCII filter. Two of
      // them would then share one document and silently overwrite each other —
      // exactly the overwrite hazard already fixed once in whatsapp/upload.html.
      var a=waSlug('שאלות בשר.txt'), b=waSlug('מתכוני עוגות.txt');
      if(a===b) throw new Error('two Hebrew chat names collapsed to the same document id: '+a);
      if(!/^[A-Za-z0-9_-]+$/.test(a)) throw new Error('the id is not safe for a document name: '+a);
      if(waSlug('Meat_Whatsapp.txt')!==waSlug('Meat_Whatsapp.txt')) throw new Error('the id is not stable across calls');
      if(waSlug('a.txt')===waSlug('b.txt')) throw new Error('different files shared an id');
      // The head range query must not sweep up the part documents; if it does,
      // listing chats drags every byte of every export back down the wire.
      var lo=CHAT_DOC_LO, hi=CHAT_DOC_HI;
      var head=waChatDocId('x'), part=waChatPartId('x',1);
      if(!(head>=lo&&head<hi)) throw new Error('the head document falls outside its own range query');
      if(part>=lo&&part<hi) throw new Error('a part document is inside the head range — listing would read every chat in full');
    } },

  { id:'wa_cloud_chunking', group:'WhatsApp', name:'A big chat is split by BYTES and rejoins exactly (5f.8)',
    test: async()=>{
      // Hebrew is two bytes per character in UTF-8 and emoji are four, so a
      // chunk budgeted in characters is double what you asked for and blows the
      // 1 MiB document cap. The bug only appears on a big Hebrew export — which
      // is precisely what this collection is.
      var heb='שלום עולם בישול בשר ';
      var big=''; while(big.length<40000) big+=heb;
      var chunks=waChunkText(big, 5000);
      if(chunks.length<2) throw new Error('a large text was not split at all');
      chunks.forEach(function(c,i){
        var n=new Blob([c]).size;
        if(n>5000) throw new Error('chunk '+i+' is '+n+' bytes, over the '+5000+' budget — sized in characters, not bytes');
      });
      // Each part goes to Firestore as a UTF-8 string, so the honest check is the
      // ROUND TRIP, not an in-memory join. JS strings hold UTF-16 code units, so
      // concatenating a split surrogate pair silently reunites it — a join-based
      // assertion here passed even with the surrogate guard deliberately removed.
      var enc=new TextEncoder(), dec=new TextDecoder();
      var roundTrip=function(parts){ return parts.map(function(c){ return dec.decode(enc.encode(c)); }).join(''); };
      if(roundTrip(chunks)!==big) throw new Error('the chunks do not rejoin to the original text');
      // Emoji must survive that round trip. A pair split across two documents
      // comes back as two U+FFFD — one wrong emoji, in one message, in one chat,
      // which is near-undebuggable months later.
      var emo=''; while(emo.length<3000) emo+='קציצות 🍖🥩🔥 ';
      var ec=waChunkText(emo, 700);
      if(ec.length<2) throw new Error('the emoji text was not split, so the surrogate case went untested');
      var rejoined=roundTrip(ec);
      if(/�/.test(rejoined)) throw new Error('a surrogate pair was split across two chunks');
      if(rejoined!==emo) throw new Error('emoji were corrupted by the split');
      // Degenerate inputs must not loop forever or throw.
      if(waChunkText('',100).join('')!=='') throw new Error('empty text did not round-trip');
      if(waChunkText('abc',10000).length!==1) throw new Error('a small text was split needlessly');
    } },

  { id:'wa_cloud_wiring', group:'WhatsApp', name:'Synced chats are a real third source, end to end (5f.8)',
    test: async()=>{
      ['saveChatDoc','readCloudChatIndex','loadCloudChatText','deleteCloudChat','waRefreshCloud','waPushToCloud']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      // The reason this feature exists: a device that cannot reach GitHub must
      // still be able to read a chat. So the loader has to handle 'cloud'
      // WITHOUT falling through to the folder fetch.
      //
      // Checked by RUNNING it, not by reading its source. This used to grep
      // String(waLoadAllMessages) for "'cloud'", which broke the moment the
      // per-chat load was split out to let chats load in parallel (v32.8) —
      // the behaviour was untouched and the test failed anyway. Stub the cloud
      // reader, forbid the network, and see which one it actually calls.
      if(typeof waLoadOneChat!=='function') throw new Error('waLoadOneChat not defined');
      var realCloud=window.loadCloudChatText, realFetch=window.fetch;
      var cloudCalls=0, fetchCalls=0, slug='selftest-cloud-'+Date.now();
      window.loadCloudChatText=function(){ cloudCalls++; return Promise.resolve('1/2/2026, 10:00 - Dana: shakshuka'); };
      window.fetch=function(){ fetchCalls++; return Promise.reject(new Error('the cloud source fell through to the network')); };
      var got;
      try{
        got=await waLoadOneChat({source:'cloud', slug:slug, group:'G', id:'cloud:'+slug});
      } finally {
        window.loadCloudChatText=realCloud; window.fetch=realFetch;
        if(typeof _waCloudCache==='object') delete _waCloudCache[slug];
      }
      if(cloudCalls!==1) throw new Error('a cloud chat did not go through loadCloudChatText (called '+cloudCalls+'×)');
      if(fetchCalls!==0) throw new Error('a cloud chat fell through to the folder fetch — the offline-GitHub case is broken');
      if(!got||!got.length||got[0].text.indexOf('shakshuka')===-1)
        throw new Error('the cloud text was not parsed into messages');
      // Import must push to the cloud, or the phone stays a dead end — that is the
      // entire point of 5f.8, since the iPhone cannot reach GitHub at all. Driven
      // with a real File: grepping waImportFiles for 'saveChatDoc' survives the
      // call sitting in a dead branch (v34.1).
      var wiPut=window.waPut, wiIdx=window.waIndex, wiSave=window.waSaveIndex,
          wiSaveDoc=window.saveChatDoc, wiRender=window.renderWaSources, wiToast=window.toast,
          wiDb=window._fbDb, wiUser=window._fbUser, wiAvail=window._idbAvailable, pushedFiles=[];
      try{
        window.toast=function(){}; window.renderWaSources=function(){};
        window.waPut=function(){ return Promise.resolve(); };
        window.waIndex=function(){ return []; };
        window.waSaveIndex=function(){};
        window.saveChatDoc=function(file){ pushedFiles.push(file); return Promise.resolve(); };
        window._idbAvailable=true; window._fbDb={}; window._fbUser={ uid:'t' };
        var chat='[01/02/2026, 10:00:00] Dana: shakshuka with harissa\n'
               + '[01/02/2026, 10:01:00] Yossi: how much harissa?\n';
        var f=new File([chat], 'Meat_Whatsapp.txt', { type:'text/plain' });
        await waImportFiles([f]);
        if(pushedFiles.indexOf('Meat_Whatsapp.txt')===-1)
          throw new Error('importing a chat never pushed it to the cloud, so it stays invisible to the phone — which is the whole reason this path exists');
      } finally {
        window.waPut=wiPut; window.waIndex=wiIdx; window.waSaveIndex=wiSave;
        window.saveChatDoc=wiSaveDoc; window.renderWaSources=wiRender; window.toast=wiToast;
        window._fbDb=wiDb; window._fbUser=wiUser; window._idbAvailable=wiAvail;
      }
      // Removing a shared chat affects everyone; it must ask first.
      // Removing a CLOUD chat removes it for every device, so it must ask first.
      // Grepping waRemove for 'askConfirm' passes with the call wrapped in a
      // ternary that never runs, which deletes for everyone silently (the
      // false-green shape proved by mutation across this suite, v34.1).
      var rAsk=window.askConfirm, rDel=window.deleteCloudChat, rIdx=window.waIndex,
          rSaveIx=window.waSaveIndex, rRender=window.renderWaSources, rT=window.toast,
          askedToRemove=0, deleted=0;
      try{
        window.toast=function(){}; window.renderWaSources=function(){};
        window.waSaveIndex=function(){};
        window.waIndex=function(){ return [{ id:'cloud:X.txt', group:'Meat', source:'cloud', file:'X.txt', slug:'x' }]; };
        window.deleteCloudChat=function(){ deleted++; return Promise.resolve(); };
        window.askConfirm=function(){ askedToRemove++; return Promise.resolve(false); };   // user says NO
        await waRemove('cloud:X.txt');
        if(!askedToRemove)
          throw new Error('a cloud chat was removed for EVERY device without asking anyone');
        if(deleted)
          throw new Error('the removal went ahead after the user declined it');
        // ...and it must proceed when the answer is yes, or the button does nothing.
        window.askConfirm=function(){ askedToRemove++; return Promise.resolve(true); };
        await waRemove('cloud:X.txt');
        if(!deleted) throw new Error('confirming the removal deleted nothing');
      } finally {
        window.askConfirm=rAsk; window.deleteCloudChat=rDel; window.waIndex=rIdx;
        window.waSaveIndex=rSaveIx; window.renderWaSources=rRender; window.toast=rT;
      }
      // The UI has to exist, or none of the above is reachable.
      if(!document.getElementById('waCloudSyncBox')) throw new Error('#waCloudSyncBox missing from the setup panel');
      var health=waChatHealth();
      if(typeof health.synced!=='number'||typeof health.bytes!=='number')
        throw new Error('Sync Health does not report the chat footprint');
      if(syncHealthText().indexOf('whatsapp chats:')===-1)
        throw new Error('the copyable Sync Health text omits the chats line');
    } },

  { id:'wa_cloud_dedup', group:'WhatsApp', name:'A synced chat replaces its other copies, not joins them (v29.8)',
    test: async()=>{
      if(typeof waMergeCloudIntoIndex!=='function') throw new Error('waMergeCloudIntoIndex not defined');
      // Found by Tony from a screenshot: after pressing Sync on a locally
      // imported chat the list showed BOTH copies. waLoadAllMessages reads every
      // row, so every message went into the AI context twice — and duplicated
      // context does not look wrong in the answer, it just quietly skews it.
      var existing=[
        { id:'local:Meat.txt',  source:'local',  file:'Meat.txt', group:'Meat', count:5799 },
        { id:'remote:Meat.txt', source:'remote', file:'Meat.txt', group:'Meat', count:5799 },
        { id:'local:Other.txt', source:'local',  file:'Other.txt', group:'Other', count:12 }
      ];
      var cloud=[{ file:'Meat.txt', group:'Meat', slug:'meat-1', parts:1, size:10, count:5799, first:'1/1/2025', last:'2/2/2026', updatedAt:7 }];
      var res=waMergeCloudIntoIndex(existing, cloud);
      var meat=res.index.filter(function(e){ return e.file==='Meat.txt'; });
      if(meat.length!==1) throw new Error('Meat.txt appears '+meat.length+' times — its messages would be counted that many times over');
      if(meat[0].source!=='cloud') throw new Error('the copy every device can reach did not win, got '+meat[0].source);
      // An unrelated chat must survive untouched.
      if(res.index.filter(function(e){ return e.file==='Other.txt'; }).length!==1)
        throw new Error('a chat with no cloud copy was dropped');
      // Both superseded copies must be reported so the caller can free them.
      if(res.dropped.length!==2) throw new Error('superseded copies were not reported for cleanup, got '+res.dropped.length);
      // Running it twice must not accumulate — the panel refreshes on every open.
      var again=waMergeCloudIntoIndex(res.index, cloud);
      if(again.index.length!==res.index.length) throw new Error('a second refresh changed the list length');
      // ...and waRefreshCloud must actually apply it. Grepping its source is
      // satisfied by a ternary that never evaluates the call, which leaves cloud
      // chats permanently invisible with the suite green (proved by mutation,
      // v34.1). Drive it with a stubbed reader and a stubbed store.
      var realDb2=window._fbDb, realRead=window.readCloudChatIndex,
          realSaveIdx=window.waSaveIndex, realIndex=window.waIndex, saved=null;
      try{
        window._fbDb={};
        window.waIndex=function(){ return [{ id:'local:Solo.txt', group:'Solo', source:'local', file:'Solo.txt' }]; };
        window.waSaveIndex=function(ix){ saved=ix; };
        window.readCloudChatIndex=function(){ return Promise.resolve([
          { file:'FromCloud.txt', group:'Meat', slug:'fromcloud', parts:1, size:10, count:3, updatedAt:1 }
        ]); };
        await waRefreshCloud(true);
        if(!saved) throw new Error('waRefreshCloud never wrote an index at all');
        if(!saved.some(function(e){ return e.file==='FromCloud.txt'; }))
          throw new Error('a chat that exists only in the cloud never reached the index — waRefreshCloud does not apply the merge, so cloud chats stay invisible on this device');
        if(!saved.some(function(e){ return e.file==='Solo.txt'; }))
          throw new Error('the refresh dropped a local-only chat');
      } finally {
        window._fbDb=realDb2; window.readCloudChatIndex=realRead;
        window.waSaveIndex=realSaveIdx; window.waIndex=realIndex;
      }
    } },

  { id:'stor_photo_marker_survives', group:'Storage', name:'A photo missing from IndexedDB is recoverable, not lost (v30.2)',
    test: async()=>{
      // Reported by Tony: on one Android phone every photo vanished, while his
      // iPhone and another Android were fine, and no restart helped.
      //
      // Chrome evicts IndexedDB under storage pressure. localStorage is tiny and
      // survives, so recipes came back photo-free with `_ph` set — and
      // hydratePhotosFromIDB cleared `_ph` even when the row was missing. That
      // flag is the ONLY record that a photo exists elsewhere, so once cleared
      // attachCloudPhotos skipped the recipe forever: permanent loss on that one
      // device, for a completely recoverable situation.
      var src=String(hydratePhotosFromIDB);
      if(/delete r\._ph; delete r\._po;/.test(src))
        throw new Error('the photo flags are still cleared unconditionally, so an evicted IndexedDB loses photos for good');
      // The flag must survive a miss, and go once the photo is genuinely back.
      var kept={ id:1, _ph:true }, got={ id:2, _ph:true };
      var byId={ 2:{ id:2, photo:'data:image/png;base64,AAA' } };
      [kept,got].forEach(function(r){
        var row=byId[r.id];
        var gotPhoto=!!(row && r._ph && row.photo);
        if(gotPhoto) r.photo=row.photo;
        if(r._ph && !gotPhoto){ /* keep it */ } else delete r._ph;
      });
      if(!kept._ph) throw new Error('the flag was dropped for a photo that never arrived');
      if(got._ph)  throw new Error('the flag survived even though the photo was restored');
      // attachCloudPhotos must tell "no photo exists" apart from "the read
      // failed". Clearing on a network blip makes a transient error permanent,
      // and it arms the delete branch in syncCloudPhotos against every other
      // device's copy of that photo.
      // attachCloudPhotos mutates the photo maps, which the shared snapshot
      // helper does not cover — save them here or the running session's idea of
      // which photos are in the cloud is corrupted by this test.
      var savedDb=window._fbDb, st=_cloudSnapshotForTest();
      var savedPs=window._cloudPhotoStamps, savedPi=window._cloudPhotoIds;
      window._cloudPhotoStamps={}; window._cloudPhotoIds={};
      try{
        // Read fails: the flag MUST survive, or the next load never looks again
        // and syncCloudPhotos' delete branch is armed against every other device.
        window._fbDb=_fakeFirestore({ photo_11:{ photo:'data:image/png;base64,AAA' } }, { failReads:true });
        var blip=[{ id:11, _ph:true }];
        await attachCloudPhotos(blip);
        if(!blip[0]._ph) throw new Error('a failed read cleared the flag — a network blip becomes permanent loss');
        // Read succeeds: the photo arrives and the flag is spent.
        window._fbDb=_fakeFirestore({ photo_11:{ photo:'data:image/png;base64,AAA' } });
        var ok=[{ id:11, _ph:true }];
        await attachCloudPhotos(ok);
        if(!ok[0].photo) throw new Error('the cloud photo was not attached');
        if(ok[0]._ph) throw new Error('the flag outlived the photo it was waiting for');
        // No document at all: genuinely photoless, so stop asking.
        var none=[{ id:12, _ph:true }];
        await attachCloudPhotos(none);
        if(none[0]._ph) throw new Error('a recipe with no cloud photo keeps asking forever');
      } finally {
        window._fbDb=savedDb; _cloudRestoreForTest(st);
        window._cloudPhotoStamps=savedPs; window._cloudPhotoIds=savedPi;
      }
      // A device that already lost its markers needs a way back.
      if(typeof repairMissingPhotos!=='function') throw new Error('repairMissingPhotos not defined');
      // The load path is loadFromFirestore → _loadFromFirestoreInner; the outer
      // function is a thin wrapper, so look where the work actually happens.
      var loadSrc=String(loadFromFirestore)
        + (typeof _loadFromFirestoreInner==='function' ? String(_loadFromFirestoreInner) : '');
      if(loadSrc.indexOf('repairMissingPhotos')===-1)
        throw new Error('nothing repairs a device whose markers were already cleared');
      // ...without re-reading every photoless recipe on every load; the "No
      // photo" filter exists because photoless recipes are perfectly normal.
      // That the repair REMEMBERS a genuine absence (rather than re-probing every
      // photoless recipe on every load) is driven for real in photo_repair_bounds,
      // which stubs the cloud and inspects tonys_photo_probed. The grep that used
      // to stand here passed with markPhotoProbed in a dead branch (v34.1).
      if(typeof photoProbed!=='function') throw new Error('photoProbed not defined');
      if(syncHealthText().indexOf('photos missing from this device:')===-1)
        throw new Error('Sync Health does not report missing photos, so this stays invisible');
    } },

  { id:'wa_all_chats_searched', group:'WhatsApp', name:'Every chat is searched, and none bleeds into another (v30.1)',
    test: async()=>{
      ['waContributors','waCoverageHtml','waTag'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      // Two chats, concatenated the way waLoadAllMessages concatenates them.
      var mk=function(chat,group,n,word){
        var out=[];
        for(var i=0;i<n;i++) out.push({ chat:chat, group:group, date:'1/1/2026', who:'A',
          text:(i===n-1? word+' at 230 degrees on a preheated tray for twenty minutes' : 'filler message number '+i+' in '+group) });
        return out;
      };
      // The hit is the LAST message of chat A, so a window that runs past the
      // end reaches into chat B — the exact bug this pins.
      var a=mk('cloud:A.txt','Meat',6,'brisket');
      var b=mk('local:B.txt','Cakes',6,'brisket');
      var all=a.concat(b);
      var hits=waSearch(all,'brisket temperature',40);
      if(hits.length<2) throw new Error('a term present in BOTH chats produced '+hits.length+' hits — only one chat was searched');
      var groups={}; hits.forEach(function(h){ groups[all[h.i].group]=true; });
      if(!groups['Meat']||!groups['Cakes']) throw new Error('hits came from only '+Object.keys(groups).join(',')+' — the other chat was not scanned');
      // Context must not cross the boundary.
      var ctx=waBuildContext(all,[{i:5,score:9}],14000);   // last message of chat A
      if(/Cakes/.test(ctx.text)) throw new Error('context from chat A pulled in messages from chat B as if they were replies');
      var ctx2=waBuildContext(all,[{i:6,score:9}],14000);  // first message of chat B
      if(/Meat/.test(ctx2.text)) throw new Error('context from chat B reached back into chat A');
      // Untagged messages (older callers) must still work rather than collapse.
      var untagged=[{group:'X',date:'1/1/2026',who:'A',text:'brisket at 230 degrees for a while yet'}];
      if(!waBuildContext(untagged,[{i:0,score:1}],14000).text) throw new Error('untagged messages produced no context at all');
      // The coverage panel must name every chat searched, including one that
      // contributed nothing — an omitted row reads as an oversight.
      var html=waCoverageHtml({ messages:all, chats:[{id:'cloud:A.txt',group:'Meat',count:6},{id:'local:B.txt',group:'Cakes',count:6},{id:'local:C.txt',group:'Soup',count:3}] }, [{i:5,score:9}]);
      ['Meat','Cakes','Soup'].forEach(function(g){
        if(html.indexOf(g)===-1) throw new Error(g+' is missing from the coverage list, so the user cannot tell it was searched');
      });
      if(html.indexOf('nothing relevant')===-1) throw new Error('a chat with no hits is silently omitted rather than reported');
      // The answer must SAY which chats it searched — an answer drawn from one of
      // three chats, presented as if drawn from all three, is the app asserting
      // something it has not verified. Grepping waAsk for 'waCoverageHtml' passes
      // with the call in a dead ternary (v34.1), so the coverage is checked in
      // the rendered output instead.
      var covKeep=window.waLoadAllMessages, covAi=window.aiCall, covT=window.toast;
      try{
        window.toast=function(){};
        window.aiCall=function(){ return Promise.resolve('Use the brisket at 230.'); };
        window.waLoadAllMessages=function(){ return Promise.resolve({
          messages:[{ text:'brisket at 230 degrees', group:'Meat', who:'A', chat:'local:A.txt', date:new Date() }],
          chats:[{ id:'local:A.txt', group:'Meat', count:1 }, { id:'local:B.txt', group:'Cakes', count:0 }],
          problems:[] }); };
        var box=document.getElementById('waAskAnswer');
        if(!box) throw new Error('the ask panel has no answer element');
        box.innerHTML='';
        var inp=document.getElementById('waAskInput');
        if(!inp) throw new Error('the ask panel has no input');
        inp.value='brisket';
        await waAsk();
        var txt=box.textContent||'';
        // Assert on text only the COVERAGE block emits. Looking for the group
        // name was not enough: the quoted messages carry it too, so the
        // assertion passed with the coverage removed (v34.1) — the same shape as
        // a negative test whose fixture already forces the expected answer.
        if(txt.indexOf('Searched ')===-1)
          throw new Error('the answer never says how many chats were searched, so an answer drawn from one chat of three looks complete');
        if(txt.indexOf('nothing relevant')===-1)
          throw new Error('a chat that contributed nothing is silently omitted, which reads as "everything was searched and agreed"');
      } finally { window.waLoadAllMessages=covKeep; window.aiCall=covAi; window.toast=covT; }

      // Everything above works on a hand-built array, which cannot catch a
      // loader that stops after the first chat — and that is the actual question
      // being asked here. Drive the real loader: two local chats, with waGet
      // stubbed so no IndexedDB is needed.
      var savedIndex=localStorage.getItem('tonys_wa_index'), savedGet=window.waGet;
      try{
        localStorage.setItem('tonys_wa_index', JSON.stringify([
          { id:'local:A.txt', group:'Meat',  source:'local', file:'A.txt', count:2 },
          { id:'local:B.txt', group:'Cakes', source:'local', file:'B.txt', count:2 }
        ]));
        window.waGet=function(id){
          var who=id==='local:A.txt'?'Meat':'Cakes';
          return Promise.resolve({ id:id, text:
            '[01/01/2026, 10:00:00] A: brisket at 230 degrees in the '+who+' group\n'
          + '[01/01/2026, 10:05:00] B: yes that worked well for me too in '+who+'\n' });
        };
        var loaded=await waLoadAllMessages();
        if(loaded.chats.length!==2) throw new Error('waLoadAllMessages reported '+loaded.chats.length+' chats, not 2 — it stops early');
        var gs={}; loaded.messages.forEach(function(m){ gs[m.group]=true; });
        if(!gs['Meat']||!gs['Cakes']) throw new Error('messages came from only '+Object.keys(gs).join(',')+' — a chat was skipped');
        if(loaded.messages.some(function(m){ return !m.chat; }))
          throw new Error('a message carries no chat tag, so the context window cannot find its boundary');
      } finally {
        window.waGet=savedGet;
        if(savedIndex===null) localStorage.removeItem('tonys_wa_index');
        else localStorage.setItem('tonys_wa_index', savedIndex);
      }
    } },

  { id:'wa_sync_stamp', group:'WhatsApp', name:'A synced chat says WHEN it synced, to the minute (v30.0)',
    test: async()=>{
      if(typeof waWhen!=='function') throw new Error('waWhen not defined');
      var at=new Date(2026,7,9,23,14).getTime();
      var s=waWhen({ source:'cloud', updatedAt:at });
      if(!s) throw new Error('a synced chat shows no timestamp at all');
      // The date alone was the complaint: re-export, upload, and two syncs on the
      // same day are indistinguishable without the time.
      if(!/\d{1,2}[:.]\d{2}/.test(s)) throw new Error('the stamp has no time in it: '+s);
      if(s.indexOf('2026')===-1) throw new Error('the stamp has no year in it: '+s);
      // A cloud chat must use the SERVER's stamp, not when this browser happened
      // to fetch it — otherwise every device shows a different "synced" time for
      // the same upload.
      var a=waWhen({ source:'cloud', updatedAt:at, addedAt:at+99999999 });
      if(a!==s) throw new Error('the cloud stamp came from this device rather than the server');
      // A folder chat has its addedAt rewritten on every load, so a stamp there
      // would always read "just now" and mean nothing.
      if(waWhen({ source:'remote', addedAt:at })!=='') throw new Error('a folder chat showed a meaningless stamp');
      // Missing or damaged stamps must not print "Invalid Date" into the panel.
      if(waWhen({ source:'cloud' })!=='') throw new Error('a missing stamp produced output');
      if(waWhen({ source:'cloud', updatedAt:'nonsense' })!=='') throw new Error('a damaged stamp produced output');
      // ...and the list must actually PRINT it. Rendered for real: grepping
      // renderWaSources for 'waWhen' survives the call sitting in a dead ternary,
      // leaving every row stamp-less with the suite green (v34.1).
      var wsIdx=window.waIndex, wsKeep=null;
      try{
        var when=Date.now()-3*60000;
        window.waIndex=function(){ return [{ id:'cloud:S.txt', group:'Stamped', source:'cloud',
                                             file:'S.txt', count:5, updatedAt:when }]; };
        renderWaSources();
        var host=document.getElementById('waSourceList');
        if(!host) throw new Error('there is no source list to render into');
        var shown=host.textContent||'';
        var expect=waWhen({ source:'cloud', updatedAt:when });
        if(!expect) throw new Error('waWhen produced nothing for a valid stamp, so this proves nothing');
        if(shown.indexOf(expect.trim())===-1)
          throw new Error('a synced chat row does not say when it synced — expected '+JSON.stringify(expect.trim())+' in the row');
      } finally { window.waIndex=wsIdx; }
    } },

  { id:'cloud_unreadable_doc', group:'Cloud Sync', name:'An unreadable cloud document self-heals (v29.4)',
    test: async()=>{
      // Found from a real Sync Health report: 26 recipes locally, 25 documents
      // read back. A document whose payload would not parse was skipped
      // outright, so no base was recorded for it — and every later save then
      // refused it as a "conflict" with no way out, because a corrupt payload
      // never becomes readable on its own.
      var st=_cloudSnapshotForTest();
      try{
        window._cloudRecipeBase={}; window._cloudRecipeIds={};
        var good={ id:'recipe_1', data:{ r:JSON.stringify({id:1,name:'fine'}), updatedAt:100 } };
        var bad ={ id:'recipe_2', data:{ r:'{not json at all', updatedAt:200 } };
        var list=parseCloudRecipeDocs([good,bad]);
        if(list.length!==1) throw new Error('a damaged document should not blank the collection, got '+list.length+' recipes');
        if(_cloudRecipeBase[2]!==200)
          throw new Error('no base recorded for the damaged document — every save of it would be refused forever');
        if(!cloudWriteAllowed(200,_cloudRecipeBase[2],0))
          throw new Error('the local copy still cannot replace the damaged cloud document');
        if(typeof cloudUnreadableIds!=='function'||cloudUnreadableIds().indexOf('2')===-1)
          throw new Error('the damaged document is not reported anywhere the user could see it');
      } finally { _cloudRestoreForTest(st); }
    } },

  { id:'cloud_edit_session', group:'Cloud Sync', name:'An open edit form notices a change underneath it (v29.4)',
    test: async()=>{
      // Tony's two-browser test: browser 1 opens the edit form, browser 2 edits
      // and saves, browser 1 saves and silently overwrites browser 2. The 5.4
      // guard protects the recipes ARRAY, but an open form is a snapshot from
      // minutes ago and a background refresh quietly replaces what it was based on.
      if(typeof openAddModal!=='function') throw new Error('openAddModal not defined');
      var r=recipes[0];
      var wasAt=r.updatedAt;
      try{
        openAddModal(r.id);
        if(typeof _editBaseAt!=='number') throw new Error('the edit session does not record the version it started from');
        if(_editBaseAt!==(r.updatedAt||0)) throw new Error('the recorded edit base does not match the recipe');
        // simulate the other device landing while the form is open
        r.updatedAt=(r.updatedAt||0)+5000;
        if((r.updatedAt||0)===_editBaseAt) throw new Error('test setup failed to move the recipe');
        // Drive the real save with the user choosing "Keep editing". Checking the
        // source for a mention of _editBaseAt was not enough — gutting the
        // condition left the mention in place and the test still passed.
        var realAsk=window.askConfirm, asked=false;
        window.askConfirm=function(){ asked=true; return Promise.resolve(false); };
        var moved=r.updatedAt;
        try{
          await saveRecipe();
          if(!asked) throw new Error('saveRecipe did not ask — it overwrote the other device silently');
          if(r.updatedAt!==moved) throw new Error('the other device\'s version was overwritten despite the user choosing to keep editing');
          if(!document.getElementById('editOverlay').classList.contains('open'))
            throw new Error('the edit form closed although nothing was saved');
        } finally { window.askConfirm=realAsk; }
      } finally {
        r.updatedAt=wasAt;
        _editBaseAt=null;
        closeM('editOverlay');
      }
    } },

  { id:'vis_health_copy', group:'UI', name:'Sync health can be copied as text (v29.4)',
    test: async()=>{
      if(typeof syncHealthText!=='function'||typeof copySyncHealth!=='function') throw new Error('the copy helpers are not defined');
      var t=syncHealthText();
      if(t.indexOf(APP_VERSION)===-1) throw new Error('the copied text omits the app version, which is the first thing a bug report needs');
      ['last successful save','writes refused','recipes on this device','damaged cloud documents'].forEach(function(k){
        if(t.indexOf(k)===-1) throw new Error('the copied text omits "'+k+'"');
      });
      if(!document.querySelector('#syncHealthOverlay button[onclick*="copySyncHealth"]')) throw new Error('no Copy button on the panel');
    } },

  { id:'cloud_no_refusal_loop', group:'Cloud Sync', name:'A fresh load can save — no stuck refusal loop (v29.3)',
    test: async()=>{
      // Reproduces exactly what happened on Tony's PC in v29.1 and v29.2:
      // a cloud that has not changed, a fresh page load (base map empty), and a
      // recipe old enough that its updatedAt is 0. Every save was refused, and
      // the next load skipped the read again, so it never recovered.
      var st=_cloudSnapshotForTest();
      try{
        var db=_fakeFirestore({ recipe_1:{ r:JSON.stringify({id:1,name:'old',photo:''}), updatedAt:1710000000000, id:1 } });
        var local={ id:1, name:'old', photo:'', updatedAt:0 };   // predates the field
        window._cloudRecipeBase={}; window._cloudRecipeStamp={};

        // 1. With no base and a cloud copy on a different stamp, refusing is right.
        var res=await saveRecipeDoc(local, db);
        if(res.skipped!=='conflict') throw new Error('expected a refusal with no base and a differing cloud stamp, got '+JSON.stringify(res));

        // 2. ...so the loader must NOT be allowed to skip the read in that state.
        if(canSkipCloudFanout({updatedAt:9,ids:[1]},1,9,false,false))
          throw new Error('the loader would skip the read while holding no base — this is the loop, it never recovers');

        // 3. Once the read has happened, the base is known and the save lands.
        parseCloudRecipeDocs([{ id:'recipe_1', data:db._docs.recipe_1 }]);
        var res2=await saveRecipeDoc(local, db);
        if(!res2.ok) throw new Error('still refused after a full read populated the base: '+JSON.stringify(res2));

        // 4. And local now agrees with what was written, so the next save is clean.
        if(local.updatedAt!==db._docs.recipe_1.updatedAt)
          throw new Error('local updatedAt ('+local.updatedAt+') drifted from the cloud ('+db._docs.recipe_1.updatedAt+') — the mismatch that made old recipes unsavable');
        if(cloudDirtyIds([local], window._cloudRecipeStamp).length)
          throw new Error('the recipe is still dirty straight after a successful write — it would be rewritten every save');
      } finally { _cloudRestoreForTest(st); }
    } },

  { id:'cloud_delete_denied', group:'Cloud Sync', name:'An admin-only delete refusal is reported, not swallowed',
    test: async()=>{
      var s=_cloudSnapshotForTest();
      try{
        // firestore.rules makes deletion admin-only, so a write-role member
        // genuinely cannot do this. It must not abort their whole save, and it
        // must not retry forever — it must be said out loud.
        var db=_fakeFirestore({ recipe_5:{ r:'{}', updatedAt:1 }, photo_5:{ photo:'x' } },{ denyDelete:true });
        window._pendingCloudDeletes={}; queueCloudDelete(5);
        var res=await flushCloudDeletes(db);
        if(!res.denied||res.denied.length!==1) throw new Error('a permission-denied delete was not reported back to the caller');
        if(!db._docs.recipe_5) throw new Error('the document was removed despite the rules refusing it');
        if(Object.keys(window._pendingCloudDeletes).length) throw new Error('a denied delete stayed queued — it would be retried and re-fail on every single save');
      } finally { _cloudRestoreForTest(s); }
    } },

  { id:'cloud_dirty', group:'Cloud Sync', name:'Only changed recipes are written',
    test: async()=>{
      var a={id:1,name:'A',photo:'',updatedAt:1}, b={id:2,name:'B',photo:'',updatedAt:1};
      // v29.2 — stamps are digests now, so persisting them doesn't double storage.
      var stamps={}; stamps[1]=hashStr(JSON.stringify(slimRecipeForCloud(a))); stamps[2]=hashStr(JSON.stringify(slimRecipeForCloud(b)));
      if(cloudDirtyIds([a,b],stamps).length!==0) throw new Error('unchanged recipes were queued for writing — favouriting one recipe would re-upload the collection again');
      b.fav=true;
      var dirty=cloudDirtyIds([a,b],stamps);
      if(dirty.length!==1||dirty[0]!==2) throw new Error('expected only the edited recipe to be dirty, got '+JSON.stringify(dirty));
      if(cloudDirtyIds([a,b,{id:3,name:'C',photo:''}],stamps).indexOf(3)===-1) throw new Error('a brand new recipe was not queued for writing');
    } },

  // ── FEATURES (recent additions) ──────────────────────────────────────────────
  { id:'feat_gridcols', group:'Features', name:'Phone grid columns (1–5) & clamp',
    test: async()=>{
      if(typeof getMobileCols!=='function'||typeof setMobileCols!=='function') throw new Error('grid column functions not defined');
      var prev=getMobileCols();
      setMobileCols(9); if(getMobileCols()!==5) throw new Error('value not clamped to max 5');
      setMobileCols(0); if(getMobileCols()!==1) throw new Error('value not clamped to min 1');
      setMobileCols(4);
      var cssVar=getComputedStyle(document.documentElement).getPropertyValue('--mobile-cols').trim();
      setMobileCols(prev); // restore
      if(cssVar!=='4') throw new Error('--mobile-cols CSS variable not applied (got "'+cssVar+'")');
    } },
  { id:'feat_viewmode', group:'Features', name:'Grid/List choice remembered',
    test: async()=>{
      if(typeof initViewMode!=='function') throw new Error('initViewMode not defined');
      var prev=null; try{ prev=localStorage.getItem('tonys_view_mode'); }catch(e){}
      setView('grid');
      if(localStorage.getItem('tonys_view_mode')!=='grid') throw new Error('view mode was not persisted to localStorage');
      if(prev==='grid'||prev==='list') setView(prev); else setView('list'); // restore
    } },
  { id:'feat_sharetarget', group:'Features', name:'Shared URL prefills import box',
    test: async()=>{
      if(typeof handleShareTarget!=='function') throw new Error('handleShareTarget not defined');
      openUrlImportModal('https://example.com/recipe');
      var v=document.getElementById('urlImportInput').value;
      closeM('urlImportOverlay');
      document.getElementById('urlImportInput').value='';
      if(v!=='https://example.com/recipe') throw new Error('openUrlImportModal cleared the prefilled URL — shared links would be lost');
    } },
  { id:'feat_shareurl', group:'Features', name:'URL found across all shared fields',
    test: async()=>{
      if(typeof extractSharedUrl!=='function') throw new Error('extractSharedUrl not defined');
      if(extractSharedUrl('https://a.com/r','','','')!=='https://a.com/r') throw new Error('did not use the url field');
      if(extractSharedUrl('','look https://b.com/x here','','')!=='https://b.com/x') throw new Error('did not extract a URL from shared text');
      if(extractSharedUrl('','','Recipe https://c.com/y','')!=='https://c.com/y') throw new Error('did not extract a URL from shared title');
      if(extractSharedUrl('','Source: אורי מאיר-ציזיק','','')!=='') throw new Error('must return empty (not the author) when no URL is present');
    } },
  { id:'feat_migrate', group:'Features', name:'Recipe migration backfills fields',
    test: async()=>{
      if(typeof migrateRecipes!=='function') throw new Error('migrateRecipes not defined');
      var m=migrateRecipes([{id:1,name:'x'}])[0];
      if(!Array.isArray(m.diets)) throw new Error('diets not backfilled');
      if(m.cookCount!==0) throw new Error('cookCount not backfilled');
      if(m.nutrition!==null) throw new Error('nutrition not backfilled');
    } },
  { id:'feat_convert', group:'Features', name:'Unit conversion is correct',
    test: async()=>{
      if(typeof convertUnits!=='function') throw new Error('convertUnits not defined');
      if(convertUnits(1000,'g','kg','Weight')!==1) throw new Error('1000 g should convert to 1 kg');
      if(convertUnits(100,'°C','°F','Temp')!==212) throw new Error('100°C should convert to 212°F');
    } },
  { id:'feat_escape', group:'Features', name:'HTML escaping prevents injection',
    test: async()=>{
      if(typeof escH!=='function') throw new Error('escH not defined');
      var out=escH('<b>&x</b>');
      if(out.indexOf('<b>')!==-1) throw new Error('escH did not escape angle brackets');
      if(out.indexOf('&amp;')===-1) throw new Error('escH did not escape the ampersand');
    } },

  // ── UI (recent additions) ────────────────────────────────────────────────────
  { id:'ui_version_badge', group:'UI', name:'Version badge renders',
    test: async()=>{
      var b=document.getElementById('appVersionBadge');
      if(!b) throw new Error('#appVersionBadge element missing (dynamic version display broken)');
      if(!b.textContent.trim()) throw new Error('version badge is empty');
    } },
  { id:'ui_gridsettings', group:'UI', name:'Grid Layout modal present',
    test: async()=>{
      if(!document.getElementById('gridSettingsOverlay')) throw new Error('#gridSettingsOverlay missing');
      if(typeof openGridSettings!=='function') throw new Error('openGridSettings not defined');
    } },
  { id:'feat_debug', group:'Features', name:'Debug mode toggle persists',
    test: async()=>{
      if(typeof dlog!=='function'||typeof toggleDebugMode!=='function') throw new Error('debug logging functions not defined');
      var prev=null; try{ prev=localStorage.getItem('tonys_debug_mode'); }catch(e){}
      setDebugMode(true);  if(localStorage.getItem('tonys_debug_mode')!=='1') throw new Error('debug flag not persisted on');
      setDebugMode(false); if(_debugMode!==false) throw new Error('debug flag not turned off');
      if(prev==='1') setDebugMode(true); else setDebugMode(false); // restore
    } },
  { id:'feat_photo_sources', group:'Features', name:'Photo search wires multiple sources',
    test: async()=>{
      if(typeof photoSearchMore!=='function') throw new Error('photoSearchMore not defined');
      if(!Array.isArray(PHOTO_SOURCES)||PHOTO_SOURCES.length<4) throw new Error('expected at least 4 photo sources');
      ['openverse','pixabay','pexels','unsplash'].forEach(function(s){
        if(PHOTO_SOURCES.indexOf(s)<0) throw new Error('missing photo source: '+s);
        if(!PHOTO_SOURCE_LABELS[s]) throw new Error('missing label for: '+s);
      });
      if(!document.getElementById('photoSearchMoreBtn')) throw new Error('#photoSearchMoreBtn (See more) missing from photo modal');
      // The keyless source must be tried FIRST. Every other source shares one
      // API key across the whole family, so they are the ones that 429; leading
      // with Openverse means a rate limit is a slower search, not a dead end.
      if(PHOTO_SOURCES[0]!=='openverse') throw new Error('the keyless source is not tried first');
    } },

  { id:'wa_harvest_links', group:'WhatsApp', name:'Links are found, de-duplicated and matched to what I already have (5f.9)',
    test: async()=>{
      ['waExtractLinks','waNormalizeUrl','waLinksAlreadyImported','waTrimUrlPunctuation','waLinkIsNoise']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      // Trailing punctuation: people write "try this: https://x.com/a." and the
      // full stop is not part of the link.
      if(waTrimUrlPunctuation('https://a.com/x.')!=='https://a.com/x') throw new Error('a trailing full stop was kept in the URL');
      if(waTrimUrlPunctuation('https://a.com/x,')!=='https://a.com/x') throw new Error('a trailing comma was kept');
      // ...but a balanced bracket is part of the address (Wikipedia does this).
      if(waTrimUrlPunctuation('https://a.com/x_(y)')!=='https://a.com/x_(y)') throw new Error('a balanced closing bracket was stripped from the URL');
      // The extractor starts at "http", so a bracketed link arrives here as
      // "https://a.com/x)" — the opening bracket was never captured, and the
      // stray closer must go.
      if(waTrimUrlPunctuation('https://a.com/x)')!=='https://a.com/x') throw new Error('an unbalanced closing bracket was kept');

      // Inputs that trim away to NOTHING. ''.slice(-1) is '' and ''.indexOf('')
      // is 0, so a `> -1` test says "this is punctuation, trim it" about a string
      // with nothing left in it — the v32.7 loop span forever on that. It froze
      // the whole panel, because the check below runs over every recipe and a
      // hand-typed recipe has no source at all. Each of these must simply RETURN.
      // (If this test ever hangs rather than fails, that is the bug back again.)
      if(waTrimUrlPunctuation('')!=='') throw new Error('an empty string did not come back empty');
      if(waTrimUrlPunctuation(undefined)!=='') throw new Error('undefined did not come back empty');
      if(waTrimUrlPunctuation(null)!=='') throw new Error('null did not come back empty');
      if(waTrimUrlPunctuation('...')!=='') throw new Error('an all-punctuation string did not trim to empty');
      if(waTrimUrlPunctuation(')))')!=='') throw new Error('an all-bracket string did not trim to empty');
      if(waNormalizeUrl('')!=='') throw new Error('normalising an empty source did not return empty');
      if(waNormalizeUrl(undefined)!=='') throw new Error('normalising a missing source did not return empty');
      // The exact shape that froze it: a collection where a recipe has no source.
      var mixed=[{name:'typed by hand'},{name:'no source',source:''},{name:'null source',source:null},
                 {name:'real',source:'https://site.com/recipe/1'}];
      var probe=[{key:waNormalizeUrl('https://site.com/recipe/1'),url:'https://site.com/recipe/1'}];
      waLinksAlreadyImported(probe,mixed);
      if(!probe[0].imported) throw new Error('a source-less recipe in the collection broke the already-imported match');

      // The same recipe in five disguises is ONE row.
      var k=waNormalizeUrl('https://www.Site.com/recipe/1/?utm_source=wa&b=2#method');
      if(k!==waNormalizeUrl('http://site.com/recipe/1?b=2')) throw new Error('www/scheme/tracking/fragment differences were not normalised away: '+k);
      if(k!==waNormalizeUrl('https://site.com/recipe/1?b=2&utm_medium=x')) throw new Error('a second tracking parameter defeated de-duplication');
      // ...but a genuine query difference is a DIFFERENT recipe. Sites put the id
      // there (?p=123), so collapsing the query would merge unrelated recipes.
      if(waNormalizeUrl('https://site.com/r?p=1')===waNormalizeUrl('https://site.com/r?p=2'))
        throw new Error('two different recipes collapsed into one — the query string was dropped wholesale');
      // ...and the order the parameters happen to be written in is not identity.
      // The same link comes back re-shared with them shuffled, and two rows for
      // one recipe is precisely what this panel exists to prevent.
      if(waNormalizeUrl('https://site.com/r?a=1&b=2')!==waNormalizeUrl('https://site.com/r?b=2&a=1'))
        throw new Error('the same link with its query parameters in a different order became two separate rows');

      var msgs=[
        {who:'Dana', date:'01/02/2026', text:'מתכון מעולה https://site.com/recipe/1?utm_source=wa שווה לנסות'},
        {who:'Yossi',date:'02/02/2026', text:'שיתפתי כבר: https://www.site.com/recipe/1/'},
        {who:'Dana', date:'03/02/2026', text:'https://other.com/x.'},
        {who:'Rami', date:'04/02/2026', text:'הצטרפו https://chat.whatsapp.com/ABC'},
        {who:'Rami', date:'05/02/2026', text:'no links here at all'}
      ];
      var links=waExtractLinks(msgs);
      var first=links.filter(function(l){ return l.domain==='site.com'; })[0];
      if(!first) throw new Error('the site.com link was not found');
      if(first.count!==2) throw new Error('the same link shared twice was counted '+first.count+' times, not 2');
      if(links.filter(function(l){return l.domain==='other.com';})[0].url.slice(-1)==='.')
        throw new Error('the trailing full stop survived into the extracted link');
      var invite=links.filter(function(l){ return l.domain==='chat.whatsapp.com'; })[0];
      if(!invite||!invite.noise) throw new Error('a group invite link was not flagged as noise');
      // Context is what makes a link decidable — who, when, and what they said.
      if(!first.shares.length||!first.shares[0].who) throw new Error('no context was kept for a link');
      if(first.shares[0].text.indexOf('http')>-1) throw new Error('the URL was left inside its own context snippet');

      // "Already have it" must use the SAME normalisation as de-duplication, or
      // the two can disagree and a link shows as new when it is not.
      waLinksAlreadyImported(links,[{name:'כבר יש',source:'http://WWW.site.com/recipe/1?utm_campaign=x'}]);
      if(!first.imported) throw new Error('a link already saved as a recipe was not recognised — normalisation disagrees between the two');
      if(first.importedAs!=='כבר יש') throw new Error('the existing recipe name is not shown');
      if(links.filter(function(l){return l.domain==='other.com';})[0].imported)
        throw new Error('an unimported link was marked as already saved');
    } },

  { id:'wa_harvest_text', group:'WhatsApp', name:'Recipes typed into the chat are found, chatter is not (5f.9)',
    test: async()=>{
      ['waScoreRecipeText','waFindTextRecipes'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      // The Hebrew word boundary, pinned on its own. \b is ASCII-only, so an
      // alternation ending in \b matches nothing after a Hebrew letter — every
      // Hebrew unit and verb scored zero and the whole feature was dead in the
      // only language these chats are written in. Two assertions: the unit must
      // match standing alone, and must NOT match inside a longer Hebrew word.
      if(waScoreRecipeText.toString().indexOf('WA_QTY_RE')===-1) throw new Error('the scorer no longer consults the quantity pattern');
      var heb=(('2 כוסות קמח 1 כפית מלח '.repeat(12))+'מערבבים ומוסיפים ואופים');
      if(waScoreRecipeText(heb).signals.join(' ').indexOf('quantities')===-1)
        throw new Error('Hebrew units matched nothing — a word boundary that only works in ASCII would do exactly this');
      // ...and the guard must not be so loose that a unit matches INSIDE a longer
      // Hebrew word ("מל" sitting in "מלחמות"). Verbs are present on purpose: with
      // no quantities this is chatter, so anything above zero means "מל" matched.
      var noRunOn=waScoreRecipeText('מערבבים את כל הדעות ומוסיפים עוד '
        + '3 מלחמות גדולות ו-2 מלחמות נוספות '.repeat(3)
        + 'וכך נמשך הסיפור הארוך הזה עוד שנים רבות מאוד עד עצם היום הזה ממש');
      if(noRunOn.score!==0) throw new Error('"מל" matched inside "מלחמות" ('+noRunOn.signals.join(', ')+') — the unit ran on into a longer word');

      // The mayonnaise case: a real recipe typed straight into the group, in
      // Hebrew, with no link. This is the whole point of the feature.
      var mayo='מיונז ביתי\nמצרכים:\n1 ביצה\n1 כוס שמן\n1 כפית חרדל\n2 כפות מיץ לימון\nקורט מלח\nאופן ההכנה:\n'
        + 'טורפים את הביצה עם החרדל, מוסיפים את השמן בהדרגה תוך כדי טריפה, מוסיפים לימון ומערבבים.\n'
        + 'מקררים כשעה לפני ההגשה.';
      var m=waScoreRecipeText(mayo);
      if(m.score<45) throw new Error('a full Hebrew recipe scored only '+m.score+' — it would never be surfaced');

      // Things that must NOT be mistaken for a recipe.
      if(waScoreRecipeText('קניתי 2 קילו קמח ו-3 קילו סוכר בסופר, היה זול').score!==0)
        throw new Error('a shopping remark was scored as a recipe');
      if(waScoreRecipeText('תודה רבה!! נשמע מעולה').score!==0) throw new Error('a one-line thank-you was scored as a recipe');
      if(waScoreRecipeText('מערבבים ומחממים').score!==0) throw new Error('a fragment with verbs but no quantities scored above zero');
      // The discriminator, both ways round. These two are LONG and well-formed —
      // plenty of lines, plenty of signal — so only "what to use AND what to do"
      // keeps them out. A shopping list is the exact thing this feature must not
      // dredge up, and a method with nothing to measure is somebody reminiscing.
      var shopping='רשימת קניות לשבת\n2 קילו קמח\n3 כוסות סוכר\n1 ליטר חלב\n500 גרם חמאה\n'
        + '1 כפית מלח\n4 יחידות ביצים\n2 כפות שמן\nמי שיכול שיביא, תודה רבה לכולם מראש';
      var sc=waScoreRecipeText(shopping);
      if(sc.score!==0) throw new Error('a shopping list scored '+sc.score+' ('+sc.signals.join(', ')+') — quantities alone are not a recipe');
      var methodOnly='מערבבים היטב את הכל ואז מוסיפים לאט לאט, מחממים על אש קטנה, מבשלים עד שמסמיך, '
        + 'מסננים ומקררים לפני ההגשה, ואז מגישים לשולחן עם קצת עשבי תיבול טריים מהגינה שליד הבית';
      var mo=waScoreRecipeText(methodOnly);
      if(mo.score!==0) throw new Error('a method with nothing to measure scored '+mo.score+' ('+mo.signals.join(', ')+')');
      // Long chatter with a single stray number must stay at zero.
      var chatter='היינו אתמול במסעדה חדשה בתל אביב והאוכל היה ממש טעים, הזמנו 2 מנות ראשונות ואחר כך '
        + 'מנה עיקרית, וישבנו שם בערך שעתיים. ממליץ בחום לכל מי שמחפש מקום נחמד לארוחת ערב עם המשפחה.';
      if(waScoreRecipeText(chatter).score!==0) throw new Error('restaurant chatter was scored as a recipe: '+waScoreRecipeText(chatter).score);

      // English must work too — the app is bilingual.
      var en='Quick pancakes\nIngredients:\n2 cups flour\n1 tbsp sugar\n1 tsp salt\n2 eggs\n'
        + 'Method:\nMix the dry, add the eggs, stir until smooth, heat the pan and fry 2 minutes a side.';
      if(waScoreRecipeText(en).score<45) throw new Error('an English recipe scored only '+waScoreRecipeText(en).score);

      // End to end, including de-duplication of a forwarded copy.
      var found=waFindTextRecipes([
        {who:'Dana',date:'01/02/2026',text:mayo},
        {who:'Yossi',date:'02/02/2026',text:mayo},          // forwarded — same recipe
        {who:'Rami',date:'03/02/2026',text:'תודה!'},
        {who:'Dana',date:'04/02/2026',text:en}
      ]);
      if(found.length!==2) throw new Error('expected 2 distinct recipes, got '+found.length);
      if(!found[0].signals.length) throw new Error('no signals were recorded, so the list cannot explain itself');
      if(found.filter(function(c){ return c.dupes; }).length!==1) throw new Error('the forwarded copy was not folded into the original');
      // A URL inside the text must not inflate the score on its own.
      if(waScoreRecipeText('https://site.com/a-very-long-recipe-url-with-many-words-in-it-indeed-yes').score!==0)
        throw new Error('a bare URL was scored as a written recipe');
    } },

  { id:'wa_harvest_ui', group:'WhatsApp', name:'The harvest panel is reachable and feeds the existing importers (5f.9)',
    test: async()=>{
      if(!document.getElementById('waLinksItem')) throw new Error('the More menu has no "Recipes hiding in my chats" entry');
      if(!document.getElementById('waLinksOverlay')) throw new Error('#waLinksOverlay missing');
      if(!document.getElementById('waLinksBody')) throw new Error('#waLinksBody missing');
      ['openWaLinks','renderWaHarvest','waImportTextRecipe','waHarvestText','copyWaHarvest',
       'closeWaLinks','waHarvestForget','waToggleSel','waImportSelected']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      // A long scan the user cannot stop is the complaint that prompted all of
      // this, so the controls have to actually appear while one is running.
      var keptScan={status:_waScan.status,done:_waScan.done,total:_waScan.total,startedAt:_waScan.startedAt};
      try{
        _waScan.status='running'; _waScan.done=10; _waScan.total=100; _waScan.startedAt=Date.now();
        var running=waProgressHtml();
        if(running.indexOf('waScanToggle')===-1) throw new Error('a running scan offers no Pause');
        if(running.indexOf('waScanStop')===-1)   throw new Error('a running scan offers no Stop');
        if(running.indexOf('wa-spin')===-1)      throw new Error('a running scan shows no sign of life, so it looks hung');
        if(running.indexOf('10')===-1||running.indexOf('100')===-1)
          throw new Error('a running scan does not say how far along it is');
        _waScan.status='paused';
        if(waProgressHtml().indexOf('Continue')===-1) throw new Error('a paused scan offers no way to resume');
        // Closing while paused must release the loop, or it waits for ever.
        // Closing the panel while the scan is PAUSED must resume it first, or the
        // scan is stranded on a promise nobody will ever resolve. Driven, not
        // grepped: 'waScanResume' survives in the text of a dead branch (v34.1).
        var stKeep=_waScan.status, resumeKeep=window.waScanResume, resumed=0, closeKeep=window.closeM;
        try{
          window.closeM=function(){};
          window.waScanResume=function(){ resumed++; _waScan.status='running'; };
          _waScan.status='paused';
          closeWaLinks();
          if(!resumed)
            throw new Error('the panel closed while the scan was paused without resuming it — the scan waits on a promise nobody resolves, for ever');
          // ...and closing a panel that is NOT paused must not fake a resume.
          resumed=0; _waScan.status='idle';
          closeWaLinks();
          if(resumed) throw new Error('closing an idle panel called resume, which would restart a scan nobody asked for');
        } finally { _waScan.status=stKeep; window.waScanResume=resumeKeep; window.closeM=closeKeep; }
      } finally {
        _waScan.status=keptScan.status; _waScan.done=keptScan.done;
        _waScan.total=keptScan.total; _waScan.startedAt=keptScan.startedAt;
      }
      // ONE parser and ONE URL importer, checked by CALLING them rather than by
      // grepping their source — the previous version pinned the text of
      // waImportTextRecipe and broke the moment both buttons were routed through
      // a shared helper, with the behaviour unchanged.
      //
      // It also pins the bug Tony hit: #waLinksOverlay is z-index 900 and
      // .modal-overlay is 200, so an importer opened while the panel is still up
      // renders BEHIND it and the button looks completely dead. Importing must
      // close the panel first.
      var gotUrl=null, gotText=null;
      var ov=document.getElementById('waLinksOverlay');
      var savedHarv=_waHarvest;
      try{
        _waHarvest={ links:[{key:'a.com/x',url:'https://a.com/x',domain:'a.com',count:1,shares:[]}],
                     texts:[{text:'מיונז ביתי עם ביצה',score:70,signals:['x'],who:'Y'}],
                     loaded:true, hideImported:true, hideNoise:true, tab:'links',
                     selected:{}, dismissed:{}, numbering:{}, seen:{} };
        ov.classList.add('open');
        waImportLink(0);
        gotUrl=document.getElementById('urlImportInput').value;
        if(gotUrl!=='https://a.com/x') throw new Error('"Import this" did not reach the URL importer');
        // The panel STAYS open — closing it lost your place in a 969-row list on
        // every single import — so the importer has to be raised above it. At
        // equal z-index the importer renders behind #waLinksOverlay's 900 and the
        // button looks completely dead, which is exactly what Tony reported.
        if(!ov.classList.contains('open'))
          throw new Error('importing closed the harvest panel — the list must stay open until the user closes it');
        var zi=parseInt(document.getElementById('urlImportOverlay').style.zIndex||'0',10);
        if(zi<=900) throw new Error('the URL importer opens behind the harvest panel (z-index '+zi+' vs 900)');
        closeM('urlImportOverlay');
        if(document.getElementById('urlImportOverlay').style.zIndex!=='')
          throw new Error('the raised z-index was not cleared, so the next plain open inherits it');

        ov.classList.add('open');
        waImportTextRecipe(0);
        gotText=document.getElementById('freehandText').value;
        if(!gotText||gotText.indexOf('מיונז')===-1)
          throw new Error('in-text recipes do not reach the free-hand parser — there would be two parsers to keep in step');
        if(!ov.classList.contains('open')) throw new Error('parsing an in-text recipe closed the harvest panel');
        if(parseInt(document.getElementById('freehandOverlay').style.zIndex||'0',10)<=900)
          throw new Error('the free-hand parser opens behind the harvest panel');
        closeM('freehandOverlay');
      } finally {
        _waHarvest=savedHarv;
        ov.classList.remove('open');
        closeM('urlImportOverlay'); closeM('freehandOverlay');
      }
      // The copy output must carry both halves, or it is not the list.
      var saved=_waHarvest;
      try{
        _waHarvest={ links:[{url:'https://a.com/x',domain:'a.com',count:2,imported:false,shares:[{who:'Dana',date:'01/02',text:'ctx'}]}],
                     texts:[{who:'Yossi',date:'02/02',signals:['3 quantities'],text:'מיונז ביתי עם ביצה ושמן'}], loaded:true };
        var t=waHarvestText();
        if(t.indexOf('https://a.com/x')===-1) throw new Error('the copied list omits the links');
        if(t.indexOf('מיונז')===-1) throw new Error('the copied list omits the in-text recipes');
        if(t.indexOf('Dana')===-1) throw new Error('the copied list omits who shared what');
      } finally { _waHarvest=saved; }
    } },

  { id:'photo_search_translates', group:'Features', name:'The manual photo search sends English, not Hebrew (5g.4)',
    test: async()=>{
      if(typeof photoQueryForSearch!=='function') throw new Error('photoQueryForSearch not defined');
      var input=document.getElementById('photoSearchInput');
      if(!input) throw new Error('no photo search input to drive');
      var realAi=window.aiCall, realFetch=window.fetch, realVal=input.value;
      // Driven through searchPhotos() — the route every entry point uses (the
      // Search button, the Enter key, and the auto-search when the panel opens
      // from a recipe). Calling photoQueryForSearch directly would leave all
      // three free to go on sending Hebrew.
      try{
        var asked=[], sent=[];
        window.aiCall=function(p){ asked.push(p); return Promise.resolve('["beef brisket"]'); };
        window.fetch=function(url, opt){
          try{ sent.push(JSON.parse(opt.body).query); }catch(e){ sent.push(null); }
          return Promise.resolve({ json:function(){ return Promise.resolve({ images:[
            { url:'https://x/1.jpg', thumb:'https://x/1t.jpg', credit:'A', creditUrl:'https://x/a' }
          ] }); } });
        };
        input.value='חזה בקר בתנור';
        await searchPhotos();
        if(!sent.length) throw new Error('no search was issued at all');
        if(/[֐-׿]/.test(sent[0]))
          throw new Error('Hebrew went to the photo source as “'+sent[0]+'” — none of them read it, so this finds nothing');
        if(sent[0]!=='beef brisket') throw new Error('the translated term was not the one searched: '+sent[0]);
        if(input.value!=='beef brisket')
          throw new Error('the box still shows what was typed, not what was searched — the UI would be stating something untrue');

        // An English name must NOT cost an AI round trip.
        asked=[]; sent=[];
        input.value='chicken soup';
        await searchPhotos();
        if(asked.length) throw new Error('an English name was sent for translation anyway — a wasted AI call per search');
        if(sent[0]!=='chicken soup') throw new Error('an English name was altered before searching: '+sent[0]);

        // A translation that fails must still search, and must SAY it failed
        // rather than showing a result count that implies an English search.
        asked=[]; sent=[];
        window.aiCall=function(){ return Promise.reject(new Error('AI down')); };
        input.value='מרק עוף';
        await searchPhotos();
        if(!sent.length) throw new Error('a failed translation stopped the search entirely');
        var st=(document.getElementById('photoSearchStatus')||{}).textContent||'';
        if(st.indexOf('⚠')===-1)
          throw new Error('a failed translation was not reported — the user would think English was searched');
      } finally { window.aiCall=realAi; window.fetch=realFetch; input.value=realVal; }
    } },

  { id:'sec_no_local_save_helper', group:'Network', name:'Exports go straight to the browser, with no local helper (v35.0)',
    test: async()=>{
      // …including its status light. The dot on the ⚙️ outlived the helper by
      // a year, permanently grey, until Tony asked what it meant (v36.56).
      if(document.getElementById('helperIndicator'))
        throw new Error('#helperIndicator is back on the Settings cog — the helper it reported on no longer exists');
      // The Save Helper is gone, and this is what stops it coming back.
      //
      // It existed to work around ONE thing: Chromium sanitises download
      // filenames against the character encoding of its PROCESS locale, so under
      // a non-UTF-8 locale it strips non-ASCII and falls back to "Download".
      // Tony's /etc/default/locale was handing the session LANG="en_IL", the
      // non-UTF-8 twin of en_IL.UTF-8. Correcting it fixed <a download>,
      // showSaveFilePicker and server-sent Content-Disposition simultaneously.
      //
      // Removing it also closed a hole: the helper took its target directory
      // from the request body, and CORS stops a cross-origin POST from being
      // READ, not from being SENT — so any site open in any browser could write
      // a file anywhere the user could, ~/.config/autostart included.
      ['saveHelperEnabled','setSaveHelperEnabled','localSaveUrl','checkHelperStatus',
       'showSaveHelperInfo','showRenameHint','updateHelperStatus']
        .forEach(function(f){ if(typeof window[f]==='function')
          throw new Error(f+' is back — the local Save Helper must stay removed'); });

      // The CSP must no longer carry a loopback exception. `connect-src` has a
      // bare `https:`, so an http: source can only be there deliberately.
      var meta=document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if(!meta) throw new Error('no CSP meta tag');
      var conn=((meta.getAttribute('content')||'').split(';')
                 .filter(function(d){ return d.trim().indexOf('connect-src')===0; })[0]||'');
      if(/127\.0\.0\.1|localhost|http:\/\//.test(conn))
        throw new Error('connect-src still permits a loopback origin: '+conn.trim());

      // And an export must reach the browser, carrying the name it was asked
      // for, without touching the network at all.
      var realFetch=window.fetch, realCreate=URL.createObjectURL,
          realRevoke=URL.revokeObjectURL, realClick=HTMLAnchorElement.prototype.click;
      var calls=[], asked=null;
      try{
        window.fetch=function(u){ calls.push(String(u));
          return Promise.reject(new Error('an export must not use the network')); };
        URL.createObjectURL=function(){ return 'blob:stub'; };
        URL.revokeObjectURL=function(){};
        HTMLAnchorElement.prototype.click=function(){ asked=this.download; };
        var name='עוגת שוקולד של סבתא.docx';
        downloadBlob(new Blob(['x'],{type:'text/plain'}), name);
        // downloadBlob is synchronous since v35.0 — the FileReader existed only
        // to base64 the blob for the helper — but allow for a stray tick anyway.
        await new Promise(function(res){ setTimeout(res, 250); });
        if(calls.length)
          throw new Error('an export made a network request to '+calls[0]);
        if(asked===null) throw new Error('the export produced no browser download at all, so saving is broken');
        if(asked!==name) throw new Error('the download asked for "'+asked+'" rather than "'+name+'"');
      } finally {
        window.fetch=realFetch; URL.createObjectURL=realCreate;
        URL.revokeObjectURL=realRevoke; HTMLAnchorElement.prototype.click=realClick;
      }
    } },

  { id:'cloud_refresh_one_recipe', group:'Cloud Sync', name:'One recipe can be pulled from the cloud without a reload (5.4 §7, v35.3)',
    test: async()=>{
      // The two-device test: PC edits, phone edits and saves, PC's save is
      // refused. Correct. But closing and reopening the recipe still showed the
      // PC's version and saving failed again — nothing re-read a single document
      // between full loads, so the only cure was restarting the app.
      ['refreshRecipeFromCloud','refreshRecipeFromCloudUI','recipeIsInConflict','conflictBannerHtml']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      var testId=771001;
      var kDb=window._fbDb, kUser=window._fbUser, kBase=window._cloudRecipeBase,
          kStamp=window._cloudRecipeStamp, kIds=window._cloudRecipeIds, kToast=window.toast;
      var mine={id:testId,name:'My PC version',emoji:'🥘',category:'Dinner',difficulty:'Easy',
        prep:'10',servings:'2',bg:'#fff',fav:false,photo:'data:image/png;base64,AAAA',
        ingredients:[{a:'1',n:'mine'}],steps:['mine'],diets:[],history:[],updatedAt:1000};
      recipes.unshift(mine);
      try{
        window.toast=function(){};
        var theirs={id:testId,name:'Phone version',emoji:'🥘',category:'Dinner',difficulty:'Easy',
          prep:'10',servings:'2',bg:'#fff',fav:false,photo:'',
          ingredients:[{a:'2',n:'theirs'}],steps:['theirs'],diets:[],updatedAt:2000};
        var doc={ exists:true, data:function(){ return { r:JSON.stringify(theirs), updatedAt:2000, id:testId }; } };
        var asked=null;
        window._fbUser={uid:'u1'};
        window._fbDb={ collection:function(){ return { doc:function(n){ asked=n; return {
          get:function(){ return Promise.resolve(doc); } }; } }; } };
        window._cloudRecipeBase={}; window._cloudRecipeStamp={}; window._cloudRecipeIds={};

        // Flag it first, the way a refused save does — otherwise "not in conflict
        // afterwards" is true for a recipe that was never in conflict, and the
        // clearing is untested. A mutation that removed it survived on that.
        markRecipeConflicted(testId);
        if(!recipeIsInConflict(testId)) throw new Error('the fixture did not flag the recipe');

        var res=await refreshRecipeFromCloud(testId);
        if(!res.ok) throw new Error('refresh failed: '+JSON.stringify(res));
        if(asked!==recipeDocId(testId)) throw new Error('read the wrong document: '+asked);

        // Same object, replaced contents — viewId and any open dialog hold this
        // exact reference, so swapping the array entry would strand them.
        var now=recipes.find(function(x){ return x.id===testId; });
        if(now!==mine) throw new Error('the recipe object was replaced rather than updated in place');
        if(now.name!=='Phone version') throw new Error('the cloud version did not win, name is '+now.name);
        if(now.steps[0]!=='theirs') throw new Error('the body was not replaced');

        // Nothing is lost: the local version is on the history, where ↩ Restore lives.
        if(!now.history || !now.history.length) throw new Error('the local version was discarded instead of kept in history');
        if(now.history[0].name!=='My PC version')
          throw new Error('history[0] is "'+now.history[0].name+'", expected the local version');
        // The photo lives in its own document, so an empty one here means
        // "not in this document", never "deleted".
        if(now.photo!=='data:image/png;base64,AAAA')
          throw new Error('the local photo was wiped by a recipe document that never carries one');

        if(window._cloudRecipeBase[testId]!==2000) throw new Error('the concurrency base was not updated, so the next save is refused again');
        if(!window._cloudRecipeStamp[testId]) throw new Error('the sync stamp was not recorded, so the recipe is rewritten on every save');
        if(recipeIsInConflict(testId)) throw new Error('the recipe is still flagged as in conflict after a successful refresh');

        // A read that FAILS must change nothing — that is the whole lesson of
        // the photo incidents: "could not read" is not "there is nothing there".
        var before=JSON.stringify(now);
        window._fbDb={ collection:function(){ return { doc:function(){ return {
          get:function(){ return Promise.reject(new Error('network down')); } }; } }; } };
        var bad=await refreshRecipeFromCloud(testId);
        if(bad.ok) throw new Error('a failed read reported success');
        if(bad.reason!=='read-failed') throw new Error('a failed read reported "'+bad.reason+'"');
        if(JSON.stringify(recipes.find(function(x){return x.id===testId;}))!==before)
          throw new Error('a failed read modified the recipe anyway');

        // A missing document is a different answer from a failed read.
        window._fbDb={ collection:function(){ return { doc:function(){ return {
          get:function(){ return Promise.resolve({ exists:false }); } }; } }; } };
        var gone=await refreshRecipeFromCloud(testId);
        if(gone.ok || gone.reason!=='not-in-cloud')
          throw new Error('a document that is not there reported '+JSON.stringify(gone));
        if(JSON.stringify(recipes.find(function(x){return x.id===testId;}))!==before)
          throw new Error('a missing cloud document blanked the local recipe');

        // Unparseable cloud data must not overwrite a good local copy either.
        window._fbDb={ collection:function(){ return { doc:function(){ return {
          get:function(){ return Promise.resolve({ exists:true, data:function(){ return { r:'{not json', updatedAt:9 }; } }); } }; } }; } };
        var junk=await refreshRecipeFromCloud(testId);
        if(junk.ok || junk.reason!=='unreadable')
          throw new Error('unreadable cloud data reported '+JSON.stringify(junk));
        if(JSON.stringify(recipes.find(function(x){return x.id===testId;}))!==before)
          throw new Error('unreadable cloud data overwrote the local recipe');

        // Signed out is its own answer, and every reason has words of its own.
        window._fbUser=null;
        var out=await refreshRecipeFromCloud(testId);
        if(out.ok || out.reason!=='signed-out') throw new Error('signed out reported '+JSON.stringify(out));
        var seen={};
        ['signed-out','offline','not-here','read-failed','not-in-cloud','unreadable'].forEach(function(rn){
          var t=refreshRecipeReason({reason:rn});
          if(!t || seen[t]) throw new Error('reason "'+rn+'" has no message of its own');
          seen[t]=true;
        });
      } finally {
        recipes=recipes.filter(function(x){ return x.id!==testId; });
        window._fbDb=kDb; window._fbUser=kUser; window._cloudRecipeBase=kBase;
        window._cloudRecipeStamp=kStamp; window._cloudRecipeIds=kIds; window.toast=kToast;
      }
    } },

  { id:'cloud_conflict_has_a_way_out', group:'Cloud Sync', name:'A refused save says so on reopening and offers the fix (v35.3)',
    test: async()=>{
      var testId=771002;
      recipes.unshift({id:testId,name:'Banner Test',emoji:'🥘',category:'Dinner',difficulty:'Easy',
        prep:'1',servings:'1',bg:'#fff',fav:false,photo:'',ingredients:[],steps:[],diets:[],
        history:[],updatedAt:1});
      try{
        var r=recipes.find(function(x){ return x.id===testId; });
        if(conflictBannerHtml(r)!=='')
          throw new Error('a recipe with no conflict is showing the conflict banner');

        // Drive the real refusal path rather than setting the flag by hand: a
        // test that sets its own state proves nothing about the code under it.
        var kBase=window._cloudRecipeBase, kDb=window._fbDb;
        var kOn=null,kLog=null;
        try{ kOn=localStorage.getItem('tonys_log_enabled'); kLog=localStorage.getItem('tonys_sync_log'); }catch(e){}
        setLogEnabled(true); purgeSyncLog();
        try{
          window._cloudRecipeBase={}; window._cloudRecipeBase[testId]=500;
          window._fbDb={ collection:function(){ return { doc:function(){ return {}; } }; },
            runTransaction:function(fn){ return fn({
              get:function(){ return Promise.resolve({ exists:true, data:function(){ return { updatedAt:9999 }; } }); },
              set:function(){ throw new Error('a refused write must not call set()'); } }); } };
          var out=await saveRecipeDoc(r, window._fbDb);
          if(out.skipped!=='conflict') throw new Error('expected the write to be refused, got '+JSON.stringify(out));

          // The refusal must be recorded WHERE IT HAPPENS. An end-to-end run found
          // this logged one level up, in the caller — so the successful write was
          // logged by saveRecipeDoc and the refusal was not, and any other caller
          // recorded a success and stayed silent on a refusal.
          var logged=readSyncLog().filter(function(e){ return e.k==='conflict'; });
          if(!logged.length)
            throw new Error('a refused write recorded no conflict event');
          if(logged[0].m.indexOf('Banner Test')===-1)
            throw new Error('the conflict event does not name the recipe: '+logged[0].m);
        } finally {
          window._cloudRecipeBase=kBase; window._fbDb=kDb;
          try{
            if(kOn===null) localStorage.removeItem('tonys_log_enabled'); else localStorage.setItem('tonys_log_enabled',kOn);
            if(kLog===null) localStorage.removeItem('tonys_sync_log'); else localStorage.setItem('tonys_sync_log',kLog);
          }catch(e){}
        }

        // saveRecipeDoc reports the refusal; the flag is set where conflicts are
        // collected, by this same function.
        markRecipeConflicted(testId);
        if(!recipeIsInConflict(testId)) throw new Error('recipeIsInConflict did not report a flagged recipe');
        if(conflictIds().indexOf(testId)===-1) throw new Error('conflictIds() does not list the flagged recipe');

        var html=conflictBannerHtml(r);
        if(!html) throw new Error('a conflicted recipe shows no banner when reopened');
        if(html.indexOf('refreshRecipeFromCloudUI('+testId+')')===-1)
          throw new Error('the banner offers no way to fetch the other version');
        if(html.indexOf('Version history')===-1)
          throw new Error('the banner does not say the local version is kept');

        // ...and the view actually renders it.
        var kView=viewId;
        try { viewId=testId; drawView();
          var modal=document.getElementById('viewModal');
          if(modal.innerHTML.indexOf('Changed on another device')===-1)
            throw new Error('the banner is not rendered in the recipe view');
        } finally { viewId=kView; if(viewId!=null) drawView(); }

        // The service-error modal must be able to carry the action at all.
        var fired=0;
        showServiceError('TEST: a message', [{label:'Do it', primary:true, onClick:function(){ fired++; }}]);
        var ov=document.getElementById('serviceErrorOverlay');
        if(!ov) throw new Error('the service error modal did not open');
        var btn=Array.prototype.slice.call(ov.querySelectorAll('button'))
          .filter(function(b){ return b.textContent==='Do it'; })[0];
        if(!btn) throw new Error('the action button was not rendered');
        btn.click();
        if(fired!==1) throw new Error('the action button did not run its handler');
        if(document.getElementById('serviceErrorOverlay')) throw new Error('the modal stayed open after the action');
      } finally {
        clearRecipeConflict(testId);
        recipes=recipes.filter(function(x){ return x.id!==testId; });
        var ov=document.getElementById('serviceErrorOverlay'); if(ov) ov.remove();
      }
    } },

  { id:'log_off_by_default_and_bounded', group:'Features', name:'The sync log is off by default and bounded twice (v35.4)',
    test: async()=>{
      ['logEnabled','setLogEnabled','logRetentionDays','setLogRetentionDays','readSyncLog',
       'pruneSyncLog','syncLog','purgeSyncLog','analyseSyncLog','syncLogReportText']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      var kOn=null,kDays=null,kLog=null;
      try{ kOn=localStorage.getItem('tonys_log_enabled'); kDays=localStorage.getItem('tonys_log_days');
           kLog=localStorage.getItem('tonys_sync_log'); }catch(e){}
      try{
        // OFF is the default, and off means nothing is written at all — not
        // "written and hidden". A log that collects while switched off is the
        // opposite of what an opt-in switch promises.
        localStorage.removeItem('tonys_log_enabled');
        purgeSyncLog();
        if(logEnabled()) throw new Error('logging reports enabled with no setting stored');
        if(syncLog('save','should not be recorded')!==false)
          throw new Error('syncLog claimed to record while switched off');
        if(readSyncLog().length) throw new Error('an event was recorded while logging was off');
        if(localStorage.getItem('tonys_sync_log')!==null)
          throw new Error('the log key was created while logging was off');

        // Default retention, and clamping rather than trusting the input.
        localStorage.removeItem('tonys_log_days');
        if(logRetentionDays()!==7) throw new Error('default retention is '+logRetentionDays()+', expected 7');
        if(setLogRetentionDays(0)!==1) throw new Error('0 days was not clamped to the minimum');
        if(setLogRetentionDays(9999)!==365) throw new Error('9999 days was not clamped to the maximum');
        if(setLogRetentionDays('rubbish')!==7) throw new Error('a non-number did not fall back to the default');

        setLogEnabled(true);
        purgeSyncLog();
        if(!logEnabled()) throw new Error('logging did not stay enabled');
        syncLog('save','one');
        if(readSyncLog().length!==1) throw new Error('an event was not recorded while switched on');
        if(readSyncLog()[0].k!=='save') throw new Error('the kind was not stored');

        // Newest first — the viewer and the count cap both assume it.
        syncLog('load','two');
        var l=readSyncLog();
        if(l[0].m!=='two') throw new Error('the log is not newest-first');

        // Bound 1: age. An entry older than the window goes, and pruning is what
        // the "automatic cleanup" claim rests on.
        setLogRetentionDays(1);
        var old=readSyncLog();
        old.push({at: Date.now()-3*86400000, k:'save', m:'ancient'});
        localStorage.setItem('tonys_sync_log', JSON.stringify(old));
        var dropped=pruneSyncLog();
        if(dropped!==1) throw new Error('pruning dropped '+dropped+' entries, expected 1');
        if(readSyncLog().some(function(e){ return e.m==='ancient'; }))
          throw new Error('an entry past the retention window survived the prune');

        // ...and the write path applies the window too, not just an explicit
        // prune. Between prunes every new event is what keeps the log trimmed,
        // and a mutation that removed that filter survived on this gap.
        purgeSyncLog();
        setLogRetentionDays(1);
        localStorage.setItem('tonys_sync_log', JSON.stringify([
          { at: Date.now()-5*86400000, k:'save', m:'five days old' }]));
        syncLog('save','a fresh event');           // no pruneSyncLog() call here
        var afterWrite=readSyncLog();
        if(afterWrite.some(function(e){ return e.m==='five days old'; }))
          throw new Error('recording an event did not drop entries past the retention window');
        if(afterWrite.length!==1) throw new Error('expected only the fresh event, got '+afterWrite.length);

        // Bound 2: count. Age alone lets a busy afternoon fill localStorage.
        purgeSyncLog();
        setLogRetentionDays(365);
        for(var i=0;i<LOG_MAX_ENTRIES+25;i++) syncLog('save','entry '+i);
        if(readSyncLog().length!==LOG_MAX_ENTRIES)
          throw new Error('the log grew to '+readSyncLog().length+', past the '+LOG_MAX_ENTRIES+' ceiling');
        if(readSyncLog()[0].m!=='entry '+(LOG_MAX_ENTRIES+24))
          throw new Error('the ceiling dropped the newest entries instead of the oldest');

        // Corrupt storage is a reason to start again, never a reason to throw
        // into a caller that was only trying to save a recipe.
        localStorage.setItem('tonys_sync_log','{not json');
        if(!Array.isArray(readSyncLog()) || readSyncLog().length)
          throw new Error('a corrupt log did not read as empty');
        localStorage.setItem('tonys_sync_log','{"not":"an array"}');
        // `.length` on an object is undefined, so checking only that is not a
        // check — a mutation returning the object untouched survived on it.
        if(!Array.isArray(readSyncLog()))
          throw new Error('a non-array log was handed back as-is instead of an empty array');
        if(readSyncLog().length) throw new Error('a non-array log did not read as empty');
        // Junk entries inside a valid array must not reach the viewer either.
        localStorage.setItem('tonys_sync_log', JSON.stringify(
          [{at:Date.now(),k:'save',m:'good'}, null, 'nonsense', {k:'save',m:'no timestamp'}]));
        var cleaned=readSyncLog();
        if(cleaned.length!==1 || cleaned[0].m!=='good')
          throw new Error('malformed entries were not filtered out: '+JSON.stringify(cleaned));
        if(syncLog('save','after corruption')===undefined)
          throw new Error('syncLog threw after finding a corrupt log');

        // An unwritable store must not break the caller either.
        // v36.32 — stubbed on Storage.prototype, not on the localStorage object.
        // In Safari `localStorage.setItem = fn` does not shadow the method: the
        // Storage object's setter stores a KEY called "setItem" holding the
        // function's source, and the real method keeps working. So on Tony's
        // iPhone this test watched syncLog succeed and reported that syncLog
        // ignores a full disk, while quietly leaving a junk entry behind.
        var realSet=Storage.prototype.setItem;
        try{
          Storage.prototype.setItem=function(){ throw new Error('QuotaExceededError'); };
          var res=syncLog('save','while full');
          if(res!==false) throw new Error('syncLog reported success when storage refused the write');
        } finally { Storage.prototype.setItem=realSet; localStorage.removeItem('setItem'); }

        purgeSyncLog();
        if(readSyncLog().length) throw new Error('purge did not empty the log');
      } finally {
        try{
          if(kOn===null) localStorage.removeItem('tonys_log_enabled'); else localStorage.setItem('tonys_log_enabled',kOn);
          if(kDays===null) localStorage.removeItem('tonys_log_days'); else localStorage.setItem('tonys_log_days',kDays);
          if(kLog===null) localStorage.removeItem('tonys_sync_log'); else localStorage.setItem('tonys_sync_log',kLog);
        }catch(e){}
      }
    } },

  { id:'log_kinds_are_real', group:'Features', name:'Every syncLog call names a kind that exists (v36.43)',
    test: async()=>{
      // syncLog does not reject an unknown kind — it relabels it 'error',
      // which is the right call for a logger (never lose the event) and a trap
      // for whoever writes the call. Three of mine used 'warn', which does not
      // exist, so a tidy-up that had worked was reported as a fault and Tony's
      // report opened with "[BAD] 60 errors recorded".
      var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href),
                                   {cache:'no-store'})).text();
      var bad = [], re = /\bsyncLog\(\s*(['"])([a-z]+)\1/g, m;
      while((m = re.exec(src)) !== null) if(LOG_KINDS.indexOf(m[2]) === -1) bad.push(m[2]);
      if(bad.length)
        throw new Error(bad.length + ' syncLog call(s) use a kind that does not exist ('
          + bad.slice(0,4).join(', ') + '). Each one is silently logged as an error and counted '
          + 'as a fault in the report.');
      if(LOG_KINDS.indexOf('warn') !== -1)
        throw new Error('a "warn" kind now exists — this check was written when it did not, '
          + 'and the calls it was guarding should be revisited rather than left as errors');
    } },

  { id:'log_says_what_it_means', group:'Features', name:'The log viewer draws conclusions and proposes fixes (v35.4)',
    test: async()=>{
      var now=Date.now();
      // Empty is its own answer, not a blank screen.
      var none=analyseSyncLog([], now);
      if(none.length!==1 || !/nothing recorded/i.test(none[0].title))
        throw new Error('an empty log produced '+JSON.stringify(none.map(function(f){return f.title;})));
      if(!none[0].fix) throw new Error('even the empty case must say what to do next');

      // v36.3 — the suite fails ON PURPOSE. "boom", "AI down", "network down",
      // "Cloud read timed out after 0s", "Every slice failed" are all things a
      // test injects to prove the app notices them. Tony hard-refreshed and got
      // a report announcing 3 timeouts and 15 errors, every one of them staged.
      // A report that is confidently wrong is worse than no report, and a nudge
      // that cries wolf trains the reflex to dismiss it unread.
      var staged=[];
      for(var s=0;s<6;s++) staged.push({at:now-s*1000, k:'error', m:'boom', t:1});
      staged.push({at:now-9000, k:'conflict', m:'Save refused for "old" — changed on another device', t:1});
      var onlyTests=analyseSyncLog(staged, now);
      if(onlyTests.some(function(x){ return x.level==='bad'; }))
        throw new Error('staged test failures were reported as real problems: '
          + JSON.stringify(onlyTests.map(function(x){return x.title;})));
      if(!/self test/i.test(onlyTests[0].title+onlyTests[0].detail))
        throw new Error('a log holding only test events does not say so: '+onlyTests[0].title);
      // A REAL problem alongside them must still be found — suppressing the
      // staged ones must not suppress the evidence.
      var mixed=staged.concat([
        {at:now-20000, k:'conflict', m:'Save refused for "Chocolate Cake" — changed on another device'}]);
      var mf=analyseSyncLog(mixed, now);
      if(!mf.some(function(x){ return x.level==='bad' && /refused/i.test(x.title); }))
        throw new Error('a real conflict was swallowed along with the test events');
      if(mf.some(function(x){ return /15 errors|6 errors/i.test(x.title); }))
        throw new Error('the staged errors were counted into a finding anyway');
      // They stay IN the log and are shown, marked — hiding them would make
      // debugging the suite impossible.
      var before=readSyncLog();
      try{
        var wasOn=logEnabled(); setLogEnabled(true);
        purgeSyncLog();
        syncLog('error','a staged failure');           // _selfTestRunning is true here
        var rec=readSyncLog();
        if(!rec.length) throw new Error('the event was not recorded at all');
        if(!rec[0].t) throw new Error('an event recorded during a self test run is not marked as one');
        var txt=syncLogReportText();
        // The marker has to be on the EVENT LINE. Searching the whole report
        // finds "[test]" in the summary header even when every event line has
        // lost its marker — a mutation proved that assertion worthless.
        var line=txt.split('\n').filter(function(l){ return l.indexOf('a staged failure')!==-1; })[0];
        if(!line) throw new Error('a marked event is hidden from the report');
        if(line.indexOf('[test]')===-1)
          throw new Error('the event line does not say it came from a test: '+line.trim());
        if(!wasOn) setLogEnabled(false);
      } finally {
        purgeSyncLog();
        if(before.length) writeSyncLog(before);
      }

      // The case this whole feature exists for.
      var conflicts=[];
      for(var i=0;i<4;i++) conflicts.push({at:now-i*1000, k:'conflict',
        m:'Save refused for "Chocolate Cake" — changed on another device'});
      var f=analyseSyncLog(conflicts, now);
      if(f[0].level!=='bad') throw new Error('repeated refusals were not ranked worst-first');
      var titles=f.map(function(x){ return x.title; }).join(' | ');
      if(!/refused/i.test(titles)) throw new Error('no finding mentions the refusals: '+titles);
      if(!/keeps being refused/i.test(titles))
        throw new Error('four refusals of the same recipe were not called out as stuck: '+titles);
      f.forEach(function(x){
        if(!x.fix) throw new Error('finding "'+x.title+'" has no proposed fix');
        if(!x.detail) throw new Error('finding "'+x.title+'" has no detail');
      });
      if(!/Version history/i.test(f.map(function(x){return x.fix;}).join(' ')))
        throw new Error('the conflict fix does not point at the way out that exists');

      // A healthy log must not invent problems.
      var fine=analyseSyncLog([{at:now,k:'load',m:'Read 44 recipe(s) from the cloud'},
                               {at:now-60000,k:'save',m:'Wrote "Soup"'}], now);
      if(fine.some(function(x){ return x.level==='bad'; }))
        throw new Error('a clean log produced a "bad" finding: '+JSON.stringify(fine.map(function(x){return x.title;})));

      // Timeouts and errors each get their own finding.
      var t=analyseSyncLog([{at:now,k:'error',m:'Cloud read timed out after 45s'}], now);
      if(!/timed out/i.test(t.map(function(x){return x.title;}).join(' ')))
        throw new Error('a timeout produced no finding of its own');

      // EVIDENCE IS NOT INTERFACE TEXT (v36.50). Three of these findings quote
      // the log back — recipe names, whatever was logged, and a (×3) on the end.
      // Every distinct combination is a different string, so cataloguing them
      // puts an entry in the dictionary that can never appear a second time.
      // Tony found two of them sitting among his orphans looking like garbage,
      // and they were: the same unbounded class as the log rows (v36.44) and the
      // counts (v36.47). The written prose beside them must stay translatable,
      // or fixing this would silently take a dozen real sentences out with it.
      if(!f.filter(function(x){ return /keeps being refused/i.test(x.title); })[0].raw)
        throw new Error('a finding whose detail quotes recipe names is not marked verbatim');
      if(!analyseSyncLog([{at:now,k:'error',m:'Cloud read timed out after 45s'}], now)
            .filter(function(x){ return /error/i.test(x.title); })[0].raw)
        throw new Error('the error bullets are not marked verbatim — every distinct '
          + 'log message would become its own dictionary key');
      if(fine.some(function(x){ return x.raw; }))
        throw new Error('a finding made entirely of written English was marked verbatim — '
          + 'that sentence can never be translated now');
      if(t.filter(function(x){ return /timed out/i.test(x.title); })[0].raw)
        throw new Error('the timeout finding is written prose and must stay translatable');

      // The report is what reaches a human — it must carry both halves.
      var kOn=null,kLog=null;
      try{ kOn=localStorage.getItem('tonys_log_enabled'); kLog=localStorage.getItem('tonys_sync_log'); }catch(e){}
      try{
        setLogEnabled(true); purgeSyncLog();
        syncLog('conflict','Save refused for "Soup" — changed on another device');
        var txt=syncLogReportText();
        if(txt.indexOf('WHAT THIS LOOKS LIKE')===-1) throw new Error('the report has no findings section');
        if(txt.indexOf('EVENTS')===-1) throw new Error('the report has no events section');
        if(txt.indexOf('Soup')===-1) throw new Error('the report does not contain the event it was built from');
        if(txt.indexOf('→')===-1) throw new Error('the report carries no proposed fix');
        // A few hundred bytes must read as a few hundred bytes. "0 KB" is a
        // rounding artefact, and this app does not let the UI state things the
        // code has not checked.
        if(/·\s*\d+ event\(s\), 0 KB/.test(txt))
          throw new Error('a small log reported its size as "0 KB"');
        if(txt.indexOf(' bytes')===-1 && txt.indexOf(' KB')===-1)
          throw new Error('the report does not state the log size at all');
        if(formatBytes(0)!=='0 bytes') throw new Error('formatBytes(0) is '+formatBytes(0));
        if(formatBytes(688)!=='688 bytes') throw new Error('formatBytes(688) is '+formatBytes(688));
        if(formatBytes(2048)!=='2 KB') throw new Error('formatBytes(2048) is '+formatBytes(2048));
        if(typeof APP_VERSION==='string' && txt.indexOf(APP_VERSION)===-1)
          throw new Error('the report does not say which version produced it');

        // …and the panel that shows the same findings marks the quoted evidence
        // so the string finder walks past it. Checked on the rendered DOM, not
        // on the flag: the flag is only worth having if the renderer reads it.
        //
        // Written with writeSyncLog rather than syncLog, and that is the whole
        // trick. syncLog stamps every event a test causes with `t`, and the
        // analyser drops those — so the obvious version of this check rendered
        // a panel with no findings in it at all, found the words in the EVENT
        // rows (marked since v36.44), and passed whether the renderer had been
        // fixed or not. An assertion that cannot fail is not an assertion.
        writeSyncLog([{ at:Date.now(), k:'conflict',
                        m:'Save refused for "Soup" — changed on another device' },
                      { at:Date.now()-1000, k:'error', m:'Cloud read timed out after 0s' }]);
        renderLoggingPanel();
        var hostL=document.getElementById('loggingBody');
        if(!hostL) throw new Error('#loggingBody is not in the page');
        var quoted=Array.prototype.filter.call(hostL.querySelectorAll('div'), function(d){
          return !d.querySelector('div')
              && (/^Another device changed "Soup"/.test(d.textContent.trim())
                  || /^• Cloud read timed out/.test(d.textContent.trim()));
        });
        if(quoted.length!==2)
          throw new Error('expected both quoted-evidence findings on screen, found '+quoted.length
            + ' — the check would have passed without testing anything');
        quoted.forEach(function(d){
          for(var n=d;n&&n!==document.body;n=n.parentElement)
            if(n.hasAttribute&&n.hasAttribute('data-no-i18n')) return;
          throw new Error('the quoted log evidence is still catalogued as interface text: '
            + JSON.stringify(d.textContent.slice(0,60)));
        });
        // The written prose beside it is NOT marked, or this fix would have
        // taken a dozen real sentences out of the dictionary with it.
        var tryLine=Array.prototype.filter.call(hostL.querySelectorAll('div'), function(d){
          return /^Try:\s*Open the recipe/.test(d.textContent.trim());
        })[0];
        if(!tryLine) throw new Error('the conflict finding lost its proposed fix');
        for(var nn=tryLine;nn&&nn!==document.body;nn=nn.parentElement)
          if(nn.hasAttribute&&nn.hasAttribute('data-no-i18n'))
            throw new Error('the written "Try:" line was marked verbatim and can never be translated');
      } finally {
        try{
          if(kOn===null) localStorage.removeItem('tonys_log_enabled'); else localStorage.setItem('tonys_log_enabled',kOn);
          if(kLog===null) localStorage.removeItem('tonys_sync_log'); else localStorage.setItem('tonys_sync_log',kLog);
        }catch(e){}
      }
    } },

  { id:'log_nudge_is_quiet_and_per_device', group:'Features', name:'The nudge is off by default, per device, and does not nag (v35.6)',
    test: async()=>{
      ['logNudgeEnabled','setLogNudgeEnabled','maybeNudgeAboutLog','logNudgeSignature','dismissLogNudge']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      var kOn=null,kNudge=null,kSeen=null,kLog=null;
      try{ kOn=localStorage.getItem('tonys_log_enabled'); kNudge=localStorage.getItem('tonys_log_nudge');
           kSeen=localStorage.getItem('tonys_log_nudge_seen'); kLog=localStorage.getItem('tonys_sync_log'); }catch(e){}
      // This test is about how the nudge reacts to a GENUINE problem, so its
      // fixtures go in unmarked. syncLog() stamps t:1 while the suite is running
      // (v36.3) and the analyser ignores those, which is exactly right for the
      // staged failures other tests cause — and exactly wrong here.
      var put=function(k,m){ var l=readSyncLog(); l.unshift({at:Date.now(),k:k,m:m}); writeSyncLog(l); };
      // v36.58 — the session may ALREADY have nudged. Tony's PC has the nudge
      // on and his real log held an old error, so it fired when the app opened
      // — and this test then asked about a healthy log and was told
      // 'already-shown-this-session'. CI never nudges first, so it passed there.
      // Set aside, and put back, like every other piece of device state here.
      var shownWas=_logNudgeShownThisSession;
      var nudgeEl=document.getElementById('logNudge'), nudgeParent=nudgeEl&&nudgeEl.parentNode;
      if(nudgeEl) nudgeEl.remove();
      _logNudgeShownThisSession=false;
      try{
        localStorage.removeItem('tonys_log_nudge');
        localStorage.removeItem('tonys_log_nudge_seen');
        if(logNudgeEnabled()) throw new Error('the nudge is on with no setting stored');

        // Every refusal is NAMED, so "it stayed quiet" can be told apart from
        // "it is broken". A boolean here would hide the difference.
        setLogEnabled(true); purgeSyncLog();
        put('conflict','Save refused for "Soup" — changed on another device');
        if(maybeNudgeAboutLog()!=='nudge-off')
          throw new Error('the nudge fired while switched off — the default must be silence');
        if(document.getElementById('logNudge')) throw new Error('a nudge was rendered while switched off');

        setLogNudgeEnabled(true);
        if(!logNudgeEnabled()) throw new Error('the nudge setting did not persist');
        // It is a localStorage key, which is what makes it per-device: the PC can
        // have it on while the phone does not.
        if(localStorage.getItem('tonys_log_nudge')!=='1')
          throw new Error('the nudge setting is not stored per device');

        setLogEnabled(false);
        if(maybeNudgeAboutLog()!=='logging-off')
          throw new Error('the nudge fired with nothing being recorded');

        setLogEnabled(true); purgeSyncLog();
        put('load','Read 44 recipe(s) from the cloud');
        var healthy=maybeNudgeAboutLog();
        if(healthy!=='nothing-wrong')
          throw new Error('the nudge fired on a healthy log (it said '+JSON.stringify(healthy)+')');
        if(document.getElementById('logNudge')) throw new Error('a nudge was rendered with nothing wrong');

        // A real problem: it shows, and it names the problem rather than saying
        // "1 issue", which would tell nobody whether to care.
        put('conflict','Save refused for "Soup" — changed on another device');
        if(maybeNudgeAboutLog()!=='shown') throw new Error('the nudge did not fire on a real problem');
        var el=document.getElementById('logNudge');
        if(!el) throw new Error('the nudge reported "shown" but rendered nothing');
        if(!/refused/i.test(el.textContent)) throw new Error('the nudge does not say what the problem is');
        var btns=Array.prototype.slice.call(el.querySelectorAll('button')).map(function(b){ return b.textContent; });
        if(!btns.some(function(t){ return /Copy report/.test(t); }))
          throw new Error('the nudge has no Copy button, which is the only way this reaches anyone');
        if(!btns.some(function(t){ return /✕/.test(t); })) throw new Error('the nudge cannot be dismissed');

        // Guard 1: once per session.
        if(maybeNudgeAboutLog()!=='already-shown-this-session')
          throw new Error('the nudge fired twice in one session');

        // Guard 2: never twice for the same problems, even across sessions.
        if(maybeNudgeAboutLog({force:true})!=='already-mentioned')
          throw new Error('the nudge repeated itself for problems it had already raised');

        // ...but a NEW problem is worth mentioning.
        put('error','Cloud read timed out after 45s');
        if(maybeNudgeAboutLog({force:true})!=='shown')
          throw new Error('a new problem did not produce a fresh nudge');

        dismissLogNudge();
        if(document.getElementById('logNudge')) throw new Error('dismiss left the nudge on screen');

        // The signature must track the COUNT, not just the kind: a fourth
        // refusal is news, the same three are not.
        // These must differ ONLY in the digit, or a mutation that strips digits
        // still produces two different strings and the check proves nothing.
        var three=logNudgeSignature([{level:'bad',title:'3 saves were refused as edited elsewhere'}]);
        var four =logNudgeSignature([{level:'bad',title:'4 saves were refused as edited elsewhere'}]);
        if(three===four) throw new Error('the signature ignores how many problems there are, so a fourth refusal is never mentioned');
        if(logNudgeSignature([{level:'ok',title:'Nothing looks wrong'}])!=='')
          throw new Error('a healthy finding contributed to the signature');
      } finally {
        dismissLogNudge();
        _logNudgeShownThisSession=shownWas;
        if(nudgeEl && nudgeParent) nudgeParent.appendChild(nudgeEl);   // it was his, so it goes back
        try{
          if(kOn===null) localStorage.removeItem('tonys_log_enabled'); else localStorage.setItem('tonys_log_enabled',kOn);
          if(kNudge===null) localStorage.removeItem('tonys_log_nudge'); else localStorage.setItem('tonys_log_nudge',kNudge);
          if(kSeen===null) localStorage.removeItem('tonys_log_nudge_seen'); else localStorage.setItem('tonys_log_nudge_seen',kSeen);
          if(kLog===null) localStorage.removeItem('tonys_sync_log'); else localStorage.setItem('tonys_sync_log',kLog);
        }catch(e){}
      }
    } },

  { id:'log_panel_controls', group:'UI', name:'Logging & debugging panel has all five controls (v35.4)',
    test: async()=>{
      ['showLoggingPanel','renderLoggingPanel','copySyncLogReport','purgeSyncLogUI','applyLogRetention']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(!document.getElementById('loggingOverlay')) throw new Error('#loggingOverlay missing');
      // The way in: three in-app messages point at ⚙️ Settings, so it has to be there.
      var drop=document.getElementById('settingsDrop');
      if(!drop || drop.innerHTML.indexOf('showLoggingPanel()')===-1)
        throw new Error('no ⚙️ Settings entry opens the logging panel');

      var kOn=null,kLog=null;
      try{ kOn=localStorage.getItem('tonys_log_enabled'); kLog=localStorage.getItem('tonys_sync_log'); }catch(e){}
      try{
        setLogEnabled(true); purgeSyncLog();
        // A recipe name reaches the log and then the panel. Names are user data
        // and can contain anything; the panel must render it as text.
        syncLog('conflict','Save refused for "<img src=x onerror=alert(1)>" — changed on another device');
        renderLoggingPanel();
        var body=document.getElementById('loggingBody');
        if(!body || !body.innerHTML) throw new Error('the panel rendered nothing');
        if(body.querySelector('img[src="x"]'))
          throw new Error('a recipe name from the log was rendered as live HTML');

        if(!body.querySelector('#logEnabledBox')) throw new Error('no enable/disable switch');
        if(!body.querySelector('#logEnabledBox').checked) throw new Error('the switch does not reflect the stored setting');
        var days=body.querySelector('#logDaysInput');
        if(!days) throw new Error('no retention setting');
        if(String(days.value)!==String(logRetentionDays())) throw new Error('the retention field shows the wrong value');
        var html=body.innerHTML;
        if(html.indexOf('copySyncLogReport()')===-1) throw new Error('no Copy report button');
        if(html.indexOf('purgeSyncLogUI()')===-1) throw new Error('no Purge logs button');
        if(html.indexOf('setLogFilter(')===-1) throw new Error('no filter controls in the viewer');
        if(html.indexOf('What this looks like')===-1) throw new Error('the panel shows no analysis');
        if(html.indexOf('debugModeItem')===-1) throw new Error('debug mode did not move into this panel');
        // The nudge switch, and it must be unusable while nothing is being
        // recorded — an switch that promises notifications about a log that is
        // not being written is a lie.
        var nudgeBox=body.querySelector('#logNudgeBox');
        if(!nudgeBox) throw new Error('no switch for the nudge');
        if(nudgeBox.disabled) throw new Error('the nudge switch is disabled while recording is on');
        setLogEnabled(false); renderLoggingPanel();
        var off=document.getElementById('loggingBody').querySelector('#logNudgeBox');
        if(!off || !off.disabled) throw new Error('the nudge switch stays usable while recording is off');
        setLogEnabled(true); renderLoggingPanel();
        // The findings must be visible, not just computed.
        if(html.indexOf('Try:')===-1) throw new Error('the findings are shown without their proposed fixes');
      } finally {
        try{
          if(kOn===null) localStorage.removeItem('tonys_log_enabled'); else localStorage.setItem('tonys_log_enabled',kOn);
          if(kLog===null) localStorage.removeItem('tonys_sync_log'); else localStorage.setItem('tonys_sync_log',kLog);
        }catch(e){}
        var ov=document.getElementById('loggingOverlay'); if(ov) ov.classList.remove('open');
      }
    } },

  { id:'cloud_photo_heal', group:'Cloud Sync', name:'A local photo fix reaches the cloud, which wins on load (5g.9)',
    test: async()=>{
      ['comparePhotosWithCloud','pushLocalPhotosToCloud','healCloudPhotos']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(!document.getElementById('healCloudPhotosItem')) throw new Error('no menu entry to send photos to the cloud');

      var kR=recipes, kDb=window._fbDb, kUser=window._fbUser, kBulk=window.readCloudPhotoDocs,
          kStamps=window._cloudPhotoStamps, kIds=window._cloudPhotoIds;
      try{
        window._fbUser={ uid:'t' }; window._cloudPhotoStamps={}; window._cloudPhotoIds={};
        recipes=[{ id:1, name:'mine is right', photo:'data:image/jpeg;base64,GOOD' },
                 { id:2, name:'agrees',        photo:'data:image/jpeg;base64,SAME' },
                 { id:3, name:'only here',     photo:'data:image/jpeg;base64,LOCAL' }];
        window._fbDb={};
        window.readCloudPhotoDocs=function(){ return Promise.resolve({ complete:true, byId:{
          'photo_1': { photo:'data:image/jpeg;base64,STOCKJUNK' },   // the cloud disagrees
          'photo_2': { photo:'data:image/jpeg;base64,SAME' }         // the cloud agrees
        } }); };
        var cmp=await comparePhotosWithCloud();
        if(!cmp) throw new Error('the comparison returned null when the cloud was readable');
        if(cmp.differ.length!==1||cmp.differ[0].id!==1)
          throw new Error('the photo the cloud disagrees about was not identified: '+JSON.stringify(cmp.differ.map(function(r){return r.id;})));
        if(cmp.onlyLocal.length!==1||cmp.onlyLocal[0].id!==3)
          throw new Error('a photo that exists only on this device was not identified');

        // Not being able to read the cloud is NOT agreement.
        window.readCloudPhotoDocs=function(){ return Promise.resolve({ complete:false, byId:{} }); };
        if(await comparePhotosWithCloud()!==null)
          throw new Error('an unreadable cloud was reported as a comparison — "not known" is not "agrees"');

        // The push must OVERWRITE, ignoring the only-if-changed stamp. That
        // optimisation is right for ordinary saves and exactly wrong here: the
        // whole point is to overwrite what the cloud believes.
        var written={};
        window._fbDb={ collection:function(){ return { doc:function(id){ return {
          set:function(payload){ written[id]=payload; return Promise.resolve(); }
        }; } }; } };
        window._cloudPhotoStamps={ 1:'data:image/jpeg;base64,GOOD' };   // "unchanged" by the stamp
        var res=await pushLocalPhotosToCloud([recipes[0]]);
        if(res.pushed!==1) throw new Error('the push wrote nothing: '+JSON.stringify(res));
        if(!written['photo_1']||written['photo_1'].photo!=='data:image/jpeg;base64,GOOD')
          throw new Error('the local photo was not written over the cloud copy: '+JSON.stringify(written));
        if('photoUrl' in written['photo_1']) throw new Error('a Storage-shaped document was written');

        // A refused write must be REPORTED, not counted as success — the cloud
        // still holds the wrong copy and it will come back on the next load.
        window._fbDb={ collection:function(){ return { doc:function(){ return {
          set:function(){ return Promise.reject(new Error('permission-denied')); }
        }; } }; } };
        var bad=await pushLocalPhotosToCloud([recipes[0]]);
        if(bad.pushed!==0) throw new Error('a refused write was counted as pushed');
        if(!bad.failed.length) throw new Error('a refused write was swallowed — the user would think the cloud was fixed');
        // Opening Sync Health must ANSWER the question, not just pose it.
        // _photoCloudDiff is per-session, so after a reload — exactly when the
        // panel is opened to confirm a fix held — it said "not checked yet" and
        // stopped there.
        window._photoCloudDiff=null;
        window.readCloudPhotoDocs=function(){ return Promise.resolve({ complete:true, byId:{
          'photo_1': { photo:'data:image/jpeg;base64,STOCKJUNK' }
        } }); };
        recipes=[{ id:1, name:'mine is right', photo:'data:image/jpeg;base64,GOOD' }];
        if(typeof checkPhotoCloudDiff!=='function') throw new Error('checkPhotoCloudDiff not defined');
        // Driven by OPENING the panel and reading what is on screen. Calling
        // checkPhotoCloudDiff() and reading syncHealthText() tested neither the
        // opening nor the re-render, and both could be deleted with this green.
        openSyncHealth();
        await new Promise(function(res){ setTimeout(res, 200); });
        var body=document.getElementById('syncHealthBody');
        if(!body) throw new Error('the panel rendered no body');
        var shown=(body.textContent||'').replace(/\s+/g,' ');
        if(shown.indexOf('not checked yet')>-1)
          throw new Error('the panel still says "not checked yet" after being opened — it poses the question and refuses to answer it, which is exactly when the user needs it');
        // The row renders as label+value with no separator ("…the cloud1"), so
        // match that shape rather than assuming a space.
        if(!/differing from the cloud\s*1(?!\d)/i.test(shown))
          throw new Error('the measured disagreement never reached the screen — the comparison ran but nothing re-rendered');
      } finally {
        recipes=kR; window._fbDb=kDb; window._fbUser=kUser; window.readCloudPhotoDocs=kBulk;
        window._cloudPhotoStamps=kStamps; window._cloudPhotoIds=kIds;
        window._photoCloudDiff=null;
        closeM('syncHealthOverlay');
      }
    } },

  { id:'ui_menu_directions_true', group:'UI', name:'Every “⚙️ → X” the app prints is really in Settings (5g.10)',
    test: async()=>{
      // Tony went to ⚙️ Settings for "Send my photos to the cloud" because three
      // of the app's own messages told him to. The item was in the ··· More menu.
      // Directing someone to a menu that does not contain the thing is the same
      // class of fault as a status line asserting something unverified — it is
      // the UI stating something untrue — and it is entirely checkable.
      var settings=document.getElementById('settingsDrop');
      if(!settings) throw new Error('no settings menu to check against');
      var labels={};
      settings.querySelectorAll('.drop-item').forEach(function(b){
        labels[(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()]=true;
      });
      function inSettings(name){
        var want=String(name).replace(/\s+/g,' ').trim().toLowerCase();
        return Object.keys(labels).some(function(l){ return l.indexOf(want)>-1; });
      }

      // Collect what the CODE claims, from the functions that print these
      // messages — quoted names only, so the check is about a specific item.
      var sources=[autoFetchMissingPhotos, runPhotoRescue, undoAutoFetch, healCloudPhotos]
        .map(function(f){ return String(f); }).join('\n');
      var claims=[], re=/⚙️\s*(?:Settings\s*)?→\s*[“"]([^”"]{3,60})[”"]/g, m;
      while((m=re.exec(sources))) claims.push(m[1]);
      if(!claims.length)
        throw new Error('no “⚙️ → …” directions found at all — this check would pass vacuously');
      claims.forEach(function(c){
        var name=c.replace(/^[^A-Za-z\u0590-\u05FF]+/, '').trim();
        if(!inSettings(name))
          throw new Error('the app tells the user “⚙️ → ' + c + '” but no such item is in the Settings menu — they will look and not find it, which is exactly what happened');
      });

      // And the three photo-repair tools must be reachable at all.
      ['healCloudPhotosItem','photoRescueItem','autoFetchUndoItem'].forEach(function(id){
        var el=document.getElementById(id);
        if(!el) throw new Error(id+' is not in the page, so that repair cannot be reached');
        if(!settings.contains(el))
          throw new Error(id+' is not inside the Settings menu, but the app directs the user there');
      });
    } },

  { id:'feat_cat_skills', group:'Features', name:'“Skills & Methods” is a first-class category (5g.9)',
    test: async()=>{
      if(CATS.indexOf('Skills & Methods')===-1)
        throw new Error('Skills & Methods is not in CATS, so it cannot be chosen or filtered');
      // It must survive normalizeRecipe, or every save would rewrite it to Dinner.
      var r=normalizeRecipe({ id:9601, name:'Deboning a chicken', category:'Skills & Methods',
                              ingredients:[], steps:['x'] });
      if(r.category!=='Skills & Methods')
        throw new Error('normalizeRecipe rewrote the category to "'+r.category+'" — the choice would not stick');
      // And the filter bar must offer it, with an icon like every other category.
      var kR=recipes;
      try{
        recipes=[r];
        renderFilters();
        var bar=document.getElementById('filterBar')||document.body;
        if((bar.textContent||'').indexOf('Skills & Methods')===-1)
          throw new Error('the filter bar does not offer Skills & Methods, so recipes filed under it cannot be found');
      } finally { recipes=kR; renderFilters(); renderGrid(); }
    } },

  { id:'photo_one_shape_no_storage', group:'Storage', name:'Photos have ONE shape: base64, no Storage path (5g.7)',
    test: async()=>{
      // v34.4 deleted the Firebase Storage path — it needed a paid plan, was never
      // switched on, and put branches into the two most dangerous paths in the app
      // (photo sync and backup). This pins what must still be true afterwards.
      ['storageReady','uploadPhotoToStorageBucket','deletePhotoFromStorageBucket','photoStoragePath',
       'migratePhotosToStorage','storageMigrationPending','markStorageUnavailable','inlineRemotePhoto',
       'inlinePhotosForBackup','dataUrlToBlobForUpload'].forEach(function(f){
        if(typeof window[f]!=='undefined')
          throw new Error(f+' is back — the Storage path was removed, and a second photo shape is exactly the mixed-methodology trap this app refuses');
      });
      if(document.getElementById('storageMigrateBox'))
        throw new Error('the Storage migration box is back in Settings, offering a feature that cannot run');

      // The compressor is NOT Storage code and must survive, under its honest name.
      if(typeof compressPhotoToDataUrl!=='function')
        throw new Error('compressPhotoToDataUrl is gone — every photo the user adds goes through it, so adding a photo is now broken');

      // syncCloudPhotos writes exactly one shape: base64 in `photo`. No photoUrl,
      // no `storage:true`, no branch on whether the value looks remote.
      var kR=recipes, kDb=window._fbDb, kStamps=window._cloudPhotoStamps, kIds=window._cloudPhotoIds,
          written=null;
      try{
        window._cloudPhotoStamps={}; window._cloudPhotoIds={};
        recipes=[{ id:41, name:'has a photo', photo:'data:image/jpeg;base64,AAA', updatedAt:5 }];
        window._fbDb={ collection:function(){ return { doc:function(){ return {
          set:function(payload){ written=payload; return Promise.resolve(); },
          delete:function(){ return Promise.resolve(); }
        }; } }; } };
        await syncCloudPhotos();
        if(!written) throw new Error('nothing was written to the cloud at all');
        if(written.photo!=='data:image/jpeg;base64,AAA')
          throw new Error('the photo document no longer carries the base64 photo: '+JSON.stringify(Object.keys(written)));
        if('photoUrl' in written || 'storage' in written)
          throw new Error('a Storage-shaped photo document was written: '+JSON.stringify(Object.keys(written)));
      } finally {
        recipes=kR; window._fbDb=kDb; window._cloudPhotoStamps=kStamps; window._cloudPhotoIds=kIds;
      }

      // A backup stays self-contained — every photo travels as base64 inside the
      // file. That used to need a download step for remote photos; it is free now,
      // but the property is what matters and it must still hold.
      var bR=recipes, bToast=window.toast, bMark=window.markBackupTaken, captured=null;
      var realCreate=URL.createObjectURL, realRevoke=URL.revokeObjectURL, realAppend=document.body.appendChild;
      // v36.32 — force the DOWNLOAD path. Since v36.20 a chosen backup folder is
      // written to directly and no blob is ever made, so on Tony's PC — where a
      // folder is chosen — this said "the backup produced no file" about a
      // backup that had just been written to his disk. What is under test here
      // is whether the file is self-contained, not which of the two ways out it
      // took; the folder path has its own test.
      var bDir=window.backupDirLoad;
      try{
        window.backupDirLoad=function(){ return Promise.resolve(null); };
        window.toast=function(){}; window.markBackupTaken=function(){};
        URL.createObjectURL=function(blob){ captured=blob; return 'blob:stub'; };
        URL.revokeObjectURL=function(){};
        document.body.appendChild=function(node){ if(node && node.tagName==='A'){ node.click=function(){}; return node; } return realAppend.call(document.body,node); };
        recipes=[normalizeRecipe({ id:42, name:'backed up', photo:'data:image/jpeg;base64,BBB', ingredients:[], steps:['x'] })];
        await backupSave();
        if(!captured) throw new Error('the backup produced no file');
        var text=await captured.text(), parsed=JSON.parse(text);
        var vals=Object.keys(parsed.photos||{}).map(function(k){ return parsed.photos[k]; });
        if(!vals.length) throw new Error('the backup carries no photo bytes, so a restore would lose the picture');
        if(vals.some(function(v){ return !/^data:/.test(v); }))
          throw new Error('a backup photo is not self-contained — it would depend on a live server years later');
        if(JSON.stringify(parsed.recipes).indexOf('_backup_photo')!==-1)
          throw new Error('the temporary backup field leaked into the exported file');
      } finally {
        recipes=bR; window.toast=bToast; window.markBackupTaken=bMark;
        window.backupDirLoad=bDir;
        URL.createObjectURL=realCreate; URL.revokeObjectURL=realRevoke;
        document.body.appendChild=realAppend;
      }
    } },

  { id:'photo_store_read_failure', group:'Storage', name:'A failed photo-store read is not an empty store (5g.6)',
    test: async()=>{
      // THE root-cause bug, found while hunting why Tony's photos were replaced a
      // second time. idbGetAll resolved [] when the read FAILED, so
      // recipesWithNoPhoto's "IndexedDB unreadable — refusing to guess" branch was
      // dead code: it can only run on a rejection, and nothing ever rejected. With
      // the store unreadable every recipe whose photo lives only there reads as
      // photoless, and the auto-fetch overwrites it.
      var savedRecipes=recipes, realAll=window.idbGetAll, realHyd=window.hydratePhotosFromIDB;
      try{
        recipes=[{ id:1, name:'photo only in IDB', photo:'', _ph:1 }];
        window.hydratePhotosFromIDB=function(){ return Promise.resolve(); };
        // A read that FAILS must stop the run dead.
        window.idbGetAll=function(){ return Promise.reject(new Error('read failed')); };
        if(await recipesWithNoPhoto()!==null)
          throw new Error('an unreadable photo store did not stop the run — every photo stored only there would be overwritten');
        // ...and a genuinely EMPTY store is a different answer: it may proceed.
        window.idbGetAll=function(){ return Promise.resolve([]); };
        var out=await recipesWithNoPhoto();
        if(out===null) throw new Error('an empty store was treated as unreadable, so the feature could never run at all');
      } finally { recipes=savedRecipes; window.idbGetAll=realAll; window.hydratePhotosFromIDB=realHyd; }

      // The real idbGetAll must REJECT rather than resolve [] when the request
      // errors — that is the distinction the branch above depends on.
      if(typeof idbGetAll!=='function') throw new Error('idbGetAll not defined');
      var realStore=window.idbStore;
      try{
        window.idbStore=function(){ return Promise.resolve({ getAll:function(){
          var req={}; setTimeout(function(){ req.onerror && req.onerror(); }, 0); return req;
        } }); };
        var threw=false;
        try{ await idbGetAll(); } catch(e){ threw=true; }
        if(!threw) throw new Error('idbGetAll resolved instead of rejecting on a failed read — "could not read" is being reported as "nothing there"');
      } finally { window.idbStore=realStore; }

      // Hydration must survive that rejection WITHOUT clearing a single flag:
      // clearing _ph because the store could not be read is how a transient
      // failure becomes permanent loss.
      var keep2=recipes, realAll2=window.idbGetAll;
      try{
        recipes=[{ id:2, name:'flagged', photo:'', _ph:1, _po:1 }];
        window.idbGetAll=function(){ return Promise.reject(new Error('read failed')); };
        window._idbPhotosMissing=0;
        await hydratePhotosFromIDB();
        if(!recipes[0]._ph||!recipes[0]._po)
          throw new Error('a failed hydration cleared the flags that say where the photo lives — that photo is now unrecoverable');
        // ...and it must not report loss it has not observed. Treating an
        // unreadable store as "empty" walks the whole list finding nothing and
        // tells Sync Health photos are missing from this device — an alarm about
        // data loss, raised by a transient read failure.
        if(window._idbPhotosMissing)
          throw new Error('an unreadable store was counted as '+window._idbPhotosMissing+' missing photo(s) — the panel would report loss that has not happened');
      } finally { recipes=keep2; window.idbGetAll=realAll2; }
    } },

  { id:'photo_autofetch_undo', group:'Features', name:'Auto-fetch verifies itself and can be undone (5g.6)',
    test: async()=>{
      ['autoFetchVerifyTargets','autoFetchUndoSave','autoFetchUndoLoad','autoFetchUndoClear','undoAutoFetch']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(!document.getElementById('autoFetchUndoItem')) throw new Error('there is no menu entry to undo a run');

      // 1. The independent check catches a filter that is wrong, from IDB rather
      // than from the filter's own view.
      var realAll=window.idbGetAll;
      try{
        window.idbGetAll=function(){ return Promise.resolve([{ id:7, photo:'data:image/jpeg;base64,REAL' }]); };
        var wrong=await autoFetchVerifyTargets([{ id:7, name:'has one really', photo:'' },
                                                { id:8, name:'genuinely bare', photo:'' }]);
        if(!wrong) throw new Error('the verification returned null when the store was readable');
        if(wrong.length!==1||wrong[0].id!==7)
          throw new Error('the second opinion missed a recipe whose photo is in IndexedDB: '+JSON.stringify(wrong.map(function(r){return r.id;})));
        // A recipe flagged in memory counts too.
        var wrong2=await autoFetchVerifyTargets([{ id:9, name:'flagged', photo:'', _ph:1 }]);
        if(wrong2.length!==1) throw new Error('a recipe carrying _ph was not treated as having a photo');
        // Unable to verify is NOT permission to continue.
        window.idbGetAll=function(){ return Promise.reject(new Error('nope')); };
        if(await autoFetchVerifyTargets([{ id:1, photo:'' }])!==null)
          throw new Error('an unreadable store did not return null — the run would proceed unverified');
      } finally { window.idbGetAll=realAll; }

      // 2. A run that would overwrite must ABORT, not partially succeed.
      var kR=recipes, kHyd=window.hydratePhotosFromIDB, kAll=window.idbGetAll, kErr=window.showServiceError,
          kToast=window.toast, kAsk=window.askConfirm, kOnce=window.photoSearchOnce, asked=0, errored=0, searched=0;
      try{
        window.toast=function(){}; window.showServiceError=function(){ errored++; };
        window.askConfirm=function(){ asked++; return Promise.resolve(true); };
        window.photoSearchOnce=function(){ searched++; return Promise.resolve([]); };
        window.hydratePhotosFromIDB=function(){ return Promise.resolve(); };
        // The filter has to be WRONG for this branch to matter, so it is stubbed
        // wrong on purpose: the real one would exclude this recipe correctly, and
        // the whole point of the second opinion is to catch the day it does not.
        recipes=[{ id:11, name:'actually has one', photo:'' }];
        window.idbGetAll=function(){ return Promise.resolve([{ id:11, photo:'data:image/jpeg;base64,MINE' }]); };
        var kFilter=window.recipesWithNoPhoto;
        try{
          window.recipesWithNoPhoto=function(){ return Promise.resolve(recipes.slice()); };
          await autoFetchMissingPhotos();
        } finally { window.recipesWithNoPhoto=kFilter; }
        if(searched) throw new Error('the run searched for photos even though a target already had one');
        if(!errored) throw new Error('the run stopped but said nothing — silence after refusing is its own fault');
        if(recipes[0].photo) throw new Error('the aborted run still wrote a photo');
      } finally {
        recipes=kR; window.hydratePhotosFromIDB=kHyd; window.idbGetAll=kAll;
        window.showServiceError=kErr; window.toast=kToast; window.askConfirm=kAsk; window.photoSearchOnce=kOnce;
      }

      // 3. A real run must LEAVE a snapshot. Asserting that autoFetchUndoSave works
      // proved only that the helper works — the run was free to stop calling it,
      // which is exactly the shape that has bitten this suite before.
      var sR=recipes, sHyd=window.hydratePhotosFromIDB, sAll=window.idbGetAll, sAsk=window.askConfirm,
          sTerms=window.photoSearchTerms, sOnce=window.photoSearchOnce, sFetch=window.fetch,
          sUp=window.compressPhotoToDataUrl, sToast=window.toast, sErr=window.showServiceError,
          sSave=window.saveData, sGrid=window.renderGrid;
      try{
        await autoFetchUndoClear();
        window.toast=function(){}; window.showServiceError=function(){};
        window.saveData=function(){}; window.renderGrid=function(){};
        window.hydratePhotosFromIDB=function(){ return Promise.resolve(); };
        window.idbGetAll=function(){ return Promise.resolve([]); };
        window.askConfirm=function(){ return Promise.resolve(true); };
        window.photoSearchTerms=function(){ return Promise.resolve({ 0:'beef' }); };
        window.photoSearchOnce=function(){ return Promise.resolve([{ url:'https://x/p.jpg', credit:'C' }]); };
        // v36.24 — the bytes now come through the Worker, so the stub has to
          // answer like a real fetch: ok, a status, and an image content type.
          // A thinner stub sends fetchPhotoBlob down its fallback and then makes
          // the whole iteration throw, which would leave this test proving nothing.
          window.fetch=function(){ return Promise.resolve({ ok:true, status:200,
            headers:{ get:function(k){ return /content-type/i.test(k) ? 'image/jpeg' : null; } },
            blob:function(){ return Promise.resolve(new Blob(['x'],{type:'image/jpeg'})); } }); };
        window.compressPhotoToDataUrl=function(){ return Promise.resolve('data:image/jpeg;base64,FETCHED'); };
        recipes=[{ id:31, name:'blank one', photo:'' }];
        await autoFetchMissingPhotos();
        if(recipes[0].photo!=='data:image/jpeg;base64,FETCHED')
          throw new Error('the run did not apply a photo, so this proves nothing about the snapshot');
        var snap=await autoFetchUndoLoad();
        if(!snap||!snap.items.length)
          throw new Error('a completed run left NO snapshot — there is nothing to undo, which is the whole point of this release');
        if(snap.items[0].id!==31) throw new Error('the snapshot records the wrong recipe');
        if(snap.items[0].photo!=='')
          throw new Error('the snapshot recorded the NEW photo instead of what was there before, so undo would restore the stock picture');
      } finally {
        recipes=sR; window.hydratePhotosFromIDB=sHyd; window.idbGetAll=sAll; window.askConfirm=sAsk;
        window.photoSearchTerms=sTerms; window.photoSearchOnce=sOnce; window.fetch=sFetch;
        window.compressPhotoToDataUrl=sUp; window.toast=sToast; window.showServiceError=sErr;
        window.saveData=sSave; window.renderGrid=sGrid;
        await autoFetchUndoClear();
      }

      // 4. Undo puts back BOTH kinds of "before": a real photo, and none at all.
      var uR=recipes, uToast=window.toast, uAsk=window.askConfirm, uSave=window.saveData,
          uGrid=window.renderGrid;
      try{
        window.toast=function(){}; window.saveData=function(){}; window.renderGrid=function(){};
        window.askConfirm=function(){ return Promise.resolve(true); };
        recipes=[{ id:21, name:'was blank', photo:'data:image/jpeg;base64,STOCK1', photoCredit:{name:'X'} },
                 { id:22, name:'was mine',  photo:'data:image/jpeg;base64,STOCK2', photoCredit:{name:'Y'} }];
        await autoFetchUndoSave([{ id:21, name:'was blank', photo:'', originalPhoto:'', credit:null },
                                 { id:22, name:'was mine', photo:'data:image/jpeg;base64,MINE', originalPhoto:'', credit:null }]);
        await undoAutoFetch();
        if(recipes[0].photo!=='')
          throw new Error('undo left a stock photo on a recipe that had none before — it must go back to blank, not keep the picture');
        if(recipes[0].photoCredit) throw new Error('undo kept a credit describing a photo that is gone');
        if(recipes[1].photo!=='data:image/jpeg;base64,MINE')
          throw new Error("undo did not put back the user's own photograph");
        if(await autoFetchUndoLoad()) throw new Error('the snapshot survived the undo, so pressing it twice would undo something else');
      } finally {
        recipes=uR; window.toast=uToast; window.askConfirm=uAsk;
        window.saveData=uSave; window.renderGrid=uGrid;
        await autoFetchUndoClear();
      }
    } },

  { id:'photo_never_overwrites', group:'Features', name:'Auto-fetch never touches a recipe that already has a photo (5g.2)',
    test: async()=>{
      if(typeof recipesWithNoPhoto!=='function') throw new Error('recipesWithNoPhoto not defined');
      var savedRecipes=recipes, realHyd=window.hydratePhotosFromIDB, realAll=window.idbGetAll;
      try{
        window.hydratePhotosFromIDB=function(){ return Promise.resolve(); };

        // THE INCIDENT. r.photo is empty in memory for every recipe whose photo
        // lives in IndexedDB and has not hydrated yet — the normal state for a
        // second or two after every load. The old test was `!r.photo`, so those
        // counted as "missing" and were overwritten. Real photos were destroyed.
        recipes=[
          { id:1, name:'hydrated',      photo:'data:image/jpeg;base64,AAA' },
          { id:2, name:'in IDB, flagged', photo:'', _ph:1 },
          { id:3, name:'original in IDB', photo:'', _po:1 },
          { id:4, name:'in IDB, unflagged', photo:'' },
          { id:5, name:'genuinely bare', photo:'' },
          { id:6, name:'a clip',        photo:'', isClip:true }
        ];
        window.idbGetAll=function(){ return Promise.resolve([{ id:4, photo:'data:image/jpeg;base64,BBB' }]); };
        var missing=await recipesWithNoPhoto();
        var names=missing.map(function(r){ return r.name; });
        if(names.indexOf('in IDB, flagged')>-1)
          throw new Error('a recipe whose photo is in IndexedDB was judged missing — this is exactly what destroyed real photos');
        if(names.indexOf('original in IDB')>-1) throw new Error('a recipe with an original photo in IDB was judged missing');
        if(names.indexOf('in IDB, unflagged')>-1)
          throw new Error('the IDB row was never consulted, so a photo present on disk was judged missing');
        if(names.indexOf('hydrated')>-1) throw new Error('a recipe with a photo in memory was judged missing');
        // v33.9 — a clip with no photo IS a candidate. It was excluded on the
        // assumption that a video card should not carry a photograph, which the
        // card template never agreed with: it has always rendered r.photo for
        // clips. The exclusion only made a clip the one thing you could not get
        // a picture for.
        if(names.indexOf('a clip')===-1)
          throw new Error('a clip with no photo was skipped — clips can have photos, so it is a candidate like any other');
        if(names.length!==2||names.indexOf('genuinely bare')===-1)
          throw new Error('expected the bare recipe and the bare clip, got: '+names.join(', '));

        // If the photo store cannot be READ, there is no safe way to tell what is
        // missing — so fetch nothing rather than risk overwriting everything.
        window.idbGetAll=function(){ return Promise.reject(new Error('IDB unavailable')); };
        if(await recipesWithNoPhoto()!==null)
          throw new Error('an unreadable photo store did not stop the run — it would guess, and guessing overwrites');

        // The last-line guard in the FETCH LOOP, driven for real. This used to be
        // `String(autoFetchMissingPhotos).indexOf('r.photo || r._ph || r._po')`,
        // which is satisfied by the text alone: wrapping the guard in `if (false &&
        // ...)` left the suite fully green while the exact incident that destroyed
        // Tony's photos was live again. Proven by mutation, v34.1.
        //
        // The scenario: the list is chosen, then hydration or a cloud attach lands
        // seconds later while a download is in flight. Whatever the list said, a
        // recipe that has a photo NOW must not be overwritten.
        window.hydratePhotosFromIDB=function(){ return Promise.resolve(); };
        window.idbGetAll=function(){ return Promise.resolve([]); };
        recipes=[{ id:501, name:'Late arrival', photo:'' }];
        var realConfirm=window.askConfirm, realTerms=window.photoSearchTerms,
            realOnce=window.photoSearchOnce, realUpload=window.compressPhotoToDataUrl,
            realFetch=window.fetch, realToast=window.toast, realErr=window.showServiceError,
            realSave=window.saveData, realRG=window.renderGrid;
        try{
          window.toast=function(){}; window.showServiceError=function(){};
          window.saveData=function(){}; window.renderGrid=function(){};
          window.askConfirm=function(){ return Promise.resolve(true); };
          window.photoSearchTerms=function(){ return Promise.resolve({ 0:'late arrival' }); };
          window.photoSearchOnce=function(){ return Promise.resolve([{ url:'https://x/p.jpg', credit:'A' }]); };
          // v36.24 — the bytes now come through the Worker, so the stub has to
          // answer like a real fetch: ok, a status, and an image content type.
          // A thinner stub sends fetchPhotoBlob down its fallback and then makes
          // the whole iteration throw, which would leave this test proving nothing.
          window.fetch=function(){ return Promise.resolve({ ok:true, status:200,
            headers:{ get:function(k){ return /content-type/i.test(k) ? 'image/jpeg' : null; } },
            blob:function(){ return Promise.resolve(new Blob(['x'],{type:'image/jpeg'})); } }); };
          // The photo lands DURING the fetch — exactly the race the guard exists for.
          window.compressPhotoToDataUrl=function(){
            recipes[0].photo='data:image/jpeg;base64,ARRIVED';
            return Promise.resolve('https://stock/photo.jpg');
          };
          await autoFetchMissingPhotos();
          if(recipes[0].photo!=='data:image/jpeg;base64,ARRIVED')
            throw new Error('a photo that arrived mid-run was overwritten with the stock one — this is the incident that destroyed real photographs');

          // ...and when it DOES apply a photo, the credit must come with it.
          // Openverse is Creative Commons: attribution is a licence CONDITION,
          // and an empty credit is a false claim of compliance. Grepping
          // autoFetchMissingPhotos for 'photoCreditOf' passes with the call
          // wrapped in a ternary that never runs (proved by mutation, v34.1).
          recipes=[{ id:502, name:'Needs a photo', photo:'' }];
          window.photoSearchOnce=function(){ return Promise.resolve([
            { url:'https://x/p.jpg', credit:'Jane Photographer', creditUrl:'https://x/jane',
              license:'CC-BY', sourceLabel:'Openverse' }]); };
          window.compressPhotoToDataUrl=function(){ return Promise.resolve('https://stock/photo.jpg'); };
          await autoFetchMissingPhotos();
          if(!recipes[0].photo) throw new Error('the auto-fetch applied no photo at all');
          if(!recipes[0].photoCredit || !recipes[0].photoCredit.name)
            throw new Error('an auto-fetched photo was stored crediting nobody — on a CC-BY source that is a licence breach, not a cosmetic gap');
          if(recipes[0].photoCredit.name!=='Jane Photographer')
            throw new Error('the credit names the wrong person: '+JSON.stringify(recipes[0].photoCredit));
        } finally {
          window.askConfirm=realConfirm; window.photoSearchTerms=realTerms;
          window.photoSearchOnce=realOnce; window.compressPhotoToDataUrl=realUpload;
          window.fetch=realFetch; window.toast=realToast; window.showServiceError=realErr;
          window.saveData=realSave; window.renderGrid=realRG;
        }
      } finally {
        recipes=savedRecipes; window.hydratePhotosFromIDB=realHyd; window.idbGetAll=realAll;
      }
    } },

  { id:'cloud_photo_docid', group:'Cloud Sync', name:'The photo document name has ONE builder, and the range follows it (5g.4)',
    test: async()=>{
      if(typeof photoDocId!=='function') throw new Error('photoDocId not defined');
      // The wire format is pinned LITERALLY and on purpose: every photo document
      // already in the cloud is named this way, so a rename does not migrate
      // anything — it orphans the lot. This assertion must not go through
      // photoDocId, or it would follow a rename instead of catching it.
      if(photoDocId(7)!=='photo_7')
        throw new Error('the photo document name changed to "'+photoDocId(7)+'" — every photo already in the cloud is stored under the old name');

      // The bounds must BRACKET what the builder produces. They were written out
      // by hand; if a prefix ever drifted from them the bulk read would not see
      // those documents, would still report complete, and would clear _ph.
      [0, 7, 42, 999999, 'legacy-19'].forEach(function(id){
        var name=photoDocId(id);
        if(!(name>=PHOTO_DOC_LO && name<PHOTO_DOC_HI))
          throw new Error('the range ['+PHOTO_DOC_LO+', '+PHOTO_DOC_HI+') does not cover '+name+' — that photo would be invisible to the bulk read');
      });
      // ...and exclude every other family sharing the collection, or the read
      // would parse recipes and chats as photo documents.
      ['meta','access','recipe_7','chat_x','chatpart_x_1','photo'].forEach(function(name){
        if(name>=PHOTO_DOC_LO && name<PHOTO_DOC_HI)
          throw new Error('the photo range swallows "'+name+'", which is not a photo document');
      });

      // The builder must be the only speller left. A hand-written copy is how the
      // prefix drifts from the bounds in the first place. Scoped to these three
      // function bodies, not the page source, so it cannot match its own text.
      var appSrc=String(syncCloudPhotos)+String(attachCloudPhotos)+String(readCloudPhotoDocs);
      if(appSrc.indexOf("'photo_'")!==-1 || appSrc.indexOf('"photo_"')!==-1)
        throw new Error('a photo document name is still spelled out by hand — it can drift from the range bounds silently');
    } },

  { id:'cloud_undo_delete', group:'Cloud Sync', name:'Undo takes the cloud deletion back off the queue (5g.4)',
    test: async()=>{
      ['queueCloudDelete','unqueueCloudDelete','undoDelete'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var savedRecipes=recipes, savedUndo=window._pendingUndo, savedRaw=localStorage.getItem('tonys_cloud_deletes');
      var realSave=window.saveData, realRF=window.renderFilters, realRG=window.renderGrid, realToast=window.toast;
      try{
        window.saveData=function(){}; window.renderFilters=function(){};
        window.renderGrid=function(){}; window.toast=function(){};
        function queued(){ try{ return (JSON.parse(localStorage.getItem('tonys_cloud_deletes')||'[]')||[]).map(String); }catch(e){ return []; } }

        // Driven through undoDelete — the route the ↩︎ Undo button uses. Calling
        // unqueueCloudDelete directly would leave the button free to stop calling
        // it, which is exactly the defect that matters: the recipe returns on
        // screen while the cloud copy is still condemned, so it vanishes again
        // everywhere else and comes back to haunt this device on the next sync.
        recipes=[];
        queueCloudDelete(77);
        if(queued().indexOf('77')===-1)
          throw new Error('the deletion was never queued, so nothing below proves anything about un-queueing');
        window._pendingUndo={ items:[{ idx:0, recipe:{ id:77, name:'Brought back' } }] };
        undoDelete();
        if(queued().indexOf('77')!==-1)
          throw new Error('Undo restored the recipe locally but left it queued for cloud deletion — it would still be deleted for every other device');
        if(!recipes.some(function(r){ return r.id===77; }))
          throw new Error('Undo did not restore the recipe at all');

        // Un-queueing one must not drop the others: an unrelated pending deletion
        // has to survive, or it never reaches the cloud and the recipe returns.
        recipes=[];
        queueCloudDelete(88); queueCloudDelete(99);
        window._pendingUndo={ items:[{ idx:0, recipe:{ id:88, name:'Also back' } }] };
        undoDelete();
        var q2=queued();
        if(q2.indexOf('99')===-1)
          throw new Error('undoing one deletion dropped an unrelated pending one, which would then never reach the cloud');
        if(q2.indexOf('88')!==-1) throw new Error('the undone deletion is still queued');
      } finally {
        recipes=savedRecipes; window._pendingUndo=savedUndo;
        window.saveData=realSave; window.renderFilters=realRF;
        window.renderGrid=realRG; window.toast=realToast;
        try{ [77,88,99].forEach(function(k){ delete _pendingCloudDeletes[k]; delete _pendingCloudDeletes[String(k)]; }); }catch(e){}
        if(savedRaw===null) localStorage.removeItem('tonys_cloud_deletes');
        else localStorage.setItem('tonys_cloud_deletes', savedRaw);
      }
    } },

  { id:'cloud_photo_bulk', group:'Cloud Sync', name:'Cloud photos load in one query, not one round trip each (5g.3)',
    test: async()=>{
      if(typeof readCloudPhotoDocs!=='function') throw new Error('readCloudPhotoDocs not defined');
      var realDb=window._fbDb, realFb=window.firebase;
      try{
        // The range query needs FieldPath.documentId(). Without it the code
        // degrades to per-document reads — correct, but slow — so the stub has to
        // be present or this test silently measures the fallback instead.
        window.firebase={ firestore:{ FieldPath:{ documentId:function(){ return '__name__'; } } } };
        // 44 recipes, as Tony has. The old code awaited one document GET per
        // recipe, so the read took 44 consecutive round trips of a ~60 KB
        // document each and never finished inside the timeout — which is why
        // only 9 of his 44 recipes had a photo.
        var list=[], docs={};
        for(var i=1;i<=44;i++){
          list.push({ id:i, name:'r'+i, photo:'', _ph:1 });
          docs['photo_'+i]={ photo:'data:image/jpeg;base64,P'+i };
        }
        var rangeQueries=0, singleGets=0;
        window._fbDb={ collection:function(){ return {
          where:function(){ return this; },
          get:function(){
            rangeQueries++;
            var entries=Object.keys(docs).map(function(k){ return { id:k, data:function(){ return docs[k]; } }; });
            return Promise.resolve({ size:entries.length,
              forEach:function(fn){ entries.forEach(fn); } });
          },
          doc:function(id){ return { get:function(){
            singleGets++;
            return Promise.resolve({ exists:!!docs[id], data:function(){ return docs[id]; } });
          } }; }
        }; } };
        await attachCloudPhotos(list);
        if(singleGets>0)
          throw new Error(singleGets+' individual document reads were still made — that is the sequential loop that made the sync time out');
        if(rangeQueries!==1) throw new Error('expected exactly ONE bulk query, got '+rangeQueries);
        var withPhoto=list.filter(function(r){ return r.photo; }).length;
        if(withPhoto!==44) throw new Error('only '+withPhoto+' of 44 photos were attached');
        if(list.some(function(r){ return r._ph; })) throw new Error('a resolved photo kept its _ph flag');

        // A recipe with NO photo document must have its flag cleared — but only
        // because the bulk query genuinely saw everything.
        var l2=[{ id:99, name:'none', photo:'', _ph:1 }];
        await attachCloudPhotos(l2);
        if(l2[0]._ph) throw new Error('a recipe with no photo document kept its flag for ever');

        // The invariant that matters most: if the query FAILS, we do not know
        // what the cloud holds. Clearing _ph on that ignorance is how a network
        // blip becomes permanent photo loss.
        window._fbDb={ collection:function(){ return {
          where:function(){ return this; },
          get:function(){ return Promise.reject(new Error('offline')); },
          doc:function(){ return { get:function(){ return Promise.reject(new Error('offline')); } }; }
        }; } };
        var l3=[{ id:5, name:'x', photo:'', _ph:1 }];
        await attachCloudPhotos(l3);
        if(!l3[0]._ph)
          throw new Error('a failed read cleared _ph — the only record that a photo exists elsewhere, so the photo would be lost for good');
      } finally { window._fbDb=realDb; window.firebase=realFb; }
    } },

  { id:'sync_watchdog', group:'Cloud Sync', name:'A wedged sync is reported, never spun on for ever (5g.3)',
    test: async()=>{
      if(typeof withSyncWatchdog!=='function') throw new Error('withSyncWatchdog not defined');
      // A promise that settles normally must pass straight through, unchanged.
      if(await withSyncWatchdog(Promise.resolve('ok'),'read')!=='ok')
        throw new Error('a successful call did not pass through the watchdog');
      var threw=null;
      try{ await withSyncWatchdog(Promise.reject(new Error('real failure')),'write'); }
      catch(e){ threw=e; }
      if(!threw||threw.message!=='real failure') throw new Error('a real error was swallowed or replaced');
      if(threw._syncTimeout) throw new Error('a real error was mislabelled as a timeout');

      // The case that stranded Tony: a Firestore call that NEVER settles. Without
      // a watchdog the status pill says "Syncing…" for ever, which is the UI
      // asserting something nothing has verified.
      var realMs=window.SYNC_WATCHDOG_MS;
      try{
        window.SYNC_WATCHDOG_MS=60;
        // Rebuild the race against the shortened limit — the constant is read at
        // call time, so this exercises the real function, not a copy.
        var never=new Promise(function(){});
        var timedOut=null;
        try{ await withSyncWatchdog(never,'read'); } catch(e){ timedOut=e; }
        if(!timedOut) throw new Error('a call that never settles was awaited for ever — the pill would spin indefinitely');
        if(!timedOut._syncTimeout) throw new Error('the timeout is not flagged, so the caller cannot report it honestly');
        if(timedOut._syncPhase!=='read') throw new Error('the timeout does not say which phase hung');
      } finally { window.SYNC_WATCHDOG_MS=realMs; }

      // ...and the sign-in path must actually USE it. Checked by CALLING it with a
      // read that never settles. The previous version grepped the page source for
      // 'withSyncWatchdog(loadFromFirestore(' — and this test lives in that same
      // inline script, so the string matched ITSELF and the assertion passed with
      // the wiring removed. Mutation testing caught it.
      if(typeof signInCloudSync!=='function') throw new Error('signInCloudSync not defined');
      var realLoad=window.loadFromFirestore, realMs2=window.SYNC_WATCHDOG_MS;
      try{
        window.SYNC_WATCHDOG_MS=60;
        window.loadFromFirestore=function(){ return new Promise(function(){}); };   // never settles
        // Raced against a sentinel, because the failure under test is an await
        // that NEVER RETURNS: a bare `await signInCloudSync()` hangs the whole
        // suite rather than failing it, and a suite that prints no summary line
        // tells you nothing — the same shape as the CI that sat green for 19
        // releases while running nothing. A red line, not a hang.
        var hung=null, LATE={};
        var outcome=await Promise.race([
          signInCloudSync().then(function(){ return null; }, function(e){ hung=e; return null; }),
          new Promise(function(res){ setTimeout(function(){ res(LATE); }, 1500); })
        ]);
        if(outcome===LATE) throw new Error('the sign-in sync awaited a read that never settles — the pill would spin for ever');
        if(!hung) throw new Error('a read that never settles let the sign-in sync finish anyway');
        if(!hung._syncTimeout) throw new Error('the sign-in sync did not surface it as a timeout');
      } finally { window.loadFromFirestore=realLoad; window.SYNC_WATCHDOG_MS=realMs2; }

      // The WRITE half needs its own check — removing its watchdog survived a
      // mutation, because every assertion above stops at the read. It is also the
      // slower phase by far: this branch runs when the cloud is empty and the whole
      // local collection has to be pushed, which for Tony was ~1.7 MB of base64
      // photos. If anything is going to hang, it is this.
      var realLoad3=window.loadFromFirestore, realSave=window.saveToFirestore,
          realMs3=window.SYNC_WATCHDOG_MS, realRecipes=recipes, realToast=window.toast;
      try{
        window.SYNC_WATCHDOG_MS=60;
        window.toast=function(){};
        window.loadFromFirestore=function(){ return Promise.resolve(false); };  // nothing in the cloud yet
        window.saveToFirestore=function(){ return new Promise(function(){}); }; // ...and the push wedges
        // >5 recipes, or the push is skipped as not worth making a cloud copy for.
        recipes=[1,2,3,4,5,6,7].map(function(n){ return { id:n, name:'r'+n }; });
        var wedged=null, LATE2={};
        var out2=await Promise.race([
          signInCloudSync().then(function(){ return null; }, function(e){ wedged=e; return null; }),
          new Promise(function(res){ setTimeout(function(){ res(LATE2); }, 1500); })
        ]);
        if(out2===LATE2) throw new Error('the sign-in sync awaited a WRITE that never settles — the pill would spin for ever');
        if(!wedged) throw new Error('a write that never settles let the sign-in sync finish anyway');
        if(!wedged._syncTimeout) throw new Error('the wedged write was not surfaced as a timeout');
        if(wedged._syncPhase!=='write') throw new Error('a hung write was reported as phase "'+wedged._syncPhase+'" — the dialog would name the wrong half');
      } finally {
        window.loadFromFirestore=realLoad3; window.saveToFirestore=realSave;
        window.SYNC_WATCHDOG_MS=realMs3; recipes=realRecipes; window.toast=realToast;
      }

      // ...and the other side of that branch: a FRESH install signing in must not
      // push its five seed recipes to the cloud and call them the family
      // collection. Nothing tested the guard, so it could be deleted silently.
      // This is a negative assertion, so the count must be the ONLY reason nothing
      // is written — hence loaded:false (an empty cloud, which is what makes the
      // push eligible in the first place).
      var realLoad4=window.loadFromFirestore, realSave2=window.saveToFirestore,
          realRecipes2=recipes, realToast2=window.toast;
      try{
        window.toast=function(){};
        window.loadFromFirestore=function(){ return Promise.resolve(false); };
        var pushed=false;
        window.saveToFirestore=function(){ pushed=true; return Promise.resolve(); };
        recipes=[1,2,3].map(function(n){ return { id:n, name:'seed'+n }; });
        await signInCloudSync();
        if(pushed) throw new Error('a fresh install pushed its seed recipes to the cloud as if they were the real collection');

        // The push is for an EMPTY cloud only. After a successful load `recipes` is
        // already the merged cloud list, so pushing again writes back what was just
        // read — wasted writes on every single sign-in, and a "Saving your local
        // recipes to cloud..." toast each time saying something untrue.
        pushed=false;
        window.loadFromFirestore=function(){ return Promise.resolve(true); };
        recipes=[1,2,3,4,5,6,7].map(function(n){ return { id:n, name:'r'+n }; });
        await signInCloudSync();
        if(pushed) throw new Error('a successful load was followed by a push of the local list back over it');
      } finally {
        window.loadFromFirestore=realLoad4; window.saveToFirestore=realSave2;
        recipes=realRecipes2; window.toast=realToast2;
      }

      // The count must be taken BEFORE the load, not after. loadFromFirestore can
      // replace `recipes` with the cloud list and THEN return false from its catch
      // — a partial load that threw. Reading the count afterwards would measure the
      // cloud's recipes while deciding whether the LOCAL ones are worth saving, and
      // the collection this branch exists to protect would be judged by the size of
      // the thing that failed to load.
      var realLoad5=window.loadFromFirestore, realSave3=window.saveToFirestore,
          realRecipes3=recipes, realToast3=window.toast;
      try{
        window.toast=function(){};
        window.loadFromFirestore=function(){
          recipes=[{ id:900, name:'partial' }, { id:901, name:'partial2' }];  // replaced...
          return Promise.resolve(false);                                      // ...then failed
        };
        var pushed2=false;
        window.saveToFirestore=function(){ pushed2=true; return Promise.resolve(); };
        recipes=[1,2,3,4,5,6,7,8].map(function(n){ return { id:n, name:'mine'+n }; });
        await signInCloudSync();
        if(!pushed2) throw new Error('8 local recipes were not saved because the count was read after a failed load had already replaced them with 2');
      } finally {
        window.loadFromFirestore=realLoad5; window.saveToFirestore=realSave3;
        recipes=realRecipes3; window.toast=realToast3;
      }
    } },

  { id:'photo_rescue', group:'Backup', name:'Photos can be restored from a backup without losing newer recipes (5g.2)',
    test: async()=>{
      ['rescueResolvePhotos','rescuePlan','openPhotoRescue','runPhotoRescue'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(!document.getElementById('photoRescueItem')) throw new Error('no menu entry to reach the rescue tool');
      if(!document.getElementById('photoRescueFile')) throw new Error('no file input for the rescue tool');

      // Real backup shape: photos are de-duplicated into a map and referenced as
      // __photo__N. Reading them back wrongly would silently restore nothing.
      var backup={ exportedAt:'2026-08-15T14:39:11.700Z',
        photos:{ '0':'data:image/jpeg;base64,ORIGINAL0', '1':'data:image/jpeg;base64,ORIGINAL1' },
        recipes:[ { uid:'legacy-19', id:19, name:'Brisket', photo:'__photo__0' },
                  { uid:'legacy-20', id:20, name:'Biltong', photo:'__photo__1' },
                  { uid:'legacy-21', id:21, name:'No photo here', photo:'' } ] };
      var have=rescueResolvePhotos(backup);
      if(have.length!==2) throw new Error('expected 2 recipes with photos, got '+have.length);
      if(have[0].photo!=='data:image/jpeg;base64,ORIGINAL0')
        throw new Error('the __photo__N reference was not resolved to the real image: '+have[0].photo);

      // The collection now: two damaged by the auto-fetch, plus recipes added
      // AFTER the backup which must not be disturbed in any way.
      var now=[
        { id:19, uid:'legacy-19', name:'Brisket', photo:'https://cdn/wrong1.jpg', photoCredit:{name:''} },
        { id:20, uid:'legacy-20', name:'Biltong', photo:'https://cdn/wrong2.jpg' },
        { id:99, uid:'new-99',    name:'Added last week', photo:'data:image/jpeg;base64,MINE' }
      ];
      var plan=rescuePlan(have, now);
      if(plan.restore.length!==2) throw new Error('expected to restore 2, planned '+plan.restore.length);
      if(plan.noMatch.length!==1||plan.noMatch[0]!=='Added last week')
        throw new Error('a recipe absent from the backup was not reported as untouched');
      if(plan.restore.some(function(p){ return p.id===99; }))
        throw new Error('a recipe added after the backup would be overwritten — that is the whole thing this must not do');

      // Identity first: a RENAMED recipe still matches on uid, and must not be
      // matched by name to something else.
      var renamed=[{ id:19, uid:'legacy-19', name:'Brisket, my way', photo:'https://cdn/wrong1.jpg' }];
      var p2=rescuePlan(have, renamed);
      if(p2.restore.length!==1||p2.restore[0].photo!=='data:image/jpeg;base64,ORIGINAL0')
        throw new Error('a renamed recipe was not matched by its stable uid');
      if(p2.byName.length) throw new Error('a uid match was wrongly reported as a name match');

      // A name-only match is the one that can be wrong, so it must be FLAGGED.
      var noIds=[{ id:501, uid:'unknown-501', name:'Brisket', photo:'https://cdn/wrong1.jpg' }];
      var p3=rescuePlan(have, noIds);
      if(!p3.byName.length) throw new Error('a name-only match was not flagged for the user to check');

      // Nothing to do is said plainly, not reported as a restore.
      var same=[{ id:19, uid:'legacy-19', name:'Brisket', photo:'data:image/jpeg;base64,ORIGINAL0' }];
      var p4=rescuePlan(have, same);
      if(p4.restore.length) throw new Error('an identical photo was counted as needing restoring');
      if(p4.already.length!==1) throw new Error('an already-correct photo was not reported as such');

      // ...and the RESTORE must reach the cloud, driven end to end. This is the
      // whole fix for photos "coming back wrong" days later: the cloud wins on
      // every load, saveData's cloud write is debounced and fire-and-forget, so
      // reporting success without pushing was a claim nobody had checked.
      var rR=recipes, rDb=window._fbDb, rUser=window._fbUser, rAsk=window.askConfirm,
          rSave=window.saveData, rGrid=window.renderGrid, rToast=window.toast,
          rErr=window.showServiceError, rStamps=window._cloudPhotoStamps, rIds=window._cloudPhotoIds,
          cloudWrites={}, report='';
      try{
        window.saveData=function(){}; window.renderGrid=function(){}; window.toast=function(){};
        window.showServiceError=function(m){ report=String(m||''); };
        window.askConfirm=function(){ return Promise.resolve(true); };
        window._fbUser={ uid:'t' }; window._cloudPhotoStamps={}; window._cloudPhotoIds={};
        window._fbDb={ collection:function(){ return { doc:function(id){ return {
          set:function(payload){ cloudWrites[id]=payload; return Promise.resolve(); }
        }; } }; } };
        recipes=[{ id:19, uid:'legacy-19', name:'Brisket', photo:'https://cdn/wrong1.jpg' }];
        var file=new File([JSON.stringify(backup)], 'b.json', { type:'application/json' });
        await runPhotoRescue(file);
        if(recipes[0].photo!=='data:image/jpeg;base64,ORIGINAL0')
          throw new Error('the rescue did not restore the photo locally');
        if(!cloudWrites['photo_19'])
          throw new Error('the restore never reached the cloud — the cloud wins on the next load, so the wrong photo comes straight back');
        if(cloudWrites['photo_19'].photo!=='data:image/jpeg;base64,ORIGINAL0')
          throw new Error('the cloud was written with the wrong bytes: '+JSON.stringify(cloudWrites['photo_19']));
        if(report.indexOf('cloud')===-1)
          throw new Error('the report says nothing about the cloud, so the user cannot tell whether the fix will stick');

        // Not signed in: it must SAY the cloud still holds the old photos rather
        // than reporting a clean success it has not earned.
        cloudWrites={}; report='';
        window._fbUser=null; window._fbDb=null;
        recipes=[{ id:19, uid:'legacy-19', name:'Brisket', photo:'https://cdn/wrong1.jpg' }];
        await runPhotoRescue(new File([JSON.stringify(backup)], 'b.json', { type:'application/json' }));
        if(report.indexOf('Not signed in')===-1)
          throw new Error('a restore with no cloud connection did not warn that the cloud still holds the old photos');
      } finally {
        recipes=rR; window._fbDb=rDb; window._fbUser=rUser; window.askConfirm=rAsk;
        window.saveData=rSave; window.renderGrid=rGrid; window.toast=rToast;
        window.showServiceError=rErr; window._cloudPhotoStamps=rStamps; window._cloudPhotoIds=rIds;
      }
    } },

  { id:'photo_hebrew_terms', group:'Features', name:'A Hebrew recipe name becomes a searchable English dish (5g.1)',
    test: async()=>{
      ['photoQueryFromName','photoTermIsUsable','photoAttemptPlan','photoSearchTerms']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      // An image library has no picture of whose recipe it is or how quick it is.
      // "עוגת השוקולד של סבתא רבקה" is not a subject; "עוגת השוקולד" is.
      var c=photoQueryFromName('עוגת השוקולד של סבתא רבקה');
      if(/סבתא|רבקה|\bשל\b/.test(c)) throw new Error('the family attribution survived into the search term: '+c);
      if(c.indexOf('עוגת')===-1) throw new Error('the dish itself was stripped out: '+c);
      var e=photoQueryFromName("Grandma's BEST homemade chicken soup recipe 🍲");
      if(/grandma|best|homemade|recipe/i.test(e)) throw new Error('English noise words survived: '+e);
      if(!/chicken soup/i.test(e)) throw new Error('the dish was lost: '+e);
      if(/[\u{1F300}-\u{1FAFF}]/u.test(e)) throw new Error('an emoji survived into the query: '+e);

      // What comes back from the AI must be CHECKED. A refusal, a preamble or a
      // truncated reply used to go straight into the query.
      if(!photoTermIsUsable('chicken soup')) throw new Error('a good term was rejected');
      if(photoTermIsUsable('עוגת שוקולד'))
        throw new Error('an untranslated Hebrew term was accepted — the libraries do not read Hebrew, which is the whole point');
      if(photoTermIsUsable("I'm sorry, I cannot help with that"))
        throw new Error('a refusal was accepted as a search term');
      if(photoTermIsUsable('Here is the English name: chicken soup'))
        throw new Error('a preamble was accepted as a search term');
      if(photoTermIsUsable('')) throw new Error('an empty term was accepted');
      if(photoTermIsUsable('a very long string of words that is clearly a sentence and not a dish name'))
        throw new Error('a sentence was accepted as a search term');

      // The ladder must try EVERY source, keyless one first. Searching only the
      // default source meant an unset PIXABAY_API_KEY read as "no pictures exist"
      // for the entire collection.
      var plan=photoAttemptPlan('chicken soup','Dinner');
      if(!plan.length) throw new Error('no attempts are planned at all');
      if(plan[0].source!==PHOTO_SOURCES[0])
        throw new Error('the first attempt is not the keyless source, so an unconfigured key kills every search');
      var srcs={}; plan.forEach(function(p){ srcs[p.source]=1; });
      PHOTO_SOURCES.forEach(function(sname){
        if(!srcs[sname]) throw new Error('source '+sname+' is never tried, so its pictures are unreachable');
      });
      if(!plan.some(function(p){ return p.q!=='chicken soup'; }))
        throw new Error('there is no broader fallback when the exact dish finds nothing');
      // ...and it must NOT bolt "food recipe" onto an already-specific dish: stock
      // libraries match on tags, and the extra words find nothing.
      if(plan[0].q!=='chicken soup') throw new Error('the first attempt is not the plain dish term: '+plan[0].q);

      // The credit record. Every source returns `credit`/`creditUrl`; the
      // auto-fetch guessed `author`/`sourceUrl` and so wrote a credit naming
      // nobody. For Openverse that is worse than none: CC-BY makes attribution a
      // licence CONDITION, and an empty name asserts compliance falsely.
      if(typeof photoCreditOf!=='function') throw new Error('photoCreditOf not defined');
      var ov=photoCreditOf({ credit:'Jane Doe', creditUrl:'https://openverse.org/x',
                             license:'CC-BY 4.0', sourceLabel:'Openverse' });
      if(!ov) throw new Error('a photo with a named creator produced no credit at all');
      if(ov.name!=='Jane Doe') throw new Error('the creator was lost: '+JSON.stringify(ov));
      if(ov.url!=='https://openverse.org/x') throw new Error('the credit link was lost: '+ov.url);
      if(ov.license!=='CC-BY 4.0'||ov.source!=='Openverse') throw new Error('licence or source lost');
      // Nothing to credit → nothing written, so no empty attribution is stored.
      if(photoCreditOf({ license:'Pixabay licence', sourceLabel:'Pixabay' })!==null)
        throw new Error('a credit was invented for a photo with no named creator');
      if(photoCreditOf(null)!==null) throw new Error('a missing image produced a credit');
      // Both the picker and the auto-fetch must go through it, or they drift and
      // one of them silently stops honouring the licence. That the auto-fetch
      // actually STORES a credit is asserted behaviourally in
      // photo_never_overwrites, which drives the real fetch — grepping
      // autoFetchMissingPhotos for 'photoCreditOf' passed with the call wrapped
      // in a ternary that never ran (proved by mutation, v34.1).

      // One AI call for the whole batch, and an English name needs none at all.
      var realAi=window.aiCall, calls=0;
      try{
        window.aiCall=function(){ calls++; return Promise.resolve('["chicken soup","beef stew"]'); };
        var out=await photoSearchTerms(['מרק עוף של אמא','נזיד בקר']);
        if(calls!==1) throw new Error('expected ONE batched call for two names, got '+calls);
        if(out[0]!=='chicken soup'||out[1]!=='beef stew') throw new Error('the batched answers were not applied in order');
        calls=0;
        await photoSearchTerms(['Chicken soup','Beef stew']);
        if(calls!==0) throw new Error('English names still cost an AI call');
        // A failed or refused translation must fall back to the cleaned name,
        // never leave the query in Hebrew.
        calls=0;
        window.aiCall=function(){ return Promise.reject(new Error('boom')); };
        var fb=await photoSearchTerms(['מרק עוף של אמא']);
        if(!fb[0]) throw new Error('a failed translation produced no term at all');
        if(/של|אמא/.test(fb[0])) throw new Error('the fallback kept the noise words: '+fb[0]);

        // The validation has to be applied AT THE CALL SITE, not merely exist.
        // Checked by feeding photoSearchTerms junk, because asserting on
        // photoTermIsUsable alone left photoSearchTerms free to stop calling it —
        // which is exactly what a mutation showed, for the fourth time in this
        // file. Every one of these must be REJECTED and fall back to the cleaned
        // Hebrew-free-ish name rather than being pasted into a photo query.
        var junk=[
          ['["I\'m sorry, I cannot translate that"]','a refusal'],
          ['["Here is the English name: chicken soup"]','a preamble'],
          ['["מרק עוף"]','an untranslated Hebrew answer'],
          ['["a very long sentence that is plainly not a dish name at all here"]','a sentence'],
          ['[""]','an empty answer'],
          ['[null]','a null answer']
        ];
        for(var ji=0;ji<junk.length;ji++){
          (function(payload){ window.aiCall=function(){ return Promise.resolve(payload); }; })(junk[ji][0]);
          var got=(await photoSearchTerms(['מרק עוף של אמא']))[0];
          if(!got) throw new Error(junk[ji][1]+' left no term at all');
          if(got.indexOf('sorry')>-1||got.indexOf('Here is')>-1||got.length>40)
            throw new Error(junk[ji][1]+' was accepted as a search term: "'+got+'"');
        }
      } finally { window.aiCall=realAi; }
    } },

  { id:'wa_link_classify', group:'WhatsApp', name:'Shops, sign-ups and invites are hidden; recipes are not (5f.11)',
    test: async()=>{
      if(typeof waClassifyLink!=='function') throw new Error('waClassifyLink not defined');
      // Every one of these is a real row from Tony's own 969-link harvest. The
      // first version flagged only invites and maps, so the top of his list was
      // workshop sign-ups, AliExpress gadgets and bank notices — 62 dismissed by
      // hand before he asked for this.
      var NOISE=[
        ['https://did.li/zO4rl','נשארו מקומות אחרונים לסדנאות גריל, והרשמה בקישור הזה'],
        ['https://tidycal.com/drormamalia/grillworkshop',''],
        ['https://popup.fm/dror-mamalia?event_id=deTVLPQR5IRrZyCMxXXC','לא לשכוח להירשם לשידור החי'],
        ['https://meatbalcony.co.il/product/%d7%a1%d7%93%d7%a0%d7%aa/','הזדמנות אחרונה להירשם'],
        ['https://a.aliexpress.com/_c417uxSl','I just found this on AliExpress: ₪6.41 | Meat Shredder Claws'],
        ['https://a.co/d/gQFAUIS','מיטר פלוס ב-70 דולר'],
        ['https://inkbird.com/products/wifi-bluetooth-meat-thermometer-int-14-bw',''],
        ['https://ksp.co.il/item/16697-338588',''],
        ['https://chat.whatsapp.com/LKOj6yh6dRN6Yq80w1559m?mode=gi_t',''],
        ['https://t.me/haregakaniti','בחצי מחיר'],
        ['https://maps.app.goo.gl/5naJpB4ttxMSPg2G8','הוד השרון'],
        ['https://waze.com/ul/hsvc43hq9s','drive here using Waze'],
        ['https://rozinante2004-hash.github.io/tonys-recipes',''],
        ['https://api.github.com/repos/rozinante2004-hash/tonys-recipes/contents/whatsapp/',''],
        ['https://buyme.co.il/W2i8qm57ko988j','זכית בשובר BUYME בשווי 75 ₪'],
        ['https://go.gov.il/Hodaot','ממתינה לך הודעה ברשות המסים'],
        ['https://askubuntu.com/questions/38566/hard-drive',''],
        ['https://chatgpt.com/share/6929c061-c664-8010-8882-b6860b369330',''],
        ['https://www.instagram.com/the.knife.dr?igsh=NXlqbXF2OXV6Z3hw',''],
        ['https://youtube.com/@crazebiltongandsausages','שלום חברים, שמי רז'],
        ['https://share.temu.com/uOtE5fgjckA',''],
        ['https://x.com/rainmaker1973/status/1631317449768329217',''],
        ['https://docs.google.com/forms/d/e/1FAIpQLSd9/viewform','למילוי הסקר'],
        ['https://amzn.to/4vkuaj6','ב-42 ש"ח בלבד כולל משלוח חינם'],
        // These two are caught by the MESSAGE alone — bit.ly and an unknown shop
        // are not on any domain list, and could be anything. Without them the
        // promo rule was dead code that no test could see.
        ['http://bit.ly/4j62UQP','התפנה מקום אחד בסדנת גריל גז הערב 19:00 תל מונד, לפרטים והרשמה'],
        ['https://someshop.example/x/1','קופון בשווי 800 ₪ לרכישת גריל גז 3 מבערים, מבצע לזמן מוגבל']
      ];
      var KEEP=[
        ['https://twoguysandacooler.com/biltong/','מתכון מעולה שתמיד מצליח לי'],
        ['https://www.hashulchan.co.il/%D7%9E%D7%AA%D7%9B%D7%95%D7%A0%D7%99%D7%9D/x/',''],
        ['https://food.walla.co.il/item/3533603?utm_source=whatsup','כתבה מוואלה! - כרוב ממולא עם בשר טחון'],
        ['https://www.ketofocus.com/recipes/keto-carnivore-braised-short-ribs/',''],
        ['https://mazon-izun.com/recipes/home-made-salami/',''],
        ['https://www.goodlifetv.co.il/food/carbonara/',''],
        ['https://youtu.be/rJDYHr6D_wY','הנה עוד וריאציה עם אוסובוקו בסו ויד'],
        ['https://www.instagram.com/reel/DPyJb51CPHV/','לחמניית עוף'],
        ['https://youtube.com/shorts/DssxlU_qCMU?si=iRa',''],
        ['https://www.facebook.com/reel/642531595088907','מיונז ביצים קשות'],
        ['https://share.google/4wf6jGt1ps21tcjFX','Source: גולאש הונגרי קלאסי | השולחן']
      ];
      var wrong=[];
      NOISE.forEach(function(c){ if(!waClassifyLink(c[0],c[1]).noise) wrong.push('kept noise: '+c[0].slice(0,60)); });
      KEEP.forEach(function(c){ if(waClassifyLink(c[0],c[1]).noise) wrong.push('hid a recipe: '+c[0].slice(0,60)); });
      if(wrong.length) throw new Error(wrong.length+' misclassified — '+wrong.slice(0,3).join(' | '));

      // The rescue rule is what makes the whole thing safe: a shop domain with
      // recipe words around it is kept, because a false negative loses a recipe
      // while a false positive costs one checkbox tick.
      if(waClassifyLink('https://ksp.co.il/item/12345','מתכון מעולה, ככה מכינים').noise)
        throw new Error('a recipe shared from a shop domain was hidden anyway — the rescue rule is not working');
      // ...and /item/ must NOT be a blanket noise path, or Walla's recipes vanish.
      if(waClassifyLink('https://food.walla.co.il/item/3515904','').noise)
        throw new Error('a generic /item/ rule is hiding a recipe site');
      // Nothing is deleted — noise is a flag the UI hides behind a checkbox.
      // Noise must be HIDDEN behind a filter, never dropped: a misclassification
      // has to be recoverable by unticking the box, or classifying would destroy
      // links rather than tidy them. Rendered for real — grepping
      // renderWaHarvest for 'hideNoise' survives the filter being dead (v34.1).
      var hnKeep=_waHarvest;
      try{
        // The real row shape: key, count and a shares array. A link without
        // `shares` throws inside the renderer, which is how this fixture failed
        // on its first run — the shape has to be read, not assumed.
        _waHarvest={ links:[
                       { key:'recipes.example/good', url:'https://recipes.example/good',
                         domain:'recipes.example', count:1, noise:false,
                         shares:[{ who:'A', date:'01/02', text:'try this' }] },
                       { key:'shop.example/buy', url:'https://shop.example/buy',
                         domain:'shop.example', count:1, noise:true,
                         shares:[{ who:'B', date:'01/02', text:'50% off' }] }],
                     texts:[], loaded:true, hideImported:false, hideNoise:true, tab:'links',
                     selected:{}, dismissed:{} };
        renderWaHarvest();
        var body=document.getElementById('waLinksBody');
        if(!body) throw new Error('the harvest panel has no body element');
        if(body.textContent.indexOf('shop.example')>-1)
          throw new Error('a link classified as noise is shown even with the filter ON, so the filter does nothing');
        if(body.textContent.indexOf('recipes.example')===-1)
          throw new Error('the filter hid a real recipe link as well');
        // Unticking must bring it back — that is what makes classification safe.
        _waHarvest.hideNoise=false;
        renderWaHarvest();
        if(body.textContent.indexOf('shop.example')===-1)
          throw new Error('a noise link is GONE rather than hidden — a misclassification would be unrecoverable');
      } finally { _waHarvest=hnKeep; }
    } },

  { id:'wa_seen', group:'WhatsApp', name:'Viewed and Imported are marked, and Imported is never claimed falsely (5f.11)',
    test: async()=>{
      ['waSeenState','waToggleViewed','waMarkImported'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var savedH=_waHarvest, savedSave=window.waHarvestSave;
      try{
        window.waHarvestSave=function(){ return Promise.resolve(true); };
        _waHarvest={ links:[{key:'a.com/1',url:'https://a.com/1',domain:'a.com',count:1,shares:[]},
                            {key:'a.com/2',url:'https://a.com/2',domain:'a.com',count:1,shares:[],imported:true,importedAs:'X'}],
                     texts:[{text:'מיונז ביתי עם ביצה ושמן',score:70,signals:['x'],who:'Y'}],
                     loaded:true, hideImported:false, hideNoise:true, tab:'links',
                     selected:{}, dismissed:{}, numbering:{}, seen:{} };
        if(waSeenState('link',_waHarvest.links[0])!=='') throw new Error('a fresh row is not blank');
        waToggleViewed('link',0);
        if(waSeenState('link',_waHarvest.links[0])!=='viewed') throw new Error('the eye did not mark it viewed');
        waToggleViewed('link',0);
        if(waSeenState('link',_waHarvest.links[0])!=='') throw new Error('the eye does not toggle back off');

        // A link already in the collection reads as Imported without any tapping.
        if(waSeenState('link',_waHarvest.links[1])!=='imported')
          throw new Error('a link already in the collection is not shown as imported');

        // "Imported" is set by the IMPORTER, never by the eye, so the app cannot
        // claim an import that never happened — the honesty rule.
        waMarkImported({kind:'text',text:'מיונז ביתי עם ביצה ושמן'});
        if(waSeenState('text',_waHarvest.texts[0])!=='imported')
          throw new Error('a completed import did not mark the row');
        waToggleViewed('text',0);
        if(waSeenState('text',_waHarvest.texts[0])!=='imported')
          throw new Error('the eye downgraded a real import to "viewed"');

        // It must survive a rescan: keyed by content, like every other mark.
        if(waSeenState('text',{text:'מיונז ביתי עם ביצה ושמן'})!=='imported')
          throw new Error('the mark is keyed by position, so a rescan would lose it');
        renderWaHarvest();
        var html=document.getElementById('waLinksBody').innerHTML;
        if(html.indexOf('wa-eye')===-1) throw new Error('no eye control is rendered');
        document.getElementById('waLinksBody').innerHTML='';
      } finally { _waHarvest=savedH; window.waHarvestSave=savedSave; }
    } },

  { id:'wa_freehand_fallback', group:'Import/Export', name:'A failed URL import offers free-hand there and then, keeping the URL (5f.11)',
    test: async()=>{
      if(typeof waFreehandFromFailedUrl!=='function') throw new Error('waFreehandFromFailedUrl not defined');
      var html=importFailureHtml('https://site.com/recipe/1',['server: The Worker refused']);
      if(html.indexOf('waFreehandFromFailedUrl')===-1)
        throw new Error('the failure offers no way to paste the text without starting over');
      if(html.indexOf('site.com/recipe/1')===-1) throw new Error('the failure no longer shows the URL to open');
      // The URL has to survive into free-hand, or the imported recipe loses its
      // source — and "already imported" in the harvest panel matches on source.
      var realOpen=window.openFreehandModal, got=null;
      try{
        window.openFreehandModal=function(t,u){ got={text:t,url:u}; };
        waFreehandFromFailedUrl('https://site.com/recipe/1');
        if(!got) throw new Error('it did not open the free-hand parser');
        if(got.url!=='https://site.com/recipe/1')
          throw new Error('the URL was not carried across, so the recipe would have no source: '+got.url);
      } finally { window.openFreehandModal=realOpen; closeM('urlImportOverlay'); }
      // ...and the carried URL must actually LAND on the parsed recipe. Grepping
      // runFreehandImport for '_freehandSourceUrl' is satisfied by `if (false &&
      // _freehandSourceUrl ...)`, which drops the source with the suite green
      // (proved by mutation, v34.1). Run the real import with a stubbed AI.
      var realAi=window.aiCall, realApply=window.applyParsedRecipe,
          realPrev=window.applyParsedToFormPreview, realToast2=window.toast, applied=null;
      try{
        window.toast=function(){};
        window.aiCall=function(){ return Promise.resolve('{"name":"Pasted dish","ingredients":[],"steps":["s"]}'); };
        window.applyParsedRecipe=function(pr){ applied=pr; };
        window.applyParsedToFormPreview=function(pr){ applied=pr; };
        openFreehandModal('some pasted recipe text', 'https://site.com/recipe/1');
        var ta=document.getElementById('freehandText');
        if(!ta) throw new Error('the free-hand modal has no text area');
        ta.value='some pasted recipe text';
        await runFreehandImport();
        if(!applied) throw new Error('the free-hand import produced no recipe at all');
        if(applied.source!=='https://site.com/recipe/1')
          throw new Error('the recipe came out with source "'+applied.source+'" — the URL carried over from the failed import was dropped, so the harvest panel can never mark it imported');
      } finally {
        window.aiCall=realAi; window.applyParsedRecipe=realApply;
        window.applyParsedToFormPreview=realPrev; window.toast=realToast2;
        closeM('freehandOverlay');
      }
    } },

  { id:'wa_scan_load_parallel', group:'WhatsApp', name:'Chats load concurrently, in order, and report progress (5f.9)',
    test: async()=>{
      if(typeof waLoadOneChat!=='function') throw new Error('waLoadOneChat not defined');
      var realOne=window.waLoadOneChat, realIdx=window.waIndex;
      var inFlight=0, peak=0, order=[];
      try{
        window.waIndex=function(){ return [
          {id:'a',group:'A',source:'remote',file:'a.txt'},{id:'b',group:'B',source:'remote',file:'b.txt'},
          {id:'c',group:'C',source:'remote',file:'c.txt'},{id:'d',group:'D',source:'remote',file:'d.txt'}]; };
        window.waLoadOneChat=function(e){
          inFlight++; peak=Math.max(peak,inFlight);
          return new Promise(function(res){ setTimeout(function(){
            inFlight--; order.push(e.id);
            res([{date:'1/2/2026',time:'10:00',who:'W',text:'from '+e.id,group:e.group}]);
          }, e.id==='a' ? 60 : 10); });   // 'a' is the SLOW one, on purpose
        };
        var progress=[];
        var got=await waLoadAllMessages({ onProgress: function(p){ progress.push(p.done); } });

        // Sequential loading would never have more than one request open at a time.
        // This is the whole point of loading in parallel, and dropping the pool back
        // to one lane must fail here rather than pass quietly.
        if(peak<2) throw new Error('chats were loaded one after another — never more than '+peak+' in flight');
        // The slow chat finishes LAST, so if results were pushed as they landed its
        // messages would move. Order must follow the index, not the network, because
        // the delta watermark counts positions within a chat.
        if(order[order.length-1]!=='a') throw new Error('the fixture did not exercise out-of-order completion');
        var from=got.messages.map(function(m){ return m.text; });
        if(from.join(',')!=='from a,from b,from c,from d')
          throw new Error('a slow chat was reordered by which request finished first: '+from.join(','));
        if(got.chats.length!==4) throw new Error('not every chat was reported as loaded');
        if(!progress.length) throw new Error('loading reported no progress, so the panel cannot show "chat 2 of 5"');
        if(progress[progress.length-1]!==4) throw new Error('progress never reached the total');

        // One chat failing must not take the others down with it.
        window.waLoadOneChat=function(e){
          if(e.id==='b') return Promise.reject(new Error('boom'));
          return Promise.resolve([{date:'1/2/2026',time:'10:00',who:'W',text:'from '+e.id,group:e.group}]);
        };
        var partial=await waLoadAllMessages({});
        if(partial.chats.length!==3) throw new Error('one failed chat lost the others: '+partial.chats.length);
        if(!(partial.problems.join(' ').indexOf('boom')>-1))
          throw new Error('the failure was swallowed instead of reported');
      } finally { window.waLoadOneChat=realOne; window.waIndex=realIdx; }
    } },

  { id:'wa_dismiss', group:'WhatsApp', name:'Dismissing hides an item for good, and says why (5f.10)',
    test: async()=>{
      ['waDismiss','waIsDismissed','waDismissedCount','waUndismissAll','waSelKey']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var savedH=_waHarvest, savedSave=window.waHarvestSave;
      try{
        window.waHarvestSave=function(){ return Promise.resolve(true); };
        _waHarvest={ links:[{key:'a.com/x',url:'https://a.com/x',domain:'a.com',count:1,shares:[{who:'Dana',date:'01/02',text:'ctx'}]}],
                     texts:[{text:'מיונז ביתי עם ביצה ושמן וחרדל',score:77,signals:['3 quantities','4 cooking steps'],who:'Yossi',date:'02/02'},
                            {text:'משהו ארוך שהוא בכלל לא מתכון',score:52,signals:['2 quantities','2 cooking steps'],who:'Rami',date:'03/02'}],
                     loaded:true, hideImported:true, hideNoise:true, tab:'texts', selected:{}, dismissed:{} };

        // Selecting and then dismissing must not leave it queued for import.
        waToggleSel('text',1);
        if(!waSelCount()) throw new Error('fixture: selection did not take');
        waDismiss('text',1,'notrecipe');
        if(waSelCount()!==0) throw new Error('a dismissed row was still queued for import');
        if(waDismissedCount()!==1) throw new Error('the dismissal was not recorded');
        if(!waIsDismissed('text',_waHarvest.texts[1])) throw new Error('the dismissed item is not recognised as dismissed');
        if(waIsDismissed('text',_waHarvest.texts[0])) throw new Error('dismissing one item hid another');

        // "Forever" means keyed by CONTENT. A later scan rebuilds the array from
        // scratch — new object, possibly a different position — and must not
        // resurrect it. This is the assertion that makes the promise true.
        var afterRescan={ text:'משהו ארוך שהוא בכלל לא מתכון', score:52, signals:['2 quantities'], who:'Rami' };
        if(!waIsDismissed('text',afterRescan))
          throw new Error('the same message found again by a later scan came back — the dismissal is keyed by position, not content');

        // The two reasons are different KINDS of fact, and only one is evidence.
        var rec=_waHarvest.dismissed[waSelKey('text',afterRescan)];
        if(rec.reason!=='notrecipe') throw new Error('the reason was not stored');
        if(!rec.signals||!rec.signals.length)
          throw new Error('"not a recipe" kept no signals — then it is not diagnostic and the second button earns nothing');
        if(!rec.score) throw new Error('"not a recipe" kept no score');
        waDismiss('link',0,'notinterested');
        var link=_waHarvest.dismissed[waSelKey('link',_waHarvest.links[0])];
        if(!link) throw new Error('a link could not be dismissed');
        if(link.signals) throw new Error('"not interested" stored signals — it says nothing about the algorithm and must not pretend to');

        // The copied report is the ONLY route by which a false positive reaches a
        // human who can fix the scorer, so it must carry the evidence.
        var t=waHarvestText();
        if(t.indexOf('NOT A RECIPE')===-1) throw new Error('the report does not mention the false positives at all');
        if(t.indexOf('quantities')===-1)
          throw new Error('the report omits the signals, so nobody can tell why the scorer was fooled');
        if(t.indexOf('False-positive rate')===-1) throw new Error('the report does not say how often the scorer was wrong');

        // Mutation testing caught this missing: everything above proved the
        // dismissal was RECORDED, nothing proved the row actually goes away —
        // which is the entire user-visible promise. Assert on what is rendered.
        _waHarvest.tab='texts';
        var body=document.getElementById('waLinksBody');
        renderWaHarvest();
        if(body.innerHTML.indexOf('בכלל לא מתכון')>-1)
          throw new Error('a dismissed recipe is still drawn in the list');
        if(body.innerHTML.indexOf('מיונז')===-1)
          throw new Error('dismissing one row removed an unrelated one from the list');
        _waHarvest.tab='links';
        renderWaHarvest();
        if(body.innerHTML.indexOf('a.com/x')>-1) throw new Error('a dismissed link is still drawn in the list');
        body.innerHTML='';

        // ...and it must survive the app being closed, or "forever" is a lie.
        // This exercises the REAL save/load through IndexedDB, because stubbing
        // waHarvestSave (as the rest of this test does) cannot see the payload.
        window.waHarvestSave=savedSave;
        if(_idbAvailable){
          var before=waDismissedCount();
          await waHarvestSave();
          var back=await waHarvestLoad();
          if(!back) throw new Error('the harvest did not save at all');
          if(!back.dismissed || Object.keys(back.dismissed).length!==before)
            throw new Error('dismissals were not persisted — they would all come back on the next open');
          await waDelete(WA_HARVEST_KEY);
        }
        window.waHarvestSave=function(){ return Promise.resolve(true); };

        // A permanent action needs a visible way back.
        waUndismissAll();
        if(waDismissedCount()!==0) throw new Error('dismissals could not be undone — one mis-tap would lose a recipe silently');
      } finally { _waHarvest=savedH; window.waHarvestSave=savedSave; }
    } },

  { id:'wa_import_queue', group:'WhatsApp', name:'Selected rows import as a queue that advances itself (5f.10)',
    test: async()=>{
      ['waImportSelected','waQueueNext','waQueueAdvance','waImportOne','waImportLink']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var savedH=_waHarvest, savedSave=window.waHarvestSave;
      var realUrlM=window.openUrlImportModal, realFreeM=window.openFreehandModal, realOpen=window.openWaLinks;
      var opened=[];
      try{
        window.waHarvestSave=function(){ return Promise.resolve(true); };
        window.openWaLinks=function(){};                       // don't reopen during the test
        window.openUrlImportModal=function(u){ opened.push('url:'+u); };
        window.openFreehandModal=function(t){ opened.push('text:'+String(t).slice(0,6)); };
        _waHarvest={ links:[{key:waNormalizeUrl('https://a.com/1'),url:'https://a.com/1',domain:'a.com',count:1,shares:[]},
                            {key:waNormalizeUrl('https://a.com/2'),url:'https://a.com/2',domain:'a.com',count:1,shares:[]}],
                     texts:[{text:'מיונז ביתי עם ביצה ושמן',score:70,signals:['x'],who:'Y'}],
                     loaded:true, hideImported:true, hideNoise:true, tab:'links',
                     selected:{}, dismissed:{}, numbering:{}, seen:{} };
        waToggleSel('link',0); waToggleSel('link',1); waToggleSel('text',0);
        if(waSelCount()!==3) throw new Error('fixture: expected 3 selected, got '+waSelCount());

        waImportSelected();
        if(opened.length!==1) throw new Error('the queue did not open the first importer');
        if(_waQueue.total!==3) throw new Error('the queue lost track of how many were selected');

        // A saved import advances to the next WITHOUT the user reopening anything.
        _waQueue.imported=true; closeM('urlImportOverlay');
        await new Promise(function(r){ setTimeout(r,500); });
        if(opened.length!==2) throw new Error('the queue did not advance after a successful import — selection is decoration again');
        if(_waQueue.done!==1) throw new Error('the queue did not count the import');

        // Closing one importer SKIPS it and moves on. It used to abort the whole
        // batch, so a single "Could not fetch this page" — closed by the user,
        // as anyone would — silently ended the run after one import. That is
        // exactly what "Import selected only imports one" turned out to be.
        _waQueue.imported=false; closeM('urlImportOverlay');
        await new Promise(function(r){ setTimeout(r,600); });
        if(opened.length!==3) throw new Error('a skipped import ended the whole batch instead of moving to the next');
        if(!_waQueue.active) throw new Error('the queue stopped after one item was skipped');
        if(_waQueue.skipped!==1) throw new Error('the skip was not counted');

        // ...and the still-open panel must REDRAW to show it. The panel no longer
        // closes during an import, so nothing else would ever repaint it and the
        // row would keep saying "Import this" for a recipe already imported.
        _waHarvest.hideImported=false; _waHarvest.tab='links';
        var bodyQ=document.getElementById('waLinksBody');
        bodyQ.innerHTML='<!--stale-->';
        waHarvestRefreshImported();
        if(bodyQ.innerHTML.indexOf('stale')>-1)
          throw new Error('the panel was never redrawn after an import, so it still shows the old state');
        bodyQ.innerHTML='';

        // A completed import must mark the row 'Imported' — checked through the
        // QUEUE, not by calling waMarkImported directly. Testing the helper alone
        // left every call site free to stop calling it, which is exactly what
        // happened here (and twice before in this file).
        if(waSeenState('link',_waHarvest.links[0])!=='imported')
          throw new Error('a row imported by the batch was never marked as imported');

        // Replacing a DUPLICATE is a successful import, not a cancel. This path
        // closes the overlay from confirmImportChecked, which used to forget to
        // say so — another way the batch ended after one. Grepping that function
        // for '_waQueue.imported = true' passes with the line wrapped in a dead
        // branch, so it is driven for real here (v34.1).
        var qKeep=window._waQueue, rAskDup2=window.askDuplicateAction, rClose=window.closeM,
            rRF3=window.renderFilters, rRG3=window.renderGrid, rSD=window.saveData,
            rT3=window.toast, rPush=window.pushHistory, rKeepRecipes=recipes;
        try{
          window.toast=function(){}; window.renderFilters=function(){}; window.renderGrid=function(){};
          window.saveData=function(){}; window.closeM=function(){}; window.pushHistory=function(){};
          window.askDuplicateAction=function(){ return Promise.resolve('replace'); };
          window._waQueue={ items:[], imported:false };
          var existing=normalizeRecipe({ id:9101, name:'Dup Target', ingredients:[{a:'1',n:'old'}], steps:['old'] });
          recipes=[existing];
          await confirmImportChecked({ name:'Dup Target', ingredients:[{a:'2',n:'new'}], steps:['new'] },
                                     'urlImportOverlay', { recipe:existing, why:'name' });
          if(!_waQueue.imported)
            throw new Error('replacing a duplicate left the queue thinking the import was cancelled, so the rest of the batch would be abandoned');
        } finally {
          window._waQueue=qKeep; window.askDuplicateAction=rAskDup2; window.closeM=rClose;
          window.renderFilters=rRF3; window.renderGrid=rRG3; window.saveData=rSD;
          window.toast=rT3; window.pushHistory=rPush; recipes=rKeepRecipes;
        }

        // Stopping must still be possible, and must be a deliberate act.
        if(typeof waQueueAbort!=='function') throw new Error('there is no way to stop a running batch');
        var left=_waQueue.items.length;
        waQueueAbort();
        if(_waQueue.active) throw new Error('Stop did not stop the batch');
        if(waSelCount()!==left) throw new Error('the un-imported remainder was not left selected: '+waSelCount()+' vs '+left);
      } finally {
        // waQueueAbort reopens the panel on a timer, so wait for that to land
        // before restoring — otherwise it opens AFTER this block and the suite's
        // hygiene check fails on a stranded dialog.
        await new Promise(function(r){ setTimeout(r,300); });
        _waHarvest=savedH; window.waHarvestSave=savedSave; window.openWaLinks=realOpen;
        window.openUrlImportModal=realUrlM; window.openFreehandModal=realFreeM;
        _waQueue.active=false; _waQueue.items=[]; _waQueue.total=0;
        _waQueue.done=0; _waQueue.skipped=0; _waQueue.imported=false; _waQueue.current=null;
        var ovQ=document.getElementById('waLinksOverlay'); if(ovQ) ovQ.classList.remove('open');
        var chip=document.getElementById('waQueueChip'); if(chip) chip.remove();
      }
    } },

  { id:'wa_numbering', group:'WhatsApp', name:'Rows are numbered, and dismissing does not reshuffle them (5f.10)',
    test: async()=>{
      ['waRenumber','waRowNo'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var savedH=_waHarvest, savedSave=window.waHarvestSave;
      try{
        window.waHarvestSave=function(){ return Promise.resolve(true); };
        var mk=function(n){ return {text:'recipe number '+n+' with enough text to be distinct',score:90-n,signals:['x'],who:'W'}; };
        _waHarvest={ links:[], texts:[mk(1),mk(2),mk(3),mk(4)], loaded:true,
                     hideImported:true, hideNoise:true, tab:'texts',
                     selected:{}, dismissed:{}, numbering:{} };
        waRenumber();
        if(waRowNo('text',_waHarvest.texts[0],0)!==1) throw new Error('the first row is not numbered 1');
        if(waRowNo('text',_waHarvest.texts[3],0)!==4) throw new Error('the fourth row is not numbered 4');

        // Dismissing #2 must NOT renumber: 1, 3, 4 keep their numbers, so nothing
        // moves under the reader's finger. The gap is deliberate.
        waDismiss('text',1,'notinterested');
        if(waRowNo('text',_waHarvest.texts[2],0)!==3)
          throw new Error('row 3 was renumbered the moment something above it was dismissed — the list shuffled under the reader');
        if(waRowNo('text',_waHarvest.texts[3],0)!==4) throw new Error('row 4 was renumbered on dismissal');

        // ...but displaying the list afresh closes the gap. Go through the REAL
        // route the user takes — switching tab — not waRenumber() directly:
        // testing the helper alone leaves every call site free to stop calling it.
        waHarvestTab('links'); waHarvestTab('texts');
        if(waRowNo('text',_waHarvest.texts[2],0)!==2)
          throw new Error('the numbers did not close up when the list was displayed again');
        if(waRowNo('text',_waHarvest.texts[3],0)!==3) throw new Error('renumbering did not run to the end');

        // Reopening the panel is the OTHER way a fresh list gets displayed, and
        // it is the one Tony actually uses. Test that call site too — a helper
        // that only one caller invokes is a helper the others can quietly drop.
        waDismiss('text',0,'notinterested');       // now 2 remain, numbered 2 and 3
        _waHarvest.numbering={};
        var ovN=document.getElementById('waLinksOverlay');
        try{
          await openWaLinks();
          if(waRowNo('text',_waHarvest.texts[2],0)!==1)
            throw new Error('reopening the panel did not renumber the list');
        } finally { ovN.classList.remove('open'); }

        // Refreshing after an import must NOT renumber either — same rule as
        // dismissing. An import removes a row from view (it becomes "already
        // saved"), and closing the gap at that moment shuffles every row below it
        // under the reader's finger, mid-list, without them asking.
        var savedLinks=_waHarvest.links, savedTab=_waHarvest.tab, savedHide=_waHarvest.hideImported;
        try{
          _waHarvest.links=[{key:'x.com/1',url:'https://x.com/1',domain:'x.com',count:1,shares:[]},
                            {key:'x.com/2',url:'https://x.com/2',domain:'x.com',count:1,shares:[]},
                            {key:'x.com/3',url:'https://x.com/3',domain:'x.com',count:1,shares:[]}];
          _waHarvest.tab='links'; _waHarvest.hideImported=true;
          waRenumber();
          if(waRowNo('link',_waHarvest.links[2],0)!==3) throw new Error('fixture: third link is not numbered 3');
          _waHarvest.links[1].imported=true;            // as an import would
          waHarvestRefreshImported();
          if(waRowNo('link',_waHarvest.links[2],0)!==3)
            throw new Error('importing a row renumbered the ones below it — the list shuffled mid-read');
        } finally {
          _waHarvest.links=savedLinks; _waHarvest.tab=savedTab; _waHarvest.hideImported=savedHide;
          document.getElementById('waLinksBody').innerHTML='';
        }

        // NOTE: there is deliberately no assertion here that a repaint keeps the
        // scroll position. One was written, and mutation testing showed it passed
        // with the code removed — Chromium preserves scrollTop across a single
        // innerHTML assignment on its own, so nothing this suite can run will
        // ever fail. A test that cannot fail is worse than none: it reads as
        // coverage. The line stays in renderWaHarvest for WebKit, unverified,
        // and says so.

        // The headline count reports what is actually in the list now.
        var body=document.getElementById('waLinksBody');
        renderWaHarvest();
        var html=body.innerHTML;
        if(html.indexOf('class="wa-count"')===-1)
          throw new Error('no headline count is shown at the top');   // exact class: "wa-count-x" must not satisfy this
        if(!/<b>2<\/b>\s*recipes/.test(html))
          throw new Error('the headline count does not reflect the 2 remaining recipes');
        body.innerHTML='';
      } finally { _waHarvest=savedH; window.waHarvestSave=savedSave; }
    } },

  { id:'wa_scan_progress', group:'WhatsApp', name:'Progress and ETA are honest, and pausing does not distort them (5f.9)',
    test: async()=>{
      ['waEtaText','waElapsedMs','waFmtDuration'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(waFmtDuration(45000)!=='45s') throw new Error('seconds are not formatted: '+waFmtDuration(45000));
      if(waFmtDuration(125000)!=='2m 5s') throw new Error('minutes are not formatted: '+waFmtDuration(125000));
      if(waFmtDuration(3900000)!=='1h 5m') throw new Error('hours are not formatted: '+waFmtDuration(3900000));

      // 1,000 of 5,000 in 10s ⇒ 4,000 left at 100/s ⇒ about 40s.
      var eta=waEtaText(1000,5000,10000);
      if(eta.indexOf('40s')===-1) throw new Error('the ETA is not derived from the observed rate: '+eta);
      // Too early to know. Guessing from the first handful of messages is how a
      // progress bar earns its reputation, so it must say so instead.
      if(waEtaText(5,5000,50)!=='estimating…') throw new Error('an ETA was invented from almost no evidence: '+waEtaText(5,5000,50));
      if(waEtaText(0,5000,9999)!=='') throw new Error('an ETA was shown before anything was scanned');
      if(waEtaText(5000,5000,9999)!=='') throw new Error('an ETA was still shown after the scan finished');

      // Paused time must not count as work time, or the estimate inflates for
      // every second the user spends reading the list.
      var t0=1000000;
      var scan={ status:'paused', startedAt:t0, pausedAt:t0+5000, pausedMs:0 };
      if(waElapsedMs(scan,t0+25000)!==5000)
        throw new Error('time spent paused was counted as scanning time: '+waElapsedMs(scan,t0+25000));
      var resumed={ status:'running', startedAt:t0, pausedAt:0, pausedMs:20000 };
      if(waElapsedMs(resumed,t0+30000)!==10000)
        throw new Error('a completed pause was not deducted: '+waElapsedMs(resumed,t0+30000));
    } },

  { id:'wa_scan_delta', group:'WhatsApp', name:'A refresh reads only what is new, and knows when it cannot (5f.9)',
    test: async()=>{
      ['waDeltaStart','waChatSig','waMarkOf'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var msgs=[];
      for(var i=0;i<5;i++) msgs.push({date:'0'+(i+1)+'/02/2026',time:'10:0'+i,who:'Dana',text:'message '+i});

      var mark=waMarkOf(msgs);
      if(mark.count!==5) throw new Error('the watermark did not record how much was read');
      if(!mark.lastDate) throw new Error('the watermark kept no date to show the user how current the list is');

      // Nothing new: start at the end, do no work at all.
      if(waDeltaStart(msgs,mark).start!==5) throw new Error('an unchanged chat would be read again from the top');
      // Three more arrive: read exactly those three.
      var grown=msgs.concat([{date:'06/02/2026',time:'11:00',who:'A',text:'x'},
                             {date:'07/02/2026',time:'11:00',who:'B',text:'y'},
                             {date:'08/02/2026',time:'11:00',who:'C',text:'z'}]);
      if(waDeltaStart(grown,mark).start!==5) throw new Error('a grown chat did not resume from the watermark');
      // Never read before.
      if(waDeltaStart(grown,null).start!==0) throw new Error('a chat never read before was not read in full');

      // The dangerous cases. A re-export with a different start, or a shortened
      // chat, means position numbers no longer refer to the same messages — so
      // trusting the count would silently SKIP messages. Both must rescan.
      var replaced=[{date:'01/01/2020',time:'09:00',who:'Zed',text:'different first message'}].concat(msgs);
      if(waDeltaStart(replaced,mark).start!==0)
        throw new Error('a replaced export kept the old watermark — messages would be skipped for good');
      if(waDeltaStart(msgs.slice(0,3),mark).start!==0)
        throw new Error('a shortened export kept the old watermark');
      // The fingerprint must actually depend on the first message.
      if(waChatSig(msgs)===waChatSig(replaced)) throw new Error('the fingerprint does not distinguish two different exports');
    } },

  { id:'wa_scan_engine', group:'WhatsApp', name:'The scan yields, can be stopped, and finds the same things either way (5f.9)',
    test: async()=>{
      ['waHarvestAcc','waRunHarvest','waScanPause','waScanResume','waScanStop','waScanToggle']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(!document.getElementById('waLinksBody')) throw new Error('#waLinksBody missing');

      var mayo='מיונז ביתי\nמצרכים:\n1 ביצה\n1 כוס שמן\n1 כפית חרדל\n2 כפות מיץ לימון\nקורט מלח\nאופן ההכנה:\n'
        + 'טורפים את הביצה עם החרדל, מוסיפים את השמן בהדרגה תוך כדי טריפה, מוסיפים לימון ומערבבים.\nמקררים כשעה לפני ההגשה.';

      // Fed one at a time, the accumulator must reach the same answer as one
      // batch pass — otherwise a paused scan and an uninterrupted one disagree.
      var msgs=[{who:'A',date:'1/2/2026',text:'לינק https://site.com/r?utm_source=wa'},
                {who:'B',date:'2/2/2026',text:mayo},
                {who:'C',date:'3/2/2026',text:'תודה!'},
                {who:'D',date:'4/2/2026',text:'https://www.site.com/r/'},
                {who:'E',date:'5/2/2026',text:mayo}];
      var acc=waHarvestAcc();
      msgs.forEach(function(m){ acc.add(m); });
      var batchLinks=waExtractLinks(msgs), batchTexts=waFindTextRecipes(msgs);
      if(acc.links().length!==batchLinks.length)
        throw new Error('incremental and batch disagree on links: '+acc.links().length+' vs '+batchLinks.length);
      if(acc.textList().length!==batchTexts.length)
        throw new Error('incremental and batch disagree on in-text recipes: '+acc.textList().length+' vs '+batchTexts.length);
      if(acc.links()[0].count!==2) throw new Error('the same link fed one at a time was not counted twice');
      if(acc.textList()[0].dupes!==2) throw new Error('a forwarded recipe fed one at a time was not folded in');

      // The real point of the rebuild: the scan must hand the thread back. A
      // synchronous pass is what made the browser offer to kill the page, and a
      // timer that never fires until the scan ends proves it is still doing it.
      var realLoad=window.waLoadAllMessages, realSave=window.waHarvestSave, realIdb=window._idbAvailable;
      var bulk=[]; for(var i=0;i<4000;i++) bulk.push({chat:'c1',group:'G',who:'X',date:'1/2/2026',text:'just chatter number '+i});
      bulk[3999]={chat:'c1',group:'G',who:'Y',date:'9/9/2026',text:mayo};
      window.waLoadAllMessages=function(){ return Promise.resolve({messages:bulk,problems:[],chats:[{id:'c1',group:'G',count:bulk.length}]}); };
      window.waHarvestSave=function(){ return Promise.resolve(true); };
      window._idbAvailable=false;
      var painted=false, savedH=_waHarvest, savedS=_waScan;
      try{
        setTimeout(function(){ painted=true; },0);
        await waRunHarvest(true);
        if(!painted) throw new Error('no timer ran during the whole scan — it never released the main thread, so the tab was frozen exactly as before');
        if(_waScan.status!=='done') throw new Error('the scan did not finish cleanly: '+_waScan.status);
        if(_waScan.done!==bulk.length) throw new Error('the scan skipped messages: '+_waScan.done+' of '+bulk.length);
        if(!_waHarvest.texts.length) throw new Error('the recipe buried at the end of a long chat was never found');

        // Stop must halt early AND keep what was found by then.
        window.waLoadAllMessages=function(){ return Promise.resolve({messages:bulk,problems:[],chats:[]}); };
        var run=waRunHarvest(true);
        await new Promise(function(r){ setTimeout(r,0); });
        waScanStop();
        await run;
        if(_waScan.status!=='stopped') throw new Error('stop did not stop the scan: '+_waScan.status);
        if(_waScan.done>=bulk.length) throw new Error('stop was ignored — the scan ran to the end anyway');
      } finally {
        window.waLoadAllMessages=realLoad; window.waHarvestSave=realSave; window._idbAvailable=realIdb;
        _waHarvest=savedH; _waScan=savedS;
        var b=document.getElementById('waLinksBody'); if(b) b.innerHTML='';
      }
    } },

  { id:'ui_selftest_report', group:'UI', name:'The self-test report carries enough to diagnose without asking',
    test: async()=>{
      // Tony asked for a Copy button whose output means no second round of
      // questions. The only way to know it does is to seed a failure and read
      // what comes out — a button that exists but reports nothing useful is
      // worse than none, because it looks like the information was provided.
      ['selfTestReportText','copySelfTestReport','renderSelfTestSummary','recentErrors']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(!document.getElementById('selfTestCopyBtn')) throw new Error('there is no Copy button in the Self Test panel');
      if(!document.getElementById('selfTestSummary')) throw new Error('there is nowhere to render the run summary');

      var saved=_selfTestResults, savedNotRun=_selfTestNotRun, savedAt=_selfTestStartedAt;
      try{
        _selfTestResults={
          fake_ok:  {pass:true,  ms:3, group:'Fake', name:'a passing one'},
          cloud_strip:{pass:false, ms:7, group:'Cloud Sync', name:'Photos stripped from the per-recipe doc',
                       error:'SEEDED-FAILURE-MARKER', stack:'Error: SEEDED-FAILURE-MARKER\n    at frameOne (index.html:1)'}
        };
        _selfTestNotRun=['net_ai']; _selfTestStartedAt=new Date();
        var rep=selfTestReportText();

        // The failure itself, in full.
        [['SEEDED-FAILURE-MARKER','the error message'],
         ['frameOne','the stack'],
         ['cloud_strip','the failing test id'],
         ['Cloud Sync','the failing test group'],
         [APP_VERSION,'the app version'],
         ['net_ai','which tests were NOT run'],
         [navigator.userAgent.slice(0,16),'the user agent'],
         ['SYNC HEALTH','the sync health block'],
         ['RECENT JS ERRORS','the captured error buffer'],
         [WORKER_ENDPOINT,'the Worker endpoint']
        ].forEach(function(pair){
          if(rep.indexOf(pair[0])===-1) throw new Error('the report omits '+pair[1]+' — I would have to ask for it');
        });
        // The standing fix note for a known test must ride along.
        if(rep.indexOf(SELF_TEST_FIXES.cloud_strip.fix.slice(0,25))===-1)
          throw new Error('the report drops SELF_TEST_FIXES guidance for the failing test');
        // A passing test must not be listed as a failure.
        if(/FAILURES \(2\)/.test(rep)) throw new Error('a passing test was counted as a failure');
        if(rep.indexOf('1 passed, 1 failed')===-1) throw new Error('the counts are wrong: '+rep.split('\n')[4]);

        // ...and with nothing failing it must say so plainly, not go silent.
        _selfTestResults={ fake_ok:{pass:true,ms:1,group:'Fake',name:'ok'} };
        if(selfTestReportText().indexOf('FAILURES: none')===-1)
          throw new Error('a clean run does not state that there were no failures');
      } finally { _selfTestResults=saved; _selfTestNotRun=savedNotRun; _selfTestStartedAt=savedAt; }
    } },


  { id:'sec_bring_secret_not_shipped', group:'Network', name:'The Bring! set-token secret is not in the repo (v31.3)',
    test: async()=>{
      // The secret guarding the shared Bring! token used to be a hard-coded
      // constant in this file, and this file is a public repo — so it was
      // readable by anyone. Removing the Worker's fallback was only half the
      // fix: a value shipped here is public whatever it is.
      // (The old name and value are deliberately NOT written out here: this test
      // greps the page, and a comment quoting them would match itself.)
      var src=document.documentElement.innerHTML;
      if(/BRING_TOKEN_SECRET\s*=\s*['"][^'"]+['"]/.test(src))
        throw new Error('a Bring! secret is hard-coded in the page again — it would be public in the repo');
      // Assembled at runtime so this needle does not match itself.
      var oldSecret=['tonys','recipes','2024'].join('-');
      if(src.indexOf(oldSecret)!==-1)
        throw new Error('the old public secret is still in the source');
      ['getBringTokenSecret','setBringTokenSecret','saveBringSecret'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var saved=getBringTokenSecret();
      try{
        setBringTokenSecret('  test-secret-123  ');
        if(getBringTokenSecret()!=='test-secret-123') throw new Error('the secret did not round-trip through storage (or was not trimmed)');
        setBringTokenSecret('');
        if(getBringTokenSecret()!=='') throw new Error('clearing the secret did not work');
      } finally { setBringTokenSecret(saved); }
      // The bookmarklet runs on web.getbring.com, where the app's helpers do not
      // exist. A v31.1 refactor put workerHeaders() into that string and broke it.
      // Assert on the bookmarklet's OUTPUT, not on the function's source: three
      // grep-style assertions in a row matched their own comments.
      if(typeof buildBringBookmarklet!=='function') throw new Error('buildBringBookmarklet not defined');
      // BEFORE calling the builder: bringFailureMessage must already exist. It was
      // briefly nested inside buildBringBookmarklet, so updateBringToken could not
      // reach it — and this test passed regardless, because it called the builder
      // first. Order the check so it cannot be satisfied by a side effect.
      if(typeof window.bringFailureMessage!=='function')
        throw new Error('bringFailureMessage is not defined at module scope — updateBringToken cannot see it');
      var bm=buildBringBookmarklet('sekrit-42');
      if(bm.indexOf('workerHeaders')!==-1)
        throw new Error('the emitted bookmarklet calls an app helper, which does not exist on web.getbring.com');
      if(bm.indexOf('"Content-Type":"application/json"')===-1) throw new Error('the bookmarklet sends no content type');
      if(bm.indexOf('"sekrit-42"')===-1) throw new Error('the secret was not embedded in the bookmarklet');
      if(bm.indexOf('bring-settoken')===-1) throw new Error('the bookmarklet does not call the set-token action');
      // A secret containing a quote must not break out of the emitted JS.
      var evil=buildBringBookmarklet('a"b\\c');
      if(evil.indexOf('secret:"a"b')!==-1) throw new Error('a quote in the secret breaks the generated bookmarklet');
      // (An earlier assertion here required showBringBookmarklet to call
      // showServiceError. That pinned the IMPLEMENTATION of the warning, not the
      // behaviour — and the implementation it pinned was the dead end itself: a
      // refusal to open the only window where the secret can be typed. The
      // behaviour it meant to protect, "an unset secret must warn rather than
      // emit a broken bookmarklet", is asserted directly below.)
      if(!document.getElementById('bringSecretInput')) throw new Error('there is nowhere to enter the secret');

      // v32.5 — the modal must OPEN with no secret set. That is the only place the
      // secret can be entered, so refusing to open it left a user with no way in
      // at all, and the refusal named a Settings entry that did not exist. Assert
      // on the actual overlay state, not on the source of the guard.
      var _sv=getBringTokenSecret(), ov=document.getElementById('bringBookmarkletOverlay');
      try{
        setBringTokenSecret('');
        ov.classList.remove('open');
        showBringBookmarklet();
        if(!ov.classList.contains('open'))
          throw new Error('the bookmarklet modal refuses to open without a secret — the secret can then never be entered');
        var codeBox=document.getElementById('bringBookmarkletCode');
        if(/javascript:/.test(codeBox.textContent))
          throw new Error('a bookmarklet was emitted with an empty secret — it would always be refused');
        if(!/secret/i.test(codeBox.textContent))
          throw new Error('the code box does not explain why there is nothing to copy');
        // With a secret it must emit the real thing, and show it back for checking.
        setBringTokenSecret('sekrit-42');
        showBringBookmarklet();
        if(codeBox.textContent.indexOf('javascript:')!==0)
          throw new Error('no bookmarklet was emitted even though a secret is set');
        if(document.getElementById('bringSecretInput').value!=='sekrit-42')
          throw new Error('the stored secret is not shown back, so it cannot be checked against the Worker');
      } finally { setBringTokenSecret(_sv); ov.classList.remove('open'); }

      // v32.4 — assert on BEHAVIOUR, not on source text. Every earlier assertion
      // here was a string match, and all of them passed while the bookmarklet
      // reported "Failed: undefined" for three of the Worker's four failure
      // replies. The message logic is now a real function, so it can be called.
      if(typeof bringFailureMessage!=='function') throw new Error('bringFailureMessage not defined');
      var cases=[
        // The Worker reports every genuine failure as {error}. These three used
        // to surface as "Failed: undefined" — the reason was thrown away.
        { st:503, body:'{"error":"BRING_SETTOKEN_SECRET is not set on the Worker"}', want:'BRING_SETTOKEN_SECRET' },
        { st:403, body:'{"error":"Unauthorized"}',   want:'Unauthorized' },
        { st:400, body:'{"error":"Invalid token"}',  want:'Invalid token' },
        // Only this one ever sent {message}, which is why it alone read correctly.
        { st:200, body:'{"success":false,"message":"KV not available"}', want:'KV not available' },
        // A non-JSON body (proxy error page) must be shown, not swallowed.
        { st:502, body:'<html>bad gateway</html>',   want:'bad gateway' },
        // Nothing at all still has to say something.
        { st:500, body:'',                            want:'no reason given' }
      ];
      cases.forEach(function(c){
        var m=bringFailureMessage(c.st, c.body);
        if(m===null) throw new Error('a '+c.st+' reply was treated as SUCCESS');
        if(m.indexOf(c.want)===-1) throw new Error('a '+c.st+' reply reads "'+m+'" — it must carry "'+c.want+'"');
        if(/undefined/.test(m)) throw new Error('a '+c.st+' reply produced "'+m+'" — this is the Failed: undefined bug');
        if(m.indexOf(String(c.st))===-1) throw new Error('a '+c.st+' reply does not name its status: "'+m+'"');
      });
      // Success must still read as success.
      if(bringFailureMessage(200,'{"success":true,"message":"Token updated in KV"}')!==null)
        throw new Error('a successful save was reported as a failure');
      // ...and the bookmarklet must carry THIS function, not a copy that can drift.
      if(bm.indexOf(bringFailureMessage.toString())===-1)
        throw new Error('the bookmarklet no longer inlines bringFailureMessage — the two can now drift apart');
    } },

  { id:'sec_worker_authenticated', group:'Network', name:'Every Worker call carries the app key (v31.1)',
    test: async()=>{
      // The Worker forwards to Anthropic on Tony's key and its URL ships in this
      // public file. With CORS '*', no auth and no rate limit, anyone who read
      // the page could spend his credits.
      ['WORKER_ENDPOINT','workerHeaders','workerErrorText'].forEach(function(f){
        if(typeof window[f]==='undefined') throw new Error(f+' not defined');
      });
      var h=workerHeaders();
      if(h['Content-Type']!=='application/json') throw new Error('the JSON content type was lost');
      if(workerHeaders({'X-Extra':'1'})['X-Extra']!=='1') throw new Error('extra headers are dropped');
      // v31.8 — the key must travel in the BODY, never as a custom header. A
      // custom header forces a CORS preflight, and only the newest Worker allows
      // it in Access-Control-Allow-Headers — so sending it made the browser
      // block EVERY Worker call until that Worker was deployed. The whole app's
      // server features were dead for two releases because of this.
      if(h['X-App-Key'])
        throw new Error('the app key is back in a request header, which forces a preflight an older Worker will reject');
      if(typeof workerBody!=='function') throw new Error('workerBody not defined');
      var body=JSON.parse(workerBody({ action:'photo-search', query:'x' }));
      if(!body.appKey) throw new Error('workerBody sends no app key');
      if(body.action!=='photo-search'||body.query!=='x') throw new Error('workerBody dropped the payload');
      // Every Worker call must go through it, or that call is unauthenticated.
      var page=document.documentElement.innerHTML;
      var stray=(page.match(/fetch\(\s*(?:WORKER_ENDPOINT|BRING_WORKER_URL|WORKER_URL)\b[\s\S]{0,800}?body:\s*JSON\.stringify\(/g)||[]).length;
      if(stray) throw new Error(stray+' Worker call(s) build their body directly and so send no app key');
      // No call site may inline the URL and thereby skip the key.
      var src=document.documentElement.innerHTML;
      var inlined=(src.match(/fetch\('https:\/\/lively-bread/g)||[]).length;
      if(inlined) throw new Error(inlined+' Worker call(s) still inline the URL, so they send no key');
      // Its refusals must be explained, not shown as bare codes.
      if(!/app key/i.test(workerErrorText(403,{error:'FORBIDDEN: missing or wrong app key.'})))
        throw new Error('a 403 is not explained');
      if(!/minute/i.test(workerErrorText(429,{}))) throw new Error('a 429 does not say to wait');
    } },

  { id:'sync_merge_precedence', group:'Cloud Sync', name:'A merge keeps the NEWER copy and never resurrects an old edit (5g.5)',
    test: async()=>{
      if(typeof mergeRecipeLists!=='function') throw new Error('mergeRecipeLists not defined');

      // Same recipe, same id, edited in both places. The newer edit must win in
      // BOTH directions — a merge that always prefers local silently reverts work
      // done on another device, and one that always prefers cloud discards what
      // was just typed here. Neither reports anything: the recipe is simply wrong
      // afterwards, and the older text looks like a recipe the user mis-remembers.
      var cloudNewer=mergeRecipeLists(
        [{ id:5, name:'Brisket', steps:['cloud edit'], updatedAt:2000 }],
        [{ id:5, name:'Brisket', steps:['local edit'], updatedAt:1000 }], 6);
      var got=cloudNewer.list.filter(function(r){ return r.id===5; })[0];
      if(!got||got.steps[0]!=='cloud edit')
        throw new Error('an OLDER local copy overwrote a newer cloud one — the edit made on the other device is gone with no warning');

      var localNewer=mergeRecipeLists(
        [{ id:5, name:'Brisket', steps:['cloud edit'], updatedAt:1000 }],
        [{ id:5, name:'Brisket', steps:['local edit'], updatedAt:2000 }], 6);
      var got2=localNewer.list.filter(function(r){ return r.id===5; })[0];
      if(!got2||got2.steps[0]!=='local edit')
        throw new Error('a newer local edit lost to an older cloud copy — the merge always prefers the cloud, so nothing typed offline survives');

      // A missing updatedAt must not read as "newest". Undated data comes from
      // old exports and hand-edited backups.
      var undated=mergeRecipeLists(
        [{ id:5, name:'Brisket', steps:['cloud edit'], updatedAt:2000 }],
        [{ id:5, name:'Brisket', steps:['undated'] }], 6);
      if(undated.list.filter(function(r){ return r.id===5; })[0].steps[0]!=='cloud edit')
        throw new Error('a recipe with no updatedAt beat a dated one — undated data would overwrite everything');

      // A renumbered recipe must LOSE its photo flags. `_ph` means "a photo for
      // this id lives elsewhere", and after renumbering that is a claim about a
      // different recipe's photo — it would attach the wrong picture, and worse,
      // arm the delete branch against the other recipe's cloud copy.
      // Distinct uids, or these are the SAME recipe by identity and the older one
      // simply loses — which is correct, and not the branch under test here.
      var clash=mergeRecipeLists(
        [{ id:7, uid:'u-cloud', name:'Cloud recipe', updatedAt:2000 }],
        [{ id:7, uid:'u-local', name:'A different recipe', updatedAt:1000, _ph:1, _po:1 }], 8);
      var moved=clash.list.filter(function(r){ return r.name==='A different recipe'; })[0];
      if(!moved) throw new Error('the colliding local recipe was dropped instead of renumbered');
      if(moved.id===7) throw new Error('the local recipe was not renumbered, so one of the two is lost');
      if(moved._ph||moved._po)
        throw new Error('a renumbered recipe kept its photo flags, which now point at another recipe’s photo');
    } },

  { id:'photo_repair_bounds', group:'Storage', name:'The photo repair is bounded and never guesses absence (5g.5)',
    test: async()=>{
      if(typeof repairMissingPhotos!=='function') throw new Error('repairMissingPhotos not defined');
      var savedRecipes=recipes, realDb=window._fbDb, realUser=window._fbUser,
          realToast=window.toast, realSave=window.saveLocal, realRG=window.renderGrid,
          savedProbed=localStorage.getItem('tonys_photo_probed');
      try{
        window.toast=function(){}; window.saveLocal=function(){}; window.renderGrid=function(){};
        window._fbUser={ uid:'test' };
        localStorage.removeItem('tonys_photo_probed');

        // This is the LAST line of defence for a device whose _ph flags were
        // already cleared by an older build: no reload, restart or re-sync brings
        // those photos back, only this. It had no test at all.
        var reads=0;
        function stub(answer){
          return { collection:function(){ return { doc:function(id){ return { get:function(){
            reads++; return answer(id);
          } }; } }; } };
        }

        // 1. Bounded. 200 photoless recipes must not spend 200 of the day's reads.
        recipes=[]; for(var i=1;i<=200;i++) recipes.push({ id:i, name:'r'+i, photo:'' });
        window._fbDb=stub(function(){ return Promise.resolve({ exists:false, data:function(){ return {}; } }); });
        var out=await repairMissingPhotos();
        if(reads>PHOTO_REPAIR_MAX)
          throw new Error('the repair made '+reads+' reads for 200 recipes — unbounded, it would burn the daily quota every load');
        if(out.checked>PHOTO_REPAIR_MAX) throw new Error('checked '+out.checked+', above the bound of '+PHOTO_REPAIR_MAX);

        // 2. A recipe that already HAS a photo, or a flag saying where it is, must
        // never be read for — that is a wasted round trip per load, for ever.
        localStorage.removeItem('tonys_photo_probed');
        reads=0;
        recipes=[{ id:1, name:'has one', photo:'data:image/jpeg;base64,A' },
                 { id:2, name:'flagged',  photo:'', _ph:1 },
                 { id:3, name:'old flag', photo:'', hp:1 }];
        await repairMissingPhotos();
        if(reads!==0)
          throw new Error('the repair read '+reads+' document(s) for recipes that already have a photo or know where it is');

        // 3. A FAILED read is not proof of absence. Recording it as probed means
        // the recipe is never asked about again — a network blip made permanent.
        localStorage.removeItem('tonys_photo_probed');
        recipes=[{ id:9, name:'unknown', photo:'' }];
        window._fbDb=stub(function(){ return Promise.reject(new Error('offline')); });
        await repairMissingPhotos();
        var probed=[]; try{ probed=JSON.parse(localStorage.getItem('tonys_photo_probed')||'[]')||[]; }catch(e){}
        if(probed.map(String).indexOf('9')>-1)
          throw new Error('a failed read was recorded as "genuinely has no photo" — that recipe would never be asked about again, so a blip becomes permanent loss');

        // 4. ...but a document that genuinely does not exist IS remembered, or the
        // photoless recipes are re-probed on every single load for ever.
        localStorage.removeItem('tonys_photo_probed');
        recipes=[{ id:11, name:'really none', photo:'' }];
        window._fbDb=stub(function(){ return Promise.resolve({ exists:false, data:function(){ return {}; } }); });
        await repairMissingPhotos();
        var probed2=[]; try{ probed2=JSON.parse(localStorage.getItem('tonys_photo_probed')||'[]')||[]; }catch(e){}
        if(probed2.map(String).indexOf('11')===-1)
          throw new Error('a recipe the cloud says has no photo was not remembered, so it is re-probed on every load and costs reads for ever');

        // 5. A photo that IS there comes back.
        localStorage.removeItem('tonys_photo_probed');
        recipes=[{ id:12, name:'recoverable', photo:'' }];
        window._fbDb=stub(function(){ return Promise.resolve({ exists:true, data:function(){ return { photo:'data:image/jpeg;base64,BACK' }; } }); });
        var res=await repairMissingPhotos();
        if(recipes[0].photo!=='data:image/jpeg;base64,BACK')
          throw new Error('a photo present in the cloud was not restored — the whole point of the repair');
        if(res.restored!==1) throw new Error('the repair does not report what it restored: '+JSON.stringify(res));
      } finally {
        recipes=savedRecipes; window._fbDb=realDb; window._fbUser=realUser;
        window.toast=realToast; window.saveLocal=realSave; window.renderGrid=realRG;
        if(savedProbed===null) localStorage.removeItem('tonys_photo_probed');
        else localStorage.setItem('tonys_photo_probed', savedProbed);
      }
    } },

  { id:'sync_id_collision_keeps_both', group:'Cloud Sync', name:'Two devices adding offline do not overwrite each other (v31.6)',
    test: async()=>{
      // Reported by Tony: he added a recipe on the PC and Peleg added one on his
      // phone, both offline. Both got the same id. On reconnect the merge treated
      // them as two VERSIONS of one recipe, the newer won, and the photo — which
      // lives in its own document keyed by id — stayed behind and attached itself
      // to the survivor. He ended up with his photo on his son's recipe and his
      // own recipe gone.
      ['newUid','sameRecipeIdentity','mergeRecipeLists','reportIdCollisions'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      if(newUid()===newUid()) throw new Error('newUid is not unique');
      // Same id, different uid => two different recipes.
      var cloud=[normalizeRecipe({id:42,uid:'uid-cloud',name:'באו באן',updatedAt:100})];
      var local=[normalizeRecipe({id:42,uid:'uid-local',name:'מוסקה',updatedAt:50})];
      var out=mergeRecipeLists(cloud,local,43);
      if(out.list.length!==2) throw new Error('a collision lost a recipe: '+out.list.length+' survived, expected 2');
      var names=out.list.map(function(r){ return r.name; });
      if(names.indexOf('באו באן')===-1||names.indexOf('מוסקה')===-1)
        throw new Error('both recipes must survive, got: '+names.join(', '));
      if(out.list[0].id===out.list[1].id) throw new Error('both kept the same id, so they will collide again');
      if(!out.renamed.length) throw new Error('the renumbering was not reported, so it would happen silently');
      // The OLDER local one must not win on updatedAt — this is not a conflict.
      if(out.list.filter(function(r){ return r.name==='מוסקה'; })[0].id===42)
        throw new Error('the local copy kept the contested number; the cloud copy is the one other devices know');
      // Same id AND same uid => a genuine conflict; newer wins, one survives.
      var c2=[normalizeRecipe({id:7,uid:'same',name:'old',updatedAt:100})];
      var l2=[normalizeRecipe({id:7,uid:'same',name:'new',updatedAt:200})];
      var o2=mergeRecipeLists(c2,l2,8);
      if(o2.list.length!==1) throw new Error('a real conflict was duplicated instead of resolved');
      if(o2.list[0].name!=='new') throw new Error('the newer edit did not win a genuine conflict');
      if(o2.renamed.length) throw new Error('a genuine conflict was reported as a collision');
      // LEGACY recipes are backfilled with a DETERMINISTIC uid (v31.7), so every
      // device computes the same one with no coordination. Two devices holding
      // the same old recipe must therefore agree, not duplicate it.
      var c3=[normalizeRecipe({id:5,name:'legacy',updatedAt:100})];
      var l3=[normalizeRecipe({id:5,name:'legacy edited',updatedAt:200})];
      if(!c3[0].uid||!l3[0].uid) throw new Error('a legacy recipe was left without a uid — two identity rules instead of one');
      if(c3[0].uid!==l3[0].uid)
        throw new Error('two devices derived DIFFERENT uids for the same legacy recipe — every old recipe would duplicate');
      if(c3[0].uid!=='legacy-5') throw new Error('the legacy uid is not derived from the id: '+c3[0].uid);
      var o3=mergeRecipeLists(c3,l3,6);
      if(o3.list.length!==1) throw new Error('the same legacy recipe was duplicated across devices');
      if(o3.renamed.length) throw new Error('legacy recipes were treated as a collision');
      if(o3.list[0].name!=='legacy edited') throw new Error('the newer edit of a legacy recipe did not win');
      // A NEW recipe must never be confused with a legacy one holding its number.
      var fresh=normalizeRecipe({id:5,uid:newUid(),name:'brand new',updatedAt:300});
      if(fresh.uid==='legacy-5') throw new Error('a new recipe was given the legacy uid for its number');
      var o5=mergeRecipeLists([c3[0]],[fresh],6);
      if(o5.list.length!==2) throw new Error('a new recipe reusing an old number silently replaced it');
      // ...and normalizeRecipe must not invent a uid for a fragment with no id.
      var frag=normalizeRecipe({ingredients:[],steps:[]});
      if(frag.uid) throw new Error('a recipe fragment with no id was given a uid');
      // A recipe only the local device has must simply come along.
      var o4=mergeRecipeLists([normalizeRecipe({id:1,uid:'a'})],[normalizeRecipe({id:9,uid:'b'})],10);
      if(o4.list.length!==2) throw new Error('an offline-only addition was dropped');
      // nextId must move past everything, or the very next add collides again.
      // The renumbered recipe took 43, so the next free number is 44.
      var moved=out.list.filter(function(r){ return r.name==='מוסקה'; })[0];
      if(out.nextId<=moved.id) throw new Error('nextId ('+out.nextId+') is not past the renumbered recipe ('+moved.id+') — the next add collides again');
      // And new recipes must actually be born with a uid.
      var src=document.documentElement.innerHTML;
      if(src.indexOf('id: nextId++, uid: newUid()')===-1)
        throw new Error('new recipes are created without a uid, so collisions stay undetectable');
      // ...and the LOAD PATH must apply it. Grepping _loadFromFirestoreInner for
      // 'mergeRecipeLists' is satisfied by a ternary that never evaluates the
      // call, which turns an offline load back into a wholesale replace with the
      // suite green (proved by mutation, v34.1). Drive the real load instead.
      var savedRecipes2=recipes, savedNext=nextId, savedQ=localStorage.getItem('tonys_offline_queue');
      var rDb=window._fbDb, rRead=window.readCloudRecipeDocs, rAttach=window.attachCloudPhotos,
          rRepair=window.repairMissingPhotos, rSave=window.saveLocal, rGrid=window.renderGrid,
          rFilters=window.renderFilters, rToast=window.toast, rCount=window.countCloudRead,
          rSetMeta=window.setLastCloudMetaAt;
      try{
        window.saveLocal=function(){}; window.renderGrid=function(){}; window.renderFilters=function(){};
        window.toast=function(){}; window.countCloudRead=function(){}; window.setLastCloudMetaAt=function(){};
        window.attachCloudPhotos=function(){ return Promise.resolve(); };
        window.repairMissingPhotos=function(){ return Promise.resolve({restored:0,checked:0}); };
        // readCloudRecipeDocs returns plain {id, data} objects with the recipe as
        // JSON in data.r — NOT Firestore snapshots. Assuming the snapshot shape
        // made this test fail honestly on its first run.
        window.readCloudRecipeDocs=function(){ return Promise.resolve([
          { id:'recipe_1', data:{ updatedAt:5000,
            r: JSON.stringify({ id:1, uid:'u-cloud-1', name:'From the cloud', updatedAt:5000 }) } }
        ]); };
        window._fbDb={ collection:function(){ return {
          doc:function(){ return {
            get:function(){ return Promise.resolve({ exists:true, data:function(){ return { schema:2, nextId:9, updatedAt:1 }; } }); },
            onSnapshot:function(){ return function(){}; }
          }; },
          where:function(){ return this; },
          onSnapshot:function(){ return function(){}; }
        }; } };
        // An offline edit exists locally, and the cloud holds a different recipe.
        localStorage.setItem('tonys_offline_queue','1');
        recipes=[{ id:2, uid:'u-local-2', name:'Added while offline', updatedAt:6000 }];
        await _loadFromFirestoreInner({ uid:'test' });
        var loadedNames=recipes.map(function(r){ return r.name; });
        if(loadedNames.indexOf('Added while offline')===-1)
          throw new Error('an offline load REPLACED instead of merging — the recipe added while offline is gone: '+loadedNames.join(', '));
        if(loadedNames.indexOf('From the cloud')===-1)
          throw new Error('the merge dropped the cloud recipe: '+loadedNames.join(', '));
      } finally {
        recipes=savedRecipes2; nextId=savedNext;
        window._fbDb=rDb; window.readCloudRecipeDocs=rRead; window.attachCloudPhotos=rAttach;
        window.repairMissingPhotos=rRepair; window.saveLocal=rSave; window.renderGrid=rGrid;
        window.renderFilters=rFilters; window.toast=rToast; window.countCloudRead=rCount;
        window.setLastCloudMetaAt=rSetMeta;
        if(savedQ===null) localStorage.removeItem('tonys_offline_queue');
        else localStorage.setItem('tonys_offline_queue', savedQ);
      }
    } },

  { id:'ux_signin_always_reachable', group:'UI', name:'Sign in is never unclickable text (v31.5)',
    test: async()=>{
      // Tony's son's phone showed "Offline mode" and "Sign in to sync across
      // devices" with no control to act on either: #signInHeaderBtn is
      // display:none in the markup and only useOfflineMode(), signOut() or an
      // auth callback reveal it. If Firebase never initialises, none of those
      // run and the app instructs something it gives no means of doing.
      ['ensureSignInReachable','signInIsReachable'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var btn=document.getElementById('signInHeaderBtn');
      if(!btn) throw new Error('#signInHeaderBtn missing');
      var prevBtn=btn.style.display, prevUser=window._fbUser;
      var bar=document.getElementById('saveStatusBar'), prevBar=bar?bar.textContent:'';
      var login=document.getElementById('loginScreen'), prevLogin=login?login.style.display:'';
      try{
        window._fbUser=null;
        btn.style.display='none';
        if(login) login.style.display='none';
        if(!signInIsReachable()!==true) { /* both hidden => not reachable */ }
        if(signInIsReachable()) throw new Error('signInIsReachable says yes while both the button and the login screen are hidden');
        ensureSignInReachable();
        await new Promise(function(r){ setTimeout(r,4200); });
        if(!signInIsReachable()) throw new Error('after boot with no auth, there is still no way to sign in');
        if(bar && /Sign in to sync across devices/.test(bar.textContent))
          throw new Error('the status line still instructs an action the user cannot take');
        // It must NOT nag a signed-in user.
        btn.style.display='none'; window._fbUser={ email:'x@y.z' };
        ensureSignInReachable();
        await new Promise(function(r){ setTimeout(r,4200); });
        if(btn.style.display!=='none') throw new Error('a signed-in user was offered a Sign in button');
      } finally {
        window._fbUser=prevUser; btn.style.display=prevBtn;
        if(bar) bar.textContent=prevBar;
        if(login) login.style.display=prevLogin;
      }
    } },

  { id:'sec_csp_allows_import_fallbacks', group:'Network', name:'The CSP does not break URL import (v31.4)',
    test: async()=>{
      // v31.1 shipped a CSP whose connect-src omitted the CORS proxies that URL
      // import falls back to. Every fallback was blocked by our own policy, and
      // the failure message blamed the recipe site — Tony went looking at a site
      // that was working perfectly. Reported by him.
      var c=(document.querySelector('meta[http-equiv="Content-Security-Policy"]')||{getAttribute:function(){return '';}}).getAttribute('content')||'';
      var src=String(runUrlImport);
      // Pull the proxy hosts out of the code itself, so adding a fourth proxy
      // without adding it to the CSP fails here rather than in Tony's hands.
      var hosts=(src.match(/https:\/\/[a-z0-9.-]+(?=\/[^`'"]*\$\{|\/)/gi)||[])
        .filter(function(h){ return h.indexOf('workers.dev')===-1; })
        .filter(function(h,i,a){ return a.indexOf(h)===i; });
      hosts.forEach(function(h){
        if(c.indexOf(h)===-1) throw new Error(h+' is used by URL import but is not in connect-src, so our own CSP blocks it');
      });
      if(c.indexOf('api.allorigins.win')===-1) throw new Error('the CORS proxy fallbacks are not allowed by the CSP');
      // v31.9 — applying a chosen photo fetches its BYTES from whatever host the
      // source returned. img-src only governs rendering, which is why search
      // results appeared while "Use this Photo" silently failed. Openverse
      // federates Flickr, Wikimedia and museums, so those hosts cannot be
      // listed — which is why connect-src used to carry a bare `https:`.
      //
      // v36.30 — it does not any more. The bytes go through our own Worker, so
      // the ONE host that has to be allowed is the Worker's. Asserting that is
      // the same protection this check always gave, against a list that now
      // means something.
      if(/connect-src[^;]*\bhttps:(\s|;)/.test(c))
        throw new Error('connect-src has a bare `https:` again — it allows every origin and makes the list after it decorative');
      if(c.indexOf('lively-bread-273a.rozinante2004.workers.dev')===-1)
        throw new Error('the Worker is not in connect-src, so every photo, import and AI call is blocked by our own CSP');
      // A failed apply must raise a REAL error dialog. A three-second toast on a
      // failure that leaves the old photo in place reads as "nothing happened" —
      // which is exactly what Tony reported. Driven: grepping the function for
      // 'showServiceError' survives the call being unreachable (v34.1).
      var feRec=recipes, feFetch=window.fetch, feSel=_photoSearchSelected, feRes=_photoSearchResults,
          feTarget=heroPhotoTargetId, feToast=window.toast, feSave=window.saveData,
          feGrid=window.renderGrid, feErr=window.showServiceError, raised=0, toasts=0;
      try{
        window.toast=function(){ toasts++; };
        window.saveData=function(){}; window.renderGrid=function(){};
        window.showServiceError=function(){ raised++; };
        window.fetch=function(){ return Promise.resolve({ ok:false, status:503 }); };
        recipes=[normalizeRecipe({ id:9501, name:'Apply failure', photo:'data:image/jpeg;base64,OLD',
                                   ingredients:[], steps:['x'] })];
        heroPhotoTargetId=9501;
        _photoSearchResults=[{ url:'https://x/broken.jpg' }];
        _photoSearchSelected=0;
        await useSelectedSearchPhoto();
        if(!raised)
          throw new Error('a failed photo apply raised no error dialog — with the old photo still on screen it reads as nothing having happened');
        if(recipes[0].photo!=='data:image/jpeg;base64,OLD')
          throw new Error('a FAILED apply changed the existing photo');
      } finally {
        recipes=feRec; window.fetch=feFetch; _photoSearchSelected=feSel; _photoSearchResults=feRes;
        heroPhotoTargetId=feTarget; window.toast=feToast; window.saveData=feSave;
        window.renderGrid=feGrid; window.showServiceError=feErr;
        closeM('photoSearchOverlay');
      }
      // ...and the failure message must not blame the site for our own faults.
      if(/The site blocks automated access\. Please/.test(src))
        throw new Error('the failure message still asserts the SITE blocked us, whatever actually happened');
      if(src.indexOf('attempts')===-1)
        throw new Error('nothing records why each attempt failed, so the message cannot be truthful');
      // Assert on the OUTPUT: a grep for this wording passes while the branch
      // that selects it is disabled, which is how the first version of this
      // test survived exactly that mutation.
      if(typeof importFailureHtml!=='function') throw new Error('importFailureHtml not defined');
      var ours=importFailureHtml('https://example.com/r',['server: The Worker refused this origin. Add this site to ALLOWED_ORIGINS on the Worker.']);
      if(ours.indexOf('at our end')===-1)
        throw new Error('a Worker refusal is still presented as the recipe site blocking us');
      var theirs=importFailureHtml('https://example.com/r',['the server fetched the page but found no readable text in it']);
      if(theirs.indexOf('at our end')!==-1)
        throw new Error('a genuine site problem is blamed on us');
      if(theirs.indexOf('no readable text')===-1) throw new Error('the reasons are not shown to the user');
      // A hostile URL must not break out of the href.
      var evil=importFailureHtml('javascript:alert(1)',[]);
      if(evil.indexOf('href="javascript:')!==-1) throw new Error('a javascript: URL reached the href');
    } },

  { id:'sec_csp_present', group:'CSS', name:'A Content-Security-Policy is set and pinned (v31.1)',
    test: async()=>{
      var m=document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if(!m) throw new Error('no CSP meta tag');
      var c=m.getAttribute('content')||'';
      // The directives that still bite even with 'unsafe-inline' for scripts.
      [["object-src 'none'",'plugin embedding'],["base-uri 'none'",'<base> hijacking'],
       ["form-action 'none'",'injected forms posting out'],["frame-ancestors 'none'",'clickjacking']
      ].forEach(function(pair){
        if(c.indexOf(pair[0])===-1) throw new Error('CSP is missing '+pair[0]+' — '+pair[1]+' is not blocked');
      });
      if(c.indexOf('lively-bread')===-1) throw new Error('connect-src does not allow the Worker, so every AI call would fail');
      // Firebase Auth compat creates a hidden iframe on the project's authDomain
      // and talks to it. Omitting the host stalls sign-in with no visible error.
      if(c.indexOf('firebaseapp.com')===-1)
        throw new Error('the Firebase auth domain is not allowed, so sign-in would stall');
      // The email preview is a srcdoc iframe (about:srcdoc) and needs frame-src 'self'.
      if(!/frame-src[^;]*'self'/.test(c)) throw new Error("frame-src lacks 'self' — the email preview iframe would be blocked");
      // Lazily loaded libraries must still be reachable.
      ['https://cdnjs.cloudflare.com','https://www.gstatic.com'].forEach(function(host){
        if(c.indexOf(host)===-1) throw new Error('script-src omits '+host+', so a lazily loaded library would silently fail');
      });
    } },

  { id:'feat_import_duplicates', group:'Import/Export', name:'Importing the same recipe twice is caught (5f.2)',
    test: async()=>{
      ['normUrl','normName','findDuplicate'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var list=[normalizeRecipe({id:1,name:"Grandma's Lasagna",source:'https://www.example.com/lasagna/?utm=1'}),
                normalizeRecipe({id:2,name:'עוגת שוקולד'})];
      // Same URL, cosmetically different — the near-certain signal.
      var d=findDuplicate({name:'Totally Different',source:'http://example.com/lasagna'},list);
      if(!d||d.why!=='source') throw new Error('the same source URL was not recognised');
      // Same name, different punctuation and case.
      if(!findDuplicate({name:'grandmas   lasagna!'},list)) throw new Error('a near-identical name was not recognised');
      // Hebrew must work, including niqqud.
      if(!findDuplicate({name:'עוגת שוקולד'},list)) throw new Error('a Hebrew duplicate was missed');
      // ...and it must NOT collapse genuinely different recipes.
      if(findDuplicate({name:'Beef Stew'},[normalizeRecipe({id:3,name:'Lamb Stew'})]))
        throw new Error('two different recipes were treated as duplicates');
      if(findDuplicate({name:'Soup'},[normalizeRecipe({id:4,name:'Stew'})]))
        throw new Error('short unrelated names were conflated');
      if(findDuplicate({name:'Anything',source:''},list)&&!findDuplicate({name:'Anything'},list))
        throw new Error('an empty source matched something');
      // The check must run BEFORE anything is written.
      // The import path must CONSULT the duplicate check before writing. Grepping
      // confirmImportParsed for 'findDuplicate' is satisfied by a ternary that
      // never evaluates it, which lets every duplicate straight through with the
      // suite green (proved by mutation, v34.1). Drive it: a real duplicate must
      // reach the ask-first branch, never the silent-add one.
      var keepR=recipes, keepN=nextId, realAskDup=window.askDuplicateAction,
          realNow=window.importParsedNow, realToast3=window.toast,
          realRF2=window.renderFilters, realRG2=window.renderGrid, asked=null, addedSilently=0;
      try{
        window.toast=function(){}; window.renderFilters=function(){}; window.renderGrid=function(){};
        // Order matters: the ask must come FIRST. Answering "keep both" then adding
        // is correct behaviour, so counting adds alone proves nothing.
        var seq=[];
        window.askDuplicateAction=function(d){ asked=d; seq.push('ask'); return Promise.resolve('add'); };
        window.importParsedNow=function(){ addedSilently++; seq.push('add'); };
        recipes=[normalizeRecipe({ id:1, name:'Grandmas Lasagna', source:'http://example.com/lasagna',
                                   ingredients:[{a:'1',n:'pasta'}], steps:['bake'] })];
        confirmImportParsed({ name:"Grandma's Lasagna!", ingredients:[{a:'1',n:'pasta'}], steps:['bake'] }, 'urlImportOverlay');
        await new Promise(function(res){ setTimeout(res, 0); });
        if(!asked)
          throw new Error('an obvious duplicate was imported without asking — the import path does not consult findDuplicate');
        if(seq[0]!=='ask')
          throw new Error('the duplicate reached importParsedNow before anything asked — the check cannot block it, sequence was: '+seq.join(' -> '));
        if(asked.why!=='name') throw new Error('the duplicate was matched on '+asked.why+', expected the name');

        // ...and a genuine NON-duplicate must not be interrogated.
        asked=null; addedSilently=0; seq=[];
        confirmImportParsed({ name:'Something Else Entirely', ingredients:[{a:'1',n:'x'}], steps:['y'] }, 'urlImportOverlay');
        await new Promise(function(res){ setTimeout(res, 0); });
        if(asked) throw new Error('a recipe that is not a duplicate triggered the duplicate prompt');
        if(addedSilently!==1) throw new Error('a non-duplicate was not imported');
      } finally {
        recipes=keepR; nextId=keepN; window.askDuplicateAction=realAskDup;
        window.importParsedNow=realNow; window.toast=realToast3;
        window.renderFilters=realRF2; window.renderGrid=realRG2;
      }

      // ACTUALLY RUN AN IMPORT. The assertions above are all about the source
      // text, and they all passed while `importParsedNow` was null at runtime —
      // a stray `window.importParsedNow = null` placeholder had overwritten the
      // hoisted function, so every real import threw. Reported by Tony. Source
      // inspection cannot see a broken binding; only calling it can.
      var keepRecipes=recipes, keepNext=nextId;
      try{
        recipes=[]; 
        importParsedNow({ name:'Import Smoke Test', category:'Dinner', difficulty:'Easy',
          prep:'10 min', servings:'2', ingredients:[{a:'1',n:'thing'}], steps:['Do it'] }, 'urlImportOverlay');
        if(recipes.length!==1) throw new Error('importParsedNow did not add the recipe');
        if(recipes[0].name!=='Import Smoke Test') throw new Error('the imported recipe is wrong');
        if(!recipes[0].updatedAt) throw new Error('the import set no updatedAt, so it could lose a cloud merge');
        // And the duplicate-aware entry point must reach the same place.
        recipes=[];
        confirmImportParsed({ name:'Second Import', ingredients:[{a:'1',n:'x'}], steps:['y'] }, 'urlImportOverlay');
        if(recipes.length!==1) throw new Error('confirmImportParsed did not import a non-duplicate');
      } finally { recipes=keepRecipes; nextId=keepNext; renderFilters(); renderGrid(); }
    } },

  { id:'feat_ingredient_search', group:'Features', name:'Ingredient-level ALL search (5f.3)',
    test: async()=>{
      ['parseSearchQuery','recipeMatchesQuery'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var r=normalizeRecipe({ id:1, name:'Roast chicken', category:'Dinner',
        ingredients:[{a:'1',n:'chicken'},{a:'2',n:'lemon'},{a:'3',n:'garlic clove'}],
        steps:['Roast it with rosemary'] });
      // Plain search is unchanged — OR-ish across every field.
      if(!recipeMatchesQuery(r,'rosemary')) throw new Error('plain search stopped matching steps');
      if(!recipeMatchesQuery(r,'roast')) throw new Error('plain search stopped matching the name');
      // +term requires the term IN AN INGREDIENT, and ALL of them must be present.
      if(!recipeMatchesQuery(r,'+chicken +lemon')) throw new Error('a recipe with both ingredients did not match');
      if(recipeMatchesQuery(r,'+chicken +beef')) throw new Error('a missing ingredient still matched — this is AND, not OR');
      if(recipeMatchesQuery(r,'+rosemary')) throw new Error('+term matched a STEP; it must match ingredients only');
      // ing: form, for typing on a phone.
      if(!recipeMatchesQuery(r,'ing: chicken, garlic')) throw new Error('the ing: form did not match');
      if(recipeMatchesQuery(r,'ing: chicken, beef')) throw new Error('the ing: form is not requiring all terms');
      // Mixed: +term plus free text, both must hold.
      if(!recipeMatchesQuery(r,'+lemon roast')) throw new Error('mixing +term with free text failed');
      if(recipeMatchesQuery(r,'+lemon pancake')) throw new Error('free text is not being applied alongside +term');
      var p=parseSearchQuery('+a +b rest');
      if(p.must.length!==2||p.text!=='rest') throw new Error('the query did not split into terms and free text');
    } },

  { id:'feat_one_item_away', group:'Features', name:'"One item away" filter (5f.5)',
    test: async()=>{
      ['missingFromPantry','oneAwayCount','toggleOneAwayFilter'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var saved=null; try{ saved=localStorage.getItem('tonys_pantry'); }catch(e){}
      var keep=recipes, keepFlag=showOneAwayOnly;
      try{
        setPantry(['chicken','lemon','salt']);
        var cookable=normalizeRecipe({id:90001,name:'Have it all',ingredients:[{a:'',n:'chicken'},{a:'',n:'salt'}],steps:['x']});
        var oneAway =normalizeRecipe({id:90002,name:'One short',ingredients:[{a:'',n:'chicken'},{a:'',n:'saffron'}],steps:['x']});
        var twoAway =normalizeRecipe({id:90003,name:'Two short',ingredients:[{a:'',n:'beef'},{a:'',n:'saffron'}],steps:['x']});
        var clip    =normalizeRecipe({id:90004,name:'A clip',ingredients:[],steps:[],isClip:true});
        // A clip CAN carry ingredients — isClip is auto-ticked only when there
        // are none, but it can be ticked by hand on a recipe that has them. This
        // one is exactly one item short, so without the isClip guard it would be
        // offered as cookable when there is no method to cook from.
        var clipWithIngs=normalizeRecipe({id:90005,name:'Clip with ingredients',
          ingredients:[{a:'',n:'chicken'},{a:'',n:'saffron'}],steps:[],isClip:true});
        recipes=[cookable,oneAway,twoAway,clip,clipWithIngs];
        if(missingFromPantry(clipWithIngs).length!==0)
          throw new Error('a clip with ingredients was measured against the pantry — it has no method, so it cannot be cooked');
        if(missingFromPantry(oneAway).length!==1) throw new Error('a recipe one item short was not counted as one away');
        if(missingFromPantry(cookable).length!==0) throw new Error('a fully cookable recipe looks like it is missing something');
        // A clip has no ingredients, so it would read as "0 missing" and flood
        // the filter with things that cannot be cooked at all.
        if(missingFromPantry(clip).length!==0) throw new Error('clip handling changed');
        if(oneAwayCount()!==1) throw new Error('oneAwayCount returned '+oneAwayCount()+', expected 1');
        // With no pantry the chip cannot answer anything, so it must not appear.
        setPantry([]);
        if(oneAwayCount()!==0) throw new Error('the chip would show with an empty pantry, where it means nothing');
      } finally {
        recipes=keep; showOneAwayOnly=keepFlag;
        try{ if(saved===null) localStorage.removeItem('tonys_pantry'); else localStorage.setItem('tonys_pantry',saved); }catch(e){}
        renderFilters(); renderGrid();
      }
    } },

  { id:'sec_email_html_escaped', group:'Cloud Sync', name:'Email HTML escapes every recipe field (audit v31.0)',
    test: async()=>{
      // rHtml builds HTML that is rendered in an iframe on THIS origin, so an
      // escaping miss is script execution with the signed-in session attached.
      // A recipe is not trusted input: it can come from an AI import, a restored
      // backup, or another family member with write access.
      if(typeof safeUrl!=='function') throw new Error('safeUrl not defined');
      var evil=normalizeRecipe({ id:99901,
        name:'" onerror="alert(1)" x="',
        photo:'data:image/png;base64,AAA" onerror="alert(1)',
        bg:'red;" onload="alert(1)',
        emoji:'<img src=x onerror=alert(1)>',
        diets:['<script>alert(1)<\/script>'],
        category:'<b>Din</b>', difficulty:'<i>E</i>', prep:'<u>1</u>', servings:'<s>2</s>',
        source:'javascript:alert(1)',
        ingredients:[{a:'1',n:'<img src=x onerror=alert(1)>'}], steps:['<script>alert(1)<\/script>'] });
      var html=rHtml(evil);
      // Parsed inertly — never innerHTML — so a failure here cannot fire.
      var doc=new DOMParser().parseFromString(html,'text/html');
      if(doc.querySelector('script')) throw new Error('a <script> element survived into the email HTML');
      ['onerror','onload','onclick'].forEach(function(a){
        if(doc.querySelector('[' + a + ']')) throw new Error('an inline ' + a + ' handler was injected into the email HTML');
      });
      var links=doc.querySelectorAll('a[href]');
      for(var i=0;i<links.length;i++){
        if(/^javascript:/i.test(links[i].getAttribute('href')||''))
          throw new Error('a javascript: URL reached an href — escaping does not help, the scheme is the payload');
      }
      // safeUrl itself, including the control-character bypass.
      if(safeUrl('javascript:alert(1)')!=='') throw new Error('javascript: was allowed through');
      if(safeUrl('java\tscript:alert(1)')!=='') throw new Error('a control character smuggled javascript: past the check');
      if(safeUrl('JaVaScRiPt:alert(1)')!=='') throw new Error('case was enough to bypass safeUrl');
      if(safeUrl('https://example.com/x')!=='https://example.com/x') throw new Error('a normal https URL was destroyed');
      if(safeUrl('data:image/png;base64,AAA').indexOf('data:image/')!==0) throw new Error('recipe photo data URLs must survive');
      if(safeUrl('data:text/html,<script>')!=='') throw new Error('a non-image data: URL was allowed');
      // The preview iframe must be sandboxed — defence in depth for the above.
      // Checked on the ELEMENT, not by grepping showEmailModal for
      // "setAttribute('sandbox'": that text survives `if (false) iframe.set...`,
      // which leaves the preview un-sandboxed with the suite green. Mutation
      // proved it, v34.1.
      var savedRec=recipes, realT=window.toast;
      try{
        window.toast=function(){};
        recipes=[normalizeRecipe({ id:777001, name:'Sandbox probe', ingredients:[], steps:['x'] })];
        showEmailModal(777001);
        var frame=document.querySelector('#emailModalOverlay iframe');
        if(!frame) throw new Error('the email preview rendered no iframe at all');
        var sb=frame.getAttribute('sandbox');
        if(sb===null)
          throw new Error('the email preview iframe is NOT sandboxed, so any future escaping slip in rHtml reaches this origin — localStorage and the Firebase session included');
        if(/allow-scripts|allow-same-origin/.test(sb))
          throw new Error('the preview sandbox grants '+sb+' — allow-scripts or allow-same-origin defeats the point of sandboxing it');
      } finally {
        var ov=document.getElementById('emailModalOverlay'); if(ov) ov.remove();
        recipes=savedRec; window.toast=realT;
      }
    } },

  { id:'safe_restore_confirms', group:'Backup', name:'Restore asks before replacing everything (audit v31.0)',
    test: async()=>{
      var src=String(backupRestoreFile);
      if(src.indexOf('askConfirm')===-1)
        throw new Error('restore replaces the whole collection, and every other device, without asking');
      // The confirmation has to come BEFORE the data is touched, or it is theatre.
      if(src.indexOf('askConfirm')>src.indexOf('recipes=migrateRecipes'))
        throw new Error('the confirmation happens after the collection has already been replaced');
      // exportedAt was read with .slice() and no guard: a backup without it threw
      // AFTER the replace had happened and synced, then reported "Restore failed"
      // for a restore that had in fact succeeded destructively.
      if(typeof backupDateLabel!=='function') throw new Error('backupDateLabel not defined');
      if(backupDateLabel(undefined)!=='') throw new Error('a missing exportedAt throws or prints rubbish');
      if(backupDateLabel('not a date')!=='') throw new Error('a damaged exportedAt is not handled');
      if(!backupDateLabel('2026-08-09T10:00:00Z')) throw new Error('a valid date produced no label');
      // The call, not the comment explaining why it was removed.
      if(src.indexOf('Math.max.apply(')!==-1) throw new Error('Math.max.apply returns -Infinity for an empty list and can overflow the argument limit on a big one');
    } },

  { id:'a11y_icon_buttons', group:'UI', name:'Icon-only buttons have an accessible name (audit v31.0)',
    test: async()=>{
      if(typeof labelIconButtons!=='function') throw new Error('labelIconButtons not defined');
      var box=document.createElement('div');
      box.innerHTML='<button>✕</button><button>🤍</button><button title="Send to Bring!"></button>'
        + '<button aria-label="Already named">✕</button><button>Save Recipe</button>';
      labelIconButtons(box);
      var b=box.querySelectorAll('button');
      if(b[0].getAttribute('aria-label')!=='Close') throw new Error('the close button has no accessible name');
      if(!b[1].getAttribute('aria-label')) throw new Error('the favourite toggle has no accessible name');
      if(b[2].getAttribute('aria-label')!=='Send to Bring!') throw new Error('an empty button did not fall back to its title');
      if(b[3].getAttribute('aria-label')!=='Already named') throw new Error('an existing aria-label was overwritten');
      if(b[4].getAttribute('aria-label')) throw new Error('a button with real text was given a redundant label');
      // Dialogs built at runtime must be covered, not just the boot-time sweep —
      // and that is checked by OPENING one. `String(trapFocus).indexOf(
      // 'labelIconButtons')` is satisfied by `if (false) labelIconButtons(el)`,
      // which leaves every runtime dialog unlabelled with the suite green
      // (proved by mutation, v34.1).
      var probe=document.createElement('div');
      probe.id='a11yTrapProbe';
      probe.innerHTML='<button>✕</button><button>🤍</button>';
      document.body.appendChild(probe);
      try{
        trapFocus('a11yTrapProbe');
        var pb=probe.querySelectorAll('button');
        if(pb[0].getAttribute('aria-label')!=='Close')
          throw new Error('a dialog opened at runtime was never labelled — trapFocus does not reach labelIconButtons');
        if(!pb[1].getAttribute('aria-label'))
          throw new Error('an icon button inside a runtime dialog has no accessible name');
      } finally {
        probe.remove();
        if(Array.isArray(window._focusReturn)) _focusReturn.pop();
      }
    } },

  { id:'leak_mobile_panel_listener', group:'Performance', name:'The mobile filter panel does not stack listeners (audit v31.0)',
    test: async()=>{
      if(typeof clearMobilePanelCloser!=='function') throw new Error('clearMobilePanelCloser not defined');
      var src=String(toggleMobilePanel);
      // The old closer removed itself only on an OUTSIDE tap. Open the panel, tap
      // a filter inside it, close it with the button, and it stayed bound to
      // document for the rest of the session — one more on every open.
      if(src.indexOf('clearMobilePanelCloser')===-1)
        throw new Error('the outside-tap listener is never removed on the close path, so they accumulate');
      if(/addEventListener\('click', function closePanels/.test(src))
        throw new Error('the anonymous self-removing listener is back');
      var added=0, removed=0;
      var realAdd=document.addEventListener, realRemove=document.removeEventListener;
      try{
        document.addEventListener=function(t){ if(t==='click') added++; return realAdd.apply(document, arguments); };
        document.removeEventListener=function(t){ if(t==='click') removed++; return realRemove.apply(document, arguments); };
        var panel=document.createElement('div');
        panel.id='__testPanel'; panel.className='mobile-dropdown-panel';
        document.body.appendChild(panel);
        for(var i=0;i<6;i++){ toggleMobilePanel('__testPanel','__testBtn'); }
        await new Promise(function(r){ setTimeout(r,10); });
        clearMobilePanelCloser();
        panel.remove();
      } finally { document.addEventListener=realAdd; document.removeEventListener=realRemove; }
      if(added-removed>1) throw new Error('after 6 open/close cycles, '+(added-removed)+' click listeners are still bound');
    } },

  { id:'msg_access_not_granted', group:'Cloud Sync', name:'Access changes do not claim to have taken effect (audit v31.0)',
    test: async()=>{
      // The member list is not the permission: the rules embed these addresses
      // literally and are published BY HAND. "✅ added!" and "🗑️ Removed" said a
      // grant or a revocation had happened when neither had — and the removal
      // direction is the dangerous one, since it reads as access revoked.
      var add=String(addAccessMember), rem=String(removeAccessMember);
      if(/added! Share the app URL/.test(add))
        throw new Error('adding a member still claims access was granted before the rules are published');
      if(!/Publish|publish/.test(add)) throw new Error('adding a member does not say the rules must be published');
      if(/toast\('🗑️ Removed '/.test(rem))
        throw new Error('removing a member still reads as a revocation that has not happened');
      if(!/KEEP their access|keep their access/.test(rem))
        throw new Error('removal does not warn that access continues until the rules are published');
    } },

  { id:'ui_version_badge_honest', group:'UI', name:'The version badge states what is RUNNING (v30.5)',
    test: async()=>{
      // Tony reported his version three times from this badge, and three times
      // it was the SERVER's version, not his. A device on v30.1 displayed
      // "v30.4" and looked perfectly up to date while missing every change in
      // between — so a missing feature looked like a bug in the feature.
      var src=String(checkAppVersion);
      if(/badge\.textContent\s*=\s*serverVersion\s*;/.test(src))
        throw new Error('the badge is still overwritten with the server version, so it can claim a version this device is not running');
      if(src.indexOf('badge.textContent = APP_VERSION')===-1)
        throw new Error('the badge does not state the running version');
      // The banner must compare against what is running. Comparing against a
      // remembered string, then storing the server's version, made it appear
      // exactly once and then go quiet forever on a stale device.
      if(src.indexOf('serverVersion !== APP_VERSION')===-1)
        throw new Error('the update banner does not compare against the running version');
      if(/setItem\(VERSION_KEY,\s*serverVersion\)/.test(src))
        throw new Error('the server version is recorded as "seen" before the device is actually on it — the banner will never return');
      // And Update Now must not be answered from the very cache it is trying to
      // escape: stale-while-revalidate serves the OLD document on a plain reload.
      var up=String(swUpdateNow);
      if(up.indexOf('caches.delete')===-1)
        throw new Error('Update Now reloads without clearing the cache, so the service worker serves the old version again');
      if(up.indexOf('navigator.onLine')===-1)
        throw new Error('Update Now would empty the cache while offline, leaving a blank app');
    } },

  { id:'sw_serves_only_the_app_shell', group:'UI', name:'The service worker caches the app and nothing else (v34.9)',
    test: async()=>{
      // sw.js used to claim every html page in scope, because
      // `event.request.destination === 'document'` matches all of them. So
      // filename-test.html got stale-while-revalidate and the FIRST copy a browser
      // ever fetched was served for ever after — silently, since only the app
      // carries the version.json update banner that would say otherwise. A fixed
      // diagnostic page could not reach Tony at all; he ran the same broken test
      // twice and reported identical results while the fix sat deployed.
      //
      // This drives the real handler rather than reading its source: a source-text
      // assertion here would pass just as happily against the broken version.
      var probe = new Worker('tests/sw-probe.js');
      try {
        var reply = await new Promise(function(res, rej){
          var t = setTimeout(function(){ rej(new Error('sw-probe did not answer in 5s')); }, 5000);
          probe.onmessage = function(ev){ clearTimeout(t); res(ev.data); };
          probe.onerror = function(ev){ clearTimeout(t); rej(new Error('sw-probe failed to load: ' + (ev.message||'?'))); };
          probe.postMessage({ urls: [
            { url:'https://x/tonys-recipes/',                  destination:'document' },
            { url:'https://x/tonys-recipes/index.html',        destination:'document' },
            { url:'https://x/tonys-recipes/icons/icon-192.png',destination:'image'    },
            { url:'https://x/tonys-recipes/filename-test.html',destination:'document' },
            { url:'https://x/tonys-recipes/tests/sw-probe.js', destination:'script'   }
          ]});
        });
        if(reply.loadError) throw new Error('sw.js would not load: ' + reply.loadError);
        if(!reply.hasFetchHandler) throw new Error('sw.js registered no fetch handler');
        var r = reply.results;
        r.forEach(function(x,i){ if(x && x.error) throw new Error('request '+i+' '+x.error); });
        // The app shell must still be served by the worker — offline support and
        // the fast first paint both depend on it.
        if(!r[0].responded) throw new Error('the worker no longer serves /tonys-recipes/ — the app would not work offline');
        if(!r[1].responded) throw new Error('the worker no longer serves index.html — the app would not work offline');
        if(!r[2].responded) throw new Error('the worker no longer serves the pre-cached icons');
        // ...and it must be stale-while-revalidate, not cache-first. The probe
        // hands the handler a cache HIT; if it still goes to the network, the fresh
        // copy lands in the cache and the update banner can fire next load. If it
        // does not, the device is pinned on whatever version it first downloaded
        // and no release ever reaches it again.
        if(!r[0].revalidated) throw new Error('/tonys-recipes/ is served cache-first — a new version would never be downloaded');
        if(!r[1].revalidated) throw new Error('index.html is served cache-first — a new version would never be downloaded');
        // Icons are pre-cached and versioned with the cache name, so cache-first is
        // right for them: no revalidation expected.
        if(r[2].revalidated) throw new Error('the pre-cached icons are refetched on every load');
        // Anything else must pass straight through to the network.
        if(r[3].responded) throw new Error('filename-test.html is served by the worker, so a fixed copy cannot reach the user');
        if(r[4].responded) throw new Error('an arbitrary file under /tonys-recipes/ is pinned in the worker cache on first fetch');
      } finally { probe.terminate(); }
    } },

  { id:'import_freehand_into_form', group:'Import/Export', name:'Free-hand text can fill an open recipe (v30.4)',
    test: async()=>{
      ['openFreehandForForm','applyParsedToForm','applyParsedToFormPreview'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      if(!document.getElementById('formFreehandBtn')) throw new Error('#formFreehandBtn missing from the edit form');
      var parsed={ name:'Parsed Name', category:'Dinner', prep:'40 min', servings:'6',
                   ingredients:[{a:'200g',n:'flour'},{a:'2',n:'eggs'}], steps:['Mix it','Bake it'] };
      var testId=null;
      try{
        // Tony's case exactly: a recipe saved as a CLIP — name and photo already
        // right, no ingredients, and "Enjoy!" standing in for a method.
        testId=nextId++;
        recipes.push(normalizeRecipe({ id:testId, name:'שניצל של סבתא', ingredients:[], steps:['Enjoy!'], isClip:true, photo:'' }));
        openAddModal(testId);
        openFreehandForForm();
        var ov=document.getElementById('freehandOverlay');
        if(!ov.classList.contains('open')) throw new Error('the paste box did not open');
        // It must sit ABOVE the edit form, or it opens behind the thing it fills.
        if(parseInt(ov.style.zIndex||'0',10)<=200) throw new Error('the paste box opens behind the edit form');
        applyParsedToFormPreview(parsed,'freehandResult');
        var html=document.getElementById('freehandResult').innerHTML;
        if(html.indexOf('Fill in what')===-1||html.indexOf('Replace')===-1)
          throw new Error('the preview does not offer both fill and replace');
        applyParsedToForm(parsed,'fill');
        // The curated Hebrew name must survive; the parser's guess must not win.
        if(document.getElementById('f-name').value!=='שניצל של סבתא')
          throw new Error('the existing recipe name was overwritten by the parsed one');
        if(readIngsTable().filter(function(i){return i.n;}).length!==2)
          throw new Error('ingredients were not filled into the form');
        if(document.getElementById('f-steps').value.indexOf('Mix it')===-1)
          throw new Error('"Enjoy!" was treated as a real method, so the clip case — the whole point — is unsolved');
        if(document.getElementById('f-isclip').checked)
          throw new Error('the recipe still claims to be a clip after gaining a method');
        if(document.getElementById('freehandOverlay').classList.contains('open'))
          throw new Error('the paste box stayed open over the form');
        if(!document.getElementById('editOverlay').classList.contains('open'))
          throw new Error('the edit form was closed — the fill must be reviewable before saving');
        // Nothing may reach the stored recipe until Update Recipe is pressed.
        var stored=recipes.find(function(x){ return x.id===testId; });
        if(stored.steps.join(' ').indexOf('Mix it')!==-1)
          throw new Error('the recipe was written straight to storage, bypassing review and the 5.4 conflict guard');
        // "fill" must not clobber content that is already there; "replace" must.
        document.getElementById('f-steps').value='My own method';
        applyParsedToForm(parsed,'fill');
        if(document.getElementById('f-steps').value!=='My own method')
          throw new Error('fill overwrote a method that was already written');
        applyParsedToForm(parsed,'replace');
        if(document.getElementById('f-steps').value.indexOf('Mix it')===-1)
          throw new Error('replace did not overwrite the method');
      } finally {
        closeM('freehandOverlay'); closeM('editOverlay');
        if(testId) recipes=recipes.filter(function(r){ return r.id!==testId; });
      }
    } },

  { id:'feat_photo_429', group:'Features', name:'A rate-limited source hands off instead of dead-ending (v30.3)',
    test: async()=>{
      // Tony hit "Pixabay: invalid JSON (429)" repeatedly. Two faults: the
      // message blamed JSON parsing for what was a rate limit, and one failing
      // source ended the whole search while two working ones sat unused.
      if(typeof photoErrText!=='function') throw new Error('photoErrText not defined');
      var t=photoErrText('Pixabay: invalid JSON (429)');
      if(/invalid json/i.test(t)) throw new Error('a 429 is still reported as a JSON problem: '+t);
      if(!/minute/i.test(t)) throw new Error('the message does not say it clears on its own: '+t);
      if(!/key/i.test(photoErrText('Unsplash error 401: unauthorized'))) throw new Error('a rejected key is not explained');
      if(photoErrText('something odd')!=='something odd') throw new Error('an unrecognised error should pass through unchanged');
      // The search must move to the next source on an error, exactly as it does
      // for a source with no API key configured.
      var src=String(doPhotoSearch);
      var errBranch=src.slice(src.indexOf('if (data.error)'), src.indexOf('if (data.error)')+400);
      if(errBranch.indexOf('continue')===-1)
        throw new Error('an erroring source still ends the search instead of trying the next one');
      if(src.indexOf('failures')===-1) throw new Error('nothing collects why each source declined');
      // Attribution must survive being applied, or CC-BY photos breach their licence.
      if(typeof photoCreditHtml!=='function') throw new Error('photoCreditHtml not defined');
      // The picker must STORE the credit, not merely mention it. Grepping
      // useSelectedSearchPhoto for 'photoCredit' passes with the assignment in a
      // dead branch (v34.1), so it is applied for real here — on a CC-BY source
      // an uncredited photo is a licence breach, not a cosmetic gap.
      // heroPhotoTargetId is a top-level `let`, so it is NOT a window property:
      // `window.heroPhotoTargetId = ...` silently creates a shadow while the real
      // binding stays null, and the recipe is never found. Assign the identifier.
      // closeM is deliberately NOT stubbed — stubbing it leaves the overlay open
      // and the next test finds a dialog that will not close.
      var pcRecipes=recipes, pcSel=_photoSearchSelected, pcRes=_photoSearchResults,
          pcTarget=heroPhotoTargetId, pcFetch=window.fetch, pcUp=window.compressPhotoToDataUrl,
          pcSave=window.saveData, pcGrid=window.renderGrid, pcToast=window.toast;
      try{
        window.toast=function(){}; window.saveData=function(){}; window.renderGrid=function(){};
        window.fetch=function(){ return Promise.resolve({ ok:true, status:200,
          headers:{ get:function(k){ return /content-type/i.test(k) ? 'image/jpeg' : null; } },
          blob:function(){ return Promise.resolve(new Blob(['x'],{type:'image/jpeg'})); } }); };
        window.compressPhotoToDataUrl=function(){ return Promise.resolve('data:image/jpeg;base64,PICKED'); };
        recipes=[normalizeRecipe({ id:9301, name:'Credit target', ingredients:[], steps:['x'] })];
        heroPhotoTargetId=9301;
        _photoSearchResults=[{ url:'https://x/p.jpg', credit:'Ada Lens',
          creditUrl:'https://x/ada', license:'CC BY 4.0', sourceLabel:'Openverse' }];
        _photoSearchSelected=0;
        await useSelectedSearchPhoto();
        var pr=recipes[0];
        if(pr.photo!=='data:image/jpeg;base64,PICKED') throw new Error('the chosen photo was not applied at all');
        if(!pr.photoCredit || pr.photoCredit.name!=='Ada Lens')
          throw new Error('the photo was applied with no credit stored — a CC-BY photo would be published uncredited, which breaches its licence');

        // ...and a photo with no named creator must NOT gain an empty credit,
        // which would be a false claim of compliance.
        _photoSearchResults=[{ url:'https://x/q.jpg', license:'Pixabay licence', sourceLabel:'Pixabay' }];
        _photoSearchSelected=0;
        await useSelectedSearchPhoto();
        if(recipes[0].photoCredit)
          throw new Error('a credit was invented for a photo with no named creator: '+JSON.stringify(recipes[0].photoCredit));
      } finally {
        recipes=pcRecipes; _photoSearchSelected=pcSel; _photoSearchResults=pcRes;
        heroPhotoTargetId=pcTarget; window.fetch=pcFetch; window.compressPhotoToDataUrl=pcUp;
        window.saveData=pcSave; window.renderGrid=pcGrid; window.toast=pcToast;
        closeM('photoSearchOverlay');
      }
      var withCredit=photoCreditHtml({ photo:'data:x', photoCredit:{ name:'A Person', url:'https://example.com/p', license:'CC BY 4.0', source:'Openverse' } });
      ['A Person','CC BY 4.0','Openverse'].forEach(function(bit){
        if(withCredit.indexOf(bit)===-1) throw new Error('the credit line omits '+bit);
      });
      if(withCredit.indexOf('<script')!==-1) throw new Error('unescaped credit');
      var evil=photoCreditHtml({ photo:'data:x', photoCredit:{ name:'<img src=x onerror=alert(1)>' } });
      if(/<img src=x/.test(evil)) throw new Error('the credit name is injected as live HTML');
      if(photoCreditHtml({ photo:'data:x' })!=='') throw new Error('a photo with no credit produced a stray line');
      if(photoCreditHtml({ photoCredit:{ name:'X' } })!=='') throw new Error('credit shown for a recipe with no photo');
    } },
  { id:'export_docx_build', group:'Import/Export', name:'Word (.docx) builds a valid ZIP',
    test: async()=>{
      if(typeof makeDocxBlob!=='function') throw new Error('makeDocxBlob not defined');
      var blob=makeDocxBlob([{emoji:'🍝',name:'Test',category:'Dinner',difficulty:'Easy',prep:'5 min',servings:'2',ingredients:[{a:'1',n:'egg'}],steps:['Cook it'],photo:'',notes:'note',diets:['Keto'],source:'https://example.com/r'}]);
      if(!(blob instanceof Blob)) throw new Error('makeDocxBlob did not return a Blob');
      if(blob.size<200) throw new Error('DOCX blob suspiciously small ('+blob.size+' bytes)');
      var buf=new Uint8Array(await blob.arrayBuffer());
      if(buf[0]!==0x50||buf[1]!==0x4B) throw new Error('DOCX is not a valid ZIP — missing PK signature');
    } },
  { id:'coll_model_one_source_of_truth', group:'Import/Export', name:'A collection keeps its recipes in parts, and only there (v36.0)',
    test: async()=>{
      ['recipeParts','isCollection','allIngredients','allSteps','normalizePart','buildImportFromParsed']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      var ai = { collectionName:'Ten chestnut recipes', collectionNotes:'An intro', category:'Dinner',
        recipes:[
          { name:'Gnocchi', by:'Itai', ingredients:[{a:'1 kg',n:'potatoes',g:'for the gnocchi'},
                                                    {a:'25 g',n:'butter',g:'for the sauce'}], steps:['Bake','Fry'] },
          { name:'Soup', servings:'10', ingredients:[{a:'1 tbsp',n:'oil'}], steps:['Simmer'] },
          { name:'Pasta', ingredients:[{a:'2',n:'sweet potatoes'}], steps:['Boil'] }
        ] };
      var built = buildImportFromParsed(ai, 'https://example.com/x');
      if(built.kind!=='collection') throw new Error('three recipes did not build a collection, got '+built.kind);
      var r = normalizeRecipe(Object.assign({id:970001,uid:'t-coll'}, built.recipe));

      // The article's own title names the collection. Falling back to the first
      // recipe would label ten chestnut dishes "Gnocchi".
      if(r.name!=='Ten chestnut recipes') throw new Error('the collection is named "'+r.name+'"');
      if(r.notes.indexOf('An intro')===-1) throw new Error('the article intro was dropped');
      if(r.source!=='https://example.com/x') throw new Error('the source URL was dropped');

      // THE INVARIANT: parts are the only copy. A flattened duplicate in the
      // top-level fields is two copies that can drift, and no way to say which
      // is right — the mistake this app has paid for more than once.
      if(r.ingredients.length) throw new Error('a collection kept '+r.ingredients.length+' ingredients in the flat field as well as in parts');
      if(r.steps.length) throw new Error('a collection kept steps in the flat field as well as in parts');
      if(!isCollection(r)) throw new Error('isCollection is false for a recipe with parts');
      if(recipeParts(r).length!==3) throw new Error('expected 3 parts, got '+recipeParts(r).length);

      // ...so everything that wants the whole list must go through the accessor.
      if(allIngredients(r).length!==4) throw new Error('allIngredients returned '+allIngredients(r).length+', expected 4');
      if(allSteps(r).length!==4) throw new Error('allSteps returned '+allSteps(r).length+', expected 4');

      // Sub-headings inside one recipe are real cooking information. v36.4 turns
      // the article's own `g` into a HEADING LINE rather than a property on each
      // ingredient, so there is one grouping mechanism instead of two.
      var lines = ingredientLines(r);
      var heads = lines.filter(isSubLine).map(function(x){ return x.sub; });
      if(heads.indexOf('for the gnocchi')===-1)
        throw new Error('the article sub-heading was dropped: '+JSON.stringify(heads));
      if(lines.some(function(x){ return x && x.g; }))
        throw new Error('`g` survived alongside the heading line — two mechanisms for one thing');
      // And a heading is NOT an ingredient: the count must not have moved.
      if(allIngredients(r).length!==4)
        throw new Error('headings were counted as ingredients: '+allIngredients(r).length);
      // The items under it are indented; the ones before it are not.
      var gi = lines.findIndex(function(x){ return isSubLine(x) && x.sub==='for the gnocchi'; });
      if(!lineIndented(lines[gi+1])) throw new Error('the item under a sub-heading is not indented');
      if(recipeParts(r)[0].by!=='Itai') throw new Error('the per-recipe byline was dropped');
      if(recipeParts(r)[1].servings!=='10') throw new Error('per-recipe servings were dropped');

      // Each part carries its own identity from import, so promoting it later on
      // two devices produces ONE recipe rather than two.
      var uids = recipeParts(r).map(function(p){ return p.uid; });
      if(uids.some(function(u){ return !u; })) throw new Error('a part has no uid');
      if(new Set(uids).size!==uids.length) throw new Error('two parts share a uid');
      // ...and normalising again must not re-mint them.
      var before = uids.join(',');
      normalizeRecipe(r);
      if(recipeParts(r).map(function(p){ return p.uid; }).join(',')!==before)
        throw new Error('re-normalising minted new part uids, so identity is not stable');

      // A collection is never a clip, and the fixture has to ARRIVE as one for
      // that to be tested — asserting on data that was already false proves
      // nothing, and a no-op mutation survived on exactly that.
      var wasClip = normalizeRecipe(Object.assign({id:970003,uid:'clip-coll',isClip:true}, built.recipe));
      if(wasClip.isClip) throw new Error('a recipe that arrived as a clip stayed one after becoming a collection — both badges would render');
      if(!isCollection(wasClip)) throw new Error('the clip fixture did not become a collection');
      if(r.isClip) throw new Error('a collection was marked as a clip');

      // A single recipe is still a single recipe: no parts, nothing changed.
      var one = buildImportFromParsed({ recipes:[ai.recipes[1]] }, '');
      if(one.kind!=='single') throw new Error('one recipe built a '+one.kind);
      var sr = normalizeRecipe(Object.assign({id:970002}, one.recipe));
      if(isCollection(sr)) throw new Error('a single recipe became a collection');
      if(sr.ingredients.length!==1) throw new Error('a single recipe lost its ingredients');
      if(allIngredients(sr).length!==1) throw new Error('the accessor disagrees with a plain recipe');

      // Nothing usable in, nothing invented out.
      if(buildImportFromParsed({recipes:[]}, '').kind!=='none') throw new Error('an empty list produced a recipe');
      if(buildImportFromParsed(null, '').kind!=='none') throw new Error('null produced a recipe');
      if(buildImportFromParsed({recipes:[{name:'Heading only'}]}, '').kind!=='none')
        throw new Error('a heading with no ingredients or steps was imported as a recipe');
    } },

  { id:'test_fixtures_stay_local', group:'Storage', name:'A self test never puts its own recipes in the cloud (v36.2)',
    test: async()=>{
      // Tony ran the suite on his signed-in phone. All 219 passed — and it ended
      // in a red PHOTO_TOO_BIG box naming "ThumbTest", the 1.1 MB fixture the
      // thumbnail test injects into the LIVE recipes array before awaiting four
      // times. A sync fired inside that window and Firestore refused it. The
      // test cleans up; the window between unshift and cleanup is the bug.
      if(typeof cloudBound!=='function') throw new Error('cloudBound not defined');
      var real = normalizeRecipe({ id:7, uid:'real-one', name:'A real recipe' });
      var fixture = normalizeRecipe({ id:888911, uid:'fix', name:'ThumbTest', photo:'data:image/jpeg;base64,'+'A'.repeat(200) });
      var out = cloudBound([real, fixture]);
      if(out.length!==1) throw new Error('cloudBound let '+out.length+' of 2 through');
      if(out[0].id!==7) throw new Error('cloudBound kept the fixture and dropped the real recipe');
      if(!isTestFixture(fixture)) throw new Error('a fixture id was not recognised as one');
      if(isTestFixture(real)) throw new Error('a real recipe was mistaken for a fixture');
      // The boundary itself, in both directions.
      if(isTestFixture({id:TEST_ID_MIN-1})) throw new Error('an id just below the line is treated as a fixture');
      if(!isTestFixture({id:TEST_ID_MIN})) throw new Error('an id exactly on the line is not treated as a fixture');
      if(isTestFixture({})||isTestFixture(null)||isTestFixture({id:'888911'}))
        throw new Error('a missing or non-numeric id was treated as a fixture');

      // Deleting a fixture MUST queue a cloud delete. v36.2 refused to, on the
      // premise that a fixture was never in the cloud — false for the two that
      // already were, written on v36.1 before the write guard existed. The
      // refusal made exactly those two undeletable: the cloud copy survived
      // every local delete and came back on the next load. Tony deleted them
      // twice before it was spotted.
      var before = Object.keys(_pendingCloudDeletes).length;
      queueCloudDelete(888911);
      if(Object.keys(_pendingCloudDeletes).length===before)
        throw new Error('deleting a leftover fixture queues nothing, so the cloud copy can never be removed');
      unqueueCloudDelete(888911);
      queueCloudDelete(7);
      var queued = Object.keys(_pendingCloudDeletes).length!==before;
      unqueueCloudDelete(7);
      if(!queued) throw new Error('deleting a REAL recipe no longer queues a cloud delete');

      // ...and a fixture arriving FROM the cloud is dropped on read. This is
      // what actually stops it coming back: one device's delete cannot help the
      // others until it syncs, and any device loading first would resurrect it.
      var keptBase = _cloudRecipeBase, keptStamp = _cloudRecipeStamp, keptIds = _cloudRecipeIds;
      var pend = Object.assign({}, _pendingCloudDeletes);
      try{
        var got = parseCloudRecipeDocs([
          { id:'recipe_7',      data:{ r: JSON.stringify({id:7,name:'A real recipe'}), updatedAt: 1 } },
          { id:'recipe_888911', data:{ r: JSON.stringify({id:888911,name:'ThumbTest'}), updatedAt: 1 } },
          { id:'recipe_888913', data:{ r: JSON.stringify({id:888913,name:'MarkTest'}), updatedAt: 1 } }
        ]);
        var names = got.map(function(x){ return x.name; });
        if(names.indexOf('ThumbTest')!==-1 || names.indexOf('MarkTest')!==-1)
          throw new Error('a leftover fixture came back from the cloud: '+names.join(', '));
        if(names.indexOf('A real recipe')===-1) throw new Error('a real recipe was dropped as a fixture');
        if(!_pendingCloudDeletes[888911])
          throw new Error('the leftover cloud copy was not queued for removal, so it stays there for ever');
      } finally {
        _cloudRecipeBase = keptBase; _cloudRecipeStamp = keptStamp; _cloudRecipeIds = keptIds;
        _pendingCloudDeletes = pend;
      }

      // A family member without the admin role cannot delete from the shared
      // collection. For one of THEIR recipes that is worth saying; for leftover
      // test junk it is a box about a recipe they have never seen.
      var pend2 = Object.assign({}, _pendingCloudDeletes);
      try{
        _pendingCloudDeletes = {};
        queueCloudDelete(888911); queueCloudDelete(11);
        var denier = { collection: function(){ return { doc: function(){ return {
          delete: function(){ var e = new Error('nope'); e.code = 'permission-denied'; return Promise.reject(e); } }; } }; } };
        var res = await flushCloudDeletes(denier);
        if(res.denied.indexOf('888911')!==-1 || res.denied.indexOf(888911)!==-1)
          throw new Error('a refused fixture delete is reported to the user');
        if(res.denied.indexOf('11')===-1 && res.denied.indexOf(11)===-1)
          throw new Error('a refused delete of a REAL recipe is no longer reported: '+JSON.stringify(res.denied));
      } finally { _pendingCloudDeletes = pend2; }

      // And the line has to be where the suite actually works. Every fixture id
      // in this file must be above it, or the guard protects nothing.
      // v36.15 — the fixtures moved with the suite into self-tests.js; scanning
      // index.html found none of them and the check silently proved nothing
      // (it failed loudly only because of the "< 20" floor below, which is
      // exactly why that floor is there).
      var src = await (await fetch(new URL('self-tests.js?t='+Date.now(), location.href), {cache:'no-store'})).text();
      var ids = [], m, re = /(?:testId\s*=\s*|id:\s*)(\d{4,})/g;
      while((m = re.exec(src)) !== null) ids.push(+m[1]);
      var fixtures = ids.filter(function(n){ return n >= 100000; });
      if(fixtures.length < 20) throw new Error('only found '+fixtures.length+' fixture ids — the scan is not finding them');
      var stray = fixtures.filter(function(n){ return n < TEST_ID_MIN; });
      if(stray.length) throw new Error('fixture id(s) below TEST_ID_MIN would sync to the cloud: '+stray.join(', '));

      // A guard nothing calls is not a guard. Both of the paths that write
      // recipes to Firestore need real Firebase, so they cannot be driven here —
      // but their SOURCE can be read, and what it must not contain is a bare
      // `recipes`. Checking cloudBound() in isolation passed happily while both
      // call sites used the unfiltered array, which is the whole bug.
      // Comments AND quoted strings come out first: both functions talk about
      // "recipes" in the messages they show ("Your recipes synced fine…"), and
      // an English sentence is not a use of the array. Template literals are
      // left in, so a `${recipes…}` would still be caught.
      var nocomments = function(fn){
        return String(fn)
          .replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/[^\n]*/g,' ')
          .replace(/'(?:[^'\\\n]|\\.)*'/g,"''").replace(/"(?:[^"\\\n]|\\.)*"/g,'""');
      };
      [['saveToFirestore', saveToFirestore], ['syncCloudPhotos', syncCloudPhotos]].forEach(function(pair){
        var body = nocomments(pair[1]);
        if(body.indexOf('cloudBound(recipes)') === -1)
          throw new Error(pair[0]+' does not filter test fixtures out — cloudBound(recipes) is not called');
        var rest = body.split('cloudBound(recipes)').join('«guarded»');
        if(/\brecipes\b/.test(rest))
          throw new Error(pair[0]+' still reaches the unfiltered `recipes` array somewhere, '
            + 'so a fixture can reach the cloud: ' + (rest.match(/.{0,40}\brecipes\b.{0,30}/)||[''])[0].trim());
      });
    } },

  { id:'link_roundup_import', group:'Import/Export', name:'A page that only LINKS to its recipes still imports (v36.2)',
    test: async()=>{
      // "10 soups in 15 minutes" is ten names, ten ratings, ten photo credits
      // and ten links reading "to the recipe" — and not one ingredient. Every
      // heading is correctly refused for having no content, so before v36.2 the
      // whole import came back empty and offered a video bookmark instead.
      var realAi = window.aiCall, realFetch = window.fetch;
      var pageText = '10 great soups\nA winter round-up.\n'
        + 'Sweet potato soup\n58 ratings\nkosher vegan 10 minutes\nto the recipe\n'
        + 'Tomato soup\n48 ratings\nkosher vegan 15 minutes\nto the recipe\n'
        + 'Onion soup\n91 ratings\nkosher 10 minutes\nto the recipe\n';
      // As the Worker returns them: several links per recipe, plus site furniture.
      var links = [
        { href:'https://ynet.co.il/food', text:'Food' },
        { href:'https://ynet.co.il/topics/soup', text:'soup' },
        { href:'https://ynet.co.il/food/article/aaa', text:'kosher' },
        { href:'https://ynet.co.il/food/article/aaa2', text:'to the recipe' },
        { href:'https://ynet.co.il/food/article/bbb', text:'to the recipe' },
        { href:'https://ynet.co.il/food/article/ccc', text:'to the recipe' }
      ];
      var fetched = [];
      try{
        window.fetch = function(u, opts){
          var b = {}; try { b = JSON.parse((opts&&opts.body)||'{}'); } catch(e){}
          if(b.action === 'fetch-url'){
            fetched.push(b.url);
            var slug = b.url.slice(b.url.lastIndexOf('/')+1);
            return Promise.resolve(new Response(JSON.stringify({
              text:'Recipe page for '+slug+'\nIngredients: 2 onions 1 litre stock\n'
                 + 'Method:\n1. Fry the onions.\n2. Add the stock and simmer.\n'
                 + 'x '.repeat(40) }), { status:200 }));
          }
          return realFetch.apply(window, arguments);
        };
        window.aiCall = function(prompt){
          if(prompt.indexOf('LINKS TO its recipes')!==-1 || prompt.indexOf('links found on it')!==-1){
            return Promise.resolve(JSON.stringify({ collectionName:'10 great soups',
              collectionNotes:'A winter round-up.', category:'Soup',
              picks:[ {n:3,title:'Sweet potato soup'}, {n:4,title:'Tomato soup'}, {n:5,title:'Onion soup'} ] }));
          }
          var m = prompt.match(/Recipe page for (\w+)/);
          return Promise.resolve(JSON.stringify({ recipes:[{ name:'Page '+(m?m[1]:'?'),
            ingredients:[{a:'2',n:'onions'},{a:'1l',n:'stock'}], steps:['fry','simmer'] }] }));
        };

        var seen = [];
        var out = await extractRecipesFromLinks(pageText, links, 'https://ynet.co.il/food/article/roundup',
          function(done,total){ seen.push(done+'/'+total); });
        if(!out) throw new Error('a page of recipe links produced nothing at all');
        if(out.recipes.length!==3) throw new Error('got '+out.recipes.length+' recipes, not 3');
        if(fetched.length!==3) throw new Error('opened '+fetched.length+' pages, not 3 — the picks were not deduplicated');
        if(fetched.some(function(u){ return /topics|^https:\/\/ynet\.co\.il\/food$/.test(u); }))
          throw new Error('followed a navigation link: '+fetched.join(', '));
        // The round-up's own wording is the better name, and each recipe must
        // point at ITS page, not at the round-up.
        if(out.recipes[0].name!=='Sweet potato soup')
          throw new Error('the recipe is called "'+out.recipes[0].name+'", not what the round-up called it');
        // picks n:3/4/5 are links[3]=aaa2, links[4]=bbb, links[5]=ccc, in that order.
        if(out.recipes[0].source!=='https://ynet.co.il/food/article/aaa2')
          throw new Error('recipe 1 points at "'+out.recipes[0].source+'" instead of its own page');
        if(out.recipes[1].source!=='https://ynet.co.il/food/article/bbb')
          throw new Error('recipe 2 points at "'+out.recipes[1].source+'" instead of its own page');
        if(out.recipes[2].source!=='https://ynet.co.il/food/article/ccc')
          throw new Error('recipe 3 points at "'+out.recipes[2].source+'" instead of its own page');
        if(out.collectionName!=='10 great soups') throw new Error('the round-up title was lost');
        if(seen[seen.length-1]!=='3/3') throw new Error('progress never reached the end: '+seen.join(' '));

        // It must build the same kind of collection as any other import.
        var built = buildImportFromParsed(out, 'https://ynet.co.il/food/article/roundup');
        if(built.kind!=='collection') throw new Error('the assembled answer built a '+built.kind);
        if(built.recipe.parts.length!==3) throw new Error('the collection holds '+built.recipe.parts.length);

        // One page failing costs one recipe, not the import.
        fetched.length = 0;
        window.fetch = function(u, opts){
          var b = {}; try { b = JSON.parse((opts&&opts.body)||'{}'); } catch(e){}
          if(b.action === 'fetch-url'){
            if(/bbb/.test(b.url)) return Promise.resolve(new Response('{}', { status:502 }));
            return Promise.resolve(new Response(JSON.stringify({
              text:'Recipe page for ok\nIngredients: 2 onions\nMethod:\n1. Fry.\n'+'x '.repeat(40) }), { status:200 }));
          }
          return realFetch.apply(window, arguments);
        };
        var partial = await extractRecipesFromLinks(pageText, links, 'https://ynet.co.il/x');
        if(!partial) throw new Error('one dead link sank the whole import');
        if(partial.recipes.length!==2) throw new Error('got '+partial.recipes.length+' of the 2 that worked');
        if(partial._partial!==1) throw new Error('the import did not report that 1 of 3 was missing');

        // The SAME recipe reached by two different picks must be opened once.
        // A real round-up links each recipe three or four times.
        fetched.length = 0;
        window.fetch = function(u, opts){
          var b = {}; try { b = JSON.parse((opts&&opts.body)||'{}'); } catch(e){}
          if(b.action === 'fetch-url'){
            fetched.push(b.url);
            return Promise.resolve(new Response(JSON.stringify({
              text:'Recipe page\nIngredients: 2 onions\nMethod:\n1. Fry.\n'+'x '.repeat(40) }), { status:200 }));
          }
          return realFetch.apply(window, arguments);
        };
        window.aiCall = function(prompt){
          if(prompt.indexOf('LINKS to its recipes')!==-1)
            return Promise.resolve(JSON.stringify({ picks:[
              {n:2,title:'Sweet potato soup'}, {n:2,title:'Sweet potato soup again'},
              {n:3,title:'Tomato soup'} ] }));
          return Promise.resolve(JSON.stringify({ recipes:[{ name:'One',
            ingredients:[{a:'2',n:'onions'}], steps:['fry'] }] }));
        };
        var dedup = await extractRecipesFromLinks(pageText, links, 'https://ynet.co.il/x');
        if(fetched.length!==2) throw new Error('opened '+fetched.length+' pages for 2 distinct links — picks are not de-duplicated');
        if(dedup.recipes.length!==2) throw new Error('the same recipe came back twice');

        // Picks found, but EVERY page dead: that is a failure, not an empty
        // success. Returning {recipes:[]} would show a preview of nothing.
        window.fetch = function(u, opts){
          var b = {}; try { b = JSON.parse((opts&&opts.body)||'{}'); } catch(e){}
          if(b.action === 'fetch-url') return Promise.resolve(new Response('{}', { status:502 }));
          return realFetch.apply(window, arguments);
        };
        if(await extractRecipesFromLinks(pageText, links, 'https://ynet.co.il/x') !== null)
          throw new Error('every linked page failed and it still reported an import');

        // Not a link round-up at all. The per-recipe stub must keep WORKING here,
        // or "it returned nothing" proves nothing about the guard being tested.
        window.fetch = function(u, opts){
          var b = {}; try { b = JSON.parse((opts&&opts.body)||'{}'); } catch(e){}
          if(b.action === 'fetch-url') return Promise.resolve(new Response(JSON.stringify({
            text:'Recipe page\nIngredients: 2 onions\nMethod:\n1. Fry.\n'+'x '.repeat(40) }), { status:200 }));
          return realFetch.apply(window, arguments);
        };
        window.aiCall = function(prompt){
          if(prompt.indexOf('LINKS to its recipes')!==-1)
            return Promise.resolve(JSON.stringify({ picks:[] }));       // none are recipes
          return Promise.resolve(JSON.stringify({ recipes:[{ name:'Would have worked',
            ingredients:[{a:'2',n:'onions'}], steps:['fry'] }] }));
        };
        if(await extractRecipesFromLinks(pageText, links, 'https://ynet.co.il/x') !== null)
          throw new Error('a page whose links are not recipes still produced an import');
        // Too few links to be a round-up. The point of the guard is that no AI
        // call is PAID FOR — "it returned null" is true either way, so counting
        // the calls is the only way to know the guard is doing anything.
        var asked = 0;
        window.aiCall = function(){ asked++; return Promise.resolve(JSON.stringify({ picks:[] })); };
        if(await extractRecipesFromLinks(pageText, [], 'https://ynet.co.il/x') !== null)
          throw new Error('a page with no links at all still produced an import');
        if(await extractRecipesFromLinks(pageText, [links[0]], 'https://ynet.co.il/x') !== null)
          throw new Error('a page with one link still produced an import');
        if(asked) throw new Error('paid for '+asked+' AI call(s) on a page that cannot be a link round-up');
      } finally { window.aiCall = realAi; window.fetch = realFetch; }
    } },

  { id:'link_roundup_via_import', group:'Import/Export', name:'runUrlImport falls through to the links by itself (v36.2)',
    test: async()=>{
      // The routing, not the function. Three times in two releases a tested
      // function has shipped with a call site that never called it — so this
      // drives runUrlImport, the thing the button actually runs.
      var realFetch=window.fetch, realApply=window.applyParsedRecipe, realToast=window.toast;
      var input=document.getElementById('urlImportInput');
      var realVal=input?input.value:'', captured=null, opened=[];
      if(!input) throw new Error('the URL import field is gone');
      try{
        window.toast=function(){};
        window.applyParsedRecipe=function(r){ captured=r; };
        var roundup='10 great soups\nA winter round-up.\n'
          + 'Sweet potato soup\n58 ratings\nto the recipe\n'
          + 'Tomato soup\n48 ratings\nto the recipe\n'
          + 'Onion soup\n91 ratings\nto the recipe\n'+'padding '.repeat(30);
        var links=[{href:'https://x.test/food',text:'Food'},
                   {href:'https://x.test/food/article/aaa',text:'to the recipe'},
                   {href:'https://x.test/food/article/bbb',text:'to the recipe'}];
        window.fetch=function(u, opts){
          var b={}; try{ b=JSON.parse((opts&&opts.body)||'{}'); }catch(e){}
          if(b.action==='fetch-url'){
            if(/roundup/.test(b.url))
              return Promise.resolve(new Response(JSON.stringify({text:roundup, links:links}), {status:200}));
            opened.push(b.url);
            return Promise.resolve(new Response(JSON.stringify({text:
              'A soup\nIngredients: 2 onions 1l stock\nMethod:\n1. Fry.\n2. Simmer.\n'+'x '.repeat(40)}), {status:200}));
          }
          if(b.messages){
            var p=b.messages[0].content, ans;
            if(p.indexOf('LINKS to its recipes')!==-1)
              ans=JSON.stringify({collectionName:'10 great soups', category:'Soup',
                picks:[{n:1,title:'Sweet potato soup'},{n:2,title:'Tomato soup'}]});
            else if(p.indexOf('A soup')!==-1)
              ans=JSON.stringify({recipes:[{name:'A soup',ingredients:[{a:'2',n:'onions'}],steps:['fry']}]});
            else
              // The round-up itself: headings with NO content, which
              // buildImportFromParsed must refuse. This is the whole premise.
              ans=JSON.stringify({recipes:[{name:'Sweet potato soup'},{name:'Tomato soup'}]});
            return Promise.resolve(new Response(JSON.stringify({content:[{text:ans}],stop_reason:'end_turn'}), {status:200}));
          }
          return realFetch.apply(window, arguments);
        };
        input.value='https://x.test/food/article/roundup';
        await runUrlImport();
        if(!captured) throw new Error('a page of recipe links imported nothing — it never fell through to them');
        if(!recipeParts(normalizeRecipe(Object.assign({id:978001}, captured))).length)
          throw new Error('what came back is not a collection');
        if(opened.length!==2) throw new Error('opened '+opened.length+' recipe pages, not 2');
        if(opened.some(function(u){ return /\/food$/.test(u); }))
          throw new Error('it followed a navigation link: '+opened.join(', '));
      } finally {
        window.fetch=realFetch; window.applyParsedRecipe=realApply; window.toast=realToast;
        if(input) input.value=realVal;
        closeM('urlImportOverlay');
      }
    } },

  { id:'collect_into_collection', group:'Features', name:'Selected recipes can be gathered into a collection (v36.9)',
    test: async()=>{
      // The reverse of splitCollection. The thing that must not happen is a
      // recipe existing BOTH standalone and inside the collection — and the
      // thing that must not be silently lost is anything except the photo.
      var realToast=window.toast, realSave=window.saveData, realGrid=window.renderGrid,
          realFilters=window.renderFilters, realConfirm=window.askConfirm,
          realPrompt=window.askPrompt, realChoice=window.askChoice, realCancel=window.cancelSelectMode,
          realCollPhoto=window.chooseCollectionPhoto;
      var before=recipes.slice(), beforeId=nextId, beforeSel=selectedIds;
      var pend=Object.assign({}, _pendingCloudDeletes);
      try{
        window.toast=function(){}; window.saveData=function(){}; window.renderGrid=function(){};
        window.renderFilters=function(){}; window.cancelSelectMode=function(){};
        // The photo offer opens a real modal, so it is stubbed — but stubbed as
        // a SPY, because "the pool it was handed" is the only thing that proves
        // the photos were copied out before the originals were thrown away.
        var offered=null;
        window.chooseCollectionPhoto=function(c,p){ offered={coll:c, pool:p}; return Promise.resolve(); };
        var dialog='';
        window.askConfirm=function(o){ dialog=(o&&o.message)||''; return Promise.resolve(true); };
        window.askPrompt=function(){ return Promise.resolve('Winter soups'); };

        recipes.unshift(normalizeRecipe({ id:978001, uid:'g1', name:'Onion soup', category:'Soup', bg:'#fff',
          photo:'data:image/jpeg;base64,'+'A'.repeat(40),
          ingredients:[{a:'3',n:'onions'}], steps:['Fry'] }));
        recipes.unshift(normalizeRecipe({ id:978002, uid:'g2', name:'Tomato soup', category:'Soup', bg:'#fff',
          fav:true, cookCount:4, lastCooked:1700000000000,
          ingredients:[{a:'5',n:'tomatoes'}], steps:['Roast'] }));
        var total=recipes.length;
        selectedIds=new Set([978001,978002]);
        await collectSelectedInto(null);

        var coll=recipes.find(function(r){ return isCollection(r) && r.name==='Winter soups'; });
        if(!coll) throw new Error('no collection was created');
        if(recipeParts(coll).length!==2) throw new Error('it holds '+recipeParts(coll).length+' recipes, not 2');
        // Neither original may remain in the list.
        if(recipes.some(function(r){ return r.id===978001 || r.id===978002; }))
          throw new Error('a recipe is now BOTH standalone and inside the collection');
        if(recipes.length!==total-1)
          throw new Error('the library changed by '+(recipes.length-total)+', expected -1 (two out, one collection in)');
        // ...and the cloud copies must go, or the next load brings them back
        // alongside the collection that already contains them.
        if(!_pendingCloudDeletes[978001] || !_pendingCloudDeletes[978002])
          throw new Error('the standalone cloud copies were not queued for deletion');

        // Everything a part can carry comes along; only the photo does not.
        var parts=recipeParts(coll);
        var tom=parts.filter(function(x){ return x.name==='Tomato soup'; })[0];
        if(!tom) throw new Error('a selected recipe did not arrive');
        if(!tom.fav) throw new Error('the favourite was lost on the way in');
        if(tom.cookCount!==4) throw new Error('the cook count was lost: '+tom.cookCount);
        if(!tom.lastCooked) throw new Error('the cooked date was lost');
        if(parts.some(function(x){ return x.photo; })) throw new Error('a part kept a photo');
        // The uid travels, so lifting it back out later is the SAME recipe
        // rather than a duplicate — the rule that makes promoting safe.
        if(parts.filter(function(x){ return x.uid==='g1'; }).length!==1)
          throw new Error('a recipe lost its identity on the way into the collection');
        // And the user was told about the photo BEFORE it happened.
        if(!/photo will be lost/i.test(dialog))
          throw new Error('the confirmation did not mention losing the photo: '+dialog);
        // The whole sentence, not a fragment of it: the fragment alone survived
        // a mutation that deleted the half saying what is being offered.
        if(!/offered it as the collection’s own photo/.test(dialog))
          throw new Error('the confirmation did not say the photo could be kept for the collection: '+dialog);

        // v36.10 — the doomed photo is offered to the new collection, and the
        // offer carries the actual image, not just the recipe's name.
        if(!offered) throw new Error('a new collection was created without offering it a photo');
        if(offered.coll!==coll) throw new Error('the photo was offered for the wrong recipe');
        if(offered.pool.length!==1)
          throw new Error('the photo pool held '+offered.pool.length+' photo(s), expected the 1 that existed');
        if(offered.pool[0].name!=='Onion soup')
          throw new Error('the offered photo is attributed to "'+offered.pool[0].name+'"');
        if((offered.pool[0].photo||'').indexOf('data:image/jpeg;base64,')!==0)
          throw new Error('the offered photo is not the image itself: '+String(offered.pool[0].photo).slice(0,40));

        // Adding to an EXISTING collection appends and keeps a way back.
        recipes.unshift(normalizeRecipe({ id:978003, uid:'g3', name:'Barley soup', category:'Soup',
          bg:'#fff', ingredients:[{a:'1',n:'barley'}], steps:['Boil'] }));
        selectedIds=new Set([978003]);
        window.askChoice=function(){ return Promise.resolve(coll.id); };
        offered=null;
        await addSelectedToCollection();
        if(offered) throw new Error('adding to an EXISTING collection asked about its photo again');
        var after=recipes.find(function(r){ return r.id===coll.id; });
        if(recipeParts(after).length!==3) throw new Error('adding gave '+recipeParts(after).length+' parts, not 3');
        if(recipeParts(after)[2].name!=='Barley soup') throw new Error('it was not appended at the end');
        if(recipes.some(function(r){ return r.id===978003; })) throw new Error('the added recipe is still standalone');
        if(!(after.history||[]).length) throw new Error('adding to a collection left no way back');

        // A collection cannot be added to itself.
        selectedIds=new Set([coll.id]);
        var n=recipeParts(after).length;
        await collectSelectedInto(coll.id);
        if(recipeParts(recipes.find(function(r){return r.id===coll.id;})).length!==n)
          throw new Error('a collection was added to itself');

        // An empty or whitespace name must be refused, not quietly replaced with
        // something generic — a collection called "Collection" is worse than
        // being asked again.
        recipes.unshift(normalizeRecipe({ id:978004, uid:'g4', name:'Pea soup', category:'Soup',
          bg:'#fff', ingredients:[{a:'1',n:'peas'}], steps:['Boil'] }));
        selectedIds=new Set([978004]);
        var countNow=recipes.length, told='';
        window.toast=function(m){ told=String(m||''); };
        window.askPrompt=function(){ return Promise.resolve('   '); };
        await collectSelectedInto(null);
        if(recipes.length!==countNow) throw new Error('a collection was created from a blank name');
        if(!/name/i.test(told)) throw new Error('it did not say a name is needed: "'+told+'"');
        // Cancelling the name prompt must do nothing at all.
        window.askPrompt=function(){ return Promise.resolve(null); };
        await collectSelectedInto(null);
        if(recipes.length!==countNow) throw new Error('cancelling the name prompt still created something');
        if(!recipes.some(function(r){ return r.id===978004; }))
          throw new Error('cancelling removed the recipe anyway');
        window.toast=function(){};
        window.askPrompt=function(){ return Promise.resolve('Winter soups'); };

        // Selecting a COLLECTION contributes its recipes rather than nesting.
        var flat = selectionAsParts([after]);
        if(flat.length!==3) throw new Error('a selected collection did not contribute its '+3+' recipes: '+flat.length);
        if(flat.some(isSubLine)) throw new Error('something that is not a recipe was contributed');
      } finally {
        window.toast=realToast; window.saveData=realSave; window.renderGrid=realGrid;
        window.renderFilters=realFilters; window.askConfirm=realConfirm;
        window.askPrompt=realPrompt; window.askChoice=realChoice; window.cancelSelectMode=realCancel;
        window.chooseCollectionPhoto=realCollPhoto;
        recipes.length=0; before.forEach(function(x){ recipes.push(x); });
        nextId=beforeId; selectedIds=beforeSel; _pendingCloudDeletes=pend;
      }
    } },

  { id:'collect_bar_and_guards', group:'UI', name:'The select bar offers both collection routes (v36.9)',
    test: async()=>{
      var bar=document.getElementById('selectBar');
      if(!bar) throw new Error('the select bar is gone');
      var html=bar.innerHTML;
      if(html.indexOf('collectSelectedInto(null)')===-1)
        throw new Error('no "New collection" button in the select bar');
      if(html.indexOf('addSelectedToCollection()')===-1)
        throw new Error('no "Add to collection" button in the select bar');
      if(typeof askChoice!=='function') throw new Error('askChoice not defined');

      // Nothing selected must not create an empty collection.
      var realToast=window.toast, realConfirm=window.askConfirm, realPrompt=window.askPrompt;
      var before=recipes.slice(), beforeSel=selectedIds, said='';
      try{
        window.toast=function(m){ said=String(m||''); };
        window.askConfirm=function(){ throw new Error('it asked to confirm with nothing selected'); };
        window.askPrompt=function(){ throw new Error('it asked for a name with nothing selected'); };
        selectedIds=new Set();
        await collectSelectedInto(null);
        if(recipes.length!==before.length) throw new Error('an empty collection was created');
        if(!/select/i.test(said)) throw new Error('it did not say why nothing happened: "'+said+'"');
        // ...and with no collections at all, "Add to" must say so rather than
        // opening an empty chooser.
        said='';
        recipes.length=0;
        recipes.push(normalizeRecipe({id:978101,uid:'x',name:'Lonely',bg:'#fff',
          ingredients:[{a:'1',n:'x'}],steps:['s']}));
        selectedIds=new Set([978101]);
        await addSelectedToCollection();
        if(!/no collections/i.test(said))
          throw new Error('with no collections it did not explain: "'+said+'"');
      } finally {
        window.toast=realToast; window.askConfirm=realConfirm; window.askPrompt=realPrompt;
        recipes.length=0; before.forEach(function(x){ recipes.push(x); }); selectedIds=beforeSel;
      }
    } },

  { id:'part_keeps_its_own_source', group:'Features', name:'A recipe keeps its source in and out of a collection (v36.11)',
    test: async()=>{
      // Tony's loss: a video clip's whole content is its Source. Gathering it
      // into a collection dropped the field AND then normalizeRecipe binned the
      // part entirely, because a clip has no ingredients and no steps.
      var clip = normalizeRecipe({ id:978301, uid:'clip1', name:'Pasta clip', category:'Dinner',
        bg:'#fff', isClip:true, source:'https://youtu.be/abc123',
        ingredients:[], steps:[] });
      if(!clip.isClip) throw new Error('the fixture is not a clip');

      var part = recipeToPart(clip);
      if(part.source!=='https://youtu.be/abc123')
        throw new Error('the source did not survive becoming a part: "'+part.source+'"');
      if(!part.isClip) throw new Error('the clip flag did not survive becoming a part');

      // ...and a collection built from it must still CONTAIN it.
      var coll = normalizeRecipe({ id:978302, uid:'c1', name:'Clips', category:'Dinner', bg:'#fff',
        source:'https://example.com/the-collection', parts:[part] });
      if(recipeParts(coll).length!==1)
        throw new Error('the clip was dropped from the collection — the whole recipe, not just its source');
      if(recipeParts(coll)[0].source!=='https://youtu.be/abc123')
        throw new Error('the stored part lost its source');

      // A heading the AI invented is still refused: no content, and no clip
      // flag to excuse it. That is what the filter is for.
      var junk = normalizeRecipe({ id:978303, uid:'c2', name:'Book', category:'Dinner', bg:'#fff',
        parts:[{ uid:'h', name:'For the sauce', ingredients:[], steps:[] },
               { uid:'r', name:'Real', ingredients:[{a:'1',n:'x'}], steps:[] }] });
      if(recipeParts(junk).length!==1)
        throw new Error('an empty non-clip part was kept: '+recipeParts(junk).length+' parts');

      // Viewed inside the collection, it points at ITS page, not the collection's.
      var view = partAsRecipe(coll, recipeParts(coll)[0], partRef(coll.id, 'clip1'));
      if(view.source!=='https://youtu.be/abc123')
        throw new Error('opened inside the collection it shows "'+view.source+'"');
      if(!view.isClip) throw new Error('it stopped being a clip inside the collection');
      // A part with no source of its own still inherits the collection's.
      var borrowed = partAsRecipe(coll, normalizePart({ uid:'n', name:'No source',
        ingredients:[{a:'1',n:'x'}], steps:['s'] }, 0), 'c1:n');
      if(borrowed.source!=='https://example.com/the-collection')
        throw new Error('a part with no source of its own did not fall back to the collection');

      // And the collection view SHOWS it — a link, not just a stored field.
      var html = collectionSectionsHtml(coll);
      if(html.indexOf('https://youtu.be/abc123')===-1)
        throw new Error('the collection view does not show the recipe’s source at all');
      if(!/<a [^>]*href="https:\/\/youtu\.be\/abc123"/.test(html))
        throw new Error('the source is shown as text rather than as a link you can follow');
      if(html.indexOf('Ingredients')!==-1)
        throw new Error('a clip was drawn with an empty Ingredients column, which reads as broken');

      // Lifting it back out must cost nothing at all.
      var rich = normalizePart({ uid:'g', name:'Cooked one', ingredients:[{a:'1',n:'x'}], steps:['s'],
        source:'https://example.com/one', fav:true, cookCount:4, lastCooked:1700000000000,
        cookLog:[{id:'a',at:1,rating:5,note:''}], diets:['Keto'] }, 0);
      var coll2 = normalizeRecipe({ id:978304, uid:'c3', name:'Book', category:'Soup', bg:'#fff',
        diets:['Vegan'], parts:[rich] });
      var back = recipeFromPart(coll2, recipeParts(coll2)[0]);
      if(back.source!=='https://example.com/one')
        throw new Error('promoting gave it the COLLECTION’s source: "'+back.source+'"');
      if(!back.fav) throw new Error('promoting dropped the favourite');
      if(back.cookCount!==4) throw new Error('promoting dropped the cook count: '+back.cookCount);
      if(!back.lastCooked) throw new Error('promoting dropped the cooked date');
      if(!(back.cookLog||[]).length) throw new Error('promoting dropped the cook log');
      if((back.diets||[]).indexOf('Keto')===-1)
        throw new Error('promoting gave it the collection’s diets instead of its own: '+JSON.stringify(back.diets));
      // A clip promoted back out is still a clip.
      var backClip = recipeFromPart(coll, recipeParts(coll)[0]);
      if(!backClip.isClip) throw new Error('a clip lifted out of a collection stopped being a clip');
      if(backClip.source!=='https://youtu.be/abc123') throw new Error('a clip lifted out lost its link');
    } },

  { id:'share_one_recipe_from_a_collection', group:'Features', name:'Every Share route reaches a recipe inside a collection (v36.13)',
    test: async()=>{
      // Four of the five buttons in the Share sheet looked the id up in
      // `recipes`, and a part reference is never in there: WhatsApp and Copy
      // threw on undefined, Email and Save-as-page returned silently. Only
      // "Share via…" worked, because it reused the recipe toggleShare had
      // already resolved — which is why this survived three releases.
      var realToast=window.toast, realOpen=window.open, realPage=window.buildRecipePage,
          realBlobUrl=window.URL.createObjectURL,
          realClip=(navigator.clipboard||{}).writeText;
      var before=recipes.slice();
      try{
        window.toast=function(){};
        recipes.length=0;
        // The part has NO meal type or difficulty of its own — it inherits.
        recipes.push(normalizeRecipe({ id:978601, uid:'sc', name:'Weeknight', category:'Soup',
          difficulty:'Hard', bg:'#fff', source:'https://example.com/book',
          parts:[{ uid:'inh', name:'Onion soup', ingredients:[{a:'3',n:'onions'}], steps:['Fry them'] }] }));
        var ref = partRef(978601, 'inh');
        if(!findRecipeRef(ref)) throw new Error('the part reference does not resolve at all');

        // What gets SHARED must carry real values, not blanks: partAsRecipe
        // settles the inheritance before any builder sees the recipe.
        var txt = rText(findRecipeRef(ref));
        if(txt.indexOf('Category: Soup')===-1 || txt.indexOf('Difficulty: Hard')===-1)
          throw new Error('the shared text does not carry the inherited meal type/difficulty: '+txt.split('\n')[1]);
        if(txt.indexOf('Onion soup')===-1) throw new Error('the shared text is not the recipe inside');
        if(buildPrintHtml([findRecipeRef(ref)]).indexOf('Soup | Hard')===-1)
          throw new Error('the printed copy lost the inherited meal type/difficulty');

        // Now the buttons themselves, called exactly as toggleShare wires them.
        var opened=null;
        window.open=function(u){ opened=u; return null; };
        doWhatsApp(ref);
        if(!opened) throw new Error('WhatsApp did nothing for a recipe inside a collection');
        if(decodeURIComponent(opened).indexOf('Onion soup')===-1)
          throw new Error('WhatsApp sent something that is not this recipe: '+String(opened).slice(0,60));

        var copied=null;
        if(navigator.clipboard){
          try{ navigator.clipboard.writeText=function(t){ copied=t; return Promise.resolve(); }; }catch(e){}
          doCopy(ref);
          await Promise.resolve();
          if(copied===null) throw new Error('Copy did nothing for a recipe inside a collection');
          if(copied.indexOf('Category: Soup')===-1)
            throw new Error('the copied text lost the inherited meal type');
        }

        showEmailModal(ref);
        var em=document.getElementById('emailModalOverlay');
        if(!em) throw new Error('Email did nothing for a recipe inside a collection');
        if((em.textContent||'').indexOf('Onion soup')===-1)
          throw new Error('the email is not about this recipe');
        em.remove();

        // Save-as-page: prove it gets PAST the lookup, without downloading
        // anything into Tony's browser when he runs the suite there.
        var handed=null;
        window.buildRecipePage=function(r){ handed=r; return '<html></html>'; };
        window.URL.createObjectURL=function(){ throw new Error('no download during a test'); };
        shareAsPage(ref);
        if(!handed) throw new Error('Save-as-page did nothing for a recipe inside a collection');
        if(handed.name!=='Onion soup') throw new Error('Save-as-page was handed "'+handed.name+'"');
        if(handed.category!=='Soup') throw new Error('Save-as-page lost the inherited meal type');

        // An id that resolves to nothing must be handled, not thrown on.
        opened=null;
        doWhatsApp('c999999:nope');
        if(opened) throw new Error('a dead reference still opened a share');
      } finally {
        window.toast=realToast; window.open=realOpen; window.buildRecipePage=realPage;
        window.URL.createObjectURL=realBlobUrl;
        if(navigator.clipboard && realClip){ try{ navigator.clipboard.writeText=realClip; }catch(e){} }
        var stray=document.getElementById('emailModalOverlay'); if(stray) stray.remove();
        recipes.length=0; before.forEach(function(x){ recipes.push(x); });
      }
    } },

  { id:'part_category_and_difficulty', group:'Features', name:'Meal type and difficulty are per-recipe, and searchable (v36.12)',
    test: async()=>{
      var dinner = normalizeRecipe({ id:978501, uid:'d1', name:'Roast chicken', category:'Dinner',
        difficulty:'Hard', bg:'#fff', diets:['Keto'], ingredients:[{a:'1',n:'chicken'}], steps:['Roast it slowly'] });
      var pud = normalizeRecipe({ id:978502, uid:'d2', name:'Sticky pudding', category:'Dessert',
        difficulty:'Easy', bg:'#fff', diets:['Vegetarian'], ingredients:[{a:'1',n:'dates'}], steps:['Steam it'] });

      var coll = normalizeRecipe({ id:978503, uid:'cc', name:'Sunday', category:'Dinner',
        difficulty:'Hard', bg:'#fff', parts:[recipeToPart(dinner), recipeToPart(pud)] });
      var parts = recipeParts(coll);
      if(parts[1].category!=='Dessert')
        throw new Error('the dessert became "'+parts[1].category+'" — both took the first recipe’s meal type');
      if(parts[1].difficulty!=='Easy')
        throw new Error('the dessert’s difficulty became "'+parts[1].difficulty+'"');

      // Opened inside the collection, and lifted out of it, each is itself.
      var view = partAsRecipe(coll, parts[1], partRef(coll.id,'d2'));
      if(view.category!=='Dessert' || view.difficulty!=='Easy')
        throw new Error('inside the collection it reads '+view.category+'/'+view.difficulty);
      var out = recipeFromPart(coll, parts[1]);
      if(out.category!=='Dessert' || out.difficulty!=='Easy')
        throw new Error('lifted back out it reads '+out.category+'/'+out.difficulty);

      // A part with none of its own still inherits the collection's, so an
      // existing book needs no migration.
      var plain = normalizePart({ uid:'p', name:'Plain', ingredients:[{a:'1',n:'x'}], steps:['s'] }, 0);
      if(plain.category!=='' || plain.difficulty!=='')
        throw new Error('a part was given an invented meal type/difficulty: '+plain.category+'/'+plain.difficulty);
      if(partAsRecipe(coll, plain, 'c:p').category!=='Dinner')
        throw new Error('a part with no meal type of its own did not inherit the collection’s');

      // SEARCHABLE — the whole point. Each must be findable by the collection.
      if(!recipeMatchesQuery(coll,'dessert'))
        throw new Error('searching "dessert" does not find the collection holding one');
      if(!recipeMatchesQuery(coll,'easy'))
        throw new Error('searching a difficulty finds nothing — difficulty was never searched at all');
      if(!recipeMatchesQuery(coll,'sticky pudding'))
        throw new Error('searching for a recipe INSIDE a collection by name finds nothing');
      if(!recipeMatchesQuery(coll,'steam'))
        throw new Error('the method of a recipe inside a collection is not searchable');
      if(recipeMatchesQuery(coll,'zzznotathing'))
        throw new Error('the search now matches everything');
      // A flat recipe gained difficulty search too.
      if(!recipeMatchesQuery(dinner,'hard'))
        throw new Error('an ordinary recipe is still not findable by difficulty');
      // An indented step is a {t,ind} object; String() on it is "[object
      // Object]", which is why it never matched before.
      var indented = normalizeRecipe({ id:978504, uid:'i1', name:'Indented', category:'Dinner', bg:'#fff',
        ingredients:[{a:'1',n:'x'}], steps:[{ sub:'First stage' }, { t:'Whisk the aquafaba', ind:1 }] });
      if(!recipeMatchesQuery(indented,'aquafaba'))
        throw new Error('an indented step is not searchable');

      // ...and the card says WHY it matched, rather than showing a collection
      // name with no connection to what was typed.
      var why = matchReason(coll, 'sticky pudding');
      if(why.indexOf('Sticky pudding')===-1)
        throw new Error('the card does not say which recipe inside it matched: "'+why+'"');
      if(matchReason(coll,'easy').indexOf('Easy')===-1)
        throw new Error('a difficulty match is not explained on the card');

      // The meal-type filter must see it too, or per-recipe categories are
      // invisible to the one control that filters by them.
      var cats = recipeCategories(coll);
      if(cats.indexOf('Dessert')===-1)
        throw new Error('the meal-type filter cannot see the dessert inside: '+cats.join(', '));
      var dts = recipeDiets(coll);
      if(dts.indexOf('Vegetarian')===-1 || dts.indexOf('Keto')===-1)
        throw new Error('the diet filter cannot see the diets inside: '+dts.join(', '));

      // And the collection view shows each recipe's own, without repeating the
      // collection's under a part that simply inherits it.
      var html = collectionSectionsHtml(coll);
      if(html.indexOf('Dessert')===-1) throw new Error('the collection view hides a recipe’s own meal type');
      var inherits = normalizeRecipe({ id:978505, uid:'cd', name:'Book', category:'Soup', difficulty:'Easy',
        bg:'#fff', parts:[{ uid:'q', name:'Plain', ingredients:[{a:'1',n:'x'}], steps:['s'] }] });
      if(collectionSectionsHtml(inherits).indexOf('Soup')!==-1)
        throw new Error('the collection’s own meal type was repeated under a recipe that merely inherits it');
    } },

  { id:'collect_never_loses_a_recipe', group:'Features', name:'Gathering refuses rather than silently dropping one (v36.11)',
    test: async()=>{
      // The guard that would have saved Tony's clip: the originals are deleted
      // from the list AND the cloud immediately afterwards, so a part quietly
      // discarded on the way in is a recipe gone for good.
      var realToast=window.toast, realSave=window.saveData, realGrid=window.renderGrid,
          realFilters=window.renderFilters, realConfirm=window.askConfirm, realPrompt=window.askPrompt,
          realCancel=window.cancelSelectMode, realPhoto=window.chooseCollectionPhoto,
          realNorm=window.normalizePart;
      var before=recipes.slice(), beforeId=nextId, beforeSel=selectedIds;
      var pend=Object.assign({}, _pendingCloudDeletes);
      var said='';
      try{
        window.saveData=function(){}; window.renderGrid=function(){}; window.renderFilters=function(){};
        window.cancelSelectMode=function(){}; window.chooseCollectionPhoto=function(){ return Promise.resolve(); };
        window.askConfirm=function(){ return Promise.resolve(true); };
        window.askPrompt=function(){ return Promise.resolve('Doomed'); };
        window.toast=function(m){ said=String(m||''); };

        recipes.unshift(normalizeRecipe({ id:978401, uid:'k1', name:'Keeper', category:'Soup',
          bg:'#fff', ingredients:[{a:'1',n:'x'}], steps:['s'] }));
        recipes.unshift(normalizeRecipe({ id:978402, uid:'k2', name:'Also keeper', category:'Soup',
          bg:'#fff', ingredients:[{a:'2',n:'y'}], steps:['s'] }));
        var n=recipes.length;
        // v36.32 — what matters is that no NEW collection appears, not that the
        // library contains none. Tony has made collections; on his library this
        // test failed on both his devices from the first assertion, and said
        // "a short collection was created and kept" about one he made in March.
        var collectionsBefore=recipes.filter(isCollection).map(function(r){ return r.id; });
        selectedIds=new Set([978401,978402]);
        // Force the exact failure: a normalizePart that strips one part's
        // content, so the collection silently comes out one recipe short.
        window.normalizePart=function(p, i){
          var out=realNorm(p, i);
          if(out.name==='Also keeper'){ out.ingredients=[]; out.steps=[]; out.isClip=false; out.source=''; }
          return out;
        };
        await collectSelectedInto(null);

        var madeNow=recipes.filter(isCollection)
          .filter(function(r){ return collectionsBefore.indexOf(r.id)===-1; });
        if(madeNow.length)
          throw new Error('a short collection was created and kept: '+JSON.stringify(madeNow[0].name));
        if(recipes.length!==n)
          throw new Error('the library changed by '+(recipes.length-n)+' — something was created or destroyed');
        if(!recipes.some(function(r){ return r.id===978401; }) ||
           !recipes.some(function(r){ return r.id===978402; }))
          throw new Error('an original was deleted even though the collection was refused');
        if(_pendingCloudDeletes[978401] || _pendingCloudDeletes[978402])
          throw new Error('a cloud copy was queued for deletion after the collection was refused');
        if(!/could not be stored/i.test(said))
          throw new Error('it did not say why nothing happened: "'+said+'"');
      } finally {
        window.normalizePart=realNorm;
        window.toast=realToast; window.saveData=realSave; window.renderGrid=realGrid;
        window.renderFilters=realFilters; window.askConfirm=realConfirm; window.askPrompt=realPrompt;
        window.cancelSelectMode=realCancel; window.chooseCollectionPhoto=realPhoto;
        recipes.length=0; before.forEach(function(x){ recipes.push(x); });
        nextId=beforeId; selectedIds=beforeSel; _pendingCloudDeletes=pend;
      }
    } },

  { id:'collection_photo_cards', group:'Features', name:'A new collection is offered its recipes’ photos (v36.10)',
    test: async()=>{
      if(typeof chooseCollectionPhoto!=='function') throw new Error('chooseCollectionPhoto not defined');
      var realToast=window.toast, realSave=window.saveData, realGrid=window.renderGrid,
          realPicker=window.showPhotoSourcePicker;
      var A='data:image/jpeg;base64,'+'A'.repeat(24);
      var B='data:image/jpeg;base64,'+'B'.repeat(24);
      try{
        window.toast=function(){}; window.saveData=function(){}; window.renderGrid=function(){};
        var coll={ id:978201, name:'Winter soups', photo:'', updatedAt:0 };
        var pool=[{name:'Onion soup', photo:A}, {name:'Tomato soup', photo:B, credit:{name:'Someone'}}];

        var p=chooseCollectionPhoto(coll, pool);
        var ov=document.getElementById('collPhotoOverlay');
        if(!ov) throw new Error('no photo chooser opened');
        var cards=ov.querySelectorAll('.coll-photo-card[data-i]');
        if(cards.length!==2) throw new Error('the chooser drew '+cards.length+' cards, expected one per photo (2)');
        // Assert the PICTURE is on the card. A card showing only a name would
        // pass a count check and be useless for choosing a photo.
        var srcs=Array.prototype.map.call(cards, function(c){
          var im=c.querySelector('img'); return im ? im.getAttribute('src') : null; });
        if(srcs[0]!==A || srcs[1]!==B)
          throw new Error('the cards do not carry the actual photos: '+JSON.stringify(srcs).slice(0,80));
        if((cards[1].textContent||'').indexOf('Tomato soup')===-1)
          throw new Error('a card does not say which recipe its photo came from');
        if(!ov.querySelector('#collPhotoNew')) throw new Error('no “Create new” card');
        if(!ov.querySelector('#collPhotoSkip')) throw new Error('no way to decline a photo');

        cards[1].click();
        await p;
        if(document.getElementById('collPhotoOverlay')) throw new Error('the chooser stayed open after a pick');
        if(coll.photo!==B) throw new Error('picking a card did not give the collection that photo');
        if(!coll.photoCredit) throw new Error('the photo credit did not travel with the photo');
        if(!coll.updatedAt) throw new Error('the collection was not marked changed, so the pick would not sync');

        // “Create new” hands over to the recipe photo sheet, pointed at THIS
        // collection — not at whatever recipe was last touched.
        var asked=null;
        window.showPhotoSourcePicker=function(id,nm){ asked={id:id, name:nm}; };
        var p2=chooseCollectionPhoto(coll, []);
        var ov2=document.getElementById('collPhotoOverlay');
        if(ov2.querySelectorAll('.coll-photo-card[data-i]').length!==0)
          throw new Error('cards were drawn for an empty pool');
        if(!ov2.querySelector('#collPhotoNew'))
          throw new Error('with no photos to offer, “Create new” is the only route and it is missing');
        ov2.querySelector('#collPhotoNew').click();
        await p2;
        if(!asked) throw new Error('“Create new” did not open the Upload / Take / Search sheet');
        if(asked.id!==978201) throw new Error('the photo sheet was pointed at id '+asked.id+', not the collection');

        // Escape must leave the collection exactly as it was.
        var p3=chooseCollectionPhoto(coll, pool);
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        await p3;
        if(document.getElementById('collPhotoOverlay')) throw new Error('Escape did not close the chooser');
        if(coll.photo!==B) throw new Error('Escape changed the photo');
      } finally {
        var stray=document.getElementById('collPhotoOverlay'); if(stray) stray.remove();
        window.toast=realToast; window.saveData=realSave; window.renderGrid=realGrid;
        window.showPhotoSourcePicker=realPicker;
      }
    } },

  { id:'sec_proxy_needs_consent', group:'Network', name:'A relay never sees a URL without consent (v36.18)',
    test: async()=>{
      ['proxyConsent','proxyConsentState','setProxyConsent'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var prev = proxyConsentState();
      var realAsk = window.askConfirm;
      try{
        // Default is ASK, not allow. A fresh device must not silently relay.
        setProxyConsent('ask');
        if(proxyConsentState()!=='ask') throw new Error('the default is not "ask"');

        // Declining means no.
        var shown = null;
        window.askConfirm = function(o){ shown = o; return Promise.resolve({ ok:false, checked:false }); };
        if(await proxyConsent('https://example.com/a-recipe'))
          throw new Error('declining still allowed the relay');
        if(!shown) throw new Error('nothing was asked at all');
        if(!shown.checkbox) throw new Error('the dialog offered no "never ask again" tick');
        if((shown.message||'').indexOf('example.com')===-1)
          throw new Error('the dialog does not name the site being imported');
        if(!/not ours|relay/i.test(shown.message||''))
          throw new Error('the dialog does not explain what a relay is');
        // Declining must NOT be remembered — it is a one-off no.
        if(proxyConsentState()!=='ask') throw new Error('a decline was remembered as a permanent answer');

        // Allowing once, without the tick, does not persist.
        window.askConfirm = function(){ return Promise.resolve({ ok:true, checked:false }); };
        if(!await proxyConsent('https://example.com/x')) throw new Error('allowing did not allow');
        if(proxyConsentState()!=='ask')
          throw new Error('allowing once was remembered even though the box was not ticked');

        // Allowing WITH the tick persists, and stops asking.
        window.askConfirm = function(){ return Promise.resolve({ ok:true, checked:true }); };
        if(!await proxyConsent('https://example.com/y')) throw new Error('allowing with the tick did not allow');
        if(proxyConsentState()!=='always') throw new Error('the tick was not remembered');
        var askedAgain = false;
        window.askConfirm = function(){ askedAgain = true; return Promise.resolve({ ok:false, checked:false }); };
        if(!await proxyConsent('https://example.com/z'))
          throw new Error('a remembered "always" did not allow');
        if(askedAgain) throw new Error('it asked again after "never show this message again"');

        // ...and the setting can be taken back.
        setProxyConsent('ask');
        if(proxyConsentState()!=='ask') throw new Error('the choice cannot be reset');
      } finally {
        window.askConfirm = realAsk;
        setProxyConsent(prev === 'always' ? 'always' : 'ask');
      }

      // The importer must actually call the gate before any relay fetch.
      var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'})).text();
      var i = src.indexOf('Fall back to browser CORS proxies');
      var block = src.slice(i, src.indexOf('Extract recipe from page text'));
      if(!block) throw new Error('could not find the relay fallback to check');
      if(block.indexOf('proxyConsent(')===-1)
        throw new Error('the relay fallback does not ask for consent — URLs would leave silently');
      if(block.indexOf('proxyConsent(') > block.indexOf('fetch(makeProxy'))
        throw new Error('consent is asked AFTER the first relay fetch — too late');
    } },

  { id:'sec_remote_html_is_inert', group:'Network', name:'Remote HTML never executes (v36.17)',
    test: async()=>{
      // A URL import can fall back to a third-party CORS proxy, and whatever it
      // relays was parsed with `div.innerHTML`. A DETACHED div is NOT safe:
      // measured in a browser, <img onerror> and <video onerror> both fire from
      // a node never added to the document. That was arbitrary script in this
      // origin — the Firestore session, the Worker app key, every recipe.
      //
      // Drive the payloads, do not reason about them.
      var fired = [];
      window.__inertProbe = function(tag){ fired.push(tag); };
      var hostile = '<img src="x" onerror="window.__inertProbe(\'img\')">'
        + '<video src="x" onerror="window.__inertProbe(\'video\')"></video>'
        + '<svg onload="window.__inertProbe(\'svg\')"></svg>'
        + '<iframe srcdoc="&lt;script&gt;parent.__inertProbe(\'iframe\')&lt;/script&gt;"></iframe>'
        + '<p>Fry the onions slowly.</p>';
      try{
        var doc = new DOMParser().parseFromString(hostile, 'text/html');
        doc.querySelectorAll('script,style,nav,footer,header,aside,iframe,noscript')
           .forEach(function(el){ el.remove(); });
        var text = ((doc.body && doc.body.textContent) || '').trim();
        // Give any handler a chance to fire before concluding it did not.
        await new Promise(function(r){ setTimeout(r, 400); });
        if(fired.length)
          throw new Error('remote HTML executed: ' + fired.join(', ') + ' — this is script in our origin');
        if(text.indexOf('Fry the onions slowly')===-1)
          throw new Error('the inert parse also lost the recipe text, so it is not a usable replacement');

        // ...and the importer must not have gone back to innerHTML.
        var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'})).text();
        var proxyBlock = src.slice(src.indexOf('Fall back to browser CORS proxies'),
                                   src.indexOf('Extract recipe from page text'));
        if(!proxyBlock) throw new Error('could not find the CORS-proxy fallback to check');
        // Only the FETCHED html matters here; `res.innerHTML = spinner(...)` in
        // the same block is the app's own markup and is fine.
        if(/\.innerHTML\s*=\s*(html|raw|body|text)\b/.test(proxyBlock))
          throw new Error('the CORS-proxy fallback assigns fetched HTML to innerHTML again — it would execute');
        if(proxyBlock.indexOf('DOMParser')===-1)
          throw new Error('the CORS-proxy fallback no longer parses inertly');
      } finally { try{ delete window.__inertProbe; }catch(e){} }
    } },

  { id:'selftests_are_a_separate_download', group:'Storage', name:'The suite is not inside index.html (v36.15)',
    test: async()=>{
      // The whole point of the split: 590 KB of developer tool must not ship to
      // a phone that will never run it. If the suite ever gets inlined again,
      // everything still passes — which is exactly why this has to be checked.
      ['loadSelfTests','selfTestsEnabled','setSelfTestsEnabled','applySelfTestVisibility']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(window._selfTestsLoaded!==true)
        throw new Error('the suite is running but _selfTestsLoaded was never set — the loader cannot tell it arrived');
      if(!Array.isArray(window.SELF_TESTS) || window.SELF_TESTS.length<100)
        throw new Error('window.SELF_TESTS holds '+(window.SELF_TESTS||[]).length+' tests');

      var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'})).text();
      if(src.indexOf("{ id:'ui_header'")!==-1)
        throw new Error('the test suite is inlined in index.html again — every device is downloading it');
      if(src.indexOf('self-tests.js')===-1)
        throw new Error('index.html does not reference self-tests.js, so the suite can never be fetched');
      // A ceiling with headroom, not a tripwire on every edit. Raised to 1300
      // in v36.40: the two structural checks above are what actually prove the
      // suite is not inlined, and they both passed while this fired — the app
      // itself grew about 70 KB across v36.31–v36.39 (the translation engine,
      // its editor, the harvest and scrape, the long-job panel and the sign-in
      // check). Raising a budget for real growth is honest; leaving it to fire
      // and be ignored is not, and neither is a message that names a cause it
      // has not established.
      // Raised to 1400 in v36.63, the same way: the audit's six blocks added
      // ~35 KB of real features (security guards, device storage, the family
      // backup record, the AI cost line, the parallel translation lanes). The
      // go-public work's build step (WP-A) is where minification belongs.
      var kb = Math.round(src.length/1024);
      if(kb > 1400) throw new Error('index.html is '+kb+' KB. The suite itself is NOT inlined — that is '
        + 'checked above — so this is the app growing. Either something large went in that should not '
        + 'have, or the budget needs raising on purpose rather than by accident.');

      // Default OFF, and the menu entry follows the setting.
      var prev = null;
      try{ prev = localStorage.getItem(SELFTESTS_KEY); }catch(e){}
      try{
        try{ localStorage.removeItem(SELFTESTS_KEY); }catch(e){}
        if(selfTestsEnabled()) throw new Error('the suite defaults to ON — every device would fetch it');
        applySelfTestVisibility();
        var item = document.getElementById('selfTestMenuItem');
        if(!item) throw new Error('#selfTestMenuItem missing');
        if(getComputedStyle(item).display!=='none')
          throw new Error('the menu entry shows on a device that never opted in');
        setSelfTestsEnabled(true);
        if(getComputedStyle(item).display==='none')
          throw new Error('the menu entry stays hidden after the setting was turned on');
        setSelfTestsEnabled(false);
        if(getComputedStyle(item).display!=='none')
          throw new Error('turning the setting off did not hide the menu entry again');
      } finally {
        try{ if(prev===null) localStorage.removeItem(SELFTESTS_KEY); else localStorage.setItem(SELFTESTS_KEY, prev); }catch(e){}
        applySelfTestVisibility();
      }
    } },

  { id:'ai_model_routing', group:'Network', name:'The right model is asked, and cached per model (v36.15)',
    test: async()=>{
      // Two things this pins. First, the model actually SENT — the pin was two
      // generations old and dearer than the current one, and nothing noticed
      // because no test ever read the request body. Second, that the cache keys
      // on the model: a Haiku answer served for a Sonnet request would be
      // invisible and wrong.
      if(typeof AI_MODEL!=='string' || !AI_MODEL) throw new Error('AI_MODEL not set');
      if(typeof AI_MODEL_SMALL!=='string' || !AI_MODEL_SMALL) throw new Error('AI_MODEL_SMALL not set');
      if(AI_MODEL===AI_MODEL_SMALL)
        throw new Error('the small-job model is the same as the main one — the routing saves nothing');
      if(/sonnet-4-5|claude-3|-2024|-2025/.test(AI_MODEL))
        throw new Error('AI_MODEL is pinned to a superseded model: '+AI_MODEL);

      // The cache must not confuse the two.
      var k1=aiCacheKey('same prompt', 100, AI_MODEL);
      var k2=aiCacheKey('same prompt', 100, AI_MODEL_SMALL);
      if(k1===k2) throw new Error('the cache key ignores the model — one model’s answer would be served for the other');

      // Drive a real aiCall and read the body that would go to the Worker.
      var realFetch=window.fetch, sent=[];
      var prevCache=null;
      prevCache=_aiCacheParkForTest();
      try{
        window.fetch=function(u, opts){
          var b={}; try{ b=JSON.parse((opts&&opts.body)||'{}'); }catch(e){}
          sent.push(b.model);
          return Promise.resolve({ ok:true, status:200, json:function(){
            return Promise.resolve({ content:[{ text:'ok' }] }); } });
        };
        await aiCall('routing probe A '+Date.now(), 50);
        await aiCall('routing probe B '+Date.now(), 50, null, AI_MODEL_SMALL);
        if(sent.length!==2) throw new Error('expected 2 calls, saw '+sent.length);
        if(sent[0]!==AI_MODEL) throw new Error('the default call asked for "'+sent[0]+'", not '+AI_MODEL);
        if(sent[1]!==AI_MODEL_SMALL) throw new Error('the routed call asked for "'+sent[1]+'", not '+AI_MODEL_SMALL);
      } finally {
        window.fetch=realFetch;
        _aiCacheRestoreForTest(prevCache);
      }

      // The cache is big enough to be worth having.
      if(AI_CACHE_MAX < 200) throw new Error('the AI cache holds only '+AI_CACHE_MAX+' entries');
      if(AI_CACHE_TTL < 14*24*60*60*1000) throw new Error('the AI cache expires after under a fortnight');
    } },

  { id:'sec_photo_bytes_via_worker', group:'Network', name:'A photo\u2019s bytes come through the Worker, and only the Worker (v36.30)',
    test: async()=>{
      if(typeof fetchPhotoBlob!=='function') throw new Error('fetchPhotoBlob not defined');
      var realFetch=window.fetch;
      function imgResp(){
        return { ok:true, status:200, headers:{ get:function(k){ return /content-type/i.test(k) ? 'image/png' : null; } },
          blob:function(){ return Promise.resolve(new Blob([new Uint8Array([137,80,78,71])],{type:'image/png'})); } };
      }
      function jsonResp(status, obj){
        var r={ ok:status<400, status:status, headers:{get:function(){return 'application/json';}},
          json:function(){ return Promise.resolve(obj); },
          blob:function(){ return Promise.resolve(new Blob([JSON.stringify(obj)],{type:'application/json'})); } };
        r.clone=function(){ return r; }; return r;
      }
      try{
        // (1) The Worker is asked, with the app key, and the photo host is never
        // touched directly. That is the whole point: one named host in
        // connect-src instead of "anywhere on https".
        var hits=[];
        window.fetch=function(u, opts){
          hits.push({ u:String(u), body:(opts&&opts.body)||'' });
          if(String(u).indexOf(WORKER_ENDPOINT)===0) return Promise.resolve(imgResp());
          return Promise.reject(new Error('the photo host was fetched directly'));
        };
        var blob=await fetchPhotoBlob('https://live.staticflickr.com/1/2_3_b.jpg');
        if(!blob || !blob.size) throw new Error('no bytes came back');
        if(hits.length!==1) throw new Error('expected one request, saw '+hits.length);
        if(hits[0].u.indexOf(WORKER_ENDPOINT)!==0) throw new Error('it did not go through the Worker');
        var sent={}; try{ sent=JSON.parse(hits[0].body); }catch(e){}
        if(sent.action!=='photo-fetch') throw new Error('wrong action: '+sent.action);
        if(sent.url!=='https://live.staticflickr.com/1/2_3_b.jpg') throw new Error('the url was not passed on');
        if(!sent.appKey) throw new Error('the app key was left off, so the Worker would refuse it');

        // (2) v36.30 — there is NO direct retry any more. With the bare `https:`
        // gone from connect-src a direct fetch is a blocked request, not a
        // rescue, so a refusal must fail loudly rather than reach for the photo
        // host and produce a console error nobody reads.
        hits.length=0;
        window.fetch=function(u){
          hits.push(String(u));
          if(String(u).indexOf(WORKER_ENDPOINT)===0) return Promise.resolve(jsonResp(429, {error:'RATE_LIMIT: too many'}));
          return Promise.resolve(imgResp());
        };
        var threw=false, msg='';
        try{ await fetchPhotoBlob('https://e.test/a.png'); }catch(e){ threw=true; msg=e.message||''; }
        if(!threw) throw new Error('a refused photo-fetch did not fail');
        if(hits.length!==1 || hits[0].indexOf(WORKER_ENDPOINT)!==0)
          throw new Error('it still tries the photo host directly: '+JSON.stringify(hits));
        if(msg.indexOf('RATE_LIMIT')===-1)
          throw new Error('the Worker\u2019s own explanation was thrown away: "'+msg+'"');

        // …and when the Worker gives no explanation, the message must still
        // point somewhere useful rather than blaming the photo site.
        window.fetch=function(){ return Promise.resolve(jsonResp(502, {})); };
        msg='';
        try{ await fetchPhotoBlob('https://e.test/b.png'); }catch(e){ msg=e.message||''; }
        if(!/Sync Health/.test(msg))
          throw new Error('a bare failure does not say where to look: "'+msg+'"');

        // (3) A 200 that is NOT an image must not be treated as one. Compressing
        // an error document into a recipe photo is the failure this guards.
        window.fetch=function(){ return Promise.resolve(jsonResp(200, {error:'nope'})); };
        threw=false;
        try{ await fetchPhotoBlob('https://e.test/c.png'); }catch(e){ threw=true; }
        if(!threw) throw new Error('a JSON answer was passed off as the photo');
      } finally { window.fetch=realFetch; }

      // (4) Both photo paths must use it. One left on a bare fetch() is one that
      // the CSP now blocks outright.
      var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'})).text();
      var code = src.replace(/^\s*\/\/.*$/gm, '');
      var uses = (code.match(/fetchPhotoBlob\(/g) || []).length;
      if(uses < 3) throw new Error('only '+(uses-1)+' call site uses fetchPhotoBlob — expected the auto-fetch and the picker');
      if(/var\s+imgResp\s*=\s*await\s+fetch\(/.test(code) || /resp\s*=\s*await\s+fetch\(img\.url\)/.test(code))
        throw new Error('a photo is still downloaded with a bare fetch()');

      // (5) The fallback and the CSP move TOGETHER. A direct retry with `https:`
      // removed is a blocked request; a bare `https:` with no fallback is an
      // open door for nothing. Either half alone is a bug, so both are asserted
      // against each other rather than separately.
      var csp = (src.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
      var connect = (csp.match(/connect-src ([^;]+)/) || [])[1] || '';
      var hasFallback = /var direct = await fetch\(url/.test(code);
      var hasWildcard = /(^|\s)https:(\s|$)/.test(connect);
      if(hasFallback && !hasWildcard)
        throw new Error('connect-src no longer allows the direct fallback that fetchPhotoBlob still performs');
      if(!hasFallback && hasWildcard)
        throw new Error('the fallback is gone, so the bare `https:` in connect-src can come out too');
    } },

  { id:'ai_system_is_its_own_block', group:'Network', name:'Standing instructions are a system block, not part of the question (v36.19)',
    test: async()=>{
      // Until v36.19 the help assistant sent
      //   'System: ' + HELP_SYSTEM_PROMPT + '\n\nUser: ' + question
      // as ONE user turn. A question — or a page of imported text — containing
      // the word "System:" therefore sat at exactly the same level as the real
      // instructions. It is also the only shape prompt caching can work in.
      var realFetch=window.fetch, sent=[], prevCache=null;
      prevCache=_aiCacheParkForTest();
      try{
        window.fetch=function(u, opts){
          var b={}; try{ b=JSON.parse((opts&&opts.body)||'{}'); }catch(e){}
          sent.push(b);
          return Promise.resolve({ ok:true, status:200, json:function(){
            return Promise.resolve({ content:[{ text:'ok' }] }); } });
        };
        await aiCall('what does the star do?'+Date.now(), 50, null, null, 'YOU ARE THE HELP. Answer briefly.');
        var b=sent[0];
        if(!b) throw new Error('nothing was sent');
        if(!Array.isArray(b.system)) throw new Error('system was not sent as its own block: '+JSON.stringify(b.system));
        if(b.system[0].text.indexOf('YOU ARE THE HELP')===-1)
          throw new Error('the instructions did not reach the system block');
        if(String(b.messages[0].content).indexOf('YOU ARE THE HELP')!==-1)
          throw new Error('the instructions are ALSO in the user turn — they are being sent twice, and paid for twice');
        if(!b.system[0].cache_control)
          throw new Error('no cache breakpoint on the standing instructions');

        // A call with no system argument must not grow an empty one — an empty
        // system block is a 400 from the API.
        sent.length=0;
        await aiCall('plain call '+Date.now(), 50);
        if('system' in sent[0]) throw new Error('a call with no instructions still sent a system field');
      } finally {
        window.fetch=realFetch;
        _aiCacheRestoreForTest(prevCache);
      }

      // The cache must tell two different sets of instructions apart.
      if(aiCacheKey('q', 50, null, 'you are a chef') === aiCacheKey('q', 50, null, 'you are a doctor'))
        throw new Error('the cache key ignores the system prompt — one set of instructions would answer for the other');
      if(aiCacheKey('q', 50, null, 'x') === aiCacheKey('q', 50, null, null))
        throw new Error('the cache key cannot tell "with instructions" from "without"');

      // And the help assistant must actually use it.
      var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'})).text();
      if(src.indexOf("'System: '+HELP_SYSTEM_PROMPT") !== -1 || src.indexOf('"System: "+HELP_SYSTEM_PROMPT') !== -1)
        throw new Error('the help assistant still splices its instructions into the user turn');
      var uses = (src.match(/AI_MODEL_SMALL,\s*HELP_SYSTEM_PROMPT/g) || []).length;
      if(uses < 2) throw new Error('only '+uses+' help call site passes the instructions as a system block — expected 2');
    } },

  { id:'ai_our_own_refusal_is_final', group:'Network', name:'A Worker spend ceiling is not retried five times (v36.19)',
    test: async()=>{
      // The Worker now has daily and monthly ceilings on the AI bill. Those come
      // back as 429, and the 429 branch retried FOUR times with exponential
      // backoff before giving up — half a minute of spinner to arrive at an
      // answer that could not change. Anthropic's own 429 still IS retried,
      // because that one genuinely clears; only our Worker sets `rateLimited`.
      var realFetch=window.fetch, calls=0, prevCache=null;
      prevCache=_aiCacheParkForTest();
      // The retry path backs off 2s, 4s, 8s, 16s. Driving it for real cost this
      // suite THIRTY SECONDS of doing nothing, on every run, on every device —
      // measured at 30,004ms, twenty times the next slowest test. The waiting is
      // not what is under test; the number of attempts is. So sleep is stubbed
      // out and the same assertions hold in a few milliseconds.
      var realSleep=window.sleep;
      window.sleep=function(){ return Promise.resolve(); };
      function resp(body){
        var text=JSON.stringify(body);
        var r={ ok:false, status:429, headers:{ get:function(){ return null; } },
          json:function(){ return Promise.resolve(JSON.parse(text)); },
          text:function(){ return Promise.resolve(text); } };
        r.clone=function(){ return r; };
        return r;
      }
      try{
        // Ours: refuse once, immediately, in the Worker's own words.
        window.fetch=function(){ calls++; return Promise.resolve(resp({
          error:"SPEND_CAP: this Worker's own daily ceiling for AI calls has been reached (300/300).",
          rateLimited:true, spendCap:'daily' })); };
        var msg='';
        try{ await aiCall('cap probe '+Date.now(), 50); } catch(e){ msg=e.message||''; }
        if(calls!==1) throw new Error('our own ceiling was retried '+calls+' times');
        if(msg.indexOf('SPEND_CAP')===-1)
          throw new Error('the Worker’s own explanation was replaced with a generic one: '+msg);

        // Anthropic's: still worth waiting out, so it must still be retried, to
        // exhaustion, and end in the GENERIC rate-limit message.
        //
        // Counting the calls is not enough on its own. A version that
        // short-circuits every 429 still gets retried here, because the body it
        // throws is Anthropic's error OBJECT, which stringifies to
        // "[object Object]" and looks to aiRetryable like a bare network
        // failure. The count was identical and the test passed while the
        // behaviour was wrong — so the MESSAGE is asserted too.
        calls=0;
        window.fetch=function(){ calls++; return Promise.resolve(resp({
          type:'error', error:{ type:'rate_limit_error', message:'overloaded' } })); };
        var busyMsg='';
        try{ await aiCall('busy probe '+Date.now(), 50); } catch(e){ busyMsg=(e&&e.message)||''; }
        if(calls<5) throw new Error('an Anthropic 429 was retried '+calls+' times, expected 5');
        if(!/Rate limit reached/.test(busyMsg))
          throw new Error('an Anthropic 429 did not end in the generic rate-limit message: "'+busyMsg+'"');
      } finally {
        window.fetch=realFetch; window.sleep=realSleep;
        _aiCacheRestoreForTest(prevCache);
      }
      if(aiRetryable(new Error('SPEND_CAP: daily ceiling')))
        throw new Error('a spend ceiling is marked retryable');
      if(aiRetryable(new Error('RATE_LIMIT: too many requests in the last minute')))
        throw new Error('the Worker’s per-minute refusal is marked retryable');
    } },

  { id:'ui_content_language', group:'UI', name:'A Hebrew recipe is marked as Hebrew (v36.25)',
    test: async()=>{
      ['textLang','langAttr','applyContentLang'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      // <html lang="en"> is correct — the INTERFACE is English. What was missing
      // is that roughly half the recipes are not, and a screen reader then reads
      // Hebrew with an English voice, which is not "accented" but unintelligible.
      //
      // Since v36.31 the interface itself can be another language and this
      // attribute follows it, which is right. The literal 'en' below is not a
      // stale assumption: v36.32 puts the interface back to English for the
      // duration of a run, so this is 'en' during a run whatever Tony is
      // reading. Do not "fix" it to i18nLang() — that reads the stored
      // preference, which is still Hebrew while the DOM is English.
      if(document.documentElement.lang !== 'en')
        throw new Error('the document language is "'+document.documentElement.lang+'" — the UI is English');

      if(textLang('מרק בצל')!=='he') throw new Error('Hebrew was not recognised');
      if(textLang('Onion Soup')!=='en') throw new Error('English was marked as Hebrew');
      if(textLang('עוגת Pavlova')!=='he')
        throw new Error('a mixed name with Hebrew in it should be marked Hebrew');
      if(textLang('')!=='en' || textLang(null)!=='en') throw new Error('empty text should not be Hebrew');
      if(langAttr('שלום').indexOf('lang="he"')===-1) throw new Error('langAttr is not emitting the attribute');

      // Drive the walk over real elements, including the fields a recipe is
      // typed INTO — a textarea keeps its text in .value, not .textContent, and
      // getting that wrong marks every Hebrew recipe being written as English.
      var fix=document.createElement('div');
      fix.innerHTML='<div dir="auto">מרק בצל</div>'
                  + '<div dir="auto">Onion Soup</div>'
                  + '<textarea dir="auto"></textarea>'
                  + '<div>מרק</div>';          // no dir="auto" — chrome, not content
      fix.querySelector('textarea').value='קצף בצל';
      document.body.appendChild(fix);
      try{
        applyContentLang(fix);
        var els=fix.querySelectorAll('div, textarea');
        if(els[0].getAttribute('lang')!=='he') throw new Error('a Hebrew line was not marked he');
        if(els[1].getAttribute('lang')!=='en') throw new Error('an English line was not marked en');
        if(fix.querySelector('textarea').getAttribute('lang')!=='he')
          throw new Error('a textarea was read by textContent, so anything being typed reads as English');
        if(els[els.length-1].getAttribute('lang'))
          throw new Error('an element without dir="auto" was touched — that is chrome, not recipe text');

        // It must be idempotent: re-rendering happens constantly.
        var changed=applyContentLang(fix);
        if(changed!==0) throw new Error('a second pass rewrote '+changed+' attributes');
      } finally { fix.remove(); }

      // The generated HTML has no live DOM to walk, so those carry it inline.
      var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'})).text();
      var code = src.replace(/^\s*\/\/.*$/gm, '');
      var inline = (code.match(/langAttr\(/g) || []).length;
      if(inline < 5) throw new Error('only '+inline+' generated-HTML sites carry lang — print and email need it too');
      if(!/applyContentLang\(g\)/.test(code)) throw new Error('the grid is never marked');
      if(!/applyContentLang\(document\.getElementById\('viewModal'\)\)/.test(code))
        throw new Error('the open recipe is never marked');
    } },

  { id:'ui_privacy_note', group:'UI', name:'The app says what leaves this device, accurately (v36.25)',
    test: async()=>{
      ['privacyEntries','showPrivacyPanel'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      var list=privacyEntries();
      if(list.length < 6) throw new Error('only '+list.length+' services listed');
      var blob=JSON.stringify(list);
      // Every third party the app can actually reach has to be in here. A
      // privacy note that omits one is worse than none, because it reads as
      // complete.
      ['Firebase','Anthropic','Cloudflare','Pixabay','relay','Bring'].forEach(function(who){
        if(blob.indexOf(who)===-1) throw new Error(who+' is not in the list of what leaves this device');
      });
      list.forEach(function(e){
        if(!e.who || !e.when || !e.sends) throw new Error('an entry is missing who/when/sends: '+JSON.stringify(e));
        // "what it IS" is not the question; "what is SENT" is.
        if(e.sends.length < 40) throw new Error('"'+e.who+'" does not actually say what is sent');
      });
      // The relay entry has to reflect the real setting, or the note is stale
      // the moment someone ticks "never ask again".
      var relayEntry=list.filter(function(e){ return /relay/i.test(e.who); })[0];
      var prev=proxyConsentState();
      try{
        setProxyConsent('always');
        var whenAlways=privacyEntries().filter(function(e){ return /relay/i.test(e.who); })[0].when;
        setProxyConsent('ask');
        var whenAsk=privacyEntries().filter(function(e){ return /relay/i.test(e.who); })[0].when;
        if(whenAlways===whenAsk)
          throw new Error('the note says the same thing whether relays are always allowed or not');
      } finally { setProxyConsent(prev==='always'?'always':'ask'); }

      // It renders, and it is reachable from both places that promise it.
      showPrivacyPanel();
      try{
        var ov=document.getElementById('privacyOverlay');
        if(!ov || !ov.classList.contains('open')) throw new Error('the panel did not open');
        var txt=document.getElementById('privacyBody').textContent;
        if(txt.indexOf('Anthropic')===-1) throw new Error('the panel rendered without its content');
        if(!/no analytics/i.test(txt)) throw new Error('it does not say whether anything is tracked');
        // It is linked from the LOGIN screen, whose z-index is 9999 — a panel
        // at the default 200 would open behind the screen that linked to it.
        if(parseInt(getComputedStyle(ov).zIndex,10) <= 9999)
          throw new Error('the privacy panel sits below the login screen that links to it');
      } finally { closeM('privacyOverlay'); }

      if(!document.querySelector('#settingsDrop button[onclick*="showPrivacyPanel"]'))
        throw new Error('it is not in the Settings menu');
      var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'})).text();
      // The comment beside the change quotes the old sentence on purpose. The
      // question is what the app SAYS, so scan with the commentary taken out.
      var markup = src.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
      if(markup.indexOf('never stores your data on our servers') !== -1)
        throw new Error('the login screen still makes the old unqualified claim');
      if(!/login-privacy[\s\S]{0,500}showPrivacyPanel/.test(markup))
        throw new Error('the login screen does not link to the note');
    } },

  { id:'ui_worker_version_is_visible', group:'UI', name:'Sync Health says which Worker is live (v36.29)',
    test: async()=>{
      if(typeof checkWorkerHealth!=='function') throw new Error('checkWorkerHealth not defined');
      if(!document.getElementById('syncHealthBody')) throw new Error('no #syncHealthBody');

      // The Worker is deployed BY HAND, separately from the app. Three releases
      // running needed a paste only Tony could do, and nothing in the app could
      // say whether it had landed — "I pasted it" and "it deployed" are
      // different facts. This is the second one, on screen.
      var realFetch=window.fetch, realHealth=_workerHealth;
      function body(){ return document.getElementById('syncHealthBody').textContent; }
      try{
        window.fetch=function(){ return Promise.resolve({ json:function(){ return Promise.resolve({
          ok:true, version:'v40', appKeyRequired:true, appKeyAccepted:true,
          spend:{ dailyUsed:7, dailyMax:300 } }); } }); };
        _workerHealth=null; await checkWorkerHealth();
        if(body().indexOf('v40')===-1) throw new Error('the live Worker version is not shown');
        if(body().indexOf('7 of 300')===-1)
          throw new Error('the AI ceiling is not shown, so there is no way to see the bill approaching it');

        // Unreachable must READ as unreachable, not as an empty row that looks
        // like everything is fine.
        window.fetch=function(){ return Promise.reject(new Error('down')); };
        _workerHealth=null; await checkWorkerHealth();
        if(!/could not be reached/.test(body()))
          throw new Error('an unreachable Worker does not say so');

        // A refused app key is the other failure that looks like nothing.
        window.fetch=function(){ return Promise.resolve({ json:function(){ return Promise.resolve({
          ok:true, version:'v40', appKeyRequired:true, appKeyAccepted:false }); } }); };
        _workerHealth=null; await checkWorkerHealth();
        if(!/refusing this app/.test(body()))
          throw new Error('a rejected app key is not reported');

        // It must not re-ask on every render — the panel re-renders repeatedly
        // while it is open, and this is a network call.
        var calls=0;
        window.fetch=function(){ calls++; return Promise.resolve({ json:function(){
          return Promise.resolve({ ok:true, version:'v40' }); } }); };
        _workerHealth=null; await checkWorkerHealth();
        await checkWorkerHealth(); await checkWorkerHealth();
        if(calls!==1) throw new Error('it pinged the Worker '+calls+' times for three renders');
      } finally { window.fetch=realFetch; _workerHealth=realHealth; }

      if(!document.querySelector('#settingsDrop button[onclick*="openSyncHealth"]'))
        throw new Error('Sync Health is not reachable from Settings');
    } },

  { id:'i18n_translates_all_of_it', group:'UI', name:'Every button is translated, not just the easy ones (v36.32)',
    test: async()=>{
      ['i18nInstall','i18nPlaceholderChild','i18nEdges','i18nMissingList','i18nGapList']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      // The exact shapes that were being thrown away. A button whose text sits
      // next to an <svg> icon, and a checkbox row — the Clips button and every
      // line of the Meal and Diet panels. The old rule said "a non-inline child
      // means this is not one sentence" and dropped the whole element, so those
      // strings were never even offered to the translator. Tony found them by
      // reading his own app in Hebrew.
      var host=document.createElement('div');
      host.innerHTML='<button id="zzIcon"><svg width="4" height="4"><path d="M0 0"/></svg>Clips</button>'
        + '<label id="zzChk"><input type="checkbox">🌅 Breakfast</label>'
        + '<div id="zzBlock">Heading<p>a paragraph of its own</p></div>'
        + '<div id="zzLink">Paste it <a href="#">here</a> and press Go</div>';
      document.body.appendChild(host);
      var prevDict=i18nCurrentDict(), prevLang=i18nLang();
      try{
        var cat=i18nCatalogue(host);
        ['Clips','🌅 Breakfast'].forEach(function(s){
          if(cat.indexOf(s)===-1)
            throw new Error('"'+s+'" is not in the catalogue — an icon or a checkbox beside the words '
              + 'is making the whole control untranslatable: '+JSON.stringify(cat));
        });
        // …and the key is the words alone. "{1}Clips" would be a second,
        // separate key from the plain "Clips" button on the desktop filter bar,
        // so the same word could come back with two different translations.
        if(cat.some(function(s){ return /^\{\d\}/.test(s) || /\{\d\}$/.test(s); }))
          throw new Error('a key still carries its icon placeholder: '+JSON.stringify(cat));
        // A child that holds ITS OWN words is still a wall — otherwise an outer
        // div would claim the paragraph inside it and translate both as one.
        if(cat.indexOf('Heading')!==-1)
          throw new Error('an element wrapping a real block child was treated as one sentence');
        // An interior placeholder stays, because word order moves it.
        if(cat.indexOf('Paste it {1} and press Go')===-1)
          throw new Error('a link inside a sentence lost its placeholder: '+JSON.stringify(cat));

        var dict={}; cat.forEach(function(s){ dict[s]='«'+s+'»'; });
        delete dict['Clips'];                     // one deliberately not translated
        i18nInstall('he', dict);
        i18nApply(host);

        var icon=document.getElementById('zzIcon'), chk=document.getElementById('zzChk');
        if(!icon.querySelector('svg')) throw new Error('translating a button ate its icon');
        if(!chk.querySelector('input[type=checkbox]')) throw new Error('translating a row ate its checkbox');
        if(chk.firstChild.nodeType!==1)
          throw new Error('the checkbox moved behind the words — an icon is not a word and does not reorder');
        if(chk.textContent.trim()!=='«🌅 Breakfast»')
          throw new Error('the checkbox row was not translated: '+JSON.stringify(chk.textContent));
        if(!/^Clips$/.test(icon.textContent.trim()))
          throw new Error('an untranslated string was not left alone: '+JSON.stringify(icon.textContent));
        // The one the dictionary could not answer is REMEMBERED, which is the
        // whole mechanism behind "Finish translating".
        if(i18nMissingList().indexOf('Clips')===-1)
          throw new Error('a string with no translation was not recorded as missing');
        if(i18nGapList().indexOf('Clips')===-1)
          throw new Error('the gap list does not contain the string that is visibly still English');

        // Applying twice must change NOTHING. Since v36.32 the observer also
        // watches elements it has already translated, so an unconditional
        // rebuild is a mutation that wakes the observer that does the rebuild.
        var was=document.getElementById('zzLink').innerHTML;
        i18nApply(host);
        if(document.getElementById('zzLink').innerHTML!==was)
          throw new Error('applying twice rewrote the DOM — this loops forever with the observer running');

        // THE EDITOR IS LTR EVEN WHEN THE APP IS NOT. Its left column is
        // English, its rows read English-then-translation, and its summary is a
        // sentence of Latin words and numbers. Under dir="rtl" the bidi
        // algorithm tore Tony's count off its own noun and parked it at the
        // end: "remove 720 orphans · of 2060 shown · 1970 translated … 2060".
        (function(){
          var htmlDir = document.documentElement.getAttribute('dir');
          try{
            document.documentElement.setAttribute('dir','rtl');
            var ov2 = document.getElementById('i18nOverlay');
            if(getComputedStyle(ov2).direction !== 'ltr')
              throw new Error('the editor follows the interface into RTL, which scrambles its own '
                + 'summary line and puts the English column on the wrong side');
            if(getComputedStyle(document.getElementById('i18nEdCount')).direction !== 'ltr')
              throw new Error('the count line is still RTL');
            // …but the translation column must keep the language's direction.
            var ta2 = document.querySelector('.i18n-ed-to');
            if(ta2 && getComputedStyle(ta2).direction !== 'rtl')
              throw new Error('the Hebrew column lost its direction — that is the one part that needs it');
          } finally {
            if(htmlDir) document.documentElement.setAttribute('dir', htmlDir);
            else document.documentElement.removeAttribute('dir');
          }
        })();

        // English comes back WITH its checkbox. Checked before anything below
        // rewrites a label in place, because that is destructive by nature.
        i18nInstall('en', null); i18nRevertAll();
        if(!chk.querySelector('input[type=checkbox]'))
          throw new Error('reverting to English threw the checkbox away');
        if(chk.textContent.trim()!=='🌅 Breakfast')
          throw new Error('reverting left: '+JSON.stringify(chk.textContent));

        // Text replaced IN PLACE, the way updateFilterChips() does it, is put
        // back. Nothing is added or removed, so only a characterData record
        // ever mentions it.
        i18nInstall('he', dict); i18nApply(host); i18nStartObserver();
        var plain=document.getElementById('zzBlock').querySelector('p');
        plain.textContent='a paragraph of its own';
        chk.textContent='🌅 Breakfast';          // this one takes the checkbox with it
        await new Promise(function(r){ setTimeout(r, 260); });
        if(plain.textContent.trim()!=='«a paragraph of its own»')
          throw new Error('a label rewritten in place stayed English: the observer only watches added nodes');
        // …and the icon's placeholder must not be printed now that there is no
        // icon left for it to stand for.
        if(/\{\d\}/.test(chk.textContent))
          throw new Error('a placeholder leaked into the visible label: '+JSON.stringify(chk.textContent));
      } finally {
        try{ i18nRevertAll(); }catch(e){}
        i18nInstall(prevLang, prevDict);
        host.remove();
      }

      // A batch that silently returns fewer strings than it was given is the
      // other half of "not everything was translated". It must be retried, and
      // whatever still will not come back must be COUNTED rather than dropped.
      var realAI=window.aiCall, calls=0;
      try{
        window.aiCall=function(prompt){
          calls++;
          // v36.42 — the strings go out as a NUMBERED LIST and the answer comes
          // back keyed by position, so the English is never echoed. That echo
          // was a third of what kept hitting the token ceiling.
          var body=prompt.slice(prompt.indexOf('Strings:\n')+9);
          var asked=body.split('\n').filter(function(l){ return /^\d+\. /.test(l); })
                        .map(function(l){ return l.replace(/^\d+\. /, ''); });
          if(!asked.length) throw new Error('the prompt no longer lists the strings in a readable form');
          var out={};
          // First pass answers all but the last two; the retry answers one more.
          var n=(calls===1) ? Math.max(0, asked.length-2) : 1;
          for(var i=0;i<n;i++) out[String(i)]='x'+asked[i];
          return Promise.resolve(JSON.stringify(out));
        };
        var res=await i18nTranslateAll('he', ['a','b','c','d','e']);
        if(calls<2) throw new Error('a batch that came back short was not retried');
        if(res.missing!==1)
          throw new Error('it reported '+res.missing+' missing, not the 1 that really never came back');
        if(!res.missingList || res.missingList.indexOf('e')===-1)
          throw new Error('the missing string was not named: '+JSON.stringify(res.missingList));
        if(res.dict['d']!=='xd') throw new Error('the retry’s answer was thrown away');

        // A reply keyed by the ENGLISH is still understood — the model does it
        // sometimes whatever it is asked, and discarding the answer would cost
        // a whole batch to save nothing.
        window.aiCall=function(){ return Promise.resolve(JSON.stringify({'p':'xp','q':'xq'})); };
        var old=await i18nTranslateAll('he', ['p','q']);
        if(old.dict['p']!=='xp') throw new Error('an answer keyed by the English was discarded');

        // A batch that comes back TRUNCATED is halved and re-asked, not lost.
        // Sixty strings is too much to throw away over one ceiling.
        var seen=[];
        window.aiCall=function(prompt){
          var body=prompt.slice(prompt.indexOf('Strings:\n')+9);
          var asked=body.split('\n').filter(function(l){ return /^\d+\. /.test(l); });
          seen.push(asked.length);
          if(asked.length>2) return Promise.reject(new Error('TRUNCATED: the answer hit the ceiling'));
          var out={}; asked.forEach(function(l,i){ out[String(i)]='y'; });
          return Promise.resolve(JSON.stringify(out));
        };
        var big=['a1','a2','a3','a4','a5','a6','a7','a8'];
        var split=await i18nTranslateAll('he', big);
        if(!split.splits) throw new Error('a truncated batch was not split — the whole batch was lost');
        if(seen.filter(function(n){ return n<=2; }).length===0)
          throw new Error('it never got down to a batch small enough to answer: '+JSON.stringify(seen));
        if(Object.keys(split.dict).length!==big.length)
          throw new Error('splitting lost '+(big.length-Object.keys(split.dict).length)+' string(s)');
      } finally { window.aiCall=realAI; }
    } },

  { id:'i18n_sees_unopened_screens', group:'UI', name:'Screens nobody has opened are translated too (v36.35)',
    test: async()=>{
      if(typeof i18nHarvest!=='function') throw new Error('i18nHarvest not defined');
      // The catalogue is only ever "what the interface can show RIGHT NOW", and
      // for most of this app that is a fraction of what it has: eight panels
      // are built by a render function the first time they are opened. Tony
      // found all eight still in English and could not fix any of them from the
      // editor, because none of their words had ever been in the file.
      var before=i18nFullCatalogue();
      var prevView=viewId, prevCount=recipes.length;
      var ov=document.getElementById('viewOverlay');
      var wasOpen=ov.classList.contains('open');
      // Which panels were on screen BEFORE. An earlier test in the suite can
      // leave one open, and "nothing is open afterwards" would then fail for a
      // reason that has nothing to do with harvesting.
      var openIds=function(){ return Array.prototype.map.call(
        document.querySelectorAll('.modal-overlay.open'), function(e){ return e.id; }).sort().join(','); };
      var openBefore=openIds();
      var drawn=await i18nHarvest();
      var after=i18nFullCatalogue();

      if(after.length<=before.length)
        throw new Error('harvesting found nothing new — every render in the list is failing silently');
      if(drawn.length<I18N_HARVEST.length)
        throw new Error('only '+drawn.length+' of '+I18N_HARVEST.length+' screens could be drawn: missing '
          + I18N_HARVEST.map(function(e){ return e[0]; }).filter(function(n){ return drawn.indexOf(n)===-1; }).join(', '));

      // Name the actual screens Tony reported, so this fails if one of them
      // stops being reached rather than merely "fewer strings than before".
      var has=function(re){ return after.some(function(s){ return re.test(s); }); };
      [[/Tap a box to tick/, 'the tick hint on an open recipe'],
       [/Version history/,   'Version history'],
       [/Logging/,           'the logging panel'],
       [/unsent local edits|Sync Health|last successful sync/i, 'Sync Health'],
       [/Nothing is sold/,   'What leaves this device'],
       [/Export chat|Without media/, 'the WhatsApp export manual']
       // The self-test screen was on this list until v36.53, when Tony decided
       // it stays English. The opposite is asserted further down.
      ].forEach(function(pair){
        if(!has(pair[0])) throw new Error(pair[1]+' is still not in the catalogue, so it cannot be translated'
          );
      });

      // THE LOG'S OWN EVENTS ARE NOT INTERFACE TEXT. They are diagnostics, they
      // are what gets pasted to whoever is helping, and there is no end to
      // them — every message ever logged would become a dictionary key. Tony's
      // log was carrying entries that quoted code fragments, and those were
      // being catalogued and translated.
      (function(){
        var kOn = null, kLog = null;
        try { kOn = localStorage.getItem('tonys_log_enabled'); kLog = localStorage.getItem('tonys_sync_log'); } catch(e) {}
        try {
          localStorage.setItem('tonys_log_enabled','1');
          localStorage.setItem('tonys_sync_log', JSON.stringify([{ at: Date.now(), k: 'ai',
            m: 'ZQXJLOGMESSAGE recorded here', d: 'ZQXJLOGDETAIL + x); if (y) z.push( + w);' }]));
          renderLoggingPanel();
          var host = document.getElementById('loggingBody');
          if((host.textContent||'').indexOf('ZQXJLOGMESSAGE') === -1)
            throw new Error('the planted log entry did not reach the screen, so this proves nothing');
          var leaked = i18nCatalogue(host).filter(function(x){ return /ZQXJLOG/.test(x); });
          if(leaked.length)
            throw new Error('a sync-log event reached the catalogue: '+JSON.stringify(leaked[0].slice(0,50)));
          // …but the panel's own words must still be translatable, or marking
          // the rows has taken the whole screen with it.
          if(!i18nCatalogue(host).some(function(x){ return /Purge logs|Copy report/i.test(x); }))
            throw new Error('the logging panel\u2019s own buttons stopped being translatable');
        } finally {
          try {
            if(kOn === null) localStorage.removeItem('tonys_log_enabled'); else localStorage.setItem('tonys_log_enabled', kOn);
            if(kLog === null) localStorage.removeItem('tonys_sync_log'); else localStorage.setItem('tonys_sync_log', kLog);
          } catch(e) {}
          try { renderLoggingPanel(); } catch(e) {}
        }
      })();

      // A count that changes with the data must NOT be part of the key, or the
      // dictionary is asked for "🕘 Version history (3)" and has "(1)".
      // "📷 No photo (N)" is only DRAWN when some recipe has no photo, so on a
      // fully illustrated library it never rendered and its words could never
      // reach the dictionary. The harvest now pushes a stand-in with no
      // photograph. This failed on Tony's machine and passed in CI, which is
      // the signature of a branch rather than a bug.
      ['🕘 Version history ({1})','📓 Cooking log ({1})','📷 No photo ({1})'].forEach(function(k){
        if(after.indexOf(k)===-1)
          throw new Error('"'+k+'" is not a key — a varying number is baked into it and it will never match: '
            + JSON.stringify(after.filter(function(s){ return s.indexOf(k.split(' (')[0])===0; })));
      });
      if(after.some(function(s){ return /\((?:[1-9]\d*|0)\)$/.test(s) && /history|log|photo|away/i.test(s); }))
        throw new Error('a key still ends in a literal count');

      // BOTH SIDES OF A CONDITION. `when: signedIn ? 'always, while signed in'
      // : 'not in use — you are signed out'` puts a panel's worth of text
      // behind a ternary, and whichever branch is true when a language is
      // generated is the only one that ever reaches the dictionary. Tony is
      // signed in and the harvest was not, so half the privacy panel could not
      // have been found however many times it was drawn.
      ['always, while signed in', 'not in use — you are signed out'].forEach(function(x){
        if(!after.some(function(k){ return k.indexOf(x)!==-1; }))
          throw new Error('"'+x+'" is not in the catalogue — only one side of the signed-in '
            + 'condition is being drawn, so the other half stays English for ever');
      });
      // …and the pretending must not survive the harvest.
      if(window._fbUser && window._fbUser.email==='someone@example.invalid')
        throw new Error('the stand-in user used to draw the signed-in wording was left signed in');

      // The messages that have no screen. A toast or a confirmation lives
      // inside the function that raises it and is never in the DOM to be found
      // — 200-odd of them — so the app reads its own source for the ones that
      // are a whole string rather than a concatenation.
      if(typeof i18nScrapeSource!=='function') throw new Error('i18nScrapeSource not defined');
      if(after.indexOf('AI cache cleared')===-1)
        throw new Error('a plain toast message is not in the catalogue — the source scrape found nothing');
      if(!after.some(function(x){ return /collection cannot be added to itself/.test(x); }))
        throw new Error('a confirmation message is not in the catalogue');
      // …but NOT a fragment of a concatenated one: translating half a message
      // changes nothing on screen, because what is shown is the joined string.
      if(after.some(function(x){ return /^Another device saved "$/.test(x); }))
        throw new Error('a fragment of a concatenated message was catalogued');
      // …and not an example value that has to stay exactly as written.
      if(after.indexOf('123456789-abc.apps.googleusercontent.com')!==-1)
        throw new Error('the Gmail Client ID example was offered for translation');

      // THE SCRAPE READS THE SCRIPTS, NOT THE FILE (v36.50). What it fetches is
      // an HTML document and what the lexer reads is JavaScript: handed the
      // whole thing it opened a "string" on the quotation mark in
      // <html lang="en"> and spent the rest of the file half a step out. And
      // inside the scripts, a template literal with another template in one of
      // its ${holes} closed on the nested backtick and did the same again.
      // Neither failure announced itself — 276 messages still came back — so
      // the proof has to be a message from the far side of both hazards.
      ['i18nScriptsOnly','i18nLexSource'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      (function(){
        var doc='<html lang="en">\n<body onclick="go(\'x\')">\n<script>\n'
          + 'var h = `<i>${ a ? `<b>${b}</b>` : \'\' }</i>`;\n'
          + 'toast(\'ZQXJ after a nested template\');\n'
          + '<\/script>\n</body></html>';
        var only=i18nScriptsOnly(doc);
        if(only.length!==doc.length)
          throw new Error('blanking the markup moved every offset after it');
        if((only.match(/\n/g)||[]).length!==(doc.match(/\n/g)||[]).length)
          throw new Error('blanking the markup lost a line');
        if(/lang="en"/.test(only)) throw new Error('the markup was handed to the JavaScript lexer');
        if(only.indexOf('ZQXJ after a nested template')===-1)
          throw new Error('the script body did not survive');
        var lex=i18nLexSource(only);
        var at=doc.indexOf('toast(\'ZQXJ');
        if(lex.inStr[at])
          throw new Error('a toast after a nested template literal reads as string content — '
            + 'the scrape walks straight past it');
      })();
      // THE SELF TEST STAYS ENGLISH (v36.53). Tony's decision: it is his own
      // diagnostic screen, and its ~280 test names added a fifth to the cost
      // and the wait of every new language. v36.51 had gone the other way and
      // downloaded the suite so the harvest could catalogue it.
      if(after.indexOf('Accessibility basics (labels, Escape, focus)')!==-1
         || after.indexOf('CRUD')!==-1 || after.indexOf('Cloud Sync')!==-1)
        throw new Error('self-test names or headings are in the catalogue — every new language pays for them');
      if(!document.getElementById('selfTestOverlay').hasAttribute('data-no-i18n'))
        throw new Error('#selfTestOverlay is not marked data-no-i18n');
      if((window.I18N_HARVEST||[]).some(function(e){ return /self-test/i.test(e[0]); }))
        throw new Error('the harvest still draws the self-test list');
      // …and what is ALREADY in a dictionary is offered as unusable, not left
      // as an orphan for ever — and a stale missing-list entry is not paid for.
      (function(){
        var prevDict=i18nCurrentDict(), prevLang=i18nLang(), prevUser=window._fbUser;
        try{
          window._fbUser={ email:'rozinante2004@gmail.com' };
          var d={ 'Accessibility basics (labels, Escape, focus)':'アクセシビリティ', 'CRUD':'CRUD' };
          i18nInstall('ja', d);
          i18nNoteMissing('Cloud Sync');
          _i18nEdLang='ja'; _i18nEdDraft=d; i18nEdInvalidate();
          var inf=i18nEdInfo();
          if(!inf.junk('Accessibility basics (labels, Escape, focus)') || !inf.junk('CRUD'))
            throw new Error('a translated self-test name is not offered for removal as unusable');
          if(i18nGapList().indexOf('Cloud Sync')!==-1)
            throw new Error('a self-test heading in the missing list would be paid for by the gap-filler');
        } finally { i18nClearMissing(['Cloud Sync']); i18nInstall(prevLang, prevDict);
                    window._fbUser=prevUser; _i18nEdDraft=null; i18nEdInvalidate(); }
      })();
      // …and a keycap step from a static panel, which v36.47 had re-keyed to
      // "{1}️⃣ Click {2} below" and orphaned.
      if(after.indexOf('1️⃣ Click {1} below')===-1)
        throw new Error('the Bring! refresh steps are keyed on their keycap digit: '
          + JSON.stringify(after.filter(function(k){ return /Click \{1\} below/.test(k); })));

      // …and the real file's proof: two toasts that sit behind both hazards.
      if(after.indexOf('✅ Installing Tony’s Recipes...')===-1
         && after.indexOf('✅ Installing Tony\'s Recipes...')===-1)
        throw new Error('the PWA install toast is still not in the catalogue');

      // A placeholder is chrome even on a field marked dir="auto" — that
      // marking is about the recipe text typed INTO it. The whole ingredient
      // editor kept its English hints until v36.36.
      if(after.indexOf('Ingredient name')===-1 || after.indexOf('Amount')===-1)
        throw new Error('the ingredient editor\u2019s placeholders are still not translatable');
      // The exception is exactly that wide and no wider: a title or an
      // aria-label inside a recipe is still the recipe's own words.
      (function(){
        var probe=document.createElement('div');
        probe.innerHTML='<div dir="auto"><input placeholder="Amount" title="ZQXJTITLE" '
          + 'aria-label="ZQXJLABEL"></div>';
        document.body.appendChild(probe);
        try{
          var keys=i18nCatalogue(probe);
          if(keys.indexOf('Amount')===-1) throw new Error('the placeholder exception stopped working');
          if(keys.some(function(k){ return /ZQXJ/.test(k); }))
            throw new Error('the exception leaked past placeholder to '+JSON.stringify(keys.filter(function(k){return /ZQXJ/.test(k);})));
        } finally { probe.remove(); }
      })();

      // MESSAGES BUILT OUT OF PIECES. "Saved 12 recipes" is not a key and never
      // can be — the number is different every time — so the call site is read
      // as a shape and the pieces are put back at display time.
      ['i18nScanCall','i18nPartsToPattern','i18nMatchPattern','i18nBuildPatterns']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      (function(){
        var shape=function(src){
          var at=src.indexOf('toast(')+6;
          var parts=i18nScanCall(src, at);
          return parts ? i18nPartsToPattern(parts) : null;
        };
        // The space before a hole belongs to the literal before it. Trimming
        // each piece gave "Looking up{1}…", which matches nothing.
        if(shape("toast('Looking up ' + name + '…')")!=='Looking up {1}…')
          throw new Error('a hole lost the space in front of it: '+JSON.stringify(shape("toast('Looking up ' + name + '…')")));
        if(shape("toast('Saved ' + n + ' recipes', 4000)")!=='Saved {1} recipes')
          throw new Error('the duration argument was read as part of the message');
        // A string inside an expression is a decision, not words.
        if(/yes|no/.test(String(shape("toast('It is ' + (x ? 'yes' : 'no') + ' today here')"))))
          throw new Error('a string inside a ternary was treated as part of the message');
        // A shape with almost no words of its own would match half the app.
        if(shape("toast(a + ' - ' + b)"))
          throw new Error('a shape with no real words was kept: it would swallow unrelated messages');
        if(shape("toast(`a ${b} c`)")) throw new Error('a template literal was guessed at');
      })();
      // …and matching puts the pieces back rather than translating them.
      (function(){
        var prevDict=i18nCurrentDict(), prevLang=i18nLang();
        try{
          var d={}; after.forEach(function(k){ d[k]='«'+k+'»'; });
          i18nInstall('he', d);
          var got=i18nMatchPattern('Looking up Dutch…');
          if(got!=='«Looking up Dutch…»')
            throw new Error('a built message did not match its shape, or the piece was lost: '+JSON.stringify(got));
          if(i18nMatchPattern('zzz nothing like any message in this app zzz')!==null)
            throw new Error('an unrelated string matched a shape — a loose pattern will mangle real messages');
        } finally { i18nInstall(prevLang, prevDict); }
      })();

      // WHAT MUST NEVER BE TRANSLATED. Two things are written in English on
      // purpose and would be actively harmful in Hebrew: the prompts sent to
      // the model, and the reports Tony copies out to ask for help with. The
      // scrape widened a long way in v36.39 and this is the line it must not
      // cross.
      ['Return ONLY a JSON object', 'SYNC LOG REPORT', 'WHAT THIS LOOKS LIKE',
       'EVENTS (newest first)'].forEach(function(probe){
        var hit = after.filter(function(x){ return x.indexOf(probe) !== -1; });
        if(hit.length)
          throw new Error('"'+probe+'" reached the catalogue. A prompt translated into Hebrew changes '
            + 'what the model is asked, and a report in Hebrew cannot be read by whoever is helping: '
            + JSON.stringify(hit[0].slice(0,70)));
      });
      // …and the things that MUST be there, because they are what the Logging
      // panel exists to say and they only render when they apply.
      if(!after.some(function(x){ return /watchdog window/.test(x); }))
        throw new Error('a sync-log finding is not in the catalogue — a message split across source '
          + 'lines with nothing variable in it is still one message');
      if(!after.some(function(x){ return /ALLOWED_ORIGINS on the Worker/.test(x); }))
        throw new Error('the Worker\u2019s refusal messages are not in the catalogue');

      // A long help passage is ONE unit, not a handful of fragments — the whole
      // reason inline markup becomes {1} instead of a wall.
      var longest = after.reduce(function(n,x){ return Math.max(n, x.length); }, 0);
      if(longest < 400)
        throw new Error('the longest key is only '+longest+' characters — prose is being shattered into '
          + 'fragments, and a fragment translated on its own is word salad');
      // …but a key becomes a FIRESTORE FIELD NAME, and those stop at 1,500
      // bytes. One 1,541-byte string took the entire master catalogue document
      // with it: every save failed with "Property strings contains an invalid
      // nested entity", which names the document and not the field.
      var fat = after.filter(function(x){ return i18nByteLen(x) > I18N_MAX_BYTES; });
      if(fat.length)
        throw new Error(fat.length+' key(s) are over '+I18N_MAX_BYTES+' bytes and cannot be saved: '
          + JSON.stringify(fat[0].slice(0,60)));
      if(i18nByteLen('a') !== 1 || i18nByteLen('—') !== 3 || i18nByteLen('🍽') !== 4)
        throw new Error('i18nByteLen is not counting UTF-8 bytes, so the ceiling it guards is fiction');

      // Harvesting is a READ. It must not open anything, leave a stand-in
      // recipe in the library, or move which recipe is being viewed.
      if(recipes.length!==prevCount)
        throw new Error('harvesting changed the library by '+(recipes.length-prevCount)+' recipe(s)');
      if(recipes.some(function(r){ return r.uid==='i18n-harvest'; }))
        throw new Error('the stand-in recipe used to draw the recipe screen was left in the library');
      if(viewId!==prevView) throw new Error('harvesting changed which recipe is open');
      if(ov.classList.contains('open')!==wasOpen)
        throw new Error('harvesting left the recipe screen '+(wasOpen?'closed':'open'));
      if(openIds()!==openBefore)
        throw new Error('harvesting changed which panels are on screen: was "'+openBefore
          +'", now "'+openIds()+'"');
    } },

  { id:'ui_long_jobs_show_progress', group:'UI', name:'A long job says how far in and how long left (v36.38)',
    test: async()=>{
      ['progressOpen','progressStep','progressClose','progressCancel','progressCancelled','progEtaWords']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var ov=document.getElementById('progOverlay');
      if(!ov) throw new Error('#progOverlay is not in the page');
      try{
        progressOpen({ icon:'🌍', title:'Translating', total:10, step:'Getting ready…' });
        if(!ov.classList.contains('open')) throw new Error('the panel did not open');
        var ring=document.getElementById('progRing');
        // Before the first step there is no honest number, so it turns rather
        // than sitting at 0% looking hung.
        if(!ring.classList.contains('indeterminate'))
          throw new Error('it claims a percentage before a single step has finished');

        _prog.started = Date.now() - 3*9000;          // three steps, nine seconds each
        progressStep(3, 'Batch 3 of 10');
        if(ring.classList.contains('indeterminate'))
          throw new Error('it is still spinning after real progress arrived');
        if(document.getElementById('progPct').textContent!=='30%')
          throw new Error('it shows '+document.getElementById('progPct').textContent+' at 3 of 10');
        // The ring IS the countdown — a number that moves and a ring that does
        // not is worse than no ring.
        var off=parseFloat(ring.style.strokeDashoffset);
        if(Math.abs(off - PROG_CIRC*0.7) > 1)
          throw new Error('the ring is at '+Math.round(off)+', not 70% of the way round');
        // 7 steps left at 9s each is about a minute, and it must say so rather
        // than counting seconds it cannot really know.
        var eta=document.getElementById('progEta').textContent;
        if(!/minute|second/.test(eta)) throw new Error('no time estimate: '+JSON.stringify(eta));

        if(progEtaWords(3000)!=='almost done') throw new Error('3 seconds is not "almost done"');
        if(!/about 30 seconds/.test(progEtaWords(28000)))
          throw new Error('28 seconds reads as '+progEtaWords(28000));
        if(progEtaWords(70000)!=='about a minute left') throw new Error('70 seconds is not "about a minute"');

        progressStep(10,'done');
        if(document.getElementById('progEta').textContent!=='finishing…')
          throw new Error('at 100% it still promises time left');

        // Cancelling is a request, not an abort: work already paid for lands.
        if(progressCancelled()) throw new Error('it started out cancelled');
        progressCancel();
        if(!progressCancelled()) throw new Error('cancel did not register');
      } finally { progressClose(); }
      if(ov.classList.contains('open')) throw new Error('the panel stayed on screen');
      if(progressCancelled()) throw new Error('the cancelled flag outlived the job it belonged to');
    } },

  { id:'ui_sign_in_says_why', group:'UI', name:'The app can say why sign-in failed (v36.38)',
    test: async()=>{
      ['diagnoseSignIn','probeApiKey','signInDiagLines'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(!document.getElementById('signInDiag')) throw new Error('#signInDiag is not in the page');
      if(!document.getElementById('signInDiagBtn'))
        throw new Error('there is no way to ask — the check is unreachable from the login screen');
      // The key has to be known even when the Firebase scripts never loaded,
      // because that is exactly when somebody needs to know if it is blocked.
      if(!window._fbConfigApiKey)
        throw new Error('the app does not know its own API key, so it can never test it');
      var L=signInDiagLines();
      var names=L.map(function(r){ return r[0]; });
      ['Page','Network','Firebase SDK','Auth object','Signed in as'].forEach(function(k){
        if(names.indexOf(k)===-1) throw new Error('the check does not report '+k);
      });
      // It must name the ORIGIN, since a referrer block is about exactly that
      // and is otherwise invisible.
      if(L[0][1].indexOf(location.origin)===-1)
        throw new Error('it does not say which origin the browser is sending');
    } },

  { id:'i18n_a_number_is_not_a_key', group:'UI', name:'A number never becomes part of a key (v36.46)',
    test: async()=>{
      // Tony's file had 1,016 orphans and almost every one was a number:
      // "15 errors recorded", "17 errors recorded", "24 errors recorded"…
      // "3 tests" through "61 tests", "1 min ago" through "44 min ago". Each
      // distinct value made a NEW key, so the dictionary grew without limit and
      // he paid to translate "61 tests" having already paid for "47 tests".
      ['i18nDeriveKey','i18nEdPortValue','i18nEdNorm'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      var host=document.createElement('div');
      host.innerHTML='<div id="zn1">15 errors recorded</div><div id="zn2">59 errors recorded</div>'
        + '<div id="zn3">Paste <a href="#" id="znl">here</a> and press 3 times</div>'
        + '<button id="zn4" title="Average of 2 rated cook(s)">x</button>';
      document.body.appendChild(host);
      var prevDict=i18nCurrentDict(), prevLang=i18nLang();
      try{
        var keys=i18nCatalogue(host);
        if(keys.indexOf('{1} errors recorded')===-1)
          throw new Error('the count is still baked into the key: '+JSON.stringify(keys));
        if(keys.filter(function(k){ return /errors recorded/.test(k); }).length!==1)
          throw new Error('two different counts produced two different keys');
        if(keys.indexOf('Average of {1} rated cook(s)')===-1)
          throw new Error('an ATTRIBUTE still bakes its number in: '+JSON.stringify(keys));
        // A child and a number share one {n} series, and the translation may
        // put them anywhere — in Hebrew it frequently must.
        if(keys.indexOf('Paste {1} and press {2} times')===-1)
          throw new Error('a link and a number did not share one placeholder series: '+JSON.stringify(keys));

        i18nInstall('he', { '{1} errors recorded':'נרשמו {1} שגיאות',
                            'Paste {1} and press {2} times':'הדבק {1} ולחץ {2} פעמים',
                            'Average of {1} rated cook(s)':'ממוצע של {1} בישולים' });
        i18nApply(host);
        if(document.getElementById('zn1').textContent!=='נרשמו 15 שגיאות')
          throw new Error('zn1 reads '+JSON.stringify(document.getElementById('zn1').textContent));
        if(document.getElementById('zn2').textContent!=='נרשמו 59 שגיאות')
          throw new Error('two counts did not both come through one key');
        if(document.getElementById('zn4').title!=='ממוצע של 2 בישולים')
          throw new Error('the attribute lost its number: '+document.getElementById('zn4').title);
        if(!document.getElementById('znl')) throw new Error('the link was destroyed');
        if(document.getElementById('zn3').textContent!=='הדבק here ולחץ 3 פעמים')
          throw new Error('zn3 reads '+JSON.stringify(document.getElementById('zn3').textContent));

        // The app rewrites the count. The key does not change; the number does.
        document.getElementById('zn1').textContent='7 errors recorded';
        i18nApply(host);
        if(document.getElementById('zn1').textContent!=='נרשמו 7 שגיאות')
          throw new Error('a changed count did not follow: '+document.getElementById('zn1').textContent);

        // …and English comes back with the CURRENT number, not the first one.
        i18nInstall('en', null); i18nRevertAll();
        if(document.getElementById('zn1').textContent!=='7 errors recorded')
          throw new Error('reverting gave '+JSON.stringify(document.getElementById('zn1').textContent));
        if(document.getElementById('zn3').textContent!=='Paste here and press 3 times')
          throw new Error('reverting a sentence with a link and a number gave '
            + JSON.stringify(document.getElementById('zn3').textContent));
        if(/\u0001/.test(host.textContent))
          throw new Error('the internal child marker reached the screen');
      } finally { try{ i18nRevertAll(); }catch(e){} i18nInstall(prevLang, prevDict); host.remove(); }

      // RE-KEYING DOES NOT NEED A LIVE TARGET. Most of these strings only
      // render in a state the app is not in — an error it has not had, a sync
      // that has not timed out — which is precisely why they went stale.
      // Requiring the target to be on screen left 720 of Tony's orphans
      // unrecoverable for no reason.
      (function(){
        var prevDict2=i18nCurrentDict(), prevLang2=i18nLang(), prevUser=window._fbUser;
        try{
          window._fbUser={ email:'rozinante2004@gmail.com' };
          var d2={};
          d2['15 errors recorded']='15 שגיאות נרשמו';      // re-key: no live target
          d2['{1} min ago']='לפני {1} דקות';               // already correct: leave alone
          d2['4 min ago']='לפני {1} דקות';                 // leftover of a re-use already done
          d2['9/18/2026, 10:57:13 PM · import']='x';       // a sync-log row
          i18nInstall('he', d2);
          _i18nEdLang='he'; _i18nEdDraft=d2; i18nEdInvalidate();
          var inf=i18nEdInfo();
          var reuse=i18nEdOrphanMatches();
          var got=reuse.filter(function(x){ return x.from==='15 errors recorded'; })[0];
          if(!got) throw new Error('an orphan with no live target was not re-keyed');
          if(got.to!=='{1} errors recorded')
            throw new Error('it was re-keyed to '+JSON.stringify(got.to));
          if(got.value!=='{1} שגיאות נרשמו')
            throw new Error('the Hebrew was not ported: '+JSON.stringify(got.value));
          // A key already written by the current rules is left exactly alone.
          if(i18nEdSelfKey('{1} min ago')!=='{1} min ago')
            throw new Error('a current-form key was re-derived into '
              + JSON.stringify(i18nEdSelfKey('{1} min ago'))+' — the digits inside {1} are not a number');
          if(reuse.some(function(x){ return x.from==='{1} min ago'; }))
            throw new Error('a key that is already correct was offered for re-use');
          // The leftover of a re-use that has already happened is dead weight:
          // offered for removal, not left to sit there for ever.
          if(inf.all.filter(inf.junk).indexOf('4 min ago')===-1)
            throw new Error('a leftover whose work is already safe under the right key was not '
              + 'offered for removal — it can never be re-used and never be cleaned up');
          if(inf.all.filter(inf.junk).indexOf('9/18/2026, 10:57:13 PM · import')===-1)
            throw new Error('a sync-log row was not recognised as removable');
        } finally { i18nInstall(prevLang2, prevDict2); window._fbUser=prevUser;
                   _i18nEdDraft=null; i18nEdInvalidate(); }
      })();

      // A TRAILING PLACEHOLDER, AND A TIDIED-UP ELLIPSIS (v36.50). Tony looked
      // at seven orphans and said they looked legitimate — and he was right.
      // "⚙️ Worker settings & secrets {1}" is a real link with a real grey hint
      // beside it; what changed is that an element on the EDGE stopped counting
      // as part of the sentence, so the app now asks for the same words without
      // the {1}. Both halves of the old test missed it: i18nEdSelfKey returns
      // any key holding {n} unchanged, and re-use skips a target that already
      // has a translation. So it could never be re-used, never be removed, and
      // sat in the list looking like work. Same story for a sentence whose "..."
      // was tidied into "…" in the markup one day.
      (function(){
        var prevDict3=i18nCurrentDict(), prevLang3=i18nLang(), prevUser3=window._fbUser;
        var host3=document.createElement('div');
        host3.innerHTML='<a id="zw1">Widget settings &amp; secrets <span>API keys, bindings</span></a>'
          + '<div id="zw2">Installing this app...</div>';
        document.body.appendChild(host3);
        try{
          window._fbUser={ email:'rozinante2004@gmail.com' };
          var live3=i18nCatalogue(host3);
          if(live3.indexOf('Widget settings & secrets')===-1)
            throw new Error('the trailing hint is still part of the key: '+JSON.stringify(live3));
          var d3={};
          d3['Widget settings & secrets']='הגדרות וסודות';        // what the app asks for
          d3['Widget settings & secrets {1}']='הגדרות וסודות';    // the leftover, with the old hint slot
          d3['Installing this app...']='מתקין את האפליקציה...';   // what the app asks for
          d3['Installing this app…']='מתקין את האפליקציה…';       // the leftover, tidied punctuation
          i18nInstall('he', d3);
          _i18nEdLang='he'; _i18nEdDraft=d3; i18nEdInvalidate();
          var inf3=i18nEdInfo(), junk3=inf3.all.filter(inf3.junk);
          if(junk3.indexOf('Widget settings & secrets {1}')===-1)
            throw new Error('an orphan differing from a translated live key only by a trailing '
              + 'placeholder was left standing as work — it can never be re-used or removed');
          if(junk3.indexOf('Installing this app…')===-1)
            throw new Error('tidying "..." into "…" orphaned a translation for ever');
          // …and the key the app actually asks for is untouched by all of this.
          if(inf3.orphan('Widget settings & secrets'))
            throw new Error('the LIVE key was classed as an orphan');
          if(inf3.orphan('Installing this app...'))
            throw new Error('the LIVE key was classed as an orphan');
        } finally { i18nInstall(prevLang3, prevDict3); window._fbUser=prevUser3;
                    _i18nEdDraft=null; i18nEdInvalidate(); host3.remove(); }
      })();

      // PORTING AN OLD TRANSLATION. "15 שגיאות נרשמו" is only reusable as
      // "{1} שגיאות נרשמו" — otherwise every count would render as fifteen.
      if(i18nEdPortValue('15 errors recorded','15 שגיאות נרשמו')!=='{1} שגיאות נרשמו')
        throw new Error('a number was not lifted out of the translation');
      if(i18nEdPortValue('44 min ago','לפני 44 דקות')!=='לפני {1} דקות')
        throw new Error('a number the translation had MOVED was not found');
      // …and it refuses rather than guesses when there is no safe answer.
      if(i18nEdPortValue('11 of 11 batches','11 מתוך 11 אצוות')!==null)
        throw new Error('a number appearing twice was ported anyway — one of the two would be wrong');
      if(i18nEdPortValue('5 tests','בדיקות')!==null)
        throw new Error('a translation with the number missing was ported anyway');
      // ALREADY PORTED (v36.51). "4 min ago" holding "לפני {1} דקות" is the
      // result of a re-use that happened once already: the key kept its 4, the
      // value grew its {1}. Asking for the 4 inside the Hebrew found nothing
      // and refused the entry, so it could never be re-used — and its target
      // has no translation, so it was never dead weight either. It just sat
      // there. This is why Tony had no re-use button at all.
      if(i18nEdPortValue('4 min ago','לפני {1} דקות')!=='לפני {1} דקות')
        throw new Error('a value that had ALREADY been ported was refused: '
          + JSON.stringify(i18nEdPortValue('4 min ago','לפני {1} דקות')));
      if(i18nEdPortValue('50 tests','{1} בדיקות')!=='{1} בדיקות')
        throw new Error('an already-ported value was refused');
      // …but only when the placeholders it carries are the ones the key needs.
      if(i18nEdPortValue('11 of 11 batches','{1} מתוך אצוות')!==null)
        throw new Error('a value with too FEW placeholders was accepted as already ported');

      // A KEYCAP IS AN EMOJI, NOT A NUMBER (v36.51). "1️⃣" is the ASCII digit 1
      // wearing U+FE0F U+20E3. v36.47's rule read it as a count and turned the
      // Bring! refresh steps into "{1}️⃣ Click {2} below" — a key that is
      // nonsense, and that orphaned three lines which were already translated.
      (function(){
        var d=i18nDeriveKey('1️⃣ Click 3 times', []);
        if(d.key!=='1️⃣ Click {1} times')
          throw new Error('a keycap emoji was read as a number: '+JSON.stringify(d.key));
        if(d.slots.length!==1 || d.slots[0]!=='3')
          throw new Error('the keycap took a slot of its own: '+JSON.stringify(d.slots));
        // The bare digit beside it is still a number, or this cure is worse.
        if(i18nDeriveKey('Step 2 of 3', []).key!=='Step {1} of {2}')
          throw new Error('an ordinary number stopped being a placeholder');
      })();
    } },

  { id:'sec_audit_block1', group:'Network', name:'Frame guard, no Gmail at sign-in, owner-only tools (v36.59)',
    test: async()=>{
      var src=await (await fetch(location.href,{cache:'no-store'})).text();
      // CLICKJACKING. A meta-tag CSP cannot carry frame-ancestors and GitHub
      // Pages cannot send the header, so the guard is a script — and it has to
      // be the FIRST one, before anything renders.
      var firstInline=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/.exec(src.replace(/<!--[\s\S]*?-->/g,''));
      if(!firstInline || firstInline[1].indexOf('window.self !== window.top')===-1)
        throw new Error('the frame guard is not the first script on the page');
      if(src.indexOf('<script id="frameGuard">') > src.indexOf('<script src='))
        throw new Error('an external script loads before the frame guard');
      // GMAIL. Every family member's consent screen said the app could send
      // e-mail as them, for a token nothing used. Send Email asks on its own.
      if(/addScope\(\s*['"][^'"]*gmail/i.test(src))
        throw new Error('sign-in asks for a Gmail permission again');
      if(String(getGmailToken).indexOf('gmail.send')===-1)
        throw new Error('Send Email no longer asks for the permission it needs');
      // OWNER-ONLY TOOLS. Payments and Deployments link into the Cloudflare,
      // Firebase and Anthropic accounts.
      if(typeof isAppOwner!=='function'||typeof applyOwnerOnlyItems!=='function')
        throw new Error('isAppOwner/applyOwnerOnlyItems not defined');
      var items=document.querySelectorAll('[data-owner-only]');
      if(items.length<2) throw new Error('Payments and Deployments are not marked owner-only');
      var prevUser=window._fbUser, realToast=window.toast, said='';
      try{
        window.toast=function(m){ said=String(m); };
        window._fbUser={ email:'someone.else@example.com' };
        applyOwnerOnlyItems();
        items.forEach(function(el){ if(el.style.display!=='none') throw new Error('an owner-only item is visible to a member: '+el.textContent.trim()); });
        openDeployments();
        if(document.getElementById('deploymentsOverlay').classList.contains('open'))
          throw new Error('a member could open Deployments');
        openPayments();
        if(document.getElementById('paymentsOverlay').classList.contains('open'))
          throw new Error('a member could open Payments');
        if(!/owner/i.test(said)) throw new Error('refusing a member said nothing');
        // …and the shared translations are not even attempted by a non-admin.
        var wrote=false;
        window._fbDb={ collection:function(){ return { doc:function(){ return { set:function(){ wrote=true; return Promise.resolve(); } }; } }; } };
        var res=await i18nWriteCloud('zz',{ lang:'zz', strings:{ a:'b' } });
        if(wrote) throw new Error('a non-admin tried to write a shared translation');
        if(res!=='refused') throw new Error('a non-admin translation write returned '+res);
        window._fbUser={ email:'rozinante2004@gmail.com' };
        applyOwnerOnlyItems();
        items.forEach(function(el){ if(el.style.display==='none') throw new Error('an owner-only item is hidden from the owner'); });
      } finally {
        window._fbUser=prevUser; window.toast=realToast; applyOwnerOnlyItems();
        closeM('deploymentsOverlay'); closeM('paymentsOverlay');
        try{ localStorage.removeItem('tonys_i18n_zz'); }catch(e){}
      }
    } },

  { id:'ux_audit_block2', group:'UI', name:'Hebrew values keep their order; yields; named dropdowns; units in Settings (v36.60)',
    test: async()=>{
      ['servingsIsYield','toggleUnitPref','unitPref','calcUnitLabel'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      // YIELD OR PEOPLE. Tony's hummus says "1.5 ליטר" and was shown as
      // "1.5 ליטר servings" with "Make it for 2 servings" under it.
      [['4',false],['6 servings',false],['4-6',false],['6 מנות',false],['about 4 people',false],['8 סועדים',false],
       ['1.5 ליטר',true],['1 loaf',true],['24 cookies',true],['2 cakes',true],['',false],['—',false]
      ].forEach(function(c){
        if(servingsIsYield(c[0])!==c[1]) throw new Error(JSON.stringify(c[0])+' read as '+(c[1]?'people':'a yield'));
      });
      var ids=[888971,888972], prevView=viewId;
      recipes.unshift(normalizeRecipe({id:ids[0],name:'החומוס של טוני',prep:'2 hours',servings:'1.5 ליטר',source:"Tony's own",
        ingredients:[{a:'1',n:'חומוס'}],steps:['לבשל'],updatedAt:1}));
      recipes.unshift(normalizeRecipe({id:ids[1],name:'Soup',prep:'20 min',servings:'4',ingredients:[{a:'1',n:'x'}],steps:['y'],updatedAt:1}));
      try{
        openView(ids[0]); await wait(80);
        var meta=document.querySelector('#viewOverlay .modal-meta');
        var chips=Array.prototype.slice.call(meta.children).filter(function(e){ return /⏱|🍽/.test(e.textContent); });
        chips.forEach(function(c){
          // An English label beside a Hebrew value is only safe inside its OWN
          // bidi isolate: "⏱ 2 hours" showed as "hours 2" in a Hebrew recipe.
          if(c.tagName!=='BDI') throw new Error('a meta chip is not isolated: '+c.outerHTML.slice(0,80));
        });
        if(!/Yield/.test(meta.textContent)) throw new Error('a yield is still shown as servings: '+meta.textContent);
        if(/servings/.test(meta.textContent)) throw new Error('"servings" is still on a yield');
        if(document.querySelector('#viewOverlay .serv-input')) throw new Error('a yield still offers a number of people to aim at');
        var src=document.querySelector('#viewOverlay .source-link');
        if(!src || !src.querySelector('bdi') || !/Source:/.test(src.querySelector('bdi').textContent))
          throw new Error('the Source: label is not isolated, so its colon lands on the wrong side in a Hebrew recipe');
        closeM('viewOverlay');
        openView(ids[1]); await wait(80);
        if(!/servings/.test(document.querySelector('#viewOverlay .modal-meta').textContent))
          throw new Error('a real count of people lost its "servings"');
        if(!document.querySelector('#viewOverlay .serv-input')) throw new Error('a real count lost its servings stepper');
        closeM('viewOverlay');
      } finally { recipes=recipes.filter(function(x){ return ids.indexOf(x.id)===-1; }); viewId=prevView; renderGrid(); }

      // EVERY DROPDOWN HAS A NAME (axe: critical). Drawn first, then asked.
      openCalcModal(); await wait(50); openAddModal(null); await wait(50);
      try{
        document.querySelectorAll('select').forEach(function(sel){
          var named=sel.getAttribute('aria-label')||sel.getAttribute('aria-labelledby')
            ||(sel.id && document.querySelector('label[for="'+sel.id+'"]'))||sel.closest('label');
          if(!named) throw new Error('a dropdown has no accessible name: #'+(sel.id||sel.className));
        });
        // The converter names its units but keeps the symbol as the VALUE.
        var from=document.getElementById('calcUnitFrom');
        if(!from.options.length || from.options[0].value!==CALC_CATS[_calcCat].units[0])
          throw new Error('the converter unit value is no longer the symbol');
        if(!/—/.test(from.options[0].textContent)) throw new Error('the converter units are still bare symbols');
      } finally { closeM('calcOverlay'); closeM('editOverlay'); }

      // UNITS IN SETTINGS.
      var prev=null; try{ prev=localStorage.getItem(VIEW_UNIT_KEY); }catch(e){}
      var realToast=window.toast; window.toast=function(){};
      try{
        localStorage.removeItem(VIEW_UNIT_KEY);
        toggleUnitPref();
        if(unitPref()!=='imperial') throw new Error('the Settings toggle did not switch to imperial');
        renderUnitsMenuItem();
        if(!/imperial/.test(document.getElementById('unitsMenuItem').textContent)) throw new Error('the menu item does not say imperial');
        toggleUnitPref();
        if(unitPref()!=='metric') throw new Error('the Settings toggle did not switch back');
      } finally { window.toast=realToast; try{ if(prev===null) localStorage.removeItem(VIEW_UNIT_KEY); else localStorage.setItem(VIEW_UNIT_KEY,prev); }catch(e){} }
    } },

  { id:'st_never_writes_real_cloud', group:'Cloud Sync', name:'A self test run cannot write to the real cloud (v36.57)',
    test: async()=>{
      // Tony's PC stopped mid-run on "EDITED_ELSEWHERE: … ערמונים: 10 מתכונים".
      // Two tests had been writing his first real recipe to the family cloud on
      // every run. For the length of a run the real connection is replaced by
      // a guard that reads straight through and holds every write back.
      if(typeof _selfTestNoCloudWrites!=='function') throw new Error('_selfTestNoCloudWrites not defined');
      var inner=_fakeFirestore({ 'recipe_5':{ r:JSON.stringify({id:5,name:'real'}), updatedAt:7 } });
      var g=_selfTestNoCloudWrites(inner);
      var got=await g.collection('shared').doc('recipe_5').get();
      if(!got.exists || got.data().updatedAt!==7) throw new Error('a READ through the guard did not reach the database');
      await g.collection('shared').doc('recipe_5').set({ r:'{}', updatedAt:99 });
      await g.collection('shared').doc('recipe_6').set({ r:'{}', updatedAt:1 });
      await g.collection('shared').doc('recipe_5').delete();
      await g.runTransaction(async function(tx){
        var s=await tx.get(g.collection('shared').doc('recipe_5'));
        if(!s.exists) throw new Error('a read inside a guarded transaction did not reach the database');
        tx.set(g.collection('shared').doc('recipe_5'), { r:'{}', updatedAt:123 });
      });
      var after=await inner.collection('shared').doc('recipe_5').get();
      if(!after.exists) throw new Error('a DELETE went through the guard');
      if(after.data().updatedAt!==7) throw new Error('a WRITE went through the guard: updatedAt is '+after.data().updatedAt);
      if((await inner.collection('shared').doc('recipe_6').get()).exists)
        throw new Error('a new document was CREATED through the guard');
      // …and the parking installs it and takes it off again (v36.63: shared by
      // runSelfTests and the CI runner, so it is tested by what it DOES).
      var src=String(runSelfTests);
      if(src.indexOf('_selfTestPark(')===-1 || src.indexOf('_selfTestUnpark(')===-1)
        throw new Error('runSelfTests does not park and unpark');
      var outerDb=window._fbDb, heldWas=_selfTestHeldWrites, real2=_fakeFirestore({});
      try{
        window._fbDb=real2;
        var p=await _selfTestPark();
        if(window._fbDb===real2) throw new Error('parking did not install the guard');
        await window._fbDb.collection('shared').doc('recipe_9').set({ r:'{}' });
        if((await real2.collection('shared').doc('recipe_9').get()).exists) throw new Error('a write went through the parked connection');
        _selfTestUnpark(p);
        if(window._fbDb!==real2) throw new Error('unparking did not put the real connection back');
      } finally { window._fbDb=outerDb; _selfTestHeldWrites=heldWas; }
    } },

  { id:'i18n_reordered_links_do_not_loop', group:'UI', name:'A translation that moves the links cannot freeze the app (v36.52)',
    test: async()=>{
      // Tony generated Japanese and his laptop stopped responding to anything —
      // through a reboot, and in a fresh Firefox too, while English and Hebrew
      // were fine. Japanese is subject-object-verb: "Press {1} and then {2}"
      // comes back as "{2}の前に{1}を押す", with the links in the other order.
      // The children were matched to {1}/{2} by their position ON SCREEN, so
      // the next pass read the translation's order as the English one and
      // swapped them back — and the pass after that swapped them again. Each
      // swap was four mutation records, the observer queued the element once
      // per record, and four became sixteen became sixty-four.
      ['i18nKidOrder','i18nRewriteRunaway'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var host=document.createElement('div');
      host.innerHTML='<div id="zko">Press <b id="zkoA">Open</b> and then <b id="zkoB">Save</b> now</div>';
      document.body.appendChild(host);
      var prevDict=i18nCurrentDict(), prevLang=i18nLang();
      var el=document.getElementById('zko');
      var order=function(){ return Array.prototype.map.call(el.querySelectorAll('b'),
        function(b){ return b.id==='zkoA'?'A':'B'; }).join(''); };
      try{
        i18nInstall('ja', { 'Press {1} and then {2} now':'{2}の前に{1}を押す' });
        var passes=[];
        for(var i=0;i<5;i++) passes.push(i18nApply(el)+':'+order());
        if(passes[0]!=='1:BA')
          throw new Error('the first pass did not put the links where the translation asks: '+passes[0]);
        if(passes.slice(1).join(' ')!=='0:BA 0:BA 0:BA 0:BA')
          throw new Error('every pass rewrote the sentence again: '+passes.join(' ')
            + ' — the links are being swapped back and forth, which under the observer never stops');
        var u=i18nUnits(el).filter(function(x){ return x.el===el; })[0];
        if(!u || u.slots[0]!==document.getElementById('zkoA'))
          throw new Error('{1} no longer means the first link of the ENGLISH sentence');

        // Under the observer, with nothing else happening, it must go quiet.
        i18nStartObserver();
        var rewrites=0;
        var mo=new MutationObserver(function(r){ rewrites+=r.length; });
        mo.observe(el,{ childList:true });
        el.appendChild(document.createTextNode(''));           // a nudge, as a re-render would give it
        for(var f=0;f<6;f++) await new Promise(function(r){ requestAnimationFrame(function(){ r(); }); });
        await new Promise(function(r){ setTimeout(r,300); });
        mo.disconnect();
        if(rewrites>8)
          throw new Error(rewrites+' mutations on one sentence in a few frames — it is still rewriting itself');

        // …and going back to English puts each link back in ITS OWN place.
        i18nInstall('en', null); i18nRevertAll();
        if(el.textContent!=='Press Open and then Save now')
          throw new Error('reverting after a reordering language gave '+JSON.stringify(el.textContent));
      } finally { try{ i18nRevertAll(); }catch(e){} i18nInstall(prevLang, prevDict); host.remove(); }

      // THE BREAKER. Whatever the next language's dictionary does, one bad
      // entry must cost one label and not the app. Twenty rewrites of one
      // element inside a second and it is left alone — and logged, with the key
      // and the value, because that log line is how the fault gets found.
      var probe=document.createElement('span'), tripped=-1;
      for(var n=0;n<30;n++){ if(i18nRewriteRunaway(probe,'k','v') && tripped<0) tripped=n; }
      if(tripped<0) throw new Error('thirty rewrites of one element in a moment did not trip the breaker');
      if(tripped<15) throw new Error('the breaker tripped after only '+tripped+' — ordinary UI would trip it');
      if(!i18nRewriteRunaway(probe,'k','v')) throw new Error('a tripped element was let back in');
      var calm=document.createElement('span');
      for(var c2=0;c2<5;c2++) if(i18nRewriteRunaway(calm,'k','v')) throw new Error('five rewrites tripped the breaker');
    } },

  { id:'i18n_says_how_long', group:'UI', name:'The translate dialog says how long it really takes (v36.51)',
    test: async()=>{
      // Tony agreed to "about half a minute" and the progress panel — which
      // measures the real thing — then told him eight minutes. The panel was
      // right; the dialog was a sentence somebody typed. A number in a dialog
      // that the next screen contradicts is worse than no number at all.
      ['i18nBatchCatalogue','i18nEstimate','i18nDurationWords','i18nMsPerBatch']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      // The estimate must be built from the SAME batching the run uses, or it
      // is just a different guess.
      var cat=[]; for(var i=0;i<400;i++) cat.push('String number '+i+' of the interface');
      var batches=i18nBatchCatalogue(cat);
      if(!batches.length) throw new Error('no batches at all');
      var flat=[]; batches.forEach(function(b){ flat=flat.concat(b); });
      if(flat.length!==cat.length)
        throw new Error('batching lost or duplicated strings: '+flat.length+' of '+cat.length);
      if(flat.join('\u0000')!==cat.join('\u0000'))
        throw new Error('batching reordered the catalogue');
      batches.forEach(function(b){
        var chars=b.reduce(function(n,s){ return n+s.length; },0);
        if(b.length>1 && chars>I18N_BATCH_CHARS+String(b[b.length-1]).length)
          throw new Error('a batch is over the character budget: '+chars);
      });
      if(i18nEstimate(cat).batches!==batches.length)
        throw new Error('the estimate counts batches differently from the run');

      // A duration, not a countdown — this is said before anything starts.
      if(!/minute/.test(i18nDurationWords(20000)))
        throw new Error('20s did not read as a sub-minute duration: '+i18nDurationWords(20000));
      if(i18nDurationWords(480000)!=='about 8 minutes')
        throw new Error('8 minutes read as '+JSON.stringify(i18nDurationWords(480000)));
      if(/left/.test(i18nDurationWords(480000)))
        throw new Error('the before-you-start estimate is worded as a countdown');

      // The per-batch figure is learned, and clamped so one freak batch on a
      // dropping connection cannot tell the next person it takes an hour.
      var prevMs=null;
      try{ prevMs=localStorage.getItem(I18N_MS_PER_BATCH_KEY); }catch(e){}
      try{
        i18nNoteBatchTime(600000, 1);             // 10 minutes for one batch
        if(i18nMsPerBatch()>60000)
          throw new Error('an absurd batch time was believed: '+i18nMsPerBatch());
        i18nNoteBatchTime(1, 1);                  // instant
        if(i18nMsPerBatch()<1500)
          throw new Error('an impossible batch time was believed: '+i18nMsPerBatch());
        i18nNoteBatchTime(80000, 10);             // 8s a batch, twice
        i18nNoteBatchTime(80000, 10);
        var learned=i18nMsPerBatch();
        if(learned<6000 || learned>14000)
          throw new Error('the learned per-batch time did not converge: '+learned);
      } finally {
        try{ if(prevMs===null) localStorage.removeItem(I18N_MS_PER_BATCH_KEY);
             else localStorage.setItem(I18N_MS_PER_BATCH_KEY,prevMs); }catch(e){}
      }
    } },

  { id:'i18n_batches_run_three_at_once', group:'UI', name:'A new language runs three batches at a time (v36.62, audit C2)',
    test: async()=>{
      if(typeof I18N_LANES!=='number' || I18N_LANES<2) throw new Error('I18N_LANES is not set');
      var realAI=window.aiCall, realCancel=window.progressCancelled, prevMs=null;
      try{ prevMs=localStorage.getItem(I18N_MS_PER_BATCH_KEY); }catch(e){}
      // Long enough strings that the catalogue makes plenty of batches.
      var cat=[]; for(var i=0;i<300;i++) cat.push('Interface sentence number '+i+' with some length to it');
      var nBatches=i18nBatchCatalogue(cat).length;
      if(nBatches<I18N_LANES*2) throw new Error('the fixture makes only '+nBatches+' batches');
      function answer(prompt){
        var body=prompt.slice(prompt.indexOf('Strings:\n')+9);
        var out={}; body.split('\n').forEach(function(l){ var m=/^(\d+)\. (.*)$/.exec(l); if(m) out[m[1]]='T:'+m[2]; });
        return JSON.stringify(out);
      }
      try{
        // (1) Three at once — never more, which is what keeps it inside the
        // Worker's forty a minute — and every string comes back.
        var inFlight=0, peak=0, calls=0;
        window.aiCall=async function(prompt){
          calls++; inFlight++; peak=Math.max(peak,inFlight);
          await new Promise(function(r){ setTimeout(r, 15); });
          inFlight--; return answer(prompt);
        };
        var res=await i18nTranslateAll('he', cat);
        if(peak!==I18N_LANES) throw new Error('ran '+peak+' batch(es) at once, not '+I18N_LANES);
        if(calls!==nBatches) throw new Error('made '+calls+' calls for '+nBatches+' batches');
        if(Object.keys(res.dict).length!==cat.length || res.missing)
          throw new Error('lost strings: '+Object.keys(res.dict).length+' of '+cat.length);
        if(res.dict[cat[123]]!=='T:'+cat[123]) throw new Error('an answer landed on the wrong string');

        // (2) One failed batch is still one failed batch: the others finish.
        var n2=0;
        window.aiCall=async function(prompt){
          var me=++n2; await new Promise(function(r){ setTimeout(r, 5); });
          if(me===2) throw new Error('API error 400: bad request');
          return answer(prompt);
        };
        var res2=await i18nTranslateAll('he', cat);
        if(res2.failed!==1) throw new Error('expected exactly 1 failed batch, got '+res2.failed);
        if(Object.keys(res2.dict).length<cat.length-I18N_BATCH) throw new Error('a failed batch took others down with it');

        // (3) Stop still stops: no new batch starts after it is pressed.
        var n3=0, stopped=false;
        window.progressCancelled=function(){ return stopped; };
        window.aiCall=async function(prompt){
          n3++; if(n3===I18N_LANES) stopped=true;
          await new Promise(function(r){ setTimeout(r, 5); });
          return answer(prompt);
        };
        await i18nTranslateAll('he', cat);
        if(n3>I18N_LANES) throw new Error('batches kept starting after Stop: '+n3+' calls');

        // (4) The estimate is the number of ROUNDS, and what is learned is the
        // time one batch takes, so the two agree however many lanes there are.
        localStorage.setItem(I18N_MS_PER_BATCH_KEY, '9000');
        var est=i18nEstimate(cat);
        if(est.ms!==Math.ceil(nBatches/I18N_LANES)*9000)
          throw new Error('the estimate is '+est.ms+' ms, not '+Math.ceil(nBatches/I18N_LANES)+' rounds of 9 s');
      } finally {
        window.aiCall=realAI; window.progressCancelled=realCancel;
        try{ if(prevMs===null) localStorage.removeItem(I18N_MS_PER_BATCH_KEY); else localStorage.setItem(I18N_MS_PER_BATCH_KEY,prevMs); }catch(e){}
      }
    } },

  { id:'i18n_cards_translated_when_built', group:'UI', name:'Recipe cards are translated as they are built (v36.62, audit C1)',
    test: async()=>{
      ['i18nPhrase','i18nCardLabels','i18nInstall'].forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var realR=recipes, realView=viewMode, langWas=_i18nLang, dictWas=_i18nDict;
      // A language nobody uses, so no real "still missing" list is touched.
      var LANG='xx', missKey=I18N_MISS_PREFIX+LANG;
      var fix=[
        { id:888970, name:'Card test one',   category:'Pasta',  difficulty:'Hard', servings:'4', cookCount:5, fav:true },
        { id:888971, name:'Card test two',   category:'Dinner', difficulty:'Easy', servings:'2', fav:false, isClip:true },
        { id:888972, name:'Card test three', category:'Soup',   difficulty:'Medium', servings:'6',
          parts:[{ name:'Part A', ingredients:[], steps:['x'] }, { name:'Part B', ingredients:[], steps:['y'] }] }
      ].map(function(o){ o.ingredients=o.ingredients||[]; o.steps=o.steps||['x']; return normalizeRecipe(o); });
      try{
        recipes=fix.slice();
        document.getElementById('searchInput').value='';
        // The catalogue still knows what only a card shows.
        if(i18nFullCatalogue().indexOf('Pasta')===-1) throw new Error('a meal type only a card shows fell out of the catalogue');
        // A dictionary with an answer for everything, and no Latin letters in
        // any answer — so any English left on a card is English we missed.
        var dict={}, n=0;
        i18nFullCatalogue().concat(I18N_EXTRA).forEach(function(k){ dict[k]='ש'+(n++)+(k.indexOf('{1}')!==-1?' {1}':''); });
        i18nInstall(LANG, dict);
        var left=[];
        // …including under a search that matched only the meal type, which
        // adds a "🏷️ Pasta" line to the card.
        [['grid','',3],['list','',3],['grid','pasta',1],['list','pasta',1]].forEach(function(run){
          var mode=run[0]+(run[1]?' searching "'+run[1]+'"':'');
          viewMode=run[0]; document.getElementById('searchInput').value=run[1]; renderGrid();
          var cards=document.querySelectorAll('#recipeGrid .recipe-card, #recipeGrid .recipe-list-item');
          if(cards.length!==run[2]) throw new Error(mode+': drew '+cards.length+' cards, not '+run[2]);
          if(run[1] && !document.querySelector('#recipeGrid .match-why')) throw new Error(mode+': no match reason was drawn');
          cards.forEach(function(c){
            if(!c.hasAttribute('data-no-i18n')) left.push(mode+': a card is not marked as already translated');
            // Take the marking off a COPY and ask the ordinary translation walk
            // what it would still find. The card's aria-label is the recipe's
            // name, which is content.
            var copy=c.cloneNode(true);
            copy.removeAttribute('data-no-i18n'); copy.setAttribute('data-i18n-skip-attrs','aria-label');
            copy.querySelectorAll('[data-no-i18n]').forEach(function(e){ e.removeAttribute('data-no-i18n'); });
            i18nUnits(copy).forEach(function(u){ left.push(mode+': "'+u.key+'"'+(u.attr?' ('+u.attr+')':'')); });
          });
          // …and the translation pass itself has nothing to do on the grid.
          if(i18nUnits(document.getElementById('recipeGrid')).length) left.push(mode+': the observer still walks the cards');
        });
        document.getElementById('searchInput').value='';
        viewMode='list'; renderGrid();
        if(left.length) throw new Error('English left on a card in a translated interface: '+left.slice(0,8).join(' · '));
        var badge=document.querySelector('#recipeGrid .recipe-list-meta span');
        if(!badge || badge.textContent!==dict['Pasta']) throw new Error('the meal type was not translated: '+(badge&&badge.textContent));
        // Switching language redraws the cards — back in English they say Pasta.
        i18nInstall('en', null);
        badge=document.querySelector('#recipeGrid .recipe-list-meta span');
        if(!badge || badge.textContent!=='Pasta') throw new Error('back in English, a card still reads '+(badge&&badge.textContent));
      } finally {
        recipes=realR; viewMode=realView; document.getElementById('searchInput').value='';
        i18nInstall(langWas, dictWas);
        renderGrid();
        await new Promise(function(r){ setTimeout(r, 500); });   // the missing-list writer runs on a timer
        try{ localStorage.removeItem(missKey); }catch(e){}
      }
    } },

  { id:'cost_ai_this_month', group:'Cloud Sync', name:'Sync Health says what the AI cost this month (v36.63, audit H1)',
    test: async()=>{
      ['aiCallCost','aiSpendNote','aiSpendRead','aiSpendLine'].forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var was=null; try{ was=localStorage.getItem(AI_SPEND_KEY); }catch(e){}
      var realFetch=window.fetch;
      function near(a,b){ return Math.abs(a-b)<1e-9; }
      try{
        // (1) The arithmetic, against the published prices.
        var M=1000000;
        if(!near(aiCallCost('claude-sonnet-5',{ input_tokens:M, output_tokens:M }), 12)) throw new Error('Sonnet 5: 1M in + 1M out should be $12');
        if(!near(aiCallCost('claude-sonnet-5',{ cache_read_input_tokens:M, cache_creation_input_tokens:M }), 2.7)) throw new Error('Sonnet 5 cache read + write should be $2.70');
        if(!near(aiCallCost('claude-haiku-4-5',{ input_tokens:M, output_tokens:M }), 6)) throw new Error('Haiku 4.5: 1M in + 1M out should be $6');
        if(!near(aiCallCost('claude-sonnet-5',{ server_tool_use:{ web_search_requests:3 } }), 0.03)) throw new Error('three web searches should be $0.03');
        if(aiCallCost('claude-somebody-new',{ input_tokens:5 })!==null) throw new Error('a model with no price was priced by guessing');
        // Both models the app actually uses have a price.
        [AI_MODEL, AI_MODEL_SMALL].forEach(function(m){ if(!AI_PRICES[m]) throw new Error('no price for '+m+', which the app uses'); });

        // (2) Counted per calendar month: last month's total does not carry over.
        localStorage.setItem(AI_SPEND_KEY, JSON.stringify({ month:'2000-01', calls:99, usd:50, unpriced:0 }));
        if(aiSpendRead().calls!==0 || aiSpendRead().usd!==0) throw new Error('an old month was carried into this one');
        localStorage.removeItem(AI_SPEND_KEY);
        aiSpendNote('claude-somebody-new', { input_tokens:10 });
        var o=aiSpendRead();
        if(o.calls!==1 || o.unpriced!==1 || o.usd!==0) throw new Error('an unpriced call was not counted as one: '+JSON.stringify(o));
        if(!/no price listed/.test(aiSpendLine(o))) throw new Error('the line hides that a call could not be priced: '+aiSpendLine(o));

        // (3) The real call path counts what the answer says it used — even
        // when the answer was cut off, because that one is billed too.
        localStorage.removeItem(AI_SPEND_KEY);
        window.fetch=function(u, init){
          var b={}; try{ b=JSON.parse(init && init.body || '{}'); }catch(e){}
          if(b.messages) return Promise.resolve(new Response(JSON.stringify({ content:[{ text:'{"a":1}' }], stop_reason:'end_turn',
            usage:{ input_tokens:100000, output_tokens:10000 } }), { status:200 }));
          return realFetch.apply(window, arguments);
        };
        await _aiCallUncached('cost test '+Date.now(), 500, null, null, AI_MODEL_SMALL);
        o=aiSpendRead();
        if(o.calls!==1) throw new Error('a real answer was not counted');
        if(!near(o.usd, 0.1+0.05)) throw new Error('100k in + 10k out on Haiku should be $0.15, got '+o.usd);
        window.fetch=function(u, init){
          var b={}; try{ b=JSON.parse(init && init.body || '{}'); }catch(e){}
          if(b.messages) return Promise.resolve(new Response(JSON.stringify({ content:[{ text:'{"a":' }], stop_reason:'max_tokens',
            usage:{ input_tokens:1000, output_tokens:500 } }), { status:200 }));
          return realFetch.apply(window, arguments);
        };
        try{ await _aiCallUncached('cost test cut '+Date.now(), 500, null, null, AI_MODEL_SMALL); }catch(e){}
        if(aiSpendRead().calls!==2) throw new Error('a truncated answer (still billed) was not counted');

        // (4) H2 — a translation that would outrun today's Worker allowance
        // says so before it starts, and one that fits says nothing.
        var wh=_workerHealth;
        try{
          _workerHealth={ spend:{ dailyUsed:280, dailyMax:300 } };
          if(!/20 more AI call/.test(i18nBudgetNote(50))) throw new Error('50 batches with 20 calls left was not warned about: "'+i18nBudgetNote(50)+'"');
          _workerHealth={ spend:{ dailyUsed:10, dailyMax:300 } };
          if(i18nBudgetNote(50)!=='') throw new Error('a translation that fits was warned about');
          _workerHealth={ spend:{ dailyUsed:null, dailyMax:300 } };
          if(i18nBudgetNote(50)!=='') throw new Error('an unknown count produced a made-up warning');
        } finally { _workerHealth=wh; }

        // (5) It is where Tony would see it.
        renderSyncHealth();
        var body=document.getElementById('syncHealthBody');
        if(!body || body.textContent.indexOf('AI this month')===-1) throw new Error('Sync Health does not show the AI spend');
        if(syncHealthText().indexOf('AI this month')===-1) throw new Error('the Sync Health report does not include the AI spend');
      } finally {
        window.fetch=realFetch;
        try{ if(was===null) localStorage.removeItem(AI_SPEND_KEY); else localStorage.setItem(AI_SPEND_KEY, was); }catch(e){}
        try{ renderSyncHealth(); }catch(e){}
      }
    } },

  { id:'i18n_editor_is_usable', group:'UI', name:'A translation can be corrected by hand (v36.33)',
    test: async()=>{
      ['openI18nEditor','i18nEdRender','i18nEdEdit','i18nEdSave','i18nEdRecommend','i18nEdTake']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(!document.getElementById('i18nOverlay'))
        throw new Error('#i18nOverlay is not in the page — the ✏️ Edit translations menu item goes nowhere');

      var prevDict=i18nCurrentDict(), prevLang=i18nLang(), prevUser=window._fbUser;
      var prevDb=window._fbDb, realToast=window.toast, realAI=window.aiCall, said='';
      try{
        window.toast=function(m){ said=String(m||''); };
        // Not everyone may edit: Save rewrites a file every device reads.
        window._fbUser=null;
        openI18nEditor();
        if(document.getElementById('i18nOverlay').classList.contains('open'))
          throw new Error('the editor opened for somebody with no access at all');
        if(!/full access/i.test(said)) throw new Error('it did not say why: "'+said+'"');

        window._fbUser={ email:'rozinante2004@gmail.com' };
        var cat=i18nCatalogue();
        if(cat.indexOf('Clips')===-1) throw new Error('the catalogue has no Clips button to edit');
        var dict={}; cat.forEach(function(s,i){ if(i%3) dict[s]='«'+s+'»'; });
        // One key that is definitely TRANSLATED, to search the right-hand
        // column with, and one that is definitely not, to correct by hand.
        var someKey=cat.filter(function(s){ return /Collections/.test(s); })[0];
        if(!someKey) throw new Error('no Collections string in the catalogue to search for');
        dict[someKey]='«'+someKey+'»';
        delete dict['Clips'];
        i18nInstall('he', dict); i18nApply(document.body);

        openI18nEditor();
        if(!document.getElementById('i18nOverlay').classList.contains('open'))
          throw new Error('the editor did not open for an owner');
        // The editor shows ENGLISH on the left, even with the interface in
        // Hebrew — i18nSkip stops at #i18nOverlay. If this is ever translated,
        // the left column stops being the thing you match against.
        if(document.getElementById('i18nEdTitle').textContent.indexOf('«')!==-1)
          throw new Error('the editor translated itself — the English column is no longer English');

        var rows=function(){ return document.querySelectorAll('#i18nEdRows .i18n-ed-row'); };
        if(!rows().length) throw new Error('the editor drew no rows');
        // The work comes first.
        if(rows()[0].querySelector('.i18n-ed-to').value)
          throw new Error('a translated row is listed above untranslated ones — the gaps are the work');

        var search=document.getElementById('i18nEdSearch');
        var names=function(){ return Array.prototype.map.call(rows(), function(r){
          return r.querySelector('.i18n-ed-en').textContent.replace(/orphan$/,'').trim(); }); };

        // Search must accept EITHER language. Finding the English is the whole
        // difficulty: you spotted the wrong word on a Hebrew button.
        var hits=function(){ return names().filter(function(n){ return /Collections/.test(n); }); };
        search.value='Collections'; i18nEdRender();
        if(!hits().length)
          throw new Error('searching the English found nothing: '+JSON.stringify(names().slice(0,5)));
        search.value='«'+someKey+'»'; i18nEdRender();
        if(!hits().length)
          throw new Error('searching the TRANSLATION found nothing — half the point of the search');

        document.getElementById('i18nEdOnlyGaps').checked=true;
        search.value=''; i18nEdRender();
        if(!rows().length) throw new Error('"only untranslated" hid everything, including the gaps');
        if(Array.prototype.some.call(rows(), function(r){ return !!r.querySelector('.i18n-ed-to').value; }))
          throw new Error('"only untranslated" is showing rows that are translated');
        document.getElementById('i18nEdOnlyGaps').checked=false;

        // Recommend offers, it does not replace. Nothing changes until a chip
        // is clicked — a button that silently overwrote the line you were
        // reading would be unusable.
        search.value='Clips'; i18nEdRender();
        var row=Array.prototype.filter.call(rows(), function(r){
          return r.querySelector('.i18n-ed-en').textContent.trim()==='Clips'; })[0];
        if(!row) throw new Error('the untranslated Clips button is not in the editor');
        var ta=row.querySelector('.i18n-ed-to');
        window.aiCall=function(){ return Promise.resolve('{"options":["קליפים","סרטונים","וידאו"]}'); };
        await i18nEdRecommend(row.querySelector('.i18n-ed-rec'));
        var opts=row.querySelectorAll('.i18n-ed-opt');
        if(opts.length!==3) throw new Error('it offered '+opts.length+' alternatives, not 3');
        if(ta.value) throw new Error('Recommend overwrote the line instead of offering');
        opts[1].click();
        if(ta.value!=='סרטונים') throw new Error('clicking an alternative did not take it: '+JSON.stringify(ta.value));
        if(row.querySelector('.i18n-ed-opt')) throw new Error('the alternatives stayed on screen after one was chosen');

        // Two very different things get called "orphan", and lumping them
        // together makes the useful one unusable. Tony's Hebrew file held 2,395
        // entries against a catalogue of 1,231: about 1,150 were code fragments
        // an earlier string finder recorded, and a handful were real English
        // that had been reworded. "Remove 1,160 orphans" hides the second kind
        // inside the first, and those are the ones worth reading first.
        _i18nEdDraft['+ x); if (y) z.push( + w); res.innerHTML = #FFF8E8;'] = 'junk';
        _i18nEdDraft['A sentence that was reworded in the markup'] = 'stale';
        var info = i18nEdKeys();
        if(!info.junk || !info.stale) throw new Error('the editor no longer tells the two apart');
        var junk = info.all.filter(info.junk), stale = info.all.filter(info.stale);
        if(junk.indexOf('+ x); if (y) z.push( + w); res.innerHTML = #FFF8E8;') === -1)
          throw new Error('a source fragment was not classed as unusable');
        if(stale.indexOf('A sentence that was reworded in the markup') === -1)
          throw new Error('a reworded English string was not classed as an orphan');
        if(junk.indexOf('A sentence that was reworded in the markup') !== -1)
          throw new Error('real English was classed as unusable — it would be deleted without a reading');
        i18nEdRender();                       // the count line is drawn, not computed
        var line = document.getElementById('i18nEdCount').textContent;
        if(!/remove \d+ unusable/.test(line) || !/remove \d+ orphan/.test(line))
          throw new Error('the editor offers only one of the two clean-ups: '+JSON.stringify(line));
        delete _i18nEdDraft['+ x); if (y) z.push( + w); res.innerHTML = #FFF8E8;'];
        delete _i18nEdDraft['A sentence that was reworded in the markup'];

        // REMOVING IS UNDOABLE. Every entry here was paid for; deleting a
        // thousand on one click with "cannot be undone" as the only protection
        // is not a safe thing to offer.
        var realConfirm2 = window.askConfirm;
        try {
          window.askConfirm = function(){ return Promise.resolve(true); };
          try { localStorage.removeItem('tonys_i18n_bin_he'); } catch(e) {}
          _i18nEdDraft['A string the app has not shown for a year'] = 'תרגום';
          i18nEdInvalidate();
          await i18nEdDropOrphans();
          if(_i18nEdDraft['A string the app has not shown for a year'])
            throw new Error('the orphan was not removed');
          if(Object.keys(i18nEdBin('he')).indexOf('A string the app has not shown for a year') === -1)
            throw new Error('a removed translation was not kept — there is no way back from the click');
          await i18nEdRestoreBin();
          if(_i18nEdDraft['A string the app has not shown for a year'] !== 'תרגום')
            throw new Error('putting it back did not restore the translation');
          delete _i18nEdDraft['A string the app has not shown for a year'];
        } finally { window.askConfirm = realConfirm2; try { localStorage.removeItem('tonys_i18n_bin_he'); } catch(e) {} }

        // …and an orphan that is only an older SPELLING of a live key is
        // re-used rather than deleted. "{1}Clips" and "Clips" are the same
        // button: the key rules changed, the Hebrew did not.
        var liveKey = cat.filter(function(x){ return /Collections/.test(x); })[0];
        if(!liveKey) throw new Error('no live key to test re-matching against');
        var oldSpelling = '{1}' + liveKey;      // how the key was written before v36.32
        _i18nEdDraft[oldSpelling] = 'אוספים';
        delete _i18nEdDraft[liveKey];
        i18nEdInvalidate();
        var pairs = i18nEdOrphanMatches().filter(function(x){ return x.from === oldSpelling; });
        if(!pairs.length)
          throw new Error('an orphan differing only by an icon placeholder was not matched to '
            + JSON.stringify(liveKey));
        if(pairs[0].to !== liveKey)
          throw new Error('it matched the wrong key: '+JSON.stringify(pairs[0].to));
        delete _i18nEdDraft[oldSpelling];
        // A count baked into an OLD key is re-used now, and the Hebrew is
        // ported with it: "היסטוריה (3)" only becomes reusable as
        // "היסטוריה ({1})". Until v36.46 there was no way to fix the value, so
        // this case had to be refused; now refusing it would throw away paid
        // work for no reason.
        _i18nEdDraft['🕘 Version history (3)'] = 'היסטוריה (3)';
        delete _i18nEdDraft['🕘 Version history ({1})'];
        i18nEdInvalidate();
        var vh = i18nEdOrphanMatches().filter(function(x){ return x.from === '🕘 Version history (3)'; })[0];
        if(!vh) throw new Error('an old key with a count in it was not re-matched');
        if(vh.value !== 'היסטוריה ({1})')
          throw new Error('the count was left literal in the ported translation: '+JSON.stringify(vh.value)
            + ' — every version history would read (3) for ever');
        // …but it still refuses where there is no safe answer, which is what
        // i18n_a_number_is_not_a_key checks in detail.
        delete _i18nEdDraft['🕘 Version history (3)'];
        i18nEdInvalidate();

        // Saving changes the LIVE interface, which is why the editor is worth
        // having — and must not eat the button's icon on the way.
        window._fbDb=null;                     // no cloud here: it falls back to the device
        said='';
        await i18nEdSave();
        var live=document.getElementById('mobileClipBtn');
        if(live.textContent.trim()!=='סרטונים')
          throw new Error('the app still shows '+JSON.stringify(live.textContent.trim())+' after saving');
        if(!live.querySelector('svg')) throw new Error('saving the translation ate the button’s icon');
        if(i18nMissingList().indexOf('Clips')!==-1)
          throw new Error('a string that has just been translated by hand is still counted as missing');
      } finally {
        window.aiCall=realAI; window.toast=realToast;
        window._fbUser=prevUser; window._fbDb=prevDb;
        try{ document.getElementById('i18nOverlay').classList.remove('open'); }catch(e){}
        try{ i18nRevertAll(); }catch(e){}
        i18nInstall(prevLang, prevDict);
      }
    } },

  { id:'i18n_never_touches_a_recipe', group:'UI', name:'Translating the interface never touches a recipe (v36.31)',
    test: async()=>{
      ['i18nCatalogue','i18nApply','i18nRevertAll','i18nUnits','i18nTranslatable'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      // The whole promise of this feature is that it translates the BUTTONS and
      // leaves the cooking alone. A dictionary keyed on English text could
      // quietly rewrite a recipe called "Chicken Soup" into another language,
      // and nobody would notice until the recipe was gone in every sense that
      // matters. So: a marker string is planted in every field of a real recipe
      // and the catalogue is searched for it.
      var MARK='ZQXJ';
      var snapshot=recipes.slice(), snapId=nextId, prevView=viewId, prevMode=viewMode;
      var realSave=window.saveData, realLocal=window.saveLocal, realToast=window.toast;
      var prevDict=_i18nDict, prevLang=_i18nLang;
      try{
        window.saveData=function(){}; window.saveLocal=function(){}; window.toast=function(){};
        recipes=[normalizeRecipe({ id:889001, name:MARK+'Soup', by:MARK+'Gran', prep:MARK+'min',
          servings:'4', source:'https://'+MARK+'.test/r', category:'Soup', difficulty:'Easy',
          ingredients:[{a:'2',n:MARK+'onions',g:MARK+'group'}], steps:[MARK+' fry slowly'],
          notes:MARK+' note', updatedAt:Date.now() })];
        nextId=889100;

        function leaks(){ return i18nCatalogue().filter(function(x){ return x.indexOf(MARK)!==-1; }); }
        renderGrid(); renderFilters();
        var g=leaks(); if(g.length) throw new Error('recipe text reached the grid catalogue: '+JSON.stringify(g));
        viewMode='list'; renderGrid();
        var l=leaks(); if(l.length) throw new Error('recipe text reached the list catalogue: '+JSON.stringify(l));
        viewMode=prevMode; renderGrid();
        openView(889001); await wait(120);
        var v=leaks(); if(v.length) throw new Error('recipe text reached the open-recipe catalogue: '+JSON.stringify(v));
        closeM('viewOverlay');

        // …and prove it by actually translating: every unit gets a visible
        // prefix, then the recipe is checked for one. A catalogue check alone
        // would miss a path that translates without cataloguing.
        var cat=i18nCatalogue();
        if(cat.length < 200) throw new Error('only '+cat.length+' UI strings found — the walk is not reaching the app');
        var dict={}; cat.forEach(function(x){ dict[x]='##'+x; });
        _i18nDict=dict; _i18nLang='he';
        // Open FIRST, then apply. In the app a MutationObserver catches
        // anything rendered after a language is chosen; here that would make the
        // test depend on two animation frames, and a flaky test about recipe
        // safety is worse than none. The observer's own behaviour is asserted
        // separately, below.
        openView(889001); await wait(120);
        i18nApply(document.body);
        var vm=document.getElementById('viewModal').textContent;
        [[MARK+'Soup','the name'],[MARK+'onions','an ingredient'],[MARK+' fry slowly','a step'],
         [MARK+' note','the notes']].forEach(function(pair){
          if(vm.indexOf(pair[0])===-1) throw new Error(pair[1]+' vanished from the open recipe');
          if(vm.indexOf('##'+pair[0])!==-1) throw new Error(pair[1]+' was TRANSLATED — this is someone\u2019s recipe');
        });
        if(vm.indexOf('##')===-1) throw new Error('nothing at all was translated, so this proves nothing');
        closeM('viewOverlay');

        // The observer is what keeps a re-render translated — without it the
        // interface reverts to English on the first filter toggle.
        i18nStartObserver();
        renderFilters();
        await new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); });
        var allBtn=document.querySelector('#filterBar .all-btn, #mobileAllBtn');
        if(allBtn && allBtn.textContent.indexOf('##')===-1)
          throw new Error('a re-render came back in English: the observer is not re-applying');

        // Switching language must translate the SOURCE, never a translation.
        // The English original is parked on each node the first time it is
        // touched; without that, the second language is applied to the first
        // one's output and two switches compound into gibberish.
        //
        // Assert the parking EXISTS before relying on it. The first version of
        // this check used querySelector('[data-i18n-src]'), which is null when
        // the parking is gone — so removing it made the check skip itself and
        // the mutation passed. A guard that disappears with the thing it guards
        // is not a guard.
        var parked=document.querySelectorAll('[data-i18n-src]');
        if(parked.length < 50)
          throw new Error('only '+parked.length+' nodes kept their English original; nothing could be reverted or re-translated');
        var dict2={}; cat.forEach(function(x){ dict2[x]='@@'+x; });
        _i18nDict=dict2; _i18nLang='fr'; i18nApply(document.body);
        var compounded=0, firstBad='';
        var after=document.querySelectorAll('[data-i18n-src]');
        for(var ci=0; ci<after.length; ci++){
          if(after[ci].textContent.indexOf('##')!==-1){
            compounded++; if(!firstBad) firstBad=after[ci].textContent.trim().slice(0,50);
          }
        }
        if(compounded) throw new Error(compounded+' element(s) had the second language applied on top of the first, e.g. "'+firstBad+'"');

        // And English comes back exactly, not approximately.
        _i18nDict=null; _i18nLang='en'; i18nRevertAll();
        var still=document.querySelectorAll('[data-i18n-src]');
        for(var i=0;i<still.length && i<400;i++){
          var want=still[i].getAttribute('data-i18n-src');
          // v36.46 — the parked English is the RAW form: each child is a single
          // \u0001 marker, and numbers are literal. A unit carrying children
          // cannot be compared as flat text, which is what this always meant.
          if(want.indexOf('\u0001')!==-1 || want.indexOf('{')!==-1) continue;
          if(still[i].textContent.trim()!==want.trim())
            throw new Error('reverting left "'+still[i].textContent.trim().slice(0,40)+'" instead of "'+want.slice(0,40)+'"');
        }
      } finally {
        _i18nDict=prevDict; _i18nLang=prevLang;
        try{ i18nRevertAll(); }catch(e){}
        closeM('viewOverlay'); viewId=prevView; viewMode=prevMode;
        recipes=snapshot; nextId=snapId;
        window.saveData=realSave; window.saveLocal=realLocal; window.toast=realToast;
        renderGrid(); renderFilters();
      }

      // A URL is data in every language, and it is also a recipe's source field.
      if(i18nTranslatable('https://example.com/recipes/4')) throw new Error('a URL is offered for translation');
      if(i18nTranslatable('42')) throw new Error('a bare number is offered for translation');
      if(i18nTranslatable('🍲')) throw new Error('an emoji on its own is offered for translation');
      if(!i18nTranslatable('Add ingredient')) throw new Error('a real label is not translatable');
    } },

  { id:'ui_hebrew_recipe_reads_right', group:'UI', name:'A Hebrew recipe\u2019s labels sit on the right too (v36.30)',
    test: async()=>{
      if(typeof recipeIsRTL!=='function') throw new Error('recipeIsRTL not defined');
      if(recipeIsRTL({name:'Onion Soup',ingredients:[{n:'onions'}],steps:['fry']}))
        throw new Error('an English recipe was judged RTL');
      if(!recipeIsRTL({name:'\u05de\u05e8\u05e7 \u05d1\u05e6\u05dc',ingredients:[{n:'\u05d1\u05e6\u05dc'}],steps:['\u05dc\u05d7\u05ea\u05d5\u05da']}))
        throw new Error('a Hebrew recipe was not judged RTL');

      // Until v36.30 only the CONTENT of a Hebrew recipe was right-aligned.
      // Every label around it — SOUP, NOTES, Method, Ingredients — sat on the
      // left, so the page had the recipe pinned to one margin and its English
      // scaffolding pinned to the other. Assert what RENDERS: the stylesheet
      // looks perfectly reasonable either way.
      var snapshot=recipes.slice(), snapId=nextId, prevView=viewId;
      var realSave=window.saveData, realLocal=window.saveLocal;
      try{
        window.saveData=function(){}; window.saveLocal=function(){};
        recipes=[normalizeRecipe({ id:884001, name:'\u05de\u05e8\u05e7 \u05d1\u05e6\u05dc', category:'Soup',
          ingredients:[{a:'2',n:'\u05d1\u05e6\u05dc\u05d9\u05dd'}], steps:['\u05dc\u05d7\u05ea\u05d5\u05da'],
          notes:'\u05d4\u05e2\u05e8\u05d4', updatedAt:Date.now() })];
        nextId=884100;
        openView(884001); await wait(80);
        var content=document.querySelector('#viewModal .modal-content');
        if(!content) throw new Error('no .modal-content');
        if(!content.classList.contains('rtl-recipe'))
          throw new Error('a Hebrew recipe did not get the rtl-recipe class');
        if(getComputedStyle(content).direction!=='rtl')
          throw new Error('.modal-content still renders left-to-right for a Hebrew recipe');
        // The column headings are the ones that stayed behind: they sit inside
        // .recipe-columns, whose children are reset to ltr so the two-column
        // ORDER can flip without dragging each column's internals along.
        var head=document.querySelector('#viewModal .recipe-col-ings .modal-section-title');
        if(head && getComputedStyle(head).direction!=='rtl')
          throw new Error('the Ingredients heading still reads left-to-right while its list reads right-to-left');
        // The control strips stay LTR on purpose — x0.5 x1 x2 and Metric /
        // Imperial mean the same in any script and are learned by position.
        var mult=document.querySelector('#viewModal .multiplier-row');
        if(mult && getComputedStyle(mult).direction!=='ltr')
          throw new Error('the scale buttons were reversed; they are a numeric control strip, not a line of reading');

        // An English recipe must be untouched.
        recipes=[normalizeRecipe({ id:884002, name:'Onion Soup', category:'Soup',
          ingredients:[{a:'2',n:'onions'}], steps:['fry'], updatedAt:Date.now() })];
        openView(884002); await wait(80);
        var c2=document.querySelector('#viewModal .modal-content');
        if(c2.classList.contains('rtl-recipe')) throw new Error('an English recipe was flipped to RTL');
        if(getComputedStyle(c2).direction!=='ltr') throw new Error('an English recipe no longer reads left-to-right');
      } finally {
        closeM('viewOverlay'); viewId=prevView;
        recipes=snapshot; nextId=snapId;
        window.saveData=realSave; window.saveLocal=realLocal;
      }
    } },

  { id:'ui_edit_modal_can_use_the_window', group:'UI', name:'The Edit modal can be stretched to the window (v36.30)',
    test: async()=>{
      ['editWideEnabled','applyEditWide','toggleEditWide'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var modal=document.querySelector('#editOverlay .add-modal');
      var btn=document.getElementById('editWideBtn');
      if(!modal) throw new Error('no #editOverlay .add-modal');
      if(!btn) throw new Error('there is no widen button');

      // 600px is the right cap for a dialog you read and the wrong one for a
      // form you work in. Measure what RENDERS — a class that widens nothing is
      // exactly the failure this is for.
      var prev=null; try{ prev=localStorage.getItem(EDIT_WIDE_KEY); }catch(e){}
      var prevOpen=document.getElementById('editOverlay').classList.contains('open');
      try{
        document.getElementById('editOverlay').classList.add('open');
        try{ localStorage.removeItem(EDIT_WIDE_KEY); }catch(e){}
        applyEditWide();
        var narrow=modal.getBoundingClientRect().width;
        if(modal.classList.contains('wide')) throw new Error('it starts wide; the default should be the normal width');

        toggleEditWide();
        var wide=modal.getBoundingClientRect().width;
        var roomToGive = window.innerWidth > 700;
        if(roomToGive){
          if(!(wide > narrow + 100))
            throw new Error('widening gained only '+(wide-narrow)+'px — the class is set but nothing stretched');
          if(wide > window.innerWidth) throw new Error('it is wider than the window ('+wide+' of '+window.innerWidth+')');
          if(!btn.offsetWidth) throw new Error('the button is hidden on a screen with room to give');
          // The FIELDS have to come with it. That is the half Tony asked for:
          // a wider dialog with the same 340px name box is no use.
          var name=document.getElementById('f-name');
          if(name && name.getBoundingClientRect().width < wide - 120)
            throw new Error('the modal widened but the name field stayed at '+Math.round(name.getBoundingClientRect().width)+'px');
        } else {
          if(btn.offsetWidth) throw new Error('the widen button shows on a phone, which has no width to give');
          if(modal.classList.contains('wide')) throw new Error('a phone modal was widened');
        }

        // Remembered per device, and reversible.
        if(roomToGive && !editWideEnabled()) throw new Error('the choice was not remembered');
        applyEditWide();
        if(roomToGive && Math.abs(modal.getBoundingClientRect().width - wide) > 1)
          throw new Error('re-applying the saved preference changed the width');
        toggleEditWide();
        if(Math.abs(modal.getBoundingClientRect().width - narrow) > 1)
          throw new Error('it does not go back to the normal width');
      } finally {
        try{ if(prev===null) localStorage.removeItem(EDIT_WIDE_KEY); else localStorage.setItem(EDIT_WIDE_KEY, prev); }catch(e){}
        applyEditWide();
        if(!prevOpen) document.getElementById('editOverlay').classList.remove('open');
      }

      // It must be applied when the modal OPENS, or the remembered width only
      // takes effect after the first resize.
      var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'})).text();
      var code = src.replace(/^\s*\/\/.*$/gm, '');
      if(!/applyEditWide\(\);[\s\S]{0,200}editOverlay'\)\.classList\.add\('open'\)/.test(code))
        throw new Error('openAddModal does not apply the remembered width before showing the modal');
    } },

  { id:'ui_header_follows_the_thumb', group:'UI', name:'The header follows the scroll, both ways (v36.28)',
    test: async()=>{
      ['applyHeaderGeometry','headerSlidePx','onHeaderScroll'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var header=document.querySelector('.header');
      if(!header) throw new Error('no .header');
      var brandEl=header.querySelector('.header-top');
      if(!brandEl) throw new Error('the brand row has no .header-top, so nothing can move');

      // The travel is width-gated; the ARITHMETIC that moves the header is not.
      // The first version of this test wrapped everything in `if (phone)` and so
      // asserted nothing at all at the headless default width — four separate
      // mutations passed it while tests/phone-chrome.js caught them. So the
      // travel is stubbed and the arithmetic is driven at whatever width the
      // suite happens to be running at.
      var phone = window.innerWidth <= 700;
      var realSlide = headerSlidePx();
      if(phone){
        if(realSlide <= 0) throw new Error('headerSlidePx() reports '+realSlide+' on a phone — nothing would move');
        // v36.30 — the WHOLE header travels, less the status-bar inset. Leave
        // that inset out and a notched iPhone puts the filter bar's chips under
        // the clock, because the page is viewport-fit=cover.
        var want = header.offsetHeight - safeAreaTopPx();
        if(Math.abs(realSlide - want) > 1)
          throw new Error('the travel is '+realSlide+'px but the header is '+header.offsetHeight
            +'px less a '+safeAreaTopPx()+'px inset — a mismatch leaves a brown gap or hides the status bar');
        if(realSlide <= brandEl.offsetHeight)
          throw new Error('only the brand row travels ('+realSlide+'px); the whole header should');
      } else if(realSlide !== 0) {
        throw new Error('a desktop header would move '+realSlide+'px; this is meant to be phone-only');
      }
      if(typeof safeAreaTopPx!=='function') throw new Error('safeAreaTopPx not defined');
      if(safeAreaTopPx() < 0) throw new Error('the safe-area probe reports a negative inset');

      var SLIDE = 80;
      var realSlideFn = window.headerSlidePx, realScrollY = window.scrollY;
      var prevTop = header.style.top, faked = 0;
      window.headerSlidePx = function(){ return SLIDE; };
      Object.defineProperty(window, 'scrollY', { configurable:true, get:function(){ return faked; } });
      try{
        function at(y){ faked = y; onHeaderScroll(); return -(parseFloat(header.style.top) || 0); }
        at(0);
        if(at(0) !== 0) throw new Error('the header is not whole at the top of the page');

        // Down: proportional to the DELTA, then clamped at the brand row.
        if(at(10) !== 10) throw new Error('10px down moved the header '+at(10)+'px');
        if(at(30) !== 30) throw new Error('30px down did not move it 30px');
        var deep = at(5000);
        if(deep !== SLIDE)
          throw new Error('far down the page the header hid '+deep+'px, expected '+SLIDE
            +' — without the clamp the search row scrolls away too');

        // Up, FROM DEEP IN THE PAGE. The position-based v36.27 could not do this
        // at all: it only gave the header back near the top of the document.
        if(at(4980) !== SLIDE - 20)
          throw new Error('20px up deep in the page gave back '+(SLIDE - at(4980))+'px, expected 20');
        if(at(4960) !== SLIDE - 40)
          throw new Error('it does not keep giving it back as you keep scrolling up');
        var upPast = at(5000 - SLIDE - 40);
        if(upPast !== 0) throw new Error('scrolling up past the full travel left '+upPast+'px hidden, mid-page');

        // …and reversing again hides it again, from the same spot. A version
        // that restores the header once and leaves it passes everything above.
        var reY = 5000 - SLIDE - 40;
        if(at(reY + 15) !== 15) throw new Error('reversing down mid-page did not hide it again');
        if(at(reY + 15) === SLIDE) throw new Error('reversing down hid it in one jump');

        // Back at the very top the header must be whole, and that has to hold
        // WITHOUT a negative delta doing the work: an iOS rubber-band, or a
        // resize, can land on y=0 with no movement to report. Setting _hdrLastY
        // to 0 as well is what isolates the guard — leave it stale and the delta
        // alone zeroes the offset, and the guard could be deleted unnoticed.
        faked = 0; _hdrLastY = 0; _hdrHidden = 40;
        if(at(0) !== 0)
          throw new Error('at the top of the page the header is still '+at(0)+'px out of frame, '
            + 'with no scrolling left to bring it back');
      } finally {
        window.headerSlidePx = realSlideFn;
        delete window.scrollY;
        header.style.top = prevTop;
        _hdrHidden = 0; _hdrLastY = window.scrollY || 0;
        applyHeaderGeometry();
      }

      // The filter bar has to land exactly under whatever is showing.
      var barId = phone ? 'mobileFilterBar' : 'filterBar';
      var bar = document.getElementById(barId);
      var got = parseFloat(bar.style.top) || 0;
      if(Math.abs(got - header.offsetHeight) > 1)
        throw new Error('#'+barId+' sticks at '+got+'px but the header ends at '+header.offsetHeight+'px');

      var src = await (await fetch(new URL('index.html?t='+Date.now(), location.href), {cache:'no-store'})).text();
      var code = src.replace(/^\s*\/\/.*$/gm, '');
      if(!/header\.offsetHeight - safeAreaTopPx\(\)/.test(code))
        throw new Error('the travel is not measured from the header less the safe-area inset');
      if(/HEADER_COLLAPSE_AT|classList\.toggle\('collapsed'/.test(code))
        throw new Error('the v36.23 threshold collapse is still in the file');
      // Direction-based means a scroll listener, and the LISTENER must be the
      // throttled one — checking merely that a throttled function exists is
      // satisfied by one nothing calls.
      var m = code.match(/addEventListener\('scroll',\s*([A-Za-z_$][\w$]*)/);
      if(!m) throw new Error('nothing listens for scroll, so the header cannot follow it');
      if(!new RegExp('function '+m[1]+'\\([\\s\\S]{0,200}requestAnimationFrame').test(code))
        throw new Error('the scroll listener ('+m[1]+') is not rAF-throttled');
    } },

  { id:'perf_filter_counts_memoised', group:'UI', name:'The filter-bar counts are not recomputed on every toggle (v36.23)',
    test: async()=>{
      ['oneAwayCount','filterCountKey','invalidateFilterCounts'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      var snap=recipes.slice(), snapPantry=getPantry(), realSave=window.saveLocal;
      try{
        window.saveLocal=function(){};
        // 400 recipes, each one ingredient short of cookable.
        var made=[];
        for(var i=0;i<400;i++){
          var ings=[]; for(var j=0;j<10;j++) ings.push({a:'1',n:'ing'+j});
          ings.push({a:'1',n:'nowhere near the pantry'});
          made.push(normalizeRecipe({ id:770000+i, name:'Perf '+i, updatedAt:1000+i, ingredients:ings, steps:['x'] }));
        }
        recipes=made;
        var pantry=[]; for(var k=0;k<10;k++) pantry.push('ing'+k);
        setPantry(pantry);

        if(oneAwayCount()!==400) throw new Error('the fixture is wrong: '+oneAwayCount()+' of 400 are one away');

        // The second guard, and the only case that can reach it. The
        // fingerprint cannot see an ingredient RENAMED in place: the recipe
        // count is the same, the ingredient count is the same, and a direct
        // mutation never touches updatedAt. That is exactly what the explicit
        // invalidation from saveData/setPantry is for — and an escape hatch
        // nobody exercises is an escape hatch that has quietly stopped working.
        var wasName = recipes[1].ingredients[10].n;
        recipes[1].ingredients[10].n = 'ing0';          // now fully in the pantry
        if(oneAwayCount()!==400)
          throw new Error('the fingerprint noticed a rename it cannot see — the test fixture is wrong, not the code');
        invalidateFilterCounts();
        if(oneAwayCount()!==399)
          throw new Error('invalidateFilterCounts() did not clear the cache, so a mutation the fingerprint '
            + 'misses would leave a wrong number on the chip for good');
        recipes[1].ingredients[10].n = wasName;
        invalidateFilterCounts();
        if(oneAwayCount()!==400) throw new Error('putting it back did not restore the count');

        // It must be FASTER, measured, not merely cached-looking.
        function ms(fn, n){ var t=performance.now(); for(var i=0;i<n;i++) fn(); return (performance.now()-t)/n; }
        var cold=ms(function(){ invalidateFilterCounts(); oneAwayCount(); }, 5);
        var warm=ms(function(){ oneAwayCount(); }, 200);
        if(!(warm < cold/5))
          throw new Error('a repeat call costs '+warm.toFixed(3)+'ms against a cold '+cold.toFixed(3)+'ms — it is not being reused');

        // And it must never be WRONG, which is the whole risk of caching a
        // number that decides whether a chip exists.
        recipes[0].ingredients=[{a:'1',n:'ing0'}]; recipes[0].updatedAt=Date.now();
        if(oneAwayCount()!==399) throw new Error('an edited recipe did not change the count ('+oneAwayCount()+')');
        recipes.push(normalizeRecipe({ id:779999, name:'Extra', updatedAt:1,
          ingredients:[{a:'1',n:'ing0'},{a:'1',n:'nowhere near the pantry'}], steps:['x'] }));
        if(oneAwayCount()!==400) throw new Error('an added recipe did not change the count ('+oneAwayCount()+')');
        recipes.pop();
        if(oneAwayCount()!==399) throw new Error('a removed recipe did not change the count ('+oneAwayCount()+')');
        // A pantry of one irrelevant item leaves every 11-ingredient recipe far
        // from cookable — except recipes[0], edited above down to a single
        // ingredient, which is now exactly one item away. 1, not 0.
        setPantry(['nothing whatsoever']);
        if(oneAwayCount()!==1) throw new Error('changing the pantry did not change the count ('+oneAwayCount()+', expected 1)');
        setPantry([]);
        if(oneAwayCount()!==0) throw new Error('an empty pantry must answer 0, not a cached number');

        // The key must be cheap relative to what it guards, or the cache is a
        // second way to be wrong for no gain.
        setPantry(pantry);
        invalidateFilterCounts();
        var keyCost=ms(function(){ filterCountKey(); }, 200);
        var fullCost=ms(function(){ invalidateFilterCounts(); oneAwayCount(); }, 5);
        if(!(keyCost < fullCost/3))
          throw new Error('the cache key costs '+keyCost.toFixed(3)+'ms against '+fullCost.toFixed(3)+'ms to just do the work');
      } finally {
        recipes=snap; setPantry(snapPantry); window.saveLocal=realSave; invalidateFilterCounts();
      }
    } },

  { id:'ui_dark_contrast', group:'UI', name:'No panel is light-on-light in dark mode (v36.14)',
    test: async()=>{
      // Tony's report: the Meal menu was #F2EDE6 text on a hard-coded white
      // panel — 1.16:1, effectively invisible. It is MOBILE ONLY, which is why
      // it survived every previous dark-mode pass: the panel does not exist
      // above 700px, so a desktop check never opens it. Assert the RENDERED
      // colours, because the stylesheet looks perfectly reasonable either way.
      function parse(c){ var m=/rgba?\(([^)]+)\)/.exec(c||''); if(!m) return null;
        var p=m[1].split(',').map(parseFloat);
        return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
      function over(f,b){ var a=f.a; return {r:f.r*a+b.r*(1-a),g:f.g*a+b.g*(1-a),b:f.b*a+b.b*(1-a),a:1}; }
      function lum(c){ var f=[c.r,c.g,c.b].map(function(v){ v/=255;
        return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
        return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2]; }
      function ratio(a,b){ var l1=lum(a),l2=lum(b);
        return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); }
      function bgOf(el){
        var stack=[], n=el;
        while(n && n.nodeType===1){
          var c=parse(getComputedStyle(n).backgroundColor);
          if(c && c.a>0){ stack.push(c); if(c.a>=0.999) break; }
          n=n.parentElement;
        }
        if(!stack.length) return {r:255,g:255,b:255,a:1};
        var base=stack[stack.length-1];
        if(base.a<0.999) base=over(base,{r:255,g:255,b:255,a:1});
        for(var i=stack.length-2;i>=0;i--) base=over(stack[i],base);
        return base;
      }
      var prev = getTheme();
      // FRESH fixtures, not whatever the previous 200 tests left lying in the
      // DOM. Measuring leftovers makes the result depend on test ORDER — this
      // check read a stale #viewModal button and reported a failure that could
      // not be reproduced anywhere in the real app.
      var host = document.createElement('div');
      host.id = '_contrastFixtures';
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;';
      try{
        setTheme('dark');
        [['meal panel',
          '<div class="mobile-dropdown-panel open"><div class="panel-title">Meal type</div>'
          + '<label class="mobile-check-item">Breakfast</label></div>'],
         ['share url',    '<div class="share-app-url">https://example.com</div>'],
         ['calc result',  '<div class="calc-result-box"><span class="calc-result-unit">grams</span></div>'],
         ['tint box',     '<div class="tint-box">How to refresh:</div>'],
         ['inline code',  '<code class="inline-code">copy(x)</code>'],
         ['paid badge',   '<span class="payment-badge paid">Pro Plan</span>'],
         ['free badge',   '<span class="payment-badge free">Free</span>'],
         ['info badge',   '<span class="payment-badge info">API Credits</span>'],
         ['diet tag',     '<span class="recipe-diet-tag">Keto</span>'],
         ['access badge', '<div class="access-badge access-badge-full">Full access</div>'],
         ['bring cancel', '<button class="bring-cancel-btn">Cancel</button>'],
         ['bring action', '<button class="action-btn action-btn-bring">Send to Bring!</button>']
        ].forEach(function(pair){
          var d=document.createElement('div'); d.setAttribute('data-label', pair[0]);
          d.innerHTML = pair[1]; host.appendChild(d);
        });
        document.body.appendChild(host);

        var worst=null, checked=0;
        host.querySelectorAll('.mobile-check-item,.panel-title,.share-app-url,.calc-result-box,'
          + '.calc-result-unit,.tint-box,.inline-code,.payment-badge,.recipe-diet-tag,'
          + '.access-badge-full,.bring-cancel-btn,.action-btn-bring').forEach(function(el){
          var box=el.closest('[data-label]');
          var label=(box ? box.getAttribute('data-label') : '') + ' (' + el.className + ')';
          var cs=getComputedStyle(el);
          var bg=bgOf(el);
          // A LIGHT surface while the page is dark IS the bug: the text on it
          // is themed and will have gone light too.
          if(lum(bg)>0.5)
            throw new Error(label+' still has a light background in dark mode (rgb '
              + [bg.r,bg.g,bg.b].map(Math.round).join(',') + ') — themed text on it is invisible');
          var fg=parse(cs.color); if(!fg) return;
          if(fg.a<0.999) fg=over(fg,bg);
          checked++;
          var got=ratio(fg,bg);
          if(worst===null || got<worst.got) worst={sel:label,got:got};
        });
        if(checked<10) throw new Error('only '+checked+' surfaces rendered — the check proved almost nothing');
        if(worst.got<4.5)
          throw new Error(worst.sel+' is only '+worst.got.toFixed(2)+':1 in dark mode, under the 4.5 minimum');
        // ...and the brand fill must NOT be the lifted accent, or white on it
        // drops to 2.6:1.
        var cs=getComputedStyle(document.documentElement);
        var fill=cs.getPropertyValue('--terracotta-fill').trim();
        var accent=cs.getPropertyValue('--terracotta').trim();
        if(!fill) throw new Error('--terracotta-fill is not defined');
        if(fill===accent)
          throw new Error('--terracotta-fill equals --terracotta in dark mode; white text on it is only 2.6:1');
      } finally {
        if(host.parentNode) host.parentNode.removeChild(host);
        setTheme(prev);
      }
    } },

  { id:'ui_select_lives_in_filter_bar', group:'UI', name:'☑ Select rides the pinned filter bar (v36.10)',
    test: async()=>{
      // It used to sit in the grid heading, which scrolls away — so on a long
      // list the button was unreachable exactly when it was wanted.
      if(document.querySelector('.grid-section #selectModeBtn'))
        throw new Error('Select is back in the grid heading, which scrolls out of view');
      renderFilters();
      var wide=document.querySelector('#filterBar .filter-frame-select #selectModeBtn');
      if(!wide) throw new Error('no Select frame in the wide-screen filter bar');
      var narrow=document.querySelector('#mobileFilterBar .filter-frame-select #selectModeBtnMobile');
      if(!narrow) throw new Error('no Select frame in the phone filter bar');

      // Whichever bar the viewport is showing must actually be pinned, and the
      // frame must actually sit at the far end of it. Assert what RENDERED:
      // `position:sticky` with no `top` is just `relative`, and that is the bug
      // this replaced.
      var header=document.querySelector('.header');
      updateFilterBarTop();
      // The hidden bar cannot be measured, but it is the visible one at the
      // other width — so at least assert it was given an offset at all.
      ['filterBar','mobileFilterBar'].forEach(function(id){
        if(!document.getElementById(id).style.top)
          throw new Error('#'+id+' has no sticky offset, so it scrolls away at the width where it is the one on screen');
      });
      var btn=[wide,narrow].filter(function(b){ return b.offsetParent!==null; })[0];
      if(!btn) throw new Error('neither Select button is on screen at this width');
      var bar=btn.closest('.filter-bar');
      var cs=getComputedStyle(bar);
      if(cs.position!=='sticky') throw new Error('the bar Select sits in is '+cs.position+', not sticky');
      if(cs.top==='auto')
        throw new Error('the bar has no top offset, so it scrolls away with the page');
      if(Math.abs(parseFloat(cs.top)-header.offsetHeight)>2)
        throw new Error('the bar pins at '+cs.top+' but the header is '+header.offsetHeight+'px tall — it would overlap or float');
      var frame=btn.closest('.filter-frame-select');
      var gap=bar.getBoundingClientRect().right - frame.getBoundingClientRect().right;
      if(gap>parseFloat(cs.paddingRight)+3)
        throw new Error('the Select frame is '+Math.round(gap)+'px from the end of the bar, not at its right-most point');

      // ...and the pressed state survives a re-render of the bar it lives in.
      var wasOn=selectMode;
      try{
        if(selectMode) cancelSelectMode();
        toggleSelectMode();
        if(!document.getElementById('selectModeBtn').classList.contains('active-select'))
          throw new Error('entering select mode did not light the button up');
        if(!document.getElementById('selectModeBtnMobile').classList.contains('active-select'))
          throw new Error('the other bar’s Select button was left un-lit, and shows stale on a resize');
        var sb=document.getElementById('selectBar');
        if(sb && sb.style.display!=='flex') throw new Error('the action bar did not appear');
        renderFilters();
        if(!document.getElementById('selectModeBtn').classList.contains('active-select'))
          throw new Error('re-rendering the filter bar dropped the pressed state');
        cancelSelectMode();
        if(document.getElementById('selectModeBtn').classList.contains('active-select'))
          throw new Error('cancelling left the button looking active');
      } finally { if(!wasOn && selectMode) cancelSelectMode(); }
    } },

  { id:'part_actions_reach_one_recipe', group:'Features', name:'Each recipe in a collection has its own actions (v36.8)',
    test: async()=>{
      // Tony's case: send ONE recipe out of a collection without sending the
      // other nine. Every per-recipe action takes an id and looks it up in
      // `recipes`, and a part is not in `recipes` — so the whole feature rests
      // on findRecipeRef resolving a part reference to that part alone.
      var realToast=window.toast, realSave=window.saveData, realRender=window.renderGrid;
      var before=recipes.slice(), beforeId=nextId, prevView=viewId;
      try{
        window.toast=function(){}; window.saveData=function(){}; window.renderGrid=function(){};
        var built = buildImportFromParsed({ collectionName:'Three soups', category:'Soup', recipes:[
          { name:'Onion soup', ingredients:[{a:'3',n:'onions'}], steps:['Fry'] },
          { name:'Tomato soup', ingredients:[{a:'5',n:'tomatoes'}], steps:['Roast','Blend'] }
        ]}, 'https://example.com/s');
        // The collection HAS a photo, so "a part has no photo" is a real
        // assertion rather than one the fixture makes true by accident.
        var coll = normalizeRecipe(Object.assign({id:977001, uid:'pa', bg:'#fff',
          photo:'data:image/jpeg;base64,'+'A'.repeat(64)}, built.recipe));
        recipes.unshift(coll);
        if(!coll.photo) throw new Error('setup: the collection needs a photo for this to mean anything');
        var uid = recipeParts(coll)[1].uid;
        var ref = partRef(977001, uid);

        // The reference resolves to ONE recipe, not the collection.
        var one = findRecipeRef(ref);
        if(!one) throw new Error('a part reference resolved to nothing');
        if(one.name!=='Tomato soup') throw new Error('it resolved to "'+one.name+'"');
        if(isCollection(one)) throw new Error('a part resolved to a collection');
        if(allIngredients(one).length!==1)
          throw new Error('it carries '+allIngredients(one).length+' ingredients — the whole collection leaked in');
        if(one.photo!=='') throw new Error('a part was given a photo — parts deliberately have none');
        // An ordinary id must still work, or every action breaks for normal recipes.
        if(findRecipeRef(977001)!==coll) throw new Error('an ordinary id no longer resolves');
        if(findRecipeRef('c999999:nope')) throw new Error('a reference to a missing collection resolved to something');
        if(findRecipeRef(partRef(977001,'no-such-uid'))) throw new Error('a missing part resolved to something');

        // Share/Word/Print all go through rText or the same lookup: the text
        // must be THIS recipe, not its neighbours.
        var txt = rText(findRecipeRef(ref));
        if(txt.indexOf('Tomato soup')===-1) throw new Error('sharing one recipe did not include it');
        if(txt.indexOf('Onion soup')!==-1) throw new Error('sharing one recipe sent the whole collection');

        // Cooked and Favourite must write to the PART, not to a copy.
        markPartCooked(ref); markPartCooked(ref); togglePartFav(ref);
        var live = recipeParts(recipes.find(function(x){return x.id===977001;}))[1];
        if(live.cookCount!==2) throw new Error('cooking a part recorded '+live.cookCount+' — it wrote to a copy');
        if(!live.fav) throw new Error('favouriting a part did not stick');
        if(!live.lastCooked) throw new Error('no cooked date was recorded');
        togglePartFav(ref);
        if(recipeParts(recipes.find(function(x){return x.id===977001;}))[1].fav)
          throw new Error('favourite does not toggle back off');
        // The neighbour must be untouched.
        if(recipeParts(recipes.find(function(x){return x.id===977001;}))[0].cookCount)
          throw new Error('cooking one recipe counted a cook on another');

        // ...and all of it has to SURVIVE normalising, which runs on every load
        // and every save. Setting the fields is worthless if the next load
        // strips them.
        togglePartFav(ref);
        var round = normalizeRecipe(JSON.parse(JSON.stringify(
          recipes.find(function(x){ return x.id===977001; }))));
        var rp = recipeParts(round)[1];
        if(rp.cookCount!==2) throw new Error('the cook count did not survive a normalise: '+rp.cookCount);
        if(!rp.fav) throw new Error('the favourite did not survive a normalise');
        if(!rp.lastCooked) throw new Error('the cooked date did not survive a normalise');
        togglePartFav(ref);

        // The buttons have to be rendered, per part, or none of this is reachable.
        viewId=977001; drawView();
        var modal=document.getElementById('viewModal');
        if(modal.querySelectorAll('.part-actions').length!==2)
          throw new Error('drew '+modal.querySelectorAll('.part-actions').length+' per-recipe action bars, expected 2');
        var html=modal.innerHTML;
        ['togglePartFav','editPart','markPartCooked','openTranslate','expOneWord','printRecipe','toggleShare','openBringModal']
          .forEach(function(fn){
            if(html.indexOf(fn+'(&quot;c977001:')===-1 && html.indexOf(fn+'("c977001:')===-1)
              throw new Error(fn+' is not wired to a part reference, so it would act on the wrong thing');
          });
        // ...and the collection-level block must be distinguishable from them.
        if(!modal.querySelector('.collection-actions-label'))
          throw new Error('no heading separates the collection-level actions from the per-recipe ones');
        if(modal.querySelector('.collection-actions-label').textContent.indexOf('2 recipes')===-1)
          throw new Error('the collection-level heading does not say what it applies to');
      } finally {
        window.toast=realToast; window.saveData=realSave; window.renderGrid=realRender;
        recipes.length=0; before.forEach(function(x){ recipes.push(x); });
        nextId=beforeId; viewId=prevView; closeM('viewOverlay');
      }
    } },

  { id:'part_edit_writes_back', group:'Features', name:'Editing one recipe in a collection does not clone it (v36.8)',
    test: async()=>{
      // The failure this guards against: the edit form saving a part as a NEW
      // standalone recipe, leaving the collection unchanged and the library one
      // recipe longer. Every collection feature so far has had to be stopped
      // from doing exactly that.
      var realToast=window.toast, realSave=window.saveData, realRender=window.renderGrid;
      var before=recipes.slice(), beforeId=nextId, prevView=viewId;
      try{
        window.toast=function(){}; window.saveData=function(){}; window.renderGrid=function(){};
        var built = buildImportFromParsed({ collectionName:'Two soups', category:'Soup', recipes:[
          { name:'Onion soup', ingredients:[{a:'3',n:'onions'}], steps:['Fry'] },
          { name:'Lentil soup', ingredients:[{a:'1c',n:'lentils'}], steps:['Boil'] }
        ]}, '');
        var coll = normalizeRecipe(Object.assign({id:977101, uid:'pe', bg:'#fff'}, built.recipe));
        recipes.unshift(coll);
        var countBefore = recipes.length;
        var ref = partRef(977101, recipeParts(coll)[1].uid);

        editPart(ref);
        if(document.getElementById('f-name').value!=='Lentil soup')
          throw new Error('the form did not load the part: "'+document.getElementById('f-name').value+'"');
        if(editFormIsDirty())
          throw new Error('a freshly loaded part reads as unsaved changes, so closing would ask to discard it');
        document.getElementById('f-name').value='Lentil soup (better)';
        document.getElementById('f-steps').value='Boil\n# Then\n    Season';
        await saveRecipe();

        var live = recipes.find(function(x){ return x.id===977101; });
        if(recipes.length!==countBefore)
          throw new Error('editing a part changed the library size by '+(recipes.length-countBefore)+' — it cloned the recipe');
        if(recipeParts(live).length!==2) throw new Error('the collection now has '+recipeParts(live).length+' parts');
        if(recipeParts(live)[1].name!=='Lentil soup (better)')
          throw new Error('the part was not updated: "'+recipeParts(live)[1].name+'"');
        if(recipeParts(live)[0].name!=='Onion soup') throw new Error('the wrong part was edited');
        // Structure typed into the method survives into the part.
        if(!recipeParts(live)[1].steps.some(isSubLine))
          throw new Error('a sub-title typed while editing a part was lost');
        if(editFormIsDirty())
          throw new Error('after saving, the form still claims unsaved changes');
        if(_editingPartRef) throw new Error('the part target was left set — the next Add would overwrite it');
        if(!live.history.length) throw new Error('editing a part left no way back in version history');

        // And a plain Add after that must create a recipe, not touch the part.
        openAddModal(null);
        if(_editingPartRef) throw new Error('opening the ordinary form kept the part target');
      } finally {
        window.toast=realToast; window.saveData=realSave; window.renderGrid=realRender;
        _editingPartRef=null; _editFormSnapshot=null;
        closeM('editOverlay');
        recipes.length=0; before.forEach(function(x){ recipes.push(x); });
        nextId=beforeId; viewId=prevView;
      }
    } },

  { id:'coll_remove_part', group:'Import/Export', name:'A recipe can be dropped from a collection without keeping it (v36.2)',
    test: async()=>{
      var realAsk=window.askConfirm, realToast=window.toast;
      var before=recipes.slice(), beforeId=nextId;
      try{
        window.toast=function(){}; window.askConfirm=function(){ return Promise.resolve(true); };
        var built = buildImportFromParsed({ collectionName:'Soups', category:'Soup', recipes:[
          { name:'Onion',  ingredients:[{a:'3',n:'onions'}], steps:['fry'] },
          { name:'Tomato', ingredients:[{a:'5',n:'tomatoes'}], steps:['simmer'] },
          { name:'Lentil', ingredients:[{a:'1c',n:'lentils'}], steps:['boil'], servings:'4' }
        ]}, 'https://example.com/soups');
        var coll = normalizeRecipe(Object.assign({id:976001, uid:'rm-coll', bg:'#fff'}, built.recipe));
        recipes.unshift(coll);
        var uids = recipeParts(coll).map(function(p){ return p.uid; });
        var countBefore = recipes.length;

        // The button has to exist where the recipe is shown, or the function is
        // unreachable — the thing v36.1 taught twice over.
        var html = collectionSectionsHtml(coll);
        if(html.indexOf('removePartFromCollection('+coll.id)===-1)
          throw new Error('no way to remove a recipe from the collection in the view');

        await removePartFromCollection(976001, uids[1]);
        if(recipeParts(coll).length!==2) throw new Error('removing left '+recipeParts(coll).length+' parts, not 2');
        if(recipeParts(coll).some(function(p){ return p.name==='Tomato'; }))
          throw new Error('the removed recipe is still in the collection');
        // The point of Remove rather than "Make its own": nothing new appears.
        if(recipes.length!==countBefore)
          throw new Error('removing created '+(recipes.length-countBefore)+' new recipe(s)');
        if(!coll.history.length) throw new Error('the collection was changed with no way back');
        if(!(coll.history[0].parts||[]).some(function(p){ return p.name==='Tomato'; }))
          throw new Error('version history does not hold the removed recipe');

        // Down to one: a container with one thing in it is not a container, and
        // it must take that recipe's NAME — not keep the article's title.
        await removePartFromCollection(976001, uids[0]);
        if(isCollection(coll)) throw new Error('one part left and it is still a collection');
        if(coll.name!=='Lentil') throw new Error('the collapsed recipe is still called "'+coll.name+'"');
        if(coll.steps[0]!=='boil') throw new Error('the collapsed recipe did not take the last part\'s content');
        if(coll.servings!=='4') throw new Error('the collapsed recipe lost the part\'s servings');
        if(recipes.length!==countBefore) throw new Error('collapsing created a new recipe');

        // Saying no changes nothing at all.
        window.askConfirm=function(){ return Promise.resolve(false); };
        var coll2 = normalizeRecipe(Object.assign({id:976002, uid:'rm-coll2', bg:'#fff'},
          buildImportFromParsed({ collectionName:'More', category:'Soup', recipes:[
            { name:'A', ingredients:[{a:'1',n:'x'}], steps:['s'] },
            { name:'B', ingredients:[{a:'2',n:'y'}], steps:['t'] }
          ]}, '').recipe));
        recipes.unshift(coll2);
        await removePartFromCollection(976002, recipeParts(coll2)[0].uid);
        if(recipeParts(coll2).length!==2) throw new Error('cancelling removed it anyway');

        // Version history has to survive the round trip, in both directions —
        // it recorded an EMPTY recipe for every collection before v36.2, so
        // Restore would have wiped the real one with nothing.
        var snap = historySnapshot(coll2);
        if(!(snap.parts||[]).length) throw new Error('a snapshot of a collection holds no parts');
        window.askConfirm=function(){ return Promise.resolve(true); };
        coll2.parts = [recipeParts(coll2)[0]];
        collapseCollectionIfThin(coll2);
        if(isCollection(coll2)) throw new Error('setup: it should be an ordinary recipe now');
        coll2.history = [snap];
        await restoreVersion(976002, 0);
        if(!isCollection(coll2)) throw new Error('restoring a collection did not bring the parts back');
        if(recipeParts(coll2).length!==2) throw new Error('restore brought back '+recipeParts(coll2).length+' of 2 parts');
        if(coll2.ingredients.length||coll2.steps.length)
          throw new Error('restore left a stale flat copy beside the parts');
        // ...and back the other way: restoring a plain version must clear parts.
        coll2.history = [{ at:Date.now(), name:'Plain', category:'Soup', difficulty:'Easy',
          prep:'—', servings:'—', notes:'', ingredients:[{a:'1',n:'z'}], steps:['only step'] }];
        await restoreVersion(976002, 0);
        if(isCollection(coll2)) throw new Error('restoring a plain version left the old parts behind');
        if(allIngredients(coll2).length!==1) throw new Error('readers still see the old parts');
      } finally {
        window.askConfirm=realAsk; window.toast=realToast;
        recipes.length=0; before.forEach(function(r){ recipes.push(r); }); nextId=beforeId;
      }
    } },

  { id:'dup_collection_loses_nothing', group:'Import/Export', name:'A collection meeting a duplicate loses nothing (v36.2)',
    test: async()=>{
      // The v36.1 bug, exactly: import a collection whose first recipe you
      // already own, choose "update the existing one", and BOTH halves were
      // lost — the existing recipe kept its old content, and all ten freshly
      // parsed recipes vanished with the overlay. confirmImportChecked read
      // parsed.ingredients on a collection, where they live in parts.
      var realAsk = window.askConfirm, realToast = window.toast, realClose = window.closeM;
      var before = recipes.slice(), beforeId = nextId;
      try{
        window.toast = function(){}; window.closeM = function(){};
        var existing = normalizeRecipe({ id:975001, uid:'dup-existing', name:'Chestnut soup',
          photo:'PHOTO', fav:true, cookCount:7, bg:'#fff',
          ingredients:[{a:'1',n:'old onion'}], steps:['the old method'] });
        recipes.unshift(existing);

        var coll = { name:'Chestnuts: 3 recipes', category:'Dinner', source:'https://example.com/nuts',
          parts:[
            { name:'Chestnut soup', ingredients:[{a:'200g',n:'chestnuts'}], steps:['the new method'], servings:'10' },
            { name:'Chestnut pasta', ingredients:[{a:'500g',n:'pasta'}], steps:['boil'] },
            { name:'Chestnut cake',  ingredients:[{a:'3',n:'eggs'}],      steps:['bake'] }
          ]};

        // Through confirmImportParsed, NOT confirmImportCollection — the bug was
        // in the routing, and a test that calls the inner function directly
        // passes happily while the real button does the wrong thing.
        window.askConfirm = function(){ return Promise.resolve(true); };   // "Update"
        await confirmImportParsed(JSON.parse(JSON.stringify(coll)), 'freehandOverlay');

        // 1. The existing recipe was actually updated...
        if(existing.steps[0]!=='the new method')
          throw new Error('the existing recipe was not updated — it still says "'+existing.steps[0]+'"');
        if(!existing.ingredients.some(function(i){ return /chestnuts/.test(i.n); }))
          throw new Error('the existing recipe kept its old ingredients');
        // ...while keeping everything that is its own.
        if(existing.photo!=='PHOTO') throw new Error('updating threw away the photo');
        if(!existing.fav) throw new Error('updating threw away the favourite');
        if(existing.cookCount!==7) throw new Error('updating threw away the cooking history');
        if(!existing.history.length) throw new Error('the replaced version was not kept in history');
        if(existing.id!==975001) throw new Error('updating changed the recipe identity');

        // 2. ...and the OTHER two recipes were still imported. This is the half
        //    that silently disappeared.
        var added = recipes.filter(function(r){ return before.indexOf(r)===-1 && r!==existing; });
        if(!added.length) throw new Error('the rest of the collection was thrown away');
        var names = [];
        added.forEach(function(r){
          recipeParts(r).forEach(function(p){ names.push(p.name); });
          if(!recipeParts(r).length) names.push(r.name);
        });
        if(names.indexOf('Chestnut pasta')===-1 || names.indexOf('Chestnut cake')===-1)
          throw new Error('imported: '+names.join(', ')+' — the untouched recipes are missing');
        if(names.indexOf('Chestnut soup')!==-1)
          throw new Error('the updated recipe was ALSO imported as a new one');

        // 3. "Keep both" imports the whole collection and touches nothing.
        var mark = existing.steps[0];
        window.askConfirm = function(){ return Promise.resolve(false); };  // "Keep both"
        await confirmImportParsed(JSON.parse(JSON.stringify(coll)), 'freehandOverlay');
        if(existing.steps[0]!==mark) throw new Error('"Keep both" changed the existing recipe anyway');
        var kept = recipes[0];
        if(recipeParts(kept).length!==3)
          throw new Error('"Keep both" imported '+recipeParts(kept).length+' of 3 recipes');

        // 4. Two parts naming the SAME existing recipe must not both replace it.
        var twice = { name:'Two the same', category:'Dinner', parts:[
          { name:'Chestnut soup', ingredients:[{a:'1',n:'first'}],  steps:['first'] },
          { name:'Chestnut soup', ingredients:[{a:'2',n:'second'}], steps:['second'] }
        ]};
        var d = collectionDuplicates(twice, recipes);
        if(d.parts.length!==1) throw new Error(d.parts.length+' parts were matched to one recipe');
      } finally {
        window.askConfirm = realAsk; window.toast = realToast; window.closeM = realClose;
        recipes.length = 0; before.forEach(function(r){ recipes.push(r); }); nextId = beforeId;
      }
    } },

  { id:'dup_replace_never_silently_drops', group:'Import/Export', name:'A replace with nothing to replace with still keeps the recipe (v36.2)',
    test: async()=>{
      // applyParsedOntoRecipe returning false is the caller's cue that it could
      // NOT do what was asked. Treating that as success is what closed the
      // overlay on ten parsed recipes.
      var r = normalizeRecipe({ id:975101, uid:'dup-empty', name:'Untouched',
        ingredients:[{a:'1',n:'original'}], steps:['original step'] });
      if(applyParsedOntoRecipe(r, { ingredients:[], steps:[] }))
        throw new Error('an empty parse reported that it replaced something');
      if(r.steps[0]!=='original step') throw new Error('an empty parse damaged the recipe anyway');
      if(applyParsedOntoRecipe(r, {}))
        throw new Error('a parse with no content at all reported success');

      // A collection replacing an ordinary recipe, and the reverse. Both have to
      // leave the parts/flat invariant intact, or every reader sees the wrong one.
      if(!applyParsedOntoRecipe(r, { parts:[
          { name:'A', ingredients:[{a:'1',n:'x'}], steps:['s'] },
          { name:'B', ingredients:[{a:'2',n:'y'}], steps:['t'] } ] }))
        throw new Error('a collection could not replace an ordinary recipe');
      if(!isCollection(r)) throw new Error('it did not become a collection');
      if(r.ingredients.length||r.steps.length)
        throw new Error('the flat fields kept a stale copy beside the parts');
      if(allIngredients(r).length!==2) throw new Error('the new parts are not readable');

      if(!applyParsedOntoRecipe(r, { ingredients:[{a:'9',n:'plain'}], steps:['plain step'] }))
        throw new Error('an ordinary recipe could not replace a collection');
      if(isCollection(r)) throw new Error('the old parts survived — it is still a collection');
      if(allIngredients(r).length!==1) throw new Error('readers still see the old parts');
      if(recipeParts(r).length) throw new Error('parts were left behind on the record');

      // And the same thing through the real entry point: choosing "update" when
      // there is nothing to update with must not swallow the import. v36.1 closed
      // the overlay here and the parse was gone.
      var realAsk=window.askConfirm, realToast=window.toast, realClose=window.closeM;
      var before=recipes.slice(), beforeId=nextId;
      try{
        window.toast=function(){}; window.closeM=function(){};
        window.askConfirm=function(){ return Promise.resolve(true); };     // "Update"
        var target = normalizeRecipe({ id:975102, uid:'dup-target', name:'Tomato soup', bg:'#fff',
          ingredients:[{a:'1',n:'tomato'}], steps:['simmer'] });
        recipes.unshift(target);
        await confirmImportParsed({ name:'Tomato soup', category:'Soup',
          ingredients:[], steps:[], source:'https://example.com/t' }, 'freehandOverlay');
        var added = recipes.filter(function(x){ return before.indexOf(x)===-1 && x!==target; });
        if(!added.length)
          throw new Error('a replace with nothing to replace with threw the parse away');
        if(target.steps[0]!=='simmer') throw new Error('the existing recipe was damaged anyway');
      } finally {
        window.askConfirm=realAsk; window.toast=realToast; window.closeM=realClose;
        recipes.length=0; before.forEach(function(x){ recipes.push(x); }); nextId=beforeId;
      }
    } },

  { id:'ai_call_is_bounded', group:'Import/Export', name:'An AI call cannot wait forever, and a 400 is not retried (v36.1)',
    test: async()=>{
      // v36.0's fetch had no AbortSignal, so a stalled connection hung the app
      // with an unchanging spinner; the retry loop then repeated it four times.
      var small = aiTimeoutMs(2000), big = aiTimeoutMs(16000);
      if(!(small>0 && isFinite(small))) throw new Error('a small call has no time limit');
      if(!(big>small)) throw new Error('a bigger answer is not given more time ('+big+' vs '+small+')');
      if(big>180000) throw new Error('the budget is not capped — '+big+'ms');
      if(aiTimeoutMs(2000000)>180000) throw new Error('an absurd token count escapes the cap');

      // Retrying something that cannot succeed is what made a permanent failure
      // look like a hang: 5 attempts with 2/4/8/16s of backoff between them.
      var perm = [ new Error('API error 400: bad request'),
                   new Error('API error 404: not found'),
                   new Error('API error 413: too large'),
                   new Error('BILLING: out of credits'),
                   new Error('API_KEY: expired'),
                   // Same prompt, same max_tokens — it will truncate again. v36.2
                   // added this error and left it falling through to "retryable",
                   // so ONE truncated answer became five PAID calls over 30
                   // seconds. Tony's log caught it: five "stop: max_tokens" in a
                   // row with 2/4/8/16s between them.
                   new Error('TRUNCATED: the answer hit the 2000-token ceiling before it finished.'),
                   new Error('Rate limit reached. Please wait a moment and try again.') ];
      perm.forEach(function(e){
        if(aiRetryable(e)) throw new Error('retried a permanent failure: '+e.message);
      });
      // Two separate guards, and each must hold on its own. A raw abort from the
      // browser arrives as a TimeoutError whose message says only "signal timed
      // out" — nothing this code wrote — so the NAME is all there is to go on.
      var raw = new Error('signal timed out');
      raw.name = 'TimeoutError';
      if(aiRetryable(raw)) throw new Error('a raw aborted fetch is retried, which multiplies the wait');
      var ab = new Error('The user aborted a request.');
      ab.name = 'AbortError';
      if(aiRetryable(ab)) throw new Error('an aborted request is retried');
      // And once _aiCallUncached has re-worded it for the user, the name is gone
      // and the message is all there is. Both paths reach the same answer.
      if(aiRetryable(new Error('The AI request took too long (over 158s) and was stopped.')))
        throw new Error('a re-worded timeout is retried, which multiplies the wait');
      // ...but a genuine blip still gets another go, or one dropped packet
      // would lose an import that would have worked.
      [ new Error('API error 500: internal'),
        new Error('API error 529: overloaded'),
        new Error('API error 408: request timeout'),
        new Error('Failed to fetch') ].forEach(function(e){
        if(!aiRetryable(e)) throw new Error('gave up on a transient failure: '+e.message);
      });
    } },

  { id:'ai_hang_ends_by_itself', group:'Import/Export', name:'A stalled AI call ends on its own, once (v36.1)',
    test: async()=>{
      // The exact shape of the bug: the Worker accepts the request and then the
      // response never arrives. In v36.0 there was no signal on that fetch, so
      // this waited forever behind an unchanging spinner.
      var realFetch = window.fetch, realBudget = window.aiTimeoutMs, calls = 0;
      try{
        window.aiTimeoutMs = function(){ return 700; };   // keep the suite quick
        var sawSignal = true;
        window.fetch = function(url, opts){
          var body = {}; try { body = JSON.parse((opts&&opts.body)||'{}'); } catch(e){}
          if(!body.messages) return realFetch.apply(window, arguments);
          calls++;
          var sig = opts && opts.signal;
          if(!sig) { sawSignal = false; return Promise.reject(new Error('no AbortSignal was passed')); }
          // A real fetch answers an abort by rejecting. A promise that merely
          // never settles would ignore the signal — and then this test would
          // hang exactly the way the bug did, proving nothing.
          return new Promise(function(_, reject){
            sig.addEventListener('abort', function(){
              var e = new Error('signal timed out'); e.name = 'TimeoutError'; reject(e);
            });
          });
        };
        var t0 = Date.now(), msg = '';
        try {
          await aiCall('a prompt no cache has ever seen ' + Date.now() + Math.random(), 2000);
          throw new Error('a request that never answered was reported as a success');
        } catch(e){ msg = e.message; }
        var took = Date.now() - t0;
        if(msg.indexOf('a request that never answered')!==-1) throw new Error(msg);
        if(!sawSignal) throw new Error('the AI fetch carries no AbortSignal — nothing can end a stall');
        if(took > 4000) throw new Error('took '+took+'ms to give up on a 700ms budget — it was retried');
        if(calls !== 1) throw new Error('a stalled request was sent '+calls+' times, multiplying the wait');
        if(!/took too long/.test(msg))
          throw new Error('the failure does not say it ran out of time: '+msg);
        if(/TimeoutError|signal timed out/.test(msg))
          throw new Error('the raw abort text was shown to the user: '+msg);

        // The other way a big answer fails: it arrives, but the model ran out of
        // tokens partway through. That is half a JSON document, and the import
        // then failed with "could not parse" — true, and useless.
        window.fetch = function(url, opts){
          var body = {}; try { body = JSON.parse((opts&&opts.body)||'{}'); } catch(e){}
          if(!body.messages) return realFetch.apply(window, arguments);
          return Promise.resolve(new Response(JSON.stringify({
            content:[{ text:'{"recipes":[{"name":"half a rec' }], stop_reason:'max_tokens'
          }), { status:200, headers:{'Content-Type':'application/json'} }));
        };
        var cutMsg = '';
        try {
          await aiCall('another prompt no cache has seen ' + Date.now() + Math.random(), 2000);
          throw new Error('a reply cut off at the token ceiling was passed on as if it were whole');
        } catch(e){ cutMsg = e.message; }
        if(cutMsg.indexOf('was passed on as if')!==-1) throw new Error(cutMsg);
        if(!/TRUNCATED|ceiling/.test(cutMsg))
          throw new Error('a truncated answer does not say so: '+cutMsg);
      } finally { window.fetch = realFetch; window.aiTimeoutMs = realBudget; }
    } },

  { id:'ai_slice_by_titles', group:'Import/Export', name:'A long article is cut at its recipe headings (v36.1)',
    test: async()=>{
      var text = 'Chestnuts: 3 recipes\nAn intro paragraph.\n'
               + 'Mushroom gnocchi\ningredients A\nsteps A\n'
               + 'Chestnut soup\ningredients B\nsteps B\n'
               + 'Sweet potato pasta\ningredients C\nsteps C\n';
      var sl = sliceByTitles(text, ['Mushroom gnocchi','Chestnut soup','Sweet potato pasta']);
      if(sl.length!==3) throw new Error('cut into '+sl.length+' pieces, not 3');
      if(sl[0].text.indexOf('ingredients A')===-1) throw new Error('a slice lost its own body');
      if(sl[0].text.indexOf('ingredients B')!==-1) throw new Error('a slice ran into the next recipe');
      if(sl[2].text.indexOf('ingredients C')===-1) throw new Error('the last slice stops short of the end');

      // A title the AI paraphrased is not in the text. Guessing where it would
      // have been would cut a recipe in half, so it is skipped instead — and
      // its recipe stays inside its neighbour's slice, where it is still read.
      var sl2 = sliceByTitles(text, ['Mushroom gnocchi','Soup of chestnuts','Sweet potato pasta']);
      if(sl2.length!==2) throw new Error('an unfindable title was invented a position');
      if(sl2[0].text.indexOf('ingredients B')===-1)
        throw new Error('the skipped recipe was dropped instead of left in its neighbour');

      // Nothing to gain from splitting — the caller must fall back to one call.
      if(sliceByTitles(text, ['Mushroom gnocchi']).length!==0)
        throw new Error('a single title was treated as a split worth making');
      if(sliceByTitles(text, []).length!==0) throw new Error('no titles produced slices');
      if(sliceByTitles(text, ['','  ','x']).length!==0) throw new Error('junk titles produced slices');
    } },

  { id:'ai_map_limited', group:'Import/Export', name:'Slices run a few at a time, in order (v36.1)',
    test: async()=>{
      var live=0, peak=0;
      var out = await mapLimited([1,2,3,4,5,6,7], 3, async function(n){
        live++; peak = Math.max(peak, live);
        await new Promise(function(r){ setTimeout(r, 5); });
        live--;
        return n*10;
      });
      if(out.join(',')!=='10,20,30,40,50,60,70') throw new Error('results came back out of order: '+out.join(','));
      if(peak>3) throw new Error('ran '+peak+' at once against a limit of 3');
      if(peak<2) throw new Error('ran them one at a time — the limit is not being used');
      if((await mapLimited([], 3, async function(){ return 1; })).length!==0)
        throw new Error('an empty list did not come back empty');
    } },

  { id:'ai_chunked_extract', group:'Import/Export', name:'A ten-recipe article is asked for in pieces (v36.1)',
    test: async()=>{
      var realAi = window.aiCall, asked = [];
      var body = function(n){
        return 'Recipe number '+n+'\n'+'filler '.repeat(120)+'\nsteps for '+n+'\n';
      };
      var article = 'Chestnuts: 10 recipes\nIntro.\n';
      for(var i=1;i<=10;i++) article += body(i);
      if(article.length<=MULTI_SPLIT_OVER) throw new Error('the fixture is not long enough to be split');
      try{
        window.aiCall = function(prompt, maxTokens){
          asked.push({ prompt:prompt, maxTokens:maxTokens });
          if(prompt.indexOf('List the recipes in it')!==-1){
            var t=[]; for(var k=1;k<=10;k++) t.push('Recipe number '+k);
            return Promise.resolve(JSON.stringify({ collectionName:'Chestnuts: 10 recipes',
              collectionNotes:'Intro.', category:'Dinner', titles:t }));
          }
          var m = prompt.match(/Recipe number (\d+)/);
          return Promise.resolve(JSON.stringify({ recipes:[{ name:'Recipe number '+m[1],
            ingredients:[{a:'1',n:'chestnuts'}], steps:['do '+m[1]] }] }));
        };
        var seen=[];
        var parsed = await extractRecipesFromText(article, 'webpage text',
          function(done,total){ seen.push(done+'/'+total); });

        if(asked.length!==11) throw new Error('made '+asked.length+' calls, not 1 outline + 10 recipes');
        // The whole point: no single call asks for a huge answer any more.
        asked.forEach(function(a){
          if(a.maxTokens>8000) throw new Error('a call still asked for '+a.maxTokens+' tokens');
        });
        if(parsed.recipes.length!==10) throw new Error('got '+parsed.recipes.length+' recipes, not 10');
        if(parsed.recipes[0].name!=='Recipe number 1' || parsed.recipes[9].name!=='Recipe number 10')
          throw new Error('the recipes came back out of the order they appear in');
        if(parsed.collectionName!=='Chestnuts: 10 recipes') throw new Error('the article title was lost');
        if(!seen.length) throw new Error('nothing reported progress — the spinner cannot count');
        if(seen[seen.length-1]!=='10/10') throw new Error('progress never reached the end: '+seen.join(' '));
        // And it must still build the same collection as a single-call answer.
        var built = buildImportFromParsed(parsed, 'https://example.com/a');
        if(built.kind!=='collection') throw new Error('the assembled answer built a '+built.kind);
        if(built.recipe.parts.length!==10) throw new Error('the collection has '+built.recipe.parts.length+' parts');

        // One bad slice costs one recipe, not the import. Before v36.1 the whole
        // article was one call, so any failure lost all ten.
        asked.length=0;
        window.aiCall = function(prompt){
          if(prompt.indexOf('List the recipes in it')!==-1){
            var t=[]; for(var k=1;k<=10;k++) t.push('Recipe number '+k);
            return Promise.resolve(JSON.stringify({ collectionName:'C', category:'Dinner', titles:t }));
          }
          var m = prompt.match(/Recipe number (\d+)/);
          if(m[1]==='4') return Promise.reject(new Error('API error 500: internal'));
          return Promise.resolve(JSON.stringify({ recipes:[{ name:'Recipe number '+m[1],
            ingredients:[{a:'1',n:'x'}], steps:['s'] }] }));
        };
        var part = await extractRecipesFromText(article, 'webpage text');
        if(part.recipes.length!==9) throw new Error('a failed slice cost '+(10-part.recipes.length)+' recipes');
        if(part._partial!==1) throw new Error('the import did not report that 1 of 10 was missing');
        if(part.recipes.some(function(r){ return r.name==='Recipe number 4'; }))
          throw new Error('the failed recipe came back anyway');

        // Everything failing is a failure, not an empty success.
        window.aiCall = function(prompt){
          if(prompt.indexOf('List the recipes in it')!==-1){
            return Promise.resolve(JSON.stringify({ titles:['Recipe number 1','Recipe number 2'] }));
          }
          return Promise.reject(new Error('API error 500: internal'));
        };
        var threw=false;
        try { await extractRecipesFromText(article, 'webpage text'); } catch(e){ threw=true; }
        if(!threw) throw new Error('every slice failed and the import still reported success');

        // A short text is still ONE call — splitting a single recipe would be
        // three round trips where one did.
        asked.length=0;
        window.aiCall = function(prompt, maxTokens){
          asked.push({prompt:prompt, maxTokens:maxTokens});
          return Promise.resolve(JSON.stringify({ recipes:[{ name:'Just one',
            ingredients:[{a:'1',n:'egg'}], steps:['beat'] }] }));
        };
        var shortText = 'Just one\n'+'a '.repeat(50)+'\nbeat it';
        var single = await extractRecipesFromText(shortText, 'pasted text');
        if(asked.length!==1) throw new Error('a short recipe took '+asked.length+' calls');
        if(asked[0].prompt.indexOf('List the recipes in it')!==-1)
          throw new Error('a short recipe paid for an outline pass');
        if(single.recipes.length!==1) throw new Error('the short path lost the recipe');
      } finally { window.aiCall = realAi; }
    } },

  { id:'coll_nothing_is_half_read', group:'Import/Export', name:'Search, export and Bring! see a whole collection (v36.0)',
    test: async()=>{
      var built = buildImportFromParsed({ collectionName:'Two things', category:'Dinner', recipes:[
        { name:'A', ingredients:[{a:'1',n:'saffron'},{a:'2',n:'leek'}], steps:['a1'] },
        { name:'B', ingredients:[{a:'3',n:'tahini'}], steps:['b1','b2'] }
      ]}, '');
      var testId=970101;
      var r = normalizeRecipe(Object.assign({id:testId,uid:'half-read',bg:'#fff'}, built.recipe));
      recipes.unshift(r);
      try{
        // Ingredient search (5f.3). Reading r.ingredients directly would find
        // NONE of these, and the recipe would look like it had no ingredients.
        var names = recipeIngredientNames(r);
        ['saffron','leek','tahini'].forEach(function(n){
          if(!names.some(function(x){ return x.indexOf(n)!==-1; }))
            throw new Error('ingredient search cannot see "'+n+'" inside a collection');
        });
        // "One item away" (5f.5) must count against the whole collection.
        if(typeof missingFor==='function' && missingFor(r, ['saffron','leek']).length!==1)
          throw new Error('the one-away filter miscounts a collection');

        // Word export: a section per recipe, not one merged heap.
        var blob = makeDocxBlob([r]);
        var buf = new Uint8Array(await blob.arrayBuffer());
        var txt = new TextDecoder().decode(buf);
        ['saffron','leek','tahini'].forEach(function(n){
          if(txt.indexOf(n)===-1) throw new Error('the Word export dropped "'+n+'"');
        });
        if(txt.indexOf('Heading2')===-1) throw new Error('the export has no per-recipe headings');
        if((txt.match(/>Ingredients</g)||[]).length<2)
          throw new Error('the export merged the recipes instead of giving each its own Ingredients');

        // Shared page / print / email must carry everything too.
        if(typeof rText==='function'){
          var t = rText(r);
          ['saffron','leek','tahini'].forEach(function(n){
            if(t.indexOf(n)===-1) throw new Error('the shared text dropped "'+n+'"');
          });
        }
      } finally { recipes = recipes.filter(function(x){ return x.id!==testId; }); }
    } },

  { id:'coll_view_and_ticks', group:'UI', name:'A collection renders per-recipe sections with their own ticks (v36.0)',
    test: async()=>{
      var built = buildImportFromParsed({ collectionName:'Viewable', category:'Dinner', recipes:[
        { name:'First', ingredients:[{a:'1',n:'onion',g:'for the base'},{a:'2',n:'garlic'}], steps:['s1','s2'] },
        { name:'Second', ingredients:[{a:'3',n:'rice'}], steps:['t1'] }
      ]}, '');
      var testId=970201, kView=viewId;
      recipes.unshift(normalizeRecipe(Object.assign({id:testId,uid:'view-c',bg:'#fff'}, built.recipe)));
      try{
        viewId=testId; drawView();
        var modal=document.getElementById('viewModal');
        if(modal.querySelectorAll('.collection-part').length!==2)
          throw new Error('expected 2 recipe sections, got '+modal.querySelectorAll('.collection-part').length);
        if(!modal.querySelectorAll('.line-sub').length)
          throw new Error('the ingredient sub-heading is not rendered');
        // A heading is not tickable — it is not a line you can be "on".
        if(modal.querySelector('.line-sub[data-line]'))
          throw new Error('a sub-heading was given a tick key, so tapping it marks a line that is not there');

        // Ticking the first recipe's onion must not tick the second's rice, so
        // the keys have to be namespaced per part.
        var keys=Array.prototype.slice.call(modal.querySelectorAll('[data-line]'))
          .map(function(e){ return e.getAttribute('data-line'); });
        if(keys.length!==6) throw new Error('expected 6 tickable lines, got '+keys.length);
        if(new Set(keys).size!==keys.length)
          throw new Error('two lines in different recipes share a tick key: '+keys.join(','));
        if(keys.indexOf('ing-p1-0')===-1) throw new Error('the second recipe has no namespaced keys: '+keys.join(','));

        var html=modal.innerHTML;
        if(html.indexOf('splitCollection('+testId+')')===-1) throw new Error('no way to split the collection');
        if(html.indexOf('promotePartToRecipe('+testId)===-1) throw new Error('no way to promote one recipe out');
        // A collection has no single prep time, serving count or difficulty.
        // Printing "⏱ —  🍽 — servings" states three things nothing verified.
        if(html.indexOf('servings</span>')!==-1 && html.indexOf('📚 2 recipes')===-1)
          throw new Error('the collection shows a per-recipe meta line it cannot have');
        // ...and "nutrition per 100g" across unrelated dishes is not a number.
        var nut=document.getElementById('nutrition-'+testId);
        if(nut && nut.style.display!=='none') throw new Error('the nutrition panel is offered for a whole collection');

        // A plain recipe must still render the ordinary two-column body.
        var plainId=970202;
        recipes.unshift(normalizeRecipe({id:plainId,uid:'plain-c',bg:'#fff',name:'Plain',
          ingredients:[{a:'1',n:'egg'}],steps:['cook']}));
        viewId=plainId; drawView();
        var m2=document.getElementById('viewModal');
        if(m2.querySelectorAll('.collection-part').length) throw new Error('a plain recipe rendered collection sections');
        if(!m2.querySelector('.recipe-columns')) throw new Error('a plain recipe lost its normal layout');
        recipes = recipes.filter(function(x){ return x.id!==plainId; });
      } finally {
        recipes = recipes.filter(function(x){ return x.id!==testId; });
        viewId=kView; if(viewId!=null) drawView();
      }
    } },

  { id:'coll_split_and_promote', group:'Features', name:'A collection can be split, and one recipe lifted out (v36.0)',
    test: async()=>{
      ['splitCollection','promotePartToRecipe','recipeFromPart']
        .forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });

      var built = buildImportFromParsed({ collectionName:'Round-up', category:'Soup', recipes:[
        { name:'Alpha', by:'Ann', ingredients:[{a:'1',n:'a'}], steps:['sa'] },
        { name:'Beta',  ingredients:[{a:'2',n:'b'}], steps:['sb'] },
        { name:'Gamma', ingredients:[{a:'3',n:'c'}], steps:['sc'] }
      ]}, 'https://example.com/roundup');
      var testId=970301;
      var coll = normalizeRecipe(Object.assign({id:testId,uid:'sp-c',bg:'#fff'}, built.recipe));
      recipes.unshift(coll);
      var kConfirm=window.askConfirm, kToast=window.toast, made=[];
      try{
        window.askConfirm=function(){ return Promise.resolve(true); };
        window.toast=function(){};

        // Promote keeps the part's identity — a new uid here would mean two
        // devices promoting the same part create two different recipes.
        var betaUid = recipeParts(coll)[1].uid;
        await promotePartToRecipe(testId, betaUid);
        var beta = recipes.find(function(x){ return x.uid===betaUid; });
        if(!beta) throw new Error('the promoted recipe did not keep the part uid');
        if(beta.name!=='Beta') throw new Error('the wrong part was promoted: '+beta.name);
        if(beta.ingredients.length!==1 || beta.steps.length!==1)
          throw new Error('the promoted recipe lost its contents');
        if(isCollection(beta)) throw new Error('the promoted recipe is itself a collection');
        if(beta.source!=='https://example.com/roundup') throw new Error('the promoted recipe lost the source');
        if(recipeParts(coll).length!==2) throw new Error('the part was not removed from the collection');
        if(recipeParts(coll).some(function(p){ return p.uid===betaUid; }))
          throw new Error('the promoted part is still in the collection too — it now exists twice');
        made.push(beta.id);

        // Down to one, a collection is just that recipe. A container holding one
        // thing is a container for nothing.
        await promotePartToRecipe(testId, recipeParts(coll)[0].uid);
        var still = recipes.find(function(x){ return x.id===testId; });
        if(isCollection(still)) throw new Error('a one-part collection stayed a collection');
        if(still.ingredients.length!==1) throw new Error('the last part was not folded back into the recipe');
        recipes.filter(function(x){ return x.uid && x.name==='Alpha'; }).forEach(function(x){ made.push(x.id); });

        // Split takes the whole thing apart.
        var built2 = buildImportFromParsed({ collectionName:'Splitme', category:'Dinner', recipes:[
          { name:'One', ingredients:[{a:'1',n:'x'}], steps:['1'] },
          { name:'Two', ingredients:[{a:'2',n:'y'}], steps:['2'] }
        ]}, '');
        var id2=970302;
        recipes.unshift(normalizeRecipe(Object.assign({id:id2,uid:'split-c',bg:'#fff'}, built2.recipe)));
        var before = recipes.length;
        await splitCollection(id2);
        if(recipes.find(function(x){ return x.id===id2; })) throw new Error('the collection survived the split');
        if(recipes.length !== before + 1) throw new Error('split produced '+(recipes.length-before+1)+' recipes, expected 2 replacing 1');
        ['One','Two'].forEach(function(n){
          var got = recipes.find(function(x){ return x.name===n; });
          if(!got) throw new Error('split lost "'+n+'"');
          if(isCollection(got)) throw new Error('a split-out recipe is still a collection');
          made.push(got.id);
        });
      } finally {
        window.askConfirm=kConfirm; window.toast=kToast;
        recipes = recipes.filter(function(x){
          return x.id!==testId && x.id!==970302 && made.indexOf(x.id)===-1;
        });
      }
    } },

  { id:'export_docx_photo_embedded', group:'Import/Export', name:'The Word export embeds the photo itself (v35.1)',
    test: async()=>{
      // Until v35.1 this wrote "[📸 Recipe photo included — see app for full
      // image]" and shipped no image at all — the placeholder Tony was seeing.
      // Everything below reads the ZIP that was actually produced, because the
      // failure mode is a package Word rejects, not source text that looks wrong.

      // Our writer stores every entry uncompressed, so a tiny reader is enough
      // and it doubles as a check that the local headers are well formed.
      function unzip(bytes){
        var out={}, i=0, dv=new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        while(i+30<=bytes.length && dv.getUint32(i,true)===0x04034b50){
          var comp=dv.getUint16(i+8,true), size=dv.getUint32(i+18,true),
              nlen=dv.getUint16(i+26,true), elen=dv.getUint16(i+28,true);
          if(comp!==0) throw new Error('entry is compressed; the reader assumes store method');
          var name=new TextDecoder().decode(bytes.subarray(i+30, i+30+nlen));
          out[name]=bytes.subarray(i+30+nlen+elen, i+30+nlen+elen+size);
          i += 30+nlen+elen+size;
        }
        return out;
      }
      var text=function(b){ return b?new TextDecoder().decode(b):''; };

      // A real 40x20 PNG (2:1) — a deliberately non-square ratio, so a swapped
      // width/height or a hard-coded box shows up as a wrong aspect below.
      var cv=document.createElement('canvas'); cv.width=40; cv.height=20;
      var cx2=cv.getContext('2d'); cx2.fillStyle='#C1440E'; cx2.fillRect(0,0,40,20);
      var pngUrl=cv.toDataURL('image/png');

      var withPhoto={emoji:'🥘',name:'Photo Test',category:'Dinner',difficulty:'Easy',
        prep:'5',servings:'2',ingredients:[{a:'1',n:'egg'}],steps:['Cook'],
        photo:pngUrl,notes:'',diets:[],source:''};
      var z=unzip(new Uint8Array(await makeDocxBlob([withPhoto]).arrayBuffer()));

      var media=Object.keys(z).filter(function(n){ return n.indexOf('word/media/')===0; });
      if(media.length!==1) throw new Error('expected one image part, got '+media.length+': '+media.join(','));
      var img=z[media[0]];
      if(!(img[0]===0x89 && img[1]===0x50 && img[2]===0x4E && img[3]===0x47))
        throw new Error('the stored image is not PNG bytes — it was run through a text encoder');

      var doc=text(z['word/document.xml']);
      if(doc.indexOf('see app for full image')!==-1)
        throw new Error('the placeholder note is still being written instead of the photo');
      if(doc.indexOf('<w:drawing>')===-1) throw new Error('no <w:drawing> in the document');
      if(doc.indexOf('<wp:anchor')!==-1)
        throw new Error('the picture is anchored/floating, so it can be drawn on top of the text');
      if(doc.indexOf('<wp:inline')===-1)
        throw new Error('the picture is not inline, so it does not get a line box of its own');

      // The r:embed must resolve to a relationship pointing at the part we stored.
      var embed=/r:embed="([^"]+)"/.exec(doc);
      if(!embed) throw new Error('the drawing has no r:embed relationship id');
      var rels=text(z['word/_rels/document.xml.rels']);
      var rel=new RegExp('Id="'+embed[1]+'"[^>]*Target="([^"]+)"').exec(rels);
      if(!rel) throw new Error('r:embed '+embed[1]+' has no matching relationship — Word shows a broken image');
      if('word/'+rel[1]!==media[0])
        throw new Error('the relationship points at '+rel[1]+' but the stored part is '+media[0]);
      // ...and a part whose extension has no Default is an invalid package.
      if(text(z['[Content_Types].xml']).indexOf('Extension="png"')===-1)
        throw new Error('[Content_Types].xml does not declare png, so Word rejects the whole file');

      // Aspect ratio preserved: the source is 2:1, so cx must be twice cy.
      var ext=/<wp:extent cx="(\d+)" cy="(\d+)"\/>/.exec(doc);
      if(!ext) throw new Error('no <wp:extent> — Word has no size to draw');
      var cx=+ext[1], cy=+ext[2];
      if(Math.abs((cx/cy) - 2) > 0.02)
        throw new Error('aspect ratio not preserved: cx/cy is '+(cx/cy).toFixed(3)+', expected 2');
      if(cx > 4.5*914400 + 1 || cy > 4*914400 + 1)
        throw new Error('the picture exceeds the page box: '+cx+'x'+cy+' EMU');

      // No photo: no image part, and no drawing.
      var noPhoto=Object.assign({}, withPhoto, {photo:''});
      var z2=unzip(new Uint8Array(await makeDocxBlob([noPhoto]).arrayBuffer()));
      if(Object.keys(z2).some(function(n){ return n.indexOf('word/media/')===0; }))
        throw new Error('a recipe with no photo still produced an image part');
      if(text(z2['word/document.xml']).indexOf('<w:drawing>')!==-1)
        throw new Error('a recipe with no photo still produced a drawing');
    } },

  { id:'export_docx_image_size', group:'Import/Export', name:'Image dimensions are read from the bytes, not guessed (v35.1)',
    test: async()=>{
      ['imagePixelSize','dataUrlToBytes'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      // Non-square on purpose: JPEG stores height BEFORE width, which is the
      // easy mistake, and it would silently rotate every landscape photo.
      var cv=document.createElement('canvas'); cv.width=64; cv.height=16;
      var g=cv.getContext('2d'); g.fillStyle='#123456'; g.fillRect(0,0,64,16);
      [['image/png',1],['image/jpeg',0.9]].forEach(function(pair){
        var url=cv.toDataURL(pair[0], pair[1]);
        var got=dataUrlToBytes(url);
        if(!got) throw new Error(pair[0]+' data URL was not decoded');
        var size=imagePixelSize(got.bytes);
        if(!size) throw new Error('could not read the size of a '+pair[0]);
        if(size.w!==64 || size.h!==16)
          throw new Error(pair[0]+' read as '+size.w+'x'+size.h+', expected 64x16');
      });
      // Things that are not embeddable must say so rather than produce junk.
      if(dataUrlToBytes('https://example.com/photo.jpg')!==null)
        throw new Error('an http photo URL was treated as embeddable, but it cannot be fetched synchronously');
      if(dataUrlToBytes('data:image/jpeg;base64,!!!not base64!!!')!==null)
        throw new Error('a malformed data URL was accepted and would corrupt the ZIP');
      if(imagePixelSize(new Uint8Array([1,2,3]))!==null)
        throw new Error('garbage bytes returned a size instead of null');
    } },

  { id:'export_docx_hebrew_bidi', group:'Import/Export', name:'Hebrew in the Word export is marked RTL and given a font (v35.1)',
    test: async()=>{
      function unzip(bytes){
        var out={}, i=0, dv=new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        while(i+30<=bytes.length && dv.getUint32(i,true)===0x04034b50){
          var size=dv.getUint32(i+18,true), nlen=dv.getUint16(i+26,true), elen=dv.getUint16(i+28,true);
          out[new TextDecoder().decode(bytes.subarray(i+30,i+30+nlen))] =
            bytes.subarray(i+30+nlen+elen, i+30+nlen+elen+size);
          i += 30+nlen+elen+size;
        }
        return out;
      }
      var text=function(b){ return b?new TextDecoder().decode(b):''; };
      var base={emoji:'🥘',category:'Dinner',difficulty:'Easy',prep:'5',servings:'2',
                photo:'',diets:[],source:''};

      var he=Object.assign({},base,{ name:"צ'ילי קון קרנה",
        ingredients:[{a:'1',n:'בצל בגודל בינוני'}], steps:['מטגנים את הבצל'], notes:'טעים יותר למחרת' });
      var z=unzip(new Uint8Array(await makeDocxBlob([he]).arrayBuffer()));
      var doc=text(z['word/document.xml']);

      // The apostrophe must survive intact — it is not escaped and must not be.
      if(doc.indexOf("צ'ילי קון קרנה")===-1)
        throw new Error('the Hebrew name with its apostrophe is not in the document XML');
      if(doc.indexOf('<w:bidi/>')===-1)
        throw new Error('no paragraph is marked bidi, so Word lays Hebrew out left-to-right');
      if(doc.indexOf('<w:rtl/>')===-1)
        throw new Error('no run is marked rtl, so Word treats Hebrew as left-to-right text');
      // Word picks the Hebrew font from the complex-script slot, not w:ascii.
      var styles=text(z['word/styles.xml']);
      if(!/<w:rFonts[^>]*\bw:cs="/.test(styles))
        throw new Error('no complex-script font is declared, so Word chooses one per machine and Hebrew can render with missing glyphs');
      if(!/<w:rFonts[^>]*\bw:ascii="/.test(styles))
        throw new Error('no ascii font is declared');

      // The emoji is the app's stand-in for a missing photo; a printed document
      // gets the photo itself, and the glyph rendered as a tofu box for Tony.
      if(doc.indexOf('🥘')!==-1)
        throw new Error('the recipe emoji is still written into the document');

      // An English-only recipe must NOT be flipped right-to-left.
      var en=Object.assign({},base,{ name:'Grandma Cake',
        ingredients:[{a:'1',n:'egg'}], steps:['Bake it'], notes:'Nice' });
      var doc2=text(unzip(new Uint8Array(await makeDocxBlob([en]).arrayBuffer()))['word/document.xml']);
      if(doc2.indexOf('<w:bidi/>')!==-1 || doc2.indexOf('<w:rtl/>')!==-1)
        throw new Error('an English-only recipe was marked right-to-left');
    } },

  { id:'stor_photo_race', group:'Storage', name:'localStorage save keeps un-hydrated photo flag',
    test: async()=>{
      if(typeof stripPhotosLocal!=='function') throw new Error('stripPhotosLocal not defined');
      // Simulate a save landing while hydratePhotosFromIDB() hasn't filled r.photo back in yet
      var slim=stripPhotosLocal([{id:1,name:'x',photo:'',originalPhoto:'',_ph:1,_po:0}])[0];
      if(slim._ph!==1) throw new Error('_ph flag was dropped while photo was still un-hydrated — this orphans the IndexedDB photo permanently');
    } },
  { id:'feat_clip_badge', group:'Features', name:'Clip flag is unified (isVideoBookmark folded into isClip)',
    test: async()=>{
      var testId=888888;
      recipes.unshift({id:testId,name:'Clip Badge Test',emoji:'🎥',photo:'',source:'',category:'Dinner',difficulty:'Easy',prep:'',servings:'',bg:'#fff',fav:false,ingredients:[],steps:[],diets:[],isClip:true,updatedAt:Date.now()});
      try {
        renderGrid();
        var card=document.querySelector('#recipeGrid .recipe-card, #recipeGrid .recipe-list-item');
        if(!card) throw new Error('no card rendered to check');
        var html=document.getElementById('recipeGrid').innerHTML;
        if(html.indexOf('Clip Badge Test')===-1) throw new Error('test recipe did not render');
      } finally { recipes=recipes.filter(function(r){return r.id!==testId;}); renderGrid(); }
      // Direct check: the card template's badge condition must include isClip
      // 2.3 — legacy data must be folded into isClip, and the old field dropped.
      var legacy=normalizeRecipe({id:2,name:'legacy',isVideoBookmark:true});
      if(!legacy.isClip) throw new Error('a legacy isVideoBookmark recipe did not become a clip');
      if('isVideoBookmark' in legacy) throw new Error('the legacy isVideoBookmark field was not removed');
      if(normalizeRecipe({id:3,name:'plain'}).isClip!==false) throw new Error('isClip must be a real boolean, not undefined');
    } },
  { id:'feat_bring_scale', group:'Features', name:'Send to Bring! uses the scaled amounts',
    test: async()=>{
      if(typeof openBringModal!=='function') throw new Error('openBringModal not defined');
      var testId=888889;
      recipes.unshift({id:testId,name:'Bring Scale Test',emoji:'🥘',photo:'',source:'',category:'Dinner',difficulty:'Easy',prep:'',servings:'',bg:'#fff',fav:false,ingredients:[{a:'100g',n:'flour'}],steps:['mix'],diets:[],updatedAt:Date.now()});
      var savedViewId=viewId, savedMult=viewMult, savedUnit=viewUnit;
      try {
        viewId=testId; viewMult=3; viewUnit='metric';
        openBringModal(testId);
        // Spacing follows the source: "100g" scales to "300g", not "300 g".
        if(_bringScaledAmounts[0]!=='300g') throw new Error('expected scaled amount "300g" for ×3, got "'+_bringScaledAmounts[0]+'"');
        var listHtml=document.getElementById('bringIngList').innerHTML;
        if(listHtml.indexOf('300g')===-1) throw new Error('Bring modal ingredient list does not show the scaled amount');
      } finally {
        // Closing here, not in the try: a failed assertion used to leave this
        // modal open, which then broke the Escape-closes-a-dialog test further
        // down the suite — one failure masquerading as two.
        closeM('bringOverlay');
        viewId=savedViewId; viewMult=savedMult; viewUnit=savedUnit;
        recipes=recipes.filter(function(r){return r.id!==testId;});
      }
    } },
  { id:'sec_escape_render', group:'Features', name:'Recipe text is escaped (no HTML injection)',
    test: async()=>{
      if(typeof escA!=='function') throw new Error('escA (attribute escaper) not defined');
      if(escH(undefined)!=='') throw new Error('escH must be null-safe');
      if(escA('a"b')!=='a&quot;b') throw new Error('escA must escape double quotes');
      var testId=888890;
      recipes.unshift(normalizeRecipe({id:testId,name:'<b>BOLD</b>',category:'Dinner',difficulty:'Easy',prep:'',servings:'',bg:'#fff',ingredients:[{a:'1',n:'<i>x</i>'}],steps:['<h1>H</h1>'],updatedAt:Date.now()}));
      try {
        renderGrid();
        if(document.querySelector('#recipeGrid b')) throw new Error('recipe name rendered as live HTML in the grid — injection possible');
        openView(testId); await wait(120);
        if(document.querySelector('#viewModal h1, #viewModal i')) throw new Error('ingredients/steps rendered as live HTML in the view — injection possible');
        closeM('viewOverlay');
      } finally { recipes=recipes.filter(function(r){return r.id!==testId;}); renderGrid(); }
    } },
  { id:'data_normalize', group:'Core', name:'Malformed recipes cannot break the grid',
    test: async()=>{
      if(typeof normalizeRecipe!=='function') throw new Error('normalizeRecipe not defined');
      var n=normalizeRecipe({id:1}); // nothing but an id
      if(typeof n.difficulty!=='string'||!Array.isArray(n.ingredients)||!Array.isArray(n.steps)) throw new Error('normalizeRecipe did not backfill required fields');
      // string ingredients (a shape AI imports sometimes return) become {a,n}
      var s=normalizeRecipe({ingredients:['200g flour']}).ingredients[0];
      if(!s||typeof s.n!=='string'||!s.n) throw new Error('string ingredients not converted to {a,n}');
      // a recipe missing difficulty/ingredients must still render
      var saved=recipes.slice(), testId=888891;
      try {
        recipes=[normalizeRecipe({id:testId,name:'Sparse'})];
        renderGrid(); // must not throw
        var q=document.getElementById('searchInput'); var old=q.value; q.value='zz'; renderGrid(); q.value=old;
      } finally { recipes=saved; renderGrid(); }
    } },
  { id:'feat_scale_range', group:'Features', name:'Ranged amounts scale correctly',
    test: async()=>{
      if(scaleAmt('2-3 cups',3)!=='6-9 cups') throw new Error('range scaling wrong: got "'+scaleAmt('2-3 cups',3)+'" expected "6-9 cups"');
      if(scaleAmt('a pinch',3)!=='a pinch') throw new Error('non-numeric amounts must pass through unchanged');
      if(scaleAmt('1/2 tsp',4)!=='2 tsp') throw new Error('fraction scaling wrong: got "'+scaleAmt('1/2 tsp',4)+'"');
    } },
  { id:'feat_orig_photo', group:'Features', name:'Show Original photo toggle works',
    test: async()=>{
      var testId=888892;
      recipes.unshift(normalizeRecipe({id:testId,name:'OrigTest',photo:'data:image/gif;base64,AAA',originalPhoto:'data:image/gif;base64,BBB',updatedAt:Date.now()}));
      try {
        openView(testId); await wait(120);
        var box=document.getElementById('origPhotoBox-'+testId);
        if(!box) throw new Error('#origPhotoBox missing from the view');
        if(box.style.display!=='none') throw new Error('original photo should start hidden');
        toggleOriginalPhoto(testId);
        if(box.style.display==='none') throw new Error('Show Original did nothing — the toggle is broken');
        toggleOriginalPhoto(testId);
        if(box.style.display!=='none') throw new Error('second tap should hide the original again');
        closeM('viewOverlay');
      } finally { recipes=recipes.filter(function(r){return r.id!==testId;}); renderGrid(); }
    } },
  { id:'feat_duplicate', group:'CRUD', name:'Duplicate recipe',
    test: async()=>{
      if(typeof duplicateRecipe!=='function') throw new Error('duplicateRecipe not defined');
      var testId=888900;
      recipes.unshift(normalizeRecipe({id:testId,name:'DupSrc',cookCount:5,fav:true,ingredients:[{a:'1',n:'x'}],steps:['s'],updatedAt:Date.now()}));
      var before=recipes.length;
      try {
        duplicateRecipe(testId);
        var copy=recipes.filter(function(r){return r.name==='DupSrc (copy)';})[0];
        if(recipes.length!==before+1||!copy) throw new Error('no copy was created');
        if(copy.id===testId) throw new Error('copy must get a new id');
        if(copy.cookCount!==0||copy.fav) throw new Error('copy should reset cook count and favourite');
        if(Math.abs(recipes.indexOf(copy)-recipes.findIndex(function(r){return r.id===testId;}))!==1) throw new Error('copy should sit next to the original');
        recipes=recipes.filter(function(r){return r.id!==copy.id;});
        closeM('editOverlay');
      } finally { _editFormSnapshot=null; recipes=recipes.filter(function(r){return r.id!==testId&&r.name!=='DupSrc (copy)';}); renderGrid(); }
    } },
  { id:'feat_recipe_delete', group:'CRUD', name:'Per-recipe delete with undo',
    test: async()=>{
      if(typeof deleteRecipe!=='function') throw new Error('deleteRecipe not defined');
      var testId=888901;
      recipes.splice(1,0,normalizeRecipe({id:testId,name:'DelMe',updatedAt:Date.now()}));
      var before=recipes.length;
      try {
        var pending=deleteRecipe(testId);
        await wait(80);
        var ok=document.querySelector('#askOverlay #askOk');
        if(!ok) throw new Error('delete did not raise the styled confirmation (2.1)');
        ok.click(); await pending; await wait(30);
        if(recipes.length!==before-1) throw new Error('recipe was not deleted');
        undoDelete();
        if(recipes.length!==before) throw new Error('undo did not restore it');
        if(recipes[1].id!==testId) throw new Error('undo restored it to the wrong position');
      } finally { var a=document.getElementById('askOverlay'); if(a) a.remove();
        recipes=recipes.filter(function(r){return r.id!==testId;}); renderGrid(); }
    } },
  { id:'feat_dirty_guard', group:'CRUD', name:'Unsaved edits are not lost silently',
    test: async()=>{
      if(typeof editFormIsDirty!=='function') throw new Error('editFormIsDirty not defined');
      if(typeof unsavedSave!=='function'||typeof unsavedDiscard!=='function'||typeof unsavedKeepEditing!=='function')
        throw new Error('unsavedSave/unsavedDiscard/unsavedKeepEditing not defined');
      var ov=document.getElementById('unsavedOverlay');
      if(!ov) throw new Error('#unsavedOverlay missing');
      try {
        openAddModal(null);
        if(editFormIsDirty()) throw new Error('a freshly opened form must not count as edited');
        document.getElementById('f-name').value='typed';
        if(!editFormIsDirty()) throw new Error('typing was not detected as an unsaved change');
        closeM('editOverlay');
        if(!ov.classList.contains('open')) throw new Error('closing a dirty form must ask before discarding');
        if(!document.getElementById('editOverlay').classList.contains('open')) throw new Error('the form must stay open behind the prompt');
        if(document.getElementById('unsavedName').textContent.indexOf('typed')===-1) throw new Error('the prompt should name the recipe being edited');
        unsavedKeepEditing();
        if(ov.classList.contains('open')) throw new Error('"Keep editing" should close the prompt');
        if(!document.getElementById('editOverlay').classList.contains('open')) throw new Error('"Keep editing" should leave the form open');
        closeM('editOverlay'); unsavedDiscard();
        if(ov.classList.contains('open')) throw new Error('"Discard" should close the prompt');
        if(document.getElementById('editOverlay').classList.contains('open')) throw new Error('"Discard" should close the form');
        if(editFormIsDirty()) throw new Error('the snapshot must be cleared after discarding');
      } finally { _editFormSnapshot=null; ov.classList.remove('open'); document.getElementById('editOverlay').classList.remove('open'); }
    } },
  { id:'feat_dirty_guard_save', group:'CRUD', name:'Unsaved prompt can save from inside the prompt',
    test: async()=>{
      var ov=document.getElementById('unsavedOverlay');
      var before=recipes.length, made=null;
      try {
        openAddModal(null);
        document.getElementById('f-name').value='DirtySaveTest';
        closeM('editOverlay');
        if(!ov.classList.contains('open')) throw new Error('prompt did not appear');
        unsavedSave();
        await new Promise(function(r){setTimeout(r,50);});
        if(ov.classList.contains('open')) throw new Error('"Save changes" should close the prompt');
        if(document.getElementById('editOverlay').classList.contains('open')) throw new Error('"Save changes" should close the edit form');
        made=recipes.find(function(r){return r.name==='DirtySaveTest';});
        if(!made) throw new Error('"Save changes" did not actually save the recipe');
      } finally {
        recipes=recipes.filter(function(r){return r.name!=='DirtySaveTest';});
        _editFormSnapshot=null; ov.classList.remove('open');
        document.getElementById('editOverlay').classList.remove('open');
        saveData(); renderGrid();
      }
    } },
  { id:'feat_nophoto_filter', group:'Features', name:'No-photo filter & auto-fetch prompt',
    test: async()=>{
      if(typeof toggleNoPhotoFilter!=='function') throw new Error('toggleNoPhotoFilter not defined');
      if(!document.getElementById('noPhotoPrompt')) throw new Error('#noPhotoPrompt missing');
      var testId=888902, clipId=888903, clipPhotoId=888904;
      recipes.unshift(normalizeRecipe({id:testId,name:'NoPhotoTest',photo:'',updatedAt:Date.now()}));
      // v33.9 — a clip is a recipe like any other as far as photos go. It was
      // excluded from this filter, the chip count and the auto-fetch, which made
      // it the one kind of recipe you could not get a picture for.
      recipes.unshift(normalizeRecipe({id:clipId,name:'ClipNoPhoto',photo:'',isClip:true,updatedAt:Date.now()}));
      recipes.unshift(normalizeRecipe({id:clipPhotoId,name:'ClipWithPhoto',photo:'data:image/gif;base64,R0lGODlhAQABAAAAACw=',isClip:true,updatedAt:Date.now()}));
      try {
        renderFilters();
        var chipBtn=document.querySelector('button[onclick*="toggleNoPhotoFilter"]');
        if(!chipBtn) throw new Error('no-photo filter chip missing while photoless recipes exist');
        var expected=recipes.filter(function(r){ return !r.photo; }).length;
        if(chipBtn.textContent.indexOf('('+expected+')')===-1)
          throw new Error('the chip says "'+chipBtn.textContent.trim()+'" but '+expected+' recipes have no photo — a photoless clip is not being counted');
        toggleNoPhotoFilter();
        if(document.getElementById('noPhotoPrompt').style.display==='none') throw new Error('auto-fetch prompt should appear with the filter on');
        var shown=Array.prototype.slice.call(document.querySelectorAll('#recipeGrid .recipe-card,#recipeGrid .recipe-list-item'));
        if(!shown.length) throw new Error('filter hid everything, including photoless recipes');
        var labels=shown.map(function(el){ return el.getAttribute('aria-label')||''; });
        if(labels.indexOf('ClipNoPhoto')===-1)
          throw new Error('a clip with no photo is hidden from the "No photo" filter, so there is no way to find it and give it one');
        if(labels.indexOf('ClipWithPhoto')>-1)
          throw new Error('a clip that HAS a photo is listed as missing one');
        toggleNoPhotoFilter();
        if(document.getElementById('noPhotoPrompt').style.display!=='none') throw new Error('prompt should hide when the filter is off');

        // ...and the card must actually show it. The template has always rendered
        // r.photo for clips; if that ever changed, giving a clip a photo would be
        // pointless work the user cannot see.
        //
        // BOTH view modes, because there are two independent templates and only
        // one runs per render. Asserting against whichever mode happened to be
        // active tested half the code: viewMode defaults to 'list', so mutations
        // to the grid template survived untouched.
        var savedView=viewMode;
        try{
          ['list','grid'].forEach(function(mode){
            viewMode=mode; renderGrid();
            var card=Array.prototype.slice.call(document.querySelectorAll('#recipeGrid .recipe-card,#recipeGrid .recipe-list-item'))
              .filter(function(el){ return el.getAttribute('aria-label')==='ClipWithPhoto'; })[0];
            if(!card) throw new Error('['+mode+'] the clip with a photo is missing from the grid entirely');
            if(!card.querySelector('img'))
              throw new Error('['+mode+"] a clip's photo is not rendered — the card falls back to the emoji, so giving a clip a photo achieves nothing visible");
            if(!card.querySelector('.clip-badge'))
              throw new Error('['+mode+'] the clip badge vanished once the clip had a photo, so it no longer reads as a clip');
          });
        } finally { viewMode=savedView; }
      } finally {
        showNoPhotoOnly=false;
        recipes=recipes.filter(function(r){ return r.id!==testId && r.id!==clipId && r.id!==clipPhotoId; });
        renderFilters(); renderGrid();
      }
    } },
  { id:'feat_sort_added', group:'Features', name:'Recently-added sort',
    test: async()=>{
      var prev=sortMode;
      try {
        setSort('added');
        if(sortMode!=='added') throw new Error('sort mode not applied');
        if(document.getElementById('sortBtn').textContent.indexOf('Newest')===-1) throw new Error('sort button label not updated');
      } finally { setSort(prev); }
    } },
  { id:'feat_units', group:'Features', name:'Metric keeps tsp/tbsp/cup, converts imperial',
    test: async()=>{
      // Kitchen measures used in metric kitchens must NOT become millilitres
      if(cvtIng('2 tsp','metric')!=='2 tsp') throw new Error('tsp should be left alone in metric, got "'+cvtIng('2 tsp','metric')+'"');
      if(cvtIng('1 tbsp','metric')!=='1 tbsp') throw new Error('tbsp should be left alone in metric');
      if(cvtIng('1 cup','metric')!=='1 cup') throw new Error('cup should be left alone in metric');
      // Genuinely imperial units should convert, rounded to cookable values
      if(cvtIng('1 lb','metric')!=='450g') throw new Error('1 lb should be ~450g, got "'+cvtIng('1 lb','metric')+'"');
      if(cvtIng('8 oz','metric')!=='230g') throw new Error('8 oz should be ~230g, got "'+cvtIng('8 oz','metric')+'"');
      if(!/^\d+ml$/.test(cvtIng('4 fl oz','metric'))) throw new Error('fl oz should convert to a whole ml value');
      // No ugly trailing zeros the other way
      if(cvtIng('500ml','imperial')!=='2 cups') throw new Error('500ml should be "2 cups", got "'+cvtIng('500ml','imperial')+'"');

      // THE AMOUNTS A REAL RECIPE ACTUALLY CONTAINS (v36.51). Everything above
      // this line is an amount a developer types into a test. Tony reported the
      // conversion as broken and he was right: his recipes are in Hebrew, and
      // "200 גרם" had never once been recognised. Nor had a fraction, a range,
      // or a unit spelled out in words. It did not regress — it had never
      // worked on the library it was written for, which is the same thing from
      // where he is sitting.
      var cvtCases = [
        // Hebrew units, which is most of his library
        ['200 גרם','imperial','7.1 oz'], ['1 ק"ג','imperial','2.2 lb'],
        ['500 מ"ל','imperial','2 cups'], ['2 קילו','imperial','4.41 lb'],
        ['180 מעלות','imperial','356°F'],
        // Fractions, mixed numbers and the vulgar-fraction characters
        ['1/2 kg','imperial','1.1 lb'], ['1 1/2 lb','metric','680g'],
        ['½ lb','metric','230g'],  ['1½ kg','imperial','3.31 lb'],
        // Ranges convert BOTH ends, keeping the separator they came with
        ['200-300 g','imperial','7.1-10.6 oz'], ['2-3 lb','metric','910-1360g'],
        ['1–2 kg','imperial','2.2–4.41 lb'],
        // Units written out
        ['200 grams','imperial','7.1 oz'], ['1 kilo','imperial','2.2 lb'],
        ['2 pounds','metric','910g'], ['8 ounces','metric','230g'], ['200 gr.','imperial','7.1 oz']
      ];
      cvtCases.forEach(function(c){
        var got = cvtIng(c[0], c[1]);
        if(got !== c[2])
          throw new Error(JSON.stringify(c[0])+' → '+c[1]+' gave '+JSON.stringify(got)
            + ', expected '+JSON.stringify(c[2]));
      });
      // …and everything that is NOT a convertible amount is returned untouched.
      // A matcher this permissive has to be able to say no: "1 large egg" ends
      // in "g", and reading it as a gram value would rewrite the recipe.
      ['2 tsp','1 tbsp','1 cup','1 large egg','a pinch','500 mg','2 cloves','3','',
       'לפי הטעם','1 kg of something'].forEach(function(a){
        ['metric','imperial'].forEach(function(u){
          if(cvtIng(a,u)!==a)
            throw new Error(JSON.stringify(a)+' was rewritten to '+JSON.stringify(cvtIng(a,u))+' in '+u);
        });
      });
      // cvtNum says null, never NaN: null is a decision to leave the amount
      // alone, NaN is a bug that reaches a recipe.
      if(cvtNum('half')!==null || cvtNum('')!==null || cvtNum('1/0')!==null)
        throw new Error('cvtNum returned something other than null for an unreadable number');
      if(cvtNum('1 1/2')!==1.5 || cvtNum('½')!==0.5 || cvtNum('2.5')!==2.5)
        throw new Error('cvtNum misread a number a recipe would actually use');

      // THE CHOICE HAS TO STICK. viewUnit reset to metric on every openView
      // while the scale was remembered per recipe — so pressing Imperial and
      // opening the next recipe looked exactly like the button doing nothing.
      if(typeof VIEW_UNIT_KEY!=='string') throw new Error('VIEW_UNIT_KEY not defined');
      var prevUnitPref=null;
      try{ prevUnitPref=localStorage.getItem(VIEW_UNIT_KEY); }catch(e){}
      var prevViewId=viewId, prevUnit=viewUnit;
      try{
        var rid=888842;
        recipes.unshift(normalizeRecipe({id:rid,name:'Unit probe',
          ingredients:[{a:'200 g',n:'flour'}],steps:['Mix.'],updatedAt:Date.now()}));
        openView(rid);
        setUnit('imperial');
        if(viewUnit!=='imperial') throw new Error('setUnit did not take');
        closeM('viewOverlay');
        openView(rid);
        if(viewUnit!=='imperial')
          throw new Error('the unit reset to metric on re-open — the button looks broken');
        setUnit('metric');
        closeM('viewOverlay');
        openView(rid);
        if(viewUnit!=='metric') throw new Error('switching back to metric did not stick either');
        closeM('viewOverlay');
      } finally {
        recipes=recipes.filter(function(x){ return x.id!==888842; });
        viewId=prevViewId; viewUnit=prevUnit;
        try{ if(prevUnitPref===null) localStorage.removeItem(VIEW_UNIT_KEY);
             else localStorage.setItem(VIEW_UNIT_KEY,prevUnitPref); }catch(e){}
      }
    } },
  { id:'i18n_alignment', group:'UI', name:'Hebrew/English align correctly side by side',
    test: async()=>{
      var he=888896, en=888897;
      recipes.unshift(normalizeRecipe({id:en,name:'Grandma Cake',ingredients:[{a:'1',n:'egg'}],steps:['Mix well.'],updatedAt:Date.now()}));
      recipes.unshift(normalizeRecipe({id:he,name:'עוגת שוקולד',ingredients:[{a:'200 גרם',n:'שוקולד'}],steps:['ערבבו היטב.'],updatedAt:Date.now()}));
      try {
        var prevView=viewMode;
        setView('list'); renderGrid();
        var names=Array.prototype.slice.call(document.querySelectorAll('.recipe-list-name'));
        var heEl=names.filter(function(n){return n.textContent.indexOf('עוגת')===0;})[0];
        var enEl=names.filter(function(n){return n.textContent.indexOf('Grandma')===0;})[0];
        if(!heEl||!enEl) throw new Error('test recipes did not render');
        if(getComputedStyle(heEl).direction!=='rtl') throw new Error('Hebrew name is not right-to-left');
        if(getComputedStyle(enEl).direction!=='ltr') throw new Error('English name is forced RTL — it should follow its own text');
        if(getComputedStyle(enEl).textAlign!=='start') throw new Error('names should align to text start, not a hard-coded side');
        // Email + print must carry per-item direction too
        var mail=rHtml(recipes[0]);
        if(mail.indexOf('<td dir="auto"')===-1) throw new Error('email ingredients lack dir="auto" — Hebrew would misalign in the mail');
        var pr=buildPrintHtml([recipes[0]]);
        if(pr.indexOf('unicode-bidi:plaintext')===-1) throw new Error('print stylesheet lacks bidi handling');
        setView(prevView);
      } finally {
        recipes=recipes.filter(function(r){return r.id!==he&&r.id!==en;});
        renderGrid();
      }
    } },
  { id:'feat_step_timers', group:'Features', name:'Step timers live on the steps themselves',
    test: async()=>{
      ['findStepTimers','startCookTimer','clearCookTimers'].forEach(function(f){
        if(typeof window[f]!=='function' && typeof eval(f)!=='function') throw new Error(f+' not defined');
      });
      if(document.getElementById('cookOverlay')) throw new Error('#cookOverlay is still present — Cook Mode was meant to be removed');
      if(typeof window.openCookMode==='function') throw new Error('openCookMode still exists — Cook Mode was meant to be removed');
      var t=findStepTimers('Bake 1 hour then rest 90 seconds');
      if(t.length!==2||t[0].secs!==3600||t[1].secs!==90) throw new Error('step timer parsing wrong: '+JSON.stringify(t));
      if(findStepTimers('Stir gently').length!==0) throw new Error('found a timer where there is none');
      var testId=888895;
      recipes.unshift(normalizeRecipe({id:testId,name:'TimerTest',ingredients:[{a:'100g',n:'x'}],steps:['One','Two for 5 minutes'],updatedAt:Date.now()}));
      try {
        openView(testId); await wait(80);
        var btns=document.querySelectorAll('#viewModal .cook-timer-btn');
        if(!btns.length) throw new Error('no timer offered on a step containing "5 minutes"');
        if(btns[0].textContent.indexOf('5:00')===-1) throw new Error('timer shows the wrong duration: '+btns[0].textContent);
        // The whole recipe must be visible at once — that is the point of removing Cook Mode.
        if(document.querySelectorAll('#viewModal .steps-list li').length!==2) throw new Error('not every step is shown at once');
        if(!document.querySelector('#viewModal .ingredients-list li')) throw new Error('ingredients are not shown alongside the method');
      } finally {
        closeM('viewOverlay'); clearCookTimers();
        recipes=recipes.filter(function(r){return r.id!==testId;}); renderGrid();
      }
    } },
  { id:'feat_line_marker', group:'Features', name:'Line marker: tap to mark, slides, survives re-render',
    test: async()=>{
      ['markLine','clearLineMark','loadLineMark','refreshLineMarker'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var testId=888913;
      recipes.unshift(normalizeRecipe({id:testId,name:'MarkTest',servings:'4',
        ingredients:[{a:'100g',n:'flour'},{a:'2',n:'eggs'}],steps:['Mix it','Bake it','Eat it'],updatedAt:Date.now()}));
      var savedMark=null; try{ savedMark=localStorage.getItem('tonys_linemark'); }catch(e){}
      try {
        openView(testId); await wait(80);
        if(!document.getElementById('lineMarker')) throw new Error('#lineMarker missing');
        if(!document.getElementById('lineMarkHost')) throw new Error('#lineMarkHost missing');
        if(!document.querySelector('#viewModal [data-line="ing-0"]')) throw new Error('ingredients are not tappable lines');
        if(!document.querySelector('#viewModal [data-line="step-2"]')) throw new Error('steps are not tappable lines');
        // Mark a step.
        markLine('step',1); await wait(50);
        var marker=document.getElementById('lineMarker');
        if(!marker.classList.contains('on')) throw new Error('the marker did not appear');
        if(!document.querySelector('#viewModal [data-line="step-1"]').classList.contains('line-current')) throw new Error('the tapped line is not marked as current');
        var topAtStep1=parseFloat(marker.style.top);
        // Moving marks the new line and unmarks the old one — only ever one.
        await wait(360);
        markLine('step',2); await wait(50);
        var cur=document.querySelectorAll('#viewModal .line-current');
        if(cur.length!==1) throw new Error('expected exactly one highlighted line, got '+cur.length);
        if(cur[0].getAttribute('data-line')!=='step-2') throw new Error('the highlight did not move to the tapped line');
        // Running a finger down the list taps several lines fast — that must move
        // the marker, not be read as a double tap and clear it.
        markLine('step',0); markLine('step',1); markLine('step',2); await wait(50);
        if(document.querySelectorAll('#viewModal .line-current').length!==1) throw new Error('quick taps on different lines cleared the marker instead of moving it');
        if(parseFloat(marker.style.top)===topAtStep1) throw new Error('the marker did not move to the new line');
        // It must be a real transition, otherwise it cannot slide.
        if(getComputedStyle(marker).transitionDuration==='0s') throw new Error('the marker has no transition — it would jump rather than slide');
        // It must survive a re-render (scaling re-renders the whole view).
        setMult(2); await wait(120);
        if(!document.getElementById('lineMarker').classList.contains('on')) throw new Error('the marker was lost when the view re-rendered');
        if(!document.querySelector('#viewModal [data-line="step-2"]').classList.contains('line-current')) throw new Error('the marked line moved after a re-render');
        // ...and reopening the recipe.
        setMult(1); closeM('viewOverlay'); await wait(30);
        openView(testId); await wait(120);
        if(!document.querySelector('#viewModal [data-line="step-2"]').classList.contains('line-current')) throw new Error('the marked line was not restored when the recipe was reopened');
        // A double tap on the SAME line clears.
        await wait(360);
        markLine('step',0); markLine('step',0); await wait(50);
        if(document.querySelectorAll('#viewModal .line-current').length!==0) throw new Error('a double tap did not clear the marker');
        if(document.getElementById('lineMarker').classList.contains('on')) throw new Error('the marker is still visible after clearing');
      } finally {
        closeM('viewOverlay');
        try{ if(savedMark===null) localStorage.removeItem('tonys_linemark'); else localStorage.setItem('tonys_linemark',savedMark); }catch(e){}
        recipes=recipes.filter(function(r){return r.id!==testId;}); renderGrid();
      }
    } },
  { id:'perf_photo_blob', group:'Features', name:'Photos render as blob URLs (fast grid)',
    test: async()=>{
      if(typeof photoSrc!=='function') throw new Error('photoSrc not defined');
      var png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';
      var testId=888893;
      recipes.unshift(normalizeRecipe({id:testId,name:'BlobTest',photo:png,updatedAt:Date.now()}));
      try {
        var src=photoSrc(recipes[0]);
        if(src.indexOf('blob:')!==0) throw new Error('photo not converted to a blob URL — the grid will rebuild megabytes of markup per render');
        if(photoSrc(recipes[0])!==src) throw new Error('blob URL not cached — a new URL per render leaks memory');
        // exports must still receive the original data URL, not a blob: URL
        if(JSON.stringify(recipes[0]).indexOf('data:image/png')===-1) throw new Error('stored photo must remain a data URL for backup/export/sync');
      } finally { recipes=recipes.filter(function(r){return r.id!==testId;}); renderGrid(); }
    } },
  { id:'feat_undo_delete', group:'CRUD', name:'Delete can be undone',
    test: async()=>{
      if(typeof undoDelete!=='function'||typeof toastAction!=='function') throw new Error('undo plumbing not defined');
      var testId=888894;
      recipes.splice(1,0,normalizeRecipe({id:testId,name:'UndoTest',updatedAt:Date.now()}));
      var before=recipes.length;
      try {
        selectMode=true; selectedIds.clear(); selectedIds.add(testId);
        var pending=deleteSelected();
        await wait(80);
        var ok=document.querySelector('#askOverlay #askOk');
        if(!ok) throw new Error('bulk delete did not raise the styled confirmation (2.1)');
        ok.click(); await pending; await wait(30);
        if(recipes.length!==before-1) throw new Error('recipe was not deleted');
        undoDelete();
        if(recipes.length!==before) throw new Error('undo did not restore the recipe');
        var back=recipes.findIndex(function(r){return r.id===testId;});
        if(back!==1) throw new Error('undo restored the recipe at position '+back+' instead of its original position 1');
      } finally {
        var a=document.getElementById('askOverlay'); if(a) a.remove();
        recipes=recipes.filter(function(r){return r.id!==testId;});
        selectedIds.clear(); cancelSelectMode();
      }
    } },
  { id:'a11y_basics', group:'UI', name:'Accessibility basics (labels, Escape, focus)',
    test: async()=>{
      if(typeof closeTopModal!=='function') throw new Error('closeTopModal (Escape handling) not defined');
      applyAriaLabels();
      var iconOnly=Array.prototype.slice.call(document.querySelectorAll('button')).filter(function(b){
        var t=(b.textContent||'').trim(); return t && !/[A-Za-z0-9]/.test(t);
      });
      var bad=iconOnly.filter(function(b){ return !b.getAttribute('aria-label'); });
      if(bad.length) throw new Error(bad.length+' icon-only button(s) have no accessible name');
      if(!document.getElementById('searchInput').getAttribute('aria-label')) throw new Error('search box has no accessible name');
      if(document.getElementById('toast').getAttribute('aria-live')!=='polite') throw new Error('toast is not announced to screen readers');
      // Escape must close an open dialog.
      // This used to open the Measurement Converter and call closeTopModal() on
      // it — but closeTopModal closes the LAST open overlay in DOM order, and
      // #selfTestOverlay sits after #calcOverlay in the markup. Run from the
      // Self Test screen (i.e. the only way anyone actually runs it) the call
      // therefore closed the suite out from under itself, the assertion below
      // failed because the converter was of course still open, and with no
      // cleanup the converter was left stranded on screen while the remaining
      // tests ran invisibly. Use a probe overlay appended last in the document
      // instead: it tests the same mechanism and cannot be anything but topmost.
      var probe=document.createElement('div');
      probe.id='a11yEscProbe';
      probe.className='modal-overlay open';
      probe.style.cssText='position:fixed;inset:0;display:block;visibility:visible;';
      document.body.appendChild(probe);
      try{
        if(!closeTopModal()) throw new Error('closeTopModal did not close the open dialog');
        if(probe.classList.contains('open')) throw new Error('dialog still open after Escape');
      } finally { probe.remove(); }   // in finally: a failed assertion must not strand a dialog
    } },
  { id:'export_print', group:'Import/Export', name:'Print builds a valid, non-empty document',
    test: async()=>{
      if(typeof buildPrintHtml!=='function') throw new Error('buildPrintHtml not defined');
      if(!recipes.length) throw new Error('No recipes');
      var html=buildPrintHtml([recipes[0]]);
      if(!/<\/style>/i.test(html)) throw new Error('unclosed <style> — the whole document would be swallowed as CSS and print blank');
      var doc=new DOMParser().parseFromString(html,'text/html');
      if(!doc.querySelector('h1')) throw new Error('print document has no heading — it would print blank');
      if(!(doc.body.textContent||'').trim()) throw new Error('print document body is empty');
    } },
  { id:'export_bulk', group:'Import/Export', name:'Bulk export of selected recipes works',
    test: async()=>{
      ['exportRecipesToWord','exportSelWord','printRecipes'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      if(!document.querySelector('#selectBar button[onclick*="exportSelWord"]'))  throw new Error('Word button missing from the select bar');
      // duplicate recipe names must not collide as Excel sheet names
    } },
  { id:'perf_search_debounce', group:'Core', name:'Search input is debounced',
    test: async()=>{
      if(typeof onSearchInput!=='function') throw new Error('onSearchInput not defined');
      var inp=document.getElementById('searchInput');
      if((inp.getAttribute('oninput')||'').indexOf('onSearchInput')===-1) throw new Error('search box still re-renders on every keystroke — typing lags on large collections');
    } },
  { id:'sub_model_and_accessors', group:'Core', name:'A sub-title is neither an ingredient nor a step (v36.4)',
    test: async()=>{
      var r = normalizeRecipe({ id:979001, name:'Brined chicken', ingredients:[
        { a:'1 Kg', n:'chicken breast' },
        { sub:'Brine option #1' },
        { a:'1 litre', n:'water', ind:1 },
        { a:'2 tbsp', n:'salt', ind:1 },
        { sub:'Brine option #2' },
        { a:'1 litre', n:'milk', ind:1 },
        { a:'0.5 Kg', n:'pork chops' }
      ], steps:[ 'Trim the chicken', { sub:'If brining' }, { t:'Submerge overnight', ind:1 }, 'Roast at 200' ]});

      // The whole point: a heading is not something you can cook with.
      if(allIngredients(r).length!==5)
        throw new Error('allIngredients counted headings: '+allIngredients(r).length+', expected 5');
      if(allSteps(r).length!==3) throw new Error('allSteps counted headings: '+allSteps(r).length);
      if(allIngredients(r).some(isSubLine)) throw new Error('a heading leaked into allIngredients');
      if(allSteps(r).some(function(s){ return typeof s!=='string'; }))
        throw new Error('allSteps returned something that is not a plain string');
      if(allSteps(r)[1]!=='Submerge overnight')
        throw new Error('an indented step lost its text: '+allSteps(r)[1]);

      // ...but the lines accessor sees everything, in order.
      if(ingredientLines(r).length!==7) throw new Error('ingredientLines dropped lines');
      if(stepLines(r).length!==4) throw new Error('stepLines dropped lines');
      if(ingredientLines(r)[1].sub!=='Brine option #1') throw new Error('the heading text was mangled');

      // Indentation is per LINE. "0.5 Kg pork chops" comes after an indented
      // run and must NOT be indented - that is the case "everything until the
      // next heading" would get wrong.
      var lines = ingredientLines(r);
      if(!lineIndented(lines[2])) throw new Error('an item marked indented is not');
      if(lineIndented(lines[0])) throw new Error('the first item was indented without being asked');
      if(lineIndented(lines[6]))
        throw new Error('the line after an indented run was indented too - indentation is per line, not until the next heading');

      // Junk in, nothing out: an empty heading, and a heading with nothing
      // under it, are noise rather than structure.
      var j = normalizeRecipe({ ingredients:[ {sub:''}, {a:'1',n:'egg'}, {sub:'Trailing'} ], steps:[ {sub:'Also trailing'} ] });
      if(j.ingredients.some(isSubLine))
        throw new Error('an empty or trailing heading survived: '+JSON.stringify(j.ingredients));
      if(j.steps.length) throw new Error('a heading with no steps under it survived');
      // Two headings in a row IS legitimate now — that is what nesting looks
      // like — so long as content follows. What must still go is a heading with
      // nothing under it anywhere.
      var d = normalizeRecipe({ ingredients:[ {sub:'A'}, {sub:'B'}, {a:'1',n:'x'} ] });
      if(d.ingredients.filter(isSubLine).length!==2)
        throw new Error('a heading directly above another was dropped — that is what nesting is');
      var tail = normalizeRecipe({ ingredients:[ {a:'1',n:'x'}, {sub:'A'}, {sub:'B'} ] });
      if(tail.ingredients.filter(isSubLine).length)
        throw new Error('trailing headings with nothing under them survived');

      // v36.7 — a SUB-SUB-HEADER is a heading that is itself indented: an option
      // with its own preparation note nested under it. No new line type; the
      // flag that already means "shifted right" does the job, so everything
      // that handles indentation already handles this.
      var two = normalizeRecipe({ ingredients:[
        {sub:'Brine option #1'}, {sub:'How to prepare it', ind:1},
        {a:'1 litre', n:'water', ind:1}, {a:'2 tbsp', n:'salt', ind:1} ] });
      var heads = two.ingredients.filter(isSubLine);
      if(heads.length!==2) throw new Error('a nested heading was dropped: '+JSON.stringify(two.ingredients));
      if(lineIndented(heads[0])) throw new Error('the outer heading was indented');
      if(!lineIndented(heads[1])) throw new Error('the nested heading lost its indent, so both levels look the same');
      // It is still not an ingredient, at either level.
      if(allIngredients(two).length!==2)
        throw new Error('a nested heading was counted as an ingredient: '+allIngredients(two).length);
    } },

  { id:'sub_editor_round_trip', group:'UI', name:'Sub-titles and indents survive the editor (v36.4)',
    test: async()=>{
      // v36.32 — OPEN THE EDITOR FIRST. This test drives a real mouse drag, and
      // a drag is decided entirely by getBoundingClientRect(). Inside a closed
      // modal every rect is 0×0 at 0,0, so every row's midpoint is identical,
      // no drop target is ever found, and the row is appended to the end it was
      // already at: the order does not change and the test reports that drag is
      // broken. It was not. It reported that on both of Tony's browsers while
      // passing in CI, because whether #editOverlay happened to be open came
      // down to which test ran before it.
      var overlayWasOpen = false;
      var ov = document.getElementById('editOverlay');
      if(!ov) throw new Error('#editOverlay is not in the page, so the ingredient editor cannot be tested');
      overlayWasOpen = ov.classList.contains('active') || ov.style.display==='flex';
      if(!overlayWasOpen){ ov.style.display='flex'; ov.classList.add('active'); }
      try{
      // The model can hold it; what matters is whether the EDITOR gives it back
      // unchanged. This is the round trip a real edit makes.
      var ings = [ { a:'1 Kg', n:'chicken breast' }, { sub:'Brine option #1' },
                   { sub:'How to prepare it', ind:1 },
                   { a:'1 litre', n:'water', ind:1 }, { a:'0.5 Kg', n:'pork chops' } ];
      loadIngsTable(ings);
      var rows = document.querySelectorAll('#ingsRows .ing-row');
      if(rows.length!==5) throw new Error('loaded '+rows.length+' rows for 5 lines');
      // A sub-sub-header must come back nested, not flattened to a plain heading.
      if(!rows[2].classList.contains('ing-row-sub'))
        throw new Error('the nested heading did not load as a heading row');
      if(!rows[2].classList.contains('ing-row-indent'))
        throw new Error('a sub-sub-header loaded as an ordinary sub-title — the nesting was lost');
      if(!rows[1].classList.contains('ing-row-sub')) throw new Error('the heading did not load as a heading row');
      if(rows[1].querySelectorAll('input').length!==1)
        throw new Error('a heading row has an Amount field - a heading is not a quantity of anything');
      if(!rows[3].classList.contains('ing-row-indent')) throw new Error('the indented row lost its indent');
      if(rows[4].classList.contains('ing-row-indent')) throw new Error('the row after it was indented too');
      if(!rows[0].querySelector('.ing-indent-btn')) throw new Error('no indent toggle on an ordinary row');
      // A heading needs the toggle too, or a sub-sub-header cannot be made.
      if(!rows[1].querySelector('.ing-indent-btn'))
        throw new Error('no indent toggle on a sub-title row — a sub-sub-header cannot be created');
      var subBtn = rows[1].querySelector('.ing-indent-btn');
      subBtn.onclick();
      var nested = readIngsTable()[1];
      if(!isSubLine(nested) || !nested.ind)
        throw new Error('indenting a sub-title did not make it a sub-sub-header: '+JSON.stringify(nested));
      subBtn.onclick();
      if(readIngsTable()[1].ind) throw new Error('a sub-sub-header could not be turned back');

      var back = readIngsTable();
      if(JSON.stringify(back)!==JSON.stringify(ings))
        throw new Error('the editor changed the list: in '+JSON.stringify(ings)+' out '+JSON.stringify(back));

      // A sub-title must be DRAGGABLE like any other row. v36.4 gave it a handle
      // and no listeners, which looks present and does nothing — Tony hit it the
      // first time he made one. Driving the real events is the only way to know:
      // the handle existing proves nothing.
      // Ordinary rows have been draggable since long before sub-titles and
      // nothing tested it, so extracting the drag wiring could have broken the
      // original feature while fixing the new one, silently.
      //
      // Drive a REAL drag. Checking a "wired" flag proves nothing: a mutation
      // that set the flag and wired no listeners passed happily.
      var host0 = document.getElementById('ingsRows');
      var ord = function(){ return Array.prototype.map.call(host0.querySelectorAll('.ing-row'), function(x){
        return x.classList.contains('ing-row-sub') ? 'SUB' : (x.querySelectorAll('input')[1]||{}).value; }).join('|'); };
      var dragRow = function(idx, toIdx){
        var rs = host0.querySelectorAll('.ing-row');
        var h = rs[idx].querySelector('.ing-handle');
        if(!h) throw new Error('row '+idx+' has no drag handle');
        h.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, clientY: rs[idx].getBoundingClientRect().top+5}));
        document.dispatchEvent(new MouseEvent('mousemove', {bubbles:true,
          clientY: host0.querySelectorAll('.ing-row')[toIdx].getBoundingClientRect().top+1}));
        document.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
      };
      // Say so plainly if the rows have no geometry, instead of blaming the drag.
      var probe = host0.querySelectorAll('.ing-row')[0].getBoundingClientRect();
      if(!probe.height)
        throw new Error('the ingredient rows have no height, so a drag cannot be measured — '
          + 'the editor is not on screen. This is the harness, not the drag.');
      var plainBefore = ord();
      dragRow(4, 0);
      if(ord()===plainBefore)
        throw new Error('an ordinary ingredient row is no longer draggable — order stayed '+plainBefore);
      loadIngsTable(ings);

      var subRow = document.querySelectorAll('#ingsRows .ing-row')[1];
      var subHandle = subRow.querySelector('.ing-handle');
      if(!subHandle) throw new Error('a sub-title row has no drag handle');
      if(!subHandle.__ingDragWired)
        throw new Error('the sub-title row\'s handle has no drag listeners — it looks draggable and is not');
      var beforeOrder = ord();
      dragRow(1, 0);
      if(ord()===beforeOrder)
        throw new Error('dragging a sub-title row did nothing — order stayed '+beforeOrder);
      if(ord().indexOf('SUB')!==0)
        throw new Error('the sub-title did not land where it was dropped: '+ord());
      // Put it back so the round-trip check below still means something.
      loadIngsTable(ings);
      rows = document.querySelectorAll('#ingsRows .ing-row');

      // The toggle is a toggle, both ways.
      var btn = rows[0].querySelector('.ing-indent-btn');
      btn.onclick(); if(!readIngsTable()[0].ind) throw new Error('the indent button did not indent');
      btn.onclick(); if(readIngsTable()[0].ind) throw new Error('the indent button did not outdent again');

      // And the method, which is a textarea: the buttons write the markers so
      // nothing has to be remembered, but the text form still round-trips.
      var steps = [ 'Trim the chicken', { sub:'If brining' }, { t:'Submerge overnight', ind:1 }, 'Roast at 200' ];
      var txt = stepsToText(steps);
      if(txt.split('\n')[1]!=='# If brining') throw new Error('a heading is not written as a marker line: '+txt.split('\n')[1]);
      if(!/^ {4}Submerge/.test(txt.split('\n')[2])) throw new Error('an indented step is not indented in the text');
      if(JSON.stringify(textToSteps(txt))!==JSON.stringify(steps))
        throw new Error('the method text did not round-trip: '+JSON.stringify(textToSteps(txt)));

      // The toolbar acts on the line the cursor is in, and toggles back.
      var ta = document.getElementById('f-steps'); var old = ta.value;
      try{
        ta.value = 'Boil water\nAdd salt\nServe';
        // Focus first, the way a person does by tapping the line. Without a
        // chosen line the buttons must REFUSE rather than pick one — v36.4
        // defaulted to the end of the text, so clicking "Sub-title" turned the
        // LAST line into a heading and Tony went back to typing "#" by hand.
        _stepCaret = null; ta.blur();
        if(stepToolSub()!==false) throw new Error('the button acted on a line nobody chose');
        if(ta.value.indexOf('#')!==-1) throw new Error('it edited a line anyway: '+ta.value);
        // Refusing focuses the box so the cursor is visible to place — which
        // means the NEXT press does have a line. Reset to test indent's refusal
        // on its own rather than the state the first refusal left behind.
        _stepCaret = null; ta.blur();
        if(stepToolIndent(1)!==false) throw new Error('indent acted on a line nobody chose');
        if(/^ /m.test(ta.value)) throw new Error('indent moved a line anyway: '+JSON.stringify(ta.value));

        ta.focus();
        ta.selectionStart = ta.selectionEnd = ta.value.indexOf('Add salt') + 2;
        stepToolSub();
        if(ta.value.split('\n')[1]!=='# Add salt') throw new Error('sub-title button gave: '+ta.value.split('\n')[1]);
        stepToolSub();
        if(ta.value.split('\n')[1]!=='Add salt') throw new Error('the sub-title button does not undo itself');
        stepToolIndent(1);
        if(ta.value.split('\n')[1]!=='    Add salt') throw new Error('indent gave: "'+ta.value.split('\n')[1]+'"');
        stepToolIndent(-1);
        if(ta.value.split('\n')[1]!=='Add salt') throw new Error('outdent gave: "'+ta.value.split('\n')[1]+'"');
        // A heading is never indented - it is the thing being indented under.
        stepToolSub(); stepToolIndent(1);
        if(ta.value.split('\n')[1]!=='# Add salt') throw new Error('a heading was indented');

        // The caret is remembered across losing focus, because clicking a
        // toolbar button is itself a focus change.
        ta.selectionStart = ta.selectionEnd = ta.value.indexOf('Boil') + 2;
        rememberStepCaret();
        ta.blur();
        stepToolSub();
        if(ta.value.split('\n')[0]!=='# Boil water')
          throw new Error('the remembered line was lost when focus moved: '+ta.value.split('\n')[0]);
      } finally { ta.value = old; loadIngsTable([]); }
      } finally {
        if(!overlayWasOpen){ ov.classList.remove('active'); ov.style.display=''; }
      }
    } },

  { id:'sub_every_consumer', group:'Import/Export', name:'Nothing downstream mistakes a sub-title for content (v36.4)',
    test: async()=>{
      // Twenty things read these lists. Each one either wants the content or
      // wants to draw the headings, and getting that backwards is silent:
      // Bring! would put "Brine option #1" on the shopping list.
      var testId=979101;
      var r = normalizeRecipe({ id:testId, uid:'sub-consumers', bg:'#fff', name:'Brined chicken',
        category:'Dinner', prep:'10 min', servings:'4',
        ingredients:[ {a:'1 Kg',n:'chicken breast'}, {sub:'Brine option #1'},
                      {sub:'How to prepare it',ind:1},
                      {a:'1 litre',n:'water',ind:1}, {a:'2 tbsp',n:'salt',ind:1} ],
        steps:[ 'Trim it', {sub:'If brining'}, {t:'Submerge overnight',ind:1}, 'Roast' ] });
      recipes.unshift(r);
      try{
        // Search / pantry / one-away read ingredient NAMES.
        var names = recipeIngredientNames(r);
        if(names.some(function(n){ return /brine option/i.test(n); }))
          throw new Error('a sub-title is being treated as an ingredient name by search');
        if(!names.some(function(n){ return /chicken breast/i.test(n); }))
          throw new Error('real ingredients stopped being searchable');

        // The card's own summary count.
        if(allIngredients(r).length!==3) throw new Error('the recipe claims '+allIngredients(r).length+' ingredients, not 3');

        // The recipe view: headings drawn, not tickable, numbering unaffected.
        viewId=testId; drawView();
        var modal=document.getElementById('viewModal');
        var subs=modal.querySelectorAll('.line-sub');
        if(subs.length!==3) throw new Error('drew '+subs.length+' headings, expected 3');
        if(modal.querySelector('.line-sub[data-line]')) throw new Error('a heading is tickable');
        var nums=Array.prototype.slice.call(modal.querySelectorAll('.step-num')).map(function(e){return e.textContent;});
        if(nums.join(',')!=='1,2,3')
          throw new Error('a heading took a step number - got '+nums.join(',')+', expected 1,2,3');
        if(!modal.querySelectorAll('.line-indent').length) throw new Error('nothing was drawn indented');
        // THE CLASS IS NOT THE BEHAVIOUR. v36.4 shipped with the ingredient
        // indent rendering as ZERO: `.ingredients-list li { padding: 5px 0 }`
        // is (0,1,1) and `.line-indent` was (0,1,0), so the shorthand won
        // whatever the order. The steps list sets no padding, so the identical
        // rule worked there — which is why a screenshot of one list looked
        // right while the other was broken. Measure the computed value.
        var padOf = function(sel){
          var e = modal.querySelector(sel);
          if(!e) throw new Error('no element for '+sel);
          return parseFloat(getComputedStyle(e).paddingInlineStart) || 0;
        };
        var ingInd = padOf('.ingredients-list li.line-indent');
        var ingFlat = padOf('.ingredients-list li:not(.line-indent):not(.line-sub)');
        if(!(ingInd > ingFlat + 8))
          throw new Error('an indented INGREDIENT is not actually indented: '+ingInd+'px vs '+ingFlat+'px');
        // A sub-sub-header must be visibly nested under its parent heading, not
        // drawn identically — measure it, do not trust the class.
        // NOT guarded by `if (found)`: the fixture has both levels, so a missing
        // one is the failure. A mutation that stopped emitting the nested class
        // slipped past the guarded version, because the check simply skipped.
        var subFlatEl = modal.querySelector('.ingredients-list li.line-sub:not(.line-sub-indent)');
        if(!subFlatEl) throw new Error('the outer heading is not in the view');
        var nestedEl = modal.querySelector('.ingredients-list li.line-sub-indent');
        if(!nestedEl) throw new Error('the sub-sub-header is not marked as nested in the view');
        var a1 = parseFloat(getComputedStyle(subFlatEl).paddingInlineStart)||0;
        var a2 = parseFloat(getComputedStyle(nestedEl).paddingInlineStart)||0;
        if(!(a2 > a1 + 8))
          throw new Error('a sub-sub-header is drawn at the same depth as its parent: '+a2+'px vs '+a1+'px');
        var stepInd = padOf('.steps-list li.line-indent');
        var stepFlat = padOf('.steps-list li:not(.line-indent):not(.line-sub)');
        if(!(stepInd > stepFlat + 8))
          throw new Error('an indented STEP is not actually indented: '+stepInd+'px vs '+stepFlat+'px');

        // Shared text and print are read by PEOPLE, so they keep the headings.
        var txt=rText(r);
        // Tony asked what this looks like in WhatsApp or email. Plain text has
        // no styling, so the heading has to stand out by POSITION: its own line,
        // a blank line before it, and no bullet — and the lines under it carry
        // real leading spaces.
        var tl = txt.split('\n');
        var hi = tl.indexOf('Brine option #1');
        if(hi===-1) throw new Error('the ingredient heading is not on a line of its own: '+txt);
        if(tl[hi-1].trim()!=='') throw new Error('no blank line before the heading, so it runs into the list');
        if(/^[\s]*\u2022/.test(tl[hi])) throw new Error('the heading was given a bullet, so it reads as an ingredient');
        // The first BULLET after the heading, not merely the next line: a
        // sub-sub-header can sit between them.
        var firstBullet = tl.slice(hi+1).filter(function(l){ return /\u2022/.test(l); })[0];
        if(!/^  \u2022 /.test(firstBullet||''))
          throw new Error('the line under the heading is not indented: '+JSON.stringify(firstBullet));
        if(txt.indexOf('Brine option #1')===-1) throw new Error('shared text dropped the ingredient heading');
        if(txt.indexOf('If brining')===-1) throw new Error('shared text dropped the method heading');
        if(/\[object Object\]/.test(txt)) throw new Error('shared text printed a raw object');
        if(!/3\. Roast/.test(txt)) throw new Error('shared text numbered the heading: '+txt);
        // The second level has to be visible where there is no styling at all.
        var nestedR = normalizeRecipe({ id:979102, uid:'nst', bg:'#fff', name:'Nested',
          ingredients:[ {sub:'Option 1'}, {sub:'How to prepare', ind:1}, {a:'1',n:'water',ind:1} ],
          steps:['go'] });
        var nt = rText(nestedR).split('\n');
        var oi = nt.indexOf('Option 1'), ni = nt.indexOf('  How to prepare');
        if(oi===-1) throw new Error('the outer heading is missing from shared text');
        if(ni===-1) throw new Error('a sub-sub-header is not indented in shared text: '+JSON.stringify(nt));
        if(ni<oi) throw new Error('the nested heading came out above its parent');

        var ph=buildPrintHtml([r]);
        if(ph.indexOf('Brine option #1')===-1) throw new Error('the printout dropped the heading');
        if(/\[object Object\]/.test(ph)) throw new Error('the printout has a raw object in it');

        // Word: it must still build, with the heading in it.
        var blob=makeDocxBlob([r]);
        if(!blob || blob.size<2000) throw new Error('the Word export produced nothing usable');

        // The previews used by import and translate.
        if(/\[object Object\]/.test(previewStepsHtml(r.steps)))
          throw new Error('the import preview prints a raw object for a sub-title');
        if(/\[object Object\]/.test(previewIngsHtml(r.ingredients)))
          throw new Error('the ingredient preview prints a raw object');

        // Translation must not lose the structure. The model answers with flat
        // lines in the same order; the shape is put back by position.
        var flat=['trim','if brining','submerge','roast'];
        var back=reapplyLineStructure(r.steps, flat);
        if(!isSubLine(back[1])) throw new Error('the heading came back as an ordinary step after translation');
        if(back[1].sub!=='if brining') throw new Error('the heading text was lost: '+back[1].sub);
        if(!lineIndented(back[2])) throw new Error('the indent was lost in translation');
        // A mismatch must DROP the structure, never stamp it on the wrong line.
        var wrong=reapplyLineStructure(r.steps, ['a','b']);
        if(wrong.some(isSubLine)) throw new Error('a heading was stamped onto a line that may not be one');
      } finally {
        recipes=recipes.filter(function(x){ return x.id!==testId; });
        viewId=null; closeM('viewOverlay');
      }
    } },

  { id:'feat_search_clear', group:'UI', name:'The search box can be cleared with one tap (v36.4)',
    test: async()=>{
      var inp=document.getElementById('searchInput'), btn=document.getElementById('searchClear');
      if(!btn) throw new Error('no clear button in the search box');
      if(typeof clearSearch!=='function') throw new Error('clearSearch not defined');
      var old=inp.value;
      try{
        // Nothing to clear, nothing to show: a permanent ✕ on an empty box is a
        // button that does nothing, on the narrowest control in the app.
        inp.value=''; syncSearchClear();
        if(btn.style.display!=='none') throw new Error('the ✕ is shown on an empty search box');
        inp.value='chicken'; syncSearchClear();
        if(btn.style.display==='none') throw new Error('the ✕ is hidden while there is something to clear');
        if(!btn.getAttribute('aria-label')) throw new Error('the ✕ has no accessible name');

        // It must clear AND re-render. Clearing the box but leaving the filtered
        // grid up reads as "these are all the recipes you have".
        var drew=0, realRender=window.renderGrid;
        window.renderGrid=function(){ drew++; };
        try { clearSearch(); } finally { window.renderGrid=realRender; }
        if(inp.value!=='') throw new Error('the box still holds "'+inp.value+'"');
        if(!drew) throw new Error('clearing did not re-render the grid');
        if(btn.style.display!=='none') throw new Error('the ✕ stayed visible after clearing');
        if(document.activeElement!==inp) throw new Error('focus left the box, so you cannot carry on typing');
        // Escape does the same thing, for anyone on a keyboard.
        if((inp.getAttribute('onkeydown')||'').indexOf('clearSearch')===-1)
          throw new Error('Escape does not clear the search box');
      } finally { inp.value=old; syncSearchClear(); }
    } },

  { id:'feat_refresh_foreground', group:'Cloud Sync', name:'Cloud re-checks when app returns to foreground',
    test: async()=>{
      if(typeof _lastVisibleRefresh==='undefined') throw new Error('_lastVisibleRefresh not defined — foreground refresh not wired up');
      if(typeof loadFromFirestore!=='function') throw new Error('loadFromFirestore not defined');
      // Just verify the throttle guard resets correctly; a full visibilitychange
      // integration (with a live _fbDb) is exercised manually, not in this harness.
      var before=_lastVisibleRefresh;
      _lastVisibleRefresh=0;
      if(_lastVisibleRefresh!==0) throw new Error('throttle variable not writable as expected');
      _lastVisibleRefresh=before;
    } },

  // ── UI plumbing ─────────────────────────────────────────────────────────────
  { id:'ui_dropdown_reopen', group:'UI', name:'A menu can be reopened right after picking an item',
    test: async()=>{
      if(typeof toggleDrop!=='function'||typeof closeDrop!=='function') throw new Error('toggleDrop/closeDrop not defined');
      var menu=document.getElementById('sortDrop'), btn=document.getElementById('sortBtn');
      if(!menu||!btn) throw new Error('#sortDrop / #sortBtn missing');
      try {
        toggleDrop('sortDrop');
        if(!menu.classList.contains('open')) throw new Error('menu did not open');
        await wait(20);
        closeDrop('sortDrop');                       // what every menu item does
        if(menu.classList.contains('open')) throw new Error('closeDrop did not close the menu');
        // Re-open the way a real click does: the click bubbles to document, where
        // a leftover outside-click listener used to close the menu again instantly.
        btn.click();
        await wait(30);
        if(!menu.classList.contains('open')) throw new Error('the menu closed itself again — a stale outside-click listener survived closeDrop()');
      } finally { closeDrop('sortDrop'); }
    } },
  { id:'ui_theme', group:'UI', name:'Dark mode: setting persists and stamps <html>',
    test: async()=>{
      if(typeof setTheme!=='function'||typeof effectiveTheme!=='function') throw new Error('setTheme/effectiveTheme not defined');
      if(!document.getElementById('themeModeItem')) throw new Error('the ⚙️ Settings menu has no Theme item');
      var prev=getTheme();
      try {
        setTheme('dark');
        if(document.documentElement.getAttribute('data-theme')!=='dark') throw new Error('data-theme was not set to dark');
        if(localStorage.getItem('tonys_theme')!=='dark') throw new Error('theme choice not persisted');
        var bg=getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim();
        if(!bg) throw new Error('--card-bg is not defined in dark mode');
        setTheme('light');
        if(document.documentElement.getAttribute('data-theme')!=='light') throw new Error('data-theme was not set to light');
        var bgL=getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim();
        if(bgL===bg) throw new Error('the dark palette is identical to the light one — the :root[data-theme="dark"] block is not applying');
        setTheme('auto');
        if(['light','dark'].indexOf(effectiveTheme())===-1) throw new Error('auto did not resolve to light or dark');
        if(document.getElementById('themeModeItem').textContent.indexOf('Auto')===-1) throw new Error('the Settings label does not reflect Auto');
      } finally { setTheme(prev); }
    } },
  { id:'feat_bring_status_honest', group:'Features', name:'Bring! never claims "expired" without asking the server',
    test: async()=>{
      if(typeof checkBringTokenStatus!=='function') throw new Error('checkBringTokenStatus not defined — the app is still trusting per-device localStorage');
      if(typeof renderBringTokenStatus!=='function') throw new Error('renderBringTokenStatus not defined');
      var el=document.getElementById('bringTokenStatus');
      if(!el) throw new Error('#bringTokenStatus missing');
      var prevStatus=_bringTokenStatus, prevExp=null;
      try { prevExp=localStorage.getItem('bring_token_expiry'); } catch(e) {}
      try {
        // A long-stale local expiry must NOT produce the word "expired" on its own.
        localStorage.setItem('bring_token_expiry', String(Math.floor(Date.now()/1000)-99999));
        _bringTokenStatus=null; renderBringTokenStatus();
        if(/\bexpired\b/i.test(el.textContent)) throw new Error('a stale localStorage expiry still makes the app assert the token is expired');
        // Only the server's answer may say so.
        _bringTokenStatus={configured:true,expired:true,valid:false,checkedAt:Date.now()};
        renderBringTokenStatus();
        if(!/expired/i.test(el.textContent)) throw new Error('when the server says expired, the app must say expired');
      } finally {
        _bringTokenStatus=prevStatus;
        try { if(prevExp===null) localStorage.removeItem('bring_token_expiry'); else localStorage.setItem('bring_token_expiry',prevExp); } catch(e) {}
        renderBringTokenStatus();
      }
    } },

  { id:'ui_match_why', group:'UI', name:'Search results explain why they matched',
    test: async()=>{
      if(typeof matchReason!=='function'||typeof hlMatch!=='function') throw new Error('matchReason/hlMatch not defined');
      var r={name:'Focaccia',category:'Dinner',ingredients:[{a:'2 tsp',n:'rosemary'}],steps:['Bake at 230C']};
      if(matchReason(r,'focaccia')!=='') throw new Error('a title match needs no explanation — the title already shows it');
      var ing=matchReason(r,'rosemary');
      if(ing.indexOf('<mark>rosemary</mark>')===-1) throw new Error('an ingredient match should be shown and highlighted, got: '+ing);
      var step=matchReason(r,'230c');
      if(step.indexOf('<mark>')===-1) throw new Error('a step match should be shown, got: '+step);
      // Highlighting must never let markup through.
      var evil=hlMatch('<img src=x onerror=alert(1)> pepper','pepper');
      if(evil.indexOf('<img')!==-1) throw new Error('hlMatch let raw HTML through — XSS via a recipe name');
      if(evil.indexOf('<mark>pepper</mark>')===-1) throw new Error('hlMatch did not highlight after escaping');
    } },
  { id:'ui_sync_indicator', group:'UI', name:'Cloud sync is visible while it runs',
    test: async()=>{
      if(typeof setSyncing!=='function') throw new Error('setSyncing not defined');
      var lbl=document.getElementById('sectionLabel');
      if(!lbl) throw new Error('#sectionLabel missing');
      try {
        setSyncing(true);
        if(!lbl.classList.contains('syncing')) throw new Error('the section label does not show a sync in progress');
        setSyncing(true); setSyncing(false);
        if(!lbl.classList.contains('syncing')) throw new Error('nested syncs must not clear the indicator early');
        setSyncing(false);
        if(lbl.classList.contains('syncing')) throw new Error('the indicator was not cleared when syncing finished');
        setSyncing(false);
        if(_syncDepth<0) throw new Error('the sync counter went negative');
      } finally { _syncDepth=0; lbl.classList.remove('syncing'); }
    } },
  { id:'ui_two_col', group:'UI', name:'Desktop recipe view splits ingredients and method',
    test: async()=>{
      if(!recipes.length) throw new Error('no recipes to open');
      openView(recipes[0].id);
      try {
        if(!document.querySelector('#viewOverlay .recipe-columns')) throw new Error('.recipe-columns wrapper missing from the recipe view');
        if(!document.querySelector('#viewOverlay .recipe-col-ings .ingredients-list')) throw new Error('ingredients are not inside .recipe-col-ings');
        if(!document.querySelector('#viewOverlay .recipe-col-steps .steps-list')) throw new Error('the method is not inside .recipe-col-steps');
      } finally { closeM('viewOverlay'); }
    } },
  { id:'ui_clip_badge', group:'UI', name:'Clip badge uses one consistent style',
    test: async()=>{
      var testId=888905;
      recipes.unshift(normalizeRecipe({id:testId,name:'ClipBadgeTest',isClip:true,updatedAt:Date.now()}));
      try {
        renderGrid();
        var g=document.getElementById('recipeGrid');
        if(!g.querySelector('.clip-badge')) throw new Error('no .clip-badge rendered for a clip');
        if(g.querySelector('.card-image svg')) throw new Error('an inline SVG badge is still being rendered alongside the emoji one');
      } finally { recipes=recipes.filter(function(r){return r.id!==testId;}); renderGrid(); }
    } },

  { id:'feat_ticks', group:'Features', name:'Tick-off boxes strike lines through, cleared on close',
    test: async()=>{
      ['toggleTick','clearTicks','applyTicks'].forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var testId=888915;
      recipes.unshift(normalizeRecipe({id:testId,name:'TickTest',servings:'4',
        ingredients:[{a:'100g',n:'flour'},{a:'2',n:'eggs'}],steps:['Mix','Bake'],updatedAt:Date.now()}));
      try {
        openView(testId); await wait(90);
        var boxes=document.querySelectorAll('#viewModal .tick-box');
        if(boxes.length!==4) throw new Error('expected a box on 2 ingredients + 2 steps, got '+boxes.length);
        var ing0=document.querySelector('#viewModal [data-line="ing-0"]');
        toggleTick('ing-0'); await wait(30);
        if(!ing0.classList.contains('ticked')) throw new Error('ticking did not mark the line');
        if(getComputedStyle(ing0.querySelector('.line-text')).textDecorationLine.indexOf('line-through')===-1)
          throw new Error('a ticked ingredient is not struck through');
        if(!ing0.querySelector('.tick-box').classList.contains('on')) throw new Error('the box does not show as ticked');
        toggleTick('ing-0'); await wait(30);
        if(ing0.classList.contains('ticked')) throw new Error('unticking did not clear the line');
        if(getComputedStyle(ing0.querySelector('.line-text')).textDecorationLine.indexOf('line-through')!==-1)
          throw new Error('unticking left the strike-through in place');
        // Ticking must not also move the line marker.
        clearLineMark(); toggleTick('step-1'); await wait(30);
        if(_lineMark) throw new Error('ticking a box also moved the line marker');
        // Ticks survive a re-render within the session...
        toggleTick('ing-1'); setMult(2); await wait(140);
        if(!document.querySelector('#viewModal [data-line="ing-1"]').classList.contains('ticked'))
          throw new Error('ticks were lost when the view re-rendered');
        // ...but must NOT survive closing the recipe.
        setMult(1); closeM('viewOverlay'); await wait(40);
        if(Object.keys(_ticks).length!==0) throw new Error('ticks survived closing the recipe — they are meant to be session-only');
        openView(testId); await wait(90);
        if(document.querySelectorAll('#viewModal .ticked').length!==0) throw new Error('reopening the recipe showed old ticks');
        // Nothing may be persisted.
        var dump=JSON.stringify(localStorage);
        if(dump.indexOf('"ing-0"')!==-1||dump.indexOf('tonys_ticks')!==-1) throw new Error('ticks were written to storage');
      } finally {
        closeM('viewOverlay'); _ticks={};
        recipes=recipes.filter(function(x){return x.id!==testId;}); saveData(); renderGrid();
      }
    } },
  { id:'feat_voice_safety', group:'Features', name:'Voice cannot lock the app up (iPhone freeze)',
    test: async()=>{
      if(typeof isIOS!=='function') throw new Error('isIOS not defined');
      var src=String(toggleVoice);
      // The freeze was a synchronous onend->start() loop. It must be deferred
      // AND bounded, or a failing engine spins the main thread.
      if(!/setTimeout/.test(src)) throw new Error('the restart is still synchronous — that is what froze the app');
      if(!/_voiceRestarts/.test(src)) throw new Error('there is no cap on restarts');
      if(!/_voiceWatchdog/.test(src)) throw new Error('there is no watchdog to switch listening off');
      // iOS defines the API but cannot honour it — the button must not appear.
      var ua=Object.getOwnPropertyDescriptor(Navigator.prototype,'userAgent');
      try {
        Object.defineProperty(navigator,'userAgent',{ value:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', configurable:true });
        if(isIOS()!==true) throw new Error('an iPhone user agent was not detected');
        if(voiceSupported()!==false) throw new Error('the voice button would still be offered on an iPhone, where it freezes the app');
      } finally {
        delete navigator.userAgent;
        if(ua) try { Object.defineProperty(Navigator.prototype,'userAgent',ua); } catch(e) {}
      }
      // Stopping must always be possible and must fully detach the engine.
      stopVoice();
      if(_voiceOn) throw new Error('stopVoice did not switch listening off');
      if(_voiceRec!==null) throw new Error('stopVoice left the recogniser attached');
    } },

  { id:'feat_versions', group:'Features', name:'Recipe versions: capped, restorable, reversible',
    test: async()=>{
      ['pushHistory','restoreVersion','historySnapshot'].forEach(function(f){ if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      var testId=888916;
      recipes.unshift(normalizeRecipe({id:testId,name:'V1',servings:'4',ingredients:[{a:'1',n:'a'}],steps:['one'],updatedAt:Date.now()}));
      var r=recipes.find(function(x){return x.id===testId;});
      try {
        if(r.history.length!==0) throw new Error('a new recipe should have no history');
        // Four edits, cap of three.
        for(var i=2;i<=5;i++){ pushHistory(r); r.name='V'+i; }
        if(r.history.length!==3) throw new Error('history was not capped at 3, got '+r.history.length);
        if(r.history[0].name!=='V4') throw new Error('history is not newest-first, got '+r.history[0].name);
        // A snapshot must stay flat: photos are huge and nested history would
        // recurse, and each recipe document still has its own 1 MiB ceiling.
        var snap=historySnapshot(r);
        if('photo' in snap||'history' in snap||'originalPhoto' in snap) throw new Error('a snapshot carries photo/history data and would bloat the recipe document');
        // v32.3 — history DOES reach the cloud, in the per-recipe document. The
        // old assertion here was the opposite, and correct only while the legacy
        // single document existed.
        var slim=slimRecipeForCloud(r);
        if(!('history' in slim)) throw new Error('history is not being synced — a device restoring from the cloud would lose every previous version');
        if('photo' in slim && slim.photo!=='') throw new Error('the per-recipe document still carries photo data');
        // Editing through the real save path records the previous version.
        openAddModal(testId); await wait(60);
        document.getElementById('f-name').value='Edited name';
        await saveRecipe(); await wait(60);
        r=recipes.find(function(x){return x.id===testId;});
        if(r.name!=='Edited name') throw new Error('the edit did not save');
        if(r.history[0].name!=='V5') throw new Error('saving did not push the previous version, got '+r.history[0].name);
        // Restoring is itself reversible.
        var before=r.name;
        var p=restoreVersion(testId,0); await wait(80);
        var ok=document.querySelector('#askOverlay #askOk');
        if(!ok) throw new Error('restore did not confirm first');
        ok.click(); await p; await wait(40);
        r=recipes.find(function(x){return x.id===testId;});
        if(r.name!=='V5') throw new Error('restore did not apply, name is '+r.name);
        if(r.history[0].name!==before) throw new Error('restoring did not keep the replaced version — it would be a one-way door');
        // A malformed history must not crash normalisation.
        var junk=normalizeRecipe({id:1,history:[null,'nope',{name:'ok',at:1,ingredients:[],steps:[]}]});
        if(junk.history.length!==1) throw new Error('malformed history entries were not filtered out');
      } finally {
        var a=document.getElementById('askOverlay'); if(a) a.remove();
        _editFormSnapshot=null; document.getElementById('editOverlay').classList.remove('open');
        recipes=recipes.filter(function(x){return x.id!==testId;}); saveData(); renderGrid();
      }
    } },
  { id:'feat_pantry', group:'Features', name:'Pantry ranks recipes by what you would need to buy',
    test: async()=>{
      ['getPantry','setPantry','haveIngredient','missingFor','openWhatCanIMake'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined'); });
      if(!document.getElementById('pantryOverlay')) throw new Error('#pantryOverlay missing');
      if(!document.getElementById('wcimOverlay')) throw new Error('#wcimOverlay missing');
      var saved=null; try{ saved=localStorage.getItem('tonys_pantry'); }catch(e){}
      var testId=888917;
      recipes.unshift(normalizeRecipe({id:testId,name:'PantryTest',
        ingredients:[{a:'1',n:'good olive oil'},{a:'2',n:'eggs'},{a:'1',n:'saffron threads'}],steps:['s'],updatedAt:Date.now()}));
      try {
        setPantry(['olive oil','eggs','flour']);
        if(getPantry().length!==3) throw new Error('the pantry did not persist');
        // Loose matching both ways — a staple should cover a more specific name.
        if(!haveIngredient('good olive oil',['olive oil'])) throw new Error('"olive oil" should cover "good olive oil"');
        if(!haveIngredient('שמן',['שמן זית'])) throw new Error('Hebrew substring matching failed');
        if(haveIngredient('saffron',['olive oil'])) throw new Error('an unrelated item was treated as present');
        var r=recipes.find(function(x){return x.id===testId;});
        var miss=missingFor(r,getPantry());
        if(miss.length!==1||miss[0]!=='saffron threads') throw new Error('expected only saffron missing, got '+JSON.stringify(miss));
        openWhatCanIMake(); await wait(60);
        var body=document.getElementById('wcimBody').textContent;
        if(body.indexOf('PantryTest')===-1) throw new Error('the recipe was not listed');
        if(body.indexOf('saffron threads')===-1) throw new Error('the missing item was not named');
        closeM('wcimOverlay');
        // An empty pantry must explain itself, not show an empty list.
        setPantry([]); openWhatCanIMake(); await wait(60);
        if(document.getElementById('wcimBody').textContent.indexOf('pantry is empty')===-1) throw new Error('an empty pantry should say so and offer to set one up');
        closeM('wcimOverlay');
      } finally {
        closeM('wcimOverlay'); closeM('pantryOverlay');
        try{ if(saved===null) localStorage.removeItem('tonys_pantry'); else localStorage.setItem('tonys_pantry',saved); }catch(e){}
        recipes=recipes.filter(function(x){return x.id!==testId;}); renderGrid();
      }
    } },
  { id:'feat_share_page', group:'Features', name:'Recipe exports as a self-contained web page',
    test: async()=>{
      if(typeof buildRecipePage!=='function') throw new Error('buildRecipePage not defined');
      if(!document.getElementById('sharePageBtn')) throw new Error('#sharePageBtn missing from the share sheet');
      var r=normalizeRecipe({id:1,name:'עוגת שוקולד <b>test</b>',category:'Dessert',difficulty:'Easy',prep:'1 hr',servings:'8',
        ingredients:[{a:'200g',n:'flour'}],steps:['Mix & bake'],notes:'note here',updatedAt:Date.now()});
      var html=buildRecipePage(r);
      var doc=new DOMParser().parseFromString(html,'text/html');
      if(!doc.querySelector('h1')) throw new Error('the page has no title');
      if(doc.querySelector('h1 b')) throw new Error('recipe text was injected as raw HTML into the shared page');
      if(doc.querySelector('h1').textContent.indexOf('עוגת')===-1) throw new Error('the Hebrew name did not survive');
      if(!(doc.body.textContent||'').match(/flour/)) throw new Error('ingredients are missing');
      if(!(doc.body.textContent||'').match(/Mix & bake/)) throw new Error('steps are missing');
      // Self-contained: no scripts, and nothing fetched from anywhere.
      if(doc.querySelector('script')) throw new Error('the shared page contains script — it must be inert');
      if(/https?:\/\//.test(html.replace(/Source:[^<]*/g,''))) throw new Error('the page references an external URL — it must work offline forever');
      if(!/unicode-bidi\s*:\s*plaintext/.test(html)) throw new Error('the page has no bidi handling — mixed Hebrew/English would misalign');
    } },

  // ── Batch E ─────────────────────────────────────────────────────────────────
  { id:'ui_styled_dialogs', group:'UI', name:'Styled confirm/prompt replace the native ones',
    test: async()=>{
      if(typeof askConfirm!=='function'||typeof askPrompt!=='function') throw new Error('askConfirm/askPrompt not defined');
      // Only the last-ditch fallback inside showUnsavedChanges may still use confirm().
      var src=String(deleteRecipe)+String(deleteSelected)+String(signOut)+String(backupRestore)+String(clearAllData);
      if(/[^.\w]confirm\s*\(/.test(src)) throw new Error('a native confirm() is still in use in a converted function');
      var p=askConfirm({ title:'T', message:'M', okLabel:'Yes' });
      await wait(60);
      var ov=document.getElementById('askOverlay');
      if(!ov) throw new Error('the dialog did not appear');
      if(ov.textContent.indexOf('Yes')===-1) throw new Error('the custom OK label was not used');
      ov.querySelector('#askCancel').click();
      if(await p!==false) throw new Error('Cancel should resolve false');
      if(document.getElementById('askOverlay')) throw new Error('the dialog was not removed');
      // Accepting resolves true.
      var p2=askConfirm('just a message'); await wait(60);
      document.querySelector('#askOverlay #askOk').click();
      if(await p2!==true) throw new Error('OK should resolve true');
      // A prompt returns its text, and null when cancelled.
      var p3=askPrompt('Enter it','seed'); await wait(60);
      var inp=document.querySelector('#askOverlay #askInput');
      if(!inp) throw new Error('askPrompt rendered no input');
      if(inp.value!=='seed') throw new Error('the initial value was not filled in');
      inp.value='typed'; document.querySelector('#askOverlay #askOk').click();
      if(await p3!=='typed') throw new Error('askPrompt did not return the typed value');
      var p4=askPrompt('Enter it',''); await wait(60);
      document.querySelector('#askOverlay #askCancel').click();
      if(await p4!==null) throw new Error('a cancelled prompt must resolve null, not an empty string');
      // Message text must be escaped, never injected.
      var p5=askConfirm({ message:'<img src=x onerror=alert(1)>' }); await wait(60);
      if(document.querySelector('#askOverlay img')) throw new Error('dialog text was injected as raw HTML');
      document.querySelector('#askOverlay #askOk').click(); await p5;
    } },
  { id:'feat_voice', group:'Features', name:'Voice commands move the line marker',
    test: async()=>{
      ['toggleVoice','handleVoiceCommand','voiceSupported','moveMark'].forEach(function(f){
        if(typeof window[f]!=='function') throw new Error(f+' not defined');
      });
      var testId=888914;
      recipes.unshift(normalizeRecipe({id:testId,name:'VoiceTest',ingredients:[{a:'1',n:'a'},{a:'2',n:'b'}],
        steps:['One','Two','Three'],updatedAt:Date.now()}));
      var savedMark=null; try{ savedMark=localStorage.getItem('tonys_linemark'); }catch(e){}
      try {
        openView(testId); await wait(90);
        markLine('step',0); await wait(40);
        if(handleVoiceCommand('next')!=='next') throw new Error('"next" was not recognised');
        if(_lineMark.idx!==1) throw new Error('"next" did not advance the marker, idx='+_lineMark.idx);
        handleVoiceCommand('go back');
        if(_lineMark.idx!==0) throw new Error('"go back" did not step back');
        handleVoiceCommand('back');   // already at the first line
        if(_lineMark.idx!==0) throw new Error('the marker went past the first line');
        handleVoiceCommand('next'); handleVoiceCommand('next'); handleVoiceCommand('next'); handleVoiceCommand('next');
        if(_lineMark.idx!==2) throw new Error('the marker went past the last step, idx='+_lineMark.idx);
        if(handleVoiceCommand('ingredients')!=='ingredients') throw new Error('"ingredients" was not recognised');
        if(_lineMark.list!=='ing') throw new Error('"ingredients" did not jump to the ingredient list');
        if(handleVoiceCommand('הבא')!=='next') throw new Error('the Hebrew "next" was not recognised');
        if(handleVoiceCommand('clear')!=='clear') throw new Error('"clear" was not recognised');
        if(_lineMark!==null) throw new Error('"clear" did not clear the marker');
        if(handleVoiceCommand('what is the weather')!==null) throw new Error('an unrelated phrase must not be treated as a command');
        // Voice must never be able to change the data.
        var vsrc=String(handleVoiceCommand);
        ['deleteRecipe','saveRecipe','clearAllData','deleteSelected'].forEach(function(bad){
          if(vsrc.indexOf(bad)!==-1) throw new Error('voice commands can reach '+bad+' — a misheard word must not be able to change data');
        });
      } finally {
        closeM('viewOverlay'); stopVoice();
        try{ if(savedMark===null) localStorage.removeItem('tonys_linemark'); else localStorage.setItem('tonys_linemark',savedMark); }catch(e){}
        recipes=recipes.filter(function(x){return x.id!==testId;}); renderGrid();
      }
    } },

  // ── Batch D ─────────────────────────────────────────────────────────────────
  { id:'form_ings_single_source', group:'CRUD', name:'Ingredient table is the single source of truth',
    test: async()=>{
      if(typeof readIngsTable!=='function') throw new Error('readIngsTable not defined');
      if(document.getElementById('f-ings')) throw new Error('the hidden ingredients textarea is still present — 2.2 was about removing that second copy');
      var testId=888910;
      // A name containing a dash used to be mangled by the flatten-and-reparse round trip.
      recipes.unshift(normalizeRecipe({id:testId,name:'DashTest',servings:'4',
        ingredients:[{a:'200g',n:'self-raising flour'},{a:'',n:'salt - to taste'},{a:'2',n:'eggs'}],
        steps:['s'],updatedAt:Date.now()}));
      try {
        openAddModal(testId); await wait(60);
        var read=readIngsTable();
        if(read.length!==3) throw new Error('expected 3 rows, got '+read.length);
        if(read[0].a!=='200g'||read[0].n!=='self-raising flour') throw new Error('a hyphenated ingredient name was mangled: '+JSON.stringify(read[0]));
        if(read[1].n!=='salt - to taste') throw new Error('an ingredient containing " - " was mangled: '+JSON.stringify(read[1]));
        // Editing a cell must be picked up without any sync step.
        document.querySelectorAll('#ingsRows .ing-row')[2].querySelectorAll('input')[0].value='3';
        if(readIngsTable()[2].a!=='3') throw new Error('an edited cell was not read back');
        // ...and must register as an unsaved change.
        if(!editFormIsDirty()) throw new Error('editing an ingredient is not detected as an unsaved change');
        await saveRecipe();
        var saved=recipes.find(function(x){return x.id===testId;});
        if(saved.ingredients[0].n!=='self-raising flour') throw new Error('the dash-containing name did not survive saving: '+JSON.stringify(saved.ingredients[0]));
        if(saved.ingredients[1].n!=='salt - to taste') throw new Error('" - " in a name did not survive saving: '+JSON.stringify(saved.ingredients[1]));
        if(saved.ingredients[2].a!=='3') throw new Error('the edited amount was not saved');
      } finally {
        _editFormSnapshot=null; document.getElementById('editOverlay').classList.remove('open');
        recipes=recipes.filter(function(x){return x.id!==testId;}); saveData(); renderGrid();
      }
    } },
  { id:'stor_rules_repo', group:'Storage', name:'Firestore rules come from firestore.rules',
    test: async()=>{
      if(typeof fetchRulesTemplate!=='function') throw new Error('fetchRulesTemplate not defined');
      if(typeof FIRESTORE_RULES_FALLBACK!=='string') throw new Error('FIRESTORE_RULES_FALLBACK not defined');
      ['{{READ}}','{{WRITE}}','{{ADMIN}}'].forEach(function(ph){
        if(FIRESTORE_RULES_FALLBACK.indexOf(ph)===-1) throw new Error('the fallback template has no '+ph+' placeholder');
      });
      if(FIRESTORE_RULES_FALLBACK.indexOf('FALLBACK COPY')===-1)
        throw new Error('the fallback must say it is a fallback — silently passing it off as current is how rules drift');
      var tpl=await fetchRulesTemplate();
      if(tpl.indexOf('{{READ}}')===-1) throw new Error('the fetched template has no {{READ}} placeholder');
      // Substitution must leave no placeholder behind.
      // Globally, as the app does (showAccessRules): the v36.59 rules use
      // {{ADMIN}} twice, and a first-occurrence replace left the second behind.
      var filled=tpl.replace(/\{\{READ\}\}/g,'"a@b.c"').replace(/\{\{WRITE\}\}/g,'"a@b.c"').replace(/\{\{ADMIN\}\}/g,'"a@b.c"');
      if(/\{\{[A-Z]+\}\}/.test(filled)) throw new Error('a placeholder survived substitution: '+(filled.match(/\{\{[A-Z]+\}\}/)||[])[0]);
      if(filled.indexOf('rules_version')===-1) throw new Error('the rules lost their version header');
    } },
  { id:'perf_thumbnails', group:'Performance', name:'Grid uses small thumbnails, not full photos',
    test: async()=>{
      if(typeof thumbSrc!=='function'||typeof makeThumbBlob!=='function') throw new Error('thumbSrc/makeThumbBlob not defined');
      if(!_idbAvailable) throw new Error('IndexedDB unavailable — thumbnails cannot be stored');
      // A deliberately oversized image: 1200x900 of noise, so it cannot compress to nothing.
      var c=document.createElement('canvas'); c.width=1200; c.height=900;
      var ctx=c.getContext('2d'), img=ctx.createImageData(1200,900);
      for(var i=0;i<img.data.length;i+=4){ img.data[i]=(i*7)%255; img.data[i+1]=(i*13)%255; img.data[i+2]=(i*29)%255; img.data[i+3]=255; }
      ctx.putImageData(img,0,0);
      var full=c.toDataURL('image/jpeg',0.92);
      var blob=await makeThumbBlob(full);
      if(!blob) throw new Error('no thumbnail was produced');
      if(blob.size>=full.length) throw new Error('the thumbnail ('+blob.size+' B) is not smaller than the full photo ('+full.length+' B)');
      if(blob.size>60000) throw new Error('the thumbnail is suspiciously large: '+blob.size+' B');
      if(blob.type!=='image/jpeg') throw new Error('expected a JPEG thumbnail, got '+blob.type);
      // It must actually be a valid image of the right size.
      var url=URL.createObjectURL(blob);
      try {
        var dims=await new Promise(function(res,rej){ var im=new Image(); im.onload=function(){res({w:im.naturalWidth,h:im.naturalHeight});}; im.onerror=function(){rej(new Error('the thumbnail is not a decodable image'));}; im.src=url; });
        if(Math.max(dims.w,dims.h)>THUMB_MAX) throw new Error('the thumbnail exceeds THUMB_MAX: '+dims.w+'x'+dims.h);
        if(Math.abs(dims.w/dims.h-1200/900)>0.02) throw new Error('the thumbnail lost the aspect ratio: '+dims.w+'x'+dims.h);
      } finally { URL.revokeObjectURL(url); }
      // 5.2 — stored as a real Blob, not a base64 string.
      var testId=888911;
      recipes.unshift(normalizeRecipe({id:testId,name:'ThumbTest',photo:full,updatedAt:Date.now()}));
      try {
        var r=recipes.find(function(x){return x.id===testId;});
        await ensureThumb(r);
        var row=await idbGet(testId);
        if(!row||!row.thumb) throw new Error('the thumbnail was not stored in IndexedDB');
        if(typeof row.thumb==='string') throw new Error('the thumbnail was stored as a string — 5.2 is about storing binary');
        if(!(row.thumb instanceof Blob)) throw new Error('the stored thumbnail is not a Blob');
        // A photoless recipe must never claim a thumbnail.
        if(thumbSrc({id:999,photo:''})!=='') throw new Error('a recipe with no photo returned a thumbnail source');
        // The grid must fall back to the full photo rather than showing nothing.
        var fresh=thumbSrc({id:888912,photo:full});
        if(!fresh) throw new Error('with no thumbnail yet, the grid must fall back to the full photo, not to nothing');
      } finally {
        releaseThumb(testId);
        try { await idbDelete(testId); } catch(e) {}
        recipes=recipes.filter(function(x){return x.id!==testId;}); renderGrid();
      }
    } },

  // ── Batch C ─────────────────────────────────────────────────────────────────
  { id:'feat_scale_servings', group:'Features', name:'Scale by target servings (alongside ×N)',
    test: async()=>{
      if(typeof setServings!=='function'||typeof parseServings!=='function') throw new Error('setServings/parseServings not defined');
      if(parseServings('4')!==4) throw new Error('plain "4" should parse to 4');
      if(parseServings('6 servings')!==6) throw new Error('"6 servings" should parse to 6');
      if(parseServings('4-6')!==4) throw new Error('"4-6" should take the first number');
      if(parseServings('—')!==null) throw new Error('"—" has no number and must return null, not a broken control');
      if(parseServings('0')!==null) throw new Error('zero servings must not become a divisor');
      var testId=888908;
      recipes.unshift(normalizeRecipe({id:testId,name:'ServTest',servings:'4',ingredients:[{a:'200g',n:'flour'},{a:'2',n:'eggs'}],steps:['s'],updatedAt:Date.now()}));
      var prevView=viewId, prevMult=viewMult, prevUnitPref=null;
      // Metric on purpose, and put back afterwards: since v36.51 the unit is
      // remembered per device, and on Tony's Imperial phone this test read
      // "3.5 oz" where it expected 100g — while passing in CI, where nothing
      // is remembered. runSelfTests parks the preference too; this covers the
      // headless runner, which calls each test directly.
      try{ prevUnitPref=localStorage.getItem(VIEW_UNIT_KEY); localStorage.removeItem(VIEW_UNIT_KEY); }catch(e){}
      try {
        openView(testId); await wait(60);
        if(viewUnit!=='metric') throw new Error('the view did not open in metric with no preference stored');
        setServings(8);
        if(Math.abs(viewMult-2)>0.001) throw new Error('8 servings from a base of 4 should be ×2, got '+viewMult);
        // The ×N buttons must still be there — this is an addition, not a
        // replacement. v36.30 added ×0.5 at the front, so the count is 7 and
        // halving is asserted by name: a bare count would pass if ×0.5 were
        // swapped for a ×7 nobody asked for.
        var multBtns = Array.prototype.map.call(
          document.querySelectorAll('#viewModal .mult-btn'), function(b){ return b.textContent.trim(); });
        if(multBtns.length!==7)
          throw new Error('expected ×0.5 plus ×1–×6, got '+multBtns.length+': '+multBtns.join(' '));
        ['×0.5','×1','×2','×3','×4','×5','×6'].forEach(function(want){
          if(multBtns.indexOf(want)===-1) throw new Error(want+' is missing: '+multBtns.join(' '));
        });
        if(multBtns[0]!=='×0.5') throw new Error('×0.5 should come first, before ×1: '+multBtns.join(' '));
        if(!document.querySelector('#viewModal .serv-input')) throw new Error('the servings control is missing');
        // Halving has to produce halved amounts, not just a pressed button.
        setMult(0.5);
        if(Math.abs(viewMult-0.5)>0.001) throw new Error('×0.5 did not take, viewMult is '+viewMult);
        var halved=Array.prototype.map.call(document.querySelectorAll('#viewModal .ing-amount'),
          function(e){return e.textContent;}).join(' ');
        if(halved.indexOf('100g')===-1)
          throw new Error('200g at ×0.5 should read 100g, got: '+halved);
        if(halved.indexOf('1 ')===-1 && halved.indexOf('1') === -1)
          throw new Error('2 eggs at ×0.5 should read 1, got: '+halved);

        setServings(6);   // ×1.5 — the fractional case
        if(Math.abs(viewMult-1.5)>0.001) throw new Error('6 from 4 should be ×1.5, got '+viewMult);
        var amounts=Array.prototype.map.call(document.querySelectorAll('#viewModal .ing-amount'),function(e){return e.textContent;});
        if(amounts.join(' ').indexOf('300g')===-1) throw new Error('200g ×1.5 should read 300g, got: '+amounts.join(' / '));
        // "3 eggs" is fine; the warning is for when it isn't a whole number.
        setServings(5);   // ×1.25 → 2.5 eggs
        if(!document.querySelector('#viewModal .scale-warning')) throw new Error('a fractional egg count should be flagged, not shown as "2.5 eggs" silently');
        // A recipe with no serving number must not get a broken control.
        setMult(1); closeM('viewOverlay');
        recipes.find(function(x){return x.id===testId;}).servings='—';
        openView(testId); await wait(60);
        if(document.querySelector('#viewModal .serv-input')) throw new Error('a recipe with no serving count must not show the servings control');
      } finally {
        closeM('viewOverlay'); recipes=recipes.filter(function(x){return x.id!==testId;});
        try{localStorage.removeItem('scale_'+testId);}catch(e){}
        try{ if(prevUnitPref!==null) localStorage.setItem(VIEW_UNIT_KEY,prevUnitPref); }catch(e){}
        viewId=prevView; viewMult=prevMult; saveData(); renderGrid();
      }
    } },
  { id:'feat_amount_rounding', group:'Features', name:'Scaled amounts round to measurable values',
    test: async()=>{
      if(typeof fmtAmt!=='function') throw new Error('fmtAmt not defined');
      if(fmtAmt(266.666)!=='265') throw new Error('large amounts should round to the nearest 5, got '+fmtAmt(266.666));
      if(fmtAmt(33.33)!=='33') throw new Error('mid amounts should round to a whole number, got '+fmtAmt(33.33));
      if(fmtAmt(2.4)!=='2.5') throw new Error('small amounts should round to the nearest half, got '+fmtAmt(2.4));
      if(fmtAmt(4)!=='4') throw new Error('whole numbers must pass through untouched, got '+fmtAmt(4));
      if(scaleAmt('200g',1.5)!=='300g') throw new Error('scaleAmt lost the unit or mis-rounded: '+scaleAmt('200g',1.5));
      if(!awkwardCount('eggs','2.5')) throw new Error('2.5 eggs should be flagged as awkward');
      if(awkwardCount('eggs','3')) throw new Error('3 eggs is a whole number and must not be flagged');
      if(awkwardCount('flour','250')) throw new Error('flour is not a countable item');
      if(awkwardCount('eggs','2.5 kg')) throw new Error('an amount with a unit is measurable and must not be flagged');
    } },
  { id:'feat_ai_cache', group:'Features', name:'AI answers are cached, failures are not',
    test: async()=>{
      if(typeof aiCacheKey!=='function'||typeof aiCacheGet!=='function'||typeof aiCachePut!=='function')
        throw new Error('AI cache functions not defined');
      var k1=aiCacheKey('hello world',2000), k2=aiCacheKey('hello world',2000), k3=aiCacheKey('hello worlds',2000);
      if(k1!==k2) throw new Error('the same prompt must produce the same key');
      if(k1===k3) throw new Error('different prompts must not collide');
      if(aiCacheKey('hello world',2000)===aiCacheKey('hello world',3000)) throw new Error('the token budget must be part of the key');
      var parked=_aiCacheParkForTest();
      try {
        if(aiCacheGet(k1)!==null) throw new Error('an empty cache must miss');
        aiCachePut(k1,'the answer');
        if(aiCacheGet(k1)!=='the answer') throw new Error('a stored answer was not returned');
        // Expiry is honoured.
        aiCacheRead()[k1].at=Date.now()-(AI_CACHE_TTL+60000);   // just past it, whatever it is
        if(aiCacheGet(k1)!==null) throw new Error('an entry older than the TTL must not be served');
        // The cache is capped so it can never crowd out the recipes.
        for(var i=0;i<AI_CACHE_MAX+10;i++) aiCachePut(aiCacheKey('p'+i,2000),'v'+i);
        var n=Object.keys(aiCacheRead()).length;
        if(n>AI_CACHE_MAX) throw new Error('the cache grew past its cap: '+n+' entries, max '+AI_CACHE_MAX);
      } finally { _aiCacheRestoreForTest(parked); }

      // IT LIVES IN INDEXEDDB (v36.61), not in the ~5-million-character
      // localStorage budget it used to share with the recipes. The move merges
      // rather than replaces, and only drops the old copy once the new one holds.
      if(typeof aiCacheInit!=='function'||typeof kvGet!=='function') throw new Error('aiCacheInit/kvGet not defined');
      var parked2=_aiCacheParkForTest(), prevIdb=await kvGet('ai_cache');
      try{
        var old={}; old['legacy-key']={ v:'from before', at:Date.now() };
        localStorage.setItem(AI_CACHE_KEY, JSON.stringify(old));
        _aiCacheMem=null;
        await kvPut('ai_cache', { 'idb-key':{ v:'already moved', at:Date.now() } });
        var ok=await aiCacheInit();
        if(!ok) throw new Error('the AI cache could not move to IndexedDB');
        if(localStorage.getItem(AI_CACHE_KEY)!==null) throw new Error('the old localStorage copy was left behind');
        var inIdb=await kvGet('ai_cache')||{};
        if(!inIdb['legacy-key']||!inIdb['idb-key'])
          throw new Error('the move lost entries: '+JSON.stringify(Object.keys(inIdb)));
        if(aiCacheGet('legacy-key')!=='from before') throw new Error('a moved answer is not served');
      } finally {
        await kvPut('ai_cache', prevIdb||{});
        _aiCacheRestoreForTest(parked2);
      }
    } },
  { id:'feat_ai_error_states', group:'Features', name:'AI failures offer a way forward',
    test: async()=>{
      if(typeof aiFailPane!=='function'||typeof aiEmptyPane!=='function') throw new Error('aiFailPane/aiEmptyPane not defined');
      if(typeof closeAllModalsThenFreehand!=='function') throw new Error('closeAllModalsThenFreehand not defined');
      var billing=aiFailPane(new Error('BILLING: credits gone'),'runExplore');
      if(billing.indexOf('console.anthropic.com/settings/billing')===-1) throw new Error('a billing failure should link to billing');
      if(/BILLING:/.test(billing)) throw new Error('the raw error prefix leaked into the UI');
      var key=aiFailPane(new Error('API_KEY: bad key'),'runExplore');
      if(key.indexOf('settings/keys')===-1) throw new Error('a key failure should link to the keys page');
      var net=aiFailPane(new Error('Failed to fetch'),'runExplore');
      if(net.indexOf('runExplore()')===-1) throw new Error('a network failure should offer a retry');
      // Every pane must offer the manual route out.
      [billing,key,net,aiEmptyPane('ideas','runSuggest')].forEach(function(h,i){
        if(h.indexOf('closeAllModalsThenFreehand')===-1) throw new Error('pane '+i+' offers no free-hand fallback — that is the dead end 2.5 was about');
      });
      // Error text must be escaped, not injected.
      var evil=aiFailPane(new Error('<img src=x onerror=alert(1)>'),null);
      if(evil.indexOf('<img')!==-1) throw new Error('an error message was injected as raw HTML');
      // The free-hand importer must actually exist for that button to work.
      if(!document.getElementById('freehandText')) throw new Error('#freehandText missing — the fallback button would open an empty box');
    } },

  // ── WhatsApp groups (3.9) ───────────────────────────────────────────────────
  { id:'wa_parse', group:'WhatsApp', name:'Exported chats parse (iOS + Android formats)',
    test: async()=>{
      if(typeof waParse!=='function') throw new Error('waParse not defined');
      var ios='‎[16/04/2024, 21:03:12] Tony: How long do you proof challah?\n'
            + '[16/04/2024, 21:05:00] Dana: I give it 90 minutes, covered.\nIt doubles by then.\n'
            + '[16/04/2024, 21:06:00] Dana: ‎<Media omitted>\n';
      var m=waParse(ios,'Baking');
      if(m.length!==2) throw new Error('expected 2 iOS messages (media line dropped), got '+m.length);
      if(m[0].who!=='Tony') throw new Error('author not parsed, got "'+m[0].who+'"');
      if(m[1].text.indexOf('doubles by then')===-1) throw new Error('multi-line continuation was lost');
      if(m[0].group!=='Baking') throw new Error('group label not attached');
      var andr='16/04/2024, 21:03 - Tony: What oven temperature for focaccia?\n'
             + '16/04/2024, 21:04 - Dana: 230C for 20 minutes on a hot tray.\n';
      var a=waParse(andr,'Cooking');
      if(a.length!==2) throw new Error('expected 2 Android messages, got '+a.length);
      if(a[1].text.indexOf('230C')===-1) throw new Error('Android message text not parsed');
      // Hebrew must survive intact.
      var heb='[16/04/2024, 21:03:12] דנה: כמה מלח שמים בבצק לחלה?\n';
      var h=waParse(heb,'אוכל');
      if(h.length!==1||h[0].text.indexOf('מלח')===-1) throw new Error('Hebrew message did not survive parsing');
    } },
  { id:'wa_zip', group:'WhatsApp', name:'Zipped exports are read without unpacking by hand',
    test: async()=>{
      if(typeof waTextFromBuffer!=='function'||typeof waIsZip!=='function') throw new Error('waTextFromBuffer/waIsZip not defined');
      if(typeof CompressionStream==='undefined') throw new Error('CompressionStream unavailable — cannot build the fixture in this browser');
      var body='[16/04/2024, 21:03:12] Tony: zipped message about focaccia at 230C\n';
      var raw=new TextEncoder().encode(body);
      // Build a real deflate-compressed zip so the test exercises the same path
      // a WhatsApp export does, rather than a stored-only shortcut.
      var deflated=new Uint8Array(await new Response(
        new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
      var name=new TextEncoder().encode('_chat.txt');
      function crc32(u8){ var c,t=[],n,k; for(n=0;n<256;n++){c=n;for(k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}
        c=0xFFFFFFFF; for(n=0;n<u8.length;n++) c=t[(c^u8[n])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
      var crc=crc32(raw);
      var lh=30+name.length, cdOff=lh+deflated.length, cdLen=46+name.length;
      var buf=new ArrayBuffer(cdOff+cdLen+22), dv=new DataView(buf), u8=new Uint8Array(buf);
      dv.setUint32(0,0x04034b50,true); dv.setUint16(4,20,true); dv.setUint16(8,8,true);
      dv.setUint32(14,crc,true); dv.setUint32(18,deflated.length,true); dv.setUint32(22,raw.length,true);
      dv.setUint16(26,name.length,true); u8.set(name,30); u8.set(deflated,lh);
      dv.setUint32(cdOff,0x02014b50,true); dv.setUint16(cdOff+10,8,true);
      dv.setUint32(cdOff+16,crc,true); dv.setUint32(cdOff+20,deflated.length,true);
      dv.setUint32(cdOff+24,raw.length,true); dv.setUint16(cdOff+28,name.length,true);
      dv.setUint32(cdOff+42,0,true); u8.set(name,cdOff+46);
      dv.setUint32(cdOff+cdLen,0x06054b50,true); dv.setUint16(cdOff+cdLen+8,1,true);
      dv.setUint16(cdOff+cdLen+10,1,true); dv.setUint32(cdOff+cdLen+12,cdLen,true);
      dv.setUint32(cdOff+cdLen+16,cdOff,true);

      if(!waIsZip(u8)) throw new Error('a zip was not recognised as one');
      var text=await waTextFromBuffer(buf);
      if(text.indexOf('focaccia at 230C')===-1) throw new Error('the zip did not decompress to its contents, got: '+text.slice(0,80));
      if(waParse(text,'G').length!==1) throw new Error('the unzipped text did not parse as a chat');
      // Plain text must still pass straight through untouched.
      var plain=await waTextFromBuffer(new TextEncoder().encode('hello').buffer);
      if(plain!=='hello') throw new Error('plain text was mangled by the zip reader');
    } },
  { id:'wa_system_noise', group:'WhatsApp', name:'Group joins and leaves are filtered out',
    test: async()=>{
      var t=[
        '[27/05/2024, 9:35:09] Group: ‎Messages and calls are end-to-end encrypted.',
        '[21/10/2025, 18:57:08] +972 52-452-9054: ‎+972 52-452-9054 joined using a group link',
        '[21/10/2025, 18:58:00] Dana: You want 55C in the centre for medium rare, then rest it.',
        '[21/10/2025, 18:59:00] Roni: ‎Roni left',
        '[21/10/2025, 19:00:00] Tony: I left the brisket in the oven overnight at 90C and it was the best one yet, genuinely worth the wait.'
      ].join('\n');
      var m=waParse(t,'G');
      var texts=m.map(function(x){return x.text;}).join(' | ');
      if(m.length!==2) throw new Error('expected 2 real messages after filtering, got '+m.length+': '+texts);
      if(texts.indexOf('joined using a group link')!==-1) throw new Error('a join notice survived filtering');
      if(texts.indexOf('end-to-end encrypted')!==-1) throw new Error('the encryption notice survived filtering');
      // A long message that merely contains the word "left" is not housekeeping.
      if(texts.indexOf('brisket')===-1) throw new Error('a real message containing "left" was wrongly filtered out');
    } },
  { id:'wa_search', group:'WhatsApp', name:'Query finds the relevant messages, ignores chatter',
    test: async()=>{
      if(typeof waSearch!=='function') throw new Error('waSearch not defined');
      var msgs=[
        {text:'thanks!',who:'A',date:'1/1/24',group:'G'},
        {text:'For focaccia I always use 230C on a preheated tray, twenty minutes.',who:'B',date:'1/1/24',group:'G'},
        {text:'we went to the beach yesterday and it was lovely weather',who:'C',date:'1/1/24',group:'G'},
        {text:'Focaccia at 220C works too if your oven runs hot, but give it longer.',who:'D',date:'1/1/24',group:'G'}
      ];
      var hits=waSearch(msgs,'what temperature for focaccia?',10);
      if(hits.length<2) throw new Error('expected both focaccia answers, got '+hits.length);
      var idxs=hits.map(function(h){return h.i;});
      if(idxs.indexOf(1)===-1||idxs.indexOf(3)===-1) throw new Error('missed one of the relevant messages');
      if(idxs.indexOf(2)!==-1) throw new Error('an unrelated message was returned');
      if(waSearch(msgs,'a',10).length!==0) throw new Error('a query of only short/stop words should match nothing');
      // The answers usually share no words with the question, so the context
      // window around each hit is what actually carries them to the AI.
      var convo=[
        {text:'What oven temperature do you use for focaccia?',who:'T',date:'1/1/24',group:'G'},
        {text:'I do 230C on a preheated tray for twenty minutes, comes out perfect.',who:'D',date:'1/1/24',group:'G'},
        {text:'Mine needs 220C but a bit longer, ovens differ.',who:'R',date:'1/1/24',group:'G'}
      ];
      var ctx=waBuildContext(convo, waSearch(convo,'what temperature for focaccia?',10));
      if(ctx.text.indexOf('230C')===-1||ctx.text.indexOf('220C')===-1)
        throw new Error('the replies to a matching question were not pulled into the context — collating "all answers" is impossible without them');
      if(ctx.count!==3) throw new Error('expected all 3 messages of the exchange, got '+ctx.count);
    } },
  { id:'wa_ui', group:'WhatsApp', name:'WhatsApp Settings + More menu entries exist',
    test: async()=>{
      if(!document.getElementById('waSetupOverlay')) throw new Error('#waSetupOverlay missing');
      if(!document.getElementById('waAskOverlay')) throw new Error('#waAskOverlay missing');
      if(!document.getElementById('waAskItem')) throw new Error('the More menu has no "Ask my WhatsApp groups" entry');
      if(typeof openWaSetup!=='function'||typeof openWaAsk!=='function') throw new Error('openWaSetup/openWaAsk not defined');
      var prev=getWaBase();
      try {
        setWaBase('https://example.com/chats');
        if(getWaBase()!=='https://example.com/chats/') throw new Error('a missing trailing slash should be added, got "'+getWaBase()+'"');
        openWaSetup();
        if(!document.getElementById('waSetupOverlay').classList.contains('open')) throw new Error('setup modal did not open');
        closeM('waSetupOverlay');
        openWaAsk();
        if(!document.getElementById('waAskOverlay').classList.contains('open')) throw new Error('ask modal did not open');
        closeM('waAskOverlay');
      } finally { setWaBase(prev); }
    } },
];

// ─── TESTS THAT GO THROUGH THE REAL SYNC PATH (v36.55) ──────────────────────
// These save, delete, refresh or read photos through the same functions the app
// uses, and those functions keep their bookkeeping in module-level maps and in
// localStorage (what the cloud had, what was last written, what is queued for
// deletion, how many reads today). Eleven tests left some of it altered, and
// Tony's Sync Health report — copied a minute after a run — showed a "damaged
// cloud document" and two phantom cloud recipes that were all fixtures.
//
// Declared here rather than hand-wrapped nine times: one list, one restore, and
// the CI runner compares the sync state before and after EVERY test, so a new
// test that leaks fails the build until it is added to this list on purpose.
['cloud_refresh_one_recipe', 'cloud_photo_bulk', 'photo_repair_bounds',
 'sync_id_collision_keeps_both', 'test_fixtures_stay_local', 'collect_into_collection',
 'coll_split_and_promote', 'feat_recipe_delete', 'feat_undo_delete'
].forEach(function(id) {
  var t = window.SELF_TESTS.filter(function(x){ return x.id === id; })[0];
  if (!t) throw new Error('self-tests.js: the sync-restore list names a test that does not exist: ' + id);
  var run = t.test;
  t.test = async function() {
    var st = _cloudSnapshotForTest();
    try { return await run.apply(this, arguments); } finally { _cloudRestoreForTest(st); }
  };
});
window._selfTestsLoaded = true;
