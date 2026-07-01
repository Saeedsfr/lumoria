import "@ton/test-utils";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { toNano, beginCell, Address, Cell } from "@ton/core";
import { CropManager } from "../build/CropManager/CropManager_CropManager";
import { SAPJettonMaster } from "../build/SAP/SAPJettonMaster_SAPJettonMaster";
import { SAPJettonWallet } from "../build/SAP/SAPJettonMaster_SAPJettonWallet";

describe("CropManager", () => {
    let blockchain:  Blockchain;
    let admin:       SandboxContract<TreasuryContract>;
    let player:      SandboxContract<TreasuryContract>;
    let sapMaster:   SandboxContract<SAPJettonMaster>;
    let cropManager: SandboxContract<CropManager>;
    let playerWallet: SandboxContract<SAPJettonWallet>;

    const dummyContent = beginCell().storeUint(0, 8).endCell();
    const LAND_ID     = 1n;
    const SLOT_0      = 0n;    // uint8 → bigint
    const LUMEN_APPLE = 0n;    // uint8 → bigint
    const NOW         = Math.floor(Date.now() / 1000);
    const SEED_COST   = toNano("8");
    const TOOL_SAP    = toNano("5");

    /** بدنه اکشن (forward_payload) — همان قالب قدیمی PlantCrop/RepairTools */
    function plantAction(landId: bigint, slotIndex: bigint, cropType: bigint, nonce: bigint): Cell {
        return beginCell()
            .storeUint(0x1010, 32)
            .storeUint(landId, 64)
            .storeUint(slotIndex, 8)
            .storeUint(cropType, 8)
            .storeUint(nonce, 64)
            .endCell();
    }

    function repairAction(landId: bigint): Cell {
        return beginCell()
            .storeUint(0x1012, 32)
            .storeUint(landId, 64)
            .endCell();
    }

    /** بدنه استاندارد Jetton Transfer (TEP-74) با forward payload سفارشی */
    function jettonTransferBody(destination: Address, amount: bigint, forwardTon: bigint, forwardPayload: Cell): Cell {
        return beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64)                 // query_id
            .storeCoins(amount)
            .storeAddress(destination)
            .storeAddress(player.address)      // response_destination
            .storeMaybeRef(null)                // custom_payload
            .storeCoins(forwardTon)
            .storeMaybeRef(forwardPayload)
            .endCell();
    }

    async function sendPlant(landId: bigint, slotIndex: bigint, cropType: bigint, nonce: bigint) {
        const body = jettonTransferBody(
            cropManager.address, SEED_COST, toNano("0.08"),
            plantAction(landId, slotIndex, cropType, nonce)
        );
        return playerWallet.send(player.getSender(), { value: toNano("0.2") }, body.asSlice());
    }

    async function sendRepair(landId: bigint) {
        const body = jettonTransferBody(
            cropManager.address, TOOL_SAP, toNano("0.08"),
            repairAction(landId)
        );
        return playerWallet.send(player.getSender(), { value: toNano("0.2") }, body.asSlice());
    }

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
                admin.address,
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

        // آدرس SAP wallet خودِ CropManager — بدون این، transfer_notification رد می‌شود
        const cropManagerWallet = await sapMaster.getGetWalletAddress(cropManager.address);
        await cropManager.send(
            admin.getSender(),
            { value: toNano("0.05") },
            { $$type: "SetSAPWallet", newWallet: cropManagerWallet }
        );

        await cropManager.send(
            admin.getSender(),
            { value: toNano("0.1") },
            { $$type: "RegisterLand", landId: LAND_ID, owner: player.address, rarity: 0n }
        );

        // شارژ کیف‌پول بازیکن با ۵۰ SAP (این هم wallet بازیکن رو دیپلوی می‌کنه)
        await sapMaster.send(
            admin.getSender(),
            { value: toNano("0.5") },
            { $$type: "MintTo", amount: toNano("50"), to: player.address }
        );
        const playerWalletAddr = await sapMaster.getGetWalletAddress(player.address);
        playerWallet = blockchain.openContract(SAPJettonWallet.fromAddress(playerWalletAddr));
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

    it("PlantCrop: کاشت موفق و ۸ SAP واقعاً از کیف‌پول کم می‌شود", async () => {
        const tx = await sendPlant(LAND_ID, SLOT_0, LUMEN_APPLE, 1n);
        expect(tx.transactions).toHaveTransaction({ success: true });

        const crop = await cropManager.getGetCropState(LAND_ID, SLOT_0);
        expect(crop).not.toBeNull();
        expect(crop!.harvested).toBe(false);
        expect(crop!.harvestAt).toBeGreaterThan(BigInt(NOW));

        const walletData = await playerWallet.getGetWalletData();
        expect(walletData.balance).toBe(toNano("50") - SEED_COST);
    });

    it("PlantCrop: بدون پرداخت SAP (پیام مستقیم جعلی) رد می‌شود", async () => {
        const tx = await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            beginCell()
                .storeUint(0x7362d09c, 32)
                .storeUint(0, 64)
                .storeCoins(SEED_COST)
                .storeAddress(player.address)
                .storeMaybeRef(plantAction(LAND_ID, SLOT_0, LUMEN_APPLE, 1n))
                .endCell()
                .asSlice()
        );
        expect(tx.transactions).toHaveTransaction({ success: false });

        const crop = await cropManager.getGetCropState(LAND_ID, SLOT_0);
        expect(crop).toBeNull();
    });

    it("PlantCrop: مبلغ اشتباه رد می‌شود", async () => {
        const body = jettonTransferBody(
            cropManager.address, toNano("1"), toNano("0.08"),
            plantAction(LAND_ID, SLOT_0, LUMEN_APPLE, 1n)
        );
        const tx = await playerWallet.send(player.getSender(), { value: toNano("0.2") }, body.asSlice());
        expect(tx.transactions).toHaveTransaction({ success: false });
    });

    it("PlantCrop: غیرمالک رد می‌شود", async () => {
        const stranger = await blockchain.treasury("stranger");
        await sapMaster.send(
            admin.getSender(),
            { value: toNano("0.5") },
            { $$type: "MintTo", amount: toNano("50"), to: stranger.address }
        );
        const strangerWalletAddr = await sapMaster.getGetWalletAddress(stranger.address);
        const strangerWallet = blockchain.openContract(SAPJettonWallet.fromAddress(strangerWalletAddr));

        const body = jettonTransferBody(
            cropManager.address, SEED_COST, toNano("0.08"),
            plantAction(LAND_ID, SLOT_0, LUMEN_APPLE, 1n)
        );
        const tx = await strangerWallet.send(stranger.getSender(), { value: toNano("0.2") }, body.asSlice());
        expect(tx.transactions).toHaveTransaction({ to: cropManager.address, success: false });
    });

    it("PlantCrop: slot اشغال رد می‌شود", async () => {
        await sendPlant(LAND_ID, SLOT_0, LUMEN_APPLE, 1n);

        blockchain.now = NOW + 301;   // rate limit گذشته

        const tx = await sendPlant(LAND_ID, SLOT_0, LUMEN_APPLE, 2n);
        expect(tx.transactions).toHaveTransaction({ success: false });
    });

    it("HarvestCrop: قبل از موعد رد می‌شود", async () => {
        await sendPlant(LAND_ID, SLOT_0, LUMEN_APPLE, 1n);
        const tx = await cropManager.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "HarvestCrop", landId: LAND_ID, slotIndex: SLOT_0 }
        );
        expect(tx.transactions).toHaveTransaction({ success: false });
    });

    it("HarvestCrop: پس از ۴ ساعت + mint", async () => {
        await sendPlant(LAND_ID, SLOT_0, LUMEN_APPLE, 1n);

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

        const walletData = await playerWallet.getGetWalletData();
        expect(walletData.balance).toBe(toNano("50") - SEED_COST + toNano("10"));
    });

    it("RepairTools: toolHP به ۱۰۰ برمی‌گردد و ۵ SAP کم می‌شود", async () => {
        await sendPlant(LAND_ID, SLOT_0, LUMEN_APPLE, 1n);
        let land = await cropManager.getGetLandInfo(LAND_ID);
        expect(land!.toolHP).toBe(99n);

        blockchain.now = NOW + 11;
        const tx = await sendRepair(LAND_ID);
        expect(tx.transactions).toHaveTransaction({ success: true });

        land = await cropManager.getGetLandInfo(LAND_ID);
        expect(land!.toolHP).toBe(100n);

        const walletData = await playerWallet.getGetWalletData();
        expect(walletData.balance).toBe(toNano("50") - SEED_COST - TOOL_SAP);
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
        await sendPlant(LAND_ID, SLOT_0, LUMEN_APPLE, 1n);
        const stats = await cropManager.getGetStats();
        expect(stats.totalPlants).toBe(1n);
        expect(stats.totalBurned).toBe(8000000000n);
    });
});
