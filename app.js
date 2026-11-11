(function () {
  "use strict";

  /*
   * العملات المعروضة — كلها على شبكة TON. لتغيير القائمة عدّل هذه المصفوفة فقط.
   * عناوين العقود (master) متحقق منها على tonapi.io وكلها بحالة whitelist.
   */
  var COINS = [
    { id: "ton", kind: "ton", symbol: "TON", name: "Toncoin", decimals: 9, color: "#0098EA", glyph: "T" },
    { id: "usdt", kind: "jetton", symbol: "USDT", name: "Tether USD", decimals: 6, color: "#26A17B", glyph: "₮",
      master: "0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe" },
    { id: "not", kind: "jetton", symbol: "NOT", name: "Notcoin", decimals: 9, color: "#1c1c1e", glyph: "N",
      master: "0:2f956143c461769579baef2e32cc2d7bc18283f40d20bb03e432cd603ac33ffc" },
    { id: "dogs", kind: "jetton", symbol: "DOGS", name: "Dogs", decimals: 9, color: "#8E6E53", glyph: "D",
      master: "0:afc49cb8786f21c87045b19ede78fc6b46c51048513f8e9a6d44060199c1bf0c" },
    { id: "hmstr", kind: "jetton", symbol: "HMSTR", name: "Hamster Kombat", decimals: 9, color: "#F5A623", glyph: "H",
      master: "0:09f2e59dec406ab26a5259a45d7ff23ef11f3e5c7c21de0b0d2a1cbe52b76b3d" }
  ];

  var API = "https://tonapi.io";
  var MAINNET = "-239";

  var ERRORS = {
    ADDRESS_INVALID: "عنوان المستلم غير صحيح. تأكد إنه عنوان على شبكة TON.",
    ADDRESS_SELF: "هذا عنوان محفظتك أنت.",
    AMOUNT_EMPTY: "اكتب المبلغ.",
    AMOUNT_INVALID: "المبلغ غير صحيح.",
    AMOUNT_ZERO: "المبلغ لازم يكون أكبر من صفر.",
    AMOUNT_TOO_PRECISE: "عدد الخانات العشرية أكثر من المسموح لهذه العملة.",
    BALANCE_LOW: "رصيدك ما يكفي لهذا المبلغ.",
    GAS_LOW: "تحتاج 0.05 TON على الأقل في محفظتك لرسوم التحويل."
  };

  var $ = function (id) { return document.getElementById(id); };
  var Lib = window.LuoLib;
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  var insideTelegram = Boolean(tg && tg.initData);

  var state = {
    address: null, // raw
    friendly: null, // UQ…
    loaded: false,
    tonBalance: 0n,
    balances: {}, // id -> BigInt
    jettonWallets: {}, // id -> raw jetton wallet address
    selected: "ton",
    loadToken: 0
  };

  /* ---------- أدوات صغيرة ---------- */

  function haptic(kind) {
    try {
      if (!tg || !tg.HapticFeedback) return;
      if (kind === "success" || kind === "error" || kind === "warning") tg.HapticFeedback.notificationOccurred(kind);
      else tg.HapticFeedback.impactOccurred(kind || "light");
    } catch (e) { /* غير مدعوم في هذا الإصدار */ }
  }

  var toastTimer = null;
  function toast(message, ms) {
    var el = $("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, ms || 2600);
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      document.body.removeChild(ta);
      if (!ok) { toast("ما قدرت أنسخ، انسخه يدويًا."); return; }
    }
    haptic("success");
    toast("تم النسخ");
  }

  function coinById(id) {
    for (var i = 0; i < COINS.length; i++) if (COINS[i].id === id) return COINS[i];
    return COINS[0];
  }

  function shortAddress(a) {
    return a.slice(0, 5) + "…" + a.slice(-5);
  }

  /* ---------- ترحيب تلقرام ---------- */

  function initTelegram() {
    if (!insideTelegram) return;
    try { tg.ready(); tg.expand(); } catch (e) { console.error("Telegram init failed:", e); }

    var atLeast = function (v) {
      try { return Boolean(tg.isVersionAtLeast && tg.isVersionAtLeast(v)); } catch (e) { return false; }
    };
    var attempt = function (fn) { try { fn(); } catch (e) { /* غير مدعوم في هذا الإصدار */ } };

    // ألوان تلقرام نفس لون التطبيق عشان ما يبان فاصل
    if (atLeast("6.9")) attempt(function () { tg.setHeaderColor("#080b16"); });
    if (atLeast("6.1")) attempt(function () { tg.setBackgroundColor("#080b16"); });
    if (atLeast("7.10")) attempt(function () { tg.setBottomBarColor("#080b16"); });
    // السحب لتحت ما يسكّر التطبيق بالغلط وسط اللعب
    if (atLeast("7.7")) attempt(function () { tg.disableVerticalSwipes(); });
    // ملء الشاشة على الجوال. أزرار تلقرام تبقى فوق، والمحتوى ينزل تحتها عبر متغيرات المساحة الآمنة في CSS
    var platform = String(tg.platform || "");
    if (atLeast("8.0") && (platform === "ios" || platform === "android") && !tg.isFullscreen) {
      attempt(function () { tg.requestFullscreen(); });
    }

    // initDataUnsafe للعرض فقط
    var user = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (!user) return;
    var name = (user.first_name || user.username || "").trim();
    if (name) {
      $("greeting").textContent = "أهلًا " + name;
      $("avatar").textContent = name.charAt(0).toUpperCase();
    }
    if (user.photo_url && /^https:\/\//.test(user.photo_url)) {
      var img = new Image();
      img.onload = function () {
        $("avatar").style.backgroundImage = "url(" + JSON.stringify(user.photo_url) + ")";
        $("avatar").textContent = "";
      };
      img.src = user.photo_url;
    }
  }

  /* ---------- الأرصدة ---------- */

  async function apiGet(path) {
    var lastError = null;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        var res = await fetch(API + path, { headers: { Accept: "application/json" } });
        if (res.status === 429) { await sleep(1200 * (attempt + 1)); continue; }
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.json();
      } catch (e) {
        lastError = e;
        await sleep(600);
      }
    }
    throw lastError || new Error("RATE_LIMITED");
  }

  function renderCoins() {
    var root = $("coins");
    root.textContent = "";
    COINS.forEach(function (coin) {
      var row = document.createElement("div");
      row.className = "coin";

      var icon = document.createElement("div");
      icon.className = "coin-icon";
      icon.style.background = coin.color;
      icon.textContent = coin.glyph;

      var meta = document.createElement("div");
      meta.className = "coin-meta";
      var sym = document.createElement("div");
      sym.className = "coin-symbol";
      sym.textContent = coin.symbol;
      var nm = document.createElement("div");
      nm.className = "coin-name";
      nm.textContent = coin.name;
      meta.appendChild(sym);
      meta.appendChild(nm);

      var bal = document.createElement("div");
      if (state.loaded) {
        bal.className = "coin-balance";
        bal.textContent = Lib.formatUnits(state.balances[coin.id] || 0n, coin.decimals, 4);
      } else {
        bal.className = "coin-balance loading";
      }

      row.appendChild(icon);
      row.appendChild(meta);
      row.appendChild(bal);
      root.appendChild(row);
    });
  }

  async function loadBalances() {
    if (!state.address) return;
    var token = ++state.loadToken;
    var note = $("balanceNote");
    $("refreshBtn").disabled = true;
    note.hidden = true;
    if (!state.loaded) renderCoins();

    try {
      var account = await apiGet("/v2/accounts/" + encodeURIComponent(state.friendly));
      var jettons = await apiGet("/v2/accounts/" + encodeURIComponent(state.friendly) + "/jettons");
      if (token !== state.loadToken) return; // تغيّرت المحفظة أثناء التحميل

      var balances = {};
      var wallets = {};
      var ton = BigInt(Math.trunc(Number(account.balance) || 0));
      balances.ton = ton;

      var list = (jettons && jettons.balances) || [];
      COINS.forEach(function (coin) {
        if (coin.kind !== "jetton") return;
        balances[coin.id] = 0n;
        for (var i = 0; i < list.length; i++) {
          var item = list[i];
          var master = item && item.jetton && String(item.jetton.address || "").toLowerCase();
          if (master !== coin.master) continue;
          try {
            balances[coin.id] = BigInt(item.balance);
            wallets[coin.id] = item.wallet_address.address;
          } catch (e) { /* بيانات غير متوقعة: نعتبر الرصيد صفر */ }
          break;
        }
      });

      state.tonBalance = ton;
      state.balances = balances;
      state.jettonWallets = wallets;
      state.loaded = true;
      renderCoins();
      updateAvailable();
    } catch (e) {
      if (token !== state.loadToken) return;
      console.error("Balance load failed:", e);
      note.textContent = "ما قدرت أجيب الأرصدة الحين. اضغط «تحديث» بعد شوي.";
      note.hidden = false;
      if (!state.loaded) $("coins").textContent = "";
    } finally {
      if (token === state.loadToken) $("refreshBtn").disabled = false;
    }
  }

  /* ---------- النوافذ ---------- */

  function openSheet(id) {
    $(id).hidden = false;
    haptic("light");
  }

  function closeSheets() {
    $("receiveSheet").hidden = true;
    $("sendSheet").hidden = true;
  }

  function openReceive() {
    var qr = window.qrcode(0, "M");
    qr.addData("ton://transfer/" + state.friendly);
    qr.make();
    // الناتج SVG مولّد محليًا من العنوان فقط
    $("qr").innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    $("addressFull").textContent = state.friendly;
    openSheet("receiveSheet");
  }

  function renderChips() {
    var root = $("coinChips");
    root.textContent = "";
    COINS.forEach(function (coin) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(coin.id === state.selected));
      b.textContent = coin.symbol;
      b.addEventListener("click", function () {
        state.selected = coin.id;
        $("amountInput").value = "";
        renderChips();
        updateAvailable();
        showError(null);
        haptic("light");
      });
      root.appendChild(b);
    });
  }

  function maxSendable(coin) {
    var bal = state.balances[coin.id] || 0n;
    if (coin.kind !== "ton") return bal;
    var max = bal - Lib.TON_FEE_RESERVE_NANO;
    return max > 0n ? max : 0n;
  }

  function updateAvailable() {
    var coin = coinById(state.selected);
    $("available").textContent = state.loaded
      ? "المتاح: \u2066" + Lib.formatUnits(state.balances[coin.id] || 0n, coin.decimals, 6) + " " + coin.symbol + "\u2069"
      : "";
  }

  function showError(code) {
    var el = $("sendError");
    if (!code) { el.hidden = true; el.textContent = ""; return; }
    el.textContent = ERRORS[code] || code;
    el.hidden = false;
  }

  function openSend() {
    showError(null);
    renderChips();
    updateAvailable();
    openSheet("sendSheet");
  }

  /* ---------- الإرسال ---------- */

  var sending = false;

  // هل الخطأ سببه إن المستخدم رفض العملية من محفظته؟
  function isUserRejection(e) {
    var name = (e && (e.name || (e.constructor && e.constructor.name))) || "";
    var msg = String((e && e.message) || "");
    return /UserRejects/i.test(name) || /reject|declin|cancel/i.test(msg);
  }

  async function submitSend(tc, event) {
    event.preventDefault();
    if (sending) return;
    showError(null);

    if (!state.loaded) {
      showError("الأرصدة ما تحمّلت. اضغط «تحديث» وجرّب مرة ثانية.");
      return;
    }

    var coin = coinById(state.selected);
    var built;
    try {
      built = await Lib.buildTransfer(
        coin,
        {
          tonBalance: state.tonBalance,
          coinBalance: state.balances[coin.id] || 0n,
          jettonWallet: state.jettonWallets[coin.id] || null,
          sender: state.address
        },
        $("toInput").value,
        $("amountInput").value,
        Math.floor(Date.now() / 1000)
      );
    } catch (e) {
      haptic("error");
      showError(e && e.code ? e.code : "صار خطأ في تجهيز التحويل.");
      if (!(e && e.code)) console.error(e);
      return;
    }

    var btn = $("submitBtn");
    var label = btn.textContent;
    sending = true;
    btn.disabled = true;
    btn.textContent = "أكّد من محفظتك…";

    try {
      await tc.sendTransaction(built.request);
      haptic("success");
      closeSheets();
      $("toInput").value = "";
      $("amountInput").value = "";
      toast("تم إرسال العملية. الرصيد يتحدث خلال ثواني.", 4000);
      setTimeout(loadBalances, 8000);
      setTimeout(loadBalances, 25000);
    } catch (e) {
      if (isUserRejection(e)) {
        showError("ألغيت العملية من المحفظة.");
      } else {
        console.error("sendTransaction failed:", e);
        haptic("error");
        showError("ما تم الإرسال. تأكد من محفظتك وجرّب مرة ثانية.");
      }
    } finally {
      sending = false;
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  /* ---------- حالة المحفظة ---------- */

  function onWalletChange(tc, wallet) {
    state.loadToken++;
    state.loaded = false;
    state.balances = {};
    state.jettonWallets = {};
    state.tonBalance = 0n;
    closeSheets();

    if (!wallet || !wallet.account) {
      state.address = null;
      state.friendly = null;
      $("wallet").hidden = true;
      $("intro").hidden = false;
      return;
    }

    if (wallet.account.chain !== MAINNET) {
      toast("هذه المحفظة على شبكة تجريبية. اربط محفظة على الشبكة الرئيسية.", 4500);
      tc.disconnect().catch(function () {});
      return;
    }

    state.address = Lib.toRaw(wallet.account.address);
    state.friendly = Lib.toFriendly(wallet.account.address, false);
    $("addressShort").textContent = shortAddress(state.friendly);
    $("intro").hidden = true;
    $("wallet").hidden = false;
    loadBalances();
  }

  /* ---------- التشغيل ---------- */

  function start() {
    initTelegram();

    if (!Lib || !window.TON_CONNECT_UI || !window.qrcode) {
      $("intro").querySelector("p").textContent = "ما تحمّلت ملفات التطبيق كاملة. أعد فتح التطبيق.";
      $("connectBtn").hidden = true;
      return;
    }

    var tc = new window.TON_CONNECT_UI.TonConnectUI({
      manifestUrl: window.location.origin + "/tonconnect-manifest.json",
      buttonRootId: "ton-connect",
      uiPreferences: { theme: (window.TON_CONNECT_UI.THEME && window.TON_CONNECT_UI.THEME.DARK) || "DARK" }
    });

    tc.onStatusChange(
      function (wallet) { onWalletChange(tc, wallet); },
      function (err) { console.error("TON Connect error:", err); }
    );

    // واجهة صغيرة تستخدمها اللعبة للدفع من المحفظة المربوطة
    var paying = false;
    window.LuoWallet = {
      isConnected: function () { return Boolean(state.address); },
      connect: function () { tc.openModal(); },
      // يدفع TON لعنوان محدد. يرفض بخطأ فيه code: NOT_CONNECTED | BUSY | BALANCE_LOW | REJECTED | FAILED | …
      payTon: async function (to, amountNano, comment) {
        var err;
        if (!state.address) { err = new Error("NOT_CONNECTED"); err.code = "NOT_CONNECTED"; throw err; }
        if (paying || sending) { err = new Error("BUSY"); err.code = "BUSY"; throw err; }
        paying = true;
        try {
          var request = await Lib.buildTonPayment(
            { to: to, amount: amountNano, comment: comment, tonBalance: state.loaded ? state.tonBalance : null },
            Math.floor(Date.now() / 1000)
          );
          try {
            await tc.sendTransaction(request);
          } catch (e) {
            if (!isUserRejection(e)) console.error("payTon failed:", e);
            err = new Error(isUserRejection(e) ? "REJECTED" : "FAILED");
            err.code = err.message;
            throw err;
          }
          setTimeout(loadBalances, 8000);
          setTimeout(loadBalances, 25000);
        } finally {
          paying = false;
        }
      }
    };

    $("connectBtn").addEventListener("click", function () {
      haptic("medium");
      tc.openModal();
    });
    $("addressBtn").addEventListener("click", function () { if (state.friendly) copyText(state.friendly); });
    $("copyFullBtn").addEventListener("click", function () { if (state.friendly) copyText(state.friendly); });
    $("receiveBtn").addEventListener("click", openReceive);
    $("sendBtn").addEventListener("click", openSend);
    $("refreshBtn").addEventListener("click", function () { haptic("light"); loadBalances(); });

    $("pasteBtn").addEventListener("click", async function () {
      try {
        var text = await navigator.clipboard.readText();
        if (text) $("toInput").value = text.trim();
      } catch (e) {
        toast("الصق العنوان يدويًا في الخانة.");
      }
    });

    $("maxBtn").addEventListener("click", function () {
      var coin = coinById(state.selected);
      $("amountInput").value = Lib.formatUnits(maxSendable(coin), coin.decimals);
      showError(null);
    });

    $("sendForm").addEventListener("submit", function (event) { submitSend(tc, event); });

    Array.prototype.forEach.call(document.querySelectorAll(".sheet-backdrop"), function (backdrop) {
      backdrop.addEventListener("click", function (event) {
        if (event.target === backdrop || event.target.hasAttribute("data-close")) closeSheets();
      });
    });
  }

  start();
})();
