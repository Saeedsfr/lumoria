import { useState } from "react";
import { TonConnectButton } from "@tonconnect/ui-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { TabBar }    from "./components/TabBar";
import FarmPage      from "./pages/FarmPage";
import LandsPage     from "./pages/LandsPage";
import ShopPage      from "./pages/ShopPage";
import ProfilePage   from "./pages/ProfilePage";
import { useWallet } from "./hooks/useWallet";

type Tab = "farm" | "lands" | "shop" | "profile";

const TAB_ORDER: Tab[] = ["farm", "lands", "shop", "profile"];

const pageVariants: Variants = {
  initial: (dir: number) => ({ x: dir * 24, opacity: 0, filter: "blur(4px)" }),
  animate: { x: 0, opacity: 1, filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 380, damping: 36 } },
  exit: (dir: number) => ({ x: dir * -24, opacity: 0, filter: "blur(4px)",
    transition: { duration: 0.16, ease: "easeIn" as const } }),
};

export default function App() {
  const [tab, setTab] = useState<Tab>("farm");
  const [dir, setDir] = useState(1);
  const { shortAddr, isConnected } = useWallet();

  const handleTab = (next: Tab) => {
    const curr = TAB_ORDER.indexOf(tab);
    const nxt  = TAB_ORDER.indexOf(next);
    setDir(nxt > curr ? 1 : -1);
    setTab(next);
  };

  return (
    <div style={{
      height: "100dvh", maxWidth: 430, margin: "0 auto",
      display: "flex", flexDirection: "column",
      background: "#04030A", overflow: "hidden", position: "relative",
    }}>
      {/* ── TOP HEADER ─────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0, height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 14px",
        background: "rgba(4,3,10,0.92)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        zIndex: 20,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: "radial-gradient(circle at 35% 30%, #80FFB8, #3AFFA0, #0A3020)",
            boxShadow: "0 0 14px rgba(58,255,160,0.45)",
          }}/>
          <span style={{
            fontSize: 13, fontWeight: 800, letterSpacing: 2,
            background: "linear-gradient(90deg,#3AFFA0,#80FFD8)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>LUMORIA</span>
        </div>

        {/* Wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isConnected && (
            <span style={{
              fontSize: 10, color: "#5A6A9A", fontFamily: "monospace",
              background: "rgba(255,255,255,0.04)",
              padding: "3px 8px", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.06)",
            }}>{shortAddr}</span>
          )}
          <TonConnectButton style={{ transform: "scale(.82)", transformOrigin: "right" }}/>
        </div>
      </header>

      {/* ── PAGE CONTENT ───────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={tab}
            custom={dir}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ position: "absolute", inset: 0 }}
          >
            {tab === "farm"    && <FarmPage/>}
            {tab === "lands"   && <LandsPage/>}
            {tab === "shop"    && <ShopPage/>}
            {tab === "profile" && <ProfilePage/>}
          </motion.div>
        </AnimatePresence>
      </div>

      <TabBar active={tab} onChange={handleTab}/>
    </div>
  );
}
