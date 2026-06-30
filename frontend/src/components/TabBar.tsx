import type { ReactElement } from "react";
import { motion } from "framer-motion";

type Tab = "farm" | "lands" | "shop" | "profile";

const TABS: { id: Tab; label: string; icon: (on: boolean) => ReactElement }[] = [
  {
    id: "farm", label: "مزرعه",
    icon: (on) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 3C7.5 3 3.5 7 3.5 11.5c0 5.5 8.5 12.5 8.5 12.5s8.5-7 8.5-12.5C20.5 7 16.5 3 12 3z"
          stroke="currentColor" strokeWidth={on ? "2" : "1.5"} fill={on ? "currentColor" : "none"} fillOpacity=".15"/>
        <circle cx="12" cy="11" r="2.5"
          stroke="currentColor" strokeWidth={on ? "2" : "1.5"} fill={on ? "currentColor" : "none"} fillOpacity=".25"/>
      </svg>
    ),
  },
  {
    id: "lands", label: "زمین‌ها",
    icon: (on) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7.5" height="7.5" rx="2"
          stroke="currentColor" strokeWidth={on ? "2" : "1.5"} fill={on ? "currentColor" : "none"} fillOpacity=".15"/>
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2"
          stroke="currentColor" strokeWidth={on ? "2" : "1.5"} fill={on ? "currentColor" : "none"} fillOpacity=".15"/>
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2"
          stroke="currentColor" strokeWidth={on ? "2" : "1.5"} fill={on ? "currentColor" : "none"} fillOpacity=".15"/>
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"
          stroke="currentColor" strokeWidth={on ? "2" : "1.5"} fill={on ? "currentColor" : "none"} fillOpacity=".15"/>
      </svg>
    ),
  },
  {
    id: "shop", label: "بازار",
    icon: (on) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
          stroke="currentColor" strokeWidth={on ? "2" : "1.5"} fill={on ? "currentColor" : "none"} fillOpacity=".15"/>
        <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth={on ? "2" : "1.5"}/>
        <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth={on ? "2" : "1.5"}/>
      </svg>
    ),
  },
  {
    id: "profile", label: "پروفایل",
    icon: (on) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
          stroke="currentColor" strokeWidth={on ? "2" : "1.5"} fill={on ? "currentColor" : "none"} fillOpacity=".1"/>
        <circle cx="12" cy="7" r="4"
          stroke="currentColor" strokeWidth={on ? "2" : "1.5"} fill={on ? "currentColor" : "none"} fillOpacity=".2"/>
      </svg>
    ),
  },
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-around",
      height: 64, flexShrink: 0,
      background: "rgba(4,3,10,0.96)",
      backdropFilter: "blur(24px)",
      borderTop: "1px solid rgba(255,255,255,0.05)",
      paddingBottom: "env(safe-area-inset-bottom)",
      position: "relative", zIndex: 20,
    }}>
      {TABS.map(t => {
        const on = active === t.id;
        return (
          <motion.button
            key={t.id}
            onClick={() => onChange(t.id)}
            whileTap={{ scale: 0.88 }}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, padding: "6px 0", border: "none", background: "none",
              cursor: "pointer", position: "relative",
              color: on ? "#3AFFA0" : "#2A3050",
              transition: "color 0.25s ease",
            }}
          >
            {/* Active glow halo */}
            {on && (
              <motion.div
                layoutId="tab-halo"
                style={{
                  position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
                  width: 40, height: 40, borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(58,255,160,0.12) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 38 }}
              />
            )}

            <motion.div
              animate={{ scale: on ? 1.1 : 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{ filter: on ? "drop-shadow(0 0 8px rgba(58,255,160,0.6))" : "none" }}
            >
              {t.icon(on)}
            </motion.div>

            <span style={{
              fontSize: 10, fontWeight: on ? 700 : 400,
              letterSpacing: 0.3,
            }}>
              {t.label}
            </span>

            {/* Active underline pill */}
            {on && (
              <motion.span
                layoutId="tab-pill"
                style={{
                  position: "absolute", bottom: 0, left: "50%", translateX: "-50%",
                  width: 28, height: 2, borderRadius: 1,
                  background: "#3AFFA0",
                  boxShadow: "0 0 10px rgba(58,255,160,0.8)",
                }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </motion.button>
        );
      })}
    </nav>
  );
}
