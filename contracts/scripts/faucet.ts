/**
 * faucet.ts — mint SAP testnet برای تست بازی
 * فقط برای testnet — owner می‌تواند مستقیم mint کند
 *
 * اجرا: npx ts-node scripts/faucet.ts <آدرس> <مقدار-SAP>
 * مثال: npx ts-node scripts/faucet.ts UQAkbj... 50
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
  beginCell, SendMode, external, storeMessage,
} from "@ton/ton";
import { Address, toNano as toCoins } from "@ton/core";
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
  const toAddrStr = process.argv[2];
  const sapAmount = parseFloat(process.argv[3] ?? "50");

  if (!toAddrStr) {
    console.error("استفاده: npx ts-node scripts/faucet.ts <آدرس> [مقدار-SAP]");
    process.exit(1);
  }
  if (sapAmount > 200) {
    console.error("❌ حداکثر ۲۰۰ SAP برای testnet faucet");
    process.exit(1);
  }

  const toAddr   = Address.parse(toAddrStr);
  const sapMaster = Address.parse(deployed.contracts.SAPJettonMaster);

  const mnemonicStr = process.env.WALLET_MNEMONIC;
  if (!mnemonicStr) { console.error("❌ WALLET_MNEMONIC یافت نشد"); process.exit(1); }

  const keys   = await mnemonicToPrivateKey(mnemonicStr.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ publicKey: keys.publicKey, workchain: 0 });

  console.log(`\n🌿  Lumoria SAP Faucet (testnet)`);
  console.log(`    To      : ${toAddr.toString({ bounceable: false })}`);
  console.log(`    Amount  : ${sapAmount} SAP`);
  console.log(`    Master  : ${sapMaster.toString()}`);

  const seqno = await getSeqno(wallet.address);

  // MintTo message — opcode 0x2003
  const mintBody = beginCell()
    .storeUint(0x2003, 32)
    .storeCoins(toCoins(sapAmount.toString()))
    .storeAddress(toAddr)
    .endCell();

  const transfer = wallet.createTransfer({
    seqno,
    secretKey: keys.secretKey,
    messages:  [internal({ to: sapMaster, value: toNano("0.07"), body: mintBody })],
    sendMode:  SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
  });

  const boc = beginCell()
    .store(storeMessage(external({ to: wallet.address, body: transfer })))
    .endCell().toBoc().toString("base64");

  await broadcast(boc);
  console.log("\n⏳  در انتظار تأیید تراکنش...");

  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const newSeqno = await getSeqno(wallet.address);
    if (newSeqno > seqno) {
      console.log(`\n✅  ${sapAmount} SAP با موفقیت mint شد!`);
      console.log(`    تراکنش تأیید شد (seqno ${seqno} → ${newSeqno})`);
      return;
    }
    process.stdout.write(".");
  }
  console.log("\n⚠️  seqno تغییر نکرد — تراکنش احتمالاً در صف است");
}

main().catch(e => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
