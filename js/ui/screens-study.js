// Study screens: flashcards, active recall, mini quiz, personal sessions (with focus mode), scenarios, mock exam.
// Namespace: window.LAS.ui.studyScreens. Each run function renders into the main area and wires its own events.
(function (LAS) {
  'use strict';
  var U = function () { return LAS.ui.components; };
  var C = function () { return LAS.core.content; };
  var L = function () { return LAS.core.learning; };
  var P = function () { return LAS.core.planner; };
  var store = function () { return LAS.core.store.get(); };
  var esc = function (s) { return U().esc(s); };
  var main = function () { return document.getElementById('app'); };
  var timers = [];
  function clearTimers() { timers.forEach(clearInterval); timers = []; }
  var keyTarget = null; // the active screen's key handler: function(event) -> bool

  function unitSelect(sel, all) {
    var out = all ? '<option value="ALL"' + (sel === 'ALL' ? ' selected' : '') + '>All chapters</option>' : '';
    C().UNIT_ORDER.forEach(function (u) { out += '<option value="' + esc(u) + '"' + (sel === u ? ' selected' : '') + '>' + esc(C().unitName[u] || u) + ' · ' + esc(C().unitTitle(u)) + '</option>'; });
    return out;
  }

  // ---------- FLASHCARDS ----------
  var fc = { scope: 'ALL', mode: 'due', queue: [], i: 0, flipped: false };
  function flashSetup(scope) {
    if (scope && C().hasUnit(scope)) fc.scope = scope;
    var html = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Recall</p><h1>Flashcards</h1></div></div>' +
      '<div class="panel"><label class="field">Chapter<select id="fcScope">' + unitSelect(fc.scope, true) + '</select></label>' +
      '<div class="seg" role="group" aria-label="Card order">' +
      '<label><input type="radio" name="fcmode" value="due"' + (fc.mode === 'due' ? ' checked' : '') + '> Due now</label>' +
      '<label><input type="radio" name="fcmode" value="all"' + (fc.mode === 'all' ? ' checked' : '') + '> All, shuffled</label>' +
      '<label><input type="radio" name="fcmode" value="new"' + (fc.mode === 'new' ? ' checked' : '') + '> New only</label></div>' +
      '<div class="row mt"><button class="btn primary" id="fcStart">Start</button><span class="muted small" id="fcCount"></span></div></div></section>';
    main().innerHTML = html;
    var count = function () { var el = document.getElementById('fcCount'); if (el) el.textContent = fcPool().length + ' cards'; };
    document.getElementById('fcScope').addEventListener('change', function () { fc.scope = this.value; count(); });
    document.querySelectorAll('input[name=fcmode]').forEach(function (r) { r.addEventListener('change', function () { fc.mode = r.value; count(); }); });
    document.getElementById('fcStart').addEventListener('click', flashStart);
    count();
  }
  function fcPool() {
    var now = Date.now(), st = store();
    return C().CARDS.filter(function (c) {
      if (fc.scope !== 'ALL' && c.unit !== fc.scope) return false;
      if (fc.mode === 'due') return !st.cards[c.id] || st.cards[c.id].due <= now;
      if (fc.mode === 'new') return !st.cards[c.id];
      return true;
    });
  }
  function flashStart() {
    fc.queue = U().shuffle(fcPool()); fc.i = 0; fc.flipped = false;
    if (!fc.queue.length) { main().innerHTML = '<section class="screen"><div class="empty">Nothing due here. Try “All, shuffled”.<br><a class="btn small mt" href="#/flashcards">Back</a></div></section>'; return; }
    flashDraw();
  }
  function flashDraw() {
    var c = fc.queue[fc.i], total = fc.queue.length;
    var html = '<section class="screen flash-screen"><div class="row"><a class="btn small ghost" href="#/flashcards">Settings</a><span class="spacer"></span><span class="chip">' + (fc.i + 1) + ' / ' + total + '</span></div>' + U().bar(U().pct(fc.i, total), 'slim wide mt');
    html += '<div class="flash-wrap"><button class="flash' + (fc.flipped ? ' flipped' : '') + '" id="flashCard" aria-label="Flashcard. Activate to flip.">' +
      '<span class="face front"><span class="ftext">' + esc(c.front) + '</span><span class="hint">Tap or Space to flip</span></span>' +
      '<span class="face back"><span class="ftext">' + esc(c.back) + '</span>' + (c.memory ? '<span class="memory">Memory trick: ' + esc(c.memory) + '</span>' : '') + '</span></button></div>';
    html += '<p class="center muted small">' + esc(C().unitName[c.unit]) + ' · ' + esc(c.topic) + '</p>';
    if (fc.flipped) {
      html += '<div class="rate-row" role="group" aria-label="Rate your recall">' +
        '<button class="btn bad" data-g="1">Again<small>1</small></button><button class="btn" data-g="2">Hard<small>2</small></button><button class="btn good" data-g="3">Good<small>3</small></button><button class="btn primary" data-g="4">Easy<small>4</small></button></div>';
    } else {
      html += '<p class="center muted">Flip the card, then rate how well you knew it.</p>';
    }
    html += '</section>';
    main().innerHTML = html;
    document.getElementById('flashCard').addEventListener('click', function () { fc.flipped = !fc.flipped; flashDraw(); });
    document.querySelectorAll('.rate-row [data-g]').forEach(function (b) { b.addEventListener('click', function () { flashRate(+b.getAttribute('data-g')); }); });
    keyTarget = function (e) {
      if (e.key === ' ') { e.preventDefault(); if (!fc.flipped) { fc.flipped = true; flashDraw(); } return true; }
      if (fc.flipped && ['1', '2', '3', '4'].indexOf(e.key) >= 0) { flashRate(+e.key); return true; }
      return false;
    };
  }
  function flashRate(g) {
    var c = fc.queue[fc.i];
    var res = L().rateCard(c.id, g);
    U().xpPop(res.xp); U().renderHud();
    res.newAchievements.forEach(function (a) { U().toast('Achievement unlocked: ' + a.name); });
    fc.i++; fc.flipped = false;
    if (fc.i >= fc.queue.length) {
      main().innerHTML = '<section class="screen"><div class="panel center"><h2>Set complete</h2><p class="muted">Cards you rated Again return soon. Easy cards return later.</p><div class="row" style="justify-content:center"><button class="btn primary" id="fcAgain">Study again</button><a class="btn" href="#/dashboard">Dashboard</a></div></div></section>';
      document.getElementById('fcAgain').addEventListener('click', flashStart);
      return;
    }
    flashDraw();
  }

  // ---------- ACTIVE RECALL (type first, then reveal) ----------
  var rc = { scope: 'ALL', queue: [], i: 0, typed: '', revealed: false };
  function recallSetup(scope) {
    if (scope && C().hasUnit(scope)) rc.scope = scope;
    main().innerHTML = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Recall</p><h1>Active recall</h1></div></div>' +
      '<div class="panel"><p class="muted">Type your answer before you reveal it. Writing it down is what builds memory.</p>' +
      '<label class="field">Chapter<select id="rcScope">' + unitSelect(rc.scope, true) + '</select></label>' +
      '<div class="row mt"><button class="btn primary" id="rcStart">Start (25 prompts)</button></div></div></section>';
    document.getElementById('rcScope').addEventListener('change', function () { rc.scope = this.value; });
    document.getElementById('rcStart').addEventListener('click', recallStart);
  }
  function recallStart() {
    var pool = C().RECALL.filter(function (r) { return rc.scope === 'ALL' || r.unit === rc.scope; });
    rc.queue = U().shuffle(pool).slice(0, 25); rc.i = 0; rc.typed = ''; rc.revealed = false;
    if (!rc.queue.length) { main().innerHTML = '<section class="screen"><div class="empty">No prompts for this chapter.</div></section>'; return; }
    recallDraw();
  }
  function recallDraw() {
    var r = rc.queue[rc.i];
    var html = '<section class="screen"><div class="row"><a class="btn small ghost" href="#/recall">Settings</a><span class="spacer"></span><span class="chip">' + (rc.i + 1) + ' / ' + rc.queue.length + '</span></div>' + U().bar(U().pct(rc.i, rc.queue.length), 'slim wide mt');
    html += '<article class="qcard"><div class="meta"><span class="chip">' + esc(r.unitTitle) + '</span></div><h2 class="qtext">' + esc(r.q) + '</h2>';
    if (!rc.revealed) {
      html += '<label class="field">Your answer<textarea id="rcTyped" rows="3" placeholder="Type what you remember">' + esc(rc.typed) + '</textarea></label>' +
        '<div class="row"><button class="btn primary" id="rcReveal">Check my answer</button><button class="btn ghost" id="rcBlank">I do not know yet</button></div>';
    } else {
      html += '<div class="your-answer"><span class="chip">Your answer</span><p>' + (rc.typed ? esc(rc.typed) : '<em class="muted">Nothing typed</em>') + '</p></div>';
      html += '<div class="reveal"><span class="chip good">Model answer</span><p>' + esc(r.a) + '</p></div>';
      html += '<p class="small muted">Be honest. Did you have the key idea?</p><div class="row"><button class="btn good" id="rcKnew">I had it (K)</button><button class="btn bad" id="rcMiss">I missed it (M)</button></div>';
    }
    html += '</article></section>';
    main().innerHTML = html;
    if (!rc.revealed) {
      var ta = document.getElementById('rcTyped');
      ta.addEventListener('input', function () { rc.typed = ta.value; });
      document.getElementById('rcReveal').addEventListener('click', function () { rc.typed = ta.value; rc.revealed = true; recallDraw(); });
      document.getElementById('rcBlank').addEventListener('click', function () { rc.typed = ''; rc.revealed = true; recallDraw(); });
      ta.focus();
    } else {
      document.getElementById('rcKnew').addEventListener('click', function () { recallRate(true); });
      document.getElementById('rcMiss').addEventListener('click', function () { recallRate(false); });
    }
    keyTarget = function (e) {
      if (!rc.revealed) return false;
      if (e.key === 'k' || e.key === 'K') { recallRate(true); return true; }
      if (e.key === 'm' || e.key === 'M') { recallRate(false); return true; }
      return false;
    };
  }
  function recallRate(knew) {
    var r = rc.queue[rc.i];
    var item = { id: 'recall:' + r.id, unit: r.unit, topic: 'Recall: ' + (C().unitName[r.unit] || r.unit) };
    var res = L().recordItem(item, knew, { kind: 'recall' });
    U().xpPop(res.xp); U().renderHud();
    rc.i++; rc.typed = ''; rc.revealed = false;
    if (rc.i >= rc.queue.length) { main().innerHTML = '<section class="screen"><div class="panel center"><h2>Round complete</h2><div class="row" style="justify-content:center"><button class="btn primary" id="rcAgain">Another round</button><a class="btn" href="#/dashboard">Dashboard</a></div></div></section>'; document.getElementById('rcAgain').addEventListener('click', recallStart); return; }
    recallDraw();
  }

  // ---------- MULTIPLE-CHOICE RUNNER (mini quiz, scenarios) ----------
  var qz = { scope: 'ALL', n: 10, mode: 'random', list: [], i: 0, score: 0, results: [] };
  function quizSetup(scope) {
    if (scope && C().hasUnit(scope)) qz.scope = scope;
    main().innerHTML = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Practice</p><h1>Mini quiz</h1></div></div>' +
      '<div class="panel"><label class="field">Chapter<select id="qzScope">' + unitSelect(qz.scope, true) + '</select></label>' +
      '<label class="field">Questions<select id="qzN">' + [5, 10, 20].map(function (n) { return '<option value="' + n + '"' + (qz.n === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<div class="seg" role="group"><label><input type="radio" name="qzmode" value="random"' + (qz.mode === 'random' ? ' checked' : '') + '> Random</label><label><input type="radio" name="qzmode" value="missed"' + (qz.mode === 'missed' ? ' checked' : '') + '> Missed before</label><label><input type="radio" name="qzmode" value="unseen"' + (qz.mode === 'unseen' ? ' checked' : '') + '> Not seen yet</label></div>' +
      '<div class="row mt"><button class="btn primary" id="qzStart">Start</button><span class="muted small" id="qzCount"></span></div></div></section>';
    var count = function () { var el = document.getElementById('qzCount'); if (el) el.textContent = quizPool().length + ' questions available'; };
    document.getElementById('qzScope').addEventListener('change', function () { qz.scope = this.value; count(); });
    document.getElementById('qzN').addEventListener('change', function () { qz.n = +this.value; });
    document.querySelectorAll('input[name=qzmode]').forEach(function (r) { r.addEventListener('change', function () { qz.mode = r.value; count(); }); });
    document.getElementById('qzStart').addEventListener('click', quizStart);
    count();
  }
  function quizPool() {
    var st = store();
    return C().ITEMS.filter(function (it) {
      if (qz.scope !== 'ALL' && it.unit !== qz.scope) return false;
      if (qz.mode === 'missed') return st.missed[it.id] && !st.missed[it.id].fixed;
      if (qz.mode === 'unseen') return !st.items[it.id];
      return true;
    });
  }
  function quizStart() {
    var pool = quizPool();
    if (!pool.length) { U().toast('No questions match these settings yet.'); return; }
    qz.list = U().shuffle(pool).slice(0, qz.n); qz.i = 0; qz.score = 0; qz.results = [];
    quizDraw();
  }
  function quizDraw() {
    main().innerHTML = '<section class="screen"><div class="row"><a class="btn small ghost" href="#/quiz">Settings</a><span class="spacer"></span><span class="chip">' + (qz.i + 1) + ' / ' + qz.list.length + ' · score ' + qz.score + '</span></div>' + U().bar(U().pct(qz.i, qz.list.length), 'slim wide mt') +
      '<div id="qzBody" class="mt"></div><div class="row mt"><span class="spacer"></span><button class="btn primary" id="qzNext" disabled>' + (qz.i + 1 >= qz.list.length ? 'See results' : 'Next') + '</button></div></section>';
    var q = U().mcQuestion(document.getElementById('qzBody'), qz.list[qz.i], function (correct, res) {
      qz.results.push({ unit: qz.list[qz.i].unit, topic: qz.list[qz.i].topic, correct: correct });
      if (correct) qz.score++;
      res.newAchievements.forEach(function (a) { U().toast('Achievement unlocked: ' + a.name); });
      document.getElementById('qzNext').disabled = false; document.getElementById('qzNext').focus();
    });
    keyTarget = function (e) { return q.handleKey(e.key); };
    document.getElementById('qzNext').addEventListener('click', function () {
      qz.i++;
      if (qz.i >= qz.list.length) return quizFinish();
      quizDraw();
    });
  }
  function quizFinish() {
    var total = qz.list.length, byUnit = {};
    qz.results.forEach(function (r) { var b = byUnit[r.unit] || (byUnit[r.unit] = { a: 0, c: 0 }); b.a++; if (r.correct) b.c++; });
    var html = '<section class="screen"><div class="panel center"><p class="eyebrow">Quiz result</p><div class="stat">' + qz.score + ' / ' + total + '</div><p>' + U().pct(qz.score, total) + '% correct</p></div>';
    html += '<h2 class="section-title">By chapter</h2><div class="grid">' + Object.keys(byUnit).map(function (u) { var b = byUnit[u]; return '<div class="panel"><strong>' + esc(C().unitName[u]) + '</strong>' + U().bar(U().pct(b.c, b.a), 'slim') + '<p class="small muted">' + b.c + ' of ' + b.a + '</p></div>'; }).join('') + '</div>';
    html += '<div class="row mt"><button class="btn primary" id="qzAgain">New quiz</button><a class="btn" href="#/dashboard">Dashboard</a></div></section>';
    main().innerHTML = html;
    document.getElementById('qzAgain').addEventListener('click', quizStart);
  }

  // ---------- SCENARIOS ----------
  var sc = { scope: 'ALL', list: [], i: 0, score: 0 };
  function scenariosSetup(scope) {
    if (scope && C().hasUnit(scope)) sc.scope = scope;
    var n = C().ITEMS.filter(function (x) { return x.kind === 'scenario' && (sc.scope === 'ALL' || x.unit === sc.scope); }).length;
    main().innerHTML = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Decisions</p><h1>Scenario challenges</h1></div></div>' +
      '<div class="panel"><label class="field">Chapter<select id="scScope">' + unitSelect(sc.scope, true) + '</select></label><p class="muted small">' + n + ' scenarios available.</p>' +
      '<div class="row"><button class="btn primary" id="scStart"' + (n ? '' : ' disabled') + '>Start (up to 10)</button></div></div></section>';
    document.getElementById('scScope').addEventListener('change', function () { sc.scope = this.value; scenariosSetup(); });
    document.getElementById('scStart').addEventListener('click', scenariosStart);
  }
  function scenariosStart() {
    sc.list = U().shuffle(C().ITEMS.filter(function (x) { return x.kind === 'scenario' && (sc.scope === 'ALL' || x.unit === sc.scope); })).slice(0, 10);
    sc.i = 0; sc.score = 0; scenariosDraw();
  }
  function scenariosDraw() {
    main().innerHTML = '<section class="screen"><div class="row"><a class="btn small ghost" href="#/scenarios">Settings</a><span class="spacer"></span><span class="chip">' + (sc.i + 1) + ' / ' + sc.list.length + ' · score ' + sc.score + '</span></div><div id="scBody" class="mt"></div><div class="row mt"><span class="spacer"></span><button class="btn primary" id="scNext" disabled>' + (sc.i + 1 >= sc.list.length ? 'Finish' : 'Next') + '</button></div></section>';
    var q = U().mcQuestion(document.getElementById('scBody'), sc.list[sc.i], function (correct) {
      if (correct) sc.score++;
      document.getElementById('scNext').disabled = false; document.getElementById('scNext').focus();
    });
    keyTarget = function (e) { return q.handleKey(e.key); };
    document.getElementById('scNext').addEventListener('click', function () {
      sc.i++;
      if (sc.i >= sc.list.length) { main().innerHTML = '<section class="screen"><div class="panel center"><h2>Scenarios complete</h2><div class="stat">' + sc.score + ' / ' + sc.list.length + '</div><a class="btn primary" href="#/scenarios">Again</a></div></section>'; return; }
      scenariosDraw();
    });
  }

  // ---------- PERSONAL SESSION (5, 10, 15, 30 minutes; focus mode) ----------
  var ss = { steps: [], i: 0, score: 0, done: 0, focus: false, minutes: 10 };
  function sessionSetup(minutes) {
    ss.minutes = +minutes || store().settings.sessionMinutes || 10;
    LAS.core.store.get().settings.sessionMinutes = ss.minutes; LAS.core.store.save();
    var plan = P().build(ss.minutes);
    var counts = { q: 0, card: 0, tf: 0, fill: 0 };
    plan.steps.forEach(function (s) { counts[s.type]++; });
    main().innerHTML = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Plan</p><h1>My ' + ss.minutes + '-minute session</h1></div></div>' +
      '<div class="grid"><div class="panel"><p class="eyebrow">Steps</p><div class="stat">' + plan.steps.length + '</div><p class="small muted">about ' + plan.estimate + ' min</p></div>' +
      '<div class="panel"><p class="eyebrow">Mix</p><p class="small">' + counts.q + ' questions · ' + counts.card + ' cards · ' + counts.tf + ' true/false · ' + counts.fill + ' fill-in</p></div></div>' +
      '<div class="panel mt"><p>The plan puts missed questions first, then cards due for review, then weak topics, then new material.</p>' +
      '<div class="row"><button class="btn primary" id="ssStart"' + (plan.steps.length ? '' : ' disabled') + '>Start</button><button class="btn" id="ssFocus"' + (plan.steps.length ? '' : ' disabled') + '>Start in Focus mode</button></div>' +
      (plan.steps.length ? '' : '<p class="muted small mt">Nothing to plan yet. Try a quiz or a lesson first.</p>') + '</div></section>';
    ss.steps = plan.steps;
    var go = function (focus) { return function () { ss.i = 0; ss.score = 0; ss.done = 0; ss.focus = focus; document.body.classList.toggle('focus-mode', focus); sessionDraw(); }; };
    var a = document.getElementById('ssStart'); if (a) a.addEventListener('click', go(false));
    var b = document.getElementById('ssFocus'); if (b) b.addEventListener('click', go(true));
  }
  function sessionDraw() {
    if (ss.i >= ss.steps.length) return sessionFinish();
    var s = ss.steps[ss.i];
    var head = '<div class="row"><button class="btn small ghost" id="ssQuit">End session</button><span class="spacer"></span><span class="chip">' + (ss.i + 1) + ' / ' + ss.steps.length + '</span>' + (ss.focus ? '<span class="chip">Focus</span>' : '') + '</div>' + U().bar(U().pct(ss.i, ss.steps.length), 'slim wide mt') +
      (s.reason ? '<p class="small muted center mt">' + esc(s.reason) + '</p>' : '');
    main().innerHTML = '<section class="screen">' + head + '<div id="ssBody" class="mt"></div><div id="ssNext" class="row mt"></div></section>';
    document.getElementById('ssQuit').addEventListener('click', sessionFinish);
    keyTarget = null;
    var next = function () { ss.i++; sessionDraw(); };
    var nextBtn = function (label) {
      document.getElementById('ssNext').innerHTML = '<span class="spacer"></span><button class="btn primary" id="ssGo">' + label + '</button>';
      document.getElementById('ssGo').addEventListener('click', next); document.getElementById('ssGo').focus();
    };
    if (s.type === 'q') {
      var q = U().mcQuestion(document.getElementById('ssBody'), s.item, function (correct, res) {
        ss.done++; if (correct) ss.score++;
        res.newAchievements.forEach(function (a) { U().toast('Achievement unlocked: ' + a.name); });
        nextBtn(ss.i + 1 >= ss.steps.length ? 'Finish' : 'Next');
      });
      keyTarget = function (e) { return q.handleKey(e.key); };
    } else if (s.type === 'card') {
      var c = s.card;
      document.getElementById('ssBody').innerHTML = '<div class="flash-wrap"><button class="flash" id="ssFlash" aria-label="Flashcard. Activate to flip."><span class="face front"><span class="ftext">' + esc(c.front) + '</span><span class="hint">Tap to flip</span></span><span class="face back"><span class="ftext">' + esc(c.back) + '</span></span></button></div><div id="ssRate"></div>';
      document.getElementById('ssFlash').addEventListener('click', function () {
        this.classList.add('flipped');
        document.getElementById('ssRate').innerHTML = '<div class="rate-row"><button class="btn bad" data-g="1">Again</button><button class="btn" data-g="2">Hard</button><button class="btn good" data-g="3">Good</button><button class="btn primary" data-g="4">Easy</button></div>';
        document.querySelectorAll('#ssRate [data-g]').forEach(function (b) { b.addEventListener('click', function () { var r = L().rateCard(c.id, +b.getAttribute('data-g')); U().xpPop(r.xp); ss.done++; if (+b.getAttribute('data-g') >= 3) ss.score++; next(); }); });
      });
    } else if (s.type === 'tf') {
      var t = s.tf;
      document.getElementById('ssBody').innerHTML = '<article class="qcard"><div class="meta"><span class="chip">True or false</span><span class="chip ghost">' + esc(C().unitName[t.unit] || '') + '</span></div><h2 class="qtext">' + esc(t.s) + '</h2><div class="row"><button class="btn good" data-tf="1">True (T)</button><button class="btn bad" data-tf="0">False (F)</button></div><div id="tfFb"></div></article>';
      var answerTf = function (val) {
        var ok = val === t.a;
        var res = L().recordItem({ id: t.id, unit: t.unit, topic: t.topic }, ok, { kind: 'tf' });
        U().xpPop(res.xp); ss.done++; if (ok) ss.score++;
        document.getElementById('tfFb').innerHTML = '<div class="feedback ' + (ok ? 'ok' : 'no') + '"><strong>' + (ok ? 'Correct' : 'Not quite') + '.</strong> ' + esc(t.e) + '</div>';
        document.querySelectorAll('[data-tf]').forEach(function (b) { b.disabled = true; });
        nextBtn(ss.i + 1 >= ss.steps.length ? 'Finish' : 'Next');
      };
      document.querySelectorAll('[data-tf]').forEach(function (b) { b.addEventListener('click', function () { answerTf(b.getAttribute('data-tf') === '1'); }); });
      keyTarget = function (e) { var k = e.key.toLowerCase(); if (k === 't') { answerTf(true); return true; } if (k === 'f') { answerTf(false); return true; } return false; };
    } else if (s.type === 'fill') {
      var f = s.fill;
      document.getElementById('ssBody').innerHTML = '<article class="qcard"><div class="meta"><span class="chip">Fill in the term</span><span class="chip ghost">' + esc(C().unitName[f.unit] || '') + '</span></div><h2 class="qtext">' + esc(f.prompt) + '</h2><label class="field">Type the term<input id="flIn" type="text" autocomplete="off" placeholder="Your answer"></label><div class="row"><button class="btn primary" id="flSubmit">Check</button></div><div id="flFb"></div></article>';
      var inp = document.getElementById('flIn'); inp.focus();
      var submitFill = function () {
        if (!inp.value.trim()) return;
        var ok = LAS.core.learning.gradeTyped(inp.value, f.answer);
        var res = L().recordItem({ id: f.id, unit: f.unit, topic: f.topic }, ok, { kind: 'fill' });
        U().xpPop(res.xp); ss.done++; if (ok) ss.score++;
        document.getElementById('flFb').innerHTML = '<div class="feedback ' + (ok ? 'ok' : 'no') + '"><strong>' + (ok ? 'Correct' : 'Not quite') + '.</strong> The term is <strong>' + esc(f.answer[0]) + '</strong>.</div>';
        inp.disabled = true; document.getElementById('flSubmit').disabled = true;
        nextBtn(ss.i + 1 >= ss.steps.length ? 'Finish' : 'Next');
      };
      document.getElementById('flSubmit').addEventListener('click', submitFill);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitFill(); } });
    }
  }
  function sessionFinish() {
    clearTimers();
    document.body.classList.remove('focus-mode');
    var st = store(); st.sessions = (st.sessions || 0) + 1; LAS.core.store.save();
    var done = ss.done, score = ss.score;
    main().innerHTML = '<section class="screen"><div class="panel center"><p class="eyebrow">Session complete</p><div class="stat">' + score + ' / ' + done + '</div><p class="muted">Correct or rated as good. Missed items come back in your next session.</p><div class="row" style="justify-content:center"><a class="btn primary" href="#/session/' + (ss.minutes || 10) + '">Plan another</a><a class="btn" href="#/dashboard">Dashboard</a></div></div></section>';
    ss.steps = [];
    U().renderHud();
  }

  // ---------- MOCK EXAM ----------
  var mk = { n: 50, minutes: 60, list: [], i: 0, answers: [], endAt: 0, submitted: false };
  function mockSetup() {
    main().innerHTML = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Exam simulation</p><h1>Timed mock exam</h1></div></div>' +
      '<div class="panel"><p class="muted">No feedback until you finish. The pass mark used here is 70%, the PSI pass mark.</p>' +
      '<label class="field">Questions<select id="mkN">' + [25, 50, 100].map(function (n) { return '<option value="' + n + '"' + (mk.n === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">Time limit (minutes)<input id="mkMin" type="number" min="5" max="300" value="' + mk.minutes + '"></label>' +
      '<p class="small muted">Question bank: ' + C().ITEMS.length + ' items. These are practice questions, not official PSI questions.</p>' +
      '<div class="row"><button class="btn primary" id="mkStart">Start mock exam</button></div></div>' +
      (store().mocks.length ? '<h2 class="section-title">Past mocks</h2>' + store().mocks.slice().reverse().map(function (m) { return '<div class="panel mb"><strong>' + esc(m.date) + '</strong> · ' + m.score + '/' + m.total + ' (' + U().pct(m.score, m.total) + '%)</div>'; }).join('') : '') + '</section>';
    document.getElementById('mkStart').addEventListener('click', mockStart);
  }
  function mockStart() {
    mk.n = +document.getElementById('mkN').value;
    mk.minutes = Math.max(5, +document.getElementById('mkMin').value || 60);
    mk.list = U().shuffle(C().ITEMS).slice(0, Math.min(mk.n, C().ITEMS.length));
    mk.i = 0; mk.answers = []; mk.submitted = false; mk.endAt = Date.now() + mk.minutes * 60000;
    clearTimers(); timers.push(setInterval(mockTick, 1000)); mockDraw();
  }
  function mockTick() {
    var left = (mk.endAt - Date.now()) / 1000, el = document.getElementById('mkTimer');
    if (el) { el.textContent = U().fmtTime(left); el.classList.toggle('urgent', left < 300); }
    if (left <= 0 && !mk.submitted) { clearTimers(); mockFinish(true); }
  }
  function mockDraw() {
    var it = mk.list[mk.i], sel = mk.answers[mk.i];
    var html = '<section class="screen"><div class="row"><span class="timer" id="mkTimer">' + U().fmtTime((mk.endAt - Date.now()) / 1000) + '</span><span class="spacer"></span><span class="chip">' + (mk.i + 1) + ' / ' + mk.list.length + '</span><span class="chip">answered ' + mk.answers.filter(function (x) { return x !== undefined; }).length + '</span></div>' + U().bar(U().pct(mk.i, mk.list.length), 'slim wide mt');
    html += '<article class="qcard"><div class="meta"><span class="chip">' + esc(C().unitName[it.unit] || '') + '</span></div>' + (it.situation ? '<p class="situation">' + esc(it.situation) + '</p>' : '') + '<h2 class="qtext">' + esc(it.q) + '</h2><div class="choices">' +
      it.choices.map(function (c, i) { return '<button class="choice' + (sel === i ? ' picked' : '') + '" data-i="' + i + '" aria-pressed="' + (sel === i) + '"><span class="key">' + U().LETTERS[i] + '</span><span class="ctext">' + esc(c) + '</span></button>'; }).join('') + '</div></article>';
    html += '<div class="row mt"><button class="btn" id="mkPrev"' + (mk.i === 0 ? ' disabled' : '') + '>Previous</button><span class="spacer"></span>' + (mk.i + 1 < mk.list.length ? '<button class="btn primary" id="mkNext">Next</button>' : '') + '<button class="btn good" id="mkSubmit">Finish and grade</button></div></section>';
    main().innerHTML = html;
    document.querySelectorAll('.choices .choice').forEach(function (b) { b.addEventListener('click', function () { mk.answers[mk.i] = +b.getAttribute('data-i'); mockDraw(); }); });
    var p = document.getElementById('mkPrev'), n = document.getElementById('mkNext');
    if (p) p.addEventListener('click', function () { mk.i = Math.max(0, mk.i - 1); mockDraw(); });
    if (n) n.addEventListener('click', function () { mk.i = Math.min(mk.list.length - 1, mk.i + 1); mockDraw(); });
    document.getElementById('mkSubmit').addEventListener('click', function () { if (window.confirm('Finish the mock exam now?')) mockFinish(false); });
    keyTarget = function (e) { var idx = U().LETTERS.indexOf(e.key.toUpperCase()); if (idx >= 0 && idx < it.choices.length) { mk.answers[mk.i] = idx; mockDraw(); return true; } return false; };
  }
  function mockFinish(auto) {
    if (mk.submitted) return;
    mk.submitted = true; clearTimers(); keyTarget = null;
    var score = 0, byUnit = {}, byTopic = {}, wrong = [];
    mk.list.forEach(function (it, i) {
      var ok = mk.answers[i] === it.answer; if (ok) score++;
      var u = byUnit[it.unit] || (byUnit[it.unit] = { a: 0, c: 0 }); u.a++; if (ok) u.c++;
      var t = byTopic[it.topic] || (byTopic[it.topic] = { a: 0, c: 0 }); t.a++; if (ok) t.c++;
      L().recordItem(it, ok, { kind: 'mock' });
      if (!ok) wrong.push({ it: it, given: mk.answers[i] });
    });
    var st = store();
    st.mocks.push({ date: new Date().toLocaleString(), score: score, total: mk.list.length, minutes: mk.minutes });
    var pctScore = U().pct(score, mk.list.length);
    if (pctScore >= 70) L().checkAchievements({ kind: 'mock-70' }).forEach(function (a) { U().toast('Achievement unlocked: ' + a.name); });
    LAS.core.store.save();
    var html = '<section class="screen"><div class="panel center"><p class="eyebrow">' + (auto ? 'Time is up · ' : '') + 'Mock result</p><div class="stat">' + score + ' / ' + mk.list.length + '</div><p>' + pctScore + '% · ' + (pctScore >= 70 ? '<span class="chip good">at or above 70%</span>' : '<span class="chip bad">below 70%</span>') + '</p></div>';
    html += '<h2 class="section-title">Breakdown by chapter</h2><div class="grid">' + Object.keys(byUnit).map(function (u) { var b = byUnit[u]; return '<div class="panel"><strong>' + esc(C().unitName[u]) + '</strong>' + U().bar(U().pct(b.c, b.a), 'slim') + '<p class="small muted">' + b.c + ' of ' + b.a + '</p></div>'; }).join('') + '</div>';
    html += '<h2 class="section-title">Topics to review</h2><ul class="plain">' + Object.keys(byTopic).filter(function (t) { return byTopic[t].c < byTopic[t].a; }).sort(function (a, b) { return U().pct(byTopic[a].c, byTopic[a].a) - U().pct(byTopic[b].c, byTopic[b].a); }).slice(0, 10).map(function (t) { return '<li>' + esc(t) + ' · ' + byTopic[t].c + '/' + byTopic[t].a + '</li>'; }).join('') + '</ul>';
    html += '<h2 class="section-title">Missed questions</h2>';
    if (!wrong.length) html += '<p>No misses.</p>';
    wrong.slice(0, 60).forEach(function (w) {
      html += '<div class="panel mb"><div class="meta"><span class="chip">' + esc(C().unitName[w.it.unit]) + '</span><span class="chip ghost">' + esc(w.it.topic) + '</span></div><p><strong>' + esc(w.it.q) + '</strong></p><p class="small">Your answer: ' + (w.given === undefined ? 'no answer' : U().LETTERS[w.given] + ' ' + esc(w.it.choices[w.given])) + '</p><p class="small">Correct: <strong>' + U().LETTERS[w.it.answer] + ' ' + esc(w.it.choices[w.it.answer]) + '</strong></p><p class="small muted">' + esc(w.it.explain) + '</p></div>';
    });
    html += '<div class="row mt"><a class="btn primary" href="#/session/15">Build a session from my misses</a><a class="btn" href="#/mock">New mock</a></div></section>';
    main().innerHTML = html;
    U().renderHud();
  }

  // Keyboard routing for the active screen
  document.addEventListener('keydown', function (e) {
    if (!keyTarget) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (keyTarget(e)) e.preventDefault();
  });

  LAS.ui = LAS.ui || {};
  LAS.ui.studyScreens = {
    clearTimers: clearTimers,
    flashSetup: flashSetup, recallSetup: recallSetup, quizSetup: quizSetup, scenariosSetup: scenariosSetup,
    sessionSetup: sessionSetup, mockSetup: mockSetup,
    resetKeys: function () { keyTarget = null; }
  };
})(window.LAS = window.LAS || {});
