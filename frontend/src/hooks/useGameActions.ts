/**
 * useGameActions — ارسال تراکنش‌های بازی از طریق TonConnect
 * هر action یک تراکنش TON به CropManager می‌فرسته
 */

import { useTonConnectUI } from "@tonconnect/ui-react";
import { toNano } from "@ton/ton";
import {
  buildPlantCropBody,
  buildHarvestBody,
  buildRepairBody,
  getCropManagerAddr,
  isDeployed,
} from "../lib/ton";

interface SendResult {
  ok:    boolean;
  error: string | null;
}

export function useGameActions() {
  const [tonConnectUI] = useTonConnectUI();

  /** کشت — نیاز به 8 SAP دارد (on-chain بررسی می‌شه) */
  async function plant(
    landId:    number,
    slotIndex: number,
    cropType = 0   // 0 = wheat, 1 = corn, ...
  ): Promise<SendResult> {
    if (!isDeployed()) return { ok: false, error: "قرارداد دپلوی نشده" };
    const nonce = Math.floor(Math.random() * 2 ** 32);
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,  // 10 min
        messages: [
          {
            address: getCropManagerAddr(),
            amount:  toNano("0.06").toString(),   // gas برای CropManager + مینت SAP
            payload: buildPlantCropBody(landId, slotIndex, cropType, nonce),
          },
        ],
      });
      return { ok: true, error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // کاربر reject کرد → ارور نشون نده
      if (msg.includes("User rejects") || msg.includes("cancel")) {
        return { ok: false, error: null };
      }
      return { ok: false, error: msg };
    }
  }

  /** برداشت — SAP مینت می‌شه به کیف پول کاربر */
  async function harvest(landId: number, slotIndex: number): Promise<SendResult> {
    if (!isDeployed()) return { ok: false, error: "قرارداد دپلوی نشده" };
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: getCropManagerAddr(),
            amount:  toNano("0.12").toString(),   // gas برای mint SAP + forward
            payload: buildHarvestBody(landId, slotIndex),
          },
        ],
      });
      return { ok: true, error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejects") || msg.includes("cancel")) {
        return { ok: false, error: null };
      }
      return { ok: false, error: msg };
    }
  }

  /** تعمیر ابزار */
  async function repair(landId: number): Promise<SendResult> {
    if (!isDeployed()) return { ok: false, error: "قرارداد دپلوی نشده" };
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: getCropManagerAddr(),
            amount:  toNano("0.08").toString(),
            payload: buildRepairBody(landId),
          },
        ],
      });
      return { ok: true, error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("User rejects") || msg.includes("cancel")) {
        return { ok: false, error: null };
      }
      return { ok: false, error: msg };
    }
  }

  return { plant, harvest, repair };
}
