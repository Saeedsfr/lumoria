/**
 * genWallet.ts — ساخت کیف پول testnet جدید
 *
 * اجرا: npx ts-node scripts/genWallet.ts
 *
 * خروجی:
 *   - ۲۴ کلمه mnemonic (ذخیره‌اش کن!)
 *   - آدرس کیف پول (برای گرفتن tTON از faucet)
 *   - محتوای .env.testnet برای paste در فایل
 */

import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";
import * as fs from "fs";
import * as path from "path";

async function main() {
  /* ── ۱. تولید mnemonic جدید ─────────────────────────────────── */
  const mnemonic = await mnemonicNew(24);

  /* ── ۲. استخراج کلیدها و آدرس ──────────────────────────────── */
  const keys   = await mnemonicToPrivateKey(mnemonic);
  const wallet = WalletContractV4.create({ publicKey: keys.publicKey, workchain: 0 });

  const addr = wallet.address.toString({ bounceable: false, testOnly: true });

  /* ── ۳. نمایش در ترمینال ─────────────────────────────────────── */
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║     Lumoria — Testnet Wallet Generated      ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  console.log("🔑 MNEMONIC (24 کلمه — فقط یک بار نشون داده می‌شه!):");
  console.log("──────────────────────────────────────────────────");
  console.log(mnemonic.join(" "));
  console.log("──────────────────────────────────────────────────\n");

  console.log("📬 WALLET ADDRESS (testnet):");
  console.log(`   ${addr}`);
  console.log("");
  console.log("💧 مراحل بعدی:");
  console.log("   ۱. آدرس بالا را copy کن");
  console.log("   ۲. در تلگرام @testgiver_ton_bot را باز کن");
  console.log("   ۳. آدرس را بفرست → ۵ tTON می‌گیری");
  console.log("   ۴. فایل .env.testnet ساخته شده را rename کن به .env.testnet.local");
  console.log("");

  /* ── ۴. ذخیره در .env.testnet ───────────────────────────────── */
  const envContent = `# کیف پول testnet لومریا — فقط برای توسعه!
# این فایل را در git commit نکن
WALLET_MNEMONIC="${mnemonic.join(" ")}"
WALLET_ADDRESS="${addr}"
TON_API_KEY=
`;

  const envPath = path.resolve(__dirname, "../../.env.testnet");
  fs.writeFileSync(envPath, envContent);
  console.log(`✓ ذخیره شد: ${envPath}`);
  console.log("  ⚠️  این فایل را به کسی نده و در git نگذار!\n");
}

main().catch(console.error);
