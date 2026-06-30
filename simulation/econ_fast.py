"""
Lumoria — شبیه‌سازی اقتصادی سریع (numpy-vectorized)
فاز ۳: اثبات عددی پایداری SAP

بدون حلقه per-player — کل جمعیت به‌صورت آرایه پردازش می‌شود.
سرعت ~50× بیشتر از agent_model.py
"""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from pathlib import Path

RNG = np.random.default_rng(42)
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# ── پارامترهای تأییدشده ──────────────────────────────────────────
P = dict(
    seed_cost        = 8.0,
    harvest_reward   = 10.0,
    harvest_cycle_h  = 4,
    land_tax_rate    = 0.10,   # 5% → 10%: سینک اصلی اقتصاد
    market_burn      = 0.07,   # 5% → 7%: کارمزد marketplace
    tool_repair_base = 5.0,
    # آرکتایپ‌ها: (fraction, land_min, land_max, activity, trade_rate)
    archetypes = [
        ("Whale",   0.05, 8, 16, 0.60, 0.30),
        ("Grinder", 0.25, 2,  5, 0.95, 0.70),
        ("Casual",  0.55, 1,  3, 0.45, 0.40),
        ("Bot",     0.15, 3,  8, 1.00, 0.95),
    ],
)

HARVESTS_PER_DAY = 24 // P["harvest_cycle_h"]   # 6


def _init_population(n: int) -> dict:
    """ساخت آرایه‌های numpy برای کل جمعیت"""
    fracs  = np.array([a[1] for a in P["archetypes"]])
    counts = (fracs * n).astype(int)
    counts[-1] += n - counts.sum()          # جبران گرد شدن

    lands, activity, trade_rate = [], [], []
    archetype_id = []
    for i, (_, _, lmin, lmax, act, tr) in enumerate(P["archetypes"]):
        c = counts[i]
        lands.append(RNG.integers(lmin, lmax + 1, size=c))
        activity.append(np.full(c, act))
        trade_rate.append(np.full(c, tr))
        archetype_id.append(np.full(c, i))

    return dict(
        lands       = np.concatenate(lands).astype(float),
        activity    = np.concatenate(activity),
        trade_rate  = np.concatenate(trade_rate),
        arch_id     = np.concatenate(archetype_id),
        sap_bal     = np.zeros(n),
    )


def simulate_fast(n_start: int = 5_000, days: int = 365,
                  monthly_growth: float = 0.15) -> dict:
    pop = _init_population(n_start)
    daily_growth = (1 + monthly_growth) ** (1 / 30) - 1

    hist = dict(day=[], players=[], total_supply=[],
                daily_mint=[], daily_burn=[], burn_ratio=[],
                trade_vol=[], arch_mint={a[0]: [] for a in P["archetypes"]})

    supply = 0.0

    for day in range(1, days + 1):
        n = len(pop["lands"])

        # ── رشد جمعیت ──
        new_n = int(n * daily_growth)
        if new_n > 0:
            new_pops = _init_population(new_n)
            new_pops["sap_bal"] = np.full(new_n, 50.0)  # موجودی اولیه
            for k in pop:
                pop[k] = np.concatenate([pop[k], new_pops[k]])

        n = len(pop["lands"])

        # ── فعالیت تصادفی روزانه ──
        active_mask = RNG.random(n) < pop["activity"]

        # ظرفیت سرپرستی
        level = day // 30
        capacity = 2 + level
        efficiency = np.minimum(1.0, capacity / np.maximum(pop["lands"], 1))

        # Mint
        raw_mint   = pop["lands"] * HARVESTS_PER_DAY * P["harvest_reward"]
        player_mint = raw_mint * efficiency * active_mask

        # Burn: مالیات + بذر + ابزار
        # بذر فقط برای کشت‌های واقعی (efficiency × lands) محاسبه می‌شود
        tax   = player_mint * P["land_tax_rate"]
        seeds = pop["lands"] * HARVESTS_PER_DAY * P["seed_cost"] * pop["activity"] * efficiency * active_mask
        tools = P["tool_repair_base"] * (pop["lands"] / 3) * active_mask
        player_burn = tax + seeds + tools

        net = player_mint - player_burn
        pop["sap_bal"] = np.maximum(0, pop["sap_bal"] + net)

        # Trade / market burn
        trade_vol   = player_mint * pop["trade_rate"] * active_mask
        market_burn = trade_vol * P["market_burn"]

        day_mint  = float(player_mint.sum())
        day_burn  = float((player_burn + market_burn).sum())
        supply    = max(0.0, supply + day_mint - day_burn)
        ratio     = day_burn / day_mint if day_mint > 0 else 0.0

        hist["day"].append(day)
        hist["players"].append(n)
        hist["total_supply"].append(supply)
        hist["daily_mint"].append(day_mint)
        hist["daily_burn"].append(day_burn)
        hist["burn_ratio"].append(ratio)
        hist["trade_vol"].append(float(trade_vol.sum()))

        for i, (aname, *_) in enumerate(P["archetypes"]):
            mask = (pop["arch_id"] == i)
            hist["arch_mint"][aname].append(float(player_mint[mask].sum()))

    return hist


def monte_carlo_fast(n_runs: int = 300, n_start: int = 5_000,
                     days: int = 365) -> dict:
    all_supply, all_ratio, final_ratios = [], [], []

    for _ in range(n_runs):
        growth = RNG.uniform(0.05, 0.35)
        h = simulate_fast(n_start, days, growth)
        all_supply.append(h["total_supply"])
        all_ratio.append(h["burn_ratio"])
        final_ratios.append(float(np.mean(h["burn_ratio"][30:])))

    sa = np.array(all_supply)
    ra = np.array(all_ratio)

    return dict(
        supply_p5  = np.percentile(sa,  5, axis=0),
        supply_p50 = np.percentile(sa, 50, axis=0),
        supply_p95 = np.percentile(sa, 95, axis=0),
        ratio_p5   = np.percentile(ra,  5, axis=0),
        ratio_p50  = np.percentile(ra, 50, axis=0),
        ratio_p95  = np.percentile(ra, 95, axis=0),
        final_ratio_mean = float(np.mean(final_ratios)),
        final_ratio_std  = float(np.std(final_ratios)),
        pct_healthy = float(np.mean(
            [0.80 <= r <= 0.98 for r in final_ratios]) * 100),
        days = list(range(1, days + 1)),
    )


def plot_report(base: dict, mc: dict, path: Path):
    ARCH_COLOR = {
        "Whale": "#FDCB6E", "Grinder": "#00B894",
        "Casual": "#74B9FF", "Bot":    "#FF7675",
    }
    days = base["day"]

    fig = plt.figure(figsize=(18, 14), facecolor="#0D1117")
    fig.suptitle(
        "Lumoria — Economic Simulation  |  Phase 3 Report",
        color="#7DEBB0", fontsize=15, fontweight="bold", y=0.98
    )
    gs = gridspec.GridSpec(3, 3, figure=fig,
                           hspace=0.48, wspace=0.35,
                           left=0.07, right=0.97,
                           top=0.93, bottom=0.06)

    def ax_style(ax, title, xl="Day", yl=""):
        ax.set_facecolor("#1A2332")
        ax.tick_params(colors="#888", labelsize=8)
        ax.set_title(title, color="#A0C87A", fontsize=10, pad=6)
        ax.set_xlabel(xl, color="#666", fontsize=8)
        if yl:
            ax.set_ylabel(yl, color="#666", fontsize=8)
        for sp in ax.spines.values():
            sp.set_edgecolor("#2A3A4A")
        ax.grid(True, color="#2A3A4A", alpha=0.5, lw=0.5)

    fmt_k  = plt.FuncFormatter(lambda x, _: f"{x/1e3:.0f}K")
    fmt_m  = plt.FuncFormatter(lambda x, _:
                                f"{x/1e6:.1f}M" if x >= 1e6 else f"{x/1e3:.0f}K")

    # ① SAP supply + MC band
    ax = fig.add_subplot(gs[0, :2])
    ax.fill_between(mc["days"], mc["supply_p5"], mc["supply_p95"],
                    alpha=0.2, color="#7DEBB0")
    ax.plot(mc["days"], mc["supply_p50"],
            color="#7DEBB0", lw=2, label="Median (MC)")
    ax.plot(days, base["total_supply"],
            color="#FDCB6E", lw=1.5, ls="--", label="Base scenario")
    ax_style(ax, "① SAP Total Supply", yl="SAP")
    ax.legend(fontsize=8, facecolor="#1A2332", labelcolor="white")
    ax.yaxis.set_major_formatter(fmt_m)

    # ② burn/mint ratio
    ax = fig.add_subplot(gs[0, 2])
    ax.fill_between(mc["days"], mc["ratio_p5"], mc["ratio_p95"],
                    alpha=0.2, color="#A29BFE")
    ax.plot(mc["days"], mc["ratio_p50"], color="#A29BFE", lw=2)
    ax.plot(days, base["burn_ratio"], color="#FDCB6E", lw=1.5, ls="--")
    ax.axhline(0.80, color="#00B894", ls=":", lw=1.2, label="Floor 80٪")
    ax.axhline(0.98, color="#FF7675", ls=":", lw=1.2, label="Ceiling 98٪")
    ax.set_ylim(0, 1.05)
    ax_style(ax, "② Burn / Mint Ratio", yl="Ratio")
    ax.legend(fontsize=7, facecolor="#1A2332", labelcolor="white")

    # ③ daily mint vs burn
    ax = fig.add_subplot(gs[1, :2])
    ax.plot(days, base["daily_mint"], color="#00B894", lw=1.5, label="Mint/day")
    ax.plot(days, base["daily_burn"], color="#FF7675", lw=1.5, label="Burn/day")
    ax.fill_between(days, base["daily_burn"], base["daily_mint"],
                    where=[m > b for m, b in
                           zip(base["daily_mint"], base["daily_burn"])],
                    alpha=0.12, color="#00B894")
    ax_style(ax, "③ Daily Mint vs Burn", yl="SAP / day")
    ax.legend(fontsize=8, facecolor="#1A2332", labelcolor="white")
    ax.yaxis.set_major_formatter(fmt_k)

    # ④ archetype mint share (pie)
    ax = fig.add_subplot(gs[1, 2])
    totals = [sum(base["arch_mint"][n]) for n in ARCH_COLOR]
    colors = list(ARCH_COLOR.values())
    labels = list(ARCH_COLOR.keys())
    wedges, _, autotexts = ax.pie(
        totals, labels=labels, colors=colors,
        autopct="%1.0f%%", pctdistance=0.72,
        textprops={"color": "white", "fontsize": 8},
    )
    for at in autotexts:
        at.set_color("#0D1117")
        at.set_fontweight("bold")
    ax.set_facecolor("#1A2332")
    ax.set_title("④ Mint Share by Archetype",
                 color="#A0C87A", fontsize=10, pad=6)

    # ⑤ stacked archetype mint
    ax = fig.add_subplot(gs[2, :2])
    bottom = np.zeros(len(days))
    for aname, color in ARCH_COLOR.items():
        vals = np.array(base["arch_mint"][aname]) / 1000
        ax.stackplot(days, [vals], labels=[aname],
                     colors=[color], alpha=0.75, baseline="zero")
    ax_style(ax, "⑤ Daily Mint per Archetype (stacked)", yl="SAP K/day")
    ax.legend(fontsize=8, facecolor="#1A2332", labelcolor="white",
              loc="upper left")

    # ⑥ summary box
    ax = fig.add_subplot(gs[2, 2])
    ax.set_facecolor("#1A2332")
    ax.axis("off")
    ax.set_title("⑥ Key Findings", color="#A0C87A", fontsize=10, pad=6)
    for sp in ax.spines.values():
        sp.set_edgecolor("#2A3A4A")

    avg_ratio = float(np.mean(base["burn_ratio"][30:]))
    rows = [
        ("Players (day 365)",    f"{base['players'][-1]:,.0f}"),
        ("SAP Supply (day 365)", f"{base['total_supply'][-1]/1e6:.2f}M"),
        ("Avg burn/mint (d30+)", f"{avg_ratio:.1%}"),
        ("MC median ratio",      f"{mc['final_ratio_mean']:.1%}"),
        ("MC std",               f"±{mc['final_ratio_std']:.1%}"),
        ("Healthy scenarios",    f"{mc['pct_healthy']:.0f}%"),
        ("", ""),
        ("VERDICT",
         "✅ STABLE" if 0.80 <= avg_ratio <= 0.98 else "⚠️  ADJUST"),
    ]
    y = 0.93
    for lbl, val in rows:
        if not lbl:
            y -= 0.05
            continue
        vc = ("#7DEBB0" if "✅" in val
              else "#FF7675" if "⚠️" in val else "white")
        ax.text(0.04, y, lbl, transform=ax.transAxes,
                color="#888", fontsize=9, va="top")
        ax.text(0.97, y, val, transform=ax.transAxes,
                color=vc, fontsize=9, va="top", ha="right",
                fontweight="bold")
        y -= 0.10

    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="#0D1117")
    plt.close()
    return path


def print_summary(base: dict, mc: dict):
    milestones = [1, 30, 90, 180, 270, 365]
    print("\n" + "═" * 68)
    print("  Lumoria — فاز ۳: شبیه‌سازی عامل‌محور سریع")
    print("═" * 68)
    print(f"{'Day':>4} | {'Players':>8} | {'Supply':>11} | "
          f"{'burn/mint':>10} | {'Net K SAP/d':>12}")
    print("─" * 68)
    for d in milestones:
        i = d - 1
        if i >= len(base["day"]):
            continue
        net_k = (base["daily_mint"][i] - base["daily_burn"][i]) / 1000
        sup   = base["total_supply"][i]
        sup_s = f"{sup/1e6:.2f}M" if sup >= 1e6 else f"{sup/1e3:.0f}K"
        print(f"{d:>4} | {base['players'][i]:>8,} | {sup_s:>11} | "
              f"{base['burn_ratio'][i]:>9.1%} | {net_k:>+11.1f}K")
    print("═" * 68)

    avg = float(np.mean(base["burn_ratio"][30:]))
    print(f"\n🎲 Monte Carlo ({len(mc['days'])} روز | {300} سناریو | رشد 5٪–35٪)")
    print(f"   میانه burn/mint  : {mc['final_ratio_mean']:.1%} ± {mc['final_ratio_std']:.1%}")
    print(f"   سناریوهای سالم  : {mc['pct_healthy']:.0f}٪")
    print(f"   عرضه p50 روز365 : {mc['supply_p50'][-1]/1e6:.2f}M SAP")
    print(f"   عرضه p95 روز365 : {mc['supply_p95'][-1]/1e6:.2f}M SAP")

    print("\n📋 پارامترهای نهایی → قرارداد Tact:")
    print(f"   SEED_COST_SAP          = {P['seed_cost']}")
    print(f"   HARVEST_REWARD_SAP     = {P['harvest_reward']}")
    print(f"   HARVEST_CYCLE_HOURS    = {P['harvest_cycle_h']}")
    print(f"   LAND_TAX_RATE_DAILY    = {P['land_tax_rate']:.0%}")
    print(f"   MARKETPLACE_BURN_RATE  = {P['market_burn']:.0%}")
    print(f"   TOOL_REPAIR_BASE_SAP   = {P['tool_repair_base']}")

    verdict = "✅ پایدار — پارامترها تأیید شد" if 0.80 <= avg <= 0.98 else "⚠️  نیاز به تنظیم"
    print(f"\n   نتیجه نهایی: {verdict}\n")


if __name__ == "__main__":
    import time

    print("🌱 شبیه‌سازی پایه (5000 بازیکن، 365 روز)...")
    t0 = time.perf_counter()
    base = simulate_fast(n_start=5_000, days=365, monthly_growth=0.15)
    print(f"   ✅ {time.perf_counter()-t0:.2f}s")

    print("🎲 Monte Carlo (300 سناریو)...")
    t1 = time.perf_counter()
    mc = monte_carlo_fast(n_runs=300, n_start=5_000, days=365)
    print(f"   ✅ {time.perf_counter()-t1:.2f}s")

    print_summary(base, mc)

    out = OUTPUT_DIR / "lumoria_econ_report.png"
    print(f"🎨 رسم نمودار → {out}")
    plot_report(base, mc, out)
    print("✅ گزارش کامل شد.")
