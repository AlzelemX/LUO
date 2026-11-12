/*
 * i18n.js — instant multi-language layer for Luo.
 *
 * How it works: the app keeps writing its normal Arabic text. This file watches
 * the page and swaps every known string for the chosen language, so no app
 * logic is touched. A globe button in the top bar opens the language picker.
 *
 *   LUO_I18N.set('en')   switch language (saved, applied instantly)
 *   LUO_I18N.lang        current code
 *   LUO_I18N.open()      open the picker
 *   LUO_I18N.t('نسخ')    translate an Arabic source string
 *
 * To add a string: append a row to D in the language order of CODES.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var STORAGE_KEY = 'luo_lang';
  var CODES = ['ar', 'en', 'ru', 'hi', 'zh', 'es', 'fr', 'de', 'pt', 'tr', 'fa', 'ur', 'bn', 'id', 'ja', 'ko'];
  var NAMES = ['العربية', 'English', 'Русский', 'हिन्दी', '中文', 'Español', 'Français', 'Deutsch', 'Português', 'Türkçe', 'فارسی', 'اردو', 'বাংলা', 'Indonesia', '日本語', '한국어'];
  var RTL = { ar: 1, fa: 1, ur: 1 };
  var ATTRS = ['aria-label', 'placeholder', 'title'];
  var SKIP = '#viewAdmin, #adminSheet, #ton-connect, [data-no-i18n], script, style';
  var ARABIC = /[؀-ۿ]/;

  var HELLO = 'أهلًا {0}';
  var GRANTED = 'انضافت لك {0} جولة مجانية 🎁';
  var LANG_TITLE = 'اللغة';

  // Rows: [ar, en, ru, hi, zh, es, fr, de, pt, tr, fa, ur, bn, id, ja, ko]
  var D = [
    ['أهلًا بك', 'Welcome', 'Добро пожаловать', 'स्वागत है', '欢迎', 'Bienvenido', 'Bienvenue', 'Willkommen', 'Bem-vindo', 'Hoş geldin', 'خوش آمدید', 'خوش آمدید', 'স্বাগতম', 'Selamat datang', 'ようこそ', '환영합니다'],
    [HELLO, 'Hello {0}', 'Привет, {0}', 'नमस्ते {0}', '你好，{0}', 'Hola, {0}', 'Bonjour {0}', 'Hallo {0}', 'Olá, {0}', 'Merhaba {0}', 'سلام {0}', 'سلام {0}', 'হ্যালো {0}', 'Halo {0}', 'こんにちは、{0}', '안녕하세요, {0}'],
    [LANG_TITLE, 'Language', 'Язык', 'भाषा', '语言', 'Idioma', 'Langue', 'Sprache', 'Idioma', 'Dil', 'زبان', 'زبان', 'ভাষা', 'Bahasa', '言語', '언어'],
    ['محفظتك في مكان واحد', 'Your wallet in one place', 'Ваш кошелёк в одном месте', 'आपका वॉलेट एक ही जगह', '你的钱包，尽在一处', 'Tu billetera en un solo lugar', 'Votre portefeuille en un seul endroit', 'Deine Wallet an einem Ort', 'Sua carteira em um só lugar', 'Cüzdanın tek bir yerde', 'کیف پول شما در یک جا', 'آپ کا والیٹ ایک ہی جگہ', 'আপনার ওয়ালেট এক জায়গায়', 'Dompet Anda di satu tempat', 'ウォレットをひとつの場所に', '내 지갑을 한곳에서'],
    ['اربط محفظتك عشان تستقبل وترسل العملات الرقمية. مفاتيحك وفلوسك تبقى عندك أنت.', 'Connect your wallet to receive and send crypto. Your keys and funds stay with you.', 'Подключите кошелёк, чтобы получать и отправлять криптовалюту. Ключи и средства остаются у вас.', 'क्रिप्टो भेजने और पाने के लिए अपना वॉलेट जोड़ें। आपकी कुंजियाँ और पैसे आपके ही पास रहते हैं।', '连接钱包即可收发加密货币。密钥和资金始终由你掌控。', 'Conecta tu billetera para recibir y enviar criptomonedas. Tus claves y tus fondos siguen siendo tuyos.', 'Connectez votre portefeuille pour recevoir et envoyer des cryptos. Vos clés et vos fonds restent chez vous.', 'Verbinde deine Wallet, um Krypto zu empfangen und zu senden. Deine Schlüssel und dein Geld bleiben bei dir.', 'Conecte sua carteira para receber e enviar criptomoedas. Suas chaves e seus fundos ficam com você.', 'Kripto alıp göndermek için cüzdanını bağla. Anahtarların ve paran sende kalır.', 'برای دریافت و ارسال رمزارز، کیف پول خود را وصل کنید. کلیدها و دارایی‌تان نزد خودتان می‌ماند.', 'کرپٹو وصول کرنے اور بھیجنے کے لیے اپنا والیٹ جوڑیں۔ آپ کی کیز اور رقم آپ ہی کے پاس رہتی ہے۔', 'ক্রিপ্টো পাঠাতে ও গ্রহণ করতে আপনার ওয়ালেট যুক্ত করুন। আপনার কী ও অর্থ আপনার কাছেই থাকে।', 'Hubungkan dompet Anda untuk menerima dan mengirim kripto. Kunci dan dana tetap di tangan Anda.', 'ウォレットを接続して暗号資産を送受信できます。鍵と資金は常にあなたの手元にあります。', '지갑을 연결해 암호화폐를 주고받으세요. 키와 자산은 항상 내가 보관합니다.'],
    ['ربط المحفظة', 'Connect wallet', 'Подключить кошелёк', 'वॉलेट जोड़ें', '连接钱包', 'Conectar billetera', 'Connecter le portefeuille', 'Wallet verbinden', 'Conectar carteira', 'Cüzdanı bağla', 'اتصال کیف پول', 'والیٹ جوڑیں', 'ওয়ালেট যুক্ত করুন', 'Hubungkan dompet', 'ウォレットを接続', '지갑 연결'],
    ['عنوان محفظتك', 'Your wallet address', 'Адрес вашего кошелька', 'आपके वॉलेट का पता', '你的钱包地址', 'Dirección de tu billetera', 'Adresse de votre portefeuille', 'Deine Wallet-Adresse', 'Endereço da sua carteira', 'Cüzdan adresin', 'آدرس کیف پول شما', 'آپ کے والیٹ کا پتہ', 'আপনার ওয়ালেটের ঠিকানা', 'Alamat dompet Anda', 'あなたのウォレットアドレス', '내 지갑 주소'],
    ['نسخ العنوان', 'Copy address', 'Скопировать адрес', 'पता कॉपी करें', '复制地址', 'Copiar dirección', 'Copier l’adresse', 'Adresse kopieren', 'Copiar endereço', 'Adresi kopyala', 'کپی آدرس', 'پتہ کاپی کریں', 'ঠিকানা কপি করুন', 'Salin alamat', 'アドレスをコピー', '주소 복사'],
    ['نسخ', 'Copy', 'Копировать', 'कॉपी', '复制', 'Copiar', 'Copier', 'Kopieren', 'Copiar', 'Kopyala', 'کپی', 'کاپی', 'কপি', 'Salin', 'コピー', '복사'],
    ['↓ استقبال', '↓ Receive', '↓ Получить', '↓ प्राप्त करें', '↓ 收款', '↓ Recibir', '↓ Recevoir', '↓ Empfangen', '↓ Receber', '↓ Al', '↓ دریافت', '↓ وصول کریں', '↓ গ্রহণ', '↓ Terima', '↓ 受け取る', '↓ 받기'],
    ['↑ إرسال', '↑ Send', '↑ Отправить', '↑ भेजें', '↑ 转账', '↑ Enviar', '↑ Envoyer', '↑ Senden', '↑ Enviar', '↑ Gönder', '↑ ارسال', '↑ بھیجیں', '↑ পাঠান', '↑ Kirim', '↑ 送る', '↑ 보내기'],
    ['استقبال', 'Receive', 'Получить', 'प्राप्त करें', '收款', 'Recibir', 'Recevoir', 'Empfangen', 'Receber', 'Al', 'دریافت', 'وصول کریں', 'গ্রহণ', 'Terima', '受け取る', '받기'],
    ['إرسال', 'Send', 'Отправить', 'भेजें', '转账', 'Enviar', 'Envoyer', 'Senden', 'Enviar', 'Gönder', 'ارسال', 'بھیجیں', 'পাঠান', 'Kirim', '送る', '보내기'],
    ['العملات', 'Coins', 'Монеты', 'कॉइन', '币种', 'Monedas', 'Cryptos', 'Coins', 'Moedas', 'Coinler', 'ارزها', 'کوائنز', 'কয়েন', 'Koin', 'コイン', '코인'],
    ['تحديث', 'Refresh', 'Обновить', 'रीफ़्रेश', '刷新', 'Actualizar', 'Actualiser', 'Aktualisieren', 'Atualizar', 'Yenile', 'به‌روزرسانی', 'ریفریش', 'রিফ্রেশ', 'Segarkan', '更新', '새로고침'],
    ['رصيدك', 'Your balance', 'Ваш баланс', 'आपका बैलेंस', '你的余额', 'Tu saldo', 'Votre solde', 'Dein Guthaben', 'Seu saldo', 'Bakiyen', 'موجودی شما', 'آپ کا بیلنس', 'আপনার ব্যালেন্স', 'Saldo Anda', '残高', '내 잔액'],
    ['💎 طلب سحب', '💎 Request withdrawal', '💎 Запросить вывод', '💎 निकासी का अनुरोध', '💎 申请提现', '💎 Solicitar retiro', '💎 Demander un retrait', '💎 Auszahlung anfordern', '💎 Solicitar saque', '💎 Çekim talebi', '💎 درخواست برداشت', '💎 رقم نکالنے کی درخواست', '💎 উত্তোলনের অনুরোধ', '💎 Ajukan penarikan', '💎 出金をリクエスト', '💎 출금 요청'],
    ['رابط أو عنوان محفظتك', 'Your wallet link or address', 'Ссылка или адрес вашего кошелька', 'आपके वॉलेट का लिंक या पता', '你的钱包链接或地址', 'Enlace o dirección de tu billetera', 'Lien ou adresse de votre portefeuille', 'Link oder Adresse deiner Wallet', 'Link ou endereço da sua carteira', 'Cüzdan bağlantın veya adresin', 'لینک یا آدرس کیف پول شما', 'آپ کے والیٹ کا لنک یا پتہ', 'আপনার ওয়ালেটের লিংক বা ঠিকানা', 'Tautan atau alamat dompet Anda', 'ウォレットのリンクまたはアドレス', '지갑 링크 또는 주소'],
    ['إرسال الطلب', 'Submit request', 'Отправить запрос', 'अनुरोध भेजें', '提交申请', 'Enviar solicitud', 'Envoyer la demande', 'Anfrage senden', 'Enviar pedido', 'Talebi gönder', 'ارسال درخواست', 'درخواست بھیجیں', 'অনুরোধ পাঠান', 'Kirim permintaan', 'リクエストを送信', '요청 보내기'],
    ['اختر مربع', 'Pick a tile', 'Выберите клетку', 'एक खाना चुनें', '选择一个格子', 'Elige una casilla', 'Choisissez une case', 'Wähle ein Feld', 'Escolha uma casa', 'Bir kare seç', 'یک خانه انتخاب کنید', 'ایک خانہ چنیں', 'একটি ঘর বেছে নিন', 'Pilih satu kotak', 'マスを選んでください', '칸을 선택하세요'],
    ['تجربة', 'Demo', 'Демо', 'डेमो', '试玩', 'Demo', 'Démo', 'Demo', 'Demo', 'Deneme', 'آزمایشی', 'ڈیمو', 'ডেমো', 'Demo', 'デモ', '체험'],
    ['المجموع', 'Total', 'Итого', 'कुल', '总计', 'Total', 'Total', 'Gesamt', 'Total', 'Toplam', 'مجموع', 'کل', 'মোট', 'Total', '合計', '합계'],
    ['لوحة اللعبة', 'Game board', 'Игровое поле', 'गेम बोर्ड', '游戏棋盘', 'Tablero de juego', 'Plateau de jeu', 'Spielfeld', 'Tabuleiro do jogo', 'Oyun tahtası', 'صفحه بازی', 'گیم بورڈ', 'গেম বোর্ড', 'Papan permainan', 'ゲームボード', '게임 보드'],
    ['اجمع ووقّف', 'Collect & stop', 'Забрать и выйти', 'इकट्ठा करें और रुकें', '收取并结束', 'Cobrar y parar', 'Encaisser et arrêter', 'Einsammeln & stoppen', 'Coletar e parar', 'Topla ve bırak', 'جمع کن و تمام کن', 'جمع کریں اور رکیں', 'সংগ্রহ করে থামুন', 'Ambil & berhenti', '回収して終了', '수령하고 멈추기'],
    ['اجمع (تجربة)', 'Collect (demo)', 'Забрать (демо)', 'इकट्ठा करें (डेमो)', '收取（试玩）', 'Cobrar (demo)', 'Encaisser (démo)', 'Einsammeln (Demo)', 'Coletar (demo)', 'Topla (deneme)', 'جمع کن (آزمایشی)', 'جمع کریں (ڈیمو)', 'সংগ্রহ (ডেমো)', 'Ambil (demo)', '回収（デモ）', '수령 (체험)'],
    ['لعبة جديدة', 'New game', 'Новая игра', 'नया गेम', '新游戏', 'Nueva partida', 'Nouvelle partie', 'Neues Spiel', 'Novo jogo', 'Yeni oyun', 'بازی جدید', 'نیا گیم', 'নতুন গেম', 'Game baru', '新しいゲーム', '새 게임'],
    ['لعبة حقيقية', 'Real game', 'Настоящая игра', 'असली गेम', '正式游戏', 'Partida real', 'Partie réelle', 'Echtes Spiel', 'Jogo real', 'Gerçek oyun', 'بازی واقعی', 'اصلی گیم', 'আসল গেম', 'Game sungguhan', '本番ゲーム', '실전 게임'],
    ['🎁 مجانية', '🎁 Free', '🎁 Бесплатно', '🎁 मुफ़्त', '🎁 免费', '🎁 Gratis', '🎁 Gratuite', '🎁 Gratis', '🎁 Grátis', '🎁 Ücretsiz', '🎁 رایگان', '🎁 مفت', '🎁 ফ্রি', '🎁 Gratis', '🎁 無料', '🎁 무료'],
    ['التنقل', 'Navigation', 'Навигация', 'नेविगेशन', '导航', 'Navegación', 'Navigation', 'Navigation', 'Navegação', 'Gezinme', 'پیمایش', 'نیویگیشن', 'নেভিগেশন', 'Navigasi', 'ナビゲーション', '탐색'],
    ['المحفظة', 'Wallet', 'Кошелёк', 'वॉलेट', '钱包', 'Billetera', 'Portefeuille', 'Wallet', 'Carteira', 'Cüzdan', 'کیف پول', 'والیٹ', 'ওয়ালেট', 'Dompet', 'ウォレット', '지갑'],
    ['اللعبة', 'Game', 'Игра', 'गेम', '游戏', 'Juego', 'Jeu', 'Spiel', 'Jogo', 'Oyun', 'بازی', 'گیم', 'গেম', 'Game', 'ゲーム', '게임'],
    ['لوحة التحكم', 'Control panel', 'Панель управления', 'कंट्रोल पैनल', '控制面板', 'Panel de control', 'Panneau de contrôle', 'Verwaltung', 'Painel de controle', 'Kontrol paneli', 'پنل مدیریت', 'کنٹرول پینل', 'কন্ট্রোল প্যানেল', 'Panel kontrol', '管理パネル', '관리 패널'],
    ['إغلاق', 'Close', 'Закрыть', 'बंद करें', '关闭', 'Cerrar', 'Fermer', 'Schließen', 'Fechar', 'Kapat', 'بستن', 'بند کریں', 'বন্ধ করুন', 'Tutup', '閉じる', '닫기'],
    ['هذا العنوان على شبكة TON فقط. إرسال عملات من شبكة ثانية (مثل USDT على TRC20 أو ERC20) يضيّعها.', 'This address is on the TON network only. Coins sent from another network (such as USDT on TRC20 or ERC20) will be lost.', 'Этот адрес работает только в сети TON. Монеты, отправленные из другой сети (например, USDT в TRC20 или ERC20), будут потеряны.', 'यह पता केवल TON नेटवर्क पर है। किसी दूसरे नेटवर्क (जैसे TRC20 या ERC20 पर USDT) से भेजे गए कॉइन खो जाएँगे।', '此地址仅适用于 TON 网络。从其他网络（如 TRC20 或 ERC20 上的 USDT）转入的币将会丢失。', 'Esta dirección es solo de la red TON. Las monedas enviadas desde otra red (como USDT en TRC20 o ERC20) se perderán.', 'Cette adresse est uniquement sur le réseau TON. Les cryptos envoyées depuis un autre réseau (comme l’USDT en TRC20 ou ERC20) seront perdues.', 'Diese Adresse gilt nur im TON-Netzwerk. Coins aus einem anderen Netzwerk (z. B. USDT über TRC20 oder ERC20) gehen verloren.', 'Este endereço é apenas da rede TON. Moedas enviadas de outra rede (como USDT em TRC20 ou ERC20) serão perdidas.', 'Bu adres yalnızca TON ağındadır. Başka bir ağdan (TRC20 veya ERC20 üzerindeki USDT gibi) gönderilen coinler kaybolur.', 'این آدرس فقط روی شبکه TON است. ارزهایی که از شبکه دیگری (مثل USDT روی TRC20 یا ERC20) فرستاده شوند از بین می‌روند.', 'یہ پتہ صرف TON نیٹ ورک پر ہے۔ کسی دوسرے نیٹ ورک (جیسے TRC20 یا ERC20 پر USDT) سے بھیجے گئے کوائنز ضائع ہو جائیں گے۔', 'এই ঠিকানা শুধু TON নেটওয়ার্কের। অন্য নেটওয়ার্ক (যেমন TRC20 বা ERC20-এর USDT) থেকে পাঠানো কয়েন হারিয়ে যাবে।', 'Alamat ini hanya untuk jaringan TON. Koin yang dikirim dari jaringan lain (seperti USDT di TRC20 atau ERC20) akan hilang.', 'このアドレスは TON ネットワーク専用です。他のネットワーク（TRC20 や ERC20 の USDT など）から送ったコインは失われます。', '이 주소는 TON 네트워크 전용입니다. 다른 네트워크(TRC20 또는 ERC20의 USDT 등)에서 보낸 코인은 사라집니다.'],
    ['العملة', 'Coin', 'Монета', 'कॉइन', '币种', 'Moneda', 'Crypto', 'Coin', 'Moeda', 'Coin', 'ارز', 'کوائن', 'কয়েন', 'Koin', 'コイン', '코인'],
    ['عنوان المستلم (شبكة TON)', 'Recipient address (TON network)', 'Адрес получателя (сеть TON)', 'प्राप्तकर्ता का पता (TON नेटवर्क)', '收款地址（TON 网络）', 'Dirección del destinatario (red TON)', 'Adresse du destinataire (réseau TON)', 'Empfängeradresse (TON-Netzwerk)', 'Endereço do destinatário (rede TON)', 'Alıcı adresi (TON ağı)', 'آدرس گیرنده (شبکه TON)', 'وصول کنندہ کا پتہ (TON نیٹ ورک)', 'প্রাপকের ঠিকানা (TON নেটওয়ার্ক)', 'Alamat penerima (jaringan TON)', '受取人アドレス（TON ネットワーク）', '받는 주소 (TON 네트워크)'],
    ['UQ… أو EQ…', 'UQ… or EQ…', 'UQ… или EQ…', 'UQ… या EQ…', 'UQ… 或 EQ…', 'UQ… o EQ…', 'UQ… ou EQ…', 'UQ… oder EQ…', 'UQ… ou EQ…', 'UQ… veya EQ…', 'UQ… یا EQ…', 'UQ… یا EQ…', 'UQ… বা EQ…', 'UQ… atau EQ…', 'UQ… または EQ…', 'UQ… 또는 EQ…'],
    ['لصق', 'Paste', 'Вставить', 'पेस्ट', '粘贴', 'Pegar', 'Coller', 'Einfügen', 'Colar', 'Yapıştır', 'چسباندن', 'پیسٹ', 'পেস্ট', 'Tempel', '貼り付け', '붙여넣기'],
    ['المبلغ', 'Amount', 'Сумма', 'राशि', '金额', 'Importe', 'Montant', 'Betrag', 'Valor', 'Tutar', 'مبلغ', 'رقم', 'পরিমাণ', 'Jumlah', '金額', '금액'],
    ['المتاح:', 'Available:', 'Доступно:', 'उपलब्ध:', '可用：', 'Disponible:', 'Disponible :', 'Verfügbar:', 'Disponível:', 'Kullanılabilir:', 'موجود:', 'دستیاب:', 'উপলব্ধ:', 'Tersedia:', '利用可能：', '사용 가능:'],
    ['الكل', 'Max', 'Всё', 'सभी', '全部', 'Todo', 'Tout', 'Alles', 'Tudo', 'Tümü', 'همه', 'سب', 'সব', 'Semua', '全額', '전액'],
    ['متابعة للتأكيد في المحفظة', 'Continue to confirm in wallet', 'Перейти к подтверждению в кошельке', 'वॉलेट में पुष्टि के लिए आगे बढ़ें', '前往钱包确认', 'Continuar para confirmar en la billetera', 'Continuer pour confirmer dans le portefeuille', 'Weiter zur Bestätigung in der Wallet', 'Continuar para confirmar na carteira', 'Cüzdanda onaylamak için devam et', 'ادامه برای تأیید در کیف پول', 'والیٹ میں تصدیق کے لیے جاری رکھیں', 'ওয়ালেটে নিশ্চিত করতে এগিয়ে যান', 'Lanjutkan untuk konfirmasi di dompet', 'ウォレットで確認へ進む', '지갑에서 확인하기'],
    ['التحويل ما يتم إلا بعد ما تأكده من محفظتك، وما ينعكس بعد التأكيد.', 'The transfer only happens after you confirm it in your wallet, and it cannot be reversed afterwards.', 'Перевод выполняется только после подтверждения в кошельке и после этого не может быть отменён.', 'ट्रांसफ़र तभी होता है जब आप उसे अपने वॉलेट में पुष्टि करते हैं, और उसके बाद उसे वापस नहीं किया जा सकता।', '只有在钱包中确认后才会转账，确认后无法撤销。', 'La transferencia solo se realiza cuando la confirmas en tu billetera y después no se puede revertir.', 'Le transfert n’a lieu qu’après votre confirmation dans le portefeuille et ne peut plus être annulé ensuite.', 'Die Überweisung erfolgt erst nach deiner Bestätigung in der Wallet und kann danach nicht rückgängig gemacht werden.', 'A transferência só acontece depois que você confirma na carteira e não pode ser revertida depois.', 'Transfer yalnızca cüzdanında onayladıktan sonra gerçekleşir ve sonrasında geri alınamaz.', 'انتقال فقط پس از تأیید شما در کیف پول انجام می‌شود و بعد از آن قابل برگشت نیست.', 'منتقلی صرف آپ کے والیٹ میں تصدیق کے بعد ہوتی ہے اور اس کے بعد واپس نہیں ہو سکتی۔', 'আপনি ওয়ালেটে নিশ্চিত করার পরেই ট্রান্সফার হয়, এবং এরপর তা ফেরানো যায় না।', 'Transfer hanya terjadi setelah Anda mengonfirmasinya di dompet, dan tidak dapat dibatalkan setelahnya.', '送金はウォレットで確認した後にのみ実行され、確認後は取り消せません。', '지갑에서 확인한 뒤에만 전송되며, 확인 후에는 되돌릴 수 없습니다.'],

    ['عنوان المستلم غير صحيح. تأكد إنه عنوان على شبكة TON.', 'Invalid recipient address. Make sure it is a TON network address.', 'Неверный адрес получателя. Убедитесь, что это адрес в сети TON.', 'प्राप्तकर्ता का पता ग़लत है। पक्का करें कि यह TON नेटवर्क का पता है।', '收款地址无效。请确认它是 TON 网络地址。', 'Dirección del destinatario no válida. Comprueba que sea una dirección de la red TON.', 'Adresse du destinataire invalide. Vérifiez qu’il s’agit d’une adresse du réseau TON.', 'Ungültige Empfängeradresse. Prüfe, ob es eine Adresse im TON-Netzwerk ist.', 'Endereço do destinatário inválido. Verifique se é um endereço da rede TON.', 'Alıcı adresi geçersiz. TON ağı adresi olduğundan emin ol.', 'آدرس گیرنده نادرست است. مطمئن شوید آدرس روی شبکه TON باشد.', 'وصول کنندہ کا پتہ غلط ہے۔ یقینی بنائیں کہ یہ TON نیٹ ورک کا پتہ ہے۔', 'প্রাপকের ঠিকানা সঠিক নয়। নিশ্চিত করুন এটি TON নেটওয়ার্কের ঠিকানা।', 'Alamat penerima tidak valid. Pastikan itu alamat jaringan TON.', '受取人アドレスが正しくありません。TON ネットワークのアドレスか確認してください。', '받는 주소가 올바르지 않습니다. TON 네트워크 주소인지 확인하세요.'],
    ['هذا عنوان محفظتك أنت.', 'This is your own wallet address.', 'Это адрес вашего собственного кошелька.', 'यह आपके अपने वॉलेट का पता है।', '这是你自己的钱包地址。', 'Esta es la dirección de tu propia billetera.', 'C’est l’adresse de votre propre portefeuille.', 'Das ist deine eigene Wallet-Adresse.', 'Este é o endereço da sua própria carteira.', 'Bu senin kendi cüzdan adresin.', 'این آدرس کیف پول خود شماست.', 'یہ آپ کے اپنے والیٹ کا پتہ ہے۔', 'এটি আপনার নিজের ওয়ালেটের ঠিকানা।', 'Ini alamat dompet Anda sendiri.', 'これはあなた自身のウォレットアドレスです。', '내 지갑 주소입니다.'],
    ['اكتب المبلغ.', 'Enter the amount.', 'Введите сумму.', 'राशि लिखें।', '请输入金额。', 'Escribe el importe.', 'Saisissez le montant.', 'Gib den Betrag ein.', 'Digite o valor.', 'Tutarı gir.', 'مبلغ را وارد کنید.', 'رقم لکھیں۔', 'পরিমাণ লিখুন।', 'Masukkan jumlah.', '金額を入力してください。', '금액을 입력하세요.'],
    ['المبلغ غير صحيح.', 'Invalid amount.', 'Неверная сумма.', 'राशि ग़लत है।', '金额无效。', 'Importe no válido.', 'Montant invalide.', 'Ungültiger Betrag.', 'Valor inválido.', 'Tutar geçersiz.', 'مبلغ نادرست است.', 'رقم غلط ہے۔', 'পরিমাণ সঠিক নয়।', 'Jumlah tidak valid.', '金額が正しくありません。', '금액이 올바르지 않습니다.'],
    ['المبلغ لازم يكون أكبر من صفر.', 'The amount must be greater than zero.', 'Сумма должна быть больше нуля.', 'राशि शून्य से ज़्यादा होनी चाहिए।', '金额必须大于零。', 'El importe debe ser mayor que cero.', 'Le montant doit être supérieur à zéro.', 'Der Betrag muss größer als null sein.', 'O valor deve ser maior que zero.', 'Tutar sıfırdan büyük olmalı.', 'مبلغ باید بیشتر از صفر باشد.', 'رقم صفر سے زیادہ ہونی چاہیے۔', 'পরিমাণ শূন্যের বেশি হতে হবে।', 'Jumlah harus lebih dari nol.', '金額は 0 より大きくしてください。', '금액은 0보다 커야 합니다.'],
    ['عدد الخانات العشرية أكثر من المسموح لهذه العملة.', 'Too many decimal places for this coin.', 'Слишком много знаков после запятой для этой монеты.', 'इस कॉइन के लिए दशमलव अंक बहुत ज़्यादा हैं।', '小数位数超出该币种允许的范围。', 'Demasiados decimales para esta moneda.', 'Trop de décimales pour cette crypto.', 'Zu viele Nachkommastellen für diesen Coin.', 'Casas decimais demais para esta moeda.', 'Bu coin için çok fazla ondalık basamak var.', 'تعداد رقم‌های اعشار برای این ارز بیش از حد مجاز است.', 'اس کوائن کے لیے اعشاریہ کے ہندسے بہت زیادہ ہیں۔', 'এই কয়েনের জন্য দশমিক ঘর বেশি হয়ে গেছে।', 'Terlalu banyak angka desimal untuk koin ini.', 'このコインで使える小数桁数を超えています。', '이 코인에 허용된 소수 자릿수를 초과했습니다.'],
    ['رصيدك ما يكفي لهذا المبلغ.', 'Your balance is not enough for this amount.', 'На балансе недостаточно средств для этой суммы.', 'इस राशि के लिए आपका बैलेंस काफ़ी नहीं है।', '余额不足以支付此金额。', 'Tu saldo no alcanza para este importe.', 'Votre solde est insuffisant pour ce montant.', 'Dein Guthaben reicht für diesen Betrag nicht aus.', 'Seu saldo não é suficiente para este valor.', 'Bakiyen bu tutar için yeterli değil.', 'موجودی شما برای این مبلغ کافی نیست.', 'آپ کا بیلنس اس رقم کے لیے کافی نہیں ہے۔', 'এই পরিমাণের জন্য আপনার ব্যালেন্স যথেষ্ট নয়।', 'Saldo Anda tidak cukup untuk jumlah ini.', 'この金額には残高が足りません。', '잔액이 이 금액에 부족합니다.'],
    ['تحتاج 0.05 TON على الأقل في محفظتك لرسوم التحويل.', 'You need at least 0.05 TON in your wallet for the transfer fee.', 'Для комиссии за перевод в кошельке нужно минимум 0.05 TON.', 'ट्रांसफ़र शुल्क के लिए आपके वॉलेट में कम से कम 0.05 TON चाहिए।', '钱包中至少需要 0.05 TON 用于支付转账手续费。', 'Necesitas al menos 0.05 TON en tu billetera para la comisión de la transferencia.', 'Il vous faut au moins 0.05 TON dans votre portefeuille pour les frais de transfert.', 'Du brauchst mindestens 0.05 TON in deiner Wallet für die Überweisungsgebühr.', 'Você precisa de pelo menos 0.05 TON na carteira para a taxa de transferência.', 'Transfer ücreti için cüzdanında en az 0.05 TON olmalı.', 'برای کارمزد انتقال دست‌کم 0.05 TON در کیف پول خود نیاز دارید.', 'منتقلی کی فیس کے لیے آپ کے والیٹ میں کم از کم 0.05 TON ہونا چاہیے۔', 'ট্রান্সফার ফি-র জন্য আপনার ওয়ালেটে অন্তত 0.05 TON দরকার।', 'Anda perlu minimal 0.05 TON di dompet untuk biaya transfer.', '送金手数料として、ウォレットに最低 0.05 TON が必要です。', '전송 수수료로 지갑에 최소 0.05 TON이 필요합니다.'],
    ['ما قدرت أنسخ، انسخه يدويًا.', 'Couldn’t copy. Please copy it manually.', 'Не удалось скопировать. Скопируйте вручную.', 'कॉपी नहीं हो सका। कृपया ख़ुद कॉपी करें।', '无法复制，请手动复制。', 'No se pudo copiar. Cópialo manualmente.', 'Copie impossible. Copiez-la manuellement.', 'Kopieren fehlgeschlagen. Bitte manuell kopieren.', 'Não foi possível copiar. Copie manualmente.', 'Kopyalanamadı. Lütfen elle kopyala.', 'کپی نشد. لطفاً دستی کپی کنید.', 'کاپی نہیں ہو سکا۔ براہ کرم خود کاپی کریں۔', 'কপি করা যায়নি। নিজে কপি করে নিন।', 'Gagal menyalin. Salin secara manual.', 'コピーできませんでした。手動でコピーしてください。', '복사하지 못했습니다. 직접 복사해 주세요.'],
    ['تم النسخ', 'Copied', 'Скопировано', 'कॉपी हो गया', '已复制', 'Copiado', 'Copié', 'Kopiert', 'Copiado', 'Kopyalandı', 'کپی شد', 'کاپی ہو گیا', 'কপি হয়েছে', 'Tersalin', 'コピーしました', '복사됨'],
    ['ما قدرت أجيب الأرصدة الحين. اضغط «تحديث» بعد شوي.', 'Couldn’t load balances right now. Tap “Refresh” in a moment.', 'Сейчас не удалось загрузить балансы. Нажмите «Обновить» чуть позже.', 'अभी बैलेंस लोड नहीं हो सके। थोड़ी देर बाद “रीफ़्रेश” दबाएँ।', '暂时无法加载余额。请稍后点击“刷新”。', 'No se pudieron cargar los saldos ahora. Toca «Actualizar» en un momento.', 'Impossible de charger les soldes pour le moment. Appuyez sur « Actualiser » dans un instant.', 'Guthaben konnten gerade nicht geladen werden. Tippe gleich auf „Aktualisieren“.', 'Não foi possível carregar os saldos agora. Toque em “Atualizar” daqui a pouco.', 'Bakiyeler şu an yüklenemedi. Birazdan “Yenile”ye dokun.', 'الان نشد موجودی‌ها را بگیریم. کمی بعد «به‌روزرسانی» را بزنید.', 'ابھی بیلنس لوڈ نہیں ہو سکے۔ تھوڑی دیر بعد «ریفریش» دبائیں۔', 'এই মুহূর্তে ব্যালেন্স লোড করা যায়নি। একটু পরে “রিফ্রেশ” চাপুন।', 'Saldo belum bisa dimuat sekarang. Ketuk “Segarkan” sebentar lagi.', '現在、残高を取得できません。少ししてから「更新」をタップしてください。', '지금은 잔액을 불러올 수 없습니다. 잠시 후 “새로고침”을 눌러 주세요.'],
    ['الأرصدة ما تحمّلت. اضغط «تحديث» وجرّب مرة ثانية.', 'Balances didn’t load. Tap “Refresh” and try again.', 'Балансы не загрузились. Нажмите «Обновить» и попробуйте снова.', 'बैलेंस लोड नहीं हुए। “रीफ़्रेश” दबाकर फिर कोशिश करें।', '余额未加载。请点击“刷新”后重试。', 'Los saldos no se cargaron. Toca «Actualizar» e inténtalo de nuevo.', 'Les soldes ne se sont pas chargés. Appuyez sur « Actualiser » et réessayez.', 'Guthaben wurden nicht geladen. Tippe auf „Aktualisieren“ und versuche es erneut.', 'Os saldos não carregaram. Toque em “Atualizar” e tente de novo.', 'Bakiyeler yüklenmedi. “Yenile”ye dokunup tekrar dene.', 'موجودی‌ها بارگذاری نشد. «به‌روزرسانی» را بزنید و دوباره امتحان کنید.', 'بیلنس لوڈ نہیں ہوئے۔ «ریفریش» دبا کر دوبارہ کوشش کریں۔', 'ব্যালেন্স লোড হয়নি। “রিফ্রেশ” চেপে আবার চেষ্টা করুন।', 'Saldo tidak termuat. Ketuk “Segarkan” lalu coba lagi.', '残高を読み込めませんでした。「更新」をタップしてもう一度お試しください。', '잔액을 불러오지 못했습니다. “새로고침”을 누르고 다시 시도하세요.'],
    ['صار خطأ في تجهيز التحويل.', 'Something went wrong while preparing the transfer.', 'Ошибка при подготовке перевода.', 'ट्रांसफ़र तैयार करते समय गड़बड़ी हुई।', '准备转账时出错。', 'Hubo un error al preparar la transferencia.', 'Une erreur est survenue lors de la préparation du transfert.', 'Beim Vorbereiten der Überweisung ist ein Fehler aufgetreten.', 'Ocorreu um erro ao preparar a transferência.', 'Transfer hazırlanırken bir hata oluştu.', 'هنگام آماده‌سازی انتقال خطایی رخ داد.', 'منتقلی تیار کرتے وقت خرابی ہوئی۔', 'ট্রান্সফার প্রস্তুত করতে সমস্যা হয়েছে।', 'Terjadi kesalahan saat menyiapkan transfer.', '送金の準備中にエラーが発生しました。', '전송을 준비하는 중 오류가 발생했습니다.'],
    ['أكّد من محفظتك…', 'Confirm in your wallet…', 'Подтвердите в кошельке…', 'अपने वॉलेट में पुष्टि करें…', '请在钱包中确认…', 'Confirma en tu billetera…', 'Confirmez dans votre portefeuille…', 'In deiner Wallet bestätigen…', 'Confirme na sua carteira…', 'Cüzdanında onayla…', 'در کیف پول خود تأیید کنید…', 'اپنے والیٹ میں تصدیق کریں…', 'আপনার ওয়ালেটে নিশ্চিত করুন…', 'Konfirmasi di dompet Anda…', 'ウォレットで確認してください…', '지갑에서 확인하세요…'],
    ['تم إرسال العملية. الرصيد يتحدث خلال ثواني.', 'Transaction sent. Your balance will update in a few seconds.', 'Транзакция отправлена. Баланс обновится через несколько секунд.', 'लेन-देन भेज दिया गया। बैलेंस कुछ सेकंड में अपडेट होगा।', '交易已发送。余额将在几秒内更新。', 'Transacción enviada. El saldo se actualizará en unos segundos.', 'Transaction envoyée. Le solde se mettra à jour dans quelques secondes.', 'Transaktion gesendet. Das Guthaben wird in wenigen Sekunden aktualisiert.', 'Transação enviada. O saldo será atualizado em alguns segundos.', 'İşlem gönderildi. Bakiye birkaç saniye içinde güncellenir.', 'تراکنش ارسال شد. موجودی تا چند ثانیه دیگر به‌روز می‌شود.', 'ٹرانزیکشن بھیج دی گئی۔ بیلنس چند سیکنڈ میں اپڈیٹ ہو جائے گا۔', 'লেনদেন পাঠানো হয়েছে। কয়েক সেকেন্ডে ব্যালেন্স আপডেট হবে।', 'Transaksi terkirim. Saldo akan diperbarui dalam beberapa detik.', '取引を送信しました。残高は数秒で更新されます。', '거래를 보냈습니다. 잔액은 몇 초 안에 업데이트됩니다.'],
    ['ألغيت العملية من المحفظة.', 'You cancelled the transaction in the wallet.', 'Вы отменили транзакцию в кошельке.', 'आपने वॉलेट में लेन-देन रद्द कर दिया।', '你已在钱包中取消交易。', 'Cancelaste la transacción en la billetera.', 'Vous avez annulé la transaction dans le portefeuille.', 'Du hast die Transaktion in der Wallet abgebrochen.', 'Você cancelou a transação na carteira.', 'İşlemi cüzdanda iptal ettin.', 'تراکنش را در کیف پول لغو کردید.', 'آپ نے والیٹ میں ٹرانزیکشن منسوخ کر دی۔', 'আপনি ওয়ালেটে লেনদেন বাতিল করেছেন।', 'Anda membatalkan transaksi di dompet.', 'ウォレットで取引をキャンセルしました。', '지갑에서 거래를 취소했습니다.'],
    ['ما تم الإرسال. تأكد من محفظتك وجرّب مرة ثانية.', 'Not sent. Check your wallet and try again.', 'Не отправлено. Проверьте кошелёк и попробуйте снова.', 'भेजा नहीं जा सका। अपना वॉलेट जाँचें और फिर कोशिश करें।', '发送失败。请检查钱包后重试。', 'No se envió. Revisa tu billetera e inténtalo de nuevo.', 'Envoi échoué. Vérifiez votre portefeuille et réessayez.', 'Nicht gesendet. Prüfe deine Wallet und versuche es erneut.', 'Não foi enviado. Verifique sua carteira e tente de novo.', 'Gönderilemedi. Cüzdanını kontrol edip tekrar dene.', 'ارسال نشد. کیف پول خود را بررسی کنید و دوباره امتحان کنید.', 'بھیجا نہیں جا سکا۔ اپنا والیٹ چیک کریں اور دوبارہ کوشش کریں۔', 'পাঠানো যায়নি। ওয়ালেট দেখে আবার চেষ্টা করুন।', 'Tidak terkirim. Periksa dompet Anda lalu coba lagi.', '送信できませんでした。ウォレットを確認してもう一度お試しください。', '전송되지 않았습니다. 지갑을 확인하고 다시 시도하세요.'],
    ['هذه المحفظة على شبكة تجريبية. اربط محفظة على الشبكة الرئيسية.', 'This wallet is on a test network. Connect a mainnet wallet.', 'Этот кошелёк в тестовой сети. Подключите кошелёк основной сети.', 'यह वॉलेट टेस्ट नेटवर्क पर है। मेननेट वाला वॉलेट जोड़ें।', '此钱包在测试网络上。请连接主网钱包。', 'Esta billetera está en una red de pruebas. Conecta una billetera de la red principal.', 'Ce portefeuille est sur un réseau de test. Connectez un portefeuille du réseau principal.', 'Diese Wallet ist in einem Testnetz. Verbinde eine Mainnet-Wallet.', 'Esta carteira está em uma rede de testes. Conecte uma carteira da rede principal.', 'Bu cüzdan test ağında. Ana ağdaki bir cüzdanı bağla.', 'این کیف پول روی شبکه آزمایشی است. یک کیف پول شبکه اصلی وصل کنید.', 'یہ والیٹ ٹیسٹ نیٹ ورک پر ہے۔ مین نیٹ والا والیٹ جوڑیں۔', 'এই ওয়ালেট টেস্ট নেটওয়ার্কে আছে। মেইননেট ওয়ালেট যুক্ত করুন।', 'Dompet ini berada di jaringan uji. Hubungkan dompet mainnet.', 'このウォレットはテストネットのものです。メインネットのウォレットを接続してください。', '이 지갑은 테스트 네트워크에 있습니다. 메인넷 지갑을 연결하세요.'],
    ['ما تحمّلت ملفات التطبيق كاملة. أعد فتح التطبيق.', 'The app files didn’t load completely. Reopen the app.', 'Файлы приложения загрузились не полностью. Откройте приложение заново.', 'ऐप की फ़ाइलें पूरी लोड नहीं हुईं। ऐप दोबारा खोलें।', '应用文件未完整加载。请重新打开应用。', 'Los archivos de la app no se cargaron por completo. Vuelve a abrir la app.', 'Les fichiers de l’application ne se sont pas chargés entièrement. Rouvrez l’application.', 'Die App-Dateien wurden nicht vollständig geladen. Öffne die App erneut.', 'Os arquivos do app não carregaram por completo. Abra o app novamente.', 'Uygulama dosyaları tam yüklenmedi. Uygulamayı yeniden aç.', 'فایل‌های برنامه کامل بارگذاری نشد. برنامه را دوباره باز کنید.', 'ایپ کی فائلیں مکمل لوڈ نہیں ہوئیں۔ ایپ دوبارہ کھولیں۔', 'অ্যাপের ফাইল পুরোপুরি লোড হয়নি। অ্যাপটি আবার খুলুন।', 'File aplikasi tidak termuat sepenuhnya. Buka kembali aplikasi.', 'アプリのファイルを完全に読み込めませんでした。アプリを開き直してください。', '앱 파일이 완전히 로드되지 않았습니다. 앱을 다시 열어 주세요.'],
    ['الصق العنوان يدويًا في الخانة.', 'Paste the address into the field manually.', 'Вставьте адрес в поле вручную.', 'पता ख़ुद बॉक्स में पेस्ट करें।', '请手动将地址粘贴到输入框。', 'Pega la dirección en el campo manualmente.', 'Collez l’adresse manuellement dans le champ.', 'Füge die Adresse manuell in das Feld ein.', 'Cole o endereço no campo manualmente.', 'Adresi alana elle yapıştır.', 'آدرس را دستی در کادر بچسبانید.', 'پتہ خود خانے میں پیسٹ کریں۔', 'ঠিকানাটি নিজে ঘরে পেস্ট করুন।', 'Tempel alamat ke kolom secara manual.', 'アドレスを入力欄に手動で貼り付けてください。', '주소를 입력란에 직접 붙여넣어 주세요.'],

    ['افتح التطبيق من داخل تلقرام عشان تلعب لعبة حقيقية.', 'Open the app inside Telegram to play a real game.', 'Откройте приложение в Telegram, чтобы играть по-настоящему.', 'असली गेम खेलने के लिए ऐप को Telegram के अंदर खोलें।', '请在 Telegram 内打开应用以进行正式游戏。', 'Abre la app dentro de Telegram para jugar una partida real.', 'Ouvrez l’application dans Telegram pour jouer une partie réelle.', 'Öffne die App in Telegram, um ein echtes Spiel zu spielen.', 'Abra o app dentro do Telegram para jogar de verdade.', 'Gerçek oyun oynamak için uygulamayı Telegram içinden aç.', 'برای بازی واقعی، برنامه را از داخل تلگرام باز کنید.', 'اصلی گیم کھیلنے کے لیے ایپ کو ٹیلیگرام کے اندر کھولیں۔', 'আসল গেম খেলতে অ্যাপটি Telegram-এর ভেতর থেকে খুলুন।', 'Buka aplikasi dari dalam Telegram untuk bermain game sungguhan.', '本番ゲームをプレイするには、Telegram 内でアプリを開いてください。', '실전 게임을 하려면 Telegram 안에서 앱을 여세요.'],
    ['اللعبة الحقيقية تتفعّل قريب. جرّب وضع التجربة.', 'The real game is coming soon. Try demo mode.', 'Настоящая игра скоро будет доступна. Попробуйте демо-режим.', 'असली गेम जल्द शुरू होगा। डेमो मोड आज़माएँ।', '正式游戏即将开放。先试试试玩模式。', 'El juego real se activará pronto. Prueba el modo demo.', 'Le jeu réel arrive bientôt. Essayez le mode démo.', 'Das echte Spiel kommt bald. Probiere den Demo-Modus.', 'O jogo real será ativado em breve. Experimente o modo demo.', 'Gerçek oyun yakında açılıyor. Deneme modunu dene.', 'بازی واقعی به‌زودی فعال می‌شود. حالت آزمایشی را امتحان کنید.', 'اصلی گیم جلد شروع ہو گا۔ ڈیمو موڈ آزمائیں۔', 'আসল গেম শিগগিরই চালু হবে। ডেমো মোড চেষ্টা করুন।', 'Game sungguhan segera hadir. Coba mode demo.', '本番ゲームはまもなく開始します。デモモードをお試しください。', '실전 게임은 곧 열립니다. 체험 모드를 이용해 보세요.'],
    ['انتهت الجلسة. سكّر التطبيق وافتحه من جديد.', 'Session expired. Close the app and open it again.', 'Сессия истекла. Закройте приложение и откройте снова.', 'सेशन ख़त्म हो गया। ऐप बंद करके दोबारा खोलें।', '会话已过期。请关闭应用后重新打开。', 'La sesión caducó. Cierra la app y ábrela de nuevo.', 'Session expirée. Fermez l’application et rouvrez-la.', 'Sitzung abgelaufen. Schließe die App und öffne sie erneut.', 'A sessão expirou. Feche o app e abra de novo.', 'Oturum sona erdi. Uygulamayı kapatıp yeniden aç.', 'نشست تمام شد. برنامه را ببندید و دوباره باز کنید.', 'سیشن ختم ہو گیا۔ ایپ بند کر کے دوبارہ کھولیں۔', 'সেশন শেষ হয়েছে। অ্যাপ বন্ধ করে আবার খুলুন।', 'Sesi berakhir. Tutup aplikasi lalu buka lagi.', 'セッションが切れました。アプリを閉じて開き直してください。', '세션이 만료되었습니다. 앱을 닫았다가 다시 여세요.'],
    ['ما فيه اتصال بالسيرفر. تأكد من النت.', 'No connection to the server. Check your internet.', 'Нет связи с сервером. Проверьте интернет.', 'सर्वर से कनेक्शन नहीं है। अपना इंटरनेट जाँचें।', '无法连接服务器。请检查网络。', 'Sin conexión con el servidor. Revisa tu internet.', 'Pas de connexion au serveur. Vérifiez votre connexion internet.', 'Keine Verbindung zum Server. Prüfe dein Internet.', 'Sem conexão com o servidor. Verifique sua internet.', 'Sunucuya bağlantı yok. İnternetini kontrol et.', 'اتصال به سرور برقرار نیست. اینترنت خود را بررسی کنید.', 'سرور سے رابطہ نہیں ہے۔ اپنا انٹرنیٹ چیک کریں۔', 'সার্ভারের সাথে সংযোগ নেই। ইন্টারনেট দেখে নিন।', 'Tidak ada koneksi ke server. Periksa internet Anda.', 'サーバーに接続できません。ネット接続を確認してください。', '서버에 연결할 수 없습니다. 인터넷을 확인하세요.'],
    ['حسابك موقوف من صاحب البوت.', 'Your account has been suspended by the bot owner.', 'Ваш аккаунт заблокирован владельцем бота.', 'आपका खाता बॉट के मालिक ने निलंबित कर दिया है।', '你的账号已被机器人所有者封停。', 'Tu cuenta fue suspendida por el dueño del bot.', 'Votre compte a été suspendu par le propriétaire du bot.', 'Dein Konto wurde vom Bot-Betreiber gesperrt.', 'Sua conta foi suspensa pelo dono do bot.', 'Hesabın bot sahibi tarafından askıya alındı.', 'حساب شما توسط صاحب ربات مسدود شده است.', 'آپ کا اکاؤنٹ بوٹ کے مالک نے معطل کر دیا ہے۔', 'বটের মালিক আপনার অ্যাকাউন্ট স্থগিত করেছেন।', 'Akun Anda ditangguhkan oleh pemilik bot.', 'あなたのアカウントはボットのオーナーにより停止されています。', '봇 소유자가 계정을 정지했습니다.'],
    ['اللعبة الحقيقية غير مفعّلة.', 'The real game is not enabled.', 'Настоящая игра не включена.', 'असली गेम चालू नहीं है।', '正式游戏未开启。', 'El juego real no está activado.', 'Le jeu réel n’est pas activé.', 'Das echte Spiel ist nicht aktiviert.', 'O jogo real não está ativado.', 'Gerçek oyun etkin değil.', 'بازی واقعی فعال نیست.', 'اصلی گیم فعال نہیں ہے۔', 'আসল গেম চালু নেই।', 'Game sungguhan belum diaktifkan.', '本番ゲームは有効になっていません。', '실전 게임이 활성화되지 않았습니다.'],
    ['اربط محفظتك أول عشان تلعب.', 'Connect your wallet first to play.', 'Сначала подключите кошелёк, чтобы играть.', 'खेलने के लिए पहले अपना वॉलेट जोड़ें।', '请先连接钱包再开始游戏。', 'Conecta tu billetera primero para jugar.', 'Connectez d’abord votre portefeuille pour jouer.', 'Verbinde zuerst deine Wallet, um zu spielen.', 'Conecte sua carteira primeiro para jogar.', 'Oynamak için önce cüzdanını bağla.', 'برای بازی، اول کیف پول خود را وصل کنید.', 'کھیلنے کے لیے پہلے اپنا والیٹ جوڑیں۔', 'খেলতে আগে আপনার ওয়ালেট যুক্ত করুন।', 'Hubungkan dompet Anda dulu untuk bermain.', 'プレイするには、まずウォレットを接続してください。', '플레이하려면 먼저 지갑을 연결하세요.'],
    ['فيه عملية ثانية شغالة، انتظر شوي.', 'Another operation is in progress. Please wait a moment.', 'Выполняется другая операция. Подождите немного.', 'एक और प्रक्रिया चल रही है, थोड़ा इंतज़ार करें।', '另一项操作正在进行，请稍候。', 'Hay otra operación en curso. Espera un momento.', 'Une autre opération est en cours. Patientez un instant.', 'Ein anderer Vorgang läuft gerade. Bitte kurz warten.', 'Há outra operação em andamento. Aguarde um instante.', 'Başka bir işlem sürüyor, biraz bekle.', 'عملیات دیگری در حال انجام است، کمی صبر کنید.', 'ایک اور عمل جاری ہے، تھوڑا انتظار کریں۔', 'আরেকটি কাজ চলছে, একটু অপেক্ষা করুন।', 'Ada proses lain yang sedang berjalan. Tunggu sebentar.', '別の処理が進行中です。少しお待ちください。', '다른 작업이 진행 중입니다. 잠시 기다려 주세요.'],
    ['رصيدك من TON ما يكفي لسعر الجولة.', 'Your TON balance is not enough for the round price.', 'Баланса TON недостаточно для оплаты раунда.', 'आपका TON बैलेंस राउंड की क़ीमत के लिए काफ़ी नहीं है।', '你的 TON 余额不足以支付本局费用。', 'Tu saldo de TON no alcanza para el precio de la ronda.', 'Votre solde TON est insuffisant pour le prix de la manche.', 'Dein TON-Guthaben reicht nicht für den Rundenpreis.', 'Seu saldo de TON não é suficiente para o preço da rodada.', 'TON bakiyen tur ücreti için yeterli değil.', 'موجودی TON شما برای هزینه دور کافی نیست.', 'آپ کا TON بیلنس راؤنڈ کی قیمت کے لیے کافی نہیں ہے۔', 'আপনার TON ব্যালেন্স রাউন্ডের দামের জন্য যথেষ্ট নয়।', 'Saldo TON Anda tidak cukup untuk harga ronde.', 'TON 残高がラウンド料金に足りません。', 'TON 잔액이 라운드 요금에 부족합니다.'],
    ['ألغيت الدفع من المحفظة.', 'You cancelled the payment in the wallet.', 'Вы отменили оплату в кошельке.', 'आपने वॉलेट में भुगतान रद्द कर दिया।', '你已在钱包中取消支付。', 'Cancelaste el pago en la billetera.', 'Vous avez annulé le paiement dans le portefeuille.', 'Du hast die Zahlung in der Wallet abgebrochen.', 'Você cancelou o pagamento na carteira.', 'Ödemeyi cüzdanda iptal ettin.', 'پرداخت را در کیف پول لغو کردید.', 'آپ نے والیٹ میں ادائیگی منسوخ کر دی۔', 'আপনি ওয়ালেটে পেমেন্ট বাতিল করেছেন।', 'Anda membatalkan pembayaran di dompet.', 'ウォレットで支払いをキャンセルしました。', '지갑에서 결제를 취소했습니다.'],
    ['ما تم الدفع. جرّب مرة ثانية.', 'Payment failed. Try again.', 'Оплата не прошла. Попробуйте снова.', 'भुगतान नहीं हुआ। फिर कोशिश करें।', '支付未完成。请重试。', 'El pago no se completó. Inténtalo de nuevo.', 'Paiement échoué. Réessayez.', 'Zahlung fehlgeschlagen. Versuche es erneut.', 'O pagamento não foi concluído. Tente de novo.', 'Ödeme yapılamadı. Tekrar dene.', 'پرداخت انجام نشد. دوباره امتحان کنید.', 'ادائیگی نہیں ہو سکی۔ دوبارہ کوشش کریں۔', 'পেমেন্ট হয়নি। আবার চেষ্টা করুন।', 'Pembayaran gagal. Coba lagi.', '支払いが完了しませんでした。もう一度お試しください。', '결제가 완료되지 않았습니다. 다시 시도하세요.'],
    ['اللعبة موقفة مؤقتًا من صاحب البوت.', 'The game is temporarily paused by the bot owner.', 'Игра временно приостановлена владельцем бота.', 'गेम बॉट के मालिक ने कुछ समय के लिए रोक दिया है।', '游戏已被机器人所有者暂时停用。', 'El juego está pausado temporalmente por el dueño del bot.', 'Le jeu est temporairement suspendu par le propriétaire du bot.', 'Das Spiel wurde vom Bot-Betreiber vorübergehend pausiert.', 'O jogo foi pausado temporariamente pelo dono do bot.', 'Oyun bot sahibi tarafından geçici olarak durduruldu.', 'بازی موقتاً توسط صاحب ربات متوقف شده است.', 'گیم بوٹ کے مالک نے عارضی طور پر روک دیا ہے۔', 'বটের মালিক গেমটি সাময়িকভাবে বন্ধ রেখেছেন।', 'Game dijeda sementara oleh pemilik bot.', 'ゲームはボットのオーナーにより一時停止中です。', '봇 소유자가 게임을 일시 중지했습니다.'],
    ['اللعبة موقفة مؤقتًا', 'Game temporarily paused', 'Игра временно приостановлена', 'गेम कुछ समय के लिए बंद है', '游戏暂时停用', 'Juego pausado temporalmente', 'Jeu temporairement suspendu', 'Spiel vorübergehend pausiert', 'Jogo pausado temporariamente', 'Oyun geçici olarak durduruldu', 'بازی موقتاً متوقف است', 'گیم عارضی طور پر بند ہے', 'গেম সাময়িকভাবে বন্ধ', 'Game dijeda sementara', 'ゲームは一時停止中', '게임 일시 중지됨'],
    ['ما عندك جولات مجانية.', 'You have no free rounds.', 'У вас нет бесплатных раундов.', 'आपके पास कोई मुफ़्त राउंड नहीं है।', '你没有免费局数。', 'No tienes rondas gratis.', 'Vous n’avez aucune manche gratuite.', 'Du hast keine Gratisrunden.', 'Você não tem rodadas grátis.', 'Ücretsiz turun yok.', 'دور رایگان ندارید.', 'آپ کے پاس کوئی مفت راؤنڈ نہیں ہے۔', 'আপনার কোনো ফ্রি রাউন্ড নেই।', 'Anda tidak punya ronde gratis.', '無料ラウンドがありません。', '무료 라운드가 없습니다.'],
    ['انقطع الاتصال. جرّب مرة ثانية.', 'Connection lost. Try again.', 'Соединение прервано. Попробуйте снова.', 'कनेक्शन टूट गया। फिर कोशिश करें।', '连接中断。请重试。', 'Se perdió la conexión. Inténtalo de nuevo.', 'Connexion perdue. Réessayez.', 'Verbindung unterbrochen. Versuche es erneut.', 'A conexão caiu. Tente de novo.', 'Bağlantı kesildi. Tekrar dene.', 'اتصال قطع شد. دوباره امتحان کنید.', 'رابطہ منقطع ہو گیا۔ دوبارہ کوشش کریں۔', 'সংযোগ বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।', 'Koneksi terputus. Coba lagi.', '接続が切れました。もう一度お試しください。', '연결이 끊겼습니다. 다시 시도하세요.'],
    ['هذا العرض انتهى.', 'This offer has ended.', 'Это предложение закончилось.', 'यह ऑफ़र ख़त्म हो गया है।', '此活动已结束。', 'Esta oferta ha terminado.', 'Cette offre est terminée.', 'Dieses Angebot ist beendet.', 'Esta oferta terminou.', 'Bu teklif sona erdi.', 'این پیشنهاد تمام شده است.', 'یہ پیشکش ختم ہو چکی ہے۔', 'এই অফার শেষ হয়ে গেছে।', 'Penawaran ini sudah berakhir.', 'このオファーは終了しました。', '이 혜택은 종료되었습니다.'],
    ['استلمت هذا العرض من قبل.', 'You have already claimed this offer.', 'Вы уже получили это предложение.', 'आप यह ऑफ़र पहले ही ले चुके हैं।', '你已领取过此活动。', 'Ya reclamaste esta oferta.', 'Vous avez déjà profité de cette offre.', 'Du hast dieses Angebot bereits eingelöst.', 'Você já resgatou esta oferta.', 'Bu teklifi zaten aldın.', 'این پیشنهاد را قبلاً دریافت کرده‌اید.', 'آپ یہ پیشکش پہلے ہی لے چکے ہیں۔', 'আপনি এই অফার আগেই নিয়েছেন।', 'Anda sudah mengklaim penawaran ini.', 'このオファーはすでに受け取り済みです。', '이미 받은 혜택입니다.'],
    ['صار خطأ. جرّب مرة ثانية.', 'Something went wrong. Try again.', 'Произошла ошибка. Попробуйте снова.', 'कुछ गड़बड़ हुई। फिर कोशिश करें।', '出错了。请重试。', 'Algo salió mal. Inténtalo de nuevo.', 'Une erreur est survenue. Réessayez.', 'Etwas ist schiefgelaufen. Versuche es erneut.', 'Algo deu errado. Tente de novo.', 'Bir hata oluştu. Tekrar dene.', 'خطایی رخ داد. دوباره امتحان کنید.', 'کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔', 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।', 'Terjadi kesalahan. Coba lagi.', 'エラーが発生しました。もう一度お試しください。', '문제가 발생했습니다. 다시 시도하세요.'],
    ['صار خطأ:', 'Error:', 'Ошибка:', 'त्रुटि:', '错误：', 'Error:', 'Erreur :', 'Fehler:', 'Erro:', 'Hata:', 'خطا:', 'خرابی:', 'ত্রুটি:', 'Kesalahan:', 'エラー：', '오류:'],
    ['رابط المحفظة غير صحيح. الصقه كامل بدون مسافات.', 'Invalid wallet link. Paste it in full, without spaces.', 'Неверная ссылка на кошелёк. Вставьте её целиком, без пробелов.', 'वॉलेट लिंक ग़लत है। इसे बिना स्पेस के पूरा पेस्ट करें।', '钱包链接无效。请完整粘贴，不要带空格。', 'Enlace de billetera no válido. Pégalo completo y sin espacios.', 'Lien de portefeuille invalide. Collez-le en entier, sans espaces.', 'Ungültiger Wallet-Link. Füge ihn vollständig und ohne Leerzeichen ein.', 'Link da carteira inválido. Cole completo, sem espaços.', 'Cüzdan bağlantısı geçersiz. Boşluksuz ve eksiksiz yapıştır.', 'لینک کیف پول نادرست است. آن را کامل و بدون فاصله بچسبانید.', 'والیٹ کا لنک غلط ہے۔ اسے بغیر خالی جگہ کے مکمل پیسٹ کریں۔', 'ওয়ালেটের লিংক সঠিক নয়। ফাঁকা জায়গা ছাড়া পুরোটা পেস্ট করুন।', 'Tautan dompet tidak valid. Tempel secara lengkap tanpa spasi.', 'ウォレットのリンクが正しくありません。スペースなしで全体を貼り付けてください。', '지갑 링크가 올바르지 않습니다. 공백 없이 전체를 붙여넣으세요.'],
    ['رصيدك أقل من الحد المطلوب للسحب.', 'Your balance is below the minimum for withdrawal.', 'Ваш баланс меньше минимальной суммы для вывода.', 'आपका बैलेंस निकासी की न्यूनतम सीमा से कम है।', '你的余额低于最低提现额度。', 'Tu saldo está por debajo del mínimo para retirar.', 'Votre solde est inférieur au minimum de retrait.', 'Dein Guthaben liegt unter dem Mindestbetrag für Auszahlungen.', 'Seu saldo está abaixo do mínimo para saque.', 'Bakiyen çekim için gereken alt sınırın altında.', 'موجودی شما کمتر از حداقل لازم برای برداشت است.', 'آپ کا بیلنس رقم نکالنے کی کم از کم حد سے کم ہے۔', 'আপনার ব্যালেন্স উত্তোলনের ন্যূনতম সীমার নিচে।', 'Saldo Anda di bawah batas minimum penarikan.', '残高が出金の最低額に達していません。', '잔액이 최소 출금 금액보다 적습니다.'],
    ['عندك طلب سحب قيد المراجعة.', 'You already have a withdrawal request under review.', 'У вас уже есть заявка на вывод на рассмотрении.', 'आपका एक निकासी अनुरोध पहले से समीक्षा में है।', '你已有一笔提现申请正在审核中。', 'Ya tienes una solicitud de retiro en revisión.', 'Vous avez déjà une demande de retrait en cours d’examen.', 'Du hast bereits eine Auszahlungsanfrage in Prüfung.', 'Você já tem um pedido de saque em análise.', 'İncelemede olan bir çekim talebin var.', 'یک درخواست برداشت در حال بررسی دارید.', 'آپ کی ایک درخواست پہلے سے زیرِ جائزہ ہے۔', 'আপনার একটি উত্তোলনের অনুরোধ পর্যালোচনায় আছে।', 'Anda sudah punya permintaan penarikan yang sedang ditinjau.', '審査中の出金リクエストがすでにあります。', '검토 중인 출금 요청이 이미 있습니다.'],
    ['طلب السحب مرفوع وقيد المراجعة ✅', 'Withdrawal request submitted and under review ✅', 'Заявка на вывод отправлена и рассматривается ✅', 'निकासी अनुरोध भेज दिया गया है और समीक्षा में है ✅', '提现申请已提交，正在审核 ✅', 'Solicitud de retiro enviada y en revisión ✅', 'Demande de retrait envoyée et en cours d’examen ✅', 'Auszahlungsanfrage eingereicht und in Prüfung ✅', 'Pedido de saque enviado e em análise ✅', 'Çekim talebi gönderildi ve inceleniyor ✅', 'درخواست برداشت ثبت شد و در حال بررسی است ✅', 'رقم نکالنے کی درخواست جمع ہو گئی اور زیرِ جائزہ ہے ✅', 'উত্তোলনের অনুরোধ জমা হয়েছে এবং পর্যালোচনায় আছে ✅', 'Permintaan penarikan terkirim dan sedang ditinjau ✅', '出金リクエストを送信しました。審査中です ✅', '출금 요청이 접수되어 검토 중입니다 ✅'],
    ['تم رفع طلب السحب', 'Withdrawal request submitted', 'Заявка на вывод отправлена', 'निकासी अनुरोध भेज दिया गया', '提现申请已提交', 'Solicitud de retiro enviada', 'Demande de retrait envoyée', 'Auszahlungsanfrage eingereicht', 'Pedido de saque enviado', 'Çekim talebi gönderildi', 'درخواست برداشت ثبت شد', 'رقم نکالنے کی درخواست جمع ہو گئی', 'উত্তোলনের অনুরোধ জমা হয়েছে', 'Permintaan penarikan terkirim', '出金リクエストを送信しました', '출금 요청이 접수되었습니다'],
    ['أكّد الدفع من محفظتك…', 'Confirm the payment in your wallet…', 'Подтвердите оплату в кошельке…', 'अपने वॉलेट में भुगतान की पुष्टि करें…', '请在钱包中确认支付…', 'Confirma el pago en tu billetera…', 'Confirmez le paiement dans votre portefeuille…', 'Zahlung in deiner Wallet bestätigen…', 'Confirme o pagamento na sua carteira…', 'Ödemeyi cüzdanında onayla…', 'پرداخت را در کیف پول خود تأیید کنید…', 'اپنے والیٹ میں ادائیگی کی تصدیق کریں…', 'আপনার ওয়ালেটে পেমেন্ট নিশ্চিত করুন…', 'Konfirmasi pembayaran di dompet Anda…', 'ウォレットで支払いを確認してください…', '지갑에서 결제를 확인하세요…'],
    ['نتحقق من وصول الدفعة…', 'Checking that the payment arrived…', 'Проверяем поступление платежа…', 'भुगतान पहुँचने की जाँच हो रही है…', '正在确认款项是否到账…', 'Comprobando que llegó el pago…', 'Vérification de la réception du paiement…', 'Zahlungseingang wird geprüft…', 'Verificando se o pagamento chegou…', 'Ödemenin ulaştığı kontrol ediliyor…', 'در حال بررسی رسیدن پرداخت…', 'ادائیگی پہنچنے کی جانچ ہو رہی ہے…', 'পেমেন্ট পৌঁছেছে কি না দেখা হচ্ছে…', 'Memeriksa apakah pembayaran sudah masuk…', '入金を確認しています…', '입금 여부를 확인하는 중…'],
    ['قنبلة', 'Bomb', 'Бомба', 'बम', '炸弹', 'Bomba', 'Bombe', 'Bombe', 'Bomba', 'Bomba', 'بمب', 'بم', 'বোমা', 'Bom', '爆弾', '폭탄'],
    ['جوهرة', 'Gem', 'Алмаз', 'रत्न', '宝石', 'Gema', 'Gemme', 'Juwel', 'Gema', 'Mücevher', 'جواهر', 'جوہر', 'রত্ন', 'Permata', '宝石', '보석'],
    ['مربع مغلق', 'Closed tile', 'Закрытая клетка', 'बंद खाना', '未翻开的格子', 'Casilla cerrada', 'Case fermée', 'Geschlossenes Feld', 'Casa fechada', 'Kapalı kare', 'خانه بسته', 'بند خانہ', 'বন্ধ ঘর', 'Kotak tertutup', '閉じたマス', '닫힌 칸'],
    ['💥 خسرت (تجربة)', '💥 You lost (demo)', '💥 Проигрыш (демо)', '💥 आप हार गए (डेमो)', '💥 你输了（试玩）', '💥 Perdiste (demo)', '💥 Perdu (démo)', '💥 Verloren (Demo)', '💥 Você perdeu (demo)', '💥 Kaybettin (deneme)', '💥 باختید (آزمایشی)', '💥 آپ ہار گئے (ڈیمو)', '💥 হেরে গেছেন (ডেমো)', '💥 Anda kalah (demo)', '💥 負け（デモ）', '💥 패배 (체험)'],
    ['💥 خسرت!', '💥 You lost!', '💥 Проигрыш!', '💥 आप हार गए!', '💥 你输了！', '💥 ¡Perdiste!', '💥 Perdu !', '💥 Verloren!', '💥 Você perdeu!', '💥 Kaybettin!', '💥 باختید!', '💥 آپ ہار گئے!', '💥 হেরে গেছেন!', '💥 Anda kalah!', '💥 負け！', '💥 패배!'],
    ['🏆 فزت (تجربة)', '🏆 You won (demo)', '🏆 Победа (демо)', '🏆 आप जीत गए (डेमो)', '🏆 你赢了（试玩）', '🏆 Ganaste (demo)', '🏆 Gagné (démo)', '🏆 Gewonnen (Demo)', '🏆 Você ganhou (demo)', '🏆 Kazandın (deneme)', '🏆 بردید (آزمایشی)', '🏆 آپ جیت گئے (ڈیمو)', '🏆 জিতেছেন (ডেমো)', '🏆 Anda menang (demo)', '🏆 勝ち（デモ）', '🏆 승리 (체험)'],
    ['🏆 فزت!', '🏆 You won!', '🏆 Победа!', '🏆 आप जीत गए!', '🏆 你赢了！', '🏆 ¡Ganaste!', '🏆 Gagné !', '🏆 Gewonnen!', '🏆 Você ganhou!', '🏆 Kazandın!', '🏆 بردید!', '🏆 آپ جیت گئے!', '🏆 জিতেছেন!', '🏆 Anda menang!', '🏆 勝ち！', '🏆 승리!'],
    ['تجربة: ما تنحسب', 'Demo: doesn’t count', 'Демо: не засчитывается', 'डेमो: गिना नहीं जाएगा', '试玩：不计分', 'Demo: no cuenta', 'Démo : ne compte pas', 'Demo: zählt nicht', 'Demo: não conta', 'Deneme: sayılmaz', 'آزمایشی: حساب نمی‌شود', 'ڈیمو: شمار نہیں ہوتا', 'ডেমো: গণনা হয় না', 'Demo: tidak dihitung', 'デモ：カウントされません', '체험: 반영되지 않음'],
    ['✅ جمعت', '✅ Collected', '✅ Собрано', '✅ इकट्ठा किया', '✅ 已收取', '✅ Cobrado', '✅ Encaissé', '✅ Eingesammelt', '✅ Coletado', '✅ Toplandı', '✅ جمع شد', '✅ جمع ہو گیا', '✅ সংগ্রহ হয়েছে', '✅ Terkumpul', '✅ 回収', '✅ 수령'],
    ['كمّل أو اجمع', 'Keep going or collect', 'Продолжайте или заберите', 'आगे बढ़ें या इकट्ठा करें', '继续或收取', 'Sigue o cobra', 'Continuez ou encaissez', 'Weiter oder einsammeln', 'Continue ou colete', 'Devam et ya da topla', 'ادامه بده یا جمع کن', 'جاری رکھیں یا جمع کریں', 'চালিয়ে যান বা সংগ্রহ করুন', 'Lanjut atau ambil', '続けるか回収', '계속하거나 수령하세요'],
    ['جولة مجانية: اختر مربع', 'Free round: pick a tile', 'Бесплатный раунд: выберите клетку', 'मुफ़्त राउंड: एक खाना चुनें', '免费局：选择一个格子', 'Ronda gratis: elige una casilla', 'Manche gratuite : choisissez une case', 'Gratisrunde: Wähle ein Feld', 'Rodada grátis: escolha uma casa', 'Ücretsiz tur: bir kare seç', 'دور رایگان: یک خانه انتخاب کنید', 'مفت راؤنڈ: ایک خانہ چنیں', 'ফ্রি রাউন্ড: একটি ঘর বেছে নিন', 'Ronde gratis: pilih satu kotak', '無料ラウンド：マスを選んでください', '무료 라운드: 칸을 선택하세요'],
    ['تجربة: اختر مربع', 'Demo: pick a tile', 'Демо: выберите клетку', 'डेमो: एक खाना चुनें', '试玩：选择一个格子', 'Demo: elige una casilla', 'Démo : choisissez une case', 'Demo: Wähle ein Feld', 'Demo: escolha uma casa', 'Deneme: bir kare seç', 'آزمایشی: یک خانه انتخاب کنید', 'ڈیمو: ایک خانہ چنیں', 'ডেমো: একটি ঘর বেছে নিন', 'Demo: pilih satu kotak', 'デモ：マスを選んでください', '체험: 칸을 선택하세요'],
    ['وصلت العملية للشبكة، ننتظر تأكيدها. ياخذ عادةً أقل من دقيقة.', 'The transaction reached the network and is awaiting confirmation. This usually takes less than a minute.', 'Транзакция дошла до сети, ждём подтверждения. Обычно это занимает меньше минуты.', 'लेन-देन नेटवर्क तक पहुँच गया है, पुष्टि का इंतज़ार है। आम तौर पर एक मिनट से कम लगता है।', '交易已到达网络，正在等待确认。通常不到一分钟。', 'La transacción llegó a la red y espera confirmación. Suele tardar menos de un minuto.', 'La transaction a atteint le réseau et attend sa confirmation. Cela prend généralement moins d’une minute.', 'Die Transaktion ist im Netzwerk angekommen und wartet auf Bestätigung. Das dauert meist weniger als eine Minute.', 'A transação chegou à rede e aguarda confirmação. Costuma levar menos de um minuto.', 'İşlem ağa ulaştı, onay bekleniyor. Genellikle bir dakikadan kısa sürer.', 'تراکنش به شبکه رسید و منتظر تأیید است. معمولاً کمتر از یک دقیقه طول می‌کشد.', 'ٹرانزیکشن نیٹ ورک تک پہنچ گئی ہے، تصدیق کا انتظار ہے۔ عموماً ایک منٹ سے کم لگتا ہے۔', 'লেনদেন নেটওয়ার্কে পৌঁছেছে, নিশ্চিতকরণের অপেক্ষায়। সাধারণত এক মিনিটের কম লাগে।', 'Transaksi sudah sampai di jaringan dan menunggu konfirmasi. Biasanya kurang dari satu menit.', '取引がネットワークに届き、承認待ちです。通常 1 分以内に完了します。', '거래가 네트워크에 도착해 확인을 기다리는 중입니다. 보통 1분 이내에 완료됩니다.'],
    ['ما تأكدت الدفعة للحين. لو دفعت فعلًا، اضغط «لعبة جديدة» بعد شوي وبتكمل بدون دفع ثاني.', 'The payment isn’t confirmed yet. If you did pay, tap “New game” in a moment and it will continue without a second payment.', 'Платёж пока не подтверждён. Если вы действительно заплатили, нажмите «Новая игра» чуть позже — игра продолжится без повторной оплаты.', 'भुगतान की अभी पुष्टि नहीं हुई है। अगर आपने सच में भुगतान किया है, तो थोड़ी देर बाद “नया गेम” दबाएँ, बिना दोबारा भुगतान के आगे बढ़ेगा।', '款项尚未确认。如果你确实已支付，请稍后点击“新游戏”，无需再次付款即可继续。', 'El pago aún no está confirmado. Si de verdad pagaste, toca «Nueva partida» en un momento y continuará sin pagar otra vez.', 'Le paiement n’est pas encore confirmé. Si vous avez bien payé, appuyez sur « Nouvelle partie » dans un instant : la partie continuera sans second paiement.', 'Die Zahlung ist noch nicht bestätigt. Wenn du wirklich bezahlt hast, tippe gleich auf „Neues Spiel“ – es geht ohne zweite Zahlung weiter.', 'O pagamento ainda não foi confirmado. Se você pagou mesmo, toque em “Novo jogo” daqui a pouco e ele continua sem pagar de novo.', 'Ödeme henüz onaylanmadı. Gerçekten ödediysen birazdan “Yeni oyun”a dokun; ikinci bir ödeme olmadan devam eder.', 'پرداخت هنوز تأیید نشده است. اگر واقعاً پرداخت کرده‌اید، کمی بعد «بازی جدید» را بزنید تا بدون پرداخت دوباره ادامه پیدا کند.', 'ادائیگی کی ابھی تصدیق نہیں ہوئی۔ اگر آپ نے واقعی ادائیگی کی ہے تو تھوڑی دیر بعد «نیا گیم» دبائیں، دوبارہ ادائیگی کے بغیر جاری رہے گا۔', 'পেমেন্ট এখনো নিশ্চিত হয়নি। সত্যিই পেমেন্ট করে থাকলে একটু পরে “নতুন গেম” চাপুন, দ্বিতীয়বার পেমেন্ট ছাড়াই চলবে।', 'Pembayaran belum terkonfirmasi. Jika Anda memang sudah membayar, ketuk “Game baru” sebentar lagi dan permainan lanjut tanpa bayar dua kali.', '支払いはまだ確認されていません。支払い済みの場合は、少ししてから「新しいゲーム」をタップすると、再度支払うことなく続行できます。', '결제가 아직 확인되지 않았습니다. 실제로 결제했다면 잠시 후 “새 게임”을 누르세요. 다시 결제하지 않고 계속됩니다.'],
    ['ما تحمّلت المحفظة. أعد فتح التطبيق.', 'The wallet didn’t load. Reopen the app.', 'Кошелёк не загрузился. Откройте приложение заново.', 'वॉलेट लोड नहीं हुआ। ऐप दोबारा खोलें।', '钱包未加载。请重新打开应用。', 'La billetera no se cargó. Vuelve a abrir la app.', 'Le portefeuille ne s’est pas chargé. Rouvrez l’application.', 'Die Wallet wurde nicht geladen. Öffne die App erneut.', 'A carteira não carregou. Abra o app novamente.', 'Cüzdan yüklenmedi. Uygulamayı yeniden aç.', 'کیف پول بارگذاری نشد. برنامه را دوباره باز کنید.', 'والیٹ لوڈ نہیں ہوا۔ ایپ دوبارہ کھولیں۔', 'ওয়ালেট লোড হয়নি। অ্যাপটি আবার খুলুন।', 'Dompet tidak termuat. Buka kembali aplikasi.', 'ウォレットを読み込めませんでした。アプリを開き直してください。', '지갑을 불러오지 못했습니다. 앱을 다시 열어 주세요.'],
    [GRANTED, 'You got {0} free rounds 🎁', 'Вам начислено бесплатных раундов: {0} 🎁', 'आपको {0} मुफ़्त राउंड मिले 🎁', '你获得了 {0} 局免费游戏 🎁', 'Recibiste {0} rondas gratis 🎁', 'Vous avez reçu {0} manches gratuites 🎁', 'Du hast {0} Gratisrunden erhalten 🎁', 'Você ganhou {0} rodadas grátis 🎁', '{0} ücretsiz tur kazandın 🎁', '{0} دور رایگان گرفتید 🎁', 'آپ کو {0} مفت راؤنڈ ملے 🎁', 'আপনি {0}টি ফ্রি রাউন্ড পেয়েছেন 🎁', 'Anda mendapat {0} ronde gratis 🎁', '無料ラウンドを {0} 回獲得しました 🎁', '무료 라운드 {0}회를 받았습니다 🎁'],
    ['العب مجانًا', 'Play for free', 'Играть бесплатно', 'मुफ़्त खेलें', '免费玩', 'Jugar gratis', 'Jouer gratuitement', 'Gratis spielen', 'Jogar grátis', 'Ücretsiz oyna', 'رایگان بازی کن', 'مفت کھیلیں', 'ফ্রি খেলুন', 'Main gratis', '無料でプレイ', '무료로 플레이'],
    ['افتح', 'Open', 'Открыть', 'खोलें', '打开', 'Abrir', 'Ouvrir', 'Öffnen', 'Abrir', 'Aç', 'باز کردن', 'کھولیں', 'খুলুন', 'Buka', '開く', '열기'],
    ['إخفاء', 'Hide', 'Скрыть', 'छिपाएँ', '隐藏', 'Ocultar', 'Masquer', 'Ausblenden', 'Ocultar', 'Gizle', 'پنهان کردن', 'چھپائیں', 'লুকান', 'Sembunyikan', '非表示', '숨기기'],
    ['ابدأ جولة', 'Start a round', 'Начните раунд', 'राउंड शुरू करें', '开始一局', 'Empieza una ronda', 'Lancez une manche', 'Starte eine Runde', 'Comece uma rodada', 'Bir tur başlat', 'یک دور شروع کنید', 'راؤنڈ شروع کریں', 'একটি রাউন্ড শুরু করুন', 'Mulai ronde', 'ラウンドを開始', '라운드를 시작하세요'],
    ['غير متاحة', 'Unavailable', 'Недоступно', 'उपलब्ध नहीं', '暂不可用', 'No disponible', 'Indisponible', 'Nicht verfügbar', 'Indisponível', 'Kullanılamıyor', 'در دسترس نیست', 'دستیاب نہیں', 'উপলব্ধ নয়', 'Tidak tersedia', '利用できません', '이용 불가'],
    ['جرّب اللعبة', 'Try the game', 'Попробуйте игру', 'गेम आज़माएँ', '试玩游戏', 'Prueba el juego', 'Essayez le jeu', 'Probiere das Spiel', 'Experimente o jogo', 'Oyunu dene', 'بازی را امتحان کنید', 'گیم آزمائیں', 'গেমটি চেষ্টা করুন', 'Coba gamenya', 'ゲームを試す', '게임 체험하기'],
    ['جاري الاتصال…', 'Connecting…', 'Подключение…', 'कनेक्ट हो रहा है…', '连接中…', 'Conectando…', 'Connexion…', 'Verbinde…', 'Conectando…', 'Bağlanıyor…', 'در حال اتصال…', 'رابطہ ہو رہا ہے…', 'সংযোগ হচ্ছে…', 'Menghubungkan…', '接続中…', '연결 중…']
  ];

  /* ---------- lookup tables ---------- */

  var bySource = Object.create(null);   // Arabic source -> row
  var byOutput = Object.create(null);   // any translation -> Arabic source
  var prefixes = [];                    // sources usable as a prefix, longest first
  D.forEach(function (row) {
    bySource[row[0]] = row;
    if (row[0].indexOf('{0}') === -1) prefixes.push(row[0]);
  });
  D.forEach(function (row) {
    for (var i = 1; i < row.length; i++) {
      if (!bySource[row[i]] && !byOutput[row[i]]) byOutput[row[i]] = row[0];
    }
  });
  prefixes.sort(function (a, b) { return b.length - a.length; });

  var TEMPLATES = [
    { re: /^أهلًا (.+)$/, key: HELLO },
    { re: /^انضافت لك (.+) جولة مجانية 🎁$/, key: GRANTED }
  ];

  var li = 0; // index of the current language in CODES

  function cell(row) { return row[li] || row[1] || row[0]; }

  /** Arabic source text -> text in the current language, or null if unknown. */
  function render(src) {
    var row = bySource[src];
    if (row) return cell(row);
    if (!ARABIC.test(src)) return null;
    for (var t = 0; t < TEMPLATES.length; t++) {
      var m = TEMPLATES[t].re.exec(src);
      if (m) return cell(bySource[TEMPLATES[t].key]).replace('{0}', m[1]);
    }
    // "<known text><numbers/symbols>", e.g. "لعبة جديدة · 0.5 TON"
    for (var p = 0; p < prefixes.length; p++) {
      var s = prefixes[p];
      if (src.length > s.length && src.lastIndexOf(s, 0) === 0) {
        var rest = src.slice(s.length);
        if (!ARABIC.test(rest)) return cell(bySource[s]) + rest;
      }
    }
    return null;
  }

  function resolve(text) { return bySource[text] ? text : (byOutput[text] || text); }

  /* ---------- DOM translation ---------- */

  var textMemo = typeof WeakMap === 'function' ? new WeakMap() : null;
  var attrMemo = typeof WeakMap === 'function' ? new WeakMap() : null;

  function skipped(el) {
    return !el || el.nodeType !== 1 || (el.closest && el.closest(SKIP));
  }

  function translateText(node) {
    if (skipped(node.parentNode)) return;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(node.nodeValue || '');
    var core = m[2];
    if (!core) return;
    var memo = textMemo.get(node);
    var src = memo && memo.out === core ? memo.src : resolve(core);
    var out = render(src);
    if (out == null) { textMemo.delete(node); return; }
    textMemo.set(node, { src: src, out: out });
    if (out !== core) node.nodeValue = m[1] + out + m[3];
  }

  function translateAttr(el, name) {
    if (skipped(el)) return;
    var value = el.getAttribute(name);
    if (!value) return;
    var memo = attrMemo.get(el);
    var rec = memo && memo[name];
    var src = rec && rec.out === value ? rec.src : resolve(value);
    var out = render(src);
    if (out == null) return;
    if (!memo) { memo = {}; attrMemo.set(el, memo); }
    memo[name] = { src: src, out: out };
    if (out !== value) el.setAttribute(name, out);
  }

  function translateElement(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      if (el.hasAttribute(ATTRS[i])) translateAttr(el, ATTRS[i]);
    }
  }

  function translateTree(root) {
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1) return;
    if (root.closest && root.closest(SKIP)) return;
    translateElement(root);
    var walker = doc.createTreeWalker(root, 5 /* SHOW_ELEMENT | SHOW_TEXT */, null);
    var n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) translateText(n); else translateElement(n);
    }
  }

  function onMutations(list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === 'characterData') translateText(m.target);
      else if (m.type === 'attributes') translateAttr(m.target, m.attributeName);
      else for (var j = 0; j < m.addedNodes.length; j++) translateTree(m.addedNodes[j]);
    }
  }

  /* ---------- language state ---------- */

  function normalize(code) {
    if (!code) return -1;
    return CODES.indexOf(String(code).toLowerCase().split(/[-_]/)[0]);
  }

  function detect() {
    var list = [];
    try { list.push(global.localStorage.getItem(STORAGE_KEY)); } catch (e) {}
    try { list.push(global.Telegram.WebApp.initDataUnsafe.user.language_code); } catch (e) {}
    var nav = global.navigator || {};
    list = list.concat(nav.languages || [], [nav.language]);
    for (var i = 0; i < list.length; i++) {
      var hit = normalize(list[i]);
      if (hit !== -1) return hit;
    }
    return 0; // Arabic, the app's native language
  }

  function applyDirection() {
    var code = CODES[li];
    var root = doc.documentElement;
    root.lang = code;
    root.dir = RTL[code] ? 'rtl' : 'ltr';
    // The owner panel is not translated, so it stays Arabic and right-to-left.
    ['viewAdmin', 'adminSheet'].forEach(function (id) {
      var el = doc.getElementById(id);
      if (el) { el.lang = 'ar'; el.dir = 'rtl'; }
    });
  }

  function set(code, silent) {
    var next = normalize(code);
    if (next === -1) return false;
    li = next;
    if (!silent) { try { global.localStorage.setItem(STORAGE_KEY, CODES[li]); } catch (e) {} }
    if (doc) {
      applyDirection();
      translateTree(doc.body);
      refreshPicker();
    }
    return true;
  }

  /* ---------- language picker ---------- */

  var GLOBE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3Z"/></svg>';

  var CSS =
    '.luo-lang-btn{flex:0 0 auto;margin-inline-start:auto;height:38px;padding:0 10px;display:inline-flex;align-items:center;gap:6px;' +
    'border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.16));background:var(--surface-2,rgba(255,255,255,.08));' +
    'color:var(--accent,#e7c57e);font:inherit;font-size:12px;font-weight:700;letter-spacing:.04em;cursor:pointer;' +
    '-webkit-tap-highlight-color:transparent;transition:transform .12s ease,border-color .15s ease}' +
    '.luo-lang-btn:active{transform:scale(.94)}' +
    '.luo-lang-btn:focus-visible{outline:2px solid var(--accent,#e7c57e);outline-offset:2px}' +
    '.luo-lang-back{position:fixed;inset:0;z-index:900;display:flex;align-items:flex-end;justify-content:center;' +
    'background:rgba(0,0,0,.55);opacity:0;visibility:hidden;transition:opacity .18s ease,visibility 0s linear .18s}' +
    '.luo-lang-back.is-open{opacity:1;visibility:visible;transition:opacity .18s ease}' +
    '.luo-lang-sheet{width:100%;max-width:520px;max-height:82vh;display:flex;flex-direction:column;box-sizing:border-box;' +
    'padding:10px 16px calc(16px + var(--safe-bottom,0px));border-radius:22px 22px 0 0;' +
    'background:var(--surface,#1a1020);color:var(--text,#fff);border:1px solid var(--line,rgba(255,255,255,.16));border-bottom:0;' +
    'box-shadow:0 -18px 50px rgba(0,0,0,.45);transform:translateY(24px);transition:transform .2s cubic-bezier(.2,.8,.2,1)}' +
    '.luo-lang-back.is-open .luo-lang-sheet{transform:none}' +
    '.luo-lang-grip{width:40px;height:4px;border-radius:4px;margin:0 auto 10px;background:var(--line,rgba(255,255,255,.25))}' +
    '.luo-lang-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}' +
    '.luo-lang-title{display:flex;align-items:center;gap:8px;margin:0;font-size:18px;font-weight:700;color:var(--accent,#e7c57e)}' +
    '.luo-lang-x{width:34px;height:34px;border-radius:50%;border:0;background:var(--surface-2,rgba(255,255,255,.08));' +
    'color:inherit;font-size:20px;line-height:1;cursor:pointer}' +
    '.luo-lang-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}' +
    '.luo-lang-opt{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:50px;padding:0 14px;' +
    'border-radius:14px;border:1px solid var(--line,rgba(255,255,255,.14));background:var(--surface-2,rgba(255,255,255,.06));' +
    'color:inherit;font:inherit;font-size:16px;cursor:pointer;text-align:start;-webkit-tap-highlight-color:transparent;' +
    'transition:transform .1s ease,border-color .12s ease,background .12s ease}' +
    '.luo-lang-opt:active{transform:scale(.97)}' +
    '.luo-lang-opt small{font-size:11px;font-weight:700;letter-spacing:.06em;opacity:.6;text-transform:uppercase}' +
    '.luo-lang-opt[aria-checked="true"]{border-color:var(--accent,#e7c57e);color:var(--accent,#e7c57e);' +
    'box-shadow:inset 0 0 0 1px var(--accent,#e7c57e)}' +
    '.luo-lang-opt[aria-checked="true"] small{opacity:1}' +
    '.luo-lang-opt[aria-checked="true"] small::before{content:"\\2713\\00a0"}' +
    '@media (prefers-reduced-motion:reduce){.luo-lang-back,.luo-lang-sheet,.luo-lang-btn,.luo-lang-opt{transition:none}}';

  var ui = null;

  function haptic() {
    try { global.Telegram.WebApp.HapticFeedback.selectionChanged(); } catch (e) {}
  }

  function el(tag, cls, attrs) {
    var node = doc.createElement(tag);
    if (cls) node.className = cls;
    for (var k in attrs || {}) node.setAttribute(k, attrs[k]);
    return node;
  }

  function buildPicker() {
    var style = el('style');
    style.textContent = CSS;
    doc.head.appendChild(style);

    var btn = el('button', 'luo-lang-btn', { type: 'button', id: 'luoLangBtn', 'data-no-i18n': '', 'aria-haspopup': 'dialog' });
    btn.innerHTML = GLOBE + '<span></span>';

    var back = el('div', 'luo-lang-back', { 'data-no-i18n': '', 'aria-hidden': 'true' });
    var sheet = el('div', 'luo-lang-sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'luoLangTitle' });
    var head = el('div', 'luo-lang-head');
    var title = el('h2', 'luo-lang-title', { id: 'luoLangTitle' });
    title.innerHTML = GLOBE + '<span></span>';
    var close = el('button', 'luo-lang-x', { type: 'button' });
    close.textContent = '×';
    var grid = el('div', 'luo-lang-grid', { role: 'radiogroup' });

    var opts = CODES.map(function (code, i) {
      var o = el('button', 'luo-lang-opt', { type: 'button', role: 'radio', lang: code, dir: RTL[code] ? 'rtl' : 'ltr', 'data-lang': code });
      var name = el('span');
      name.textContent = NAMES[i];
      var tag = el('small', null, { dir: 'ltr' });
      tag.textContent = code;
      o.appendChild(name);
      o.appendChild(tag);
      grid.appendChild(o);
      return o;
    });

    head.appendChild(title);
    head.appendChild(close);
    sheet.appendChild(el('div', 'luo-lang-grip'));
    sheet.appendChild(head);
    sheet.appendChild(grid);
    back.appendChild(sheet);
    doc.body.appendChild(back);

    var bar = doc.querySelector('.topbar');
    var anchor = doc.getElementById('ton-connect');
    if (bar && anchor && anchor.parentNode === bar) bar.insertBefore(btn, anchor);
    else if (bar) bar.appendChild(btn);
    else {
      btn.style.cssText = 'position:fixed;top:calc(10px + var(--safe-top,0px));inset-inline-end:12px;z-index:800';
      doc.body.appendChild(btn);
    }

    btn.addEventListener('click', openPicker);
    close.addEventListener('click', closePicker);
    back.addEventListener('click', function (e) { if (e.target === back) closePicker(); });
    grid.addEventListener('click', function (e) {
      var o = e.target.closest ? e.target.closest('.luo-lang-opt') : null;
      if (!o) return;
      haptic();
      set(o.getAttribute('data-lang'));
      global.setTimeout(closePicker, 140);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && back.classList.contains('is-open')) closePicker();
    });

    ui = { btn: btn, back: back, opts: opts, close: close, btnLabel: btn.lastChild, title: title.lastChild };
    refreshPicker();
  }

  function refreshPicker() {
    if (!ui) return;
    var label = cell(bySource[LANG_TITLE]);
    ui.btnLabel.textContent = CODES[li].toUpperCase();
    ui.btn.setAttribute('aria-label', label + ': ' + NAMES[li]);
    ui.title.textContent = label;
    ui.close.setAttribute('aria-label', cell(bySource['إغلاق']));
    ui.opts.forEach(function (o, i) {
      o.setAttribute('aria-checked', i === li ? 'true' : 'false');
    });
  }

  function openPicker() {
    if (!ui) return;
    haptic();
    ui.back.classList.add('is-open');
    ui.back.setAttribute('aria-hidden', 'false');
    var current = ui.opts[li];
    if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });
  }

  function closePicker() {
    if (!ui) return;
    ui.back.classList.remove('is-open');
    ui.back.setAttribute('aria-hidden', 'true');
  }

  /* ---------- start ---------- */

  li = detect();

  global.LUO_I18N = {
    set: function (code) { return set(code); },
    open: openPicker,
    close: closePicker,
    t: function (src) { var out = render(src); return out == null ? src : out; },
    codes: CODES.slice(),
    names: NAMES.slice(),
    get lang() { return CODES[li]; },
    get isRTL() { return !!RTL[CODES[li]]; }
  };

  function start() {
    if (!textMemo || typeof global.MutationObserver !== 'function') return; // very old browser: stay Arabic
    buildPicker();
    applyDirection();
    translateTree(doc.body);
    new global.MutationObserver(onMutations).observe(doc.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS
    });
  }

  if (doc) {
    if (doc.body) start();
    else doc.addEventListener('DOMContentLoaded', start);
  }
})(typeof window !== 'undefined' ? window : globalThis);
