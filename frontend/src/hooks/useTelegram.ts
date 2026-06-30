import { useEffect, useState } from "react";

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramUser };
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    button_color?: string;
  };
  colorScheme: "light" | "dark";
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function useTelegram() {
  const [tg, setTg] = useState<TelegramWebApp | null>(null);
  const [user, setUser] = useState<TelegramUser | null>(null);

  useEffect(() => {
    const webapp = window.Telegram?.WebApp;
    if (webapp) {
      webapp.ready();
      webapp.expand();
      setTg(webapp);
      setUser(webapp.initDataUnsafe?.user ?? null);
    }
  }, []);

  return { tg, user };
}
