/*
 * التنقل + اللعبة.
 * الجولات الحقيقية (مدفوعة ومجانية) تنحسب في السيرفر: أماكن القنابل وقيم الجواهر ما توصل
 * للجوال إلا بعد ما ينفتح المربع أو تنتهي الجولة، والرصيد ينحفظ في السيرفر فقط.
 * جولة التجربة محلية بالكامل وما لها أي أثر.
 */
(function () {
  "use strict";

  var A = window.LuoApi;
  var h = A.h;
  var haptic = A.haptic;
  var $ = function (id) { return document.getElementById(id); };

  var CELLS = 25;
  var COLS = 5;
  var DEMO_GEM_VALUES = [[1, 300], [2, 220], [5, 170], [10, 120], [25, 80], [50, 50], [100, 30], [250, 17], [500, 9], [1000, 4]];
  var RARE_FROM = 100;
  var TOP_FROM = 1000;
  var VERIFY_EVERY_MS = 4000;
  var VERIFY_TRIES = 30;
  var PAID_MARK_TTL_MS = 10 * 60 * 1000;

  /* ---------- التنقل ---------- */

  function showView(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      var active = t.getAttribute("data-view") === id;
      var el = $(t.getAttribute("data-view"));
      if (el) el.hidden = !active;
      if (active) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });
    document.body.setAttribute("data-view", id);
    window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent("luo:view", { detail: id }));
  }

  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (tab) {
    tab.addEventListener("click", function () {
      showView(tab.getAttribute("data-view"));
      haptic("light");
    });
  });

  /* ---------- عشوائية جولة التجربة ---------- */

  function randomInt(max) {
    var cryptoObj = window.crypto || window.msCrypto;
    if (!cryptoObj || !cryptoObj.getRandomValues) return Math.floor(Math.random() * max);
    var limit = Math.floor(0x100000000 / max) * max;
    var buf = new Uint32Array(1);
    for (var i = 0; i < 64; i++) {
      cryptoObj.getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % max;
    }
    return buf[0] % max;
  }

  function dealDemo(bombCount) {
    var isBomb = [];
    var i;
    for (i = 0; i < CELLS; i++) isBomb.push(i < bombCount);
    for (i = CELLS - 1; i > 0; i--) {
      var k = randomInt(i + 1);
      var tmp = isBomb[i];
      isBomb[i] = isBomb[k];
      isBomb[k] = tmp;
    }
    var total = DEMO_GEM_VALUES.reduce(function (t, r) { return t + r[1]; }, 0);
    var bombs = [];
    var vals = isBomb.map(function (b, idx) {
      if (b) { bombs.push(idx); return 0; }
      var pick = randomInt(total);
      for (var j = 0; j < DEMO_GEM_VALUES.length; j++) {
        pick -= DEMO_GEM_VALUES[j][1];
        if (pick < 0) return DEMO_GEM_VALUES[j][0];
      }
      return DEMO_GEM_VALUES[0][0];
    });
    return { bombs: bombs, vals: vals };
  }

  /* ---------- المؤثرات ---------- */

  var fx = $("fx");
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { reduceMotion = false; }

  function fxAdd(el, ms) {
    if (!fx) return;
    fx.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, ms);
  }

  function floatText(fromEl, text, gold) {
    if (reduceMotion) return;
    var r = fromEl.getBoundingClientRect();
    var el = h("div", { class: "fx-float" + (gold ? " gold" : ""), text: text });
    el.style.left = r.left + r.width / 2 + "px";
    el.style.top = r.top + r.height / 2 + "px";
    fxAdd(el, 1000);
  }

  function burst(fromEl, count) {
    if (reduceMotion) return;
    var r = fromEl.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var colors = ["#f6e3a8", "#d9b160", "#b98a34", "#fbf6ea", "#e9dfc9", "#2a1a10"];
    for (var i = 0; i < count; i++) {
      var bit = h("i", { class: "fx-bit" });
      var angle = Math.random() * Math.PI * 2;
      var dist = 90 + Math.random() * 190;
      bit.style.left = cx + "px";
      bit.style.top = cy + "px";
      bit.style.background = colors[i % colors.length];
      bit.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      bit.style.setProperty("--dy", Math.sin(angle) * dist + 120 + "px");
      bit.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
      bit.style.animationDelay = Math.random() * 90 + "ms";
      fxAdd(bit, 1500);
    }
  }

  function flashRed() {
    if (!reduceMotion) fxAdd(h("div", { class: "fx-flash" }), 600);
  }

  function restartAnimation(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  var counters = {};
  function countTo(id, target) {
    var el = $(id);
    var c = counters[id] || (counters[id] = { shown: 0, raf: 0 });
    cancelAnimationFrame(c.raf);
    if (reduceMotion) { c.shown = target; el.textContent = String(target); return; }
    var from = c.shown;
    var start = 0;
    function step(ts) {
      if (!start) start = ts;
      var t = Math.min(1, (ts - start) / 380);
      c.shown = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      el.textContent = String(c.shown);
      if (t < 1) c.raf = requestAnimationFrame(step);
    }
    c.raf = requestAnimationFrame(step);
  }

  function setCount(id, value) {
    var c = counters[id] || (counters[id] = { shown: 0, raf: 0 });
    cancelAnimationFrame(c.raf);
    c.shown = value;
    $(id).textContent = String(value);
  }

  /* ---------- الحالة ---------- */

  var board = $("board");
  var view = $("viewGame");
  var statusEl = $("gameStatus");
  var scoreEl = $("scoreValue");
  var noteEl = $("gameNote");
  var newBtn = $("newGameBtn");
  var freeBtn = $("freeBtn");
  var demoBtn = $("demoBtn");
  var collectBtn = $("collectBtn");

  // بيانات الجلسة من السيرفر
  var S = { online: false, reason: "", isAdmin: false, player: null, settings: { price: "", bombs: 5, enabled: true }, anns: [] };
  // الجولة الحالية: { kind: "real" | "demo", id, bombCount, opened: {}, found, score, over, busy, bombs, vals }
  var R = null;
  var phase = "idle"; // idle | paying | verifying
  var verifyToken = 0;

  var OFFLINE_TEXT = {
    NOT_IN_TELEGRAM: "افتح التطبيق من داخل تلقرام عشان تلعب لعبة حقيقية.",
    NOT_CONFIGURED: "اللعبة الحقيقية تتفعّل قريب. جرّب وضع التجربة.",
    HTTP_503: "اللعبة الحقيقية تتفعّل قريب. جرّب وضع التجربة.",
    UNAUTHORIZED: "انتهت الجلسة. سكّر التطبيق وافتحه من جديد.",
    NETWORK: "ما فيه اتصال بالسيرفر. تأكد من النت.",
    BANNED: "حسابك موقوف من صاحب البوت.",
    NO_API: "اللعبة الحقيقية غير مفعّلة."
  };

  var ERROR_TEXT = {
    NOT_CONNECTED: "اربط محفظتك أول عشان تلعب.",
    BUSY: "فيه عملية ثانية شغالة، انتظر شوي.",
    BALANCE_LOW: "رصيدك من TON ما يكفي لسعر الجولة.",
    REJECTED: "ألغيت الدفع من المحفظة.",
    FAILED: "ما تم الدفع. جرّب مرة ثانية.",
    GAME_DISABLED: "اللعبة موقفة مؤقتًا من صاحب البوت.",
    NO_FREE_PLAYS: "ما عندك جولات مجانية.",
    NETWORK: "انقطع الاتصال. جرّب مرة ثانية.",
    BANNED: "حسابك موقوف من صاحب البوت.",
    UNAUTHORIZED: "انتهت الجلسة. سكّر التطبيق وافتحه من جديد.",
    ANNOUNCEMENT_GONE: "هذا العرض انتهى.",
    ALREADY_CLAIMED: "استلمت هذا العرض من قبل."
  };

  function errorText(e) {
    return ERROR_TEXT[e && e.code] || "صار خطأ. جرّب مرة ثانية.";
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = "game-status" + (cls ? " " + cls : "");
  }

  function setNote(text) {
    noteEl.textContent = text || "";
    noteEl.hidden = !text;
  }

  function inRound() {
    return Boolean(R && !R.over);
  }

  function renderBalance(bump) {
    var el = $("balanceValue");
    var text = S.player ? A.group(S.player.balance) : "—";
    if (bump && el.textContent !== text) restartAnimation(el.parentNode, "bump");
    el.textContent = text;
  }

  function updateButtons() {
    var playing = inRound();
    var demo = playing && R.kind === "demo";
    view.classList.toggle("in-round", playing);
    view.classList.toggle("demo", demo);
    $("demoChip").hidden = !demo;

    collectBtn.hidden = !playing;
    if (playing) {
      var label = demo ? "اجمع (تجربة)" : "اجمع ووقّف";
      collectBtn.disabled = R.found === 0 || R.busy;
      collectBtn.textContent = R.found === 0 ? label : label + " · +" + R.score;
    }

    // في جولة التجربة يبقى زر اللعبة الحقيقية ظاهر
    newBtn.hidden = playing && !demo;
    var price = S.settings.price ? " · " + S.settings.price + " TON" : "";
    if (!S.online) {
      newBtn.disabled = true;
      newBtn.textContent = "لعبة حقيقية";
    } else if (!S.settings.enabled) {
      newBtn.disabled = true;
      newBtn.textContent = "اللعبة موقفة مؤقتًا";
    } else if (phase === "paying") {
      newBtn.disabled = true;
      newBtn.textContent = "أكّد الدفع من محفظتك…";
    } else if (phase === "verifying") {
      newBtn.disabled = true;
      newBtn.textContent = "نتحقق من وصول الدفعة…";
    } else {
      newBtn.disabled = false;
      newBtn.textContent = (demo ? "لعبة حقيقية" : "لعبة جديدة") + price;
    }

    var free = S.online && S.player ? S.player.freePlays : 0;
    freeBtn.hidden = playing || free <= 0 || !S.settings.enabled;
    freeBtn.disabled = phase !== "idle";
    freeBtn.textContent = "🎁 مجانية ×" + free;

    demoBtn.hidden = playing;
    demoBtn.disabled = phase !== "idle";
  }

  /* ---------- اللوحة ---------- */

  function paint(tile, kind, value, byPlayer) {
    tile.textContent = "";
    tile.appendChild(h("span", { class: "tile-icon", text: kind === "bomb" ? "💣" : "💎" }));
    if (kind === "gem") {
      tile.appendChild(h("span", { class: "tile-value", text: String(value) }));
      if (value >= TOP_FROM) tile.classList.add("top");
      else if (value >= RARE_FROM) tile.classList.add("rare");
    }
    tile.disabled = true;
    tile.classList.remove("wait");
    tile.classList.add("open", kind);
    if (!byPlayer) tile.classList.add("ghost");
    tile.setAttribute("aria-label", kind === "bomb" ? "قنبلة" : "جوهرة " + value);
  }

  function drawBoard(locked) {
    board.style.setProperty("--cols", String(COLS));
    board.classList.toggle("locked", locked);
    board.textContent = "";
    for (var i = 0; i < CELLS; i++) {
      var tile = h("button", { type: "button", class: "tile", "aria-label": "مربع مغلق", disabled: locked });
      tile.style.setProperty("--i", String(i));
      if (!locked) tile.addEventListener("click", onTile.bind(null, i, tile));
      board.appendChild(tile);
    }
  }

  function resetCounters(bombCount) {
    $("gemCount").textContent = "0";
    $("gemTotal").textContent = "/" + (CELLS - bombCount);
    $("bombCount").textContent = String(bombCount);
    setCount("scoreValue", 0);
    scoreEl.classList.remove("lost", "won");
  }

  // يكشف باقي اللوحة بعد نهاية الجولة
  function reveal(bombs, vals) {
    var tiles = board.children;
    var order = 0;
    for (var i = 0; i < CELLS; i++) {
      if (R.opened[i]) continue;
      tiles[i].style.setProperty("--i", String(order++));
      var isBomb = bombs.indexOf(i) !== -1;
      paint(tiles[i], isBomb ? "bomb" : "gem", vals[i], false);
    }
  }

  function endRound(bombs, vals) {
    R.over = true;
    R.busy = false;
    reveal(bombs, vals);
    updateButtons();
  }

  function showGem(i, tile, value, score) {
    R.opened[i] = true;
    R.found++;
    R.score = score;
    paint(tile, "gem", value, true);
    $("gemCount").textContent = String(R.found);
    countTo("scoreValue", score);
    var big = value >= RARE_FROM;
    floatText(tile, "+" + value, big);
    if (big) burst(tile, value >= TOP_FROM ? 44 : 16);
    haptic(value >= TOP_FROM ? "success" : "light");
  }

  function showBomb(i, tile, bombs, vals) {
    R.opened[i] = true;
    R.score = 0;
    paint(tile, "bomb", 0, true);
    tile.classList.add("hit");
    haptic("error");
    flashRed();
    restartAnimation(board, "shake");
    scoreEl.classList.add("lost");
    countTo("scoreValue", 0);
    setStatus(R.kind === "demo" ? "💥 خسرت (تجربة)" : "💥 خسرت!", "lose");
    endRound(bombs, vals);
  }

  function showWin(bombs, vals) {
    haptic("success");
    setStatus(R.kind === "demo" ? "🏆 فزت (تجربة)" : "🏆 فزت! +" + R.score, "win");
    scoreEl.classList.add("won");
    burst(board, 70);
    endRound(bombs, vals);
  }

  function showCollected(bombs, vals) {
    haptic("success");
    setStatus(R.kind === "demo" ? "تجربة: ما تنحسب" : "✅ جمعت +" + R.score, "win");
    scoreEl.classList.add("won");
    burst(collectBtn, 60);
    endRound(bombs, vals);
  }

  function setBalance(balance) {
    if (!S.player || typeof balance !== "number") return;
    S.player.balance = balance;
    renderBalance(true);
  }

  /* ---------- اللعب ---------- */

  async function onTile(i, tile) {
    if (!inRound() || R.opened[i] || R.busy) return;

    if (R.kind === "demo") {
      if (R.bombs.indexOf(i) !== -1) return showBomb(i, tile, R.bombs, R.vals);
      showGem(i, tile, R.vals[i], R.score + R.vals[i]);
      if (R.found === CELLS - R.bombCount) return showWin(R.bombs, R.vals);
      setStatus("كمّل أو اجمع");
      return updateButtons();
    }

    var round = R;
    round.busy = true;
    tile.classList.add("wait");
    updateButtons();
    var res;
    try {
      res = await A.call("open", { roundId: round.id, index: i });
    } catch (e) {
      if (R !== round) return;
      round.busy = false;
      tile.classList.remove("wait");
      updateButtons();
      if (e.code === "ALREADY_OPEN") return;
      if (e.code === "ROUND_NOT_ACTIVE" || e.code === "ROUND_NOT_FOUND") { R = null; return boot(); }
      A.toast(errorText(e));
      return;
    }
    if (R !== round) return;
    round.busy = false;
    if (res.result === "bomb") return showBomb(i, tile, res.bombs, res.vals);
    showGem(i, tile, res.value, res.score);
    if (res.result === "won") {
      setBalance(res.balance);
      return showWin(res.bombs, res.vals);
    }
    setStatus("كمّل أو اجمع");
    updateButtons();
  }

  async function collect() {
    if (!inRound() || R.found === 0 || R.busy) return;
    if (R.kind === "demo") return showCollected(R.bombs, R.vals);

    var round = R;
    round.busy = true;
    updateButtons();
    try {
      var res = await A.call("collect", { roundId: round.id });
      if (R !== round) return;
      round.score = res.score;
      setBalance(res.balance);
      showCollected(res.bombs, res.vals);
    } catch (e) {
      if (R !== round) return;
      round.busy = false;
      updateButtons();
      if (e.code === "ROUND_NOT_ACTIVE" || e.code === "ROUND_NOT_FOUND") { R = null; return boot(); }
      A.toast(errorText(e));
    }
  }

  // يبدأ (أو يكمّل) جولة حقيقية جاية من السيرفر
  function enterRound(rv) {
    verifyToken++;
    phase = "idle";
    R = { kind: "real", id: rv.id, mode: rv.mode, bombCount: rv.bombCount, opened: {}, found: 0, score: rv.score, over: false, busy: false };
    drawBoard(false);
    resetCounters(rv.bombCount);
    (rv.opened || []).forEach(function (pair) {
      R.opened[pair[0]] = true;
      R.found++;
      var tile = board.children[pair[0]];
      paint(tile, "gem", pair[1], true);
      tile.style.animation = "none";
    });
    $("gemCount").textContent = String(R.found);
    setCount("scoreValue", R.score);
    setStatus(R.found ? "كمّل أو اجمع" : rv.mode === "free" ? "جولة مجانية: اختر مربع" : "اختر مربع");
    setNote("");
    updateButtons();
  }

  function startDemo() {
    if (phase !== "idle" || inRound()) return;
    haptic("light");
    var bombCount = Math.min(Math.max(Number(S.settings.bombs) || 5, 1), CELLS - 1);
    var deal = dealDemo(bombCount);
    R = { kind: "demo", bombCount: bombCount, bombs: deal.bombs, vals: deal.vals, opened: {}, found: 0, score: 0, over: false, busy: false };
    drawBoard(false);
    resetCounters(bombCount);
    setStatus("تجربة: اختر مربع");
    setNote("");
    updateButtons();
  }

  async function startFree() {
    if (phase !== "idle" || inRound() || !S.online) return;
    haptic("medium");
    freeBtn.disabled = true;
    try {
      var res = await A.call("start", { mode: "free" });
      if (typeof res.freePlays === "number") S.player.freePlays = res.freePlays;
      enterRound(res.round);
    } catch (e) {
      setNote(errorText(e));
      if (e.code === "NO_FREE_PLAYS" && S.player) S.player.freePlays = 0;
      updateButtons();
    }
  }

  /* ---------- الدفع ---------- */

  // علامة محلية إن المحفظة أرسلت دفعة هذه الجولة، عشان ما ينطلب الدفع مرتين والعملية لسه في الطريق
  function paidMark(id, set) {
    var key = "luo_paid_" + id;
    try {
      if (set) { window.localStorage.setItem(key, String(Date.now())); return true; }
      var at = Number(window.localStorage.getItem(key));
      return Boolean(at) && Date.now() - at < PAID_MARK_TTL_MS;
    } catch (e) {
      return false;
    }
  }

  async function verify(roundId) {
    var token = ++verifyToken;
    phase = "verifying";
    setNote("وصلت العملية للشبكة، ننتظر تأكيدها. ياخذ عادةً أقل من دقيقة.");
    updateButtons();
    for (var i = 0; i < VERIFY_TRIES; i++) {
      await new Promise(function (resolve) { setTimeout(resolve, i === 0 ? 2500 : VERIFY_EVERY_MS); });
      if (token !== verifyToken) return;
      try {
        var res = await A.call("confirm", { roundId: roundId });
        if (token !== verifyToken) return;
        if (res.round && res.round.status === "active") return enterRound(res.round);
      } catch (e) {
        if (token !== verifyToken) return;
        if (e.code !== "NETWORK") break;
      }
    }
    if (token !== verifyToken) return;
    phase = "idle";
    setNote("ما تأكدت الدفعة للحين. لو دفعت فعلًا، اضغط «لعبة جديدة» بعد شوي وبتكمل بدون دفع ثاني.");
    updateButtons();
  }

  async function startPaid() {
    if (phase !== "idle" || !S.online || !S.settings.enabled) return;
    if (inRound() && R.kind !== "demo") return;
    haptic("medium");

    var wallet = window.LuoWallet;
    if (!wallet) return setNote("ما تحمّلت المحفظة. أعد فتح التطبيق.");

    phase = "paying";
    setNote("");
    updateButtons();
    var rv;
    try {
      rv = (await A.call("start", { mode: "paid" })).round;
      if (rv.status === "active") return enterRound(rv);
      // جولة بانتظار الدفع: نتأكد أول إنها ما اندفعت من قبل
      var check = await A.call("confirm", { roundId: rv.id });
      if (check.round && check.round.status === "active") return enterRound(check.round);
    } catch (e) {
      phase = "idle";
      setNote(errorText(e));
      return updateButtons();
    }
    if (paidMark(rv.id, false)) return verify(rv.id);

    if (!wallet.isConnected()) {
      phase = "idle";
      setNote(ERROR_TEXT.NOT_CONNECTED);
      updateButtons();
      return wallet.connect();
    }
    try {
      await wallet.payTon(rv.pay.to, BigInt(rv.pay.amountNano), rv.pay.comment);
    } catch (e) {
      phase = "idle";
      haptic("error");
      setNote(errorText(e));
      return updateButtons();
    }
    paidMark(rv.id, true);
    verify(rv.id);
  }

  /* ---------- بطاقات الإعلانات ---------- */

  var KIND_ICON = { news: "📣", ad: "⭐", free_game: "🎁" };

  function dismissed() {
    try { return JSON.parse(window.localStorage.getItem("luo_dismissed") || "[]"); } catch (e) { return []; }
  }

  function dismiss(id) {
    try {
      var list = dismissed().filter(function (x) { return x !== id; });
      list.push(id);
      window.localStorage.setItem("luo_dismissed", JSON.stringify(list.slice(-50)));
    } catch (e) { /* التخزين المحلي غير متاح */ }
    S.anns = S.anns.filter(function (a) { return a.id !== id; });
    renderCards();
  }

  function openLink(url) {
    if (!/^https:\/\//i.test(url)) return;
    try {
      if (A.tg && /^https:\/\/t\.me\//i.test(url) && A.tg.openTelegramLink) return A.tg.openTelegramLink(url);
      if (A.tg && A.tg.openLink) return A.tg.openLink(url);
    } catch (e) { /* نكمل بالطريقة العادية */ }
    window.open(url, "_blank", "noopener");
  }

  async function claim(ann, btn) {
    btn.disabled = true;
    try {
      var res = await A.call("claim", { id: ann.id });
      S.player.freePlays = res.freePlays;
      S.anns = S.anns.filter(function (a) { return a.id !== ann.id; });
      renderCards();
      A.toast("انضافت لك " + res.granted + " جولة مجانية 🎁");
      haptic("success");
      updateButtons();
      // يبدأ الجولة المجانية مباشرة، إلا إذا فيه جولة حقيقية شغالة
      if (inRound() && R.kind === "demo") R = null;
      if (!inRound()) startFree();
    } catch (e) {
      btn.disabled = false;
      A.toast(errorText(e));
      if (e.code === "ALREADY_CLAIMED" || e.code === "ANNOUNCEMENT_GONE") {
        S.anns = S.anns.filter(function (a) { return a.id !== ann.id; });
        renderCards();
      }
    }
  }

  function renderCards() {
    var root = $("cards");
    var hidden = dismissed();
    var list = S.anns.filter(function (a) { return a.kind === "free_game" || hidden.indexOf(a.id) === -1; });
    root.textContent = "";
    root.hidden = list.length === 0;
    view.classList.toggle("has-cards", list.length > 0);
    list.forEach(function (a) {
      var action = null;
      if (a.kind === "free_game") {
        action = h("button", { type: "button", class: "ann-btn", text: a.button || "العب مجانًا" });
        action.addEventListener("click", function () { claim(a, action); });
      } else if (a.url) {
        action = h("button", { type: "button", class: "ann-btn", text: a.button || "افتح", onclick: function () { openLink(a.url); } });
      }
      root.appendChild(h("article", { class: "ann ann-" + a.kind },
        h("div", { class: "ann-icon", text: KIND_ICON[a.kind] || "📣" }),
        h("div", { class: "ann-text" },
          h("div", { class: "ann-title", text: a.title }),
          a.body ? h("div", { class: "ann-body", text: a.body }) : null),
        action,
        a.kind === "free_game" ? null : h("button", { type: "button", class: "ann-close", "aria-label": "إخفاء", text: "×", onclick: function () { dismiss(a.id); } })
      ));
    });
  }

  /* ---------- الجلسة ---------- */

  var booting = null;

  function idleBoard(statusText) {
    if (inRound()) return;
    R = null;
    drawBoard(true);
    resetCounters(Number(S.settings.bombs) || 5);
    setStatus(statusText);
  }

  function boot() {
    if (booting) return booting;
    booting = (async function () {
      try {
        var data = await A.call("session");
        S.player = data.player;
        S.isAdmin = Boolean(data.isAdmin);
        if (data.player.banned) {
          S.online = false;
          S.reason = "BANNED";
        } else {
          S.online = true;
          S.reason = "";
          S.settings = data.settings;
          S.anns = data.announcements || [];
        }
        document.dispatchEvent(new CustomEvent("luo:session", { detail: { isAdmin: S.isAdmin } }));
        renderBalance(false);
        renderCards();
        if (S.online && data.round && data.round.status === "active" && !(inRound() && R.kind === "real" && R.id === data.round.id)) {
          enterRound(data.round);
        } else {
          idleBoard(S.online ? "ابدأ جولة" : "غير متاحة");
          setNote(S.online ? "" : OFFLINE_TEXT[S.reason] || "");
          updateButtons();
          // دفعة سابقة ما تأكدت قبل ما ينقفل التطبيق
          if (S.online && phase === "idle" && data.round && data.round.status === "pending" && paidMark(data.round.id, false)) verify(data.round.id);
        }
      } catch (e) {
        S.online = false;
        S.reason = e.code || "NETWORK";
        renderBalance(false);
        idleBoard("جرّب اللعبة");
        setNote(OFFLINE_TEXT[S.reason] || OFFLINE_TEXT.NETWORK);
        updateButtons();
      }
      booting = null;
    })();
    return booting;
  }

  newBtn.addEventListener("click", startPaid);
  freeBtn.addEventListener("click", startFree);
  demoBtn.addEventListener("click", startDemo);
  collectBtn.addEventListener("click", collect);

  // لو رجع المستخدم للتطبيق والجلسة ما اشتغلت بسبب النت
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && !S.online && S.reason === "NETWORK") boot();
  });

  window.LuoGame = { refresh: boot, showView: showView };

  drawBoard(true);
  resetCounters(5);
  setStatus("جاري الاتصال…");
  renderBalance(false);
  updateButtons();
  boot();
})();
