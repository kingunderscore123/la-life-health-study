// App bootstrap and router. Maps hash routes to screens and wires lesson, backup, and reset actions.
// Load order (see index.html): data -> core -> ui -> this file.
(function (LAS) {
  'use strict';
  var U = function () { return LAS.ui.components; };
  var CS = function () { return LAS.ui.coreScreens; };
  var SS = function () { return LAS.ui.studyScreens; };
  var GS = function () { return LAS.ui.gameScreens; };
  var store = function () { return LAS.core.store.get(); };
  var main = function () { return document.getElementById('app'); };

  var NAV = ['dashboard', 'lessons', 'flashcards', 'recall', 'quiz', 'session', 'games', 'scenarios', 'mock', 'achievements', 'reference', 'progress', 'help'];

  function setNav(name) {
    document.querySelectorAll('.nav a').forEach(function (a) {
      if (a.getAttribute('data-nav') === name || (name === 'focus' && a.getAttribute('data-nav') === 'session')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function stop() { SS().clearTimers(); GS().clearTimers(); SS().resetKeys(); GS().resetKeys(); document.body.classList.remove('focus-mode'); }

  function route() {
    var h = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = h.split('/').map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    var name = parts[0] || 'dashboard';
    var arg = parts[1], arg2 = parts[2];
    stop();
    var out = '';
    switch (name) {
      case 'dashboard': out = CS().dashboard(); break;
      case 'lessons': out = CS().lessonsIndex(); break;
      case 'lesson': out = CS().lesson(arg, arg2); break;
      case 'reference': out = CS().reference(); break;
      case 'search': out = CS().search(parts.slice(1).join('/')); break;
      case 'achievements': out = CS().achievements(); break;
      case 'progress': out = CS().progress(); break;
      case 'help': out = CS().help(); break;
      case 'games': out = GS().hub(); break;
      case 'match': return finishRoute('games', function () { GS().matchSetup(); });
      case 'tf': return finishRoute('games', function () { GS().tfSetup(); });
      case 'fill': return finishRoute('games', function () { GS().fillSetup(); });
      case 'sort': return finishRoute('games', function () { GS().sortSetup(); });
      case 'boss': return finishRoute('games', function () { GS().bossSetup(arg); });
      case 'timed': return finishRoute('games', function () { GS().timedSetup('timed'); });
      case 'mixed': return finishRoute('games', function () { GS().timedSetup('mixed'); });
      case 'flashcards': return finishRoute('flashcards', function () { SS().flashSetup(arg); });
      case 'recall': return finishRoute('recall', function () { SS().recallSetup(arg); });
      case 'quiz': return finishRoute('quiz', function () { SS().quizSetup(arg); });
      case 'scenarios': return finishRoute('scenarios', function () { SS().scenariosSetup(arg); });
      case 'mock': return finishRoute('mock', function () { SS().mockSetup(); });
      case 'session': return finishRoute('session', function () { SS().sessionSetup(arg); });
      case 'focus': return finishRoute('session', function () { SS().sessionSetup(store().settings.sessionMinutes || 10); document.body.classList.add('focus-mode'); });
      default: out = CS().dashboard();
    }
    setNav(NAV.indexOf(name) >= 0 ? name : 'dashboard');
    main().innerHTML = out;
    U().renderHud();
    window.scrollTo && (function () { try { window.scrollTo(0, 0); } catch (e) { /* not supported */ } })();
    main().focus({ preventScroll: true });
  }
  function finishRoute(navName, fn) {
    setNav(navName);
    fn();
    U().renderHud();
    try { window.scrollTo(0, 0); } catch (e) { /* not supported */ }
    main().focus({ preventScroll: true });
  }

  // ---------- global actions (delegated) ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'expand-all') document.querySelectorAll('details.section').forEach(function (d) { d.open = true; });
    else if (act === 'collapse-all') document.querySelectorAll('details.section').forEach(function (d) { d.open = false; });
    else if (act === 'toggle-read') {
      var id = t.getAttribute('data-section');
      var st = store();
      var wasRead = !!st.read[id];
      if (wasRead) delete st.read[id]; else { st.read[id] = true; var r = LAS.core.learning.addXp(15); U().xpPop(r.xp); LAS.core.learning.checkAchievements({}).forEach(function (a) { U().toast('Achievement unlocked: ' + a.name); }); }
      LAS.core.store.save();
      var open = []; document.querySelectorAll('details.section[open]').forEach(function (d) { open.push(d.getAttribute('data-section')); });
      if (open.indexOf(id) < 0) open.push(id);
      var lessonId = id.split('-s')[0];
      main().innerHTML = CS().lesson(lessonId, null, open);
      U().renderHud();
    }
    else if (act === 'export') exportBackup();
    else if (act === 'reset') resetAll();
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'importFile') importBackup(e.target.files[0]);
  });

  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportBackup() {
    download('la-life-health-backup-' + LAS.core.store.todayKey() + '.json', JSON.stringify(store(), null, 2));
    var m = document.getElementById('backupMsg'); if (m) m.textContent = 'Backup file downloaded. Keep it somewhere safe.';
    U().toast('Backup exported.');
  }
  function importBackup(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        LAS.core.store.replace(obj);
        U().toast('Progress imported.');
        location.hash = '#/progress';
        route();
      } catch (err) {
        var m = document.getElementById('backupMsg'); if (m) m.textContent = 'That file is not a valid backup.';
      }
    };
    reader.readAsText(file);
  }
  function resetAll() {
    if (!window.confirm('Erase all progress on this computer? Export a backup first if you want to keep it.')) return;
    LAS.core.store.reset();
    U().toast('Progress reset.');
    route();
  }

  // ---------- keyboard shortcut for Focus mode exit ----------
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) { location.hash = '#/dashboard'; }
  });

  // ---------- search box ----------
  var searchForm = document.getElementById('searchForm');
  if (searchForm) searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = document.getElementById('searchInput').value.trim();
    location.hash = '#/search/' + encodeURIComponent(v);
  });

  // ---------- start ----------
  LAS.core.store.load();
  window.addEventListener('hashchange', route);
  if (!location.hash) location.hash = '#/dashboard';
  // Count a study day when the app opens (streak logic is in the engine).
  try { LAS.core.learning.addXp(0); } catch (e) { /* ignore */ }
  route();
})(window.LAS = window.LAS || {});
