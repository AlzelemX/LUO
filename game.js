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

  /* ---------- الرصيد المحفوظ ---------- */

  /*
   * رصيد نقاط داخل اللعبة فقط: ما له قيمة مالية وما له علاقة بالمحفظة.
   * يُحفظ في Telegram CloudStorage (مربوط بحساب المستخدم ويتزامن بين أجهزته)،
   * وخارج تلقرام يُحفظ في المتصفح. التخزين من جهة المستخدم، يعني يقدر يعدّله.
   */
  var BALANCE_KEY = "luo_balance";
  var PENDING_KEY = "luo_balance_pending";
  var STORE_TIMEOUT_MS = 8000;
  var MAX_BALANCE = 999999999999999; // 15 خانة، أقل من حد الأعداد الصحيحة الآمنة

  var useCloud = false;
  try {
    useCloud = Boolean(tg && tg.initData && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9"));
  } catch (e) { useCloud = false; }

  function withTimeout(run) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; reject(new Error("STORE_TIMEOUT")); }
      }, STORE_TIMEOUT_MS);
      function settle(fn, value) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        fn(value);
      }
      try {
        run(function (v) { settle(resolve, v); }, function (e) { settle(reject, e); });
      } catch (e) {
        settle(reject, e);
      }
    });
  }

  function storeGet(key) {
    return withTimeout(function (resolve, reject) {
      if (useCloud) {
        tg.CloudStorage.getItem(key, function (err, value) {
          if (err) reject(new Error(String(err)));
          else resolve(value || "");
        });
      } else {
        resolve(window.localStorage.getItem(key) || "");
      }
    });
  }

  function storeSet(key, value) {
    return withTimeout(function (resolve, reject) {
      if (useCloud) {
        tg.CloudStorage.setItem(key, value, function (err, ok) {
          if (err || ok === false) reject(new Error(String(err || "STORE_FAILED")));
          else resolve();
        });
      } else {
        window.localStorage.setItem(key, value);
        resolve();
      }
    });
  }

  function parseBalance(raw) {
    var str = String(raw == null ? "" : raw);
    if (!/^\d{1,15}$/.test(str)) return 0;
    return Number(str);
  }

  // نقاط فاز فيها اللاعب وما تأكد حفظها بعد؛ نسخة منها في المتصفح عشان ما تضيع لو انقفل التطبيق
  function readPending() {
    try { return parseBalance(window.localStorage.getItem(PENDING_KEY)); } catch (e) { return 0; }
  }

  function writePending(n) {
    try {
      if (n > 0) window.localStorage.setItem(PENDING_KEY, String(n));
      else window.localStorage.removeItem(PENDING_KEY);
    } catch (e) { /* التخزين المحلي غير متاح */ }
  }

  var savedBalance = null; // آخر قيمة مؤكدة من التخزين (null = ما انقرأت)
  var pending = readPending();
  var syncing = null;

  function renderBalance(saveFailed) {
    var el = $("balanceValue");
    el.textContent = savedBalance === null && pending === 0 ? "…" : String(Math.min((savedBalance || 0) + pending, MAX_BALANCE));
    $("gameBalanceNote").hidden = !saveFailed;
  }

  // يقرأ الرصيد من التخزين، يضيف عليه المعلّق، ويحفظ. استدعاء واحد في نفس الوقت.
  function syncBalance() {
    if (syncing) return syncing;
    syncing = (async function () {
      var failed = false;
      try {
        var current = parseBalance(await storeGet(BALANCE_KEY));
        var adding = pending;
        if (adding > 0) {
          var next = Math.min(current + adding, MAX_BALANCE);
          await storeSet(BALANCE_KEY, String(next));
          pending -= adding;
          writePending(pending);
          current = next;
        }
        savedBalance = current;
      } catch (e) {
        failed = true;
        console.error("Balance sync failed:", e);
      }
      syncing = null;
      renderBalance(failed);
      if (!failed && pending > 0) return syncBalance(); // فوز جديد وصل أثناء الحفظ
    })();
    return syncing;
  }

  function addToBalance(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    pending = Math.min(pending + amount, MAX_BALANCE);
    writePending(pending);
    renderBalance(false);
    syncBalance();
  }

  // إعادة المحاولة لما يرجع المستخدم للتطبيق
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && (pending > 0 || savedBalance === null)) syncBalance();
  });

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
      setStatus("🏆 فزت! +" + score, "win");
      addToBalance(score);
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

  renderBalance(false);
  syncBalance();

  if (paid) {
    drawBoard(true);
    setStatus(configError ? "غير متاحة" : "ابدأ جولة");
    updateButton();
  } else {
    startRound();
  }
})();
