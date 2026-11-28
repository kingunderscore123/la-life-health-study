// UI components shared by all screens: HUD, progress bars, toasts, XP pop-ups, and the question card.
// Namespace: window.LAS.ui.components
(function (LAS) {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var DAY = 86400000;
  var EXAM = new Date(2026, 11, 22, 8, 0, 0);
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function shuffle(a) { var b = a.slice(); for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function fmtTime(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function daysLeft() { return Math.ceil((EXAM.getTime() - Date.now()) / DAY); }

  // Turns a stored source ("Name https://url" or a bare URL) into a readable, clickable source line.
  function srcLink(source) {
    var s = String(source || '').trim(); if (!s) return '';
    var m = s.match(/https?:\/\/\S+/), url = m ? m[0] : '', name = (url ? s.replace(url, '') : s).trim().replace(/[.,;:]+$/, '');
    if (!name && url) { try { name = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { name = url; } }
    return '<div class="small muted src-line">Source: ' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(name) + '</a>' : esc(name)) + '</div>';
  }

  function bar(p, cls) { return '<div class="bar ' + (cls || '') + '"><span style="width:' + Math.max(0, Math.min(100, p)) + '%"></span></div>'; }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  // XP pop-up: a small floating label near the HUD
  function xpPop(n) {
    if (!n) return;
    var el = document.createElement('div');
    el.className = 'xp-pop' + (n < 0 ? ' neg' : '');
    el.textContent = '+' + n + ' XP';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1200);
  }

  // HUD: level, XP bar, streak, today's goal, exam countdown, readiness
  function hud() {
    var store = LAS.core.store.get();
    var li = LAS.core.learning.levelInfo(store.xp);
    var today = LAS.core.learning.todayXp();
    var goal = LAS.core.learning.dailyGoal();
    var days = daysLeft();
    var streak = store.streak.count || 0;
    return '<div class="hud" role="region" aria-label="Your progress">' +
      '<div class="hud-cell level"><span class="hud-badge">Lv ' + li.level + '</span><span class="hud-title">' + esc(li.title) + '</span>' +
        '<div class="xpbar" aria-label="XP ' + store.xp + ' with ' + li.pct + ' percent to next level"><span style="width:' + li.pct + '%"></span></div><span class="hud-sub">' + store.xp + ' XP</span></div>' +
      '<div class="hud-cell"><span class="hud-stat"><span class="flame" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.6 3.2 2.9 4.9 4.6 7.1C18.3 11.2 19 12.9 19 15a7 7 0 0 1-14 0c0-2.4 1.1-4.2 2.5-5.7.2 1.6 1 2.9 2.2 3.5C9.5 8.4 10.4 5 12 2z"/></svg></span> ' + streak + '</span><span class="hud-sub">day streak</span></div>' +
      '<div class="hud-cell"><span class="hud-stat">' + Math.min(today, goal) + '/' + goal + '</span><span class="hud-sub">daily goal XP</span><div class="xpbar slim"><span style="width:' + pct(Math.min(today, goal), goal) + '%"></span></div></div>' +
      '<div class="hud-cell"><span class="hud-stat">' + (days > 0 ? days : 0) + '</span><span class="hud-sub">days to exam (Dec 22, 2026)</span></div>' +
      '</div>';
  }
  function renderHud() { var h = $('#hud'); if (h) h.innerHTML = hud(); }

  // Multiple-choice question. The answer is hidden until the student picks one (never revealed before an attempt).
  // Choices are shuffled so the correct letter is random. Keys A to F choose; feedback is immediate.
  function mcQuestion(container, item, onAnswer, opts) {
    opts = opts || {};
    var L = LAS.core.learning;
    var order = shuffle(item.choices.map(function (c, i) { return { text: c, orig: i }; }));
    var html = '<article class="qcard">' +
      '<div class="meta"><span class="chip">' + esc(LAS.core.content.unitName[item.unit] || '') + '</span><span class="chip ghost">' + esc(item.topic) + '</span>' + (item.kind === 'scenario' ? '<span class="chip scenario">Scenario</span>' : '') + '</div>';
    if (item.situation) html += '<p class="situation">' + esc(item.situation) + '</p>';
    html += '<h2 class="qtext">' + esc(item.q) + '</h2><div class="choices" role="group" aria-label="Answer choices">';
    order.forEach(function (c, i) {
      html += '<button class="choice" data-pos="' + i + '" data-orig="' + c.orig + '"><span class="key">' + LETTERS[i] + '</span><span class="ctext">' + esc(c.text) + '</span></button>';
    });
    html += '</div><div class="fb" aria-live="polite"></div></article>';
    container.innerHTML = html;
    var answered = false;
    var btns = container.querySelectorAll('.choice');
    function pick(btn) {
      if (answered || !btn) return; answered = true;
      var picked = +btn.getAttribute('data-orig');
      var correct = L.gradeChoice(item, picked);
      btns.forEach(function (b) {
        b.disabled = true;
        if (+b.getAttribute('data-orig') === item.answer) b.classList.add('correct');
        else if (b === btn) b.classList.add('wrong');
      });
      var res = L.recordItem(item, correct, { kind: opts.kind });
      xpPop(res.xp);
      var fb = container.querySelector('.fb');
      fb.innerHTML = '<div class="feedback ' + (correct ? 'ok' : 'no') + '"><strong>' + (correct ? 'Correct' : 'Not quite') + '.</strong> ' + esc(item.explain) +
        (correct ? '' : '<div class="muted">Correct answer: ' + LETTERS[order.map(function (c) { return c.orig; }).indexOf(item.answer)] + ' · ' + esc(item.choices[item.answer]) + '</div>') + srcLink(item.source) + '</div>';
      renderHud();
      if (onAnswer) onAnswer(correct, res);
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { pick(b); }); });
    return {
      handleKey: function (key) {
        var idx = LETTERS.indexOf(String(key).toUpperCase());
        if (!answered && idx >= 0 && idx < order.length) { pick(btns[idx]); return true; }
        return false;
      },
      answered: function () { return answered; }
    };
  }

  LAS.ui = LAS.ui || {};
  LAS.ui.components = {
    $: $, esc: esc, shuffle: shuffle, pct: pct, fmtTime: fmtTime, daysLeft: daysLeft, bar: bar,
    toast: toast, xpPop: xpPop, hud: hud, renderHud: renderHud, mcQuestion: mcQuestion, LETTERS: LETTERS, srcLink: srcLink
  };
})(window.LAS = window.LAS || {});
