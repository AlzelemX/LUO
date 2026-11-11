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
  var bombs = [];
  var opened = [];
  var found = 0;
  var over = false;

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = "game-status" + (cls ? " " + cls : "");
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

  function newGame() {
    bombs = dealBoard();
    opened = [];
    found = 0;
    over = false;

    board.style.setProperty("--cols", String(COLS));
    board.textContent = "";
    for (var i = 0; i < TOTAL; i++) {
      var tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.setAttribute("aria-label", "مربع مغلق");
      tile.addEventListener("click", onTile.bind(null, i, tile));
      board.appendChild(tile);
    }

    $("gemCount").textContent = "0";
    $("gemTotal").textContent = "/" + GEMS;
    $("bombCount").textContent = String(BOMBS);
    setStatus("اختر مربع");
  }

  $("newGameBtn").addEventListener("click", function () {
    haptic("medium");
    newGame();
  });

  newGame();
})();
