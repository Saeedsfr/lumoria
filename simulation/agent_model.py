"""
Lumoria — مدل عامل‌محور (Agent-Based Model)
فاز ۳: اثبات عددی پایداری اقتصاد

چهار آرکتایپ بازیکن:
  Whale     — سرمایه‌گذار بزرگ، زمین‌های بالا، کم‌فعال
  Grinder   — بازیکن حرفه‌ای، روزانه active، درآمدمحور
  Casual    — بازیکن معمولی، هفته‌ای چند بار
  Bot       — اسکریپت خودکار، هر harvest را می‌گیرد
"""
import random
import numpy as np
import matplotlib
matplotlib.use("Agg")   # بدون نمایش صفحه، فایل PNG ذخیره می‌کند
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from dataclasses import dataclass, field
from typing import List, Dict, Tuple
from pathlib import Path

random.seed(42)
np.random.seed(42)

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# ── پارامترهای نهایی (تأییدشده فاز ۲) ───────────────────────────
SEED_COST        = 8.0     # SAP
HARVEST_REWARD   = 10.0    # SAP هر Lumen Apple
HARVEST_HOURS    = 4       # چرخه کاشت
LAND_TAX_RATE    = 0.05    # 5٪ روزانه از تولید
MARKET_BURN      = 0.05    # 5٪ معاملات سوزانده می‌شود
TOOL_REPAIR_BASE = 5.0     # SAP روزانه

HARVESTS_PER_DAY = 24 // HARVEST_HOURS   # = 6


# ── آرکتایپ‌های بازیکن ───────────────────────────────────────────
@dataclass
class PlayerArchetype:
    name: str
    fraction: float          # درصد از کل
    land_count_range: Tuple[int, int]
    activity_rate: float     # 0-1: چه سهمی از harvestها را جمع می‌کند
    trade_rate: float        # 0-1: چه سهمی از SAP را در بازار می‌فروشد
    hold_sap: bool           # آیا SAP نگه می‌دارد یا فوری می‌فروشد


ARCHETYPES = [
    PlayerArchetype("Whale",   0.05, (8, 16), 0.60, 0.30, True),
    PlayerArchetype("Grinder", 0.25, (2, 5),  0.95, 0.70, False),
    PlayerArchetype("Casual",  0.55, (1, 3),  0.45, 0.40, True),
    PlayerArchetype("Bot",     0.15, (3, 8),  1.00, 0.95, False),
]


@dataclass
class Player:
    archetype: PlayerArchetype
    lands: int
    sap_balance: float = 0.0
    active_days: int = 0
    total_earned: float = 0.0
    total_spent: float = 0.0

    def capacity(self, level: int) -> int:
        """ظرفیت سرپرستی بر اساس سطح"""
        base = 2 + level // 10
        return base

    def daily_mint(self, day: int) -> float:
        cap = self.capacity(day // 30)
        eff = min(1.0, cap / max(self.lands, 1))
        raw = self.lands * HARVESTS_PER_DAY * HARVEST_REWARD * self.archetype.activity_rate
        return raw * eff

    def daily_spend(self, day: int, minted: float) -> float:
        tax   = minted * LAND_TAX_RATE
        seeds = self.lands * HARVESTS_PER_DAY * SEED_COST * self.archetype.activity_rate
        tools = TOOL_REPAIR_BASE * (self.lands / 3)
        return tax + seeds + tools

    def step(self, day: int) -> Tuple[float, float, float]:
        """یک روز شبیه‌سازی → (mint, burn, trade_volume)"""
        if random.random() > self.archetype.activity_rate:
            return 0, 0, 0

        minted = self.daily_mint(day)
        spent  = self.daily_spend(day, minted)
        net    = minted - spent

        if net > 0:
            self.sap_balance += net
        else:
            deficit = abs(net)
            if self.sap_balance >= deficit:
                self.sap_balance -= deficit
            else:
                minted *= (self.sap_balance / max(deficit, 1))
                self.sap_balance = 0

        trade_vol = minted * self.archetype.trade_rate
        market_burn = trade_vol * MARKET_BURN

        self.total_earned += minted
        self.total_spent  += spent + market_burn
        self.active_days  += 1

        return minted, spent + market_burn, trade_vol


# ── شبیه‌سازی اصلی ──────────────────────────────────────────────
def build_population(n_players: int) -> List[Player]:
    players = []
    for arch in ARCHETYPES:
        count = int(n_players * arch.fraction)
        for _ in range(count):
            lands = random.randint(*arch.land_count_range)
            players.append(Player(arch, lands))
    return players


def simulate(n_players: int = 10_000, days: int = 365,
             monthly_growth: float = 0.15) -> Dict:
    players = build_population(n_players)
    daily_growth = (1 + monthly_growth) ** (1 / 30) - 1

    history = {
        "day":          [],
        "players":      [],
        "total_supply": [],
        "daily_mint":   [],
        "daily_burn":   [],
        "net_flow":     [],
        "burn_ratio":   [],
        "trade_vol":    [],
        "archetype_mint": {a.name: [] for a in ARCHETYPES},
    }

    total_supply = 0.0

    for day in range(1, days + 1):
        # رشد جمعیت
        new_count = int(len(players) * daily_growth)
        for _ in range(new_count):
            arch = random.choices(ARCHETYPES,
                                  weights=[a.fraction for a in ARCHETYPES])[0]
            lands = random.randint(*arch.land_count_range)
            players.append(Player(arch, lands, sap_balance=50.0))

        day_mint = day_burn = day_trade = 0.0
        arch_mint = {a.name: 0.0 for a in ARCHETYPES}

        for p in players:
            m, b, t = p.step(day)
            day_mint  += m
            day_burn  += b
            day_trade += t
            arch_mint[p.archetype.name] += m

        total_supply = max(0, total_supply + day_mint - day_burn)
        ratio = day_burn / day_mint if day_mint > 0 else 0

        history["day"].append(day)
        history["players"].append(len(players))
        history["total_supply"].append(total_supply)
        history["daily_mint"].append(day_mint)
        history["daily_burn"].append(day_burn)
        history["net_flow"].append(day_mint - day_burn)
        history["burn_ratio"].append(ratio)
        history["trade_vol"].append(day_trade)
        for aname, val in arch_mint.items():
            history["archetype_mint"][aname].append(val)

    history["players_list"] = players
    return history


# ── Monte Carlo ──────────────────────────────────────────────────
def monte_carlo(n_runs: int = 200, n_players: int = 10_000,
                days: int = 365) -> Dict:
    """تغییر تصادفی نرخ رشد و ترکیب بازیکنان → باند اطمینان"""
    all_supply   = []
    all_ratio    = []
    final_ratios = []

    for _ in range(n_runs):
        growth = random.uniform(0.05, 0.35)
        h = simulate(n_players, days, growth)
        all_supply.append(h["total_supply"])
        all_ratio.append(h["burn_ratio"])
        final_ratios.append(np.mean(h["burn_ratio"][30:]))

    arr_supply = np.array(all_supply)
    arr_ratio  = np.array(all_ratio)

    return {
        "supply_p5":  np.percentile(arr_supply, 5,  axis=0),
        "supply_p50": np.percentile(arr_supply, 50, axis=0),
        "supply_p95": np.percentile(arr_supply, 95, axis=0),
        "ratio_p5":   np.percentile(arr_ratio,  5,  axis=0),
        "ratio_p50":  np.percentile(arr_ratio,  50, axis=0),
        "ratio_p95":  np.percentile(arr_ratio,  95, axis=0),
        "final_ratio_mean": float(np.mean(final_ratios)),
        "final_ratio_std":  float(np.std(final_ratios)),
        "pct_healthy": float(np.mean(
            [(0.80 <= r <= 0.98) for r in final_ratios]
        ) * 100),
        "days": list(range(1, days + 1)),
    }


# ── رسم نمودارها ─────────────────────────────────────────────────
def plot_all(base: Dict, mc: Dict, out_path: Path):
    days  = base["day"]
    COLOR = {
        "Whale": "#FDCB6E", "Grinder": "#00B894",
        "Casual": "#74B9FF", "Bot": "#FF7675",
    }

    fig = plt.figure(figsize=(18, 14), facecolor="#0D1117")
    fig.suptitle("Lumoria — Economic Simulation Report",
                 color="#7DEBB0", fontsize=16, fontweight="bold", y=0.98)
    gs = gridspec.GridSpec(3, 3, figure=fig,
                           hspace=0.45, wspace=0.35,
                           left=0.07, right=0.97, top=0.93, bottom=0.06)

    ax_style = dict(facecolor="#1A2332",
                    tick_params=dict(colors="#888", labelsize=8))

    def style(ax, title, xlabel="روز", ylabel=""):
        ax.set_facecolor("#1A2332")
        ax.tick_params(colors="#888", labelsize=8)
        ax.set_title(title, color="#A0C87A", fontsize=10, pad=6)
        ax.set_xlabel(xlabel, color="#666", fontsize=8)
        if ylabel:
            ax.set_ylabel(ylabel, color="#666", fontsize=8)
        for spine in ax.spines.values():
            spine.set_edgecolor("#2A3A4A")
        ax.grid(True, color="#2A3A4A", alpha=0.5, linewidth=0.5)

    # ① عرضه کل SAP
    ax1 = fig.add_subplot(gs[0, :2])
    mc_days = mc["days"]
    ax1.fill_between(mc_days, mc["supply_p5"], mc["supply_p95"],
                     alpha=0.25, color="#7DEBB0", label="باند 5٪-95٪")
    ax1.plot(mc_days, mc["supply_p50"],
             color="#7DEBB0", lw=2, label="میانه Monte Carlo")
    ax1.plot(days, base["total_supply"],
             color="#FDCB6E", lw=1.5, ls="--", label="سناریوی پایه")
    style(ax1, "① عرضه کل SAP در طول زمان", ylabel="SAP")
    ax1.legend(fontsize=7, facecolor="#1A2332", labelcolor="white")
    ax1.yaxis.set_major_formatter(
        plt.FuncFormatter(lambda x, _: f"{x/1e6:.1f}M" if x >= 1e6 else f"{x/1e3:.0f}K")
    )

    # ② نسبت burn/mint
    ax2 = fig.add_subplot(gs[0, 2])
    ax2.fill_between(mc_days, mc["ratio_p5"], mc["ratio_p95"],
                     alpha=0.25, color="#A29BFE")
    ax2.plot(mc_days, mc["ratio_p50"], color="#A29BFE", lw=2)
    ax2.plot(days, base["burn_ratio"], color="#FDCB6E", lw=1.5, ls="--")
    ax2.axhline(0.80, color="#00B894", ls=":", lw=1, label="کف سالم (80٪)")
    ax2.axhline(0.98, color="#FF7675", ls=":", lw=1, label="سقف سالم (98٪)")
    ax2.set_ylim(0, 1.05)
    style(ax2, "② نسبت Burn/Mint", ylabel="نسبت")
    ax2.legend(fontsize=7, facecolor="#1A2332", labelcolor="white")

    # ③ mint vs burn روزانه
    ax3 = fig.add_subplot(gs[1, :2])
    ax3.plot(days, base["daily_mint"], color="#00B894", lw=1.5, label="Mint روزانه")
    ax3.plot(days, base["daily_burn"], color="#FF7675", lw=1.5, label="Burn روزانه")
    ax3.fill_between(days, base["daily_burn"], base["daily_mint"],
                     where=[m > b for m, b in
                            zip(base["daily_mint"], base["daily_burn"])],
                     alpha=0.15, color="#00B894")
    style(ax3, "③ Mint vs Burn روزانه", ylabel="SAP / روز")
    ax3.legend(fontsize=8, facecolor="#1A2332", labelcolor="white")
    ax3.yaxis.set_major_formatter(
        plt.FuncFormatter(lambda x, _: f"{x/1e3:.0f}K")
    )

    # ④ سهم mint هر آرکتایپ
    ax4 = fig.add_subplot(gs[1, 2])
    arch_names = list(base["archetype_mint"].keys())
    totals = [sum(v) for v in base["archetype_mint"].values()]
    colors = [COLOR[n] for n in arch_names]
    wedges, texts, autotexts = ax4.pie(
        totals, labels=arch_names, colors=colors,
        autopct="%1.0f%%", pctdistance=0.75,
        textprops={"color": "white", "fontsize": 8},
    )
    for at in autotexts:
        at.set_color("#0D1117")
        at.set_fontsize(8)
    ax4.set_facecolor("#1A2332")
    ax4.set_title("④ سهم Mint هر آرکتایپ",
                  color="#A0C87A", fontsize=10, pad=6)

    # ⑤ حجم معاملات
    ax5 = fig.add_subplot(gs[2, :2])
    window = 7
    trade_smooth = np.convolve(base["trade_vol"],
                               np.ones(window) / window, mode="same")
    ax5.bar(days, base["trade_vol"], color="#74B9FF", alpha=0.3, width=1)
    ax5.plot(days, trade_smooth, color="#74B9FF", lw=2, label="MA-7 حجم معامله")
    style(ax5, "⑤ حجم معاملات روزانه (Marketplace)", ylabel="SAP / روز")
    ax5.legend(fontsize=8, facecolor="#1A2332", labelcolor="white")
    ax5.yaxis.set_major_formatter(
        plt.FuncFormatter(lambda x, _: f"{x/1e3:.0f}K")
    )

    # ⑥ خلاصه کادری
    ax6 = fig.add_subplot(gs[2, 2])
    ax6.set_facecolor("#1A2332")
    ax6.axis("off")
    ax6.set_title("⑥ یافته‌های کلیدی", color="#A0C87A", fontsize=10, pad=6)
    for spine in ax6.spines.values():
        spine.set_edgecolor("#2A3A4A")

    last_day   = days[-1]
    last_play  = base["players"][-1]
    last_sup   = base["total_supply"][-1]
    last_ratio = np.mean(base["burn_ratio"][30:])

    findings = [
        ("بازیکنان نهایی",     f"{last_play:,.0f}"),
        ("عرضه کل SAP",        f"{last_sup/1e6:.1f}M"),
        ("میانگین burn/mint",  f"{last_ratio:.1%}"),
        ("سناریوهای سالم (MC)",f"{mc['pct_healthy']:.0f}٪"),
        ("میانه نسبت (MC)",    f"{mc['final_ratio_mean']:.1%}"),
        ("انحراف معیار (MC)",  f"±{mc['final_ratio_std']:.1%}"),
        ("", ""),
        ("وضعیت",
         "✅ پایدار" if 0.80 <= last_ratio <= 0.98 else "⚠️ نیاز به تنظیم"),
    ]
    y = 0.92
    for label, val in findings:
        if not label:
            y -= 0.06
            continue
        color = "#7DEBB0" if "✅" in val else ("#FF7675" if "⚠️" in val else "white")
        ax6.text(0.05, y, label, transform=ax6.transAxes,
                 color="#888", fontsize=9, va="top")
        ax6.text(0.95, y, val, transform=ax6.transAxes,
                 color=color, fontsize=9, va="top", ha="right",
                 fontweight="bold")
        y -= 0.10

    plt.savefig(out_path, dpi=150, bbox_inches="tight",
                facecolor="#0D1117")
    plt.close()
    print(f"✅ نمودار ذخیره شد: {out_path}")


# ── گزارش متنی ──────────────────────────────────────────────────
def print_report(base: Dict, mc: Dict):
    days  = base["day"]
    play  = base["players"]
    sup   = base["total_supply"]
    ratio = base["burn_ratio"]

    milestones = [1, 30, 90, 180, 270, 365]
    indices    = [d - 1 for d in milestones]

    print("\n" + "═" * 70)
    print("  Lumoria — فاز ۳: گزارش شبیه‌سازی عامل‌محور")
    print("═" * 70)
    print(f"{'روز':>4} | {'بازیکن':>8} | {'عرضه (M SAP)':>13} | "
          f"{'burn/mint':>10} | {'net flow/روز (K)':>17}")
    print("─" * 70)
    for i in indices:
        if i >= len(days):
            continue
        net_k = (base["daily_mint"][i] - base["daily_burn"][i]) / 1000
        print(f"{days[i]:>4} | {play[i]:>8,.0f} | "
              f"{sup[i]/1e6:>13.2f} | "
              f"{ratio[i]:>9.1%} | "
              f"{net_k:>+16.1f}K")
    print("═" * 70)

    avg_ratio = np.mean(ratio[30:])
    print(f"\n📊 Monte Carlo ({len(mc['days'])} روز، ۲۰۰ سناریو):")
    print(f"   میانه burn/mint:   {mc['final_ratio_mean']:.1%}  (±{mc['final_ratio_std']:.1%})")
    print(f"   سناریوهای سالم:   {mc['pct_healthy']:.0f}٪")
    print(f"   عرضه p50 روز365:  {mc['supply_p50'][-1]/1e6:.1f}M SAP")
    print(f"   عرضه p95 روز365:  {mc['supply_p95'][-1]/1e6:.1f}M SAP")

    print("\n📋 پارامترهای نهایی پیشنهادی برای قرارداد:")
    params = {
        "SEED_COST_SAP":         SEED_COST,
        "HARVEST_REWARD_SAP":    HARVEST_REWARD,
        "HARVEST_CYCLE_HOURS":   HARVEST_HOURS,
        "LAND_TAX_RATE_DAILY":   f"{LAND_TAX_RATE:.0%}",
        "MARKETPLACE_BURN_RATE": f"{MARKET_BURN:.0%}",
        "TOOL_REPAIR_BASE_SAP":  TOOL_REPAIR_BASE,
    }
    for k, v in params.items():
        print(f"   {k:<28} = {v}")

    status = "✅ پایدار — آماده قرارداد" if 0.80 <= avg_ratio <= 0.98 else "⚠️ نیاز به تنظیم"
    print(f"\n   وضعیت نهایی: {status}\n")


# ── اجرا ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🌱 در حال شبیه‌سازی پایه (10,000 بازیکن، 365 روز)...")
    base = simulate(n_players=10_000, days=365, monthly_growth=0.15)

    print("🎲 در حال Monte Carlo (200 سناریو)...")
    mc = monte_carlo(n_runs=200, n_players=10_000, days=365)

    print_report(base, mc)

    out = OUTPUT_DIR / "lumoria_economics.png"
    print(f"\n🎨 در حال رسم نمودارها → {out}")
    plot_all(base, mc, out)
