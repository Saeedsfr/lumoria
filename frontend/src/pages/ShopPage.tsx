import { motion } from "framer-motion";
import type { Variants } from "framer-motion";

const T = {
  bg:     "#04030A",
  bg2:    "rgba(13,11,34,.85)",
  text:   "#EDE9FF",
  t2:     "#5A6A9A",
  t3:     "#222840",
  sap:    "#3AFFA0",
  gold:   "#F7CC3C",
  blue:   "#60A8FF",
  purple: "#C0A0FF",
  border: "rgba(255,255,255,.05)",
};

const ITEMS: {
  name: string; cost: string; reward: string; icon: string;
  color: string; avail: boolean; tag?: string;
}[] = [
  { name: "بذر Lumen Apple",   cost: "8 SAP",  reward: "+10 SAP در ۴ ساعت", icon: "🌱", color: "#3AFFA0", avail: true },
  { name: "ابزار برنزی",       cost: "20 SAP", reward: "HP کامل",            icon: "🔧", color: "#F7CC3C", avail: true },
  { name: "بذر Dusk Mushroom", cost: "15 SAP", reward: "+18 SAP در ۸ ساعت", icon: "🍄", color: "#C0A0FF", avail: false, tag: "به‌زودی" },
  { name: "کود بیولومین",      cost: "25 SAP", reward: "چرخه ×۱.۵",          icon: "✨", color: "#3DFFC0", avail: false, tag: "به‌زودی" },
  { name: "تقویت ریشه",        cost: "40 SAP", reward: "+۱ اسلات موقت",      icon: "🌿", color: "#3AFFA0", avail: false, tag: "به‌زودی" },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const itemVariants: Variants = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 320, damping: 28 } },
};

export default function ShopPage() {
  return (
    <div style={{
      height: "100%",
      background: "linear-gradient(180deg, #04030A 0%, #07061A 100%)",
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ padding: "18px 16px 12px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: T.text }}>بازار Lumoria</h2>
        <p style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>
          اقلام بازی با SAP خریداری می‌شوند
        </p>
      </div>

      {/* Items */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 10 }}
      >
        {ITEMS.map((item, i) => (
          <motion.div
            key={i}
            variants={itemVariants}
            whileHover={item.avail ? { x: 2, boxShadow: `0 0 28px ${item.color}14` } : {}}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "13px 16px", borderRadius: 20,
              background: T.bg2,
              border: `1px solid ${item.avail ? item.color + "22" : "rgba(255,255,255,.04)"}`,
              opacity: item.avail ? 1 : .55,
              transition: "box-shadow .2s",
            }}
          >
            {/* Icon tile */}
            <div style={{
              width: 48, height: 48, borderRadius: 15, flexShrink: 0,
              background: `radial-gradient(circle at 38% 38%, ${item.color}20, ${item.color}08)`,
              border: `1px solid ${item.color}28`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, position: "relative",
            }}>
              {item.icon}
              {!item.avail && item.tag && (
                <div style={{
                  position: "absolute", top: -6, right: -6,
                  padding: "2px 5px", borderRadius: 5,
                  background: "rgba(13,11,34,.9)",
                  border: "1px solid rgba(255,255,255,.1)",
                  fontSize: 7, fontWeight: 700, color: T.t2,
                  whiteSpace: "nowrap",
                }}>{item.tag}</div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{item.name}</p>
              <p style={{ fontSize: 10, color: item.color, marginTop: 3 }}>
                بازده: {item.reward}
              </p>
            </div>

            <motion.button
              disabled={!item.avail}
              whileTap={item.avail ? { scale: .88 } : {}}
              style={{
                padding: "8px 14px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                cursor: item.avail ? "pointer" : "default", flexShrink: 0,
                background: item.avail ? `${item.color}16` : "rgba(255,255,255,.03)",
                color: item.avail ? item.color : T.t3,
                border: `1px solid ${item.avail ? item.color + "38" : "rgba(255,255,255,.06)"}`,
              }}
            >{item.avail ? item.cost : "زود"}</motion.button>
          </motion.div>
        ))}
      </motion.div>

      {/* NFT Marketplace Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: .35, type: "spring", stiffness: 280, damping: 26 }}
        style={{
          margin: "16px 14px 24px", padding: "20px 18px",
          borderRadius: 22,
          background: "radial-gradient(ellipse at 50% 0%, rgba(96,168,255,.08) 0%, rgba(13,11,34,.9) 70%)",
          border: "1px solid rgba(96,168,255,.14)",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* glow orb behind */}
        <div style={{
          position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)",
          width: 100, height: 60,
          background: "radial-gradient(ellipse, rgba(96,168,255,.15), transparent 70%)",
          pointerEvents: "none",
        }}/>

        <div style={{ fontSize: 28, marginBottom: 10 }}>💎</div>
        <p style={{ fontSize: 14, fontWeight: 800, color: T.blue }}>بازار NFT زمین</p>
        <p style={{ fontSize: 11, color: T.t3, marginTop: 5, lineHeight: 1.5 }}>
          خرید و فروش زمین‌های NFT در TON blockchain
        </p>
        <div style={{
          marginTop: 14, display: "inline-block",
          padding: "8px 22px", borderRadius: 999,
          background: "rgba(96,168,255,.1)",
          border: "1px solid rgba(96,168,255,.25)",
          fontSize: 11, fontWeight: 700, color: T.blue,
        }}>به‌زودی</div>
      </motion.div>
    </div>
  );
}
