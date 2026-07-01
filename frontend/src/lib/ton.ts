/**
 * ton.ts — TON blockchain helpers برای frontend
 * از testnet.tonapi.io استفاده می‌کنه (TonCenter در ایران block است)
 * TonConnect برای ارسال تراکنش استفاده می‌شه
 */

import { beginCell, Address, Cell } from "@ton/ton";
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

/** آدرس SAP jetton-wallet یک کاربر را از روی getter قرارداد master برمی‌گرداند (raw format) */
export async function getSapWalletAddress(userAddr: string): Promise<string | null> {
  if (!isDeployed() || !userAddr) return null;
  try {
    const masterRaw = toRawAddr(CONTRACTS.SAPJettonMaster);
    const userRaw   = toRawAddr(userAddr);
    const wRes = await fetch(
      `${TONAPI}/blockchain/accounts/${masterRaw}/methods/get_wallet_address?args=${userRaw}`,
      { headers: { Accept: "application/json" } }
    );
    if (!wRes.ok) return null;
    const wData = await wRes.json() as {
      decoded?: { jetton_wallet_address?: string };
    };
    return wData.decoded?.jetton_wallet_address ?? null;
  } catch {
    return null;
  }
}

export async function getSapBalance(userAddr: string): Promise<string> {
  if (!isDeployed() || !userAddr) return "0";
  try {
    const walletRaw = await getSapWalletAddress(userAddr);
    if (!walletRaw) return "0";

    // balance از SAP wallet
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

export const SEED_COST_NANO = 8_000_000_000n;   // 8 SAP
export const TOOL_SAP_NANO  = 5_000_000_000n;   // 5 SAP

/** بدنه اکشن PlantCrop (opcode=0x1010) — به‌عنوان forward_payload در Jetton Transfer استفاده می‌شود */
export function buildPlantAction(
  landId:    number,
  slotIndex: number,
  cropType:  number,
  nonce:     number
): Cell {
  return beginCell()
    .storeUint(0x1010, 32)
    .storeUint(BigInt(landId),    64)
    .storeUint(BigInt(slotIndex), 8)
    .storeUint(BigInt(cropType),  8)
    .storeUint(BigInt(nonce),     64)
    .endCell();
}

/** HarvestCrop (opcode=4113=0x1011) — بدون پرداخت، مستقیم به CropManager */
export function buildHarvestBody(landId: number, slotIndex: number): string {
  return beginCell()
    .storeUint(4113, 32)
    .storeUint(BigInt(landId),    64)
    .storeUint(BigInt(slotIndex), 8)
    .endCell()
    .toBoc()
    .toString("base64");
}

/** بدنه اکشن RepairTools (opcode=0x1012) — به‌عنوان forward_payload در Jetton Transfer استفاده می‌شود */
export function buildRepairAction(landId: number): Cell {
  return beginCell()
    .storeUint(0x1012, 32)
    .storeUint(BigInt(landId), 64)
    .endCell();
}

/**
 * بدنه استاندارد Jetton Transfer (TEP-74) — برای پرداخت واقعی SAP همراه با اکشن بازی.
 * این پیام باید به آدرس SAP wallet خودِ کاربر (نه CropManager) فرستاده شود؛
 * خودِ wallet مبلغ رو به CropManager منتقل می‌کنه و forward_payload اکشن رو با
 * transfer_notification به CropManager می‌رسونه.
 */
export function buildSapPaymentBody(
  destination:    string,
  amountNano:     bigint,
  forwardTonNano: bigint,
  forwardPayload: Cell,
  responseAddr:   string
): string {
  return beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(BigInt(Date.now()), 64)         // query_id
    .storeCoins(amountNano)
    .storeAddress(Address.parse(destination))
    .storeAddress(Address.parse(responseAddr))
    .storeMaybeRef(null)                        // custom_payload
    .storeCoins(forwardTonNano)
    .storeMaybeRef(forwardPayload)
    .endCell()
    .toBoc()
    .toString("base64");
}

export function getCropManagerAddr(): string {
  return CONTRACTS.CropManager;
}
