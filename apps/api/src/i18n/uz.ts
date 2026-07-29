export const uz: Record<string, string> = {
  // auth — generic
  unauthorized: 'Avtorizatsiya talab etiladi',
  forbidden: "Ruxsat yo'q",
  not_found: 'Resurs topilmadi',
  internal_error: 'Ichki server xatosi',

  // auth — admin
  invalid_credentials: "Login yoki parol noto'g'ri",
  invalid_current_password: "Joriy parol noto'g'ri",
  email_taken: "Bu email allaqachon ro'yxatdan o'tgan",
  invalid_role: "Noto'g'ri rol",
  last_superadmin: "Oxirgi superadminni o'chirib bo'lmaydi",
  immutable_role: "Bu rol o'zgartirilmaydi",
  protected_role: 'Bu rol himoyalangan',
  reserved_key: 'Bu kalit band qilingan',
  key_taken: 'Bu kalit allaqachon mavjud',
  role_in_use: 'Rol foydalanuvchilarga biriktirilgan',
  invalid_feature: "Noto'g'ri funksiya",
  invalid_platform: "Noto'g'ri platforma",
  escalation_blocked: "Huquqlarni oshirib bo'lmaydi",
  target_id_required: 'Foydalanuvchi ID si talab etiladi',
  invalid_id: "Noto'g'ri identifikator",
  no_recipients: 'Qabul qiluvchilar topilmadi',

  // auth — merchant
  invalid_picker_token: "Tanlash tokeni noto'g'ri",
  role_not_allowed: 'Bu rol ruxsat etilmagan',
  role_not_configured: 'Rol sozlanmagan',

  // auth — client
  phone_taken: "Bu telefon raqam allaqachon ro'yxatdan o'tgan",
  invalid_otp: "Tasdiqlash kodi noto'g'ri",
  invalid_reg_token: "Ro'yxatdan o'tish tokeni noto'g'ri",
  invalid_step: "Noto'g'ri qadam",
  invalid_pinfl: "JSHSHIR noto'g'ri",
  pinfl_taken: "Bu JSHSHIR allaqachon ro'yxatdan o'tgan",
  pinfl_mismatch: 'JSHSHIR mos kelmaydi',
  phone_pinfl_mismatch: "Bu JSHSHIR boshqa telefon raqamga ro'yxatdan o'tgan",
  public_offer_not_found: 'Ommaviy oferta topilmadi',
  public_offer_stale: 'Ommaviy oferta yangilangan, iltimos, dolzarb versiyasini qabul qiling',
  file_required: 'Fayl talab qilinadi',
  invalid_file_type: 'Faqat PDF fayllar qabul qilinadi',
  invalid_image_type: 'Faqat PNG, JPEG yoki WebP rasmlar qabul qilinadi',
  invalid_document_type: 'Faqat PDF, PNG yoki JPEG fayllar qabul qilinadi',
  file_too_large: 'Fayl hajmi juda katta',
  merchant_logo_not_found: 'Merchant logotipi topilmadi',
  inn_taken: "Bunday INN bilan merchant allaqachon mavjud — uni merchantlar ro'yxatidan toping",
  banner_not_found: 'Banner topilmadi',
  image_too_small: "Rasm juda kichik: kamida 640px kenglikda bo'lishi kerak",
  invalid_aspect_ratio: "Rasm nisbati 2:1 bo'lishi kerak (masalan, 1440×720)",
  action_value_required: "Tanlangan harakat uchun manzil ko'rsatilishi shart",
  invalid_action_url: 'Havola https:// bilan boshlanishi kerak',
  invalid_banner_window: "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak",
  invalid_coordinates: "Kenglik va uzunlik birgalikda ko'rsatilishi kerak",
  otp_cooldown: "Iltimos, yangi kod so'rashdan oldin biroz kuting",
  otp_daily_limit: 'Tasdiqlash kodlari uchun kunlik chegaraga yetdingiz',
  otp_attempts_exceeded: "Juda ko'p noto'g'ri urinish. Yangi kod so'rang",
  otp_required: 'Tasdiqlash kodi telefoningizga yuborildi, kirish uchun uni kiriting',
  invalid_reset_token: "Parolni tiklash so'rovi muddati tugadi. Qaytadan boshlang",
  reset_token_device_mismatch: "Parolni tiklashni o'sha qurilmada yakunlash kerak",
  invalid_pin_reset_token: "PIN-kodni tiklash so'rovi muddati tugadi. Qaytadan boshlang",
  pin_reset_token_device_mismatch: "PIN-kodni tiklashni o'sha qurilmada yakunlash kerak",
  device_not_trusted: 'Bu qurilma tasdiqlanmagan. Parol bilan kiring',
  device_not_found: 'Qurilma topilmadi',
  cannot_revoke_current_device: "Joriy qurilmani o'chirib bo'lmaydi. Hisobdan chiqishdan foydalaning",
  current_password_required: 'Joriy parolni kiriting',
  account_locked: "Juda ko'p urinish tufayli hisob bloklandi. Parolni tiklang",
  missing_device_id: 'x-device-id talab qilinadi',
  invalid_device_id: "x-device-id noto'g'ri",
  no_account: 'Hisob topilmadi',
  pin_not_set: "PIN-kod hali o'rnatilmagan",
  invalid_pin: "PIN-kod noto'g'ri",
  pin_locked: 'PIN-kod bloklandi. Iltimos, telefon va MyID orqali qayta tasdiqlang',
  invalid_session: 'Sessiya yaroqsiz yoki muddati tugagan, iltimos, qaytadan kiring',
  device_not_registered:
    "Bu qurilma ro'yxatdan o'tmagan. Iltimos, telefon va MyID orqali to'liq ro'yxatdan o'ting",
  myid_integration_failed: "MyID xizmati bilan bog'liq xato yuz berdi",
  client_already_registered: "Mijoz allaqachon ro'yxatdan o'tgan",
  phone_already_registered: "Bu telefon raqami allaqachon ro'yxatdan o'tgan",
  invalid_passport_data:
    "Noto'g'ri passport ma'lumotlari kiritilgan. Iltimos tekshirib qaytdan urinib ko'ring",
  client_pinfl_missing: 'Mijozning JSHSHIR si mavjud emas',

  // deals
  deal_not_found: 'Shartnoma topilmadi',
  deal_not_payable: "Ushbu shartnoma bo'yicha to'lanadigan qarz yo'q",
  payme_not_configured: "Payme orqali to'lov vaqtincha mavjud emas",
  // card payments (Plumgate)
  card_not_found: 'Karta topilmadi',
  amount_too_small: "Eng kam to'lov summasi — %{min} so'm",
  amount_exceeds_debt: "Summa qarz qoldig'idan oshib ketdi — %{remaining} so'm",
  payment_already_pending: "Ushbu shartnoma bo'yicha tugallanmagan to'lov mavjud",
  payment_session_not_found: "To'lov sessiyasi topilmadi",
  payment_session_not_pending: "To'lov sessiyasi yakunlangan. To'lovni qaytadan boshlang",
  payment_session_not_stranded: "Bu to'lov qo'lda o'tkazishni talab qilmaydi",
  invalid_signing_purpose: "Imzolash maqsadi noto'g'ri",
  invalid_signing_session: "Imzolash sessiyasi noto'g'ri",

  // signing — avval MyID (shaxs), keyin OTP (aksept)
  myid_not_verified: "Mijoz MyID tekshiruvidan o'tmagan yoki u eskirgan",
  otp_not_verified: 'Mijoz shartnomani kod bilan tasdiqlamagan yoki tasdiq eskirgan',
  client_step_missing: 'Mijoz tanlanmagan',

  // payments
  invalid_date_range: "Boshlanish sanasi tugash sanasidan keyin bo'lishi mumkin emas",
  overpayment: "To'lov qolgan summadan oshib ketdi",
  OVERPAYMENT: "To'lov qolgan summadan oshib ketdi",

  // buyouts
  buyout_already_paid: "Bu sotib olish allaqachon to'langan",

  // clients
  client_not_found: 'Mijoz topilmadi',

  // products
  product_not_found: 'Mahsulot topilmadi',

  // tariffs
  tariff_not_found: 'Tarif topilmadi',
  amount_below_tariff_min: 'Savat summasi tarifning minimal summasidan kam',
  amount_above_tariff_max: 'Savat summasi tarifning maksimal summasidan oshib ketdi',
  invalid_credit_range: 'Minimal summa maksimal summadan oshmasligi kerak',

  // scoring models
  scoring_model_not_found: 'Skoring modeli topilmadi',

  // mxik
  mxik_not_found: 'MXIK kodi topilmadi',

  // scoring / sessions
  session_not_found: 'Sessiya topilmadi',
  session_not_running: 'Sessiya faol emas',
  scoring_not_found: 'Skoring topilmadi',
  katm_not_completed: "KATM so'rovi hali yakunlanmagan",
  client_katm_fields_missing:
    "KATM so'rovi uchun mijoz ma'lumotlari yetarli emas (manzil, viloyat, tuman, hujjat turi)",
  user_katm_fields_missing:
    "KATM so'rovi uchun ma'lumotlar yetarli emas (manzil, viloyat, tuman, hujjat turi)",
  katm_one_id_locked: "Mijoz One ID orqali ma'lumotlariga kirishga ruxsat bermagan",
  client_credit_banned: 'Mijoz kreditlash taqiqi reestrida turibdi',
  credit_banned: 'Siz kreditlash taqiqi reestrida turibsiz',
  katm_report_timeout: 'KATM kredit hisobotini belgilangan vaqtda shakllantirmadi',
  card_scoring_already_started: 'Karta skoring allaqachon boshlangan',
  user_not_found: 'Foydalanuvchi topilmadi',
  version_taken: 'Bunday versiyali reviziya allaqachon mavjud',

  // deal sessions (wizard)
  session_not_active: 'Bitim sessiyasi allaqachon yopilgan',
  invalid_step_payload: "Qadam ma'lumotlari noto'g'ri",
  session_incomplete: "Sessiyada barcha qadamlar to'ldirilmagan — masterni qaytadan o'ting",
  scoring_missing: "Sessiyada skoring natijasi yo'q",
  scoring_declined: "Skoring rad etilgan — bitim yaratib bo'lmaydi",
  deal_already_created: "Bu sessiya bo'yicha shartnoma allaqachon yaratilgan",
  deal_creation_failed: "Shartnomani yaratib bo'lmadi",

  // deal signing (myid_not_verified / otp_not_verified / otp_attempts_exceeded above)
  terms_changed: "Imzolangandan keyin bitim shartlari o'zgardi — mijoz qaytadan imzolashi kerak",
  otp_send_cap: 'Ushbu bitim uchun kod yuborish chegarasiga yetildi',
  signing_request_not_found: "Imzolash so'rovi endi faol emas",
  no_signing_device: "Mijozda ilova o'rnatilgan qurilma yo'q",

  // app version / force update
  invalid_version:
    "Ilova versiyasi noto'g'ri formatda — MAJOR.MINOR.PATCH bo'lishi kerak (masalan 1.4.0)",
  min_above_latest:
    "Minimal versiya oxirgi versiyadan yuqori bo'lishi mumkin emas — foydalanuvchilar yangilay olmaydi",
  version_confirmation_mismatch: 'Tasdiqlash uchun minimal versiyani aynan takrorlang',

  // notifications — errors
  notification_not_found: 'Bildirishnoma topilmadi',
  push_disabled: 'Push-bildirishnomalar serverda sozlanmagan',
  no_push_devices: "Mijozda ilova o'rnatilgan qurilma yo'q",

  // notifications — push title/body (rendered server-side per device language)
  'notification.scoring_approved.title': 'Skoring tasdiqlandi',
  'notification.scoring_approved.body': "Sizga %{creditLimit} so'm kredit limiti ajratildi.",
  'notification.scoring_rejected.title': 'Skoring rad etildi',
  'notification.scoring_rejected.body': 'Afsuski, hozircha kredit limiti ajratilmadi.',
  'notification.limit_updated.title': 'Kredit limiti yangilandi',
  'notification.limit_updated.body': "Sizning kredit limitingiz %{creditLimit} so'mga o'zgardi.",
  'notification.payment_received.title': "To'lov qabul qilindi",
  'notification.payment_received.body': "Sizning %{amount} so'mlik to'lovingiz qabul qilindi.",
  'notification.deal_signing_request.title': 'Shartnomani imzolang',
  'notification.deal_signing_request.body':
    "%{merchantName} %{totalPayable} so'mlik muddatli to'lovni tasdiqlashingizni kutmoqda. Shartlarni tekshirish uchun ilovani oching.",
  'plumIntegrationErrors.-113': 'OTP amal qilish muddati yakunlangan',
  'plumIntegrationErrors.-108': "Ushbu karta allaqachon sistemaga qo'shilgan",
  'plumIntegrationErrors.-101': "Karta ma'lumotlari noto'g'ri kiritilgan",
  'plumIntegrationErrors.-102': "Noto'g'ri otp kod kiritildi",
  'plumIntegrationErrors.-137': "Otp parol noto'g'ri kiritilgan",
  'plumIntegrationErrors.-111':
    "Otp parol tasdiqlash limitdan oshirib yuborildi. Birozdan keyin urinib ko'ring",
  'plumIntegrationErrors.-200': 'Karta topilmadi',
  'plumIntegrationErrors.-105': 'Karta topilmadi',
  'plumIntegrationErrors.-153': "Sms xabarnoma xizmati boshqa telefon nomerga bog'langan",
  'plumIntegrationErrors.-261': "Kiritilgan karta ma'lum muaddatga bloklangan",
  'plumIntegrationErrors.-2': 'OTP amal qilish muddati yakunlangan',
};
