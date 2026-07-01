import "@ton/test-utils";
import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { toNano, beginCell } from "@ton/core";
import { SAPJettonMaster } from "../build/SAP/SAPJettonMaster_SAPJettonMaster";
import { SAPJettonWallet } from "../build/SAP/SAPJettonMaster_SAPJettonWallet";

describe("SAPJettonMaster", () => {
    let blockchain:   Blockchain;
    let owner:        SandboxContract<TreasuryContract>;
    let gameContract: SandboxContract<TreasuryContract>;
    let player:       SandboxContract<TreasuryContract>;
    let sapMaster:    SandboxContract<SAPJettonMaster>;

    const dummyContent = beginCell().storeUint(0, 8).endCell();

    beforeEach(async () => {
        blockchain   = await Blockchain.create();
        owner        = await blockchain.treasury("owner");
        gameContract = await blockchain.treasury("gameContract");
        player       = await blockchain.treasury("player");

        sapMaster = blockchain.openContract(
            await SAPJettonMaster.fromInit(
                owner.address,
                gameContract.address,
                dummyContent
            )
        );

        // deploy با null body (receive() {} در trait Upgradeable)
        const deployResult = await sapMaster.send(
            owner.getSender(),
            { value: toNano("0.1") },
            { $$type: "SetMintable", mintable: true }   // deploy + init
        );
        expect(deployResult.transactions).toHaveTransaction({
            from:    owner.address,
            to:      sapMaster.address,
            deploy:  true,
            success: true,
        });
    });

    it("mint: owner می‌تواند mint کند", async () => {
        const mintTx = await sapMaster.send(
            owner.getSender(),
            { value: toNano("0.2") },
            { $$type: "MintTo", amount: toNano("10"), to: player.address }
        );
        expect(mintTx.transactions).toHaveTransaction({ success: true });

        const data = await sapMaster.getGetJettonData();
        expect(data.totalSupply).toBe(toNano("10"));
    });

    it("mint: gameContract می‌تواند mint کند", async () => {
        const mintTx = await sapMaster.send(
            gameContract.getSender(),
            { value: toNano("0.2") },
            { $$type: "MintTo", amount: toNano("10"), to: player.address }
        );
        expect(mintTx.transactions).toHaveTransaction({ success: true });
    });

    it("mint: غیرمجاز نمی‌تواند", async () => {
        const mintTx = await sapMaster.send(
            player.getSender(),
            { value: toNano("0.2") },
            { $$type: "MintTo", amount: toNano("10"), to: player.address }
        );
        expect(mintTx.transactions).toHaveTransaction({ success: false });
    });

    it("burn: totalSupply کاهش می‌یابد", async () => {
        await sapMaster.send(
            owner.getSender(),
            { value: toNano("0.2") },
            { $$type: "MintTo", amount: toNano("10"), to: player.address }
        );

        const burnTx = await sapMaster.send(
            owner.getSender(),
            { value: toNano("0.1") },
            { $$type: "BurnPool", amount: toNano("3") }
        );
        expect(burnTx.transactions).toHaveTransaction({ success: true });

        const data = await sapMaster.getGetJettonData();
        expect(data.totalSupply).toBe(toNano("7"));
    });

    it("SetGameContract: فقط owner", async () => {
        const newGame = await blockchain.treasury("newGame");
        const tx = await sapMaster.send(
            owner.getSender(),
            { value: toNano("0.05") },
            { $$type: "SetGameContract", newGame: newGame.address }
        );
        expect(tx.transactions).toHaveTransaction({ success: true });

        const gc = await sapMaster.getGameContract();
        expect(gc.equals(newGame.address)).toBe(true);
    });

    it("SetMintable: mint غیرفعال می‌شود", async () => {
        await sapMaster.send(
            owner.getSender(),
            { value: toNano("0.05") },
            { $$type: "SetMintable", mintable: false }
        );
        const mintTx = await sapMaster.send(
            owner.getSender(),
            { value: toNano("0.2") },
            { $$type: "MintTo", amount: toNano("1"), to: player.address }
        );
        expect(mintTx.transactions).toHaveTransaction({ success: false });
    });

    it("upgrade: فقط owner می‌تواند setCode کند", async () => {
        const fakeCode = beginCell().storeUint(0xdead, 16).endCell();

        const failTx = await sapMaster.send(
            player.getSender(),
            { value: toNano("0.1") },
            { $$type: "UpgradeContract", code: fakeCode }
        );
        expect(failTx.transactions).toHaveTransaction({ success: false });
    });

    it("wallet_address getter کار می‌کند", async () => {
        const walletAddr = await sapMaster.getGetWalletAddress(player.address);
        expect(walletAddr).toBeDefined();
    });

    it("get_wallet_data: استاندارد TEP-74 — بدون این Tonkeeper موجودی را نشان نمی‌دهد", async () => {
        await sapMaster.send(
            owner.getSender(),
            { value: toNano("0.2") },
            { $$type: "MintTo", amount: toNano("10"), to: player.address }
        );
        const walletAddr = await sapMaster.getGetWalletAddress(player.address);
        const wallet = blockchain.openContract(SAPJettonWallet.fromAddress(walletAddr));

        const data = await wallet.getGetWalletData();
        expect(data.balance).toBe(toNano("10"));
        expect(data.owner.equals(player.address)).toBe(true);
        expect(data.master.equals(sapMaster.address)).toBe(true);
    });

    it("Transfer با forward payload: مقصد را transfer_notification با payload می‌رساند", async () => {
        await sapMaster.send(
            owner.getSender(),
            { value: toNano("0.2") },
            { $$type: "MintTo", amount: toNano("10"), to: player.address }
        );
        const playerWalletAddr = await sapMaster.getGetWalletAddress(player.address);
        const playerWallet = blockchain.openContract(SAPJettonWallet.fromAddress(playerWalletAddr));

        const recipient = await blockchain.treasury("recipient");
        const payload = beginCell().storeUint(0xdead, 16).endCell();

        const transferBody = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64)
            .storeCoins(toNano("4"))
            .storeAddress(recipient.address)
            .storeAddress(player.address)
            .storeMaybeRef(null)
            .storeCoins(toNano("0.05"))
            .storeMaybeRef(payload)
            .endCell();

        const tx = await playerWallet.send(player.getSender(), { value: toNano("0.2") }, transferBody.asSlice());
        expect(tx.transactions).toHaveTransaction({ success: true });
        expect(tx.transactions).toHaveTransaction({ to: recipient.address, success: true });

        const recipientWalletAddr = await sapMaster.getGetWalletAddress(recipient.address);
        const recipientWallet = blockchain.openContract(SAPJettonWallet.fromAddress(recipientWalletAddr));
        const data = await recipientWallet.getGetWalletData();
        expect(data.balance).toBe(toNano("4"));

        const playerData = await playerWallet.getGetWalletData();
        expect(playerData.balance).toBe(toNano("6"));
    });
});
