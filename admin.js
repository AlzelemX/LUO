/*
 * لوحة صاحب البوت. تظهر فقط إذا السيرفر قال إن المستخدم هو صاحب البوت،
 * وكل أمر فيها يتحقق منه السيرفر مرة ثانية (إخفاء التبويب مو هو الحماية).
 */
(function () {
  "use strict";

  var A = window.LuoApi;
  var h = A.h;
  var $ = function (id) { return document.getElementById(id); };

  var root = $("admin");
  var sheet = $("adminSheet");
  var sheetBody = $("adminSheetBody");
  var section = "overview";
  var overview = null; // { stats, settings, announcements }
  var players = [];
  var withdrawals = [];
  var query = "";
  var sort = "balance";
  var loading = false;

  var ERR = {
    FORBIDDEN: "هذا الأمر لصاحب البوت فقط.",
    BAD_SETTINGS: "الإعدادات فيها قيمة غير صحيحة. تأكد من السعر والعنوان وعدد القنابل وجدول الجواهر.",
    BAD_URL: "الرابط لازم يبدأ بـ https://",
    BAD_TEXT: "العنوان مطلوب (80 حرف كحد أقصى)، والنص 400 حرف كحد أقصى.",
    BAD_FREE: "عدد الجولات المجانية لازم يكون بين 1 و 1000.",
    BAD_BALANCE: "الرصيد لازم يكون رقم صحيح موجب.",
    PLAYER_NOT_FOUND: "اللاعب غير موجود.",
    WITHDRAW_NOT_FOUND: "الطلب تقرر من قبل أو غير موجود.",
    NETWORK: "انقطع الاتصال. جرّب مرة ثانية."
  };

  async function run(action, payload, okMessage) {
    try {
      var res = await A.call(action, payload);
      if (okMessage) { A.toast(okMessage); A.haptic("success"); }
      return res;
    } catch (e) {
      A.toast(ERR[e.code] || "صار خطأ: " + (e.code || ""), 3500);
      A.haptic("error");
      return null;
    }
  }

  function field(label, input, hint) {
    return h("label", { class: "f" }, h("span", { class: "f-label", text: label }), input, hint ? h("span", { class: "f-hint", text: hint }) : null);
  }

  function input(attrs) {
    return h("input", Object.assign({ class: "f-input", autocomplete: "off", autocapitalize: "off", spellcheck: "false" }, attrs));
  }

  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "الحين";
    if (mins < 60) return "قبل " + mins + " د";
    if (mins < 1440) return "قبل " + Math.floor(mins / 60) + " س";
    return "قبل " + Math.floor(mins / 1440) + " يوم";
  }

  /* ---------- الحكم على اللاعب ---------- */

  // سليم / مشبوه / محظور. كل الحسابات في السيرفر، فاللي يبان هنا هو محاولات التلاعب نفسها.
  function verdict(p) {
    if (p.banned) return { cls: "bad", text: "محظور", why: "أنت حظرت هذا اللاعب." };
    if (!p.ledgerOk) return { cls: "bad", text: "رصيد غير مطابق", why: "رصيده ما يطابق سجل العمليات. هذا ما يصير من اللعب العادي، ومعناه إن الرصيد تعدّل من خارج النظام." };
    if (p.badRequests >= 3) return { cls: "warn", text: "مشبوه", why: "أرسل " + p.badRequests + " طلب غير صحيح للسيرفر (مثل محاولة فتح جولة لاعب ثاني أو مربع غير موجود). التطبيق العادي ما يرسل هذي الطلبات." };
    if (p.badRequests > 0) return { cls: "ok", text: "سليم", why: "عنده " + p.badRequests + " طلب غير صحيح فقط، وهذا أقل من حد الاشتباه (3)." };
    return { cls: "ok", text: "سليم", why: "كل طلباته صحيحة، ورصيده مطابق لسجل العمليات." };
  }

  /* ---------- نظرة عامة ---------- */

  function statCard(label, value, sub) {
    return h("div", { class: "a-stat" }, h("div", { class: "a-stat-value", text: String(value) }), h("div", { class: "a-stat-label", text: label }), sub ? h("div", { class: "a-stat-sub", text: sub }) : null);
  }

  function renderOverview() {
    var s = overview.stats;
    return h("div", { class: "a-grid" },
      statCard("اللاعبين", A.group(s.players), "نشطين اليوم: " + A.group(s.playersToday)),
      statCard("الجولات", A.group(s.rounds), "اليوم: " + A.group(s.roundsToday)),
      statCard("TON مستلمة", A.nanoToTon(s.receivedNano), "اليوم: " + A.nanoToTon(s.receivedTodayNano)),
      statCard("جولات مدفوعة", A.group(s.paidRounds), "مجانية: " + A.group(s.freeRounds)),
      statCard("مجموع النقاط", A.group(s.pointsTotal), "عند كل اللاعبين"),
      statCard("دفعات معلّقة", A.group(s.pendingPayments), "طلب جولة وما تأكد دفعها"),
      statCard("خسروا", A.group(s.lost), "جمعوا: " + A.group(s.collected) + " · فازوا: " + A.group(s.won)),
      statCard("مشبوهين", A.group(s.suspects), "محظورين: " + A.group(s.banned))
    );
  }

  /* ---------- اللاعبين ---------- */

  async function loadPlayers() {
    var res = await run("admin.players", { q: query, sort: sort });
    players = res ? res.players : [];
  }

  function renderPlayers() {
    var search = input({ type: "search", placeholder: "اسم، يوزر، أو رقم", value: query, enterkeyhint: "search" });
    var sortSel = h("select", { class: "f-input a-sort" },
      h("option", { value: "balance", text: "الأعلى رصيد" }),
      h("option", { value: "recent", text: "آخر دخول" }),
      h("option", { value: "rounds", text: "الأكثر لعب" }),
      h("option", { value: "suspect", text: "المشبوهين أول" }));
    sortSel.value = sort;
    async function apply() {
      query = search.value.trim();
      sort = sortSel.value;
      await loadPlayers();
      render();
    }
    var form = h("form", { class: "a-search", onsubmit: function (e) { e.preventDefault(); apply(); } }, search, sortSel);
    sortSel.addEventListener("change", apply);

    var list = h("div", { class: "card a-list" });
    if (!players.length) list.appendChild(h("p", { class: "note", text: query ? "ما فيه لاعب بهذا البحث." : "ما فيه لاعبين للحين." }));
    players.forEach(function (p) {
      var v = verdict(p);
      list.appendChild(h("button", { type: "button", class: "a-row", onclick: function () { openPlayer(p); } },
        h("div", { class: "a-row-main" },
          h("div", { class: "a-row-name", text: p.name || "بدون اسم" }),
          h("div", { class: "a-row-sub", text: (p.username ? "@" + p.username + " · " : "") + p.rounds + " جولة · " + when(p.lastSeen) })),
        h("div", { class: "a-row-side" },
          h("div", { class: "a-row-balance", text: A.group(p.balance) + " 💎" }),
          h("span", { class: "badge " + v.cls, text: v.text }))));
    });
    return h("div", { class: "a-stack" }, form, list, players.length >= 50 ? h("p", { class: "note", text: "يظهر أول 50 لاعب. استخدم البحث للوصول لغيرهم." }) : null);
  }

  var STATUS_TEXT = { active: "شغالة", collected: "جمع", won: "فوز كامل", lost: "خسارة", pending: "بانتظار الدفع", expired: "ملغية" };
  var REASON_TEXT = { collect: "جمع", win: "فوز كامل", admin: "تعديل منك" };

  function closeSheet() {
    sheet.hidden = true;
    sheetBody.textContent = "";
  }

  async function refreshPlayer(id) {
    await loadPlayers();
    render();
    var fresh = players.filter(function (x) { return x.id === id; })[0];
    if (fresh) openPlayer(fresh); else closeSheet();
  }

  function openPlayer(p) {
    var v = verdict(p);
    var lossRate = p.rounds ? Math.round((p.lost / p.rounds) * 100) + "%" : "—";
    var balanceIn = input({ type: "text", inputmode: "numeric", value: p.balance, dir: "ltr" });
    var freeIn = input({ type: "text", inputmode: "numeric", value: "1", dir: "ltr" });
    var history = h("div", { class: "a-history" }, h("p", { class: "note", text: "جاري تحميل السجل…" }));

    async function update(payload, msg) {
      var res = await run("admin.player.update", Object.assign({ id: p.id }, payload), msg);
      if (res) refreshPlayer(p.id);
    }

    sheetBody.textContent = "";
    sheetBody.appendChild(h("div", { class: "a-stack" },
      h("div", { class: "sheet-head" },
        h("div", null, h("h2", { text: p.name || "بدون اسم" }), h("div", { class: "a-row-sub", dir: "ltr", text: (p.username ? "@" + p.username + " · " : "") + "ID " + p.id })),
        h("button", { type: "button", class: "close", "aria-label": "إغلاق", text: "×", onclick: closeSheet })),
      h("div", { class: "a-verdict " + v.cls }, h("span", { class: "badge " + v.cls, text: v.text }), h("p", { text: v.why })),
      h("div", { class: "a-grid" },
        statCard("الرصيد", A.group(p.balance)),
        statCard("جولات", A.group(p.rounds), "مدفوعة: " + p.paid),
        statCard("نسبة الخسارة", lossRate, "خسر " + p.lost),
        statCard("جمع من اللعب", A.group(p.earned)),
        statCard("دفع TON", A.nanoToTon(p.paidNano), "معلّقة: " + p.pending),
        statCard("جولات مجانية", String(p.freePlays))),
      h("div", { class: "a-actions" },
        field("تعديل الرصيد", balanceIn),
        h("button", { type: "button", class: "btn", text: "حفظ الرصيد", onclick: function () {
          var n = Number(balanceIn.value.replace(/[^\d]/g, ""));
          update({ setBalance: n }, "تم تعديل الرصيد");
        } }),
        field("جولات مجانية (سالب للخصم)", freeIn),
        h("button", { type: "button", class: "btn", text: "أضف", onclick: function () {
          update({ addFree: parseInt(freeIn.value, 10) }, "تم");
        } })),
      h("div", { class: "a-actions two" },
        h("button", { type: "button", class: "btn " + (p.banned ? "" : "btn-danger"), text: p.banned ? "فك الحظر" : "حظر اللاعب", onclick: function () { update({ banned: !p.banned }, p.banned ? "تم فك الحظر" : "تم الحظر"); } }),
        p.badRequests > 0 ? h("button", { type: "button", class: "btn btn-quiet", text: "تصفير الاشتباه", onclick: function () { update({ clearFlags: true }, "تم"); } }) : null),
      history));
    sheet.hidden = false;

    run("admin.player", { id: p.id }).then(function (res) {
      if (!res || sheet.hidden) return;
      history.textContent = "";
      history.appendChild(h("h3", { text: "آخر الجولات" }));
      if (!res.rounds.length) history.appendChild(h("p", { class: "note", text: "ما لعب للحين." }));
      res.rounds.forEach(function (r) {
        history.appendChild(h("div", { class: "a-line" },
          h("span", { text: (r.mode === "paid" ? "مدفوعة" : "مجانية") + " · " + (STATUS_TEXT[r.status] || r.status) }),
          h("span", { class: "a-line-side", text: "فتح " + r.opened + " · " + A.group(r.score) + " 💎 · " + when(r.createdAt) })));
      });
      history.appendChild(h("h3", { text: "سجل الرصيد" }));
      if (!res.log.length) history.appendChild(h("p", { class: "note", text: "ما فيه عمليات." }));
      res.log.forEach(function (l) {
        var plus = l.delta.charAt(0) !== "-";
        history.appendChild(h("div", { class: "a-line" },
          h("span", { text: REASON_TEXT[l.reason] || l.reason }),
          h("span", { class: "a-line-side", dir: "ltr", text: (plus ? "+" : "") + A.group(l.delta) + " → " + A.group(l.balanceAfter) + " · " + when(l.createdAt) })));
      });
    });
  }

  /* ---------- الإعدادات ---------- */

  function renderSettings() {
    var s = overview.settings;
    var enabled = h("input", { type: "checkbox", checked: s.enabled });
    var price = input({ type: "text", inputmode: "decimal", value: s.price, dir: "ltr" });
    var payTo = input({ type: "text", value: s.payTo, dir: "ltr" });
    var bombs = input({ type: "text", inputmode: "numeric", value: String(s.bombs), dir: "ltr" });
    var bombHint = h("span", { class: "f-hint" });
    var rows = h("div", { class: "a-gems" });
    var totalHint = h("p", { class: "note" });

    function readRows() {
      return Array.prototype.map.call(rows.children, function (row) {
        var ins = row.querySelectorAll("input");
        return [parseInt(ins[0].value, 10), parseInt(ins[1].value, 10)];
      });
    }

    function recalc() {
      var data = readRows();
      var total = data.reduce(function (t, r) { return t + (r[1] > 0 ? r[1] : 0); }, 0);
      Array.prototype.forEach.call(rows.children, function (row, i) {
        var w = data[i][1];
        row.querySelector(".a-gem-pct").textContent = total > 0 && w > 0 ? ((w / total) * 100).toFixed(w / total < 0.01 ? 2 : 1) + "%" : "—";
      });
      totalHint.textContent = "النسبة = وزن الجوهرة ÷ مجموع الأوزان (" + total + "). كل ما كبر الوزن كثر ظهورها.";
      var b = parseInt(bombs.value, 10);
      bombHint.textContent = b >= 1 && b <= 24 ? "احتمال القنبلة في أول ضغطة: " + Math.round((b / 25) * 100) + "% · الجواهر: " + (25 - b) : "من 1 إلى 24";
    }

    function addRow(value, weight) {
      var row = h("div", { class: "a-gem" },
        input({ type: "text", inputmode: "numeric", value: String(value), dir: "ltr", "aria-label": "قيمة الجوهرة", oninput: recalc }),
        input({ type: "text", inputmode: "numeric", value: String(weight), dir: "ltr", "aria-label": "الوزن", oninput: recalc }),
        h("span", { class: "a-gem-pct" }),
        h("button", { type: "button", class: "a-x", "aria-label": "حذف", text: "×", onclick: function () {
          if (rows.children.length > 1) { rows.removeChild(row); recalc(); }
        } }));
      rows.appendChild(row);
    }

    s.gemValues.forEach(function (r) { addRow(r[0], r[1]); });
    bombs.addEventListener("input", recalc);
    recalc();

    async function save() {
      var res = await run("admin.settings.save", { settings: {
        enabled: enabled.checked, price: price.value.trim(), payTo: payTo.value.trim(),
        bombs: parseInt(bombs.value, 10), gemValues: readRows()
      } }, "انحفظت الإعدادات");
      if (!res) return;
      overview.settings = res.settings;
      if (window.LuoGame) window.LuoGame.refresh();
      render();
    }

    return h("div", { class: "a-stack" },
      h("div", { class: "card a-form" },
        h("label", { class: "a-switch" }, enabled, h("span", { text: "اللعبة شغالة (طفّها عشان توقف الجولات الجديدة مؤقتًا)" })),
        field("سعر الجولة (TON)", price),
        field("عنوان استقبال الدفعات (TON)", payTo, "السيرفر يتحقق من صحة العنوان قبل الحفظ. أي غلط هنا يودي الفلوس لمكان ثاني."),
        h("label", { class: "f" }, h("span", { class: "f-label", text: "عدد القنابل (من 25 مربع)" }), bombs, bombHint)),
      h("div", { class: "card a-form" },
        h("div", { class: "a-gem a-gem-head" }, h("span", { text: "القيمة" }), h("span", { text: "الوزن" }), h("span", { text: "النسبة" }), h("span")),
        rows,
        h("button", { type: "button", class: "btn btn-quiet", text: "+ قيمة جديدة", onclick: function () { if (rows.children.length < 20) { addRow(1, 1); recalc(); } } }),
        totalHint),
      h("button", { type: "button", class: "btn", text: "حفظ الإعدادات", onclick: save }),
      h("p", { class: "note", text: "التغيير يمشي على الجولات الجديدة فقط. الجولة الشغالة تكمل بإعداداتها." }));
  }

  /* ---------- الإعلانات ---------- */

  var KIND_TEXT = { news: "📣 خبر / ميزة جديدة", ad: "⭐ إعلان", free_game: "🎁 لعبة مجانية" };

  async function reloadOverview() {
    var res = await run("admin.overview");
    if (res) overview = res;
    render();
    if (window.LuoGame) window.LuoGame.refresh();
  }

  function renderAnnouncements() {
    var kind = h("select", { class: "f-input" },
      h("option", { value: "news", text: KIND_TEXT.news }),
      h("option", { value: "ad", text: KIND_TEXT.ad }),
      h("option", { value: "free_game", text: KIND_TEXT.free_game }));
    var title = input({ type: "text", maxlength: "80" });
    var body = h("textarea", { class: "f-input", rows: "2", maxlength: "400" });
    var button = input({ type: "text", maxlength: "40", placeholder: "اختياري" });
    var url = input({ type: "url", dir: "ltr", placeholder: "https://…" });
    var free = input({ type: "text", inputmode: "numeric", value: "1", dir: "ltr" });
    var urlField = field("رابط الزر", url, "يفتح لما اللاعب يضغط الزر. بدون رابط تظهر البطاقة كخبر فقط.");
    var freeField = field("كم جولة مجانية لكل لاعب", free, "كل لاعب يستلمها مرة وحدة فقط.");
    function sync() {
      urlField.hidden = kind.value === "free_game";
      freeField.hidden = kind.value !== "free_game";
    }
    kind.addEventListener("change", sync);
    sync();

    async function create() {
      var res = await run("admin.ann.save", { announcement: {
        kind: kind.value, title: title.value, body: body.value, button: button.value,
        url: kind.value === "free_game" ? "" : url.value, freePlays: parseInt(free.value, 10), active: true
      } }, "انضاف الإعلان");
      if (res) reloadOverview();
    }

    var list = h("div", { class: "a-stack" });
    if (!overview.announcements.length) list.appendChild(h("p", { class: "note", text: "ما فيه إعلانات. أضف أول واحد من فوق." }));
    overview.announcements.forEach(function (a) {
      var del = h("button", { type: "button", class: "btn btn-quiet", text: "حذف" });
      del.addEventListener("click", async function () {
        if (del.getAttribute("data-sure") !== "1") {
          del.setAttribute("data-sure", "1");
          del.textContent = "تأكيد الحذف";
          del.classList.add("btn-danger");
          return;
        }
        if (await run("admin.ann.delete", { id: a.id }, "انحذف")) reloadOverview();
      });
      list.appendChild(h("div", { class: "card a-ann" + (a.active ? "" : " off") },
        h("div", { class: "a-ann-kind", text: KIND_TEXT[a.kind] + (a.kind === "free_game" ? " ×" + a.freePlays + " · استلمها " + a.claims : "") }),
        h("div", { class: "a-row-name", text: a.title }),
        a.body ? h("div", { class: "a-row-sub", text: a.body }) : null,
        a.url ? h("div", { class: "a-row-sub", dir: "ltr", text: a.url }) : null,
        h("div", { class: "a-actions two" },
          h("button", { type: "button", class: "btn btn-quiet", text: a.active ? "إيقاف" : "تشغيل", onclick: async function () {
            var res = await run("admin.ann.save", { announcement: Object.assign({}, a, { active: !a.active }) }, a.active ? "توقف الإعلان" : "اشتغل الإعلان");
            if (res) reloadOverview();
          } }),
          del)));
    });

    return h("div", { class: "a-stack" },
      h("div", { class: "card a-form" },
        field("النوع", kind), field("العنوان", title), field("النص", body), field("نص الزر", button), urlField, freeField,
        h("button", { type: "button", class: "btn", text: "نشر الإعلان", onclick: create })),
      list);
  }

  /* ---------- الهيكل ---------- */

  /* ---------- طلبات السحب ---------- */

  async function loadWithdrawals() {
    var res = await run("admin.withdrawals");
    if (res) withdrawals = res.withdrawals || [];
  }

  function copy(text) {
    try {
      navigator.clipboard.writeText(text).then(function () { A.toast("تم النسخ"); }, function () { A.toast("ما قدرت أنسخ"); });
    } catch (e) { A.toast("ما قدرت أنسخ"); }
  }

  function renderWithdrawals() {
    var list = h("div", { class: "a-wds" });
    if (!withdrawals.length) list.appendChild(h("p", { class: "note", text: "ما فيه طلبات سحب." }));
    withdrawals.forEach(function (w) {
      var pending = w.status === "pending";
      async function decide(paid) {
        var res = await run("admin.withdraw.decide", { id: w.id, paid: paid }, paid ? "تم التأكيد وخصم الجواهر" : "تم الرفض");
        if (res) { await loadWithdrawals(); render(); }
      }
      list.appendChild(h("div", { class: "a-wd" },
        h("div", { class: "a-wd-head" },
          h("span", { class: "a-wd-name", text: (w.name || "لاعب") + (w.username ? " @" + w.username : "") }),
          h("span", { class: "a-wd-amount", text: A.group(w.amount) + " 💎" })),
        h("div", { class: "a-wd-sub", text: "ID " + w.playerId + " · رصيده الحين " + A.group(w.balance) + " · " + when(w.createdAt) }),
        h("button", { type: "button", class: "a-wd-wallet", dir: "ltr", title: "نسخ", text: w.wallet, onclick: function () { copy(w.wallet); } }),
        pending
          ? h("div", { class: "a-actions two" },
              h("button", { type: "button", class: "btn", text: "تم الدفع", onclick: function () { decide(true); } }),
              h("button", { type: "button", class: "btn btn-danger", text: "رفض", onclick: function () { decide(false); } }))
          : h("div", { class: "a-wd-sub", text: w.status === "paid" ? "✅ مدفوع" : "❌ مرفوض" })));
    });
    return list;
  }

  var SECTIONS = [["overview", "نظرة"], ["players", "اللاعبين"], ["withdraws", "السحب"], ["settings", "الإعدادات"], ["anns", "الإعلانات"]];

  function render() {
    root.textContent = "";
    root.appendChild(h("div", { class: "a-seg", role: "tablist" }, SECTIONS.map(function (pair) {
      return h("button", { type: "button", role: "tab", class: "a-seg-btn", "aria-selected": String(section === pair[0]), text: pair[1], onclick: function () {
        if (section === pair[0]) return;
        section = pair[0];
        A.haptic("light");
        load();
      } });
    })));
    if (loading || !overview) {
      root.appendChild(h("p", { class: "note", text: loading ? "جاري التحميل…" : "ما قدرت أحمّل اللوحة. اضغط التبويب مرة ثانية." }));
      return;
    }
    root.appendChild(section === "players" ? renderPlayers() : section === "withdraws" ? renderWithdrawals() : section === "settings" ? renderSettings() : section === "anns" ? renderAnnouncements() : renderOverview());
  }

  async function load() {
    loading = true;
    render();
    var res = await run("admin.overview");
    if (res) overview = res;
    if (section === "players") await loadPlayers();
    if (section === "withdraws") await loadWithdrawals();
    loading = false;
    render();
  }

  document.addEventListener("luo:session", function (e) {
    $("adminTab").hidden = !(e.detail && e.detail.isAdmin);
  });
  document.addEventListener("luo:view", function (e) {
    if (e.detail === "viewAdmin") load();
  });
  sheet.addEventListener("click", function (e) {
    if (e.target === sheet) closeSheet();
  });
})();
