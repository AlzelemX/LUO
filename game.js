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

  /* ---------- اللعبة ---------- */

  var board = $("board");
  var statusEl = $("gameStatus");
  var newBtn = $("newGameBtn");
  var noteEl = $("gameNote");
  var bombs = [];
  var opened = [];
  var found = 0;
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
    tile.textContent = isBomb ? "💣" : "💎";
    tile.disabled = true;
    tile.classList.add("open", isBomb ? "bomb" : "gem");
    if (!byPlayer) tile.classList.add("ghost");
    tile.setAttribute("aria-label", isBomb ? "قنبلة" : "جوهرة");
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
    $("gemCount").textContent = String(found);
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
    $("gemTotal").textContent = "/" + GEMS;
    $("bombCount").textContent = String(BOMBS);
  }

  function startRound() {
    bombs = dealBoard();
    opened = [];
    found = 0;
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
