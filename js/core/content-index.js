// Content adapter: the ONLY place the engine reads educational content. Replace or add content in
// src/data/ (built by tools/build-content.js) and the engine, games, and screens keep working.
// Namespace: window.LAS.core.content
(function (LAS) {
  'use strict';

  var lessons = window.LESSONS || [];
  var reference = window.REFERENCE || [];
  var recallRaw = window.RECALL || [];
  var quiz = window.CONTENT || {};
  var games = window.GAMES || {};

  var UNIT_ORDER = lessons.map(function (l) { return l.id; });
  Object.keys(quiz).forEach(function (u) { if (UNIT_ORDER.indexOf(u) < 0) UNIT_ORDER.push(u); });

  var unitName = {};
  lessons.forEach(function (l) { unitName[l.id] = l.short; });
  unitName.addendum = unitName.addendum || 'Addendum';
  unitName.mockexam = unitName.mockexam || 'Mock exam';
  unitName.practiceexam = unitName.practiceexam || 'Practice exam';

  function unitTitle(u) {
    var l = lessons.filter(function (x) { return x.id === u; })[0];
    return l ? l.label : ({ mockexam: 'Mock exam (150, outline-weighted)', practiceexam: 'Practice exam (40)' })[u] || (quiz[u] && quiz[u].title) || u;
  }

  function validQ(q) {
    return q && q.q && Array.isArray(q.choices) && q.choices.length >= 2 && typeof q.answer === 'number' && q.answer >= 0 && q.answer < q.choices.length;
  }

  var ITEMS = [];      // multiple-choice items (questions and scenarios)
  var CARDS = [];      // flashcards
  var PAIRS = [];      // matching pairs
  UNIT_ORDER.forEach(function (u) {
    var c = quiz[u]; if (!c) return;
    (c.questions || []).forEach(function (q, i) { if (validQ(q)) ITEMS.push(mkItem(u, 'q', i, q, 'question')); });
    (c.scenarios || []).forEach(function (q, i) { if (validQ(q)) ITEMS.push(mkItem(u, 's', i, q, 'scenario')); });
    (c.flashcards || []).forEach(function (f, i) { if (f && f.front && f.back) CARDS.push({ id: u + ':c' + i, unit: u, front: f.front, back: f.back, topic: f.topic || 'General', memory: f.memory || '', source: f.source || '' }); });
    (c.pairs || []).forEach(function (p) { if (p && p.term && p.match) PAIRS.push({ unit: u, term: p.term, match: p.match }); });
  });
  function mkItem(u, t, i, q, kind) {
    return { id: u + ':' + t + i, unit: u, topic: q.topic || 'General', kind: kind, situation: q.situation || '', q: q.q, choices: q.choices, answer: q.answer, explain: q.explain || '', source: q.source || '' };
  }

  // Recall prompts from the guides' "Check yourself" sections (typed answer first, then reveal).
  var RECALL = recallRaw.map(function (r, i) { return { id: 'r' + i, unit: r.unit, unitTitle: r.unitTitle, q: r.q, a: r.a, source: r.src || '' }; });

  // True/false statements generated from multiple-choice items (correct choice = true, a distractor = false).
  // Items whose question asks what is NOT correct are skipped.
  var TF = [];
  ITEMS.forEach(function (it) {
    if (/\bNOT\b|\bnot\b|except|EXCEPT/.test(it.q) || it.choices.length < 2) return;
    var right = it.choices[it.answer];
    var wrongIdx = it.choices.map(function (c, i) { return i; }).filter(function (i) { return i !== it.answer; });
    if (!wrongIdx.length) return;
    var wrong = it.choices[wrongIdx[(it.id.length * 7) % wrongIdx.length]];
    if (right.length > 140 || wrong.length > 140) return;
    TF.push({ id: it.id + ':tf1', unit: it.unit, topic: it.topic, s: it.q + ' — ' + right, a: true, e: it.explain });
    TF.push({ id: it.id + ':tf0', unit: it.unit, topic: it.topic, s: it.q + ' — ' + wrong, a: false, e: it.explain });
  });
  // Hand-written true/false statements (if provided by content) are appended.
  (games.tf || []).forEach(function (t, i) { if (t && t.s) TF.push({ id: 'tfx' + i, unit: t.unit || 'addendum', topic: t.topic || 'General', s: t.s, a: !!t.a, e: t.e || '' }); });

  // Fill-in items: flashcards with short terms. The student types the term from its definition.
  // Only real terms qualify: short fronts that are not questions or instructions ("Define...", "What is...").
  var NOT_A_TERM = /^(define|what|which|why|how|when|name|list|explain|describe|identify|who|where|is|are|does|do|can|should|compare|give|state|under|if|a |an |the )/i;
  var FILL = CARDS.filter(function (c) {
    var f = c.front.replace(/[.?!:]+$/, '').trim();
    return f.split(/\s+/).length <= 4 && f.length >= 4 && !/\?$/.test(c.front) && !NOT_A_TERM.test(f) && c.back.length >= 20;
  }).map(function (c) {
    c = { id: c.id, unit: c.unit, topic: c.topic, front: c.front.replace(/[.?!:]+$/, '').trim(), back: c.back };
    var accepted = [c.front];
    return { id: c.id + ':fill', unit: c.unit, topic: c.topic, prompt: c.back, answer: accepted, hint: c.front.charAt(0).toUpperCase() + '…' };
  });

  // Sorting groups: flashcard fronts grouped by their topic, for classification rounds.
  function sortGroups() {
    var by = {};
    CARDS.forEach(function (c) { (by[c.topic] = by[c.topic] || []).push(c); });
    return Object.keys(by).filter(function (t) { return by[t].length >= 4 && t !== 'General'; }).map(function (t) { return { topic: t, unit: by[t][0].unit, cards: by[t] }; });
  }

  // Boss battles: one per unit that has enough items.
  function bossUnits() { return UNIT_ORDER.filter(function (u) { return ITEMS.filter(function (x) { return x.unit === u; }).length >= 8; }); }

  LAS.core = LAS.core || {};
  LAS.core.content = {
    lessons: lessons, reference: reference, UNIT_ORDER: UNIT_ORDER, unitName: unitName, unitTitle: unitTitle,
    ITEMS: ITEMS, CARDS: CARDS, PAIRS: PAIRS, RECALL: RECALL, TF: TF, FILL: FILL,
    sortGroups: sortGroups, bossUnits: bossUnits,
    itemsForUnit: function (u) { return ITEMS.filter(function (x) { return x.unit === u; }); },
    cardsForUnit: function (u) { return CARDS.filter(function (x) { return x.unit === u; }); },
    hasUnit: function (u) { return UNIT_ORDER.indexOf(u) >= 0; }
  };
})(window.LAS = window.LAS || {});
