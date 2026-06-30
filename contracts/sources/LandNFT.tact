// LandNFT — زمین‌های Lumoria  v2
// TEP-62 NFT | upgradeable | bonding curve پایه
//
// Slots: Common=2  Uncommon=3  Rare=4  Epic=6  Legendary=9  Mythic=16
// Cap:   Rare=250K  Epic=75K  Legendary=5K  Mythic=500  Common/Uncommon=∞

import "./traits/Upgradeable.tact";

// ─── پیام‌های Admin ─────────────────────────────────────────────────
message(0x3001) MintLand {
    to:     Address;
    rarity: Int as uint8;
}
message(0x3002) SetLandPrice {
    rarity: Int as uint8;
    price:  Int as coins;
}
message(0x3003) SetMarketplaceFee {
    feeBps: Int as uint16;
}
message(0x3004) WithdrawTreasury {
    to:     Address;
    amount: Int as coins;
}

// ─── پیام‌های بازیکن ────────────────────────────────────────────────
message(0x3010) BuyLand {
    rarity: Int as uint8;
}
message(0x3011) ListLandForSale {
    itemIndex: Int as uint64;
    price:     Int as coins;
}
message(0x3012) BuyListedLand {
    itemIndex: Int as uint64;
}

// ─── NFT Collection ─────────────────────────────────────────────────
contract LandCollection with Upgradeable {

    owner:             Address;
    collectionContent: Cell;
    nextItemIndex:     Int as uint64 = 0;
    marketplaceFee:    Int as uint16 = 700;

    maxSupply:   map<Int, Int>;
    mintedCount: map<Int, Int>;
    rarityPrice: map<Int, Int>;
    listings:    map<Int, ListingData>;

    init(owner: Address, collectionContent: Cell) {
        self.owner             = owner;
        self.collectionContent = collectionContent;

        self.maxSupply.set(2, 250000);
        self.maxSupply.set(3, 75000);
        self.maxSupply.set(4, 5000);
        self.maxSupply.set(5, 500);

        self.rarityPrice.set(0, ton("0.5"));
        self.rarityPrice.set(1, ton("2"));
        self.rarityPrice.set(2, ton("10"));
        self.rarityPrice.set(3, ton("50"));
        self.rarityPrice.set(4, ton("200"));
        self.rarityPrice.set(5, ton("1000"));
    }

    // ── Admin: mint رایگان ──────────────────────────────────────────
    receive(msg: MintLand) {
        self.requireOwner();
        self._checkAndMint(msg.to, msg.rarity);
    }

    // ── بازیکن: خرید با TON ─────────────────────────────────────────
    receive(msg: BuyLand) {
        let priceOpt: Int? = self.rarityPrice.get(msg.rarity);
        require(priceOpt != null, "LandCollection: invalid rarity");
        let price: Int = priceOpt!!;
        require(context().value >= price + ton("0.1"), "LandCollection: insufficient TON");

        self._checkAndMint(sender(), msg.rarity);

        let excess: Int = context().value - price - ton("0.1");
        if (excess > 0) {
            send(SendParameters{
                to:     sender(),
                value:  excess,
                bounce: false,
                mode:   SendIgnoreErrors,
                body:   beginCell().endCell(),
            });
        }
    }

    // ── Listing ─────────────────────────────────────────────────────
    receive(msg: ListLandForSale) {
        require(msg.price > 0, "LandCollection: zero price");
        self.listings.set(msg.itemIndex, ListingData{
            seller: sender(),
            price:  msg.price,
            active: true,
        });
        emit(beginCell()
            .storeUint(0x4c495354, 32)   // 'LIST'
            .storeUint(msg.itemIndex, 64)
            .storeCoins(msg.price)
            .storeAddress(sender())
            .endCell());
    }

    // ── خرید از marketplace ─────────────────────────────────────────
    receive(msg: BuyListedLand) {
        let listingOpt: ListingData? = self.listings.get(msg.itemIndex);
        require(listingOpt != null, "LandCollection: not listed");
        let listing: ListingData = listingOpt!!;
        require(listing.active, "LandCollection: listing inactive");
        require(
            context().value >= listing.price + ton("0.15"),
            "LandCollection: insufficient TON"
        );

        let fee:    Int     = listing.price * self.marketplaceFee / 10000;
        let net:    Int     = listing.price - fee;
        let seller: Address = listing.seller;

        self.listings.set(msg.itemIndex, ListingData{
            seller: seller,
            price:  listing.price,
            active: false,
        });

        let itemAddr: Address = contractAddress(initOf LandItem(myAddress(), msg.itemIndex));
        send(SendParameters{
            to:     itemAddr,
            value:  ton("0.05"),
            bounce: false,
            mode:   SendIgnoreErrors,
            body: beginCell()
                .storeUint(0x5fcc3d14, 32)   // TEP-62 Transfer opcode
                .storeUint(0, 64)
                .storeAddress(sender())
                .storeAddress(sender())
                .storeBit(false)
                .storeCoins(0)
                .storeBit(false)
                .endCell(),
        });

        send(SendParameters{
            to:     seller,
            value:  net,
            bounce: false,
            mode:   SendIgnoreErrors,
            body:   beginCell().endCell(),
        });

        emit(beginCell()
            .storeUint(0x534f4c44, 32)   // 'SOLD'
            .storeUint(msg.itemIndex, 64)
            .storeAddress(sender())
            .storeAddress(seller)
            .storeCoins(listing.price)
            .storeCoins(fee)
            .endCell());
    }

    receive(msg: SetLandPrice) {
        self.requireOwner();
        self.rarityPrice.set(msg.rarity, msg.price);
    }

    receive(msg: SetMarketplaceFee) {
        self.requireOwner();
        require(msg.feeBps <= 1000, "LandCollection: fee > 10%");
        self.marketplaceFee = msg.feeBps;
    }

    receive(msg: WithdrawTreasury) {
        self.requireOwner();
        send(SendParameters{
            to:     msg.to,
            value:  msg.amount,
            bounce: false,
            mode:   SendIgnoreErrors,
            body:   beginCell().endCell(),
        });
    }

    // ── getters ───────────────────────────────────────────────────
    get fun get_collection_data(): CollectionData {
        return CollectionData{
            nextItemIndex:     self.nextItemIndex,
            collectionContent: self.collectionContent,
            ownerAddress:      self.owner,
        };
    }

    get fun get_nft_address_by_index(index: Int): Address {
        return contractAddress(initOf LandItem(myAddress(), index));
    }

    get fun getMintedCount(rarity: Int): Int {
        let valOpt: Int? = self.mintedCount.get(rarity);
        return valOpt != null ? valOpt!! : 0;
    }

    get fun getLandPrice(rarity: Int): Int {
        let valOpt: Int? = self.rarityPrice.get(rarity);
        return valOpt != null ? valOpt!! : 0;
    }

    get fun getListing(itemIndex: Int): ListingData? {
        return self.listings.get(itemIndex);
    }

    // ── internal ─────────────────────────────────────────────────
    fun _checkAndMint(to: Address, rarity: Int) {
        require(rarity >= 0 && rarity <= 5, "LandCollection: bad rarity");

        let maxOpt: Int? = self.maxSupply.get(rarity);
        if (maxOpt != null && maxOpt!! > 0) {
            let mintedOpt: Int? = self.mintedCount.get(rarity);
            let minted: Int = mintedOpt != null ? mintedOpt!! : 0;
            require(minted < maxOpt!!, "LandCollection: max supply reached");
            self.mintedCount.set(rarity, minted + 1);
        }

        let itemInit: StateInit = initOf LandItem(myAddress(), self.nextItemIndex);
        send(SendParameters{
            to:     contractAddress(itemInit),
            value:  ton("0.05"),
            bounce: false,
            mode:   SendIgnoreErrors,
            body: beginCell()
                .storeUint(0x4c4e4654, 32)
                .storeAddress(to)
                .storeUint(rarity, 8)
                .endCell(),
            code: itemInit.code,
            data: itemInit.data,
        });

        emit(beginCell()
            .storeUint(0x4d494e54, 32)   // 'MINT'
            .storeUint(self.nextItemIndex, 64)
            .storeAddress(to)
            .storeUint(rarity, 8)
            .endCell());

        self.nextItemIndex += 1;
    }
}

// ─── structs ──────────────────────────────────────────────────────────
struct CollectionData {
    nextItemIndex:     Int;
    collectionContent: Cell;
    ownerAddress:      Address;
}

struct ListingData {
    seller: Address;
    price:  Int;
    active: Bool;
}

// ─── NFT Item (ثابت — TEP-62 باید پایدار باشد) ─────────────────────
contract LandItem {
    collection:  Address;
    itemIndex:   Int as uint64;
    owner:       Address?;
    initialized: Bool = false;

    rarity:    Int as uint8 = 0;
    slotCount: Int as uint8 = 2;
    fertility: Int as uint8 = 100;

    init(collection: Address, itemIndex: Int) {
        self.collection = collection;
        self.itemIndex  = itemIndex;
    }

    receive(msg: Slice) {
        let op: Int = msg.loadUint(32);

        // 0x4c4e4654 = NFT_INIT (از Collection)
        if (op == 0x4c4e4654) {
            require(!self.initialized, "LandItem: already initialized");
            require(sender() == self.collection, "LandItem: not collection");
            self.owner       = msg.loadAddress();
            self.rarity      = msg.loadUint(8);
            self.slotCount   = self._slotsForRarity(self.rarity);
            self.initialized = true;
            return;
        }

        // 0x5fcc3d14 = TEP-62 Transfer
        if (op == 0x5fcc3d14) {
            require(self.initialized, "LandItem: not initialized");
            require(
                sender() == self.owner!! || sender() == self.collection,
                "LandItem: not owner"
            );
            msg.loadUint(64);
            let newOwner: Address = msg.loadAddress();
            self.owner = newOwner;
            emit(beginCell()
                .storeUint(0x5452414e, 32)   // 'TRAN'
                .storeUint(self.itemIndex, 64)
                .storeAddress(newOwner)
                .endCell());
            return;
        }

        // 0x46465254 = FERTILITY_REDUCE (از CropManager از طریق Collection)
        if (op == 0x46465254) {
            require(sender() == self.collection, "LandItem: not collection");
            let reduce: Int = msg.loadUint(8);
            if (self.fertility > reduce) {
                self.fertility -= reduce;
            } else {
                self.fertility = 0;
            }
            return;
        }
    }

    // ── TEP-62 getter ─────────────────────────────────────────────
    get fun get_nft_data(): NFTData {
        return NFTData{
            initialized:       self.initialized,
            index:             self.itemIndex,
            collectionAddress: self.collection,
            ownerAddress:      self.owner!!,
            individualContent: beginCell()
                .storeUint(self.rarity, 8)
                .storeUint(self.slotCount, 8)
                .storeUint(self.fertility, 8)
                .endCell(),
        };
    }

    get fun owner():       Address? { return self.owner; }
    get fun rarity():      Int      { return self.rarity; }
    get fun slotCount():   Int      { return self.slotCount; }
    get fun fertility():   Int      { return self.fertility; }
    get fun initialized(): Bool     { return self.initialized; }

    fun _slotsForRarity(r: Int): Int {
        if (r == 0) { return 2; }
        if (r == 1) { return 3; }
        if (r == 2) { return 4; }
        if (r == 3) { return 6; }
        if (r == 4) { return 9; }
        return 16;
    }
}

struct NFTData {
    initialized:       Bool;
    index:             Int;
    collectionAddress: Address;
    ownerAddress:      Address;
    individualContent: Cell;
}
