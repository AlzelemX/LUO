/* التنقل بين الصفحات + لعبة الجواهر والقنابل */
(function () {
  "use strict";

  var COLS = 5;
  var ROWS = 5;
  var BOMBS = 5;
  var TOTAL = COLS * ROWS;
  var GEMS = TOTAL - BOMBS;

  var $ = function (id) { return document.getElementById(id); };
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  function haptic(kind) {
    try {
      if (!tg || !tg.HapticFeedback) return;
      if (kind === "success" || kind === "error") tg.HapticFeedback.notificationOccurred(kind);
      else tg.HapticFeedback.impactOccurred(kind || "light");
    } catch (e) { /* غير مدعوم */ }
  }

  /* ---------- التنقل ---------- */

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        var active = t === tab;
        $(t.getAttribute("data-view")).hidden = !active;
        if (active) t.setAttribute("aria-current", "page");
        else t.removeAttribute("aria-current");
      });
      window.scrollTo(0, 0);
      haptic("light");
    });
  });

  /* ---------- العشوائية ---------- */

  // عدد صحيح عشوائي في [0, max) بدون انحياز (rejection sampling)
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

  // يرجع مصفوفة منطقية: true = قنبلة (خلط Fisher–Yates)
  function dealBoard() {
    var cells = [];
    for (var i = 0; i < TOTAL; i++) cells.push(i < BOMBS);
    for (var j = TOTAL - 1; j > 0; j--) {
      var k = randomInt(j + 1);
      var tmp = cells[j];
      cells[j] = cells[k];
      cells[k] = tmp;
    }
    return cells;
  }

  /* ---------- قيم الجواهر ---------- */

  var DEFAULT_GEM_VALUES = [[1, 300], [2, 220], [5, 170], [10, 120], [25, 80], [50, 50], [100, 30], [250, 17], [500, 9], [1000, 4]];

  // يتحقق من الجدول القادم من الإعدادات؛ أي خلل يرجّعنا للقيم الافتراضية
  function readGemTable(raw) {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    var table = [];
    var total = 0;
    for (var i = 0; i < raw.length; i++) {
      var row = raw[i];
      if (!Array.isArray(row) || row.length !== 2) return null;
      var value = row[0];
      var weight = row[1];
      if (!Number.isSafeInteger(value) || value <= 0) return null;
      if (!Number.isSafeInteger(weight) || weight <= 0) return null;
      total += weight;
      table.push({ value: value, weight: weight });
    }
    if (!Number.isSafeInteger(total) || total > 0x7fffffff) return null;
    return { rows: table, total: total };
  }

  var gemCfg = (window.LUO_CONFIG && window.LUO_CONFIG.game && window.LUO_CONFIG.game.gemValues) || null;
  var gemTable = readGemTable(gemCfg);
  if (!gemTable) {
    if (gemCfg) console.error("Invalid gemValues config, using defaults.");
    gemTable = readGemTable(DEFAULT_GEM_VALUES);
  }
  var maxGemValue = gemTable.rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0);

  // يسحب قيمة جوهرة حسب الأوزان
  function drawGemValue() {
    var pick = randomInt(gemTable.total);
    for (var i = 0; i < gemTable.rows.length; i++) {
      pick -= gemTable.rows[i].weight;
      if (pick < 0) return gemTable.rows[i].value;
    }
    return gemTable.rows[gemTable.rows.length - 1].value;
  }

  /* ---------- اللعبة ---------- */

  var board = $("board");
  var statusEl = $("gameStatus");
  var newBtn = $("newGameBtn");
  var noteEl = $("gameNote");
  var bombs = [];
  var values = []; // قيمة الجوهرة في كل مربع (0 للقنبلة)
  var opened = [];
  var found = 0;
  var score = 0;
  var over = true; // ما فيه جولة شغالة
  var busy = false; // بانتظار تأكيد الدفع

  /* ---------- إعداد السعر ---------- */

  var Lib = window.LuoLib;
  var cfg = (window.LUO_CONFIG && window.LUO_CONFIG.game) || {};
  var payTo = String(cfg.payTo || "").trim();
  var paid = payTo !== "";
  var priceNano = 0n;
  var priceLabel = "";
  var configError = false;

  if (paid) {
    try {
      if (!Lib || !Lib.parseAddress(payTo)) throw new Error("bad payTo");
      priceNano = Lib.parseAmount(cfg.price, 9);
      priceLabel = Lib.formatUnits(priceNano, 9) + " TON";
    } catch (e) {
      // إعداد غلط: نقفل اللعبة بدل ما نرسل فلوس لعنوان خطأ
      configError = true;
      console.error("Invalid game payment config:", e);
    }
  }

  var PAY_ERRORS = {
    NOT_CONNECTED: "اربط محفظتك أول عشان تلعب.",
    BUSY: "فيه عملية ثانية شغالة، انتظر شوي.",
    BALANCE_LOW: "رصيدك من TON ما يكفي لسعر الجولة.",
    REJECTED: "ألغيت الدفع من المحفظة.",
    FAILED: "ما تم الدفع. جرّب مرة ثانية."
  };

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = "game-status" + (cls ? " " + cls : "");
  }

  function setNote(text) {
    noteEl.textContent = text || "";
    noteEl.hidden = !text;
  }

  function updateButton() {
    if (configError) {
      newBtn.disabled = true;
      newBtn.textContent = "اللعبة غير متاحة الحين";
      return;
    }
    if (busy) {
      newBtn.disabled = true;
      newBtn.textContent = "أكّد الدفع من محفظتك…";
      return;
    }
    if (paid && !over) {
      newBtn.disabled = true;
      newBtn.textContent = "الجولة شغالة";
      return;
    }
    newBtn.disabled = false;
    newBtn.textContent = paid ? "لعبة جديدة · " + priceLabel : "لعبة جديدة";
  }

  function paint(tile, index, byPlayer) {
    var isBomb = bombs[index];
    tile.textContent = "";
    var icon = document.createElement("span");
    icon.className = "tile-icon";
    icon.textContent = isBomb ? "💣" : "💎";
    tile.appendChild(icon);
    if (!isBomb) {
      var val = document.createElement("span");
      val.className = "tile-value";
      val.textContent = String(values[index]);
      tile.appendChild(val);
      if (values[index] >= maxGemValue) tile.classList.add("top");
      else if (values[index] * 10 >= maxGemValue) tile.classList.add("rare");
    }
    tile.disabled = true;
    tile.classList.add("open", isBomb ? "bomb" : "gem");
    if (!byPlayer) tile.classList.add("ghost");
    tile.setAttribute("aria-label", isBomb ? "قنبلة" : "جوهرة " + values[index]);
  }

  function finish() {
    over = true;
    var tiles = board.children;
    for (var i = 0; i < TOTAL; i++) {
      if (!opened[i]) paint(tiles[i], i, false);
    }
    updateButton();
  }

  function onTile(index, tile) {
    if (over || opened[index]) return;
    opened[index] = true;
    paint(tile, index, true);

    if (bombs[index]) {
      tile.classList.add("hit");
      haptic("error");
      setStatus("💥 خسرت!", "lose");
      finish();
      return;
    }

    found++;
    score += values[index];
    $("gemCount").textContent = String(found);
    $("scoreValue").textContent = String(score);
    if (values[index] >= maxGemValue) haptic("success");
    if (found === GEMS) {
      haptic("success");
      setStatus("🏆 فزت!", "win");
      finish();
    } else {
      haptic("light");
      setStatus("كمّل…");
    }
  }

  // يرسم لوحة مقفلة (قبل بدء أي جولة)
  function drawBoard(locked) {
    board.style.setProperty("--cols", String(COLS));
    board.classList.toggle("locked", locked);
    board.textContent = "";
    for (var i = 0; i < TOTAL; i++) {
      var tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.disabled = locked;
      tile.setAttribute("aria-label", "مربع مغلق");
      if (!locked) tile.addEventListener("click", onTile.bind(null, i, tile));
      board.appendChild(tile);
    }
    $("gemCount").textContent = "0";
    $("scoreValue").textContent = "0";
    $("gemTotal").textContent = "/" + GEMS;
    $("bombCount").textContent = String(BOMBS);
  }

  function startRound() {
    bombs = dealBoard();
    values = bombs.map(function (isBomb) { return isBomb ? 0 : drawGemValue(); });
    opened = [];
    found = 0;
    score = 0;
    over = false;
    drawBoard(false);
    setStatus("اختر مربع");
    setNote("");
    updateButton();
  }

  async function onNewGame() {
    if (busy || configError) return;
    if (paid && !over) return;
    haptic("medium");

    if (!paid) {
      startRound();
      return;
    }

    var wallet = window.LuoWallet;
    if (!wallet) {
      setNote("ما تحمّلت المحفظة. أعد فتح التطبيق.");
      return;
    }
    if (!wallet.isConnected()) {
      setNote(PAY_ERRORS.NOT_CONNECTED);
      wallet.connect();
      return;
    }

    busy = true;
    setNote("");
    updateButton();
    try {
      await wallet.payTon(payTo, priceNano, cfg.comment || "");
    } catch (e) {
      busy = false;
      haptic("error");
      setNote(PAY_ERRORS[e && e.code] || PAY_ERRORS.FAILED);
      updateButton();
      return;
    }
    busy = false;
    startRound();
  }

  newBtn.addEventListener("click", onNewGame);

  if (paid) {
    drawBoard(true);
    setStatus(configError ? "غير متاحة" : "ابدأ جولة");
    updateButton();
  } else {
    startRound();
  }
})();
