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

function toRawAddr(addr: string): string {
  // اگه قبلاً raw هست (0:hex) همون رو برگردون
  if (/^-?[0-9]+:[0-9a-fA-F]{64}$/.test(addr)) return addr;
  // base64url → bytes → workchain:hex
  const b64 = addr.replace(/-/g, "+").replace(/_/g, "/");
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const wc  = buf[1] === 255 ? -1 : buf[1];
  const hex = Array.from(buf.slice(2, 34)).map(x => x.toString(16).padStart(2, "0")).join("");
  return `${wc}:${hex}`;
}

export async function getSapBalance(userAddr: string): Promise<string> {
  if (!isDeployed() || !userAddr) return "0";
  try {
    const masterRaw = toRawAddr(CONTRACTS.SAPJettonMaster);
    const userRaw   = toRawAddr(userAddr);

    // گام ۱: آدرس SAP wallet کاربر از getter قرارداد
    const wRes = await fetch(
      `${TONAPI}/blockchain/accounts/${masterRaw}/methods/get_wallet_address?args=${userRaw}`,
      { headers: { Accept: "application/json" } }
    );
    if (!wRes.ok) return "0";
    const wData = await wRes.json() as {
      decoded?: { jetton_wallet_address?: string };
    };
    const walletRaw = wData.decoded?.jetton_wallet_address;
    if (!walletRaw) return "0";

    // گام ۲: balance از SAP wallet
    const bRes = await fetch(
      `${TONAPI}/blockchain/accounts/${walletRaw}/methods/balance`,
      { headers: { Accept: "application/json" } }
    );
    if (!bRes.ok) return "0";
    const bData = await bRes.json() as {
      success?: boolean;
      stack?: Array<{ type: string; num: string }>;
    };
    if (!bData.success || !bData.stack?.[0]) return "0";

    const nano = BigInt(bData.stack[0].num);
    return (Number(nano) / 1e9).toFixed(1);
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
