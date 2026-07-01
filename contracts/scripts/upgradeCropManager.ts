/**
 * upgradeCropManager.ts — آپگرید CropManager بدون از دست دادن state
 * فقط code عوض می‌شه، lands/players/crops سالم می‌مونن
 *
 * اجرا: npx ts-node scripts/upgradeCropManager.ts
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
  beginCell, SendMode, external, storeMessage, Cell,
} from "@ton/ton";
import { Address } from "@ton/core";
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

async function main() {
  // بارگذاری compiled code
  const codePath = path.resolve(__dirname, "../build/CropManager/CropManager_CropManager.code.boc");
  if (!fs.existsSync(codePath)) {
    console.error("❌ فایل build/CropManager/CropManager_CropManager.code.boc یافت نشد");
    console.error("   ابتدا: npm run build");
    process.exit(1);
  }
  const codeBoc = fs.readFileSync(codePath);
  const newCode = Cell.fromBoc(codeBoc)[0];

  const mnemonicStr = process.env.WALLET_MNEMONIC;
  if (!mnemonicStr) { console.error("❌ WALLET_MNEMONIC یافت نشد"); process.exit(1); }

  const keys   = await mnemonicToPrivateKey(mnemonicStr.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ publicKey: keys.publicKey, workchain: 0 });
  const cmAddr = Address.parse(deployed.contracts.CropManager);

  console.log(`\n🔄  CropManager Upgrade`);
  console.log(`    Contract: ${cmAddr.toString()}`);
  console.log(`    New code: ${codePath}`);

  const seqno = await getSeqno(wallet.address);

  // UpgradeContract — opcode 0x9e025572
  const upgradeBody = beginCell()
    .storeUint(0x9e025572, 32)
    .storeRef(newCode)
    .endCell();

  const transfer = wallet.createTransfer({
    seqno,
    secretKey: keys.secretKey,
    messages: [internal({ to: cmAddr, value: toNano("0.1"), body: upgradeBody })],
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });

  const boc = beginCell()
    .store(storeMessage(external({ to: wallet.address, body: transfer })))
    .endCell().toBoc().toString("base64");

  await broadcast(boc);
  console.log("\n⏳  در انتظار تأیید...");

  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const newSeqno = await getSeqno(wallet.address);
    if (newSeqno > seqno) {
      console.log(`\n✅  CropManager آپگرید شد! (cycle: 5 دقیقه)`);
      return;
    }
    process.stdout.write(".");
  }
  console.log("\n⚠️  seqno تغییر نکرد");
}

main().catch(e => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
