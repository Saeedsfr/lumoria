/**
 * useWallet — wrapper روی TonConnect hooks
 * آدرس کیف پول متصل + تابع قطع اتصال رو می‌ده
 */

import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";

export interface WalletState {
  address:     string | null;   // آدرس raw (EQxx...)
  shortAddr:   string;          // نمایش کوتاه: EQ…xxxx
  isConnected: boolean;
  disconnect:  () => void;
}

export function useWallet(): WalletState {
  const rawAddr = useTonAddress(false);   // false = EQ format, true = UQ format
  const [tonConnectUI] = useTonConnectUI();

  const isConnected = Boolean(rawAddr);
  const shortAddr = rawAddr
    ? rawAddr.slice(0, 4) + "…" + rawAddr.slice(-4)
    : "";

  return {
    address:   rawAddr || null,
    shortAddr,
    isConnected,
    disconnect: () => tonConnectUI.disconnect(),
  };
}
