/**
 * useGameActions — ارسال تراکنش‌های بازی از طریق TonConnect
 * هر action یک تراکنش TON به CropManager می‌فرسته
 */

import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { toNano, Address } from "@ton/ton";
import {
  buildPlantAction,
  buildHarvestBody,
  buildRepairAction,
  buildSapPaymentBody,
  getSapWalletAddress,
  getCropManagerAddr,
  isDeployed,
  SEED_COST_NANO,
  TOOL_SAP_NANO,
} from "../lib/ton";

interface SendResult {
  ok:    boolean;
  error: string | null;
}

export function useGameActions() {
  const [tonConnectUI] = useTonConnectUI();
  const myAddress = useTonAddress(false);

  /**
   * کشت — پرداخت واقعی 8 SAP از طریق استاندارد Jetton Transfer.
   * پیام به SAP wallet خودِ کاربر می‌ره (نه مستقیم به CropManager)؛
   * خودِ wallet توکن رو منتقل می‌کنه و بعد transfer_notification همراه
   * اکشن کاشت به CropManager می‌رسه — این‌جوریه که موجودی واقعاً کم می‌شه.
   */
  async function plant(
    landId:    number,
    slotIndex: number,
    cropType = 0   // 0 = wheat, 1 = corn, ...
  ): Promise<SendResult> {
    if (!isDeployed()) return { ok: false, error: "قرارداد دپلوی نشده" };
    if (!myAddress) return { ok: false, error: "ولت متصل نیست" };
    const nonce = Math.floor(Math.random() * 2 ** 32);
    try {
      const myWalletRaw = await getSapWalletAddress(myAddress);
      if (!myWalletRaw) return { ok: false, error: "آدرس SAP wallet یافت نشد" };
      // TonConnect به آدرس friendly نیاز داره — tonapi فرمت raw (0:hex) برمی‌گردونه
      const myWallet = Address.parse(myWalletRaw).toString();

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,  // 10 min
        messages: [
          {
            address: myWallet,
            amount:  toNano("0.18").toString(),   // گاز برای کل زنجیره (wallet→wallet→CropManager)
            payload: buildSapPaymentBody(
              getCropManagerAddr(),
              SEED_COST_NANO,
              toNano("0.08"),
              buildPlantAction(landId, slotIndex, cropType, nonce),
              myAddress
            ),
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

  /** تعمیر ابزار — پرداخت واقعی 5 SAP، مشابه plant() */
  async function repair(landId: number): Promise<SendResult> {
    if (!isDeployed()) return { ok: false, error: "قرارداد دپلوی نشده" };
    if (!myAddress) return { ok: false, error: "ولت متصل نیست" };
    try {
      const myWalletRaw = await getSapWalletAddress(myAddress);
      if (!myWalletRaw) return { ok: false, error: "آدرس SAP wallet یافت نشد" };
      // TonConnect به آدرس friendly نیاز داره — tonapi فرمت raw (0:hex) برمی‌گردونه
      const myWallet = Address.parse(myWalletRaw).toString();

      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: myWallet,
            amount:  toNano("0.18").toString(),
            payload: buildSapPaymentBody(
              getCropManagerAddr(),
              TOOL_SAP_NANO,
              toNano("0.08"),
              buildRepairAction(landId),
              myAddress
            ),
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
