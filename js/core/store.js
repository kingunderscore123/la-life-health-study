// Core: saved progress (localStorage, never throws) and the progress data model.
// Namespace: window.LAS.core.store. No UI code here.
(function (LAS) {
  'use strict';
  var KEY = 'laLH_v2';
  var OLD_KEY = 'laLH_v1';

  function blank() {
    return {
      v: 2,
      read: {},            // sectionId -> true
      cards: {},           // cardId -> {ease, interval, due, reps, lapses}
      items: {},           // itemId -> {a, c, mastery, streak, lastSeen}
      topics: {},          // topic -> {a, c}
      units: {},           // unit -> {a, c}
      missed: {},          // itemId -> {count, last, fixed}
      xp: 0,
      achievements: {},    // id -> timestamp
      streak: { count: 0, last: '' },
      daily: {},           // 'YYYY-MM-DD' -> xp earned that day
      dailyGoal: 60,
      bests: {},           // game key -> best score/time
      mocks: [],
      sessions: 0,
      settings: { sessionMinutes: 10, focus: false }
    };
  }

  function merge(s) {
    var b = blank();
    for (var k in b) if (s[k] === undefined) s[k] = b[k];
    return s;
  }

  var state = null;

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) { state = merge(JSON.parse(raw)); return state; }
      // migrate progress saved by the first version of the site
      var old = window.localStorage.getItem(OLD_KEY);
      if (old) {
        var o = JSON.parse(old);
        state = blank();
        state.read = o.read || {}; state.cards = o.cards || {}; state.topics = o.topics || {};
        state.units = o.units || {}; state.missed = o.missed || {}; state.mocks = o.mocks || [];
        state.bests = { matchBest: o.matchBest || {} };
        return state;
      }
    } catch (e) { /* fall through */ }
    state = blank();
    return state;
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }

  function get() { return state || load(); }

  function reset() { state = blank(); save(); return state; }

  function replace(obj) {
    if (!obj || typeof obj !== 'object' || (obj.v !== 2 && obj.v !== 1)) throw new Error('This file is not a progress backup.');
    state = merge(obj.v === 2 ? obj : { v: 2, read: obj.read || {}, cards: obj.cards || {}, topics: obj.topics || {}, units: obj.units || {}, missed: obj.missed || {}, mocks: obj.mocks || [] });
    state.v = 2;
    save();
    return state;
  }

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  LAS.core = LAS.core || {};
  LAS.core.store = { load: load, save: save, get: get, reset: reset, replace: replace, blank: blank, todayKey: todayKey };
})(window.LAS = window.LAS || {});
