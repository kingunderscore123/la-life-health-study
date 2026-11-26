// Core learning engine: spaced repetition, answer recording, mastery, weak-topic detection,
// XP and levels, streaks, achievements, and grading. Pure logic; the UI calls these functions.
// Namespace: window.LAS.core.learning
(function (LAS) {
  'use strict';
  var S = function () { return LAS.core.store.get(); };
  var save = function () { return LAS.core.store.save(); };
  var DAY = 86400000;

  // ---------- grading (never reveals the answer; returns the verdict) ----------
  function gradeChoice(item, pickedOriginalIndex) {
    return pickedOriginalIndex === item.answer;
  }
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9%$.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function editDistance(a, b) {
    var m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    var prev = []; for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      var cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  // Fill-in grading: exact normalized match, or a typo of at most one letter per 7 characters.
  function gradeTyped(typed, accepted) {
    var t = norm(typed);
    if (!t) return false;
    var list = Array.isArray(accepted) ? accepted : [accepted];
    return list.some(function (a) {
      var target = norm(a);
      if (t === target) return true;
      var allowed = Math.floor(target.length / 7);
      return allowed > 0 && editDistance(t, target) <= allowed;
    });
  }

  // ---------- answer recording and mastery ----------
  // Records one attempt. Returns { xp, levelUp, newAchievements }.
  function recordItem(item, correct, opts) {
    opts = opts || {};
    var st = S();
    var now = Date.now();
    var it = st.items[item.id] || (st.items[item.id] = { a: 0, c: 0, mastery: 0, streak: 0, lastSeen: 0 });
    it.a++; if (correct) it.c++;
    it.mastery = Math.round((0.6 * it.mastery + 0.4 * (correct ? 1 : 0)) * 1000) / 1000;
    it.streak = correct ? it.streak + 1 : 0;
    it.lastSeen = now;
    var t = st.topics[item.topic] || (st.topics[item.topic] = { a: 0, c: 0 });
    t.a++; if (correct) t.c++;
    var u = st.units[item.unit] || (st.units[item.unit] = { a: 0, c: 0 });
    u.a++; if (correct) u.c++;
    if (correct) {
      if (st.missed[item.id]) st.missed[item.id].fixed = true;
    } else {
      var m = st.missed[item.id] || (st.missed[item.id] = { count: 0 });
      m.count++; m.last = now; m.fixed = false;
    }
    var gained = correct ? (it.a === 1 ? 15 : 10) : 2;
    if (opts.kind === 'boss') gained += correct ? 5 : 0;
    var res = addXp(gained);
    res.newAchievements = checkAchievements({ correctStreak: it.streak, answeredCorrect: correct, kind: opts.kind });
    save();
    return res;
  }

  // ---------- spaced repetition (simplified SM-2) ----------
  // grade: 1 Again, 2 Hard, 3 Good, 4 Easy
  function rateCard(cardId, grade) {
    var st = S();
    var s = st.cards[cardId] || { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0 };
    var now = Date.now();
    if (grade === 1) { s.lapses++; s.reps = 0; s.ease = Math.max(1.3, s.ease - 0.2); s.interval = 0; s.due = now + 10 * 60000; }
    else {
      s.reps++;
      if (grade === 2) { s.ease = Math.max(1.3, s.ease - 0.15); s.interval = Math.max(1, Math.round((s.interval || 1) * 1.2)); }
      else if (grade === 3) { s.interval = s.reps <= 1 ? 1 : Math.max(2, Math.round((s.interval || 1) * s.ease)); }
      else { s.ease += 0.15; s.interval = s.reps <= 1 ? 3 : Math.max(4, Math.round((s.interval || 1) * s.ease * 1.3)); }
      s.due = now + s.interval * DAY;
    }
    st.cards[cardId] = s;
    var res = addXp(grade >= 3 ? 5 : 1);
    res.newAchievements = checkAchievements({ cardsRated: Object.keys(st.cards).length });
    save();
    return res;
  }
  function isDue(cardId, now) { var s = S().cards[cardId]; return !s || s.due <= (now || Date.now()); }

  // ---------- mastery and readiness ----------
  function itemMastery(id) { var it = S().items[id]; return it ? it.mastery : 0; }
  function isMastered(id) { var it = S().items[id]; return !!it && it.a >= 3 && it.mastery >= 0.8; }
  function topicAccuracy(topic) { var t = S().topics[topic]; return t && t.a ? Math.round(100 * t.c / t.a) : null; }
  function weakTopics(limit) {
    var st = S();
    return Object.keys(st.topics).map(function (k) {
      var t = st.topics[k];
      return { topic: k, a: t.a, c: t.c, acc: t.a ? Math.round(100 * t.c / t.a) : 100 };
    }).filter(function (r) { return r.a >= 2; })
      .sort(function (x, y) { return x.acc - y.acc || y.a - x.a; }).slice(0, limit || 5);
  }
  // Readiness = coverage (items seen) x average mastery of seen items. Practice-based, not a prediction.
  function readiness(totalItems) {
    var st = S();
    var ids = Object.keys(st.items);
    if (!ids.length || !totalItems) return { score: 0, coverage: 0, mastery: 0, seen: 0 };
    var mastery = ids.reduce(function (s, id) { return s + st.items[id].mastery; }, 0) / ids.length;
    var coverage = Math.min(1, ids.length / totalItems);
    return { score: Math.round(100 * mastery * (0.5 + 0.5 * coverage)), coverage: Math.round(100 * coverage), mastery: Math.round(100 * mastery), seen: ids.length };
  }

  // ---------- XP, levels, streaks, achievements ----------
  var TITLES = ['Trainee', 'Apprentice', 'Agent', 'Producer', 'Account Executive', 'Senior Producer', 'Risk Specialist', 'Master Underwriter'];
  function levelFor(xp) { return Math.floor(Math.sqrt(xp / 50)) + 1; }
  function levelInfo(xp) {
    var lvl = levelFor(xp);
    var base = 50 * Math.pow(lvl - 1, 2), next = 50 * Math.pow(lvl, 2);
    return { level: lvl, title: TITLES[Math.min(TITLES.length - 1, lvl - 1)], into: xp - base, span: next - base, pct: Math.round(100 * (xp - base) / (next - base)) };
  }
  function addXp(n) {
    var st = S();
    var before = levelFor(st.xp);
    st.xp += n;
    var today = LAS.core.store.todayKey();
    st.daily[today] = (st.daily[today] || 0) + n;
    if (st.streak.last !== today) {
      var yesterday = LAS.core.store.todayKey(new Date(Date.now() - DAY));
      st.streak.count = st.streak.last === yesterday ? st.streak.count + 1 : 1;
      st.streak.last = today;
    }
    return { xp: n, levelUp: levelFor(st.xp) > before, level: levelFor(st.xp) };
  }
  var ACHIEVEMENTS = [
    { id: 'first-read', name: 'First Steps', desc: 'Read your first lesson section', test: function (c) { return Object.keys(S().read).length >= 1; } },
    { id: 'ten-read', name: 'Curious Mind', desc: 'Read 10 lesson sections', test: function () { return Object.keys(S().read).length >= 10; } },
    { id: 'card-50', name: 'Card Shark', desc: 'Rate 50 flashcards', test: function (c) { return (c.cardsRated || 0) >= 50; } },
    { id: 'streak-5', name: 'Sharp Mind', desc: 'Get 5 correct answers in a row on one question', test: function (c) { return (c.correctStreak || 0) >= 5; } },
    { id: 'streak-3d', name: 'Three-Day Run', desc: 'Study 3 days in a row', test: function () { return S().streak.count >= 3; } },
    { id: 'streak-7d', name: 'Week Strong', desc: 'Study 7 days in a row', test: function () { return S().streak.count >= 7; } },
    { id: 'boss-1', name: 'Boss Slayer', desc: 'Defeat a chapter boss', test: function (c) { return c.kind === 'boss-win'; } },
    { id: 'mock-70', name: 'Mock Ready', desc: 'Score 70% or more on a mock exam', test: function (c) { return c.kind === 'mock-70'; } },
    { id: 'xp-500', name: 'Five Hundred Club', desc: 'Earn 500 XP', test: function () { return S().xp >= 500; } },
    { id: 'match-fast', name: 'Matchmaker', desc: 'Clear a matching round in under 60 seconds', test: function (c) { return c.kind === 'match-fast'; } }
  ];
  function checkAchievements(ctx) {
    var st = S(); var fresh = [];
    ACHIEVEMENTS.forEach(function (a) {
      if (!st.achievements[a.id] && a.test(ctx || {})) { st.achievements[a.id] = Date.now(); fresh.push(a); }
    });
    return fresh;
  }
  function bossWinAchievement() { return checkAchievements({ kind: 'boss-win' }); }

  // ---------- daily goal and streak ----------
  function todayXp() { return S().daily[LAS.core.store.todayKey()] || 0; }
  function dailyGoal() { return S().dailyGoal || 60; }

  LAS.core.learning = {
    gradeChoice: gradeChoice, gradeTyped: gradeTyped, norm: norm,
    recordItem: recordItem, rateCard: rateCard, isDue: isDue,
    itemMastery: itemMastery, isMastered: isMastered, topicAccuracy: topicAccuracy,
    weakTopics: weakTopics, readiness: readiness,
    levelInfo: levelInfo, addXp: addXp, ACHIEVEMENTS: ACHIEVEMENTS, checkAchievements: checkAchievements,
    bossWinAchievement: bossWinAchievement, todayXp: todayXp, dailyGoal: dailyGoal
  };
})(window.LAS = window.LAS || {});
