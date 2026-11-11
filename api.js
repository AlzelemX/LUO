/* الاتصال بالسيرفر + أدوات واجهة مشتركة بين اللعبة ولوحة صاحب البوت */
(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  var initData = tg && tg.initData ? tg.initData : "";
  var url = (window.LUO_CONFIG && window.LUO_CONFIG.api) || "";

  function apiError(code) {
    var e = new Error(code);
    e.code = code;
    return e;
  }

  // يرسل أمر للسيرفر. يرجّع جسم الرد، أو يرمي خطأ فيه code
  async function call(action, payload) {
    if (!url) throw apiError("NO_API");
    if (!initData) throw apiError("NOT_IN_TELEGRAM");
    var body = Object.assign({ action: action }, payload || {});
    var res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Init-Data": initData },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw apiError("NETWORK");
    }
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!data || typeof data !== "object") throw apiError("BAD_RESPONSE");
    if (data.error) throw apiError(String(data.error));
    if (!res.ok) throw apiError("HTTP_" + res.status);
    return data;
  }

  /*
   * يبني عنصر DOM. النصوص تنحط دايمًا كنص (textContent)، فأسماء اللاعبين
   * وأي نص جاي من السيرفر ما يتنفذ كـ HTML.
   */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var key;
    for (key in attrs || {}) {
      if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;
      var value = attrs[key];
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key.slice(0, 2) === "on" && typeof value === "function") el.addEventListener(key.slice(2), value);
      else if (key === "value") el.value = value;
      else if (key === "checked" || key === "disabled" || key === "hidden") el[key] = Boolean(value);
      else el.setAttribute(key, value === true ? "" : String(value));
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined || child === false) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) el.appendChild(c); });
      else el.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
    }
    return el;
  }

  var toastTimer = null;
  function toast(message, ms) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, ms || 2600);
  }

  function haptic(kind) {
    try {
      if (!tg || !tg.HapticFeedback) return;
      if (kind === "success" || kind === "error" || kind === "warning") tg.HapticFeedback.notificationOccurred(kind);
      else tg.HapticFeedback.impactOccurred(kind || "light");
    } catch (e) { /* غير مدعوم */ }
  }

  // "100000000" نانو => "0.1"
  function nanoToTon(nano) {
    var s = String(nano == null ? "0" : nano).replace(/\D/g, "") || "0";
    while (s.length <= 9) s = "0" + s;
    var frac = s.slice(-9).replace(/0+$/, "");
    return s.slice(0, -9) + (frac ? "." + frac : "");
  }

  function group(n) {
    return String(n == null ? "0" : n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  window.LuoApi = {
    call: call,
    inTelegram: Boolean(initData),
    h: h,
    toast: toast,
    haptic: haptic,
    nanoToTon: nanoToTon,
    group: group,
    tg: tg
  };
})();
