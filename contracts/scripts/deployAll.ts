/**
 * deployAll.ts — Lumoria full deployment to TON Testnet
 *
 * ترتیب دقیق (وابستگی‌ها):
 *   1. CropManager  (sapMaster=deployer موقت)
 *   2. SAPJettonMaster (gameContract=cropManager)
 *   3. SetSAPMaster روی CropManager → آدرس واقعی SAP
 *   4. LandCollection
 *   5. MintLand #0 → deployer  +  RegisterLand #0 در CropManager
 *   6. ذخیره آدرس‌ها در deployed.json
 *
 * اجرا:
 *   cd contracts && npx blueprint run scripts/deployAll.ts --testnet
 */

import { NetworkProvider } from "@ton/blueprint";
import { toNano, beginCell, Cell } from "@ton/core";
import { SAPJettonMaster } from "../build/SAP/SAPJettonMaster_SAPJettonMaster";
import { LandCollection } from "../build/LandNFT/LandCollection_LandCollection";
import { CropManager } from "../build/CropManager/CropManager_CropManager";
import * as fs from "fs";
import * as path from "path";

/* ── کمکی: سکوت n میلی‌ثانیه (صبر برای تأیید tx) ─────────────── */
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/* ── Jetton metadata — ساده‌ترین فرم on-chain (TEP-64) ────────── */
function jettonContent(name: string, symbol: string): Cell {
  // snake-cell با فلگ 0x00 = on-chain
  const snake = beginCell()
    .storeUint(0x00, 8)
    .storeStringTail(
      JSON.stringify({ name, symbol, decimals: "9", description: "Lumoria game token" })
    )
    .endCell();
  return beginCell()
    .storeRef(snake)
    .endCell();
}

/* ── Collection metadata ────────────────────────────────────────── */
function collectionContent(): Cell {
  // off-chain URL (فلگ 0x01)
  return beginCell()
    .storeUint(0x01, 8)
    .storeStringTail("https://lumoria.app/nft/collection.json")
    .endCell();
}

/* ─────────────────────────────────────────────────────────────────
   تابع اصلی — Blueprint این را فراخوانی می‌کند
──────────────────────────────────────────────────────────────── */
export async function run(provider: NetworkProvider) {
  const ui     = provider.ui();
  const sender = provider.sender();
  const owner  = sender.address!;

  ui.write("╔════════════════════════════════════════╗");
  ui.write("║   Lumoria — Testnet Deployment v2.0   ║");
  ui.write("╚════════════════════════════════════════╝");
  ui.write(`Network  : ${provider.network()}`);
  ui.write(`Deployer : ${owner.toString()}`);
  ui.write("");

  /* ══ STEP 1: CropManager ══════════════════════════════════════ */
  ui.write("[ 1 / 5 ]  CropManager...");

  const cropManager = provider.open(
    await CropManager.fromInit(owner, owner)   // sapMaster=owner موقت
  );

  if (await provider.isContractDeployed(cropManager.address)) {
    ui.write(`           ✓ already deployed`);
  } else {
    // null body → Upgradeable.receive() {}
    await cropManager.send(sender, { value: toNano("0.6") }, null);
    await provider.waitForDeploy(cropManager.address);
    ui.write(`           ✓ deployed`);
  }
  ui.write(`           → ${cropManager.address.toString()}`);

  /* ══ STEP 2: SAPJettonMaster ══════════════════════════════════ */
  ui.write("[ 2 / 5 ]  SAPJettonMaster...");

  const sapMaster = provider.open(
    await SAPJettonMaster.fromInit(
      owner,                    // owner = admin
      cropManager.address,      // gameContract
      jettonContent("Lumen Sap", "SAP")
    )
  );

  if (await provider.isContractDeployed(sapMaster.address)) {
    ui.write(`           ✓ already deployed`);
  } else {
    await sapMaster.send(sender, { value: toNano("0.6") }, null);
    await provider.waitForDeploy(sapMaster.address);
    ui.write(`           ✓ deployed`);
  }
  ui.write(`           → ${sapMaster.address.toString()}`);

  /* ══ STEP 3: Wire CropManager ← SAP ══════════════════════════ */
  ui.write("[ 3 / 5 ]  CropManager.SetSAPMaster → SAP...");

  await cropManager.send(
    sender,
    { value: toNano("0.05") },
    { $$type: "SetSAPMaster", newMaster: sapMaster.address }
  );
  await sleep(15_000);   // ۱۵ ثانیه صبر — testnet کند است
  ui.write("           ✓ wired");

  // آدرس SAP wallet خودِ CropManager — بدون این، پرداخت SAP هنگام کاشت/تعمیر رد می‌شود
  ui.write("           CropManager.SetSAPWallet...");
  const cropManagerWallet = await sapMaster.getGetWalletAddress(cropManager.address);
  await cropManager.send(
    sender,
    { value: toNano("0.05") },
    { $$type: "SetSAPWallet", newWallet: cropManagerWallet }
  );
  await sleep(15_000);
  ui.write(`           ✓ wired → ${cropManagerWallet.toString()}`);

  /* ══ STEP 4: LandCollection ═══════════════════════════════════ */
  ui.write("[ 4 / 5 ]  LandCollection...");

  const landCollection = provider.open(
    await LandCollection.fromInit(owner, collectionContent())
  );

  if (await provider.isContractDeployed(landCollection.address)) {
    ui.write(`           ✓ already deployed`);
  } else {
    await landCollection.send(sender, { value: toNano("0.6") }, null);
    await provider.waitForDeploy(landCollection.address);
    ui.write(`           ✓ deployed`);
  }
  ui.write(`           → ${landCollection.address.toString()}`);

  /* ══ STEP 5: زمین تست ════════════════════════════════════════ */
  ui.write("[ 5 / 5 ]  Mint Common Land #0 + Register...");

  // MintLand: rarity=0 = Common
  await landCollection.send(
    sender,
    { value: toNano("0.2") },
    { $$type: "MintLand", to: owner, rarity: 0n }
  );
  await sleep(15_000);
  ui.write("           ✓ land #0 minted to deployer");

  // RegisterLand در CropManager
  await cropManager.send(
    sender,
    { value: toNano("0.1") },
    { $$type: "RegisterLand", landId: 0n, owner: owner, rarity: 0n }
  );
  await sleep(10_000);
  ui.write("           ✓ land #0 registered in CropManager");

  /* ══ ذخیره آدرس‌ها ════════════════════════════════════════════ */
  const deployed = {
    network:     provider.network(),
    deployedAt:  new Date().toISOString(),
    deployer:    owner.toString(),
    contracts: {
      CropManager:     cropManager.address.toString(),
      SAPJettonMaster: sapMaster.address.toString(),
      LandCollection:  landCollection.address.toString(),
    },
    testLand: {
      landId:  0,
      owner:   owner.toString(),
      rarity:  0,   // Common
    },
  };

  const outPath = path.resolve(__dirname, "../../deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));

  /* ══ خلاصه ═══════════════════════════════════════════════════ */
  ui.write("");
  ui.write("╔════════════════════════════════════════╗");
  ui.write("║          Deployment Complete ✓         ║");
  ui.write("╚════════════════════════════════════════╝");
  ui.write(`CropManager     : ${cropManager.address.toString()}`);
  ui.write(`SAPJettonMaster : ${sapMaster.address.toString()}`);
  ui.write(`LandCollection  : ${landCollection.address.toString()}`);
  ui.write(`Saved → ${outPath}`);
  ui.write("");
  ui.write("مرحله بعد:");
  ui.write("  cp deployed.json ../frontend/src/config/deployed.json");
  ui.write("  cd ../frontend && npm run dev");
}
