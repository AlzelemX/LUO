/*
 * منطق المحفظة الخالص (بدون واجهة) — يشتغل في المتصفح وفي Node للاختبار.
 * كل المبالغ BigInt بأصغر وحدة للعملة؛ ما فيه أي حساب بأرقام عشرية عائمة.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory;
  } else {
    root.LuoLib = factory(root.TonWeb);
  }
})(typeof self !== "undefined" ? self : this, function (TonWeb) {
  "use strict";

  var Address = TonWeb.utils.Address;
  var BN = TonWeb.utils.BN;

  var JETTON_TRANSFER_OP = 0x0f8a7ea5; // TEP-74 transfer
  var JETTON_GAS_NANO = 50000000n; // 0.05 TON مرفقة لرسوم تحويل الجيتون (الزائد يرجع)
  var TON_FEE_RESERVE_NANO = 10000000n; // 0.01 TON احتياط لرسوم تحويل TON

  function fail(code) {
    var e = new Error(code);
    e.code = code;
    return e;
  }

  // يحوّل الأرقام العربية/الفارسية والفواصل إلى صيغة 123.45
  function normalizeNumber(input) {
    return String(input == null ? "" : input)
      .trim()
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06f0); })
      .replace(/[٫,]/g, ".")
      .replace(/[\s٬]/g, "");
  }

  // "1.5" + 9 خانات => 1500000000n
  function parseAmount(input, decimals) {
    var s = normalizeNumber(input);
    if (s === "") throw fail("AMOUNT_EMPTY");
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) throw fail("AMOUNT_INVALID");
    var parts = s.split(".");
    var whole = parts[0] || "0";
    var frac = parts[1] || "";
    if (frac.length > decimals) throw fail("AMOUNT_TOO_PRECISE");
    while (frac.length < decimals) frac += "0";
    var units = BigInt(whole + frac);
    if (units <= 0n) throw fail("AMOUNT_ZERO");
    return units;
  }

  // 1500000000n + 9 خانات => "1.5" (يقصّ ولا يقرّب)
  function formatUnits(units, decimals, maxFraction) {
    var u = BigInt(units);
    var negative = u < 0n;
    if (negative) u = -u;
    var s = u.toString();
    while (s.length <= decimals) s = "0" + s;
    var whole = s.slice(0, s.length - decimals);
    var frac = decimals > 0 ? s.slice(s.length - decimals) : "";
    if (typeof maxFraction === "number" && frac.length > maxFraction) frac = frac.slice(0, maxFraction);
    frac = frac.replace(/0+$/, "");
    return (negative ? "-" : "") + whole + (frac ? "." + frac : "");
  }

  function parseAddress(input) {
    var s = String(input == null ? "" : input).trim();
    if (!s) return null;
    try {
      var a = new Address(s);
      if (!a.hashPart || a.hashPart.length !== 32) return null;
      if (a.wc !== 0 && a.wc !== -1) return null;
      return a;
    } catch (e) {
      return null;
    }
  }

  function toFriendly(address, bounceable) {
    var a = address instanceof Address ? address : new Address(address);
    return a.toString(true, true, Boolean(bounceable), false);
  }

  function toRaw(address) {
    var a = address instanceof Address ? address : new Address(address);
    return a.toString(false).toLowerCase();
  }

  function sameAddress(a, b) {
    var pa = parseAddress(a);
    var pb = parseAddress(b);
    return Boolean(pa && pb && toRaw(pa) === toRaw(pb));
  }

  // جسم رسالة تحويل الجيتون حسب TEP-74، يرجع base64 BOC
  async function buildJettonTransferPayload(opts) {
    var cell = new TonWeb.boc.Cell();
    cell.bits.writeUint(JETTON_TRANSFER_OP, 32);
    cell.bits.writeUint(0, 64); // query_id
    cell.bits.writeCoins(new BN(BigInt(opts.amount).toString()));
    cell.bits.writeAddress(new Address(opts.to)); // المستلم
    cell.bits.writeAddress(new Address(opts.responseTo)); // يرجع له باقي الرسوم
    cell.bits.writeBit(false); // بدون custom_payload
    cell.bits.writeCoins(new BN(1)); // forward_ton_amount: 1 نانو لإشعار المستلم
    cell.bits.writeBit(false); // forward_payload فاضي
    var boc = await cell.toBoc(false);
    return TonWeb.utils.bytesToBase64(boc);
  }

  /*
   * يبني طلب TON Connect للتحويل.
   * coin: { kind: "ton" | "jetton", decimals }
   * state: { tonBalance: BigInt, coinBalance: BigInt, jettonWallet: string|null, sender: string }
   */
  async function buildTransfer(coin, state, toInput, amountInput, nowSeconds) {
    var to = parseAddress(toInput);
    if (!to) throw fail("ADDRESS_INVALID");
    if (sameAddress(to, state.sender)) throw fail("ADDRESS_SELF");

    var amount = parseAmount(amountInput, coin.decimals);
    var message;

    if (coin.kind === "ton") {
      if (amount + TON_FEE_RESERVE_NANO > state.tonBalance) throw fail("BALANCE_LOW");
      message = { address: toFriendly(to, false), amount: amount.toString() };
    } else {
      if (!state.jettonWallet) throw fail("BALANCE_LOW");
      if (amount > state.coinBalance) throw fail("BALANCE_LOW");
      if (state.tonBalance < JETTON_GAS_NANO) throw fail("GAS_LOW");
      message = {
        address: toFriendly(state.jettonWallet, true),
        amount: JETTON_GAS_NANO.toString(),
        payload: await buildJettonTransferPayload({
          amount: amount,
          to: toRaw(to),
          responseTo: state.sender
        })
      };
    }

    return {
      amount: amount,
      request: {
        validUntil: nowSeconds + 300,
        network: "-239",
        messages: [message]
      }
    };
  }

  return {
    JETTON_GAS_NANO: JETTON_GAS_NANO,
    TON_FEE_RESERVE_NANO: TON_FEE_RESERVE_NANO,
    normalizeNumber: normalizeNumber,
    parseAmount: parseAmount,
    formatUnits: formatUnits,
    parseAddress: parseAddress,
    toFriendly: toFriendly,
    toRaw: toRaw,
    sameAddress: sameAddress,
    buildJettonTransferPayload: buildJettonTransferPayload,
    buildTransfer: buildTransfer
  };
});
