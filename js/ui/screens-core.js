// Core screens: dashboard, lessons, reference, search, achievements, progress, help.
// Namespace: window.LAS.ui.coreScreens
(function (LAS) {
  'use strict';
  var U = function () { return LAS.ui.components; };
  var C = function () { return LAS.core.content; };
  var L = function () { return LAS.core.learning; };
  var store = function () { return LAS.core.store.get(); };
  var esc = function (s) { return U().esc(s); };
  var pct = function (a, b) { return U().pct(a, b); };

  function unitProgress(u) {
    var st = store();
    var lesson = C().lessons.filter(function (l) { return l.id === u; })[0];
    var secs = lesson ? lesson.sections : [];
    var read = secs.filter(function (s) { return !!st.read[s.id]; }).length;
    var cards = C().cardsForUnit(u);
    var mastered = cards.filter(function (c) { var s = st.cards[c.id]; return s && s.reps >= 2; }).length;
    var items = C().itemsForUnit(u);
    var seen = items.filter(function (it) { return st.items[it.id]; });
    var mastery = seen.length ? Math.round(100 * seen.reduce(function (s, it) { return s + st.items[it.id].mastery; }, 0) / items.length) : 0;
    return { read: read, total: secs.length, readPct: pct(read, secs.length), mastered: mastered, cards: cards.length, mastery: mastery, seen: seen.length, items: items.length };
  }

  // ---------- DASHBOARD ----------
  function dashboard() {
    var st = store();
    var ready = L().readiness(C().ITEMS.length);
    var weak = L().weakTopics(4);
    var unlocked = L().ACHIEVEMENTS.filter(function (a) { return st.achievements[a.id]; }).length;
    var due = C().CARDS.filter(function (c) { return L().isDue(c.id); }).length;
    var html = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Command center</p><h1>Dashboard</h1></div></div>';
    html += '<div class="grid-hero">' +
      '<div class="panel hero-panel"><p class="eyebrow">Start a session</p><h2>Study now</h2><p class="muted">Pick a length. The plan puts missed questions first, then due cards, then new material.</p>' +
      '<div class="length-row">' + [5, 10, 15, 30].map(function (m) { return '<a class="btn length' + (st.settings.sessionMinutes === m ? ' primary' : '') + '" href="#/session/' + m + '">' + m + ' min</a>'; }).join('') + '</div>' +
      '<div class="row mt"><a class="btn ghost" href="#/focus">Focus mode (one task at a time)</a></div></div>' +
      '<div class="panel"><p class="eyebrow">Exam readiness</p><div class="ring" style="--p:' + ready.score + '"><span>' + ready.score + '</span></div>' +
        '<p class="muted small">Practice-based estimate: how much you have practiced and how well you retain it. It is not a prediction of passing.</p>' +
        '<p class="small">Coverage ' + ready.coverage + '% · Mastery ' + ready.mastery + '%</p></div>' +
      '<div class="panel"><p class="eyebrow">Today</p><div class="stat-line"><span>Cards due</span><strong>' + due + '</strong></div>' +
        '<div class="stat-line"><span>Achievements</span><strong>' + unlocked + '/' + L().ACHIEVEMENTS.length + '</strong></div>' +
        '<div class="stat-line"><span>Questions answered</span><strong>' + Object.keys(st.items).length + '</strong></div>' +
        '<div class="row mt"><a class="btn small" href="#/games">Play a game</a><a class="btn small" href="#/achievements">Achievements</a></div></div>' +
      '</div>';
    html += '<h2 class="section-title">Chapters</h2><div class="unit-grid">';
    C().UNIT_ORDER.forEach(function (u) {
      var p = unitProgress(u);
      var label = (C().lessons.filter(function (l) { return l.id === u; })[0] || {}).label || u;
      var overall = Math.round(0.4 * p.readPct + 0.3 * pct(p.mastered, p.cards) + 0.3 * p.mastery);
      html += '<a class="unit-card" href="#/lesson/' + esc(u) + '"><div class="row"><strong>' + esc(label) + '</strong><span class="spacer"></span><span class="chip ' + (overall >= 70 ? 'good' : '') + '">' + overall + '%</span></div>' +
        U().bar(overall, 'slim') + '<p class="small muted">Read ' + p.read + '/' + p.total + ' · Cards ' + p.mastered + '/' + p.cards + ' · Mastery ' + p.mastery + '%</p></a>';
    });
    html += '</div>';
    html += '<h2 class="section-title">Where to focus</h2>';
    if (weak.length) {
      html += '<div class="panel"><ul class="plain">' + weak.map(function (w) { return '<li>' + esc(w.topic) + ' <span class="chip ' + (w.acc < 70 ? 'bad' : 'warn') + '">' + w.acc + '% of ' + w.a + '</span></li>'; }).join('') + '</ul>' +
        '<a class="btn small primary" href="#/session/15">Build a 15-minute session from these</a></div>';
    } else {
      html += '<div class="panel muted">Answer a few questions and your weakest topics will appear here.</div>';
    }
    html += '</section>';
    return html;
  }

  // ---------- LESSONS ----------
  function lessonsIndex() {
    var html = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Learn</p><h1>Lessons</h1></div></div><div class="lesson-list">';
    C().lessons.forEach(function (l) {
      var p = unitProgress(l.id);
      html += '<a class="lesson-row" href="#/lesson/' + esc(l.id) + '"><div><strong>' + esc(l.title) + '</strong></div><span class="chip">' + p.read + '/' + p.total + ' read</span>' + U().bar(p.readPct, 'slim wide') + '</a>';
    });
    html += '<a class="lesson-row" href="#/reference"><div><strong>Reference</strong> · study plan and cheat sheet</div><span class="chip">Reference</span></a></div></section>';
    return html;
  }

  function lesson(id, sectionId, keepOpen) {
    var idx = C().lessons.map(function (l) { return l.id; }).indexOf(id);
    if (idx < 0) return '<section class="screen"><div class="empty">That chapter could not be found. <a href="#/lessons">Back to lessons</a></div></section>';
    var l = C().lessons[idx];
    var p = unitProgress(id);
    var prev = C().lessons[idx - 1], next = C().lessons[idx + 1];
    var html = '<section class="screen"><div class="row"><a class="btn small ghost" href="#/lessons">All lessons</a><span class="spacer"></span><span class="chip">' + p.read + '/' + p.total + ' sections read</span></div>';
    html += '<h1 class="mt">' + esc(l.title) + '</h1>' + U().bar(p.readPct, 'slim wide');
    if (l.intro) html += '<div class="lesson-intro">' + l.intro + '</div>';
    html += '<div class="row mt"><button class="btn small" data-act="expand-all">Open all</button><button class="btn small" data-act="collapse-all">Close all</button>' +
      (C().hasUnit(id) ? '<a class="btn small primary" href="#/quiz/' + esc(id) + '">Quiz this chapter</a><a class="btn small" href="#/boss/' + esc(id) + '">Chapter boss</a>' : '') + '</div>';
    l.sections.forEach(function (s, i) {
      var open = keepOpen ? keepOpen.indexOf(s.id) >= 0 : (sectionId ? sectionId === s.id : i === 0);
      var read = !!store().read[s.id];
      html += '<details class="section" data-section="' + esc(s.id) + '" id="' + esc(s.id) + '"' + (open ? ' open' : '') + '>' +
        '<summary>' + esc(s.title) + (read ? ' <span class="chip good small">read</span>' : '') + '</summary>' +
        '<div class="section-body">' + s.html + '<div class="row mt"><button class="btn small ' + (read ? 'good' : 'primary') + '" data-act="toggle-read" data-section="' + esc(s.id) + '" aria-pressed="' + read + '">' + (read ? 'Marked as read' : 'Mark as read (+15 XP)') + '</button></div></div></details>';
    });
    html += '<div class="row mt">' + (prev ? '<a class="btn" href="#/lesson/' + esc(prev.id) + '">' + esc(prev.short) + '</a>' : '') + '<span class="spacer"></span>' + (next ? '<a class="btn primary" href="#/lesson/' + esc(next.id) + '">' + esc(next.short) + '</a>' : '') + '</div></section>';
    return html;
  }

  // ---------- REFERENCE, SEARCH, ACHIEVEMENTS, PROGRESS, HELP ----------
  function reference() {
    var html = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Reference</p><h1>Study plan and cheat sheet</h1></div></div>';
    C().reference.forEach(function (r) { html += '<details class="section" open><summary>' + esc(r.title) + '</summary><div class="section-body">' + r.html + '</div></details>'; });
    return html + '</section>';
  }

  function snippet(text, at, term) {
    var start = Math.max(0, at - 60), end = Math.min(text.length, at + term.length + 80);
    var s = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
    var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return esc(s).replace(re, '<mark>$1</mark>');
  }
  function search(q) {
    var term = (q || '').trim().toLowerCase();
    var html = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Search</p><h1>Results for “' + esc(q) + '”</h1></div></div>';
    if (term.length < 2) return html + '<div class="empty">Type at least two letters in the search box.</div></section>';
    var hits = [];
    C().lessons.forEach(function (l) { l.sections.forEach(function (s) { var at = (s.title + ' ' + s.text).toLowerCase().indexOf(term); if (at >= 0) hits.push({ kind: 'Lesson', where: l.short + ' · ' + s.title, href: '#/lesson/' + l.id + '/' + s.id, snip: snippet(s.text, Math.max(0, at - 0), term) }); }); });
    C().reference.forEach(function (r) { var at = r.text.toLowerCase().indexOf(term); if (at >= 0) hits.push({ kind: 'Reference', where: r.title, href: '#/reference', snip: snippet(r.text, at, term) }); });
    C().CARDS.forEach(function (c) { var at = (c.front + ' ' + c.back).toLowerCase().indexOf(term); if (at >= 0) hits.push({ kind: 'Flashcard', where: C().unitName[c.unit] + ' · ' + c.topic, href: '#/flashcards/' + c.unit, snip: snippet(c.front + ' — ' + c.back, at, term) }); });
    C().ITEMS.forEach(function (it) { var at = (it.q + ' ' + it.explain).toLowerCase().indexOf(term); if (at >= 0) hits.push({ kind: 'Question', where: C().unitName[it.unit] + ' · ' + it.topic, href: '#/quiz/' + it.unit, snip: snippet(it.q, at, term) }); });
    if (!hits.length) return html + '<div class="empty">No matches. Try a shorter word, such as “annuity” or “grace”.</div></section>';
    html += '<p class="small muted">' + hits.length + ' matches (showing up to 80)</p>';
    hits.slice(0, 80).forEach(function (h) { html += '<a class="result" href="' + esc(h.href) + '"><div class="where">' + esc(h.kind) + ' · ' + esc(h.where) + '</div><div>' + h.snip + '</div></a>'; });
    return html + '</section>';
  }

  function achievements() {
    var st = store();
    var html = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Rewards</p><h1>Achievements</h1></div></div><div class="grid">';
    L().ACHIEVEMENTS.forEach(function (a) {
      var got = !!st.achievements[a.id];
      html += '<div class="panel ach ' + (got ? 'unlocked' : 'locked') + '"><div class="ach-icon" aria-hidden="true">' + (got ? '★' : '☆') + '</div><strong>' + esc(a.name) + '</strong><p class="small muted">' + esc(a.desc) + '</p><span class="chip ' + (got ? 'good' : '') + '">' + (got ? 'Unlocked' : 'Locked') + '</span></div>';
    });
    return html + '</div></section>';
  }

  function progress() {
    var st = store();
    var html = '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Your data</p><h1>Progress</h1></div></div>';
    html += '<div class="grid"><div class="panel"><p class="eyebrow">Level</p><div class="stat">' + LAS.core.learning.levelInfo(st.xp).level + '</div><p class="small muted">' + st.xp + ' XP total</p></div>' +
      '<div class="panel"><p class="eyebrow">Streak</p><div class="stat">' + st.streak.count + '</div><p class="small muted">days in a row</p></div>' +
      '<div class="panel"><p class="eyebrow">Mock exams</p><div class="stat">' + st.mocks.length + '</div><p class="small muted">taken</p></div></div>';
    html += '<h2 class="section-title">Backup and restore</h2><div class="panel"><p class="muted small">Save a copy of your progress before you reinstall or move computers.</p>' +
      '<div class="row"><button class="btn primary" data-act="export">Export backup file</button><label class="btn" for="importFile">Import backup file</label><input type="file" id="importFile" accept="application/json" class="sr-only"></div><p id="backupMsg" class="small" aria-live="polite"></p></div>';
    html += '<h2 class="section-title">Reset</h2><div class="panel"><p class="muted small">Erases all progress on this computer. Export a backup first.</p><button class="btn bad" data-act="reset">Reset all progress</button></div></section>';
    return html;
  }

  function help() {
    return '<section class="screen"><div class="screen-head"><div><p class="eyebrow">Guide</p><h1>How to use the app</h1></div></div>' +
      '<div class="panel"><h3>Start here</h3><ol class="steps"><li>Dashboard: choose a session length (5, 10, 15, or 30 minutes).</li><li>Lessons: read one section, then mark it as read.</li><li>Games: boss battles, speed rounds, sorting, and matching. Each one trains exam knowledge.</li><li>Mock exam: timed practice, graded at the end.</li></ol></div>' +
      '<div class="panel mt"><h3>Keyboard</h3><ul class="plain"><li><span class="kbd">A</span>–<span class="kbd">F</span> choose an answer</li><li><span class="kbd">T</span> / <span class="kbd">F</span> true or false (speed round)</li><li><span class="kbd">Space</span> flip a card · <span class="kbd">1</span>–<span class="kbd">4</span> rate a card</li><li><span class="kbd">Enter</span> submit a typed answer</li></ul></div>' +
      '<div class="panel mt"><h3>Your data</h3><p>Progress is saved on this computer automatically. Use Progress to export a backup.</p></div></section>';
  }

  LAS.ui = LAS.ui || {};
  LAS.ui.coreScreens = { dashboard: dashboard, lessonsIndex: lessonsIndex, lesson: lesson, reference: reference, search: search, achievements: achievements, progress: progress, help: help, unitProgress: unitProgress };
})(window.LAS = window.LAS || {});
