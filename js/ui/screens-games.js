// Game screens: games hub, terminology matching, true/false speed round, fill-in-the-term,
// concept sorting, chapter boss battles, a 60-second timed challenge, and a mixed mastery challenge.
// Every game is built from the same exam content as the study screens, so every game trains real exam knowledge.
// Namespace: window.LAS.ui.gameScreens
(function (LAS) {
  'use strict';
  var U = function () { return LAS.ui.components; };
  var C = function () { return LAS.core.content; };
  var L = function () { return LAS.core.learning; };
  var store = function () { return LAS.core.store.get(); };
  var esc = function (s) { return U().esc(s); };
  var main = function () { return document.getElementById('app'); };
  var timers = [];
  var keyTarget = null;
  function clearTimers() { timers.forEach(clearInterval); timers = []; }
  function hub() {
    clearTimers(); keyTarget = null;
    var st = store();
    var best = function (k, fmt) { return st.bests[k] != null ? '<span class="chip good">Best ' + (fmt ? fmt(st.bests[k]) : st.bests[k]) + '</span>' : '<span class="chip">Not played</span>'; };
    var games = [
      { href: '#/match', name: 'Terminology matching', desc: 'Match each term to its definition. Clear the board fast.', best: best('match', function (v) { return U().fmtTime(v) + ' s'; }) },
      { href: '#/tf', name: 'True or false speed round', desc: '60 seconds. True or false on exam statements. T and F keys work.', best: best('tf', function (v) { return v + ' correct'; }) },
      { href: '#/fill', name: 'Fill in the term', desc: 'Read the definition and type the term. Small typos are forgiven.', best: best('fill', function (v) { return v + ' / 10'; }) },
      { href: '#/sort', name: 'Concept sorting', desc: 'Sort each term into the topic it belongs to.', best: best('sort', function (v) { return v + ' / round'; }) },
      { href: '#/boss/ALL', name: 'Chapter boss battles', desc: 'Pick a chapter. Beat the boss by answering correctly. You have three lives.', best: '' },
      { href: '#/timed', name: 'Timed knowledge challenge', desc: 'Sixty seconds of mixed questions. How many can you get right?', best: best('timed', function (v) { return v + ' correct'; }) },
      { href: '#/mixed', name: 'Mixed mastery challenge', desc: 'Fifteen questions from every chapter. Score 12 or more to pass.', best: best('mixed', function (v) { return v + ' / 15'; }) }
    ];
    var html = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Play</p><h1>Games</h1></div></div><p class="muted">Every game draws on the exam content. Each answer earns XP.</p><div class="grid">';
    games.forEach(function (g) { html += '<a class="game-card" href="' + g.href + '"><strong>' + esc(g.name) + '</strong><p class="small muted">' + esc(g.desc) + '</p><div class="row">' + g.best + '</div></a>'; });
    return html + '</div></section>';
  }

  // ---------- Terminology matching ----------
  var mg = { scope: 'ALL', pairs: [], left: [], right: [], sel: null, matched: 0, moves: 0, start: 0 };
  function matchSetup() {
    clearTimers();
    var pool = C().PAIRS.filter(function (p) { return mg.scope === 'ALL' || p.unit === mg.scope; });
    main().innerHTML = '<section class="screen"><div class="row"><a class="btn small ghost" href="#/games">Games</a></div><div class="screen-head"><div><p class="eyebrow">Game</p><h1>Terminology matching</h1></div></div>' +
      '<div class="panel"><label class="field">Chapter<select id="mgScope">' + unitOpts(mg.scope) + '</select></label><p class="small muted">' + pool.length + ' pairs. Each round uses six.</p><div class="row"><button class="btn primary" id="mgStart"' + (pool.length >= 6 ? '' : ' disabled') + '>Start round</button></div></div></section>';
    document.getElementById('mgScope').addEventListener('change', function () { mg.scope = this.value; matchSetup(); });
    document.getElementById('mgStart').addEventListener('click', matchStart);
  }
  function unitOpts(sel) {
    return '<option value="ALL"' + (sel === 'ALL' ? ' selected' : '') + '>All chapters</option>' + C().UNIT_ORDER.map(function (u) { return '<option value="' + esc(u) + '"' + (sel === u ? ' selected' : '') + '>' + esc(C().unitName[u] || u) + '</option>'; }).join('');
  }
  function matchStart() {
    var pool = C().PAIRS.filter(function (p) { return mg.scope === 'ALL' || p.unit === mg.scope; });
    mg.pairs = U().shuffle(pool).slice(0, 6).map(function (p) { return { term: p.term, match: p.match, done: false }; });
    mg.left = U().shuffle(mg.pairs.map(function (p, i) { return { i: i, t: p.term }; }));
    mg.right = U().shuffle(mg.pairs.map(function (p, i) { return { i: i, t: p.match }; }));
    mg.sel = null; mg.matched = 0; mg.moves = 0; mg.start = Date.now();
    matchDraw();
    clearTimers(); timers.push(setInterval(function () { var el = document.getElementById('mgTimer'); if (el) el.textContent = U().fmtTime((Date.now() - mg.start) / 1000); }, 500));
  }
  function matchDraw() {
    var html = '<section class="screen"><div class="row"><button class="btn small ghost" id="mgQuit">Quit</button><span class="spacer"></span><span class="timer" id="mgTimer">0:00</span><span class="chip">Moves ' + mg.moves + '</span></div><p class="muted small mt">Matched ' + mg.matched + ' of ' + mg.pairs.length + '</p>';
    html += '<div class="match-grid"><div role="group" aria-label="Terms">';
    mg.left.forEach(function (x, idx) { var done = mg.pairs[x.i].done; html += '<button class="tile' + (mg.sel && mg.sel.side === 'L' && mg.sel.idx === idx ? ' selected' : '') + (done ? ' done' : '') + '" data-side="L" data-idx="' + idx + '"' + (done ? ' disabled' : '') + '>' + esc(x.t) + '</button>'; });
    html += '</div><div role="group" aria-label="Definitions">';
    mg.right.forEach(function (x, idx) { var done = mg.pairs[x.i].done; html += '<button class="tile' + (mg.sel && mg.sel.side === 'R' && mg.sel.idx === idx ? ' selected' : '') + (done ? ' done' : '') + '" data-side="R" data-idx="' + idx + '"' + (done ? ' disabled' : '') + '>' + esc(x.t) + '</button>'; });
    html += '</div></div><div id="mgMsg" class="mt" aria-live="polite"></div></section>';
    main().innerHTML = html;
    document.getElementById('mgQuit').addEventListener('click', hub2);
    document.querySelectorAll('.tile').forEach(function (b) { b.addEventListener('click', function () { matchPick(b.getAttribute('data-side'), +b.getAttribute('data-idx')); }); });
  }
  function hub2() { clearTimers(); location.hash = '#/games'; }
  function matchPick(side, idx) {
    if (!mg.sel || mg.sel.side === side) { mg.sel = { side: side, idx: idx }; matchDraw(); return; }
    var l = side === 'L' ? idx : mg.sel.idx, r = side === 'R' ? idx : mg.sel.idx;
    var a = mg.left[l], b = mg.right[r];
    mg.moves++;
    if (a.i === b.i) {
      mg.pairs[a.i].done = true; mg.matched++; mg.sel = null;
      if (mg.matched === mg.pairs.length) {
        clearTimers();
        var secs = (Date.now() - mg.start) / 1000;
        var st = store();
        if (!st.bests.match || secs < st.bests.match) st.bests.match = Math.round(secs);
        LAS.core.store.save();
        var fresh = L().checkAchievements(secs < 60 ? { kind: 'match-fast' } : {});
        L().addXp(20);
        fresh.forEach(function (a2) { U().toast('Achievement unlocked: ' + a2.name); });
        main().innerHTML = '<section class="screen"><div class="panel center"><p class="eyebrow">Round complete</p><div class="stat">' + U().fmtTime(secs) + '</div><p class="muted">' + mg.moves + ' moves · +20 XP</p><div class="row" style="justify-content:center"><button class="btn primary" id="mgAgain">Play again</button><a class="btn" href="#/games">Games</a></div></div></section>';
        document.getElementById('mgAgain').addEventListener('click', matchStart);
        U().renderHud();
        return;
      }
      matchDraw();
      document.getElementById('mgMsg').innerHTML = '<span class="chip good">Match</span> ' + esc(mg.pairs[a.i].match.slice(0, 90));
    } else {
      mg.sel = null; matchDraw();
      document.getElementById('mgMsg').innerHTML = '<span class="chip bad">Not a match</span> Try again.';
    }
  }

  // ---------- True or false speed round ----------
  var tf = { list: [], i: 0, score: 0, endAt: 0, done: false };
  function tfSetup() {
    clearTimers();
    main().innerHTML = '<section class="screen"><div class="row"><a class="btn small ghost" href="#/games">Games</a></div><div class="screen-head"><div><p class="eyebrow">Speed round</p><h1>True or false</h1></div></div>' +
      '<div class="panel"><p class="muted">Sixty seconds. Answer as many as you can. Keys: T for true, F for false.</p><div class="row"><button class="btn primary" id="tfStart">Start 60-second round</button></div></div></section>';
    document.getElementById('tfStart').addEventListener('click', tfStart);
  }
  function tfStart() {
    tf.list = U().shuffle(C().TF); tf.i = 0; tf.score = 0; tf.done = false; tf.endAt = Date.now() + 60000;
    if (!tf.list.length) { main().innerHTML = '<section class="screen"><div class="empty">No statements are available yet.</div></section>'; return; }
    tfDraw();
    clearTimers();
    timers.push(setInterval(function () {
      var left = (tf.endAt - Date.now()) / 1000, el = document.getElementById('tfTimer');
      if (el) { el.textContent = U().fmtTime(left); el.classList.toggle('urgent', left < 10); }
      if (left <= 0 && !tf.done) tfEnd();
    }, 250));
  }
  function tfDraw() {
    var t = tf.list[tf.i % tf.list.length];
    main().innerHTML = '<section class="screen"><div class="row"><span class="timer" id="tfTimer">1:00</span><span class="spacer"></span><span class="chip">' + tf.score + ' correct</span></div>' +
      '<article class="qcard mt"><div class="meta"><span class="chip">' + esc(C().unitName[t.unit] || '') + '</span></div><h2 class="qtext">' + esc(t.s) + '</h2><div class="row"><button class="btn good" data-v="1">True (T)</button><button class="btn bad" data-v="0">False (F)</button></div><div id="tfFb" aria-live="polite"></div></article></section>';
    document.querySelectorAll('[data-v]').forEach(function (b) { b.addEventListener('click', function () { tfAnswer(b.getAttribute('data-v') === '1'); }); });
    keyTarget = function (e) { var k = e.key.toLowerCase(); if (k === 't') { tfAnswer(true); return true; } if (k === 'f') { tfAnswer(false); return true; } return false; };
  }
  function tfAnswer(val) {
    if (tf.done) return;
    var t = tf.list[tf.i % tf.list.length];
    var ok = val === t.a;
    var res = L().recordItem({ id: t.id, unit: t.unit, topic: t.topic }, ok, { kind: 'tf' });
    U().xpPop(res.xp);
    if (ok) tf.score++;
    tf.i++;
    document.getElementById('tfFb').innerHTML = '<div class="feedback ' + (ok ? 'ok' : 'no') + '"><strong>' + (ok ? 'Correct' : 'Not quite') + '.</strong> ' + esc(t.e) + '</div>';
    setTimeout(function () { if (!tf.done) tfDraw(); }, 500);
  }
  function tfEnd() {
    tf.done = true; clearTimers(); keyTarget = null;
    var st = store();
    if (st.bests.tf == null || tf.score > st.bests.tf) st.bests.tf = tf.score;
    LAS.core.store.save();
    if (tf.score >= 20) L().checkAchievements({ kind: 'tf-20' }).forEach(function (a) { U().toast('Achievement unlocked: ' + a.name); });
    main().innerHTML = '<section class="screen"><div class="panel center"><p class="eyebrow">Time is up</p><div class="stat">' + tf.score + '</div><p class="muted">correct in 60 seconds</p><div class="row" style="justify-content:center"><button class="btn primary" id="tfAgain">Play again</button><a class="btn" href="#/games">Games</a></div></div></section>';
    document.getElementById('tfAgain').addEventListener('click', tfStart);
    U().renderHud();
  }

  // ---------- Fill in the term ----------
  var fl = { list: [], i: 0, score: 0 };
  function fillSetup() {
    clearTimers();
    main().innerHTML = '<section class="screen"><div class="row"><a class="btn small ghost" href="#/games">Games</a></div><div class="screen-head"><div><p class="eyebrow">Game</p><h1>Fill in the term</h1></div></div><div class="panel"><p class="muted">Read the definition, then type the term. Press Enter to check.</p><div class="row"><button class="btn primary" id="flStart">Start (10 terms)</button></div></div></section>';
    document.getElementById('flStart').addEventListener('click', fillStart);
  }
  function fillStart() {
    fl.list = U().shuffle(C().FILL).slice(0, 10); fl.i = 0; fl.score = 0;
    if (!fl.list.length) { main().innerHTML = '<section class="screen"><div class="empty">No terms are available yet.</div></section>'; return; }
    fillDraw();
  }
  function fillDraw() {
    var f = fl.list[fl.i];
    main().innerHTML = '<section class="screen"><div class="row"><span class="chip">' + (fl.i + 1) + ' / ' + fl.list.length + '</span><span class="spacer"></span><span class="chip">' + fl.score + ' correct</span></div>' + U().bar(U().pct(fl.i, fl.list.length), 'slim wide mt') +
      '<article class="qcard mt"><div class="meta"><span class="chip">' + esc(C().unitName[f.unit] || '') + '</span></div><h2 class="qtext">' + esc(f.prompt) + '</h2><label class="field">The term<input id="flIn" type="text" autocomplete="off" placeholder="Type the term"></label><div class="row"><button class="btn primary" id="flCheck">Check</button></div><div id="flFb" aria-live="polite"></div></article></section>';
    var inp = document.getElementById('flIn'); inp.focus();
    var submit = function () {
      if (!inp.value.trim() || inp.disabled) return;
      var ok = L().gradeTyped(inp.value, f.answer);
      var res = L().recordItem({ id: f.id, unit: f.unit, topic: f.topic }, ok, { kind: 'fill' });
      U().xpPop(res.xp); if (ok) fl.score++;
      inp.disabled = true;
      document.getElementById('flFb').innerHTML = '<div class="feedback ' + (ok ? 'ok' : 'no') + '"><strong>' + (ok ? 'Correct' : 'Not quite') + '.</strong> The term is <strong>' + esc(f.answer[0]) + '</strong>.</div><div class="row mt"><button class="btn primary" id="flNext">' + (fl.i + 1 >= fl.list.length ? 'Finish' : 'Next term') + '</button></div>';
      document.getElementById('flNext').addEventListener('click', function () { fl.i++; if (fl.i >= fl.list.length) return fillFinish(); fillDraw(); });
      document.getElementById('flNext').focus();
    };
    document.getElementById('flCheck').addEventListener('click', submit);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  }
  function fillFinish() {
    var st = store();
    if (st.bests.fill == null || fl.score > st.bests.fill) st.bests.fill = fl.score;
    LAS.core.store.save();
    main().innerHTML = '<section class="screen"><div class="panel center"><p class="eyebrow">Round complete</p><div class="stat">' + fl.score + ' / ' + fl.list.length + '</div><div class="row" style="justify-content:center"><button class="btn primary" id="flAgain">Play again</button><a class="btn" href="#/games">Games</a></div></div></section>';
    document.getElementById('flAgain').addEventListener('click', fillStart);
    U().renderHud();
  }

  // ---------- Concept sorting ----------
  var so = { groups: [], tiles: [], picked: null, placed: 0, score: 0, total: 0 };
  function sortSetup() {
    clearTimers();
    main().innerHTML = '<section class="screen"><div class="row"><a class="btn small ghost" href="#/games">Games</a></div><div class="screen-head"><div><p class="eyebrow">Game</p><h1>Concept sorting</h1></div></div><div class="panel"><p class="muted">Tap a term, then the topic it belongs to.</p><div class="row"><button class="btn primary" id="soStart">Start round</button></div></div></section>';
    document.getElementById('soStart').addEventListener('click', sortStart);
  }
  function sortStart() {
    var groups = U().shuffle(C().sortGroups()).slice(0, 3);
    if (groups.length < 2) { main().innerHTML = '<section class="screen"><div class="empty">Not enough topics to sort yet.</div></section>'; return; }
    so.groups = groups.map(function (g) { return { topic: g.topic, cards: U().shuffle(g.cards).slice(0, 3) }; });
    so.tiles = U().shuffle(so.groups.reduce(function (acc, g, gi) { g.cards.forEach(function (c) { acc.push({ g: gi, front: c.front, unit: c.unit, topic: c.topic, done: false }); }); return acc; }, []));
    so.picked = null; so.placed = 0; so.score = 0; so.total = so.tiles.length;
    sortDraw();
  }
  function sortDraw() {
    var html = '<section class="screen"><div class="row"><span class="chip">' + so.placed + ' / ' + so.total + ' placed</span><span class="spacer"></span><span class="chip">' + so.score + ' first-try</span></div><div class="sort-terms">';
    so.tiles.forEach(function (t, i) { if (!t.done) html += '<button class="tile' + (so.picked === i ? ' selected' : '') + '" data-t="' + i + '">' + esc(t.front) + '</button>'; });
    html += '</div><div class="sort-buckets">';
    so.groups.forEach(function (g, gi) {
      var placed = so.tiles.filter(function (t) { return t.done && t.g === gi; }).map(function (t) { return esc(t.front); });
      html += '<button class="bucket" data-b="' + gi + '"><strong>' + esc(g.topic) + '</strong><span class="small muted">' + (placed.length ? placed.join(' · ') : 'Drop terms here') + '</span></button>';
    });
    html += '</div><div id="soMsg" class="mt" aria-live="polite"></div></section>';
    main().innerHTML = html;
    document.querySelectorAll('[data-t]').forEach(function (b) { b.addEventListener('click', function () { so.picked = +b.getAttribute('data-t'); sortDraw(); }); });
    document.querySelectorAll('[data-b]').forEach(function (b) { b.addEventListener('click', function () { if (so.picked != null) sortPlace(+b.getAttribute('data-b')); }); });
  }
  function sortPlace(gi) {
    var t = so.tiles[so.picked];
    var ok = t.g === gi;
    var first = !t.tried;
    if (!ok) t.tried = true;
    var res = L().recordItem({ id: 'sort:' + t.front, unit: t.unit, topic: t.topic }, ok, { kind: 'sort' });
    U().xpPop(res.xp);
    if (ok) { t.done = true; so.placed++; if (first) so.score++; }
    so.picked = null;
    sortDraw();
    document.getElementById('soMsg').innerHTML = ok ? '<span class="chip good">Right topic</span>' : '<span class="chip bad">Not that topic</span> Try again.';
    if (so.placed === so.total) {
      var st = store(); if (st.bests.sort == null || so.score > st.bests.sort) st.bests.sort = so.score;
      LAS.core.store.save();
      main().innerHTML = '<section class="screen"><div class="panel center"><p class="eyebrow">Round complete</p><div class="stat">' + so.score + ' / ' + so.total + '</div><p class="muted">placed correctly on the first try</p><div class="row" style="justify-content:center"><button class="btn primary" id="soAgain">Play again</button><a class="btn" href="#/games">Games</a></div></div></section>';
      document.getElementById('soAgain').addEventListener('click', sortStart);
      U().renderHud();
    }
  }

  // ---------- Chapter boss battle ----------
  var bo = { unit: null, list: [], i: 0, bossHp: 0, bossMax: 0, lives: 3, done: false, wins: 0 };
  function bossSetup(unit) {
    clearTimers();
    var units = C().bossUnits();
    if (unit && unit !== 'ALL' && units.indexOf(unit) >= 0) {
      return bossStart(unit);
    }
    main().innerHTML = '<section class="screen"><div class="row"><a class="btn small ghost" href="#/games">Games</a></div><div class="screen-head"><div><p class="eyebrow">Boss battle</p><h1>Choose a chapter boss</h1></div></div><p class="muted">Each boss has 8 HP. A correct answer deals 1 damage. A wrong answer costs one of your three lives.</p><div class="grid">' +
      units.map(function (u) { return '<a class="game-card" href="#/boss/' + esc(u) + '"><strong>' + esc(C().unitName[u]) + ' boss</strong><p class="small muted">' + esc(C().unitTitle(u)) + '</p></a>'; }).join('') + '</div></section>';
  }
  function bossStart(unit) {
    var pool = C().itemsForUnit(unit);
    bo.unit = unit; bo.list = U().shuffle(pool).slice(0, Math.min(12, pool.length)); bo.i = 0; bo.bossMax = Math.min(8, bo.list.length); bo.bossHp = bo.bossMax; bo.lives = 3; bo.done = false;
    bossDraw();
  }
  function bossDraw() {
    var it = bo.list[bo.i];
    var html = '<section class="screen boss-screen"><div class="boss-head"><div class="boss-name">' + esc(C().unitName[bo.unit]) + ' boss · ' + esc(C().unitTitle(bo.unit)) + '</div>' +
      '<div class="hp" aria-label="Boss health ' + bo.bossHp + ' of ' + bo.bossMax + '"><span>Boss HP</span>' + U().bar(U().pct(bo.bossHp, bo.bossMax), 'hp-bar') + '</div>' +
      '<div class="lives" aria-label="Lives ' + bo.lives + '">' + [0, 1, 2].map(function (i) { return '<span class="heart' + (i < bo.lives ? '' : ' lost') + '" aria-hidden="true">♥</span>'; }).join('') + '</div></div>';
    html += '<div id="boBody"></div></section>';
    main().innerHTML = html;
    var q = U().mcQuestion(document.getElementById('boBody'), it, function (correct) {
      if (correct) bo.bossHp--; else bo.lives--;
      setTimeout(function () { boNext(); }, 900);
    }, { kind: 'boss' });
    keyTarget = function (e) { return q.handleKey(e.key); };
  }
  function boNext() {
    keyTarget = null;
    if (bo.bossHp <= 0) return bossWin();
    if (bo.lives <= 0) return bossLose();
    bo.i++;
    if (bo.i >= bo.list.length) return bossLose();
    bossDraw();
  }
  function bossWin() {
    bo.done = true; clearTimers();
    var fresh = L().bossWinAchievement();
    L().addXp(100);
    var st = store(); st.bests['boss-' + bo.unit] = (st.bests['boss-' + bo.unit] || 0) + 1; LAS.core.store.save();
    fresh.forEach(function (a) { U().toast('Achievement unlocked: ' + a.name); });
    main().innerHTML = '<section class="screen"><div class="panel center boss-win"><p class="eyebrow">Victory</p><h2>' + esc(C().unitName[bo.unit]) + ' boss defeated</h2><p class="muted">+100 XP. Your lives left: ' + bo.lives + '.</p><div class="row" style="justify-content:center"><button class="btn primary" id="boAgain">Fight again</button><a class="btn" href="#/games">Games</a></div></div></section>';
    document.getElementById('boAgain').addEventListener('click', function () { bossStart(bo.unit); });
    U().renderHud();
  }
  function bossLose() {
    bo.done = true; clearTimers();
    main().innerHTML = '<section class="screen"><div class="panel center"><p class="eyebrow">Defeated this time</p><p class="muted">The boss still has ' + bo.bossHp + ' HP. Review the topics you missed, then try again.</p><div class="row" style="justify-content:center"><button class="btn primary" id="boRetry">Try again</button><a class="btn" href="#/lesson/' + esc(bo.unit) + '">Review the chapter</a></div></div></section>';
    document.getElementById('boRetry').addEventListener('click', function () { bossStart(bo.unit); });
  }

  // ---------- Timed knowledge challenge and mixed mastery challenge ----------
  var tc = { list: [], i: 0, score: 0, endAt: 0, mode: 'timed', done: false };
  function timedSetup(mode) {
    clearTimers();
    tc.mode = mode === 'mixed' ? 'mixed' : 'timed';
    var title = tc.mode === 'mixed' ? 'Mixed mastery challenge' : 'Timed knowledge challenge';
    var desc = tc.mode === 'mixed' ? '15 questions from every chapter. Score 12 or more to pass.' : 'Sixty seconds. How many can you answer correctly?';
    main().innerHTML = '<section class="screen"><div class="row"><a class="btn small ghost" href="#/games">Games</a></div><div class="screen-head"><div><p class="eyebrow">Challenge</p><h1>' + title + '</h1></div></div><div class="panel"><p class="muted">' + desc + '</p><div class="row"><button class="btn primary" id="tcStart">Start</button></div></div></section>';
    document.getElementById('tcStart').addEventListener('click', timedStart);
  }
  function timedStart() {
    var pool = U().shuffle(C().ITEMS);
    tc.list = tc.mode === 'mixed' ? pool.slice(0, 15) : pool;
    tc.i = 0; tc.score = 0; tc.done = false; tc.endAt = tc.mode === 'mixed' ? 0 : Date.now() + 60000;
    timedDraw();
    if (tc.endAt) {
      clearTimers();
      timers.push(setInterval(function () {
        var left = (tc.endAt - Date.now()) / 1000, el = document.getElementById('tcTimer');
        if (el) { el.textContent = U().fmtTime(left); el.classList.toggle('urgent', left < 10); }
        if (left <= 0 && !tc.done) timedEnd();
      }, 250));
    }
  }
  function timedDraw() {
    if (tc.i >= tc.list.length) return timedEnd();
    var it = tc.list[tc.i];
    main().innerHTML = '<section class="screen"><div class="row">' + (tc.endAt ? '<span class="timer" id="tcTimer">1:00</span>' : '<span class="chip">' + (tc.i + 1) + ' / ' + tc.list.length + '</span>') + '<span class="spacer"></span><span class="chip">' + tc.score + ' correct</span></div><div id="tcBody" class="mt"></div></section>';
    var q = U().mcQuestion(document.getElementById('tcBody'), it, function (correct) {
      if (correct) tc.score++;
      setTimeout(function () { if (!tc.done) { tc.i++; timedDraw(); } }, 700);
    }, { kind: 'timed' });
    keyTarget = function (e) { return q.handleKey(e.key); };
  }
  function timedEnd() {
    tc.done = true; clearTimers(); keyTarget = null;
    var st = store();
    var key = tc.mode === 'mixed' ? 'mixed' : 'timed';
    if (st.bests[key] == null || tc.score > st.bests[key]) st.bests[key] = tc.score;
    LAS.core.store.save();
    var passed = tc.mode === 'mixed' ? tc.score >= 12 : null;
    main().innerHTML = '<section class="screen"><div class="panel center"><p class="eyebrow">' + (tc.mode === 'mixed' ? 'Mixed mastery' : 'Time is up') + '</p><div class="stat">' + tc.score + ' / ' + (tc.mode === 'mixed' ? tc.list.length : tc.i) + '</div>' +
      (passed === null ? '<p class="muted">correct in 60 seconds</p>' : '<p>' + (passed ? '<span class="chip good">Passed</span>' : '<span class="chip bad">Not yet, review and retry</span>') + '</p>') +
      '<div class="row" style="justify-content:center"><button class="btn primary" id="tcAgain">Play again</button><a class="btn" href="#/games">Games</a></div></div></section>';
    document.getElementById('tcAgain').addEventListener('click', timedStart);
    U().renderHud();
  }

  document.addEventListener('keydown', function (e) {
    if (!keyTarget) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (keyTarget(e)) e.preventDefault();
  });

  LAS.ui = LAS.ui || {};
  LAS.ui.gameScreens = {
    clearTimers: clearTimers, hub: hub,
    matchSetup: matchSetup, tfSetup: tfSetup, fillSetup: fillSetup, sortSetup: sortSetup,
    bossSetup: bossSetup, timedSetup: timedSetup, resetKeys: function () { keyTarget = null; }
  };
})(window.LAS = window.LAS || {});
