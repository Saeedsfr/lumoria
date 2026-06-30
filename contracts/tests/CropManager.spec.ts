import "@ton/test-utils";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { toNano, beginCell } from "@ton/core";
import { CropManager } from "../build/CropManager/CropManager_CropManager";
import { SAPJettonMaster } from "../build/SAP/SAPJettonMaster_SAPJettonMaster";

describe("CropManager", () => {
    let blockchain:  Blockchain;
    let admin:       SandboxContract<TreasuryContract>;
    let player:      SandboxContract<TreasuryContract>;
    let sapMaster:   SandboxContract<SAPJettonMaster>;
    let cropManager: SandboxContract<CropManager>;

    const dummyContent = beginCell().storeUint(0, 8).endCell();
    const LAND_ID     = 1n;
    const SLOT_0      = 0n;    // uint8 → bigint
    const LUMEN_APPLE = 0n;    // uint8 → bigint
    const NOW         = Math.floor(Date.now() / 1000);

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = NOW;
        admin  = await blockchain.treasury("admin");
        player = await blockchain.treasury("player");

        cropManager = blockchain.openContract(
            await CropManager.fromInit(admin.address, admin.address)
        );
        await cropManager.send(
            admin.getSender(),
            { value: toNano("0.3") },
            { $$type: "SetSAPMaster", newMaster: admin.address }
        );

        sapMaster = blockchain.openContract(
            await SAPJettonMaster.fromInit(
                cropManager.address,
                cropManager.address,
                dummyContent
            )
        );
        await sapMaster.send(
            admin.getSender(),
            { value: toNano("0.2") },
            { $$type: "SetMintable", mintable: true }
        );

        await cropManager.send(
            admin.getSender(),
            { value: toNano("0.05") },
            { $$type: "SetSAPMaster", newMaster: sapMaster.address }
        );

        await cropManager.send(
            admin.getSender(),
            { value: toNano("0.1") },
            { $$type: "RegisterLand", landId: LAND_ID, owner: player.address, rarity: 0n }
        );
    });

    it("RegisterLand: زمین با toolHP=100", async () => {
        const land = await cropManager.getGetLandInfo(LAND_ID);
        expect(land).not.toBeNull();
        expect(land!.owner.equals(player.address)).toBe(true);
        expect(land!.toolHP).toBe(100n);
    });

    it("RegisterLand: تکراری رد می‌شود", async () => {
        const tx = await cropManager.send(
            admin.getSender(),
            { value: toNano("0.1") },
            { $$type: "RegisterLand", landId: LAND_ID, owner: player.address, rarity: 0n }
        );
        expect(tx.transactions).toHaveTransaction({ success: false });
    });

    it("PlayerInfo: stewardship=2 برای بازیکن جدید", async () => {
        const info = await cropManager.getGetPlayerInfo(player.address);
        expect(info).not.toBeNull();
        expect(info!.stewardship).toBe(2n);
        expect(info!.activeCrops).toBe(0n);
    });

    it("PlantCrop: کاشت موفق", async () => {
        const tx = await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            {
                $$type: "PlantCrop",
                landId: LAND_ID, slotIndex: SLOT_0,
                cropType: LUMEN_APPLE, nonce: 1n,
            }
        );
        expect(tx.transactions).toHaveTransaction({ success: true });

        const crop = await cropManager.getGetCropState(LAND_ID, SLOT_0);
        expect(crop).not.toBeNull();
        expect(crop!.harvested).toBe(false);
        expect(crop!.harvestAt).toBeGreaterThan(BigInt(NOW));
    });

    it("PlantCrop: غیرمالک رد می‌شود", async () => {
        const stranger = await blockchain.treasury("stranger");
        const tx = await cropManager.send(
            stranger.getSender(),
            { value: toNano("0.2") },
            { $$type: "PlantCrop", landId: LAND_ID, slotIndex: SLOT_0, cropType: LUMEN_APPLE, nonce: 1n }
        );
        expect(tx.transactions).toHaveTransaction({ success: false });
    });

    it("PlantCrop: slot اشغال رد می‌شود", async () => {
        await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "PlantCrop", landId: LAND_ID, slotIndex: SLOT_0, cropType: LUMEN_APPLE, nonce: 1n }
        );

        blockchain.now = NOW + 301;   // rate limit گذشته

        const tx = await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "PlantCrop", landId: LAND_ID, slotIndex: SLOT_0, cropType: LUMEN_APPLE, nonce: 2n }
        );
        expect(tx.transactions).toHaveTransaction({ success: false });
    });

    it("HarvestCrop: قبل از موعد رد می‌شود", async () => {
        await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "PlantCrop", landId: LAND_ID, slotIndex: SLOT_0, cropType: LUMEN_APPLE, nonce: 1n }
        );
        const tx = await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "HarvestCrop", landId: LAND_ID, slotIndex: SLOT_0 }
        );
        expect(tx.transactions).toHaveTransaction({ success: false });
    });

    it("HarvestCrop: پس از ۴ ساعت + mint", async () => {
        await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "PlantCrop", landId: LAND_ID, slotIndex: SLOT_0, cropType: LUMEN_APPLE, nonce: 1n }
        );

        blockchain.now = NOW + 14401;

        const tx = await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "HarvestCrop", landId: LAND_ID, slotIndex: SLOT_0 }
        );
        expect(tx.transactions).toHaveTransaction({ success: true });

        const crop = await cropManager.getGetCropState(LAND_ID, SLOT_0);
        expect(crop!.harvested).toBe(true);

        expect(tx.transactions).toHaveTransaction({ to: sapMaster.address });
    });

    it("RepairTools: toolHP به ۱۰۰ برمی‌گردد", async () => {
        await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "PlantCrop", landId: LAND_ID, slotIndex: SLOT_0, cropType: LUMEN_APPLE, nonce: 1n }
        );
        let land = await cropManager.getGetLandInfo(LAND_ID);
        expect(land!.toolHP).toBe(99n);

        await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "RepairTools", landId: LAND_ID }
        );
        land = await cropManager.getGetLandInfo(LAND_ID);
        expect(land!.toolHP).toBe(100n);
    });

    it("CollectLandTax: پس از ۲۴h موفق", async () => {
        blockchain.now = NOW + 86401;
        const tx = await cropManager.send(
            admin.getSender(),
            { value: toNano("0.1") },
            { $$type: "CollectLandTax", landId: LAND_ID }
        );
        expect(tx.transactions).toHaveTransaction({ success: true });
    });

    it("CollectLandTax: قبل از ۲۴h رد می‌شود", async () => {
        blockchain.now = NOW + 100;
        const tx = await cropManager.send(
            admin.getSender(),
            { value: toNano("0.1") },
            { $$type: "CollectLandTax", landId: LAND_ID }
        );
        expect(tx.transactions).toHaveTransaction({ success: false });
    });

    it("SetStewardship: ظرفیت ارتقاء", async () => {
        await cropManager.send(
            admin.getSender(),
            { value: toNano("0.1") },
            { $$type: "SetStewardship", player: player.address, capacity: 6n }
        );
        const info = await cropManager.getGetPlayerInfo(player.address);
        expect(info!.stewardship).toBe(6n);
    });

    it("getStats: totalPlants پس از کاشت", async () => {
        await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "PlantCrop", landId: LAND_ID, slotIndex: SLOT_0, cropType: LUMEN_APPLE, nonce: 1n }
        );
        const stats = await cropManager.getGetStats();
        expect(stats.totalPlants).toBe(1n);
        expect(stats.totalBurned).toBe(8000000000n);
    });
});
