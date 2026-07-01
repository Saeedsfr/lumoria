/**
 * deployMnemonic.ts — دپلوی کامل با mnemonic
 * فقط از fetch + testnet.tonapi.io استفاده می‌کنه (بدون TonClient)
 *
 * اجرا: npm run deploy:testnet
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.testnet") });

// Node.js native fetch پراکسی سیستم را نمی‌خونه — undici را تنظیم می‌کنیم
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
if (proxyUrl) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const { setGlobalDispatcher, ProxyAgent } = require("undici") as any;
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

import { mnemonicToPrivateKey } from "@ton/crypto";
import {
  WalletContractV4, toNano, internal,
  beginCell, Cell, SendMode,
  external, storeMessage,
} from "@ton/ton";
import { Address } from "@ton/core";
import { CropManager }     from "../build/CropManager/CropManager_CropManager";
import { SAPJettonMaster } from "../build/SAP/SAPJettonMaster_SAPJettonMaster";
import { SAPJettonWallet } from "../build/SAP/SAPJettonMaster_SAPJettonWallet";
import { LandCollection }  from "../build/LandNFT/LandCollection_LandCollection";
import * as fs from "fs";

/* ── tonapi.io testnet REST API ────────────────────────────────── */
const API = "https://testnet.tonapi.io/v2";
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function apiGet(path: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

/** موجودی (nanoTON) */
async function getBalance(addr: Address): Promise<bigint> {
  const data = await apiGet(`/accounts/${addr.toRawString()}`);
  return BigInt(data.balance as string);
}

/** آیا قرارداد روی chain هست؟ */
async function isDeployed(addr: Address): Promise<boolean> {
  try {
    const data = await apiGet(`/accounts/${addr.toRawString()}`);
    return data.status === "active";
  } catch { return false; }
}

/** seqno کیف پول (اگه uninit باشه → 0) */
async function getSeqno(addr: Address): Promise<number> {
  try {
    const data = await apiGet(`/blockchain/accounts/${addr.toRawString()}/methods/seqno`);
    if (!data.success) return 0;
    const stack = data.stack as Array<{type:string; num:string}>;
    return parseInt(stack[0].num, 16);
  } catch { return 0; }
}

/** ارسال BOC به شبکه */
async function broadcast(boc: string): Promise<void> {
  const res = await fetch(`${API}/blockchain/message`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ boc }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Broadcast failed ${res.status}: ${txt}`);
  }
}

/** ارسال تراکنش و صبر برای تأیید */
async function sendAndWait(
  wallet:    WalletContractV4,
  secretKey: Buffer,
  seqno:     number,
  msg:       ReturnType<typeof internal>
): Promise<number> {
  // ساخت transfer cell امضا‌شده
  const transfer = wallet.createTransfer({
    seqno,
    secretKey,
    messages: [msg],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });

  // بسته‌بندی در پیام external
  const extMsg = external({
    to:   wallet.address,
    init: seqno === 0 ? wallet.init : undefined,  // deploy wallet در اولین tx
    body: transfer,
  });

  // سریال‌سازی به BOC base64
  const boc = beginCell().store(storeMessage(extMsg)).endCell().toBoc().toString("base64");
  await broadcast(boc);

  // صبر برای تأیید تراکنش
  for (let i = 0; i < 50; i++) {
    await sleep(3_000);
    const newSeqno = await getSeqno(wallet.address);
    if (newSeqno > seqno) return newSeqno;
  }
  return seqno + 1;
}

/* ─────────────────────────────────────────────────────────────── */
async function main() {
  /* ── mnemonic ────────────────────────────────────────────────── */
  const mnemonicStr = process.env.WALLET_MNEMONIC;
  if (!mnemonicStr || mnemonicStr.trim().split(/\s+/).length < 24) {
    console.error("❌  WALLET_MNEMONIC یافت نشد در .env.testnet");
    process.exit(1);
  }

  const keys   = await mnemonicToPrivateKey(mnemonicStr.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ publicKey: keys.publicKey, workchain: 0 });
  const ownerAddr = wallet.address;

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   Lumoria — Testnet Deployment (Mnemonic)  ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`Deployer : ${ownerAddr.toString({ bounceable: false, testOnly: true })}`);
  console.log(`API      : ${API}`);

  /* ── موجودی ──────────────────────────────────────────────────── */
  let balance: bigint;
  try {
    balance = await getBalance(ownerAddr);
  } catch (e: unknown) {
    console.error(`❌  خطا: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
  console.log(`Balance  : ${(Number(balance) / 1e9).toFixed(3)} TON`);
  if (balance < toNano("2")) {
    console.error("❌  موجودی کافی نیست (حداقل ۲ tTON لازم)");
    process.exit(1);
  }

  let seqno = await getSeqno(ownerAddr);
  console.log(`Seqno    : ${seqno}\n`);

  /* ══ 1: CropManager ══════════════════════════════════════════ */
  console.log("[ 1 / 5 ]  CropManager...");
  const cmInit = await CropManager.fromInit(ownerAddr, ownerAddr);
  const cmAddr = cmInit.address;

  if (!await isDeployed(cmAddr)) {
    seqno = await sendAndWait(wallet, keys.secretKey, seqno,
      internal({ to: cmAddr, value: toNano("0.6"), init: cmInit.init ?? undefined, body: beginCell().endCell() })
    );
    console.log("          ✓ deployed");
  } else {
    console.log("          ✓ already deployed");
  }
  console.log(`          → ${cmAddr.toString()}`);

  /* ══ 2: SAPJettonMaster ══════════════════════════════════════ */
  console.log("\n[ 2 / 5 ]  SAPJettonMaster...");
  const sapContent = (() => {
    const snake = beginCell().storeUint(0x00, 8)
      .storeStringTail(JSON.stringify({ name:"Lumen Sap", symbol:"SAP", decimals:"9" }))
      .endCell();
    return beginCell().storeRef(snake).endCell();
  })();
  const sapInit = await SAPJettonMaster.fromInit(ownerAddr, cmAddr, sapContent);
  const sapAddr = sapInit.address;

  if (!await isDeployed(sapAddr)) {
    seqno = await sendAndWait(wallet, keys.secretKey, seqno,
      internal({ to: sapAddr, value: toNano("0.6"), init: sapInit.init ?? undefined, body: beginCell().endCell() })
    );
    console.log("          ✓ deployed");
  } else {
    console.log("          ✓ already deployed");
  }
  console.log(`          → ${sapAddr.toString()}`);

  /* ══ 3: SetSAPMaster ════════════════════════════════════════ */
  console.log("\n[ 3 / 5 ]  CropManager.SetSAPMaster...");
  seqno = await sendAndWait(wallet, keys.secretKey, seqno,
    internal({
      to:    cmAddr,
      value: toNano("0.05"),
      body:  beginCell().storeUint(4100, 32).storeAddress(sapAddr).endCell(),
    })
  );
  console.log("          ✓ wired");

  // آدرس SAP wallet خودِ CropManager — بدون این، transfer_notification رد می‌شود
  console.log("          CropManager.SetSAPWallet...");
  const cmWalletInit = await SAPJettonWallet.fromInit(cmAddr, sapAddr);
  const cmWalletAddr = cmWalletInit.address;
  seqno = await sendAndWait(wallet, keys.secretKey, seqno,
    internal({
      to:    cmAddr,
      value: toNano("0.05"),
      body:  beginCell().storeUint(4101, 32).storeAddress(cmWalletAddr).endCell(),
    })
  );
  console.log(`          ✓ wired → ${cmWalletAddr.toString()}`);

  /* ══ 4: LandCollection ══════════════════════════════════════ */
  console.log("\n[ 4 / 5 ]  LandCollection...");
  const lcContent = beginCell().storeUint(0x01, 8)
    .storeStringTail("https://lumoria.app/nft/collection.json").endCell();
  const lcInit = await LandCollection.fromInit(ownerAddr, lcContent);
  const lcAddr = lcInit.address;

  if (!await isDeployed(lcAddr)) {
    seqno = await sendAndWait(wallet, keys.secretKey, seqno,
      internal({ to: lcAddr, value: toNano("0.6"), init: lcInit.init ?? undefined, body: beginCell().endCell() })
    );
    console.log("          ✓ deployed");
  } else {
    console.log("          ✓ already deployed");
  }
  console.log(`          → ${lcAddr.toString()}`);

  /* ══ 5: Mint + Register زمین تست ════════════════════════════ */
  console.log("\n[ 5 / 5 ]  Mint Common Land #0 + Register...");

  seqno = await sendAndWait(wallet, keys.secretKey, seqno,
    internal({
      to:    lcAddr,
      value: toNano("0.2"),
      body:  beginCell().storeUint(12289, 32).storeAddress(ownerAddr).storeUint(0, 8).endCell(),
    })
  );
  console.log("          ✓ land #0 minted");

  seqno = await sendAndWait(wallet, keys.secretKey, seqno,
    internal({
      to:    cmAddr,
      value: toNano("0.1"),
      body:  beginCell().storeUint(4097, 32).storeUint(0, 64).storeAddress(ownerAddr).storeUint(0, 8).endCell(),
    })
  );
  console.log("          ✓ land #0 registered");

  /* ══ ذخیره آدرس‌ها ══════════════════════════════════════════ */
  const deployed = {
    network:    "testnet",
    deployedAt: new Date().toISOString(),
    deployer:   ownerAddr.toString(),
    contracts: {
      CropManager:     cmAddr.toString(),
      SAPJettonMaster: sapAddr.toString(),
      LandCollection:  lcAddr.toString(),
    },
    testLand: { landId: 0, owner: ownerAddr.toString(), rarity: 0 },
  };

  const outPath = path.resolve(__dirname, "../../deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║         Deployment Complete ✓               ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`CropManager     : ${cmAddr}`);
  console.log(`SAPJettonMaster : ${sapAddr}`);
  console.log(`LandCollection  : ${lcAddr}`);
  console.log(`\nSaved → ${outPath}`);
  console.log("\n── مرحله بعد ──────────────────────────────────");
  console.log("  cp deployed.json ../frontend/src/config/deployed.json");
  console.log("  cd ../frontend && npm run dev\n");
}

main().catch(e => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
