import React from "react";
import type { Rarity, SlotStage } from "../../types/game";

/* ──────────────────────────────────────────────────────────────────
   VOID GARDEN — Crystalline Isometric Land Platform
   ViewBox: 0 0 380 320
   Top-face diamond: N(190,78) E(342,168) S(190,258) W(38,168)
   Side-depth: 46px
   Slot formula: iso(s,t) → [190+(s-t)*152, 78+(s+t)*90]
────────────────────────────────────────────────────────────────── */

interface Pal {
  /* platform */
  topDark: string; topMid: string; topLight: string;
  sideL: string;   sideR: string;
  edge:  string;
  /* plant */
  glow:  string;   glowDim: string;
  bark:  string;   barkHi: string;
  leaf:  string;   leafHi: string;   leafTip: string;
  soil:  string;   crystal: string;
  /* fruit */
  fruitCore: string; fruitHi: string;
}

const PAL: Record<Rarity, Pal> = {
  Common: {
    topDark:"#0A130A", topMid:"#162416", topLight:"#1E3420",
    sideL:"#040804",   sideR:"#0A100A",
    edge:"#3AFFA0",
    glow:"#3AFFA0",    glowDim:"#0A2818",
    bark:"#1C3C12",    barkHi:"#2A6020",
    leaf:"#1A5C1A",    leafHi:"#2A9040",   leafTip:"#60FF90",
    soil:"#0C1A0C",    crystal:"#48FFB0",
    fruitCore:"#3AFFA0", fruitHi:"#C8FFF0",
  },
  Uncommon: {
    topDark:"#071310", topMid:"#0F2820", topLight:"#163628",
    sideL:"#030806",   sideR:"#080F0C",
    edge:"#3DFFC0",
    glow:"#3DFFC0",    glowDim:"#071A12",
    bark:"#0A3022",    barkHi:"#188060",
    leaf:"#0E4A36",    leafHi:"#1A7A58",   leafTip:"#44FFD0",
    soil:"#081410",    crystal:"#40FFCC",
    fruitCore:"#3DFFC0", fruitHi:"#B8FFF0",
  },
  Rare: {
    topDark:"#150805", topMid:"#281408", topLight:"#3C1E0A",
    sideL:"#080402",   sideR:"#140A04",
    edge:"#FF8C42",
    glow:"#FF8C42",    glowDim:"#3A1808",
    bark:"#4A200A",    barkHi:"#884020",
    leaf:"#6A2A0E",    leafHi:"#A84020",   leafTip:"#FFA060",
    soil:"#180A04",    crystal:"#FF9060",
    fruitCore:"#FF8C42", fruitHi:"#FFD4A8",
  },
  Epic: {
    topDark:"#060A1C", topMid:"#0C1440", topLight:"#101A5A",
    sideL:"#020408",   sideR:"#080C1C",
    edge:"#60A0FF",
    glow:"#60A0FF",    glowDim:"#060D28",
    bark:"#0C1A58",    barkHi:"#1A40A0",
    leaf:"#0E2070",    leafHi:"#1A3AA8",   leafTip:"#80C0FF",
    soil:"#060810",    crystal:"#5090FF",
    fruitCore:"#60A0FF", fruitHi:"#C0DCFF",
  },
  Legendary: {
    topDark:"#120A00", topMid:"#241400", topLight:"#381C00",
    sideL:"#060300",   sideR:"#120800",
    edge:"#FFD060",
    glow:"#FFD060",    glowDim:"#2A1800",
    bark:"#3C2400",    barkHi:"#7A5000",
    leaf:"#5A3200",    leafHi:"#906000",   leafTip:"#FFE080",
    soil:"#140A00",    crystal:"#FFD040",
    fruitCore:"#FFD060", fruitHi:"#FFF0B0",
  },
  Mythic: {
    topDark:"#0A041A", topMid:"#140830", topLight:"#1E0C46",
    sideL:"#040210",   sideR:"#0C061C",
    edge:"#C0A0FF",
    glow:"#C0A0FF",    glowDim:"#120828",
    bark:"#260A48",    barkHi:"#481880",
    leaf:"#340C5C",    leafHi:"#581A8E",   leafTip:"#D090FF",
    soil:"#0A0618",    crystal:"#B090FF",
    fruitCore:"#C0A0FF", fruitHi:"#F0E0FF",
  },
};

/* iso coordinate helper */
function iso(s: number, t: number): [number, number] {
  return [Math.round(190 + (s - t) * 152), Math.round(78 + (s + t) * 90)];
}

const SLOTS: Record<number, [number, number][]> = {
  2:  [iso(.28,.52), iso(.72,.52)],
  3:  [iso(.5,.22), iso(.18,.70), iso(.82,.70)],
  4:  [iso(.30,.28), iso(.70,.28), iso(.30,.72), iso(.70,.72)],
  6:  [iso(.22,.22), iso(.5,.22), iso(.78,.22), iso(.22,.66), iso(.5,.66), iso(.78,.66)],
  9:  [iso(.22,.10), iso(.5,.10), iso(.78,.10),
       iso(.22,.5),  iso(.5,.5),  iso(.78,.5),
       iso(.22,.82), iso(.5,.82), iso(.78,.82)],
  16: [iso(.12,.06), iso(.38,.06), iso(.62,.06), iso(.88,.06),
       iso(.12,.32), iso(.38,.32), iso(.62,.32), iso(.88,.32),
       iso(.12,.58), iso(.38,.58), iso(.62,.58), iso(.88,.58),
       iso(.12,.82), iso(.38,.82), iso(.62,.82), iso(.88,.82)],
};
const SC: Record<number, number> = { 2: 1, 3: .88, 4: .76, 6: .60, 9: .44, 16: .30 };

/* ── Empty Slot — Runic Depression ──────────────────────────────── */
function EmptySlot({ x, y, g, sel }: { x: number; y: number; g: string; sel: boolean }) {
  const r1 = 18, r2 = 12, r3 = 6;
  const dots = [0, 60, 120, 180, 240, 300];
  return (
    <g>
      {/* ground shadow */}
      <ellipse cx={x + 3} cy={y + 8} rx={24} ry={10} fill="rgba(0,0,0,.5)" />
      {/* soil depression */}
      <ellipse cx={x} cy={y + 4} rx={r1} ry={7} fill={`${g}09`} />
      {/* outer ring */}
      <ellipse cx={x} cy={y} rx={r1} ry={r1 * .42}
        fill="none" stroke={g}
        strokeWidth={sel ? 1.4 : .9}
        strokeDasharray="4 3"
        opacity={sel ? .8 : .25} />
      {/* rune dots */}
      {dots.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const dx = Math.cos(rad) * r1;
        const dy = Math.sin(rad) * r1 * .42;
        return (
          <circle key={i} cx={x + dx} cy={y + dy} r={1.2}
            fill={g} opacity={sel ? .9 : .3} />
        );
      })}
      {/* inner ring */}
      <ellipse cx={x} cy={y} rx={r2} ry={r2 * .42}
        fill="none" stroke={g}
        strokeWidth={sel ? 1.2 : .7}
        opacity={sel ? .6 : .18} />
      {/* center node */}
      <ellipse cx={x} cy={y} rx={r3} ry={r3 * .44}
        fill={`${g}14`} stroke={g} strokeWidth={.8}
        opacity={sel ? .9 : .2} />
      {sel && (
        <>
          <line x1={x - 7} y1={y} x2={x + 7} y2={y}
            stroke={g} strokeWidth={1.2} opacity={.7} />
          <line x1={x} y1={y - 4} x2={x} y2={y + 4}
            stroke={g} strokeWidth={1.2} opacity={.7} />
          {/* selection glow */}
          <ellipse cx={x} cy={y} rx={r1 + 6} ry={(r1 + 6) * .42}
            fill="none" stroke={g} strokeWidth={3} opacity={.1} />
        </>
      )}
    </g>
  );
}

/* ── Sapling — PNG sprite with glow overlay ─────────────────────── */
function Sapling({ x, y, sc, p, rarity }: { x: number; y: number; sc: number; p: Pal; rarity: Rarity }) {
  const h = 72 * sc;
  const dH = h * 2.10;          // display height in SVG units
  const dW = dH * (240 / 310);  // maintain PNG aspect ratio
  const imgX = x - 0.53 * dW;  // trunk center at x
  const imgY = y - 0.90 * dH;  // trunk base at y
  const rar = rarity.toLowerCase();

  return (
    <g>
      {/* soil disturb */}
      <ellipse cx={x + 2 * sc} cy={y + 5} rx={14 * sc} ry={5 * sc}
        fill="rgba(0,0,0,.35)" />
      <ellipse cx={x} cy={y + 3} rx={10 * sc} ry={3.5 * sc}
        fill={p.glow} opacity={.12} />
      {/* PNG sprite */}
      <image href={`${import.meta.env.BASE_URL}assets/game/tree_sapling_${rar}.png`}
        x={imgX} y={imgY} width={dW} height={dH} />
      {/* tip glow pulse */}
      <circle cx={x - 2 * sc} cy={y - h * .96} r={5 * sc} fill={p.glow} opacity={.0}>
        <animate attributeName="r" values={`${3 * sc};${8 * sc};${3 * sc}`} dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;.35;0" dur="2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

/* ── Full Lumen Apple Tree — PNG sprite with SVG glow effects ─────── */
function FullTree({ x, y, sc, p, rarity, uid, idx }:
  { x: number; y: number; sc: number; p: Pal; rarity: Rarity; uid: string; idx: number }) {
  const H = 130 * sc;
  const anim = `${3.2 + idx * .5}s`;

  // PNG sprite dimensions & anchor alignment
  const dH = H * 1.70;          // display height in SVG units
  const dW = dH * (520 / 640);  // maintain PNG aspect ratio
  const imgX = x - 0.53 * dW;  // align trunk center-x
  const imgY = y - 0.92 * dH;  // align trunk base to (x,y)
  const rar = rarity.toLowerCase();

  return (
    <g>
      {/* atmospheric aura pulse */}
      <ellipse cx={x - 4 * sc} cy={y - H * .85} rx={72 * sc} ry={60 * sc}
        fill={p.glow} opacity={.04}>
        <animate attributeName="opacity" values=".03;.10;.03" dur={anim} repeatCount="indefinite" />
        <animate attributeName="rx" values={`${68 * sc};${80 * sc};${68 * sc}`} dur={anim} repeatCount="indefinite" />
      </ellipse>

      {/* ground shadow */}
      <ellipse cx={x + 5 * sc} cy={y + 12} rx={52 * sc} ry={18 * sc} fill="rgba(0,0,0,.55)" />
      {/* ground light pool */}
      <ellipse cx={x} cy={y + 6} rx={38 * sc} ry={12 * sc} fill={p.glow} opacity={.10}>
        <animate attributeName="opacity" values=".08;.18;.08" dur={anim} repeatCount="indefinite" />
      </ellipse>

      {/* PNG tree sprite */}
      <image href={`${import.meta.env.BASE_URL}assets/game/tree_full_${rar}.png`}
        x={imgX} y={imgY} width={dW} height={dH} />

      {/* floating sparkle motes */}
      {[[-28, -.94], [18, -.96], [-4, -1.22], [30, -.86], [-38, -.80]].map(([dx, dt], i) => (
        <circle key={i}
          cx={x + dx * sc} cy={y + dt * H}
          r={1.6 * sc} fill={p.glow} opacity={0}>
          <animate attributeName="opacity"
            values="0;.8;0" dur={`${2.4 + i * .6}s`}
            begin={`${i * .7}s`} repeatCount="indefinite" />
          <animate attributeName="r"
            values={`${1 * sc};${2.5 * sc};${1 * sc}`}
            dur={`${2.4 + i * .6}s`} begin={`${i * .7}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}

/* ── Selection Ring ──────────────────────────────────────────────── */
function SelRing({ x, y, g }: { x: number; y: number; g: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 5} rx={26} ry={10}
        fill="none" stroke={g} strokeWidth={2} opacity={.7}>
        <animate attributeName="rx" values="23;30;23" dur="1.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values=".7;.3;.7" dur="1.4s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx={x} cy={y + 5} rx={16} ry={6}
        fill="none" stroke={g} strokeWidth={1} opacity={.4}>
        <animate attributeName="rx" values="13;19;13" dur="1.4s" repeatCount="indefinite" />
      </ellipse>
    </g>
  );
}

/* ── Crystal Nodes embedded in soil ─────────────────────────────── */
function CrystalNodes({ p, uid }: { p: Pal; uid: string }) {
  const nodes: [number, number, number][] = [
    [155, 210, 2.4], [205, 205, 1.8], [168, 228, 2.0],
    [216, 225, 1.5], [140, 222, 1.6], [190, 240, 2.2],
    [130, 235, 1.4], [220, 238, 1.7],
  ];
  return (
    <g>
      {nodes.map(([cx, cy, r], i) => (
        <g key={i}>
          {/* crystal shadow */}
          <ellipse cx={cx + 1.5} cy={cy + 2} rx={r * 1.4} ry={r * .7}
            fill="rgba(0,0,0,.4)" />
          {/* crystal body */}
          <polygon
            points={`${cx},${cy - r * 2.2} ${cx + r},${cy + r * .8} ${cx - r},${cy + r * .8}`}
            fill={p.crystal} opacity={.22} />
          {/* crystal top face */}
          <polygon
            points={`${cx},${cy - r * 2.2} ${cx + r},${cy + r * .8} ${cx},${cy}`}
            fill="rgba(255,255,255,.18)" />
          {/* glow dot */}
          <circle cx={cx} cy={cy - r * .6} r={r * .55} fill={p.glow} opacity={.35}>
            <animate attributeName="opacity"
              values=".2;.55;.2" dur={`${2 + i * .55}s`}
              begin={`${i * .38}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </g>
  );
}

/* ── Soil Veins ──────────────────────────────────────────────────── */
function SoilVeins({ p, uid }: { p: Pal; uid: string }) {
  const veins = [
    `M190,252 C168,240 140,228 110,222`,
    `M190,252 C196,234 208,216 224,206`,
    `M190,252 C178,230 168,210 178,196`,
    `M190,252 C206,242 232,232 252,224`,
    `M190,252 C166,244 144,242 122,248`,
    `M190,252 C200,244 214,240 228,244`,
  ];
  return (
    <g>
      {veins.map((d, i) => (
        <g key={i}>
          {/* vein shadow */}
          <path d={d} stroke="rgba(0,0,0,.4)" strokeWidth={1.8} fill="none"
            strokeDasharray="200" strokeDashoffset="200"
            style={{ animation: `root-flow ${2.2 + i * .55}s ${i * .35}s ease-out forwards` }} />
          {/* vein color */}
          <path d={d} stroke={p.glow} strokeWidth={1.2} fill="none"
            opacity={0} strokeDasharray="200" strokeDashoffset="200"
            style={{ animation: `root-flow ${2.2 + i * .55}s ${i * .35}s ease-out forwards` }}
            filter={`url(#gf-${uid})`} />
        </g>
      ))}
    </g>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export interface LandSVGProps {
  rarity: Rarity;
  fertility?: number;
  slots?: SlotStage[];
  selectedSlot?: number | null;
  style?: React.CSSProperties;
}

export function LandSVG({
  rarity, fertility = 100, slots = [], selectedSlot = null, style,
}: LandSVGProps) {
  const p = PAL[rarity];
  const uid = `${rarity.slice(0, 3)}${slots.length}`;
  const slotPos = SLOTS[slots.length] ?? SLOTS[2];
  const sc = SC[slots.length] ?? 1;
  const gAlpha = 0.20 + (fertility / 100) * 0.50;

  const paintOrder = slotPos
    .map(([sx, sy], i) => ({ sx, sy, i, stage: (slots[i] ?? "empty") as SlotStage }))
    .sort((a, b) => a.sy - b.sy);

  return (
    <svg viewBox="0 0 380 320" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", display: "block", ...style }} overflow="visible">
      <defs>
        {/* top face gradient */}
        <radialGradient id={`tg-${uid}`} cx="48%" cy="40%" r="58%">
          <stop offset="0%"   stopColor={p.topLight} />
          <stop offset="45%"  stopColor={p.topMid} />
          <stop offset="100%" stopColor={p.topDark} />
        </radialGradient>

        {/* edge highlight gradient — left face */}
        <linearGradient id={`slg-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={p.edge} stopOpacity={.08} />
          <stop offset="50%"  stopColor={p.edge} stopOpacity={.18} />
          <stop offset="100%" stopColor={p.edge} stopOpacity={.04} />
        </linearGradient>

        {/* glow filter */}
        <filter id={`gf-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* blur only filter for outer glow */}
        <filter id={`gfb-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="14" />
        </filter>

        {/* clip for top face */}
        <clipPath id={`clip-${uid}`}>
          <polygon points="190,78 342,168 190,258 38,168" />
        </clipPath>
      </defs>

      {/* ── OUTER GLOW ─────────────────────────────────────────── */}
      <ellipse cx="190" cy="228" rx="210" ry="84"
        fill={p.glow} opacity={gAlpha * .12}
        filter={`url(#gfb-${uid})`}
        style={{ animation: "breathe 4.5s ease-in-out infinite" }} />

      {/* ── LEFT DEPTH FACE ────────────────────────────────────── */}
      <polygon points="38,168 190,258 190,304 38,214" fill={p.sideL} />
      {/* left face gradient shimmer */}
      <polygon points="38,168 190,258 190,304 38,214"
        fill={`url(#slg-${uid})`} opacity={.6} />
      {/* left edge facet lines */}
      {[.25, .5, .75].map((t, i) => {
        const x1 = 38 + (190 - 38) * t, y1 = 168 + (258 - 168) * t;
        const x2 = 38 + (190 - 38) * t, y2 = 214 + (304 - 214) * t;
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={p.edge} strokeWidth={.4} opacity={.12} />
        );
      })}
      <line x1="38" y1="168" x2="38" y2="214"
        stroke={p.edge} strokeWidth={.8} opacity={.30} />

      {/* ── RIGHT DEPTH FACE ───────────────────────────────────── */}
      <polygon points="342,168 190,258 190,304 342,214" fill={p.sideR} />
      {/* right face subtle highlight */}
      <polygon points="342,168 190,258 190,304 342,214"
        fill="rgba(255,255,255,.025)" />
      {[.25, .5, .75].map((t, i) => {
        const x1 = 342 - (342 - 190) * t, y1 = 168 + (258 - 168) * t;
        const x2 = 342 - (342 - 190) * t, y2 = 214 + (304 - 214) * t;
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={p.edge} strokeWidth={.4} opacity={.08} />
        );
      })}
      <line x1="342" y1="168" x2="342" y2="214"
        stroke={p.edge} strokeWidth={.8} opacity={.28} />

      {/* bottom edges */}
      <line x1="38" y1="214" x2="190" y2="304"
        stroke={p.edge} strokeWidth={.7} opacity={.20} />
      <line x1="342" y1="214" x2="190" y2="304"
        stroke={p.edge} strokeWidth={.7} opacity={.18} />

      {/* ── TOP FACE ───────────────────────────────────────────── */}
      <polygon points="190,78 342,168 190,258 38,168"
        fill={`url(#tg-${uid})`} />

      {/* ── SURFACE DETAILS (clipped to top face) ──────────────── */}
      <g clipPath={`url(#clip-${uid})`}>
        {/* soil veins */}
        <SoilVeins p={p} uid={uid} />
        {/* crystal mineral nodes */}
        <CrystalNodes p={p} uid={uid} />
        {/* surface shimmer / wetness */}
        <ellipse cx="188" cy="188" rx="88" ry="26"
          fill={p.glow} opacity={gAlpha * .18}
          style={{ animation: "breathe 3.8s ease-in-out infinite" }} />
        {/* micro cracks */}
        {[[-60, 8], [-30, -6], [10, 10], [48, -4], [72, 14]].map(([dx, dy], i) => (
          <path key={i}
            d={`M${190 + dx},${212 + dy} l${10 + i * 2},${3} l${-5},${3} l${3},${-1}`}
            stroke={p.glow} strokeWidth={.5} fill="none" opacity={.14} />
        ))}
        {/* surface soil gradient overlay */}
        <ellipse cx="190" cy="230" rx="120" ry="35"
          fill={p.topDark} opacity={.35} />
      </g>

      {/* ── RIM LIGHTING (top face edges) ──────────────────────── */}
      <line x1="190" y1="78" x2="38"  y2="168"
        stroke={p.edge} strokeWidth={1.4} opacity={.55} />
      <line x1="190" y1="78" x2="342" y2="168"
        stroke={p.edge} strokeWidth={1.1} opacity={.42} />
      <line x1="38"  y1="168" x2="190" y2="258"
        stroke={p.edge} strokeWidth={.9} opacity={.24} />
      <line x1="342" y1="168" x2="190" y2="258"
        stroke={p.edge} strokeWidth={.9} opacity={.22} />
      {/* apex node */}
      <circle cx="190" cy="78" r="3" fill={p.edge} opacity={.6} />
      <circle cx="190" cy="78" r="6" fill={p.edge} opacity={.15} />

      {/* ── SELECTION RINGS ────────────────────────────────────── */}
      {slotPos.map(([sx, sy], i) =>
        selectedSlot === i && <SelRing key={i} x={sx} y={sy} g={p.glow} />
      )}

      {/* ── PLANTS (painter's order, back→front) ───────────────── */}
      {paintOrder.map(({ sx, sy, i, stage }) => {
        if (stage === "empty")   return <EmptySlot key={i} x={sx} y={sy} g={p.glow} sel={selectedSlot === i} />;
        if (stage === "growing") return <Sapling   key={i} x={sx} y={sy} sc={sc} p={p} rarity={rarity} />;
        return                          <FullTree  key={i} x={sx} y={sy} sc={sc} p={p} rarity={rarity} uid={uid} idx={i} />;
      })}

      {/* ── RARITY LABEL ───────────────────────────────────────── */}
      <text x="190" y="315" textAnchor="middle" fontSize="7"
        fill={p.edge} fontFamily="monospace" letterSpacing="3.5" opacity={.40}>
        {rarity.toUpperCase()} LAND
      </text>
    </svg>
  );
}
