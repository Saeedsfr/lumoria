// Upgradeable — proxy pattern برای TON (Tact 1.6+)
// SETCODE معادل upgradeToAndCall در EVM است
// state (data cell) بین نسخه‌ها حفظ می‌شود

// TVM opcode مستقیم — SETCODE در Tact 1.6 به عنوان تابع built-in وجود ندارد
asm fun rawSetCode(code: Cell) { SETCODE }

// opcode ثابت برای همیشه
message(0x9e025572) UpgradeContract {
    code: Cell;
}

trait Upgradeable {
    owner: Address;

    // null body receiver برای deploy اولیه
    receive() {}

    receive(msg: UpgradeContract) {
        require(sender() == self.owner, "Upgradeable: not owner");
        rawSetCode(msg.code);
        emit(beginCell()
            .storeUint(0x55504752, 32)   // 'UPGR' tag
            .storeRef(msg.code)
            .endCell());
    }

    fun requireOwner() {
        require(sender() == self.owner, "Not owner");
    }
}
