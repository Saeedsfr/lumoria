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
import { WalletContractV4, toNano, internal, beginCell, SendMode, external, storeMessage } from "@ton/ton";
import { Address } from "@ton/core";
import deployed from "../../deployed.json";

const API   = "https://testnet.tonapi.io/v2";
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function getSeqno(addr: Address): Promise<number> {
  try {
    const res = await fetch(`${API}/blockchain/accounts/${addr.toRawString()}/methods/seqno`, { headers: { Accept: "application/json" } });
    const d = await res.json() as Record<string,unknown>;
    if (!d.success) return 0;
    return parseInt((d.stack as Array<{num:string}>)[0].num, 16);
  } catch { return 0; }
}

async function broadcast(boc: string) {
  const res = await fetch(`${API}/blockchain/message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boc }) });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
}

async function main() {
  const landId    = parseInt(process.argv[2] ?? "0");
  const slotIndex = parseInt(process.argv[3] ?? "0");

  const keys   = await mnemonicToPrivateKey(process.env.WALLET_MNEMONIC!.trim().split(/\s+/));
  const wallet = WalletContractV4.create({ publicKey: keys.publicKey, workchain: 0 });
  const cmAddr = Address.parse(deployed.contracts.CropManager);

  console.log(`\n🔧  Reset land=${landId} slot=${slotIndex}`);
  const seqno = await getSeqno(wallet.address);

  // AdminResetSlot — opcode 0x1014
  const body = beginCell().storeUint(0x1014, 32).storeUint(landId, 64).storeUint(slotIndex, 8).endCell();
  const transfer = wallet.createTransfer({ seqno, secretKey: keys.secretKey, messages: [internal({ to: cmAddr, value: toNano("0.05"), body })], sendMode: SendMode.PAY_GAS_SEPARATELY });
  const boc = beginCell().store(storeMessage(external({ to: wallet.address, body: transfer }))).endCell().toBoc().toString("base64");

  await broadcast(boc);
  process.stdout.write("⏳ ");
  for (let i = 0; i < 20; i++) {
    await sleep(3000);
    if (await getSeqno(wallet.address) > seqno) { console.log("\n✅  Slot reset شد!"); return; }
    process.stdout.write(".");
  }
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
