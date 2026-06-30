// polyfills.ts — این فایل را vite.config.ts inject می‌کنه
// قبل از هر module دیگه‌ای اجرا می‌شه
import { Buffer } from "buffer";
(globalThis as Record<string, unknown>).Buffer = Buffer;
