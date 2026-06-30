"""
Lumoria — شبیه‌سازی اقتصاد SAP
هدف: اثبات عددی که در ۶-۱۲ ماه اقتصاد منجر/منقبض نمی‌شود
"""
import math
from dataclasses import dataclass, field
from typing import List


# ── پارامترها ────────────────────────────────────────────────────
@dataclass
class Params:
    # بازیکنان
    initial_players: int = 1_000
    monthly_growth_rate: float = 0.15       # ۱۵٪ رشد ماهانه

    # تولید SAP
    sap_per_harvest: float = 10.0           # SAP در هر Lumen Apple
    harvests_per_day_per_land: float = 6.0  # ۴ ساعت = ۶ بار در روز
    avg_lands_per_player: float = 1.2       # میانگین شروع

    # مصرف SAP (sinks)
    land_tax_rate: float = 0.02             # ۲٪ روزانه از تولید
    seed_cost_sap: float = 5.0              # هزینه هر بذر
    marketplace_burn_rate: float = 0.025    # ۲.۵٪ هر معامله سوزانده می‌شود
    tool_repair_daily: float = 2.0          # هزینه تعمیر ابزار روزانه

    # ظرفیت سرپرستی
    base_capacity: int = 2                  # زمین رایگان
    capacity_per_level: int = 1

    simulation_days: int = 365


@dataclass
class DaySnapshot:
    day: int
    players: float
    total_supply: float
    daily_mint: float
    daily_burn: float
    net_flow: float         # mint - burn
    inflation_rate: float   # net_flow / total_supply


def run_simulation(p: Params = Params()) -> List[DaySnapshot]:
    snapshots = []
    total_supply = 0.0
    players = float(p.initial_players)

    for day in range(1, p.simulation_days + 1):
        # رشد بازیکنان (روزانه از ماهانه)
        daily_growth = (1 + p.monthly_growth_rate) ** (1 / 30) - 1
        players *= (1 + daily_growth)

        avg_lands = min(p.avg_lands_per_player + day * 0.003, 5.0)

        # ── MINT ──
        raw_harvest = players * avg_lands * p.harvests_per_day_per_land * p.sap_per_harvest
        # کاهش بازده به‌خاطر ظرفیت (stewardship capacity mechanic)
        capacity = p.base_capacity + (day // 30) * p.capacity_per_level
        efficiency = min(1.0, capacity / avg_lands)
        daily_mint = raw_harvest * efficiency

        # ── BURN (sinks) ──
        # ۱. مالیات زمین
        land_tax = daily_mint * p.land_tax_rate
        # ۲. خرید بذر (هر harvest یک بذر لازم دارد)
        seed_burn = players * avg_lands * p.harvests_per_day_per_land * p.seed_cost_sap
        # ۳. کارمزد marketplace (۱۰٪ از کاربران روزانه معامله می‌کنند)
        marketplace_burn = daily_mint * 0.10 * p.marketplace_burn_rate
        # ۴. تعمیر ابزار
        tool_burn = players * p.tool_repair_daily

        daily_burn = land_tax + seed_burn + marketplace_burn + tool_burn
        net_flow = daily_mint - daily_burn

        total_supply = max(0, total_supply + net_flow)
        inflation = net_flow / total_supply if total_supply > 0 else 0

        snapshots.append(DaySnapshot(
            day=day,
            players=players,
            total_supply=total_supply,
            daily_mint=daily_mint,
            daily_burn=daily_burn,
            net_flow=net_flow,
            inflation_rate=inflation,
        ))

    return snapshots


def report(snapshots: List[DaySnapshot]):
    print("=" * 65)
    print(f"{'روز':>5} | {'بازیکن':>9} | {'عرضه کل':>13} | "
          f"{'mint/روز':>10} | {'burn/روز':>10} | {'تورم%':>7}")
    print("-" * 65)

    milestones = [1, 30, 60, 90, 180, 270, 365]
    for s in snapshots:
        if s.day in milestones:
            print(
                f"{s.day:>5} | {s.players:>9,.0f} | {s.total_supply:>13,.0f} | "
                f"{s.daily_mint:>10,.0f} | {s.daily_burn:>10,.0f} | "
                f"{s.inflation_rate * 100:>6.2f}%"
            )

    print("=" * 65)

    last = snapshots[-1]
    annual_inflation = (last.total_supply / snapshots[29].total_supply - 1) * 100 if len(snapshots) >= 30 else 0

    print(f"\n📊 خلاصه سال اول:")
    print(f"  بازیکنان نهایی:  {last.players:,.0f}")
    print(f"  عرضه کل SAP:     {last.total_supply:,.0f}")
    print(f"  تورم سالانه:     {annual_inflation:.1f}%")

    healthy = all(abs(s.inflation_rate) < 0.05 for s in snapshots[30:])
    print(f"  وضعیت اقتصاد:   {'✅ پایدار' if healthy else '⚠️  نیاز به تنظیم'}")
    print()

    # هشدار sink کافی
    avg_ratio = sum(s.daily_burn / s.daily_mint for s in snapshots if s.daily_mint > 0) / len(snapshots)
    print(f"  نسبت burn/mint:  {avg_ratio:.2%}")
    if avg_ratio < 0.80:
        print("  ⚠️  هشدار: sink کافی نیست — نرخ مالیات یا هزینه بذر را بالا ببر")
    elif avg_ratio > 0.98:
        print("  ⚠️  هشدار: burn خیلی زیاد — ممکن است اقتصاد منقبض شود")
    else:
        print("  ✅ نسبت mint/burn در بازه سالم (80%-98%)")


if __name__ == "__main__":
    print("\n🌱 Lumoria — شبیه‌سازی اقتصاد SAP (سناریوی پایه)\n")
    snapshots = run_simulation()
    report(snapshots)

    # سناریوی رشد سریع‌تر
    print("\n🚀 سناریوی رشد سریع (۳۰٪ ماهانه)\n")
    p2 = Params(monthly_growth_rate=0.30)
    snapshots2 = run_simulation(p2)
    report(snapshots2)
