(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  var greetingEl = document.getElementById("greeting");
  var statusEl = document.getElementById("status");
  var avatarEl = document.getElementById("avatar");

  // initData يكون فاضي إذا انفتحت الصفحة من متصفح عادي وليس من داخل تلقرام
  var insideTelegram = Boolean(tg && tg.initData);

  if (!insideTelegram) {
    statusEl.textContent = "افتح التطبيق من داخل تلقرام.";
    return;
  }

  try {
    tg.ready();
    tg.expand();
  } catch (err) {
    console.error("Telegram WebApp init failed:", err);
  }

  // ملاحظة: initDataUnsafe للعرض فقط. أي شي حساس لازم يتحقق منه السيرفر عبر initData.
  var user = (tg.initDataUnsafe && tg.initDataUnsafe.user) || null;

  if (user) {
    var name = user.first_name || user.username || "";
    if (name) {
      greetingEl.textContent = "أهلًا " + name;
      avatarEl.textContent = name.trim().charAt(0).toUpperCase();
    }
    if (user.photo_url) {
      avatarEl.style.backgroundImage = "url('" + encodeURI(user.photo_url) + "')";
      avatarEl.textContent = "";
    }
  }

  statusEl.textContent = "التطبيق جاهز.";

  // واجهة صغيرة يستخدمها باقي الكود لاحقًا
  window.LUO = {
    tg: tg,
    user: user,
    haptic: function (type) {
      if (tg.HapticFeedback && tg.HapticFeedback.impactOccurred) {
        tg.HapticFeedback.impactOccurred(type || "light");
      }
    }
  };
})();
