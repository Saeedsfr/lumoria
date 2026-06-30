import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import { useTelegram } from "../hooks/useTelegram";

const T = {
  bg:      "#04030A",
  bg2:     "rgba(13,11,34,.85)",
  bg3:     "#141130",
  text:    "#EDE9FF",
  t2:      "#5A6A9A",
  t3:      "#222840",
  sap:     "#3AFFA0",
  sapDim:  "#0A2818",
  sapHi:   "#80FFD0",
  blue:    "#60A8FF",
  gold:    "#F7CC3C",
  border:  "rgba(255,255,255,.05)",
  borderG: "rgba(58,255,160,.2)",
};

const STATS = [
  { label: "کل برداشت",   value: "۰",  unit: "SAP", icon: "🌾", color: T.sap  },
  { label: "کل کاشت",     value: "۰",  unit: "بار", icon: "🌱", color: T.sap  },
  { label: "SAP سوزانده", value: "۰",  unit: "SAP", icon: "🔥", color: T.gold },
  { label: "روزهای فعال", value: "۱",  unit: "روز", icon: "📅", color: T.blue },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const itemVariants: Variants = {
  hidden:  { opacity: 0, scale: .9, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 340, damping: 28 } },
};

export default function ProfilePage() {
  const { user } = useTelegram();
  const [tcUI]   = useTonConnectUI();
  const rawAddr  = useTonAddress(false);
  const isConn   = Boolean(rawAddr);
  const shortAddr = rawAddr ? rawAddr.slice(0, 6) + "…" + rawAddr.slice(-6) : null;

  return (
    <div style={{
      height: "100%",
      background: "linear-gradient(180deg, #04030A 0%, #07061A 100%)",
      overflowY: "auto",
    }}>
      {/* ── AVATAR CARD ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "28px 16px 22px",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 200, height: 80,
          background: "radial-gradient(ellipse, rgba(58,255,160,.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}/>

        {/* Avatar */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          style={{
            width: 80, height: 80, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 900, color: T.sap, marginBottom: 14,
            background: `linear-gradient(135deg, ${T.sapDim}, ${T.bg3})`,
            border: `2px solid rgba(58,255,160,.3)`,
            boxShadow: "0 0 32px rgba(58,255,160,.18), 0 0 64px rgba(58,255,160,.06)",
            position: "relative",
          }}
        >
          {user?.first_name?.[0] ?? "ن"}
          {/* Orbit dot */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            style={{ position: "absolute", inset: -8 }}
          >
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: T.sap,
              boxShadow: `0 0 8px ${T.sap}`,
              position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)",
            }}/>
          </motion.div>
        </motion.div>

        <h2 style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
          {user?.first_name ?? "نگهبان ناشناس"}
        </h2>
        <p style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>
          @{user?.username ?? "lumoria_player"}
        </p>

        {/* Badge */}
        <motion.div
          initial={{ scale: .8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: .2, type: "spring", stiffness: 360, damping: 24 }}
          style={{
            marginTop: 12, padding: "6px 18px", borderRadius: 999,
            background: "rgba(58,255,160,.08)",
            border: "1px solid rgba(58,255,160,.22)",
            fontSize: 12, color: T.sap, fontWeight: 700,
          }}
        >🏅 ریشه‌کار مبتدی</motion.div>
      </motion.div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,.04)", margin: "0 16px 14px" }}/>

      {/* ── STATS GRID ───────────────────────────────────────────── */}
      <div style={{ padding: "0 14px" }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: T.t2, marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          آمار کلی
        </h3>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          {STATS.map(s => (
            <motion.div
              key={s.label}
              variants={itemVariants}
              whileHover={{ y: -2, boxShadow: `0 8px 24px rgba(0,0,0,.3)` }}
              style={{
                padding: "16px 14px", borderRadius: 20,
                background: T.bg2,
                border: "1px solid rgba(255,255,255,.05)",
                transition: "box-shadow .2s",
              }}
            >
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div style={{
                fontSize: 24, fontWeight: 800, fontFamily: "monospace",
                color: s.color, marginTop: 8, marginBottom: 2,
                textShadow: `0 0 16px ${s.color}50`,
              }}>{s.value}</div>
              <div style={{ fontSize: 10, color: T.t3 }}>{s.label}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,.15)", marginTop: 2 }}>{s.unit}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── WALLET SECTION ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: .3, type: "spring", stiffness: 300, damping: 26 }}
        style={{ padding: "14px 14px 28px" }}
      >
        <h3 style={{ fontSize: 11, fontWeight: 700, color: T.t2, marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          کیف پول TON
        </h3>
        <div style={{
          padding: "16px", borderRadius: 20,
          background: T.bg2, border: "1px solid rgba(255,255,255,.05)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            borderRadius: 14,
            background: "rgba(4,3,10,.8)",
            border: `1px solid ${isConn ? "rgba(58,255,160,.18)" : "rgba(255,255,255,.05)"}`,
          }}>
            <span style={{
              fontSize: 18,
              filter: isConn ? "drop-shadow(0 0 6px rgba(58,255,160,.6))" : "none",
            }}>
              {isConn ? "✅" : "💎"}
            </span>
            <span style={{
              fontSize: 11, flex: 1, fontFamily: "monospace",
              color: isConn ? T.sapHi : T.t3,
            }}>
              {isConn ? shortAddr : "متصل نشده"}
            </span>
            {!isConn && (
              <motion.button
                whileTap={{ scale: .88 }}
                onClick={() => tcUI.openModal()} /* BUG FIX: was missing onClick */
                style={{
                  padding: "7px 16px", borderRadius: 11, fontSize: 11, fontWeight: 700,
                  cursor: "pointer", border: "none",
                  background: "linear-gradient(135deg,#082030,#0A4080)",
                  color: T.blue,
                  boxShadow: "0 0 18px rgba(96,168,255,.2)",
                }}
              >اتصال</motion.button>
            )}
            {isConn && (
              <motion.button
                whileTap={{ scale: .88 }}
                onClick={() => tcUI.disconnect()}
                style={{
                  padding: "7px 14px", borderRadius: 11, fontSize: 10, fontWeight: 700,
                  cursor: "pointer",
                  background: "rgba(255,91,91,.08)",
                  color: "#FF5B5B",
                  border: "1px solid rgba(255,91,91,.2)",
                }}
              >قطع</motion.button>
            )}
          </div>

          {isConn && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 10, display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 10,
                background: "rgba(58,255,160,.05)",
                border: "1px solid rgba(58,255,160,.12)",
              }}
            >
              <span style={{ fontSize: 10 }}>🔒</span>
              <span style={{ fontSize: 10, color: T.t2, lineHeight: 1.4 }}>
                اتصال امن از طریق TonConnect 2.0
              </span>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
