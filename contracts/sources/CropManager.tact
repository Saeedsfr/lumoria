// CropManager — هسته منطق بازی Lumoria  v1
// upgradeable via SETCODE | نقطه ورود تمام تراکنش‌های بازی
//
// پارامترهای تأییدشده فاز ۳ (Monte Carlo 300 سناریو):
//   SEED_COST = 8 SAP | HARVEST = 10 SAP | CYCLE = 4h
//   LAND_TAX  = 10٪  | TOOL_REPAIR = 5 SAP

import "./traits/Upgradeable.tact";

const SEED_COST:  Int = 8000000000;
const HARVEST_SAP:Int = 10000000000;
const CYCLE_SEC:  Int = 300;   // testnet: 5 min (mainnet: 14400 = 4h)
const TAX_BPS:    Int = 1000;
const TOOL_SAP:   Int = 5000000000;
const RATE_LIMIT: Int = 10;    // testnet: 10 sec (mainnet: 300)

// ─── پیام‌های Admin ─────────────────────────────────────────────────
message(0x1001) RegisterLand {
    landId:  Int as uint64;
    owner:   Address;
    rarity:  Int as uint8;
}
message(0x1002) TransferLandOwnership {
    landId:   Int as uint64;
    newOwner: Address;
}
message(0x1003) SetStewardship {
    player:   Address;
    capacity: Int as uint16;
}
message(0x1004) SetSAPMaster {
    newMaster: Address;
}

// ─── پیام‌های بازیکن ────────────────────────────────────────────────
message(0x1010) PlantCrop {
    landId:    Int as uint64;
    slotIndex: Int as uint8;
    cropType:  Int as uint8;
    nonce:     Int as uint64;
}
message(0x1011) HarvestCrop {
    landId:    Int as uint64;
    slotIndex: Int as uint8;
}
message(0x1012) RepairTools {
    landId: Int as uint64;
}
message(0x1013) CollectLandTax {
    landId: Int as uint64;
}
message(0x1014) AdminResetSlot {
    landId:    Int as uint64;
    slotIndex: Int as uint8;
}

// ─── ساختار پیام Mint به SAPJettonMaster ────────────────────────────
message(0x2003) MintReward {
    amount: Int as coins;
    to:     Address;
}

// ─── ساختارهای داده ─────────────────────────────────────────────────
struct CropState {
    cropType:  Int as uint8;
    plantedAt: Int as uint64;
    harvestAt: Int as uint64;
    harvested: Bool;
    nonce:     Int as uint64;
}

struct LandInfo {
    owner:   Address;
    rarity:  Int as uint8;
    lastTax: Int as uint64;
    toolHP:  Int as uint8;
}

struct PlayerInfo {
    stewardship:   Int as uint16;
    activeCrops:   Int as uint16;
    lastActionAt:  Int as uint64;
    totalHarvests: Int as uint32;
}

struct GameStats {
    totalPlants:   Int;
    totalHarvests: Int;
    totalBurned:   Int;
    totalMinted:   Int;
}

// ─── CropManager ────────────────────────────────────────────────────
contract CropManager with Upgradeable {

    owner:     Address;
    sapMaster: Address;

    lands:   map<Int, LandInfo>;
    crops:   map<Int, CropState>;
    players: map<Address, PlayerInfo>;

    totalPlants:   Int as uint64 = 0;
    totalHarvests: Int as uint64 = 0;
    totalBurned:   Int as coins  = 0;
    totalMinted:   Int as coins  = 0;

    init(owner: Address, sapMaster: Address) {
        self.owner     = owner;
        self.sapMaster = sapMaster;
    }

    // ── Admin: ثبت زمین ─────────────────────────────────────────────
    receive(msg: RegisterLand) {
        self.requireOwner();
        require(self.lands.get(msg.landId) == null, "CropManager: land exists");

        self.lands.set(msg.landId, LandInfo{
            owner:   msg.owner,
            rarity:  msg.rarity,
            lastTax: now(),
            toolHP:  100,
        });

        let pOpt: PlayerInfo? = self.players.get(msg.owner);
        if (pOpt == null) {
            self.players.set(msg.owner, PlayerInfo{
                stewardship:   2,
                activeCrops:   0,
                lastActionAt:  0,
                totalHarvests: 0,
            });
        }

        emit(beginCell()
            .storeUint(0x52454700, 32)   // 'REG\0'
            .storeUint(msg.landId, 64)
            .storeAddress(msg.owner)
            .storeUint(msg.rarity, 8)
            .endCell());
    }

    // ── Admin: انتقال مالکیت (sync با NFT) ─────────────────────────
    receive(msg: TransferLandOwnership) {
        self.requireOwner();
        let landOpt: LandInfo? = self.lands.get(msg.landId);
        require(landOpt != null, "CropManager: land not found");
        let land: LandInfo = landOpt!!;

        self.lands.set(msg.landId, LandInfo{
            owner:   msg.newOwner,
            rarity:  land.rarity,
            lastTax: land.lastTax,
            toolHP:  land.toolHP,
        });
    }

    // ── Admin: ظرفیت stewardship ────────────────────────────────────
    receive(msg: SetStewardship) {
        self.requireOwner();
        require(msg.capacity <= 1000, "CropManager: capacity too high");
        let pOpt: PlayerInfo? = self.players.get(msg.player);
        if (pOpt != null) {
            let p: PlayerInfo = pOpt!!;
            self.players.set(msg.player, PlayerInfo{
                stewardship:   msg.capacity,
                activeCrops:   p.activeCrops,
                lastActionAt:  p.lastActionAt,
                totalHarvests: p.totalHarvests,
            });
        }
    }

    receive(msg: SetSAPMaster) {
        self.requireOwner();
        self.sapMaster = msg.newMaster;
    }

    // ── بازیکن: کاشت بذر ───────────────────────────────────────────
    receive(msg: PlantCrop) {
        let player: Address = sender();

        let landOpt: LandInfo? = self.lands.get(msg.landId);
        require(landOpt != null, "CropManager: land not found");
        let land: LandInfo = landOpt!!;
        require(land.owner == player, "CropManager: not your land");
        require(msg.slotIndex < 16, "CropManager: bad slot index");

        let pOpt: PlayerInfo? = self.players.get(player);
        require(pOpt != null, "CropManager: player not registered");
        let p: PlayerInfo = pOpt!!;

        require(
            now() - p.lastActionAt >= RATE_LIMIT,
            "CropManager: rate limit (anti-bot)"
        );
        require(
            p.activeCrops < p.stewardship,
            "CropManager: stewardship capacity full"
        );

        let cropKey: Int = msg.landId * 16 + msg.slotIndex;
        let existingOpt: CropState? = self.crops.get(cropKey);
        if (existingOpt != null) {
            require(existingOpt!!.harvested, "CropManager: slot occupied");
        }

        require(land.toolHP > 0, "CropManager: tools broken");

        let harvestTime: Int = now() + CYCLE_SEC;
        self.crops.set(cropKey, CropState{
            cropType:  msg.cropType,
            plantedAt: now(),
            harvestAt: harvestTime,
            harvested: false,
            nonce:     msg.nonce,
        });

        self.players.set(player, PlayerInfo{
            stewardship:   p.stewardship,
            activeCrops:   p.activeCrops + 1,
            lastActionAt:  now(),
            totalHarvests: p.totalHarvests,
        });

        let newHP: Int = land.toolHP > 1 ? land.toolHP - 1 : 0;
        self.lands.set(msg.landId, LandInfo{
            owner:   land.owner,
            rarity:  land.rarity,
            lastTax: land.lastTax,
            toolHP:  newHP,
        });

        self.totalPlants += 1;
        self.totalBurned += SEED_COST;

        emit(beginCell()
            .storeUint(0x504c4e54, 32)   // 'PLNT'
            .storeUint(msg.landId, 64)
            .storeUint(msg.slotIndex, 8)
            .storeUint(msg.cropType, 8)
            .storeUint(harvestTime, 64)
            .storeAddress(player)
            .endCell());
    }

    // ── بازیکن: برداشت ──────────────────────────────────────────────
    receive(msg: HarvestCrop) {
        let player: Address = sender();

        let landOpt: LandInfo? = self.lands.get(msg.landId);
        require(landOpt != null, "CropManager: land not found");
        require(landOpt!!.owner == player, "CropManager: not your land");

        let cropKey: Int = msg.landId * 16 + msg.slotIndex;
        let cropOpt: CropState? = self.crops.get(cropKey);
        require(cropOpt != null, "CropManager: no crop here");
        let crop: CropState = cropOpt!!;
        require(!crop.harvested, "CropManager: already harvested");
        require(now() >= crop.harvestAt, "CropManager: not ready");

        self.crops.set(cropKey, CropState{
            cropType:  crop.cropType,
            plantedAt: crop.plantedAt,
            harvestAt: crop.harvestAt,
            harvested: true,
            nonce:     crop.nonce,
        });

        let pOpt: PlayerInfo? = self.players.get(player);
        if (pOpt != null) {
            let p: PlayerInfo = pOpt!!;
            let newActive: Int = p.activeCrops > 0 ? p.activeCrops - 1 : 0;
            self.players.set(player, PlayerInfo{
                stewardship:   p.stewardship,
                activeCrops:   newActive,
                lastActionAt:  now(),
                totalHarvests: p.totalHarvests + 1,
            });
        }

        // mint پاداش — SAPJettonMaster باید owner = این قرارداد باشد
        send(SendParameters{
            to:     self.sapMaster,
            value:  ton("0.05"),
            bounce: false,
            mode:   SendIgnoreErrors,
            body:   MintReward{ amount: HARVEST_SAP, to: player }.toCell(),
        });

        self.totalHarvests += 1;
        self.totalMinted   += HARVEST_SAP;

        emit(beginCell()
            .storeUint(0x48525654, 32)   // 'HRVT'
            .storeUint(msg.landId, 64)
            .storeUint(msg.slotIndex, 8)
            .storeCoins(HARVEST_SAP)
            .storeAddress(player)
            .endCell());
    }

    // ── بازیکن: تعمیر ابزار ─────────────────────────────────────────
    receive(msg: RepairTools) {
        let landOpt: LandInfo? = self.lands.get(msg.landId);
        require(landOpt != null, "CropManager: land not found");
        let land: LandInfo = landOpt!!;
        require(land.owner == sender(), "CropManager: not your land");

        self.lands.set(msg.landId, LandInfo{
            owner:   land.owner,
            rarity:  land.rarity,
            lastTax: land.lastTax,
            toolHP:  100,
        });

        self.totalBurned += TOOL_SAP;

        emit(beginCell()
            .storeUint(0x52455052, 32)   // 'REPR'
            .storeUint(msg.landId, 64)
            .storeAddress(sender())
            .endCell());
    }

    // ── Admin: reset slot (فقط testnet) ─────────────────────────
    receive(msg: AdminResetSlot) {
        self.requireOwner();
        let cropKey: Int = msg.landId * 16 + msg.slotIndex;
        self.crops.set(cropKey, CropState{
            cropType: 0, plantedAt: 0, harvestAt: 0,
            harvested: true, nonce: 0,
        });
        let pOpt: PlayerInfo? = self.players.get(sender());
        if (pOpt != null) {
            let p: PlayerInfo = pOpt!!;
            let newActive: Int = p.activeCrops > 0 ? p.activeCrops - 1 : 0;
            self.players.set(sender(), PlayerInfo{
                stewardship: p.stewardship, activeCrops: newActive,
                lastActionAt: 0, totalHarvests: p.totalHarvests,
            });
        }
    }

    // ── Admin: مالیات روزانه ─────────────────────────────────────────
    receive(msg: CollectLandTax) {
        self.requireOwner();
        let landOpt: LandInfo? = self.lands.get(msg.landId);
        require(landOpt != null, "CropManager: land not found");
        let land: LandInfo = landOpt!!;

        let elapsed: Int = now() - land.lastTax;
        require(elapsed >= 86400, "CropManager: tax already collected");

        let dailyMint: Int = HARVEST_SAP * 6;
        let tax: Int = dailyMint * TAX_BPS / 10000;

        self.lands.set(msg.landId, LandInfo{
            owner:   land.owner,
            rarity:  land.rarity,
            lastTax: now(),
            toolHP:  land.toolHP,
        });

        self.totalBurned += tax;

        emit(beginCell()
            .storeUint(0x54415800, 32)   // 'TAX\0'
            .storeUint(msg.landId, 64)
            .storeAddress(land.owner)
            .storeCoins(tax)
            .endCell());
    }

    // ── getters ──────────────────────────────────────────────────────
    get fun getCropState(landId: Int, slotIndex: Int): CropState? {
        return self.crops.get(landId * 16 + slotIndex);
    }

    get fun getLandInfo(landId: Int): LandInfo? {
        return self.lands.get(landId);
    }

    get fun getPlayerInfo(player: Address): PlayerInfo? {
        return self.players.get(player);
    }

    get fun isHarvestReady(landId: Int, slotIndex: Int): Bool {
        let cropOpt: CropState? = self.crops.get(landId * 16 + slotIndex);
        if (cropOpt == null) { return false; }
        let crop: CropState = cropOpt!!;
        return !crop.harvested && now() >= crop.harvestAt;
    }

    get fun getStats(): GameStats {
        return GameStats{
            totalPlants:   self.totalPlants,
            totalHarvests: self.totalHarvests,
            totalBurned:   self.totalBurned,
            totalMinted:   self.totalMinted,
        };
    }
}
