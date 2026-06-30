# Lumoria — چک‌لیست آدیت داخلی (پیش از testnet)

> تاریخ: 2026-06-28 | نسخه قراردادها: v2.0 | ابزار: Tact 1.6.13

## ۱. کنترل دسترسی (Access Control)

| چک | وضعیت | یادداشت |
|----|--------|---------|
| `Mint` فقط owner یا gameContract | ✅ | SAP.tact:39 |
| `Upgrade` فقط owner | ✅ | Upgradeable.tact:12 |
| `RegisterLand` فقط admin | ✅ | CropManager.tact |
| `CollectLandTax` فقط admin | ✅ | CropManager.tact |
| `PlantCrop` فقط مالک زمین | ✅ | land.owner == sender() |
| `HarvestCrop` فقط مالک زمین | ✅ | land.owner == sender() |
| `RepairTools` فقط مالک زمین | ✅ | land.owner == sender() |
| `BuyListedLand` هر کسی | ✅ | طراحی‌شده برای عموم |

## ۲. ریاضیات و سرریز (Integer Math)

| چک | وضعیت | یادداشت |
|----|--------|---------|
| Burn > totalSupply | ✅ | require(totalSupply >= amount) |
| Fee محاسبه: price * 700 / 10000 | ✅ | TON عدد بزرگ int است |
| Tax محاسبه: HARVEST_SAP * 6 * 1000 / 10000 | ✅ | 60,000,000,000 < 2^63 |
| slotKey: landId * 16 + slot | ✅ | landId uint64 → باید تکراری نباشد |

## ۳. Reentrancy

TON از طریق پیام‌های async کار می‌کند — reentrancy کلاسیک وجود ندارد.
هر تراکنش atomic است و state قبل از send ذخیره می‌شود.

| چک | وضعیت |
|----|--------|
| State قبل از send به‌روز می‌شود | ✅ |
| Double-harvest: harvested=true قبل از mint | ✅ |
| Double-plant: check قبل از set | ✅ |

## ۴. Anti-Bot

| چک | وضعیت | یادداشت |
|----|--------|---------|
| Rate limit: 300s بین PlantCrop | ✅ | lastActionAt check |
| Nonce در CropState ذخیره می‌شود | ✅ | برای audit trail |
| slotIndex max 16 | ✅ | require(slotIndex < 16) |
| stewardship capacity | ✅ | activeCrops < stewardship |

**⚠️ ریسک باقی‌مانده:**
- Bot می‌تواند nonce را با هر مقداری ارسال کند (on-chain verify ندارد)
- برای v2: امضای ECDSA از backend اضافه شود

## ۵. Upgrade Safety

| چک | وضعیت | یادداشت |
|----|--------|---------|
| فقط owner می‌تواند upgrade کند | ✅ | |
| state پس از upgrade حفظ می‌شود | ✅ | setCode بدون setData |
| wallet ها upgrade نمی‌شوند | ✅ | SAPJettonWallet و LandItem immutable |
| emit event پس از upgrade | ✅ | 'UPGR' tag |

**⚠️ ریسک:**
- اگر owner private key leak شود، تمام قراردادها در معرض خطر
- راه‌حل: multisig wallet برای owner (Priority 1 پیش از mainnet)

## ۶. TON-Specific

| چک | وضعیت | یادداشت |
|----|--------|---------|
| Gas attach در همه send ها | ✅ | ton("0.05") |
| bounce: false برای mint پیام‌ها | ✅ | |
| bounce: true برای BurnPool | ✅ | اگر master reject کند |
| Storage fee در نظر گرفته شده | ⚠️ | نیاز به تحلیل پس از deploy |
| Contract size در محدوده | ✅ | هر contract < 128KB |

## ۷. Business Logic

| چک | وضعیت | یادداشت |
|----|--------|---------|
| SEED_COST = 8 SAP | ✅ | تأییدشده فاز ۳ |
| HARVEST_SAP = 10 SAP | ✅ | |
| CYCLE_SEC = 14400 (4h) | ✅ | |
| TAX_BPS = 1000 (10٪) | ✅ | |
| MARKETPLACE_FEE = 700 (7٪) | ✅ | |
| toolHP کاهش با کشت | ✅ | anti-hyperinflation sink |
| fertility در LandItem | ⚠️ | هنوز از CropManager کاهش نمی‌یابد |

## ۸. مشکلات شناخته‌شده (Known Issues)

### Critical (پیش از mainnet باید حل شود)
- [ ] **Multisig برای owner**: Private key تنها نقطه شکست است
- [ ] **Land sync**: TransferLandOwnership باید اتوماتیک trigger شود (از LandItem transfer)

### High (پیش از mainnet توصیه می‌شود)
- [ ] **Bot signature verification**: PlantCrop نیاز به امضای ECDSA از backend
- [ ] **Fertility update**: CropManager باید fertility زمین را کاهش دهد

### Medium (v2)
- [ ] **Bonding curve**: قیمت Common/Uncommon با عرضه افزایش یابد
- [ ] **Cooldown per slot**: نه per player — برای Mythic با ۱۶ slot

### Low
- [ ] **ts-jest deprecation warning**: تنظیمات jest.config.ts
- [ ] **forceExit**: @ton/sandbox handle open ندارد

## ۹. پیشنهاد برای آدیت خارجی

پیش از mainnet deploy، پیشنهاد می‌شود:
1. **CertiK** یا **BlockSec** (آدیت کامل)
2. **TON Security** (TON-specific audit)
3. **Bug Bounty** ($1,000–$10,000 بر اساس severity)

---
*این چک‌لیست توسط تیم داخلی Lumoria تهیه شده و جایگزین آدیت خارجی نیست.*
