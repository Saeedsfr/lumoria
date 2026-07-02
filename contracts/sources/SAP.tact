// SAP — Lumen Sap Token  v2
// TEP-74 Jetton | upgradeable via SETCODE | تابع اقتصاد Lumoria
//
// پارامترهای تأییدشده (فاز ۳ Monte Carlo 300 سناریو):
//   SEED_COST   = 8 SAP | HARVEST_REWARD = 10 SAP
//   LAND_TAX    = 10٪  | MARKETPLACE_BURN = 7٪

import "./traits/Upgradeable.tact";

// ─── پیام‌های Admin ─────────────────────────────────────────────────
message(0x2001) SetGameContract {
    newGame: Address;
}
message(0x2002) SetMintable {
    mintable: Bool;
}
message(0x2003) MintTo {
    amount: Int as coins;
    to:     Address;
}
message(0x2004) BurnPool {
    amount: Int as coins;
}
message(0x2005) SetContent {
    content: Cell;
}

// ─── Jetton Master ──────────────────────────────────────────────────
contract SAPJettonMaster with Upgradeable {

    owner:        Address;
    gameContract: Address;
    content:      Cell;
    totalSupply:  Int as coins = 0;
    mintable:     Bool = true;

    init(owner: Address, gameContract: Address, content: Cell) {
        self.owner        = owner;
        self.gameContract = gameContract;
        self.content      = content;
    }

    // ── فقط gameContract یا owner می‌تواند mint کند ─────────────────
    receive(msg: MintTo) {
        require(self.mintable, "SAP: minting disabled");
        require(
            sender() == self.gameContract || sender() == self.owner,
            "SAP: unauthorized minter"
        );
        require(msg.amount > 0, "SAP: zero amount");

        self.totalSupply += msg.amount;
        self._sendToWallet(msg.to, msg.amount);
    }

    receive(msg: SetGameContract) {
        self.requireOwner();
        self.gameContract = msg.newGame;
    }

    receive(msg: SetMintable) {
        self.requireOwner();
        self.mintable = msg.mintable;
    }

    receive(msg: SetContent) {
        self.requireOwner();
        self.content = msg.content;
    }

    // ── Burn اطلاع از wallet ها ─────────────────────────────────────
    receive(msg: BurnPool) {
        require(self.totalSupply >= msg.amount, "SAP: underflow");
        self.totalSupply -= msg.amount;
        emit(beginCell()
            .storeUint(0x4255524e, 32)    // 'BURN'
            .storeCoins(msg.amount)
            .storeAddress(sender())
            .endCell());
    }

    // ── TEP-74 getters ───────────────────────────────────────────────
    get fun get_jetton_data(): JettonData {
        return JettonData{
            totalSupply:  self.totalSupply,
            mintable:     self.mintable,
            adminAddress: self.owner,
            content:      self.content,
            walletCode:   initOf SAPJettonWallet(myAddress(), myAddress()).code,
        };
    }

    get fun get_wallet_address(ownerAddr: Address): Address {
        return contractAddress(initOf SAPJettonWallet(ownerAddr, myAddress()));
    }

    get fun gameContract(): Address { return self.gameContract; }
    get fun totalSupply():  Int     { return self.totalSupply; }

    fun _sendToWallet(to: Address, amount: Int) {
        let walletInit: StateInit = initOf SAPJettonWallet(to, myAddress());
        send(SendParameters{
            to:     contractAddress(walletInit),
            value:  ton("0.05"),
            bounce: false,
            mode:   SendIgnoreErrors,
            body: beginCell()
                .storeUint(0x178d4519, 32)
                .storeUint(0, 64)
                .storeCoins(amount)
                .storeAddress(myAddress())
                .storeAddress(to)
                .storeCoins(0)
                .storeBit(false)
                .endCell(),
            code: walletInit.code,
            data: walletInit.data,
        });
    }
}

// ─── structs ─────────────────────────────────────────────────────────
struct JettonData {
    totalSupply:  Int;
    mintable:     Bool;
    adminAddress: Address;
    content:      Cell;
    walletCode:   Cell;
}

// ─── Jetton Wallet (ثابت — TEP-74 نباید upgrade شود) ────────────────
contract SAPJettonWallet {
    balance: Int as coins = 0;
    owner:   Address;
    master:  Address;

    init(owner: Address, master: Address) {
        self.owner  = owner;
        self.master = master;
    }

    receive(msg: Slice) {
        let op: Int = msg.loadUint(32);

        // InternalTransfer 0x178d4519 — از یک SAP wallet دیگر یا مینت از master
        if (op == 0x178d4519) {
            msg.loadUint(64);                          // query_id
            let amount: Int = msg.loadCoins();
            let from:   Address = msg.loadAddress();
            msg.loadAddress();                         // response_destination (بلااستفاده)
            let forwardTon:     Int   = msg.loadCoins();
            let forwardPayload: Cell? = msg.loadMaybeRef();

            require(amount > 0, "SAP Wallet: zero amount");
            self.balance += amount;

            // اگر forward_ton_amount>0 باشد، طبق TEP-74 باید به owner اطلاع بدیم
            // (این پیام برای فعال‌سازی اکشن‌های بازی مثل PlantCrop استفاده می‌شود)
            if (forwardTon > 0) {
                send(SendParameters{
                    to:     self.owner,
                    value:  forwardTon,
                    bounce: false,
                    mode:   SendPayGasSeparately,
                    body: beginCell()
                        .storeUint(0x7362d09c, 32)   // transfer_notification
                        .storeUint(0, 64)
                        .storeCoins(amount)
                        .storeAddress(from)
                        .storeMaybeRef(forwardPayload)
                        .endCell(),
                });
            }
            return;
        }

        // Transfer 0xf8a7ea5 — به کاربر دیگر (یا پرداخت به یک قرارداد بازی)
        if (op == 0xf8a7ea5) {
            require(sender() == self.owner, "SAP Wallet: not owner");
            msg.loadUint(64);                          // query_id
            let amount:     Int     = msg.loadCoins();
            let to:         Address = msg.loadAddress();
            msg.loadAddress();                         // response_destination (بلااستفاده)
            msg.loadMaybeRef();                        // custom_payload (بلااستفاده)
            let forwardTon:     Int   = msg.loadCoins();
            let forwardPayload: Cell? = msg.loadMaybeRef();

            require(self.balance >= amount, "SAP Wallet: insufficient");
            self.balance -= amount;

            let destInit: StateInit = initOf SAPJettonWallet(to, self.master);
            send(SendParameters{
                to:     contractAddress(destInit),
                value:  ton("0.05") + forwardTon,
                bounce: false,
                mode:   SendIgnoreErrors,
                body: beginCell()
                    .storeUint(0x178d4519, 32)
                    .storeUint(0, 64)
                    .storeCoins(amount)
                    .storeAddress(self.owner)
                    .storeAddress(self.owner)
                    .storeCoins(forwardTon)
                    .storeMaybeRef(forwardPayload)
                    .endCell(),
                code: destInit.code,
                data: destInit.data,
            });
            return;
        }

        // Burn 0x595f07bc
        if (op == 0x595f07bc) {
            require(sender() == self.owner, "SAP Wallet: not owner");
            msg.loadUint(64);
            let amount: Int = msg.loadCoins();
            require(self.balance >= amount, "SAP Wallet: insufficient");
            self.balance -= amount;

            send(SendParameters{
                to:     self.master,
                value:  ton("0.05"),
                bounce: true,
                mode:   SendIgnoreErrors,
                body:   BurnPool{ amount: amount }.toCell(),
            });
            return;
        }
    }

    get fun balance(): Int    { return self.balance; }
    get fun owner():   Address { return self.owner;  }
    get fun master():  Address { return self.master; }

    // ── گتر استاندارد TEP-74 — بدون این، ولت‌های خارجی (Tonkeeper و مشابه)
    // این قرارداد را جتون‌ولت معتبر تشخیص نمی‌دهند و موجودی نمایش داده نمی‌شود
    get fun get_wallet_data(): JettonWalletData {
        return JettonWalletData{
            balance:    self.balance,
            owner:      self.owner,
            master:     self.master,
            walletCode: initOf SAPJettonWallet(self.owner, self.master).code,
        };
    }
}

struct JettonWalletData {
    balance:    Int;
    owner:      Address;
    master:     Address;
    walletCode: Cell;
}
