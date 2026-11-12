/*
 * i18n.js — lightweight standalone multi-language helper.
 *
 * Usage:
 *   <script src="i18n.js"></script>
 *   <span data-i18n="play"></span>
 *   LUO_I18N.t('play');        // translated string
 *   LUO_I18N.set('ar');        // switch language (saved, page re-translated)
 *   LUO_I18N.langs;            // { code: nativeName }
 *
 * Self-contained: touches nothing unless elements carry [data-i18n].
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'luo_lang';
  var FALLBACK = 'en';
  var RTL = { ar: 1, fa: 1, ur: 1, he: 1 };

  var LANGS = {
    en: 'English', ar: 'العربية', hi: 'हिन्दी', zh: '中文', ru: 'Русский',
    es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', tr: 'Türkçe',
    fa: 'فارسی', ur: 'اردو', bn: 'বাংলা', id: 'Indonesia', ja: '日本語', ko: '한국어'
  };

  // key order: play, start, score, level, settings, language, loading, connect, back, ok, cancel
  var KEYS = ['play', 'start', 'score', 'level', 'settings', 'language', 'loading', 'connect', 'back', 'ok', 'cancel'];
  var ROWS = {
    en: ['Play', 'Start', 'Score', 'Level', 'Settings', 'Language', 'Loading…', 'Connect wallet', 'Back', 'OK', 'Cancel'],
    ar: ['العب', 'ابدأ', 'النقاط', 'المستوى', 'الإعدادات', 'اللغة', 'جارٍ التحميل…', 'ربط المحفظة', 'رجوع', 'موافق', 'إلغاء'],
    hi: ['खेलें', 'शुरू करें', 'स्कोर', 'स्तर', 'सेटिंग्स', 'भाषा', 'लोड हो रहा है…', 'वॉलेट जोड़ें', 'वापस', 'ठीक है', 'रद्द करें'],
    zh: ['开始游戏', '开始', '分数', '等级', '设置', '语言', '加载中…', '连接钱包', '返回', '确定', '取消'],
    ru: ['Играть', 'Старт', 'Счёт', 'Уровень', 'Настройки', 'Язык', 'Загрузка…', 'Подключить кошелёк', 'Назад', 'ОК', 'Отмена'],
    es: ['Jugar', 'Empezar', 'Puntos', 'Nivel', 'Ajustes', 'Idioma', 'Cargando…', 'Conectar billetera', 'Atrás', 'Aceptar', 'Cancelar'],
    fr: ['Jouer', 'Démarrer', 'Score', 'Niveau', 'Paramètres', 'Langue', 'Chargement…', 'Connecter le portefeuille', 'Retour', 'OK', 'Annuler'],
    de: ['Spielen', 'Start', 'Punkte', 'Level', 'Einstellungen', 'Sprache', 'Lädt…', 'Wallet verbinden', 'Zurück', 'OK', 'Abbrechen'],
    pt: ['Jogar', 'Iniciar', 'Pontos', 'Nível', 'Configurações', 'Idioma', 'Carregando…', 'Conectar carteira', 'Voltar', 'OK', 'Cancelar'],
    tr: ['Oyna', 'Başla', 'Skor', 'Seviye', 'Ayarlar', 'Dil', 'Yükleniyor…', 'Cüzdanı bağla', 'Geri', 'Tamam', 'İptal'],
    fa: ['بازی', 'شروع', 'امتیاز', 'مرحله', 'تنظیمات', 'زبان', 'در حال بارگذاری…', 'اتصال کیف پول', 'بازگشت', 'تأیید', 'لغو'],
    ur: ['کھیلیں', 'شروع کریں', 'اسکور', 'لیول', 'ترتیبات', 'زبان', 'لوڈ ہو رہا ہے…', 'والیٹ جوڑیں', 'واپس', 'ٹھیک ہے', 'منسوخ'],
    bn: ['খেলুন', 'শুরু', 'স্কোর', 'লেভেল', 'সেটিংস', 'ভাষা', 'লোড হচ্ছে…', 'ওয়ালেট যুক্ত করুন', 'পিছনে', 'ঠিক আছে', 'বাতিল'],
    id: ['Main', 'Mulai', 'Skor', 'Level', 'Pengaturan', 'Bahasa', 'Memuat…', 'Hubungkan dompet', 'Kembali', 'OK', 'Batal'],
    ja: ['プレイ', 'スタート', 'スコア', 'レベル', '設定', '言語', '読み込み中…', 'ウォレットを接続', '戻る', 'OK', 'キャンセル'],
    ko: ['플레이', '시작', '점수', '레벨', '설정', '언어', '로딩 중…', '지갑 연결', '뒤로', '확인', '취소']
  };

  var DICT = {};
  Object.keys(ROWS).forEach(function (code) {
    DICT[code] = {};
    KEYS.forEach(function (k, i) { DICT[code][k] = ROWS[code][i]; });
  });

  function normalize(code) {
    if (!code) return null;
    code = String(code).toLowerCase().split(/[-_]/)[0];
    return DICT[code] ? code : null;
  }

  function detect() {
    var saved = null;
    try { saved = global.localStorage && global.localStorage.getItem(STORAGE_KEY); } catch (e) {}
    var nav = global.navigator || {};
    var candidates = [saved].concat(nav.languages || [], [nav.language]);
    for (var i = 0; i < candidates.length; i++) {
      var hit = normalize(candidates[i]);
      if (hit) return hit;
    }
    return FALLBACK;
  }

  var current = detect();

  function t(key) {
    var table = DICT[current] || DICT[FALLBACK];
    return table[key] || DICT[FALLBACK][key] || key;
  }

  function apply(root) {
    var doc = global.document;
    if (!doc) return;
    root = root || doc;
    var nodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    // Only touch <html> direction when the page actually opted in.
    if (nodes.length && doc.documentElement) {
      doc.documentElement.lang = current;
      doc.documentElement.dir = RTL[current] ? 'rtl' : 'ltr';
    }
  }

  function set(code) {
    var next = normalize(code);
    if (!next) return false;
    current = next;
    try { global.localStorage && global.localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    apply();
    return true;
  }

  /** Merge extra strings: add({ ar: { hello: 'مرحبا' }, en: { hello: 'Hello' } }) */
  function add(extra) {
    Object.keys(extra || {}).forEach(function (code) {
      var c = String(code).toLowerCase();
      DICT[c] = DICT[c] || {};
      Object.keys(extra[code]).forEach(function (k) { DICT[c][k] = extra[code][k]; });
    });
    apply();
  }

  global.LUO_I18N = {
    t: t, set: set, add: add, apply: apply, langs: LANGS,
    get lang() { return current; },
    get isRTL() { return !!RTL[current]; }
  };

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { apply(); });
    } else {
      apply();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
