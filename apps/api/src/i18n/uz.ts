export const uz: Record<string, string> = {
  // auth — generic
  unauthorized: "Avtorizatsiya talab etiladi",
  forbidden: "Ruxsat yo'q",
  not_found: "Resurs topilmadi",
  internal_error: "Ichki server xatosi",

  // auth — admin
  invalid_credentials: "Email yoki parol noto'g'ri",
  invalid_current_password: "Joriy parol noto'g'ri",
  email_taken: "Bu email allaqachon ro'yxatdan o'tgan",
  invalid_role: "Noto'g'ri rol",
  last_superadmin: "Oxirgi superadminni o'chirib bo'lmaydi",
  immutable_role: "Bu rol o'zgartirilmaydi",
  protected_role: "Bu rol himoyalangan",
  reserved_key: "Bu kalit band qilingan",
  key_taken: "Bu kalit allaqachon mavjud",
  role_in_use: "Rol foydalanuvchilarga biriktirilgan",
  invalid_feature: "Noto'g'ri funksiya",
  invalid_platform: "Noto'g'ri platforma",
  escalation_blocked: "Huquqlarni oshirib bo'lmaydi",
  target_id_required: "Foydalanuvchi ID si talab etiladi",
  invalid_id: "Noto'g'ri identifikator",
  no_recipients: "Qabul qiluvchilar topilmadi",

  // auth — merchant
  invalid_picker_token: "Tanlash tokeni noto'g'ri",
  role_not_allowed: "Bu rol ruxsat etilmagan",
  role_not_configured: "Rol sozlanmagan",

  // auth — client
  phone_taken: "Bu telefon raqam allaqachon ro'yxatdan o'tgan",
  invalid_otp: "Tasdiqlash kodi noto'g'ri",
  invalid_reg_token: "Ro'yxatdan o'tish tokeni noto'g'ri",
  invalid_step: "Noto'g'ri qadam",
  invalid_pinfl: "JSHSHIR noto'g'ri",
  pinfl_taken: "Bu JSHSHIR allaqachon ro'yxatdan o'tgan",
  pinfl_mismatch: "JSHSHIR mos kelmaydi",
  phone_pinfl_mismatch: "Bu JSHSHIR boshqa telefon raqamga ro'yxatdan o'tgan",
  otp_cooldown: "Iltimos, yangi kod so'rashdan oldin biroz kuting",
  otp_daily_limit: "Tasdiqlash kodlari uchun kunlik chegaraga yetdingiz",
  missing_device_id: "x-device-id sarlavhasi talab qilinadi",
  invalid_device_id: "x-device-id sarlavhasi noto'g'ri",
  no_account: "Hisob topilmadi",
  myid_integration_failed: "MyID xizmati bilan bog'liq xato yuz berdi",
  client_already_registered: "Mijoz allaqachon ro'yxatdan o'tgan",
  phone_already_registered: "Bu telefon raqami allaqachon ro'yxatdan o'tgan",
  client_pinfl_missing: "Mijozning JSHSHIR si mavjud emas",

  // deals
  deal_not_found: "Shartnoma topilmadi",
  invalid_signing_token: "Imzolash tokeni noto'g'ri",
  invalid_signing_purpose: "Imzolash maqsadi noto'g'ri",
  invalid_signing_session: "Imzolash sessiyasi noto'g'ri",

  // payments
  overpayment: "To'lov qolgan summadan oshib ketdi",
  OVERPAYMENT: "To'lov qolgan summadan oshib ketdi",

  // clients
  client_not_found: "Mijoz topilmadi",

  // products
  product_not_found: "Mahsulot topilmadi",

  // tariffs
  tariff_not_found: "Tarif topilmadi",
  amount_below_tariff_min: "Savat summasi tarifning minimal summasidan kam",
  amount_above_tariff_max: "Savat summasi tarifning maksimal summasidan oshib ketdi",
  invalid_credit_range: "Minimal summa maksimal summadan oshmasligi kerak",

  // scoring models
  scoring_model_not_found: "Skoring modeli topilmadi",

  // mxik
  mxik_not_found: "MXIK kodi topilmadi",

  // scoring / sessions
  session_not_found: "Sessiya topilmadi",
  session_not_running: "Sessiya faol emas",
  scoring_not_found: "Skoring topilmadi",
  katm_not_completed: "KATM so'rovi hali yakunlanmagan",
  client_katm_fields_missing: "KATM so'rovi uchun mijoz ma'lumotlari yetarli emas (manzil, viloyat, tuman, hujjat turi)",
  user_katm_fields_missing: "KATM so'rovi uchun ma'lumotlar yetarli emas (manzil, viloyat, tuman, hujjat turi)",
  katm_one_id_locked: "Mijoz One ID orqali ma'lumotlariga kirishga ruxsat bermagan",
  client_credit_banned: "Mijoz kreditlash taqiqi reestrida turibdi",
  credit_banned: "Siz kreditlash taqiqi reestrida turibsiz",
  katm_report_timeout: "KATM kredit hisobotini belgilangan vaqtda shakllantirmadi",
  card_scoring_already_started: "Karta skoring allaqachon boshlangan",
  user_not_found: "Foydalanuvchi topilmadi",
  version_taken: "Bunday versiyali reviziya allaqachon mavjud",

  // deal sessions (wizard)
  session_not_active: "Bitim sessiyasi allaqachon yopilgan",
  invalid_step_payload: "Qadam ma'lumotlari noto'g'ri",
  session_incomplete: "Sessiyada barcha qadamlar to'ldirilmagan — masterni qaytadan o'ting",
  scoring_missing: "Sessiyada skoring natijasi yo'q",
  scoring_declined: "Skoring rad etilgan — bitim yaratib bo'lmaydi",
}
