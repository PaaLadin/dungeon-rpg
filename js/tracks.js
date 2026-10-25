// tracks.js - музыка Dungeon RPG в духе Ultima (Ken Arnold, 1981-83).
// Каждый трек: 6-8 РАЗНЫХ секций (A-B-A-C-D-E), развитие, ~2 мин.
// Формат совместим с audio.js: sections -> pat: kick/snare/hat/bass/pad/lead/arp.

const DGTracks = (() => {
  const rep = (a, n) => { const o = []; for (let i = 0; i < n; i++) o.push(...a); return o; };
  const N = null;
  const _16 = (a) => a.length === 16 ? a : rep(a, 16 / a.length);

  // ---------- РИТМЫ ----------
  const K_slow  = [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0];
  const K_walk  = [1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0];
  const K_march = [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0];
  const K_battle= [1,0,0,0,1,0,1,0,1,0,0,0,1,0,1,0];
  const K_boss  = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,1];
  const S_sparse= [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0];
  const S_fast  = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,1,0];
  const H_soft  = [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0];
  const H_full  = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0];
  const Z = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

  // ---------- ГАРМОНИЧЕСКИЕ СЕТКИ (как в Ultima: модальные прогрессии) ----------
  // Am - F - C - G (эпическая)
  const progA = { bass:[45,41,48,43], pad:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]] };
  // Dm - Bb - F - C (тревожная)
  const progB = { bass:[38,34,41,36], pad:[[50,53,57],[46,50,53],[53,57,60],[48,52,55]] };
  // Em - C - G - D (походная)
  const progC = { bass:[40,36,43,38], pad:[[52,55,59],[48,52,55],[55,59,62],[50,54,57]] };
  // Cm - Ab - Eb - Bb (мрачная, для глубин)
  const progD = { bass:[36,32,39,34], pad:[[48,51,55],[44,48,51],[51,55,58],[46,50,53]] };
  // Dm - G - C - Am (менуэт)
  const progE = { bass:[38,43,48,45], pad:[[50,53,57],[55,59,62],[48,52,55],[57,60,64]] };

  // Построить bass-линию: аккорд на 2 такта, корень + квинта/октава.
  function bassLine(prog, bars) {
    const out = [];
    const per = bars / prog.bass.length;
    for (const root of prog.bass) {
      for (let b = 0; b < per; b++) {
        for (let s = 0; s < 16; s++) {
          if (s === 0) out.push(root);
          else if (s === 8) out.push(root + 7);
          else if (s === 12 && b % 2 === 1) out.push(root + 12);
          else out.push(N);
        }
      }
    }
    return out;
  }
  // Аккорды на 2 такта (half-note pad).
  function padLine(prog, bars) {
    const out = [];
    const per = bars / prog.pad.length;
    for (const chord of prog.pad) {
      for (let b = 0; b < per; b++) {
        for (let s = 0; s < 16; s++) {
          if (s === 0 || s === 8) out.push(chord);
          else out.push(N);
        }
      }
    }
    return out;
  }
  // Мелодия: массив РАЗНЫХ тактов; если тактов меньше bars — варьируем
  // (транспозиция на октаву/терцию), а не долбим один такт.
  function melody(phrases, bars) {
    const barsArr = phrases.map(ph => ph.length === 16 ? ph.slice() : rep(ph, 16 / ph.length));
    const out = [];
    for (let b = 0; b < bars; b++) {
      const base = barsArr[b % barsArr.length];
      const cycle = Math.floor(b / barsArr.length);   // сколько раз прошли круг
      // Вариация: каждый круг — сдвиг на терцию вверх/вниз.
      const shift = cycle === 0 ? 0 : (cycle % 2 === 1 ? 3 : -3);
      for (const n of base) {
        out.push(n === null ? null : n + shift);
      }
    }
    return out;
  }

  function mk(prog, leadPhrases, bars, rhythm) {
    const r = rhythm || {};
    return {
      kick:  rep(_16(r.k || K_slow), bars),
      snare: rep(_16(r.s || Z), bars),
      hat:   rep(_16(r.h || Z), bars),
      bass:  bassLine(prog, bars),
      pad:   padLine(prog, bars),
      lead:  melody(leadPhrases, bars),
      arp:   rep(_16(r.a || Z), bars),
    };
  }

  // ---------- МЕНЮ: торжественная тема (Ultima Theme дух) ----------
  function menu() {
    const S = (prog, lead, bars, rhy) => ({ name: "s", len: bars, pat: mk(prog, lead, bars, rhy) });
    const leadA = [[76,N,74,N,72,N,69,N,72,N,74,N,76,N,N,N]];
    const leadB = [[72,N,71,N,69,N,67,N,69,N,71,N,72,N,N,N]];
    const leadC = [[79,N,76,N,72,N,76,N,79,N,81,N,79,N,N,N]];
    const leadD = [[74,N,72,N,69,N,67,N,64,N,67,N,69,N,N,N]];
    return { name:"dg_menu", style:"classical", bpm:76,
      about:"Меню — тема странствий",
      sections:[
        S(progA, leadA, 8, {k:K_slow, h:H_soft}),
        S(progA, leadB, 8, {k:K_slow, h:H_soft}),
        S(progE, leadC, 8, {k:K_walk, h:H_soft}),
        S(progE, leadD, 8, {k:K_walk, h:H_soft}),
        S(progC, leadA, 8, {k:K_walk, s:S_sparse, h:H_soft}),
        S(progC, leadC, 8, {k:K_walk, s:S_sparse, h:H_full}),
      ],
      synth: Styles.get("classical").synth };
  }

  // ---------- УРОВНИ 1-5: спокойное исследование ----------
  function dun1() {
    const S = (prog, lead, bars, rhy) => ({ name: "s", len: bars, pat: mk(prog, lead, bars, rhy) });
    const leadA = [[69,N,72,N,76,N,72,N,69,N,72,N,74,N,N,N]];
    const leadB = [[72,N,76,N,79,N,76,N,72,N,69,N,67,N,N,N]];
    const leadC = [[67,N,71,N,74,N,71,N,67,N,64,N,67,N,N,N]];
    return { name:"dg_dun1", style:"chip", bpm:92,
      about:"Подземелье 1-5",
      sections:[
        S(progC, leadA, 8, {k:K_slow, h:H_soft}),
        S(progC, leadB, 8, {k:K_slow, h:H_soft}),
        S(progA, leadC, 8, {k:K_walk, h:H_soft}),
        S(progA, leadA, 8, {k:K_walk, s:S_sparse, h:H_soft}),
        S(progE, leadB, 8, {k:K_walk, s:S_sparse, h:H_soft}),
        S(progE, leadC, 8, {k:K_walk, h:H_full}),
      ],
      synth: Styles.get("chip").synth };
  }

  // ---------- УРОВНИ 6-10: тревожно ----------
  function dun2() {
    const S = (prog, lead, bars, rhy) => ({ name: "s", len: bars, pat: mk(prog, lead, bars, rhy) });
    const leadA = [[64,N,67,N,70,N,67,N,64,N,63,N,64,N,N,N]];
    const leadB = [[70,N,72,N,75,N,72,N,70,N,67,N,65,N,N,N]];
    const leadC = [[62,N,65,N,69,N,65,N,62,N,60,N,62,N,N,N]];
    return { name:"dg_dun2", style:"classical", bpm:84,
      about:"Подземелье 6-10",
      sections:[
        S(progB, leadA, 8, {k:K_slow, s:S_sparse, h:H_soft}),
        S(progB, leadB, 8, {k:K_slow, s:S_sparse, h:H_soft}),
        S(progD, leadC, 8, {k:K_walk, s:S_sparse, h:H_soft}),
        S(progD, leadA, 8, {k:K_walk, s:S_sparse, h:H_full}),
        S(progB, leadC, 8, {k:K_march, s:S_sparse, h:H_full}),
        S(progB, leadB, 8, {k:K_march, s:S_fast, h:H_full}),
      ],
      synth: Styles.get("classical").synth };
  }

  // ---------- УРОВНИ 11-16: мрачно, глубина ----------
  function dun3() {
    const S = (prog, lead, bars, rhy) => ({ name: "s", len: bars, pat: mk(prog, lead, bars, rhy) });
    const leadA = [[60,N,63,N,67,N,63,N,60,N,58,N,60,N,N,N]];
    const leadB = [[67,N,70,N,74,N,70,N,67,N,65,N,63,N,N,N]];
    const leadC = [[55,N,58,N,62,N,58,N,55,N,53,N,55,N,N,N]];
    return { name:"dg_dun3", style:"classical", bpm:72,
      about:"Подземелье 11-16",
      sections:[
        S(progD, leadA, 8, {k:K_slow, s:S_sparse, h:Z}),
        S(progD, leadB, 8, {k:K_slow, s:S_sparse, h:Z}),
        S(progD, leadC, 8, {k:K_march, s:S_sparse, h:H_soft}),
        S(progB, leadA, 8, {k:K_march, s:S_sparse, h:H_soft}),
        S(progB, leadB, 8, {k:K_march, s:S_fast, h:H_full}),
        S(progD, leadC, 8, {k:K_march, s:S_fast, h:H_full}),
      ],
      synth: Styles.get("classical").synth };
  }

  // ---------- УРОВНИ 17-20: эпично, финал ----------
  function dun4() {
    const S = (prog, lead, bars, rhy) => ({ name: "s", len: bars, pat: mk(prog, lead, bars, rhy) });
    const leadA = [[72,N,75,N,79,N,75,N,72,N,70,N,72,N,N,N]];
    const leadB = [[79,N,82,N,86,N,82,N,79,N,77,N,75,N,N,N]];
    const leadC = [[67,N,70,N,74,N,70,N,67,N,65,N,67,N,N,N]];
    return { name:"dg_dun4", style:"metal", bpm:96,
      about:"Подземелье 17-20",
      sections:[
        S(progA, leadA, 8, {k:K_march, s:S_sparse, h:H_soft}),
        S(progA, leadB, 8, {k:K_march, s:S_sparse, h:H_soft}),
        S(progD, leadC, 8, {k:K_march, s:S_fast, h:H_full}),
        S(progD, leadA, 8, {k:K_march, s:S_fast, h:H_full}),
        S(progA, leadB, 8, {k:K_battle, s:S_fast, h:H_full}),
        S(progA, leadA, 8, {k:K_battle, s:S_fast, h:H_full}),
        S(progD, leadC, 8, {k:K_battle, s:S_fast, h:H_full}),
      ],
      synth: Styles.get("metal").synth };
  }

  // ---------- БОЙ ----------
  function battle() {
    const S = (prog, lead, bars, rhy) => ({ name: "s", len: bars, pat: mk(prog, lead, bars, rhy) });
    const leadA = [[64,67,69,67,64,62,64,67,69,71,72,71,69,67,64,62]];
    const leadB = [[67,70,72,70,67,65,67,70,72,74,75,74,72,70,67,65]];
    return { name:"dg_battle", style:"rock", bpm:148,
      about:"Бой",
      sections:[
        S(progC, leadA, 8, {k:K_battle, s:S_fast, h:H_full}),
        S(progC, leadB, 8, {k:K_battle, s:S_fast, h:H_full}),
        S(progE, leadA, 8, {k:K_battle, s:S_fast, h:H_full}),
        S(progE, leadB, 8, {k:K_battle, s:S_fast, h:H_full}),
        S(progC, leadB, 8, {k:K_battle, s:S_fast, h:H_full}),
        S(progC, leadA, 8, {k:K_battle, s:S_fast, h:H_full}),
      ],
      synth: Styles.get("rock").synth };
  }

  // ---------- БОСС: Golden Dragon ----------
  function boss() {
    const S = (prog, lead, bars, rhy) => ({ name: "s", len: bars, pat: mk(prog, lead, bars, rhy) });
    const leadA = [[60,60,63,63,67,67,70,70,72,72,70,70,67,67,63,63]];
    const leadB = [[67,67,70,70,74,74,77,77,79,79,77,77,74,74,70,70]];
    return { name:"dg_boss", style:"metal", bpm:132,
      about:"Golden Dragon",
      sections:[
        S(progD, leadA, 8, {k:K_boss, s:S_fast, h:H_full}),
        S(progD, leadB, 8, {k:K_boss, s:S_fast, h:H_full}),
        S(progB, leadA, 8, {k:K_boss, s:S_fast, h:H_full}),
        S(progB, leadB, 8, {k:K_boss, s:S_fast, h:H_full}),
        S(progD, leadB, 8, {k:K_boss, s:S_fast, h:H_full}),
        S(progD, leadA, 8, {k:K_boss, s:S_fast, h:H_full}),
      ],
      synth: Styles.get("metal").synth };
  }

  // ---------- ПОБЕДА ----------
  function victory() {
    const S = (prog, lead, bars, rhy) => ({ name: "s", len: bars, pat: mk(prog, lead, bars, rhy) });
    const leadA = [[72,76,79,84, 83,79,76,72, 74,77,81,86, 84,81,77,74]];
    const leadB = [[79,83,86,91, 89,86,83,79, 81,84,88,93, 91,88,84,81]];
    return { name:"dg_victory", style:"classical", bpm:104,
      about:"Победа",
      sections:[
        S(progA, leadA, 8, {k:K_march, s:S_sparse, h:H_soft}),
        S(progA, leadB, 8, {k:K_march, s:S_sparse, h:H_full}),
        S(progE, leadA, 8, {k:K_march, s:S_fast, h:H_full}),
        S(progE, leadB, 8, {k:K_march, s:S_fast, h:H_full}),
      ],
      synth: Styles.get("classical").synth };
  }

  // ---------- СМЕРТЬ ----------
  function death() {
    const S = (prog, lead, bars, rhy) => ({ name: "s", len: bars, pat: mk(prog, lead, bars, rhy) });
    const leadA = [[69,N,67,N,65,N,64,N, 62,N,60,N,59,N,57,N]];
    const leadB = [[64,N,62,N,60,N,59,N, 57,N,55,N,53,N,52,N]];
    return { name:"dg_death", style:"classical", bpm:52,
      about:"Смерть",
      sections:[
        S(progD, leadA, 8, {k:Z, s:Z, h:Z}),
        S(progD, leadB, 8, {k:Z, s:Z, h:Z}),
        S(progB, leadA, 8, {k:Z, s:Z, h:Z}),
        S(progB, leadB, 8, {k:Z, s:Z, h:Z}),
      ],
      synth: Styles.get("classical").synth };
  }

  const REG = {
    dg_menu: menu, dg_dun1: dun1, dg_dun2: dun2, dg_dun3: dun3, dg_dun4: dun4,
    dg_battle: battle, dg_boss: boss, dg_victory: victory, dg_death: death,
  };
  const CACHE = {};
  function get(id) {
    if (CACHE[id]) return CACHE[id];
    if (!REG[id]) return null;
    CACHE[id] = REG[id]();
    return CACHE[id];
  }
  return { get, list: () => Object.keys(REG), REG };
})();