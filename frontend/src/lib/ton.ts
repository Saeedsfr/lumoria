/**
 * ton.ts — TON blockchain helpers برای frontend
 * از testnet.tonapi.io استفاده می‌کنه (TonCenter در ایران block است)
 * TonConnect برای ارسال تراکنش استفاده می‌شه
 */

import { beginCell } from "@ton/ton";
import deployed from "../config/deployed.json";

const TONAPI = "https://testnet.tonapi.io/v2";

/* ── آدرس‌های قراردادها ──────────────────────────────────────── */
export const CONTRACTS = deployed.contracts;

export function isDeployed(): boolean {
  return Boolean(CONTRACTS.CropManager && CONTRACTS.SAPJettonMaster);
}

/* ── SAP Balance ──────────────────────────────────────────────── */

/**
 * موجودی SAP کاربر را از tonapi.io می‌خونه
 */
export async function getSapBalance(userAddr: string): Promise<string> {
  if (!isDeployed() || !userAddr) return "0";
  try {
    const res = await fetch(`${TONAPI}/accounts/${userAddr}/jettons`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return "0";
    const data = await res.json() as {
      balances: Array<{ balance: string; jetton: { address: string } }>;
    };

    const sapMaster = CONTRACTS.SAPJettonMaster.toLowerCase();

    const entry = (data.balances ?? []).find(b => {
      const jAddr = (b.jetton?.address ?? "").toLowerCase();
      // Direct match (both raw format "0:hex")
      if (jAddr === sapMaster) return true;
      // Strip all non-hex chars except colon and compare last 64 chars (the 32-byte hash)
      const cleanJ = jAddr.replace(/[^0-9a-f]/g, "");
      const cleanM = sapMaster.replace(/[^0-9a-f]/g, "");
      return cleanJ.length >= 64 && cleanM.length >= 64 &&
        cleanJ.slice(-64) === cleanM.slice(-64);
    });

    if (!entry) return "0";
    return (Number(BigInt(entry.balance)) / 1e9).toFixed(1);
  } catch {
    return "0";
  }
}

/* ── Message body builders (برای TonConnect sendTransaction) ─── */

/** PlantCrop (opcode=4112=0x1010) */
export function buildPlantCropBody(
  landId:    number,
  slotIndex: number,
  cropType:  number,
  nonce:     number
): string {
  return beginCell()
    .storeUint(4112, 32)
    .storeUint(BigInt(landId),    64)
    .storeUint(BigInt(slotIndex), 8)
    .storeUint(BigInt(cropType),  8)
    .storeUint(BigInt(nonce),     64)
    .endCell()
    .toBoc()
    .toString("base64");
}

/** HarvestCrop (opcode=4113=0x1011) */
export function buildHarvestBody(landId: number, slotIndex: number): string {
  return beginCell()
    .storeUint(4113, 32)
    .storeUint(BigInt(landId),    64)
    .storeUint(BigInt(slotIndex), 8)
    .endCell()
    .toBoc()
    .toString("base64");
}

/** RepairTools (opcode=4114=0x1012) */
export function buildRepairBody(landId: number): string {
  return beginCell()
    .storeUint(4114, 32)
    .storeUint(BigInt(landId), 64)
    .endCell()
    .toBoc()
    .toString("base64");
}

export function getCropManagerAddr(): string {
  return CONTRACTS.CropManager;
}
