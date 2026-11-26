// Core planner: builds a personal study session that fits a time budget (5, 10, 15, or 30 minutes).
// Priority: missed questions, cards due for review, weak-topic questions, then new material.
// Namespace: window.LAS.core.planner
(function (LAS) {
  'use strict';
  var C = function () { return LAS.core.content; };
  var L = function () { return LAS.core.learning; };
  var store = function () { return LAS.core.store.get(); };
  var SECONDS = { q: 45, card: 20, tf: 15, fill: 30 };

  function shuffle(a) { var b = a.slice(); for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = b[i]; b[i] = b[j]; b[j] = t; } return b; }

  function build(minutes) {
    var budget = (minutes || 10) * 60;
    var st = store();
    var steps = [];
    var used = 0;
    var seen = {};
    function add(step, key) {
      if (seen[key]) return false;
      var cost = SECONDS[step.type] || 30;
      if (used + cost > budget) return false;
      seen[key] = true; used += cost; steps.push(step); return true;
    }
    // 1. missed questions not yet answered correctly (most recent first)
    var missed = C().ITEMS.filter(function (it) { return st.missed[it.id] && !st.missed[it.id].fixed; })
      .sort(function (a, b) { return (st.missed[b.id].last || 0) - (st.missed[a.id].last || 0); });
    missed.forEach(function (it) { add({ type: 'q', item: it, reason: 'Review: missed before' }, 'q:' + it.id); });
    // 2. flashcards due for review
    shuffle(C().CARDS.filter(function (c) { return L().isDue(c.id); })).forEach(function (c) {
      add({ type: 'card', card: c, reason: 'Due for review' }, 'c:' + c.id);
    });
    // 3. weak-topic questions
    var weak = L().weakTopics(4).map(function (w) { return w.topic; });
    shuffle(C().ITEMS.filter(function (it) { return weak.indexOf(it.topic) >= 0; })).forEach(function (it) {
      add({ type: 'q', item: it, reason: 'Weak topic: ' + it.topic }, 'q:' + it.id);
    });
    // 4. new material: unseen questions, a few true/false and fill-in items for variety
    shuffle(C().ITEMS.filter(function (it) { return !st.items[it.id]; })).forEach(function (it) {
      add({ type: 'q', item: it, reason: 'New material' }, 'q:' + it.id);
    });
    shuffle(C().TF).slice(0, 6).forEach(function (t) { add({ type: 'tf', tf: t, reason: 'Speed check' }, 'tf:' + t.id); });
    shuffle(C().FILL).slice(0, 4).forEach(function (f) { add({ type: 'fill', fill: f, reason: 'Recall the term' }, 'f:' + f.id); });
    // Interleave types so the session does not feel like one long quiz
    return { minutes: minutes, steps: interleave(steps), estimate: Math.round(used / 60) };
  }

  function interleave(steps) {
    var groups = {};
    steps.forEach(function (s) { (groups[s.type] = groups[s.type] || []).push(s); });
    var order = Object.keys(groups), out = [], i = 0;
    while (out.length < steps.length) {
      var g = groups[order[i % order.length]];
      if (g && g.length) out.push(g.shift());
      i++;
      if (i > steps.length * 10) break;
    }
    return out;
  }

  LAS.core.planner = { build: build, SECONDS: SECONDS };
})(window.LAS = window.LAS || {});
