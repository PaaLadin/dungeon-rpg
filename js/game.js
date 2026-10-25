// game.js - dnd (The Game of Dungeons, 1975, PLATO) revival.
// Камера 3x3, БЕЗ сетки — только линии стен. Список заклинаний слева.
// Текст событий внизу. Статы STR/IQ/WIS/DEX/Hits. 20 уровней.
// Уровень 20: Golden Dragon охраняет Orb. Янтарный на чёрном.

const DG = (() => {
  const CAM = 3;              // камера 3x3 (как в оригинале)
  const CELL = 150;           // крупная клетка
  const AMBER = "#ffb000";
  const MAX_LEVEL = 20;

  // ---------- МОНСТРЫ (по глубине) ----------
  const MON = {
    R: { name: "Крыса",     hp: 3,   atk: 1,  xp: 100,  glyph: "slime"  },
    M: { name: "Слизень",   hp: 5,   atk: 2,  xp: 250,  glyph: "slime"  },
    G: { name: "Гоблин",    hp: 9,   atk: 3,  xp: 600,  glyph: "human"  },
    S: { name: "Скелет",    hp: 14,  atk: 5,  xp: 1200, glyph: "human"  },
    O: { name: "Огр",       hp: 22,  atk: 7,  xp: 2400, glyph: "ogre"   },
    W: { name: "Вервольф",  hp: 28,  atk: 9,  xp: 3600, glyph: "ogre"   },
    T: { name: "Тролль",    hp: 36,  atk: 11, xp: 5200, glyph: "ogre"   },
    V: { name: "Вампир",    hp: 44,  atk: 13, xp: 7000, glyph: "human"  },
    B: { name: "Василиск",  hp: 52,  atk: 15, xp: 9000, glyph: "dragon" },
    D: { name: "Демон",     hp: 64,  atk: 18, xp: 12000, glyph: "dragon" },
    X: { name: "Golden Dragon", hp: 120, atk: 25, xp: 30000, glyph: "dragon", boss: true },
  };
  // Порядок силы для выбора по глубине.
  const MON_ORDER = ["R","M","G","S","O","W","T","V","B","D"];

  // ---------- ЗАКЛИНАНИЯ (как в dnd: свитки, каст с расходом) ----------
  const SPELLS = [
    { key:"1", name:"Light Candle",  mp:1, effect:"light"  },
    { key:"2", name:"Holy Water",    mp:2, effect:"damage", power:6  },
    { key:"3", name:"Pray",          mp:2, effect:"heal",   power:6  },
    { key:"4", name:"Dispell",       mp:3, effect:"shield", power:4  },
    { key:"5", name:"Hold",          mp:3, effect:"sleep"           },
    { key:"6", name:"Fireball",      mp:5, effect:"damage", power:16 },
    { key:"7", name:"Lightning",     mp:6, effect:"damage", power:20 },
    { key:"8", name:"Teleport",      mp:8, effect:"stairs"          },
  ];

  let map = [], hero = null, mon = null, over = false, won = false;
  let depth = 1;                        // 1..20
  let msg = "", msgUntil = 0, bottomText = "";
  let canvas, ctx2d, W = 760, H = 560, VH = 420;
  let audioOk = false;
  let lastEvent = "";

  // ---------- АУДИО ----------
  function play(id) {
    if (typeof AudioEngine === "undefined" || typeof DGTracks === "undefined") return;
    const t = DGTracks.get(id);
    if (!t) return;
    AudioEngine.resume(); AudioEngine.setStyle(t);
    for (const ch of AudioEngine.CHANNELS)
      AudioEngine.setChannel(ch, { on: ch !== "arp", density: 0.85 });
    if (AudioEngine.syncGains) AudioEngine.syncGains();
    if (!AudioEngine.isRunning()) AudioEngine.start();
    audioOk = true;
  }
  function musicExplore() {
    if (mon) return;
    if (depth >= 17) play("dg_dun4");
    else if (depth >= 11) play("dg_dun3");
    else if (depth >= 6) play("dg_dun2");
    else play("dg_dun1");
  }

  // ---------- ГЕНЕРАЦИЯ УРОВНЯ ----------
  function buildMap(d) {
    const Wd = 41, Hd = 41, m = [];
    for (let y = 0; y < Hd; y++) m.push(new Array(Wd).fill("#"));
    const rooms = [];
    const rw = 5, rh = 4, gap = 2;
    // Чем глубже — тем больше комнат (от 3x3 до 6x6 сетки).
    const gridN = Math.min(6, 3 + Math.floor((d - 1) / 5));
    for (let ry = 0; ry < gridN; ry++) for (let rx = 0; rx < gridN; rx++) {
      const x0 = 1 + rx * (rw + gap), y0 = 1 + ry * (rh + gap);
      if (x0 + rw >= Wd - 1 || y0 + rh >= Hd - 1) continue;
      for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) m[y][x] = ".";
      rooms.push({ x0, y0, x1: x0+rw-1, y1: y0+rh-1,
                   cx: Math.floor(x0+rw/2), cy: Math.floor(y0+rh/2) });
    }
    // Коридоры.
    for (let i = 0; i < rooms.length; i++) {
      const a = rooms[i];
      const rIdx = rooms.findIndex((r,j) => j!==i && Math.abs(r.cy-a.cy)<2 && r.x0>a.x1 && r.x0-a.x1<5);
      if (rIdx >= 0) { const b = rooms[rIdx]; for (let x = a.x1+1; x < b.x0; x++) m[a.cy][x] = "."; }
      const dIdx = rooms.findIndex((r,j) => j!==i && Math.abs(r.cx-a.cx)<2 && r.y0>a.y1 && r.y0-a.y1<5);
      if (dIdx >= 0) { const b = rooms[dIdx]; for (let y = a.y1+1; y < b.y0; y++) m[y][a.cx] = "."; }
    }
    const start = rooms[0]; m[start.cy][start.cx] = "@";

    // Лестница вниз — в последней комнате (кроме 20 уровня).
    const last = rooms[rooms.length-1];
    if (d < MAX_LEVEL) m[last.cy][last.cx] = ">";
    else {
      // Уровень 20: Golden Dragon + Orb.
      m[last.cy][last.cx] = "*";   // Orb (не "O" — занято Огром)
      m[last.cy][last.cx-1] = "X"; // Golden Dragon
    }

    // Монстры: чем глубже — тем сильнее и больше.
    const tier = Math.min(MON_ORDER.length-1, Math.floor((d-1) / 2));
    for (let i = 1; i < rooms.length; i++) {
      const r = rooms[i];
      const nMon = 1 + Math.floor(Math.random() * (1 + Math.floor(d/4)));
      for (let k = 0; k < nMon; k++) {
        const x = r.x0 + Math.floor(Math.random()*(r.x1-r.x0+1));
        const y = r.y0 + Math.floor(Math.random()*(r.y1-r.y0+1));
        if (m[y][x] === ".") {
          const t = Math.max(0, tier - Math.floor(Math.random()*2));
          m[y][x] = MON_ORDER[t];
        }
      }
      if (Math.random() < 0.7) {
        const x = r.x0 + Math.floor(Math.random()*(r.x1-r.x0+1));
        const y = r.y0 + Math.floor(Math.random()*(r.y1-r.y0+1));
        if (m[y][x] === ".") m[y][x] = "$";
      }
      if (Math.random() < 0.3) {
        const x = r.x0 + Math.floor(Math.random()*(r.x1-r.x0+1));
        const y = r.y0 + Math.floor(Math.random()*(r.y1-r.y0+1));
        if (m[y][x] === ".") m[y][x] = Math.random()<0.6 ? "!" : "?";
      }
    }
    // Двери и секретки в коридорах.
    for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
      if (m[y][x] !== ".") continue;
      const wl=(x>0&&m[y][x-1]==="#"), wr=(x<Wd-1&&m[y][x+1]==="#");
      const wu=(y>0&&m[y-1][x]==="#"), wd=(y<Hd-1&&m[y+1][x]==="#");
      if ((wl&&wr)||(wu&&wd)) {
        if (Math.random()<0.10) m[y][x]="+";
        else if (Math.random()<0.03) m[y][x]="~";
      }
    }
    m[start.cy][start.cx] = "@";
    return m;
  }

  function cell(x, y) {
    if (y<0 || y>=map.length || x<0 || x>=map[y].length) return "#";
    return map[y][x];
  }
  function setCell(x,y,v) { if (map[y] && x>=0 && x<map[y].length) map[y][x] = v; }
  function findStart() {
    for (let y=0; y<map.length; y++) for (let x=0; x<map[y].length; x++)
      if (map[y][x]==="@") return {x,y};
    return {x:1,y:1};
  }

  // ---------- РЕНДЕР ----------
  function line(x1,y1,x2,y2,w) {
    ctx2d.strokeStyle=AMBER; ctx2d.lineWidth=w||2;
    ctx2d.beginPath(); ctx2d.moveTo(x1,y1); ctx2d.lineTo(x2,y2); ctx2d.stroke();
  }
  function setMsg(t) { msg=t; msgUntil=performance.now()+1800; }
  function bottom(t) { bottomText=t; }

  function drawFigure(cx, cy, size, kind) {
    // Базовая единица (высота фигуры ~ size*0.7).
    const u = size * 0.11;
    ctx2d.strokeStyle = AMBER;
    ctx2d.lineWidth = Math.max(2, u * 0.32);
    const headR = u * 1.15;
    const headY = cy - u * 2.4;
    const shoulderY = headY + headR + u * 0.5;
    const hipY = cy + u * 1.0;

    if (kind === "slime") {
      // Полусфера-слизень с двумя точками-глазами.
      ctx2d.beginPath();
      ctx2d.arc(cx, cy + u * 1.2, u * 2.2, Math.PI, 0);
      ctx2d.stroke();
      ctx2d.beginPath(); ctx2d.arc(cx - u*0.7, cy + u*0.2, u*0.22, 0, Math.PI*2); ctx2d.stroke();
      ctx2d.beginPath(); ctx2d.arc(cx + u*0.7, cy + u*0.2, u*0.22, 0, Math.PI*2); ctx2d.stroke();
      return;
    }

    if (kind === "robot") {
      // Квадратная голова с точкой-глазом, прямоугольный торс, тонкие ноги.
      const hw = headR * 1.1, hh = headR * 1.1;
      ctx2d.strokeRect(cx - hw, headY - hh, hw*2, hh*2);
      ctx2d.beginPath(); ctx2d.arc(cx, headY, u*0.28, 0, Math.PI*2); ctx2d.stroke();
      // Торс.
      line(cx - u*1.3, shoulderY, cx - u*1.3, hipY, ctx2d.lineWidth);
      line(cx + u*1.3, shoulderY, cx + u*1.3, hipY, ctx2d.lineWidth);
      line(cx - u*1.3, shoulderY, cx + u*1.3, shoulderY, ctx2d.lineWidth);
      line(cx - u*1.3, hipY, cx + u*1.3, hipY, ctx2d.lineWidth);
      // Ноги.
      line(cx - u*0.7, hipY, cx - u*0.9, hipY + u*1.6);
      line(cx + u*0.7, hipY, cx + u*0.9, hipY + u*1.6);
      return;
    }

    if (kind === "dragon") {
      // Дракон: голова с пастью, крылья, тело, хвост.
      ctx2d.beginPath();
      ctx2d.moveTo(cx - headR, headY);
      ctx2d.lineTo(cx + headR, headY);
      ctx2d.lineTo(cx + headR*0.5, headY + headR);
      ctx2d.lineTo(cx - headR*0.5, headY + headR);
      ctx2d.closePath(); ctx2d.stroke();
      // Пасть.
      line(cx + headR, headY + headR*0.3, cx + headR*1.8, headY + headR*0.5);
      // Тело.
      line(cx, headY + headR, cx, hipY, ctx2d.lineWidth);
      // Крылья.
      line(cx - headR*0.6, shoulderY, cx - headR*2.6, headY);
      line(cx + headR*0.6, shoulderY, cx + headR*2.6, headY);
      line(cx - headR*2.6, headY, cx - headR*2.2, headY + headR*1.2);
      line(cx + headR*2.6, headY, cx + headR*2.2, headY + headR*1.2);
      // Ноги.
      line(cx - u*0.6, hipY, cx - u*1.0, hipY + u*1.8);
      line(cx + u*0.6, hipY, cx + u*1.0, hipY + u*1.8);
      // Хвост.
      line(cx, hipY, cx - headR*1.6, hipY + u*1.2);
      return;
    }

    if (kind === "ogre") {
      // Огр: большая голова, широкий торс, дубина.
      ctx2d.beginPath(); ctx2d.arc(cx, headY, headR*1.3, 0, Math.PI*2); ctx2d.stroke();
      ctx2d.beginPath(); ctx2d.arc(cx - headR*0.4, headY - headR*0.2, u*0.2, 0, Math.PI*2); ctx2d.stroke();
      ctx2d.beginPath(); ctx2d.arc(cx + headR*0.4, headY - headR*0.2, u*0.2, 0, Math.PI*2); ctx2d.stroke();
      // Широкий торс.
      line(cx - u*1.6, shoulderY, cx - u*1.8, hipY, ctx2d.lineWidth);
      line(cx + u*1.6, shoulderY, cx + u*1.8, hipY, ctx2d.lineWidth);
      line(cx - u*1.6, shoulderY, cx + u*1.6, shoulderY, ctx2d.lineWidth);
      // Ноги.
      line(cx - u*0.8, hipY, cx - u*1.0, hipY + u*1.8);
      line(cx + u*0.8, hipY, cx + u*1.0, hipY + u*1.8);
      // Дубина.
      line(cx + u*1.8, shoulderY, cx + u*3.2, headY - u*0.2);
      line(cx + u*3.2, headY - u*0.2, cx + u*3.6, headY + u*0.4);
      return;
    }

    // По умолчанию — "human": круг с точкой, торс, ноги (как в референсе).
    ctx2d.beginPath(); ctx2d.arc(cx, headY, headR, 0, Math.PI*2); ctx2d.stroke();
    ctx2d.beginPath(); ctx2d.arc(cx, headY, u*0.22, 0, Math.PI*2); ctx2d.stroke();
    // Торс (слегка расширяющийся книзу).
    line(cx, headY + headR, cx, hipY, ctx2d.lineWidth);
    line(cx - u*0.9, shoulderY + u*0.3, cx + u*0.9, shoulderY + u*0.3, ctx2d.lineWidth);
    // Ноги.
    line(cx, hipY, cx - u*0.8, hipY + u*1.9);
    line(cx, hipY, cx + u*0.8, hipY + u*1.9);
  }

  // Проверка: клетка — стена?
  function isWall(x, y) { return cell(x, y) === "#"; }

  function render() {
    if (!ctx2d) return;
    const now = performance.now();
    ctx2d.fillStyle="#000"; ctx2d.fillRect(0,0,W,H);
    if (!hero) { drawTitle(); return; }

    // ---------- КАМЕРА 3x3, БЕЗ СЕТКИ ----------
    const cx = W/2, cy = VH/2;
    const half = Math.floor(CAM/2);
    const gridW = CAM*CELL, gridH = CAM*CELL;
    const ox = cx - gridW/2, oy = cy - gridH/2;
    const camX = hero.x - half, camY = hero.y - half;
    const screenOf = (gx,gy) => ({ x: ox + (gx-camX)*CELL, y: oy + (gy-camY)*CELL });

    // Рисуем ТОЛЬКО линии стен (границы между полом и стеной),
    // без рамок вокруг клеток — как в оригинале.
    for (let gy = camY-1; gy <= camY+CAM; gy++) {
      for (let gx = camX-1; gx <= camX+CAM; gx++) {
        const p = screenOf(gx, gy);
        const wallHere = isWall(gx, gy);
        if (!wallHere) continue;
        // Для каждой стены рисуем сегменты, граничащие с полом.
        const x0 = p.x, y0 = p.y, x1 = p.x+CELL, y1 = p.y+CELL;
        if (!isWall(gx, gy-1)) line(x0, y0, x1, y0, 3);         // верх
        if (!isWall(gx, gy+1)) line(x0, y1, x1, y1, 3);         // низ
        if (!isWall(gx-1, gy)) line(x0, y0, x0, y1, 3);         // лево
        if (!isWall(gx+1, gy)) line(x1, y0, x1, y1, 3);         // право
      }
    }

    // Содержимое клеток (внутри 3x3).
    for (let gy = camY; gy < camY+CAM; gy++) {
      for (let gx = camX; gx < camX+CAM; gx++) {
        const c = cell(gx,gy);
        if (c === "#") continue;
        const p = screenOf(gx,gy), mx = p.x+CELL/2, my = p.y+CELL/2;
        if (gx===hero.x && gy===hero.y) { drawFigure(mx,my,CELL,"human"); continue; }
        if (MON[c]) { drawFigure(mx,my,CELL,MON[c].glyph); continue; }
        if (c === ">") {  // лестница вниз
          for (let s=0;s<4;s++) {
            const yy = my - CELL*0.15 + s*CELL*0.10;
            line(mx-CELL*0.26, yy, mx+CELL*0.26, yy, 2);
          }
          continue;
        }
        if (c === "*") {  // Orb
          ctx2d.strokeStyle=AMBER; ctx2d.lineWidth=2.5;
          ctx2d.beginPath(); ctx2d.arc(mx,my,CELL*0.22,0,Math.PI*2); ctx2d.stroke();
          ctx2d.beginPath(); ctx2d.arc(mx,my,CELL*0.12,0,Math.PI*2); ctx2d.stroke();
          continue;
        }
        if (c === "+") { line(mx-CELL*0.28,my,mx+CELL*0.28,my,4); continue; }
        if (c === "/") { line(mx-CELL*0.28,my,mx+CELL*0.28,my,2); continue; }
        if (c === "~") { line(mx-10,my-10,mx+10,my+10,2); line(mx+10,my-10,mx-10,my+10,2); continue; }
        if (c === "$") { line(mx-9,my-9,mx+9,my+9,2); line(mx+9,my-9,mx-9,my+9,2); continue; }
        if (c === "!") { ctx2d.beginPath(); ctx2d.arc(mx,my,7,0,Math.PI*2); ctx2d.stroke(); continue; }
        if (c === "?") { ctx2d.font="bold 20px monospace"; ctx2d.fillStyle=AMBER; ctx2d.textAlign="center"; ctx2d.fillText("?",mx,my+7); continue; }
        // Пол — пусто, ничего не рисуем (как в оригинале).
      }
    }

    // ---------- СПИСОК ЗАКЛИНАНИЙ СЛЕВА ----------
    ctx2d.textAlign="left"; ctx2d.font="11px 'Courier New', monospace";
    ctx2d.fillStyle=AMBER;
    ctx2d.fillText("SPELLS", 10, 40);
    SPELLS.forEach((sp, i) => {
      const can = hero.mp >= sp.mp;
      ctx2d.globalAlpha = can ? 1 : 0.35;
      ctx2d.fillText(sp.key + ". " + sp.name, 10, 58 + i*16);
      ctx2d.globalAlpha = 1;
    });

    // ---------- СОБЫТИЕ ПО ЦЕНТРУ ----------
    if (now < msgUntil && msg) {
      ctx2d.fillStyle=AMBER; ctx2d.font="bold 18px 'Courier New', monospace";
      ctx2d.textAlign="center"; ctx2d.fillText(msg, cx, VH+34);
    }

    // ---------- ВЕРХ: глубина + XP ----------
    ctx2d.textAlign="left"; ctx2d.font="12px 'Courier New', monospace";
    ctx2d.fillStyle=AMBER;
    ctx2d.fillText("DEPTH " + depth + "/" + MAX_LEVEL, 10, 20);
    ctx2d.textAlign="right";
    ctx2d.fillText("XP " + hero.xp, W-10, 20);

    // ---------- НИЗ: статы (STR IQ WIS DEX Hits) + HP/MP/золото ----------
    ctx2d.textAlign="left"; ctx2d.font="bold 12px 'Courier New', monospace";
    ctx2d.fillText("STR "+hero.str+"  IQ "+hero.iq+"  WIS "+hero.wis+
                   "  DEX "+hero.dex+"  Hits "+hero.hp+"/"+hero.maxhp, 10, H-34);
    ctx2d.fillText("MP "+hero.mp+"/"+hero.maxmp+"   GOLD "+hero.gold+
                   "   POTIONS "+hero.potions+"   SCROLLS "+hero.scrolls, 10, H-16);
    // Строка события внизу (мигает, как в оригинале).
    ctx2d.font="13px 'Courier New', monospace";
    ctx2d.textAlign="center";
    ctx2d.globalAlpha=0.6+0.25*Math.sin(now*0.004);
    ctx2d.fillText(bottomText, W/2, H-58);
    ctx2d.globalAlpha=1;
    ctx2d.textAlign="left";
    line(0,VH,W,VH,1); line(0,H-66,W,H-66,1);
  }

  function drawTitle() {
    const cx=W/2; ctx2d.fillStyle=AMBER; ctx2d.textAlign="center";
    ctx2d.font="bold 40px 'Courier New', monospace"; ctx2d.fillText("DND", cx, 110);
    ctx2d.font="16px 'Courier New', monospace";
    ctx2d.fillText("The Game of Dungeons · 1975 · PLATO", cx, 140);
    ctx2d.font="13px 'Courier New', monospace";
    [
      "20 уровней вниз. На дне — Golden Dragon и Orb.",
      "",
      "WASD / стрелки — идти",
      "1-8 — заклинания (список слева)",
      "P — зелье   R — новая игра",
      "",
      "Нажми стрелку, чтобы начать.",
    ].forEach((l,i)=>ctx2d.fillText(l,cx,200+i*26));
  }

  // ---------- ЛОГИКА ----------
  function descend() {
    if (depth >= MAX_LEVEL) { setMsg("Дальше некуда."); render(); return; }
    depth++;
    map = buildMap(depth);
    const s = findStart();
    hero.x = s.x; hero.y = s.y;
    mon = null;
    play("dg_dun" + Math.min(4, Math.ceil(depth/5)));
    bottom("Ты спускаешься на уровень " + depth + ".");
    lastEvent = "";
    render();
  }

  function move(dx, dy) {
    if (over || !hero) return;
    if (mon) { attack(); return; }
    const nx=hero.x+dx, ny=hero.y+dy, c=cell(nx,ny);
    if (c === "#") { setMsg("Стена."); render(); return; }
    if (c === "+") {
      if (hero.str >= 12 || Math.random() < 0.55) {
        setCell(nx,ny,"/");
        bottom("You kicked the door open!");
      } else bottom("The door holds.");
      render(); return;
    }
    if (c === "~") { setCell(nx,ny,"/"); bottom("You found a secret door!"); render(); return; }
    if (MON[c]) { startBattle(c,nx,ny); return; }
    if (c === ">") { descend(); return; }
    if (c === "*") { winGame(); return; }
    if (c === "$") {
      const g = 5 + Math.floor(Math.random()*25) * depth;
      hero.gold += g; setCell(nx,ny,".");
      bottom("You found $" + g + " in gold!");
    }
    if (c === "!") { hero.potions++; setCell(nx,ny,"."); bottom("You found a potion!"); }
    if (c === "?") { hero.scrolls++; setCell(nx,ny,"."); bottom("You found a scroll!"); }
    hero.x=nx; hero.y=ny;
    render();
  }

  function startBattle(c, x, y) {
    if (!mon || mon.x!==x || mon.y!==y) {
      mon={ ch:c, x, y, hp:MON[c].hp, maxhp:MON[c].hp,
            name:MON[c].name, atk:MON[c].atk, xp:MON[c].xp, boss:!!MON[c].boss };
      play(mon.boss ? "dg_boss" : "dg_battle");
    }
    setMsg("Battle: " + mon.name + "!");
    bottom(mon.name + " attacks! (HP " + mon.hp + ")");
    render();
  }

  function attack() {
    if (!mon) return;
    const dmg = hero.str + Math.floor(Math.random()*5);
    mon.hp -= dmg;
    if (mon.hp <= 0) {
      hero.xp += mon.xp;
      setMsg("You killed it!");
      bottom("You killed the " + mon.name + "! +" + mon.xp + " XP.");
      setCell(mon.x,mon.y,".");
      const wasBoss = mon.boss;
      mon = null;
      if (wasBoss) { play("dg_victory"); render(); return; }
      musicExplore();
      render(); return;
    }
    setMsg("You hit for " + dmg + "!");
    const md = mon.atk + Math.floor(Math.random()*4);
    hero.hp -= Math.max(1, Math.round(md - hero.dex/8));
    if (hero.hp <= 0) { hero.hp = 0; lose(); return; }
    bottom(mon.name + " hits you for " + md + ".");
    render();
  }

  function castSpell(idx) {
    if (!hero) return;
    const sp = SPELLS[idx]; if (!sp) return;
    if (hero.mp < sp.mp) { setMsg("Not enough MP!"); bottom("You lack the power."); render(); return; }
    hero.mp -= sp.mp;
    if (sp.effect === "light") { setMsg("Light!"); bottom("A candle flickers."); }
    else if (sp.effect === "heal") {
      hero.hp = Math.min(hero.maxhp, hero.hp + sp.power);
      setMsg("+" + sp.power + " Hits"); bottom("Holy light heals you.");
    } else if (sp.effect === "shield") {
      hero.shield = sp.power; setMsg("Shield " + sp.power);
      bottom("A barrier surrounds you.");
    } else if (sp.effect === "damage") {
      if (mon) {
        mon.hp -= sp.power; setMsg(sp.name + ": " + sp.power);
        bottom(sp.name + " strikes the " + mon.name + "!");
        if (mon.hp <= 0) {
          hero.xp += mon.xp;
          setCell(mon.x, mon.y, ".");
          const wasBoss = mon.boss; mon = null;
          if (wasBoss) { play("dg_victory"); render(); return; }
          musicExplore();
        }
      } else { setMsg(sp.name + " (нет цели)"); bottom("Nothing to strike."); }
    } else if (sp.effect === "sleep") {
      if (mon) {
        hero.xp += mon.xp;
        bottom("The " + mon.name + " is held!");
        setCell(mon.x, mon.y, ".");
        const wasBoss = mon.boss; mon = null;
        if (wasBoss) { play("dg_victory"); render(); return; }
        musicExplore();
      } else bottom("Nothing to hold.");
    } else if (sp.effect === "stairs") {
      if (depth < MAX_LEVEL) { descend(); return; }
      bottom("Нельзя телепортироваться дальше.");
    }
    render();
  }

  function potion() {
    if (!hero || hero.potions<=0 || hero.hp>=hero.maxhp) return;
    hero.potions--; hero.hp=Math.min(hero.maxhp,hero.hp+10);
    setMsg("+10 Hits"); bottom("You drink a potion."); render();
  }

  function winGame() {
    over=true; won=true; play("dg_victory");
    setMsg("The Amulet tells you: You have won!");
    bottom("You got it! The Orb is yours!");
    showEnd("★ ORB IS YOURS ★", "Ты добыл Orb! XP: " + hero.xp + ", золото: " + hero.gold);
    render();
  }
  function lose() {
    over=true; play("dg_death");
    setMsg("You are dead.");
    bottom("The darkness takes you. R — заново.");
    showEnd("☠ YOU DIED ☠", "Нажми R, чтобы начать заново.");
    render();
  }
  function showEnd(title,text) {
    const p=document.getElementById("end-panel"); if (!p) return;
    p.classList.remove("hidden");
    document.getElementById("end-title").textContent=title;
    document.getElementById("end-text").textContent=text;
  }

  function rollStat() { return 3 + Math.floor(Math.random()*16); }

  function newGame() {
    depth = 1;
    map = buildMap(depth);
    const s = findStart();
    hero = {
      x:s.x, y:s.y,
      str:rollStat(), iq:rollStat(), wis:rollStat(), dex:rollStat(),
      hp:1+Math.floor(Math.random()*8), maxhp:0,
      gold:0, xp:0, potions:2, scrolls:1,
      mp:6, maxmp:6, shield:0,
    };
    hero.maxhp = hero.hp + Math.floor(hero.wis/4);
    hero.hp = hero.maxhp;
    over=false; won=false; mon=null;
    const p=document.getElementById("end-panel"); if (p) p.classList.add("hidden");
    play("dg_dun1");
    bottom("You enter the dungeon. Find the Orb on level 20.");
    render();
  }

  // ---------- ВВОД ----------
  function bind() {
    window.addEventListener("keydown", (e) => {
      const k = e.key;
      if (!hero) {
        if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D"].includes(k)) {
          e.preventDefault(); newGame(); return;
        }
        return;
      }
      if (k==="ArrowUp"||k==="w"||k==="W"||k==="ц") { e.preventDefault(); move(0,-1); }
      else if (k==="ArrowDown"||k==="s"||k==="S"||k==="ы") { e.preventDefault(); move(0,1); }
      else if (k==="ArrowLeft"||k==="a"||k==="A"||k==="ф") { e.preventDefault(); move(-1,0); }
      else if (k==="ArrowRight"||k==="d"||k==="D"||k==="в") { e.preventDefault(); move(1,0); }
      else if (k===" ") { e.preventDefault(); attack(); }
      else if (k==="p"||k==="P"||k==="з") { e.preventDefault(); potion(); }
      else if (k==="r"||k==="R"||k==="к") { e.preventDefault(); newGame(); }
      else if (k>="1" && k<="8") { e.preventDefault(); castSpell(parseInt(k,10)-1); }
    });
    const bs=document.getElementById("title-start");
    if (bs) bs.addEventListener("click", () => {
      document.getElementById("title-panel").classList.add("hidden");
      play("dg_menu"); setTimeout(newGame, 250);
    });
    const en=document.getElementById("end-new");
    if (en) en.addEventListener("click", newGame);
  }

  function init() {
    canvas=document.getElementById("view"); if (!canvas) return;
    canvas.width=W; canvas.height=H;
    ctx2d=canvas.getContext("2d");
    bind(); render();
    window.addEventListener("pointerdown", function once() {
      if (!audioOk) play("dg_menu");
      window.removeEventListener("pointerdown", once);
    });
    setInterval(() => { if (!over || hero) render(); }, 120);
  }

  function __debug() {
    return { hero:()=>hero, mon:()=>mon, over:()=>over, won:()=>won,
      depth:()=>depth, move, attack, potion, castSpell, newGame, winGame,
      descend, map:()=>map, setPos:(x,y)=>{hero.x=x;hero.y=y;render();}, cell };
  }

  return { init, newGame, render, move, attack, potion, castSpell, descend, __debug };
})();
window.addEventListener("DOMContentLoaded", () => DG.init());