import time
from aiogram import Router, types, F
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from utils.database import get_user, get_user_land, plant_crop, harvest_ready, do_harvest

router = Router()


def _time_remaining(harvest_at: int) -> str:
    remaining = harvest_at - int(time.time())
    if remaining <= 0:
        return "آماده برداشت ✅"
    h, r = divmod(remaining, 3600)
    m = r // 60
    return f"{h}س {m}د"


@router.callback_query(F.data == "farm")
async def show_farm(callback: types.CallbackQuery):
    tid = callback.from_user.id
    user = await get_user(tid)
    land = await get_user_land(tid)

    if not land:
        await callback.answer("زمینی پیدا نشد.", show_alert=True)
        return

    ready = await harvest_ready(land["id"])
    ready_count = len(ready)

    text = (
        f"🌾 *مزرعه‌ات — {land['rarity']} Land*\n"
        f"ظرفیت: {land['slot_count']} اسلات\n\n"
    )

    if ready_count > 0:
        text += f"✅ *{ready_count} محصول آماده برداشت!*\n"
    else:
        text += "🌱 محصولی آماده نیست.\n"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌱 کاشت Lumen Apple", callback_data="plant")],
        [InlineKeyboardButton(text="🍎 برداشت", callback_data="harvest")],
        [InlineKeyboardButton(text="🔙 بازگشت", callback_data="back_main")],
    ])

    await callback.message.edit_text(text, parse_mode="Markdown", reply_markup=kb)


@router.callback_query(F.data == "plant")
async def do_plant(callback: types.CallbackQuery):
    tid = callback.from_user.id
    user = await get_user(tid)
    land = await get_user_land(tid)

    if not land:
        await callback.answer("زمینی پیدا نشد.", show_alert=True)
        return

    # بررسی موجودی SAP برای خرید بذر (۵ SAP)
    if user["sap_balance"] < 5:
        await callback.answer(
            "❌ موجودی SAP کافی نیست.\nنیاز: 5 SAP برای بذر Lumen Apple",
            show_alert=True
        )
        return

    await plant_crop(land["id"], harvest_seconds=14400)

    harvest_time = time.strftime("%H:%M", time.localtime(time.time() + 14400))
    await callback.answer(
        f"✅ Lumen Apple کاشته شد!\nبرداشت در ساعت {harvest_time}",
        show_alert=True
    )


@router.callback_query(F.data == "harvest")
async def do_harvest_cmd(callback: types.CallbackQuery):
    tid = callback.from_user.id
    land = await get_user_land(tid)

    if not land:
        await callback.answer("زمینی پیدا نشد.", show_alert=True)
        return

    earned = await do_harvest(tid, land["id"])
    if earned == 0:
        await callback.answer("هیچ محصولی آماده برداشت نیست.", show_alert=True)
        return

    await callback.answer(
        f"🎉 +{earned:.1f} SAP برداشت شد!",
        show_alert=True
    )


@router.callback_query(F.data == "balance")
async def show_balance(callback: types.CallbackQuery):
    tid = callback.from_user.id
    user = await get_user(tid)

    if not user:
        await callback.answer("کاربری پیدا نشد.", show_alert=True)
        return

    await callback.answer(
        f"💰 موجودی SAP: {user['sap_balance']:.2f}",
        show_alert=True
    )
