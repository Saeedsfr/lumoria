import os
from aiogram import Router, types
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from utils.database import get_user, create_user, get_user_land

router = Router()
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://lumoria.vercel.app")


@router.message(CommandStart())
async def cmd_start(message: types.Message):
    tid = message.from_user.id
    username = message.from_user.username or str(tid)

    user = await get_user(tid)
    if not user:
        await create_user(tid, username)
        welcome = (
            "🌱 *به Lumoria خوش آمدی، نگهبان ریشه!*\n\n"
            "جهانی پس از فروپاشی «درخت جهان» منتظر توست.\n"
            "یک زمین Common رایگان برای شروع دریافت کردی.\n\n"
            "محصول بکار، SAP برداشت کن، ریشه‌ها را بازگردان."
        )
    else:
        welcome = (
            "🌿 *Lumoria — نگهبان ریشه*\n\n"
            f"سلام دوباره، @{username}!"
        )

    land = await get_user_land(tid)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🌍 ورود به بازی",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}?uid={tid}")
        )],
        [
            InlineKeyboardButton(text="🌾 مزرعه", callback_data="farm"),
            InlineKeyboardButton(text="💰 موجودی", callback_data="balance"),
        ],
        [InlineKeyboardButton(text="📖 راهنما", callback_data="help")],
    ])

    await message.answer(welcome, parse_mode="Markdown", reply_markup=kb)
