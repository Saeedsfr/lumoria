export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";

export type SlotStage = "empty" | "growing" | "ready";

export interface SlotState {
  stage:     SlotStage;
  plantedAt: number;   // unix ms, 0 if empty
  harvestAt: number;   // unix ms, 0 if empty
}

export interface Toast {
  id:       number;
  text:     string;
  positive: boolean;
}

export const RARITY_SLOTS: Record<Rarity, number> = {
  Common: 2, Uncommon: 3, Rare: 4, Epic: 6, Legendary: 9, Mythic: 16,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  Common:    "معمولی — دشت‌های خاک",
  Uncommon:  "غیرمعمول — جنگل خزه‌ای",
  Rare:      "نادر — دره آتشین",
  Epic:      "حماسی — عمق بلورین",
  Legendary: "افسانه‌ای — باغ طلایی",
  Mythic:    "اسطوره‌ای — پرتال خلأ",
};

export const RARITY_PALETTE: Record<Rarity, {
  soil:string; glow:string; ring:string; surface:string;
}> = {
  Common:    { soil:"#5C3D18", glow:"#7DEBB0", ring:"#4CAF77",  surface:"#7A5428" },
  Uncommon:  { soil:"#1A4A35", glow:"#55EFC4", ring:"#00B894",  surface:"#27634A" },
  Rare:      { soil:"#5C1A0A", glow:"#F4A261", ring:"#E17055",  surface:"#7A2810" },
  Epic:      { soil:"#0A1A5C", glow:"#74B9FF", ring:"#0984E3",  surface:"#10277A" },
  Legendary: { soil:"#3D2800", glow:"#FDCB6E", ring:"#F39C12",  surface:"#5C3A00" },
  Mythic:    { soil:"#100520", glow:"#A29BFE", ring:"#6C5CE7",  surface:"#1A0A35" },
};
