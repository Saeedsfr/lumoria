/**
 * useSapBalance — موجودی SAP کاربر رو از blockchain می‌خونه
 * هر 30 ثانیه auto-refresh می‌کنه
 */

import { useState, useEffect, useCallback } from "react";
import { getSapBalance } from "../lib/ton";

export function useSapBalance(walletAddr: string | null) {
  const [balance, setBalance]   = useState<string>("–");
  const [loading, setLoading]   = useState(false);

  const refresh = useCallback(async () => {
    if (!walletAddr) { setBalance("–"); return; }
    setLoading(true);
    const b = await getSapBalance(walletAddr);
    setBalance(b);
    setLoading(false);
  }, [walletAddr]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { balance, loading, refresh };
}
