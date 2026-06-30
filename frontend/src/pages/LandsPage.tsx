import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { LandSVG } from "../assets/svg/LandSVG";
import type { Rarity } from "../types/game";
import { RARITY_SLOTS } from "../types/game";

const T = {
  bg:     "#04030A",
  bg2:    "#0D0B22",
  text:   "#EDE9FF",
  t2:     "#5A6A9A",
  t3:     "#222840",
  sap:    "#3AFFA0",
  border: "rgba(255,255,255,0.05)",
};

const PAL_RING: Record<Rarity, string> = {
  Common:    "#3AFFA0", Uncommon: "#00C896", Rare: "#E05A1A",
  Epic:      "#1060E0", Legendary: "#E09000", Mythic: "#7050D0",
};
const PAL_GLOW: Record<Rarity, string> = {
  Common:    "#3AFFA0", Uncommon: "#3DFFC0", Rare: "#FF8C42",
  Epic:      "#60A0FF", Legendary: "#FFD060", Mythic: "#C0A0FF",
};
const PAL_SLOTS_BADGE: Record<Rarity, string> = {
  Common: "#0A2818", Uncommon: "#0A2818", Rare: "#3A1A08",
  Epic: "#08103A", Legendary: "#2A1C00", Mythic: "#14082A",
};

const AVAILABLE: { rarity: Rarity; price: string; supply: string; desc: string }[] = [
  { rarity: "Common",    price: "۰.۵ TON",   supply: "نامحدود",  desc: "دشت‌های خاک آرام" },
  { rarity: "Uncommon",  price: "۲ TON",     supply: "نامحدود",  desc: "جنگل خزه‌ای سرسبز" },
  { rarity: "Rare",      price: "۱۰ TON",    supply: "۲۵۰,۰۰۰", desc: "دره آتشین پرتلاطم" },
  { rarity: "Epic",      price: "۵۰ TON",    supply: "۷۵,۰۰۰",  desc: "عمق بلورین یخی" },
  { rarity: "Legendary", price: "۲۰۰ TON",   supply: "۵,۰۰۰",   desc: "باغ طلایی ابدی" },
  { rarity: "Mythic",    price: "۱,۰۰۰ TON", supply: "۵۰۰",     desc: "پرتال خلأ کیهانی" },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const itemVariants: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 28 } },
};

export default function LandsPage() {
  return (
    <div style={{
      height: "100%",
      background: `linear-gradient(180deg, #04030A 0%, #07061A 100%)`,
      overflowY: "auto",
    }}>
      {/* ── MY LANDS ─────────────────────────────────────────────── */}
      <section style={{ padding: "18px 14px 10px" }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: T.t2, marginBottom: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          زمین‌های من
        </h3>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {/* Owned land card */}
          <motion.div
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: .97 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            style={{
              flexShrink: 0, width: 156, borderRadius: 22, overflow: "hidden",
              background: "rgba(13,11,34,.9)",
              border: `1px solid ${PAL_RING["Common"]}28`,
              boxShadow: `0 0 28px ${PAL_GLOW["Common"]}0E, 0 8px 32px rgba(0,0,0,.4)`,
              cursor: "pointer",
            }}
          >
            <div style={{ position: "relative" }}>
              <LandSVG rarity="Common" slots={["empty", "empty"]}/>
              {/* NFT badge */}
              <div style={{
                position: "absolute", top: 8, left: 8,
                padding: "2px 7px", borderRadius: 6,
                background: "rgba(58,255,160,.15)",
                border: "1px solid rgba(58,255,160,.3)",
                fontSize: 8, fontWeight: 700, color: T.sap,
                letterSpacing: 1,
              }}>NFT</div>
            </div>
            <div style={{ padding: "8px 12px 12px" }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: PAL_GLOW["Common"] }}>Common Land</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{
                  fontSize: 9, color: T.sap, padding: "2px 7px", borderRadius: 6,
                  background: PAL_SLOTS_BADGE["Common"],
                }}>
                  {RARITY_SLOTS["Common"]} اسلات
                </span>
                <span style={{ fontSize: 9, color: T.t3, fontFamily: "monospace" }}>#001</span>
              </div>
            </div>
          </motion.div>

          {/* Add land button */}
          <motion.div
            whileHover={{ scale: 1.02, borderColor: "rgba(58,255,160,.35)" }}
            whileTap={{ scale: .96 }}
            style={{
              flexShrink: 0, width: 110, borderRadius: 22, minHeight: 160,
              background: "rgba(13,11,34,.5)",
              border: "1px dashed rgba(58,255,160,.14)",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 8, cursor: "pointer",
              transition: "border-color .2s",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(58,255,160,.07)",
              border: "1px solid rgba(58,255,160,.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: "rgba(58,255,160,.4)",
            }}>＋</div>
            <span style={{ fontSize: 10, color: T.t3 }}>خرید زمین</span>
          </motion.div>
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,.04)", margin: "2px 14px" }}/>

      {/* ── MARKET ───────────────────────────────────────────────── */}
      <section style={{ padding: "14px 14px 24px" }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: T.t2, marginBottom: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          خرید زمین جدید
        </h3>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {AVAILABLE.map(a => (
            <motion.div
              key={a.rarity}
              variants={itemVariants}
              whileHover={{ x: 2, boxShadow: `0 0 28px ${PAL_GLOW[a.rarity]}14` }}
              whileTap={{ scale: .98 }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 18,
                background: "rgba(13,11,34,.8)",
                border: `1px solid ${PAL_RING[a.rarity]}18`,
                cursor: "pointer",
                transition: "box-shadow .2s",
              }}
            >
              {/* Glow orb */}
              <div style={{
                width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                background: `radial-gradient(circle at 38% 38%, ${PAL_GLOW[a.rarity]}30, ${PAL_RING[a.rarity]}14)`,
                border: `1px solid ${PAL_RING[a.rarity]}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <motion.span
                  animate={{ boxShadow: [`0 0 8px ${PAL_GLOW[a.rarity]}80`, `0 0 16px ${PAL_GLOW[a.rarity]}`, `0 0 8px ${PAL_GLOW[a.rarity]}80`] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: 14, height: 14, borderRadius: "50%", background: PAL_GLOW[a.rarity], display: "block" }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: PAL_GLOW[a.rarity] }}>{a.rarity}</p>
                <p style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>{a.desc}</p>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <span style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 5,
                    background: "rgba(255,255,255,.04)", color: T.t2,
                  }}>{RARITY_SLOTS[a.rarity]} اسلات</span>
                  <span style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 5,
                    background: "rgba(255,255,255,.04)", color: T.t2,
                  }}>عرضه: {a.supply}</span>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: .88 }}
                style={{
                  padding: "8px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                  cursor: "pointer", flexShrink: 0,
                  background: `${PAL_GLOW[a.rarity]}14`,
                  color: PAL_GLOW[a.rarity],
                  border: `1px solid ${PAL_GLOW[a.rarity]}35`,
                }}
              >{a.price}</motion.button>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
