import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTonConnectUI }   from "@tonconnect/ui-react";
import { useTelegram }       from "../hooks/useTelegram";
import { useWallet }         from "../hooks/useWallet";
import { useSapBalance }     from "../hooks/useSapBalance";
import { useGameActions }    from "../hooks/useGameActions";
import { isDeployed }        from "../lib/ton";
import { LandSVG }           from "../assets/svg/LandSVG";
import type { Rarity, SlotState, SlotStage, Toast } from "../types/game";
import { RARITY_SLOTS, RARITY_LABEL, RARITY_PALETTE } from "../types/game";

const LAND_RARITY: Rarity = "Common";
const LAND_ID         = 0;
const SEED_COST       = 8;
const HARVEST_REWARD  = 10;
const TOOL_REPAIR_SAP = 5;
const REAL_CYCLE_MS   = 4 * 60 * 60 * 1000;
const DEMO_CYCLE_MS   = 30_000;

const T = {
  bg:      "#04030A",
  bg2:     "#07061A",
  bg3:     "#0D0B22",
  bg4:     "#141130",
  sap:     "#3AFFA0",
  sapDim:  "#0A2818",
  sapHi:   "#80FFD0",
  gold:    "#F7CC3C",
  goldDim: "#3D2800",
  text:    "#EDE9FF",
  t2:      "#5A6A9A",
  t3:      "#222840",
  border:  "rgba(255,255,255,0.05)",
  borderG: "rgba(58,255,160,0.18)",
  red:     "#FF5B5B",
};

function makeSlots(n: number): SlotState[] {
  return Array.from({ length: n }, () => ({ stage: "empty" as SlotStage, plantedAt: 0, harvestAt: 0 }));
}

function fmt(ms: number): string {
  if (ms <= 0) return "آماده";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

/* ── Particle Canvas ──────────────────────────────────────────────── */
interface Particle { x: number; y: number; vx: number; vy: number; r: number; life: number; maxLife: number }

function ParticleCanvas({ color }: { color: string }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let frame: number;
    let tick = 0;

    const resize = () => {
      // Use getBoundingClientRect for reliable size even before layout paint
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  || canvas.offsetWidth  || 300;
      canvas.height = rect.height || canvas.offsetHeight || 200;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const ps: Particle[] = [];
    const spawn = () => ps.push({
      x: canvas.width * (.1 + Math.random() * .8),
      y: canvas.height * (.5 + Math.random() * .4),
      vx: (Math.random() - .5) * .4,
      vy: -(0.3 + Math.random() * .8),
      r: .6 + Math.random() * 1.6,
      life: 0,
      maxLife: 60 + Math.random() * 80,
    });

    const loop = () => {
      tick++;
      if (tick % 8 === 0) spawn();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.x += p.vx; p.y += p.vy; p.life++;
        if (p.life >= p.maxLife) { ps.splice(i, 1); continue; }
        const t = p.life / p.maxLife;
        const a = t < .15 ? t / .15 : t > .75 ? (1 - t) / .25 : 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.round(a * 140).toString(16).padStart(2, "0");
        ctx.fill();
      }
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, [color]);

  return (
    <canvas ref={cvs} style={{
      position: "absolute", inset: 0,
      width: "100%", height: "100%",
      pointerEvents: "none",
    }}/>
  );
}

/* ── Toast Layer ──────────────────────────────────────────────────── */
function ToastLayer({ toasts }: { toasts: Toast[] }) {
  return (
    <div style={{
      position: "absolute", top: 56, left: 0, right: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", pointerEvents: "none", zIndex: 60, gap: 8, padding: "0 16px",
    }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ y: -8, opacity: 0, scale: .9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: .85 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            style={{
              padding: "9px 22px", borderRadius: 999, fontSize: 13, fontWeight: 700,
              background: t.positive ? "rgba(58,255,160,.12)" : "rgba(255,91,91,.12)",
              color: t.positive ? T.sapHi : T.red,
              border: `1px solid ${t.positive ? "rgba(58,255,160,.3)" : "rgba(255,91,91,.3)"}`,
              backdropFilter: "blur(20px)",
              boxShadow: t.positive
                ? "0 4px 24px rgba(58,255,160,.15)"
                : "0 4px 24px rgba(255,91,91,.15)",
            }}
          >{t.text}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ── Slot Icon SVGs ───────────────────────────────────────────────── */
function IconEmpty({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      {/* rune circle */}
      <circle cx="16" cy="16" r="12" fill="none"
        stroke={color} strokeWidth="1" strokeDasharray="4 3" opacity={.3} />
      <circle cx="16" cy="16" r="7" fill="none"
        stroke={color} strokeWidth=".8" opacity={.18} />
      {/* rune dots */}
      {[0,60,120,180,240,300].map((deg, i) => {
        const r = (deg * Math.PI) / 180;
        return <circle key={i} cx={16 + Math.cos(r)*12} cy={16 + Math.sin(r)*12}
          r={1} fill={color} opacity={.3} />;
      })}
      {/* center cross */}
      <line x1="11" y1="16" x2="21" y2="16" stroke={color} strokeWidth="1" opacity={.2} />
      <line x1="16" y1="11" x2="16" y2="21" stroke={color} strokeWidth="1" opacity={.2} />
    </svg>
  );
}

function IconGrowing({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <style>{`.sway-leaf{animation:sway 2.8s ease-in-out infinite}`}</style>
      {/* soil base */}
      <ellipse cx="16" cy="26" rx="10" ry="3.5" fill={color} opacity={.12} />
      {/* stem */}
      <path d="M16,26 C15,21 16,17 16,13"
        stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity={.9} />
      {/* stem highlight */}
      <path d="M17,26 C16.5,21 17,17 17,14"
        stroke="rgba(255,255,255,.2)" strokeWidth="1" strokeLinecap="round" fill="none" />
      {/* left leaf */}
      <g className="sway-leaf" style={{ transformOrigin: "16px 18px" }}>
        <path d="M15,20 C8,17 5,12 9,10 C12,8 15,14 15,18"
          fill={color} opacity={.85} />
        <path d="M15,20 C9,17 7,13 10,11"
          stroke="rgba(255,255,255,.15)" strokeWidth=".8" fill="none" />
      </g>
      {/* right leaf */}
      <g style={{ transformOrigin: "16px 16px", animation: "sway 2.8s .5s ease-in-out infinite" }}>
        <path d="M16,17 C22,14 26,10 23,8 C20,6 17,12 16,17"
          fill={color} opacity={.75} />
      </g>
      {/* tip glow */}
      <circle cx="16" cy="12" r="3" fill={color} opacity={.25}>
        <animate attributeName="r" values="2;4;2" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values=".2;.6;.2" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="16" cy="12" r="1.5" fill={color} opacity={.9} />
    </svg>
  );
}

function IconReady({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      {/* outer aura */}
      <circle cx="16" cy="17" r="11" fill={color} opacity={.08}>
        <animate attributeName="opacity" values=".06;.18;.06" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="r" values="10;14;10" dur="1.8s" repeatCount="indefinite" />
      </circle>
      {/* stem */}
      <path d="M16,8 C15.5,6 15,4.5 15.5,3.5"
        stroke="#4A2800" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* leaf */}
      <path d="M15.5,5 C19,3 22,5 20,8 C18,9 16,7 15.5,5"
        fill="#2A6020" opacity={.85} />
      {/* shadow */}
      <ellipse cx="17" cy="25" rx="8" ry="3" fill="rgba(0,0,0,.3)" />
      {/* fruit body with gradient */}
      <defs>
        <radialGradient id="fi-ready" cx="33%" cy="28%" r="68%">
          <stop offset="0%" stopColor="rgba(255,255,255,.9)" />
          <stop offset="32%" stopColor={color} stopOpacity={1} />
          <stop offset="80%" stopColor="#1A0800" stopOpacity={.9} />
        </radialGradient>
      </defs>
      <circle cx="16" cy="17" r="9" fill="url(#fi-ready)"
        style={{ animation: "fruit-bob 1.8s ease-in-out infinite" }} />
      {/* gloss */}
      <ellipse cx="13" cy="14" rx="3.5" ry="4.5" fill="white" opacity={.22} />
      <circle cx="12.5" cy="13" r="1.5" fill="white" opacity={.5} />
      {/* sparkles */}
      {[0, 1, 2].map(i => {
        const a = (i / 3) * Math.PI * 2;
        return <circle key={i}
          cx={16 + Math.cos(a) * 12} cy={17 + Math.sin(a) * 8}
          r={1.2} fill={color} opacity={0}>
          <animate attributeName="opacity" values="0;.9;0"
            dur="1.4s" begin={`${i * .45}s`} repeatCount="indefinite" />
        </circle>;
      })}
    </svg>
  );
}

/* ── Slot Chip ────────────────────────────────────────────────────── */
function SlotChip({ idx, slot, selected, timeLeft, onSelect, glow }: {
  idx: number; slot: SlotState; selected: boolean; timeLeft: number;
  onSelect: () => void; glow: string;
}) {
  const st      = slot.stage;
  const isReady = st === "ready";
  const accent  = isReady ? T.gold : glow;
  const prog    = st === "growing" && slot.plantedAt > 0
    ? Math.min(1, 1 - timeLeft / (slot.harvestAt - slot.plantedAt))
    : st === "ready" ? 1 : 0;
  const R = 22, C2 = Math.PI * 2 * R, offset = C2 * (1 - prog);

  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: .9 }}
      animate={{ scale: selected ? 1.06 : 1 }}
      transition={{ type: "spring" as const, stiffness: 400, damping: 28 }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
        padding: "10px 6px 8px", borderRadius: 18, border: "none",
        cursor: "pointer", flexShrink: 0, width: 72,
        background: selected
          ? isReady ? "rgba(247,204,60,.10)" : "rgba(58,255,160,.08)"
          : "rgba(255,255,255,.03)",
        outline: `1.5px solid ${selected
          ? isReady ? "rgba(247,204,60,.45)" : "rgba(58,255,160,.35)"
          : T.border}`,
        boxShadow: selected ? `0 0 28px ${accent}30` : "none",
      }}
    >
      <div style={{ position: "relative", width: 52, height: 52 }}>
        {/* progress ring */}
        <svg width="52" height="52"
          style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx="26" cy="26" r={R} fill="none"
            stroke={T.border} strokeWidth="2"/>
          {prog > 0 && (
            <circle cx="26" cy="26" r={R} fill="none"
              stroke={isReady ? T.gold : glow} strokeWidth="2.5"
              strokeDasharray={C2} strokeDashoffset={offset} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${isReady ? T.gold : glow}90)` }}
            />
          )}
        </svg>
        {/* center icon */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {st === "empty"   && <IconEmpty   color={glow} />}
          {st === "growing" && <IconGrowing color={glow} />}
          {st === "ready"   && (
            <>
              <IconReady color={T.gold} />
              {selected && (
                <span style={{
                  position: "absolute", inset: -4, borderRadius: "50%",
                  border: `1.5px solid rgba(247,204,60,.7)`,
                  animation: "pulse-ring 1.4s ease-out infinite",
                }}/>
              )}
            </>
          )}
        </div>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, fontFamily: "monospace", letterSpacing: -.3,
        color: st === "empty" ? T.t3 : isReady ? T.gold : glow,
      }}>
        {st === "empty" ? "خالی" : isReady ? "آماده!" : fmt(timeLeft)}
      </span>
      <span style={{ fontSize: 8, color: T.t3 }}>#{idx + 1}</span>
    </motion.button>
  );
}

/* ── Tool HP Bar ──────────────────────────────────────────────────── */
function ToolHP({ hp, sapNum, onRepair }: { hp: number; sapNum: number; onRepair: () => void }) {
  const col = hp > 60 ? T.sap : hp > 30 ? T.gold : T.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="18" height="18" viewBox="0 0 24 24"
        style={{ flexShrink: 0, filter: `drop-shadow(0 0 5px ${col}80)` }}>
        <path d="M15.5 2.1L13 4.6l1.4 1.4 1-1 3.6 3.6-1 1 1.4 1.4 2.5-2.5C23 7.1 23 5 21.4 3.4S16.9.7 15.5 2.1z"
          fill={col} opacity={.85} />
        <path d="M12.4 6.7L2.3 16.8c-.8.8-.8 2.1 0 2.9l2 2c.8.8 2.1.8 2.9 0l10.1-10.1L12.4 6.7z"
          fill={col} opacity={.6} />
        <circle cx="5" cy="19" r="1.2" fill={col} opacity={.9} />
      </svg>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,.05)", overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${hp}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{
            height: "100%", borderRadius: 2,
            background: hp > 60
              ? `linear-gradient(90deg, ${T.sap}, #80FFD0)`
              : hp > 30 ? `linear-gradient(90deg, #B88018, ${T.gold})`
              : `linear-gradient(90deg, #8B0000, ${T.red})`,
            boxShadow: `0 0 8px ${col}80`,
          }}
        />
      </div>
      <span style={{ fontSize: 10, fontFamily: "monospace", color: col, minWidth: 30 }}>{hp}%</span>
      {hp < 100 && (
        <motion.button
          onClick={onRepair}
          disabled={sapNum < TOOL_REPAIR_SAP}
          whileTap={{ scale: sapNum >= TOOL_REPAIR_SAP ? .9 : 1 }}
          style={{
            padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700,
            cursor: sapNum >= TOOL_REPAIR_SAP ? "pointer" : "not-allowed",
            background: sapNum >= TOOL_REPAIR_SAP ? "rgba(58,255,160,.12)" : "rgba(255,255,255,.03)",
            color: sapNum >= TOOL_REPAIR_SAP ? T.sap : T.t3,
            border: `1px solid ${sapNum >= TOOL_REPAIR_SAP ? "rgba(58,255,160,.28)" : T.border}`,
          }}
        >تعمیر</motion.button>
      )}
    </div>
  );
}

/* ── Connect Banner ───────────────────────────────────────────────── */
function ConnectBanner() {
  const [tcUI] = useTonConnectUI();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        margin: "10px 12px",
        padding: "12px 16px",
        borderRadius: 18,
        background: "rgba(58,255,160,.05)",
        border: "1px solid rgba(58,255,160,.18)",
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>🔗</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.sap, marginBottom: 2 }}>کیف پول متصل نیست</div>
        <div style={{ fontSize: 10, color: T.t2 }}>برای تراکنش واقعی کیف پول TON متصل کنید</div>
      </div>
      <motion.button
        whileTap={{ scale: .9 }}
        onClick={() => tcUI.openModal()}
        style={{
          flexShrink: 0, padding: "7px 14px", borderRadius: 12,
          fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
          background: "linear-gradient(135deg,#0A2818,#1A5A30)",
          color: T.sapHi,
          boxShadow: "0 0 16px rgba(58,255,160,.2)",
        }}
      >اتصال</motion.button>
    </motion.div>
  );
}

/* ── Action Panel ─────────────────────────────────────────────────── */
function ActionPanel({ selectedSlot, slots, sapNum, toolHP, demoMode, now, onPlant, onHarvest }: {
  selectedSlot: number | null; slots: SlotState[]; sapNum: number;
  toolHP: number; demoMode: boolean; now: number;
  onPlant: () => void; onHarvest: () => void;
}) {
  const slot = selectedSlot !== null ? slots[selectedSlot] : null;
  const st = slot?.stage ?? null;

  if (selectedSlot === null) return (
    <div style={{ textAlign: "center", padding: "20px 0 6px", color: T.t3, fontSize: 12 }}>
      یک اسلات انتخاب کنید
    </div>
  );

  if (st === "growing") {
    const tLeft = slots[selectedSlot].harvestAt - now; // BUG FIX: use reactive `now`
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 4px" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(58,255,160,.07)",
          border: "1px solid rgba(58,255,160,.2)",
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: "50%",
            border: `2.5px solid ${T.sap}`, borderTopColor: "transparent",
            animation: "spin 1.2s linear infinite",
          }}/>
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.t2, marginBottom: 3 }}>در حال رشد</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.sap, fontFamily: "monospace" }}>
            {fmt(tLeft)} مانده
          </div>
        </div>
      </div>
    );
  }

  if (st === "ready") return (
    <motion.button
      onClick={onHarvest}
      whileTap={{ scale: .96 }}
      style={{
        width: "100%", padding: "0", border: "none", cursor: "pointer",
        borderRadius: 20, overflow: "hidden", position: "relative",
        animation: "harvest-pulse 1.6s ease-in-out infinite",
      }}
    >
      <div style={{
        background: "linear-gradient(135deg,#B88018 0%,#F7CC3C 45%,#FFE060 55%,#B88018 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-gold 2.5s linear infinite",
        padding: "17px 20px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <svg width="22" height="22" viewBox="0 0 32 32">
          <defs>
            <radialGradient id="harvest-fruit" cx="33%" cy="28%" r="68%">
              <stop offset="0%" stopColor="rgba(255,255,255,.9)" />
              <stop offset="35%" stopColor="#FFD060" />
              <stop offset="100%" stopColor="#3A1800" />
            </radialGradient>
          </defs>
          <circle cx="16" cy="18" r="11" fill="url(#harvest-fruit)" />
          <ellipse cx="12" cy="14" rx="4" ry="5" fill="white" opacity={.25} />
          <path d="M16,8 C15.5,6 15,4.5 15.5,3.5" stroke="#3A2800" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M15.5,5.5 C19,3 22,5 20,8" fill="#224010" opacity={.85} />
        </svg>
        <span style={{ fontWeight: 800, fontSize: 15, color: "#1A0800", letterSpacing: .5 }}>
          برداشت — دریافت {HARVEST_REWARD} SAP
        </span>
      </div>
    </motion.button>
  );

  const can = sapNum >= SEED_COST && toolHP > 0;
  return (
    <div>
      <motion.button
        onClick={can ? onPlant : undefined}
        whileTap={can ? { scale: .96 } : {}}
        style={{
          width: "100%", padding: "0", border: "none",
          cursor: can ? "pointer" : "not-allowed", borderRadius: 20,
          overflow: "hidden", position: "relative",
          opacity: can ? 1 : .45, transition: "opacity .25s",
          animation: can ? "plant-pulse 2s ease-in-out infinite" : "none",
        }}
      >
        <div style={{
          background: can
            ? "linear-gradient(135deg,#082814 0%,#165828 45%,#1E7A36 55%,#082814 100%)"
            : "rgba(20,18,40,.8)",
          backgroundSize: "200% 100%",
          animation: can ? "shimmer-green 3s linear infinite" : "none",
          padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          outline: `1px solid ${can ? "rgba(58,255,160,.22)" : T.border}`,
          borderRadius: 20,
        }}>
          {/* seed icon */}
          <svg width="20" height="20" viewBox="0 0 32 32">
            <circle cx="16" cy="18" r="8" fill={can ? "#3AFFA0" : T.t3} opacity={.25}>
              <animate attributeName="opacity" values=".2;.5;.2" dur="2s" repeatCount="indefinite" />
            </circle>
            <ellipse cx="16" cy="21" rx="5" ry="2" fill="rgba(0,0,0,.3)" />
            <path d="M16,18 C15,14 15.5,10 16,8" stroke={can ? "#3AFFA0" : T.t3}
              strokeWidth="2.5" strokeLinecap="round" fill="none" opacity={can ? .9 : .5} />
            <path d="M15,14 C10,12 7,8 10,6 C13,4 15,10 15,14"
              fill={can ? "#2A9040" : T.t3} opacity={can ? .85 : .4} />
            <path d="M16,13 C20,11 24,8 22,5 C20,3 17,9 16,13"
              fill={can ? "#2A9040" : T.t3} opacity={can ? .75 : .3} />
            <circle cx="16" cy="8" r="2.5" fill={can ? "#3AFFA0" : T.t3} opacity={can ? .8 : .3} />
          </svg>
          <span style={{
            fontWeight: 700, fontSize: 15,
            color: can ? "#D4FFE8" : T.t3,
            letterSpacing: .3,
          }}>
            کاشت Lumen Apple — {SEED_COST} SAP
          </span>
        </div>
      </motion.button>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold, display: "block",
            boxShadow: `0 0 6px ${T.gold}` }} />
          <span style={{ fontSize: 10, color: T.t3 }}>
            بازده: <span style={{ color: T.gold }}>+{HARVEST_REWARD} SAP</span>
          </span>
        </div>
        <span style={{ fontSize: 10, color: T.t3 }}>
          زمان: <span style={{ color: T.t2 }}>{demoMode ? "۳۰ ثانیه" : "۴ ساعت"}</span>
        </span>
      </div>

      {!can && sapNum < SEED_COST && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          justifyContent: "center", marginTop: 8,
          padding: "6px 14px", borderRadius: 10,
          background: "rgba(255,91,91,.05)",
          border: "1px solid rgba(255,91,91,.15)",
        }}>
          <span style={{ fontSize: 10 }}>⚠</span>
          <span style={{ fontSize: 10, color: T.red }}>موجودی کافی نیست — نیاز: {SEED_COST} SAP</span>
        </div>
      )}
      {!can && toolHP === 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          justifyContent: "center", marginTop: 8,
          padding: "6px 14px", borderRadius: 10,
          background: "rgba(255,91,91,.05)",
          border: "1px solid rgba(255,91,91,.15)",
        }}>
          <span style={{ fontSize: 10 }}>🔧</span>
          <span style={{ fontSize: 10, color: T.red }}>ابزار خراب — از بالا تعمیر کن</span>
        </div>
      )}
    </div>
  );
}

/* ── SAP Balance Badge ────────────────────────────────────────────── */
function SapBadge({ value, live, glow }: { value: string; live: boolean; glow: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7, padding: "5px 13px",
      borderRadius: 999,
      background: "rgba(58,255,160,.07)",
      border: "1px solid rgba(58,255,160,.2)",
    }}>
      <motion.span
        animate={{ boxShadow: [`0 0 6px ${glow}`, `0 0 14px ${glow}`, `0 0 6px ${glow}`] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: 7, height: 7, borderRadius: "50%", background: glow, flexShrink: 0 }}
      />
      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -6, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            fontSize: 14, fontWeight: 800, fontFamily: "monospace", color: glow,
            textShadow: `0 0 12px ${glow}60`,
          }}
        >{value}</motion.span>
      </AnimatePresence>
      <span style={{ fontSize: 10, color: T.t2 }}>SAP</span>
      {live && (
        <span style={{
          fontSize: 8, color: T.sap, padding: "1px 5px", borderRadius: 4,
          background: "rgba(58,255,160,.12)", border: "1px solid rgba(58,255,160,.2)",
        }}>LIVE</span>
      )}
    </div>
  );
}

/* ── Stat Card ────────────────────────────────────────────────────── */
function StatCard({ label, val, iconSvg, col }: { label: string; val: string; iconSvg: React.ReactNode; col: string }) {
  return (
    <div style={{
      flex: 1, padding: "10px 8px 10px", borderRadius: 16, textAlign: "center",
      background: "rgba(13,11,34,.7)",
      border: "1px solid rgba(255,255,255,.05)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 40, height: 20,
        background: `radial-gradient(ellipse, ${col}18 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 5 }}>{iconSvg}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: col, marginBottom: 2,
        textShadow: `0 0 12px ${col}60` }}>{val}</div>
      <div style={{ fontSize: 9, color: T.t3 }}>{label}</div>
    </div>
  );
}

/* ── Main FarmPage ────────────────────────────────────────────────── */
export default function FarmPage() {
  const { user }  = useTelegram();
  const wallet    = useWallet();
  const actions   = useGameActions();
  const pal       = RARITY_PALETTE[LAND_RARITY];
  const slotCount = RARITY_SLOTS[LAND_RARITY];

  const { balance: chainBalance, refresh: refreshBalance } = useSapBalance(wallet.address);
  const [localSap, setLocalSap] = useState(50);
  const useReal    = wallet.isConnected && isDeployed();
  const sapDisplay = useReal ? chainBalance : localSap.toString();
  const sapNum     = parseFloat(sapDisplay) || 0;

  const [toolHP,  setToolHP]  = useState(() => {
    const s = sessionStorage.getItem("lumoria_toolHP");
    return s ? Number(s) : 100;
  });
  const [slots,   setSlots]   = useState<SlotState[]>(() => {
    try {
      const s = sessionStorage.getItem("lumoria_slots");
      if (s) return JSON.parse(s) as SlotState[];
    } catch { /* ignore */ }
    return makeSlots(slotCount);
  });
  const [selSlot, setSelSlot] = useState<number | null>(null);
  const [toasts,  setToasts]  = useState<Toast[]>([]);
  const [demo,    setDemo]    = useState(true);
  const [txBusy,  setTxBusy]  = useState(false);
  const [now,     setNow]     = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    sessionStorage.setItem("lumoria_slots", JSON.stringify(slots));
  }, [slots]);

  useEffect(() => {
    sessionStorage.setItem("lumoria_toolHP", String(toolHP));
  }, [toolHP]);

  useEffect(() => {
    setSlots(prev => {
      const next = prev.map(s =>
        s.stage === "growing" && now >= s.harvestAt ? { ...s, stage: "ready" as SlotStage } : s
      );
      const newReady = next.findIndex((s, i) => s.stage === "ready" && prev[i].stage !== "ready");
      if (newReady !== -1) setSelSlot(newReady);
      return next;
    });
  }, [now]);

  const toast = useCallback((text: string, positive = true) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, positive }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2400);
  }, []);

  const handlePlant = async () => {
    if (selSlot === null) return;
    if (sapNum < SEED_COST) { toast("موجودی کافی نیست", false); return; }
    if (toolHP <= 0) { toast("ابزار خراب!", false); return; }

    if (useReal) {
      setTxBusy(true);
      toast("ارسال تراکنش...");
      const r = await actions.plant(LAND_ID, selSlot);
      setTxBusy(false);
      if (!r.ok) { if (r.error) toast(r.error, false); return; }
      const t0 = Date.now();
      setSlots(prev => prev.map((s, i) =>
        i === selSlot ? { stage: "growing" as SlotStage, plantedAt: t0, harvestAt: t0 + REAL_CYCLE_MS } : s
      ));
      setToolHP(h => Math.max(0, h - 1));
      toast("بذر کاشته شد 🌱");
      setTimeout(refreshBalance, 10_000);
      return;
    }
    const cycle = demo ? DEMO_CYCLE_MS : REAL_CYCLE_MS;
    const t0 = Date.now();
    setLocalSap(s => s - SEED_COST);
    setToolHP(h => Math.max(0, h - 1));
    setSlots(prev => prev.map((s, i) => i === selSlot ? { stage: "growing", plantedAt: t0, harvestAt: t0 + cycle } : s));
    toast(`-${SEED_COST} SAP · بذر کاشته شد 🌱`);
  };

  const handleHarvest = async () => {
    if (selSlot === null) return;

    if (useReal) {
      setTxBusy(true);
      toast("ارسال تراکنش برداشت...");
      const r = await actions.harvest(LAND_ID, selSlot);
      setTxBusy(false);
      if (!r.ok) { if (r.error) toast(r.error, false); return; }
      toast(`+${HARVEST_REWARD} SAP در حال مینت... ✓`);
      setSlots(prev => prev.map((s, i) => i === selSlot ? { stage: "empty", plantedAt: 0, harvestAt: 0 } : s));
      setSelSlot(null);
      setTimeout(refreshBalance, 12_000);
      return;
    }
    setLocalSap(s => s + HARVEST_REWARD);
    setSlots(prev => prev.map((s, i) => i === selSlot ? { stage: "empty", plantedAt: 0, harvestAt: 0 } : s));
    toast(`+${HARVEST_REWARD} SAP دریافت شد 🍎`);
    setSelSlot(null);
  };

  const handleRepair = async () => {
    if (sapNum < TOOL_REPAIR_SAP) { toast(`نیاز به ${TOOL_REPAIR_SAP} SAP`, false); return; }

    if (useReal) {
      setTxBusy(true);
      toast("ارسال تراکنش تعمیر...");
      const r = await actions.repair(LAND_ID);
      setTxBusy(false);
      if (!r.ok) { if (r.error) toast(r.error, false); return; }
      toast("ابزار تعمیر شد 🔧");
      setToolHP(100);
      setTimeout(refreshBalance, 8_000);
      return;
    }
    setLocalSap(s => s - TOOL_REPAIR_SAP);
    setToolHP(100);
    toast(`-${TOOL_REPAIR_SAP} SAP · ابزار تعمیر شد 🔧`);
  };

  const glow       = pal.glow;
  const slotStages = slots.map(s => s.stage);
  const hasReady   = slots.some(s => s.stage === "ready");

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: T.bg, position: "relative", overflow: "hidden",
    }}>
      <ParticleCanvas color={glow}/>
      <ToastLayer toasts={toasts}/>

      {/* ── INNER HEADER ───────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0, height: 52, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 14px", zIndex: 10,
        background: "rgba(4,3,10,.9)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,.04)",
      }}>
        <SapBadge value={sapDisplay} live={useReal} glow={glow}/>

        {/* Rarity */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5, padding: "4px 11px",
          borderRadius: 999, background: "rgba(255,255,255,.03)",
          border: `1px solid rgba(255,255,255,.06)`,
          fontSize: 9, color: T.t2, letterSpacing: 1,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: pal.ring, display: "block",
            boxShadow: `0 0 6px ${pal.ring}` }}/>
          {RARITY_LABEL[LAND_RARITY].split(" — ")[0]}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!useReal && (
            <motion.button
              whileTap={{ scale: .88 }}
              onClick={() => setDemo(d => !d)}
              style={{
                padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                cursor: "pointer",
                border: `1px solid ${demo ? "rgba(58,255,160,.25)" : "rgba(255,255,255,.08)"}`,
                background: demo ? "rgba(58,255,160,.07)" : "rgba(255,255,255,.03)",
                color: demo ? glow : T.t3,
              }}
            >{demo ? "⚡ دمو" : "• کند"}</motion.button>
          )}
          {txBusy && (
            <div style={{ width: 16, height: 16, borderRadius: "50%",
              border: `2px solid ${T.sap}`, borderTopColor: "transparent",
              animation: "spin 1s linear infinite" }}/>
          )}
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: glow,
            background: "rgba(13,11,34,.9)",
            border: `1px solid rgba(58,255,160,.22)`,
            boxShadow: "0 0 12px rgba(58,255,160,.1)",
          }}>
            {user?.first_name?.[0] ?? "ن"}
          </div>
        </div>
      </header>

      {/* ── SCROLLABLE BODY ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", minHeight: 0 }}>

        {!wallet.isConnected && <ConnectBanner/>}

        {/* LAND SCENE */}
        <div style={{
          position: "relative", margin: "10px 10px 0", borderRadius: 22, overflow: "hidden",
          background: `radial-gradient(ellipse 80% 60% at 50% 85%, ${glow}14 0%, transparent 65%),
                       linear-gradient(180deg, rgba(13,11,34,.95) 0%, ${T.bg} 100%)`,
          border: `1px solid rgba(255,255,255,.05)`,
        }}>
          {hasReady && (
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse 60% 40% at 50% 70%, rgba(247,204,60,.06), transparent 65%)",
              animation: "breathe 2s ease-in-out infinite",
            }}/>
          )}
          <LandSVG
            rarity={LAND_RARITY}
            fertility={toolHP}
            slots={slotStages}
            selectedSlot={selSlot}
          />
        </div>

        {/* SLOT CHIPS + TOOL HP */}
        <div style={{
          margin: "10px 10px 0", padding: "14px",
          borderRadius: 20,
          background: "rgba(13,11,34,.8)",
          border: "1px solid rgba(255,255,255,.05)",
          backdropFilter: "blur(16px)",
        }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", overflowX: "auto", paddingBottom: 2 }}>
            {slots.map((slot, i) => (
              <SlotChip key={i} idx={i} slot={slot}
                selected={selSlot === i}
                timeLeft={slot.harvestAt - now}
                glow={glow}
                onSelect={() => setSelSlot(p => p === i ? null : i)}
              />
            ))}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,.04)", margin: "12px 0" }}/>
          <ToolHP hp={toolHP} sapNum={sapNum} onRepair={handleRepair}/>
        </div>

        {/* STATS ROW */}
        <div style={{ display: "flex", gap: 6, padding: "8px 10px 10px" }}>
          <StatCard label="برداشت" val="۰ SAP" col={T.sap} iconSvg={
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M12 3C8 3 5 6 5 10c0 5 7 11 7 11s7-6 7-11c0-4-3-7-7-7z"
                fill={T.sap} opacity={.3} />
              <circle cx="12" cy="10" r="3" fill={T.sap} opacity={.8} />
              <circle cx="12" cy="10" r="1.5" fill={T.sapHi} />
            </svg>
          }/>
          <StatCard label="سوزانده" val="۰ SAP" col={T.gold} iconSvg={
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M12 2C9 6 8 8 10 11C8 10 7 8 8 5C5 8 4 12 6 16C8 20 12 22 12 22S16 20 18 16C20 12 19 8 16 5C17 8 16 10 14 11C16 8 15 6 12 2Z"
                fill={T.gold} opacity={.75} />
              <ellipse cx="12" cy="18" rx="3" ry="1.5" fill={T.gold} opacity={.4} />
            </svg>
          }/>
          <StatCard label="رتبه" val={RARITY_LABEL[LAND_RARITY].split(" — ")[0]} col={pal.glow} iconSvg={
            <svg width="18" height="18" viewBox="0 0 24 24">
              <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"
                fill={pal.glow} opacity={.7} />
              <polygon points="12,5 14,10 19,10 15.5,13 17,18 12,15 7,18 8.5,13 5,10 10,10"
                fill={pal.glow} opacity={.4} />
              <circle cx="12" cy="12" r="2.5" fill={pal.soil} />
            </svg>
          }/>
        </div>
      </div>

      {/* ── ACTION PANEL ───────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: "10px 14px 12px",
        background: "rgba(4,3,10,.96)",
        backdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,.05)",
        boxShadow: `0 -16px 40px ${T.bg}E0`,
      }}>
        <ActionPanel
          selectedSlot={selSlot} slots={slots}
          sapNum={sapNum} toolHP={toolHP}
          demoMode={demo} now={now}
          onPlant={handlePlant} onHarvest={handleHarvest}
        />
      </div>
    </div>
  );
}
