/**
 * upgradeSapContent.ts — رفع باگ متادیتای SAP jetton بدون از دست دادن state
 *
 * باگ: تابع قدیمی jettonContent() فلگ on-chain (0x00) رو داخل یه ref
 * می‌نوشت نه روی خود سلول content — طبق TEP-64 سلول content باید با
 * این فلگ شروع بشه. نتیجه: سلول content هیچ بیتی نداشت و هر ولت/indexer
 * که می‌خواست متادیتای SAP رو بخونه (اسم/دسیمال) throw می‌کرد — همین
 * باعث خطای "Unhandled error [TON_CONNECT_SDK_ERROR]" موقع plant/repair
 * توی ولت‌هایی مثل MyTonWallet می‌شد.
 *
 * این اسکریپت دو پیام به آدرس فعلی SAPJettonMaster می‌فرسته:
 *   1. UpgradeContract (SETCODE) — کد جدید که receiver SetContent داره
 *   2. SetContent — سلول content درست (فرمت استاندارد TEP-64 dictionary)
 * آدرس قرارداد و موجودی/آدرس SAP wallet همه‌ی کاربرا دست‌نخورده می‌مونه.
 *
 * اجرا: npx ts-node scripts/upgradeSapContent.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.testnet") });

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
if (proxyUrl) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const { setGlobalDispatcher, ProxyAgent } = require("undici") as any;
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

import { mnemonicToPrivateKey } from "@ton/crypto";
import {
  WalletContractV4, toNano, internal,
  beginCell, SendMode, external, storeMessage, Cell, Dictionary,
} from "@ton/ton";
import { Address } from "@ton/core";
import { createHash } from "crypto";
import * as fs from "fs";
import deployed from "../../deployed.json";

const API   = "https://testnet.tonapi.io/v2";
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function apiGet(p: string) {
  const res = await fetch(`${API}${p}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${p} → ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function getSeqno(addr: Address): Promise<number> {
  try {
    const d = await apiGet(`/blockchain/accounts/${addr.toRawString()}/methods/seqno`);
    if (!d.success) return 0;
    const stack = d.stack as Array<{ type: string; num: string }>;
    return parseInt(stack[0].num, 16);
  } catch { return 0; }
}

async function broadcast(boc: string) {
  const res = await fetch(`${API}/blockchain/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boc }),
  });
  if (!res.ok) throw new Error(`Broadcast failed ${res.status}: ${await res.text()}`);
}

async function waitSeqno(addr: Address, from: number, label: string) {
  console.log(`\n⏳  در انتظار تأیید ${label}...`);
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const seqno = await getSeqno(addr);
    if (seqno > from) { console.log(`✅  ${label} تأیید شد`); return seqno; }
    process.stdout.write(".");
  }
  throw new Error(`seqno برای ${label} تغییر نکرد`);
}

/* ── محتوای درست TEP-64 (dictionary) ────────────────────────────── */
function snakeCell(value: string): Cell {
  return beginCell().storeUint(0x00, 8).storeBuffer(Buffer.from(value, "utf8")).endCell();
}
function attrKey(name: string): bigint {
  return BigInt("0x" + createHash("sha256").update(name).digest("hex"));
}
function jettonContent(name: string, symbol: string): Cell {
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  dict.set(attrKey("name"), snakeCell(name));
  dict.set(attrKey("symbol"), snakeCell(symbol));
  dict.set(attrKey("decimals"), snakeCell("9"));
  dict.set(attrKey("description"), snakeCell("Lumoria game token"));
  return beginCell().storeUint(0x00, 8).storeDict(dict).endCell();
}

async function main() {
  const codePath = path.resolve(__dirname, "../build/SAP/SAPJettonMaster_SAPJettonMaster.code.boc");
  if (!fs.existsSync(codePath)) {
    console.error("❌ فایل build/SAP/SAPJettonMaster_SAPJettonMaster.code.boc یافت نشد");
    console.error("   ابتدا: npm run build");
    process.exit(1);
  }
  const newCode = Cell.fromBoc(fs.readFileSync(codePath))[0];

  const mnemonicStr = process.env.WALLET_MNEMONIC;
  if (!mnemonicStr) { console.error("❌ WALLET_MNEMONIC یافت نشد"); process.exit(1); }

  const keys   = await mnemonicToPrivateKey(mnemonicStr.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ publicKey: keys.publicKey, workchain: 0 });
  const sapAddr = Address.parse(deployed.contracts.SAPJettonMaster);

  console.log(`\n🔄  SAPJettonMaster Content Upgrade`);
  console.log(`    Contract: ${sapAddr.toString()}`);
  console.log(`    New code: ${codePath}`);

  /* ── مرحله ۱: UpgradeContract (SETCODE) ─────────────────────── */
  let seqno = await getSeqno(wallet.address);
  const upgradeBody = beginCell()
    .storeUint(0x9e025572, 32)
    .storeRef(newCode)
    .endCell();

  let transfer = wallet.createTransfer({
    seqno,
    secretKey: keys.secretKey,
    messages: [internal({ to: sapAddr, value: toNano("0.1"), body: upgradeBody })],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });
  let boc = beginCell().store(storeMessage(external({ to: wallet.address, body: transfer }))).endCell()
    .toBoc().toString("base64");
  await broadcast(boc);
  seqno = await waitSeqno(wallet.address, seqno, "UpgradeContract");

  /* ── مرحله ۲: SetContent (opcode 0x2005) با محتوای درست ─────── */
  const content = jettonContent("Lumen Sap", "SAP");
  const setContentBody = beginCell()
    .storeUint(0x2005, 32)
    .storeRef(content)
    .endCell();

  transfer = wallet.createTransfer({
    seqno,
    secretKey: keys.secretKey,
    messages: [internal({ to: sapAddr, value: toNano("0.05"), body: setContentBody })],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });
  boc = beginCell().store(storeMessage(external({ to: wallet.address, body: transfer }))).endCell()
    .toBoc().toString("base64");
  await broadcast(boc);
  await waitSeqno(wallet.address, seqno, "SetContent");

  console.log("\n✅  SAP jetton content اصلاح شد — آدرس و موجودی‌ها دست‌نخورده موندن");
}

main().catch(e => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
