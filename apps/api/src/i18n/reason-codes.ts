import type { SupportedLang } from './index';

// ---------------------------------------------------------------------------
// Human-readable, client-facing text for a scoring rejection. Keyed by the
// reasonCode the pipeline / model emits (see modules/scoring/pipelines/types.ts
// ScoringRejectReasonCode), plus the bucket `data_missing` the pre-run profile
// check reuses as a code and a generic `unknown` fallback for codeless failures
// (the `failed`/`error` paths) and codes with no entry.
//
// Kept as its own nested object rather than in the flat error dictionary
// (i18n/uz.ts, i18n/ru.ts) so reasonMessage() resolves it directly and the two
// concerns don't bleed into each other.
// ---------------------------------------------------------------------------

export const rejectReasonCodes: Record<SupportedLang, Record<string, string>> = {
  uz: {
    // active_deal
    active_deal_exists:
      "Sizda faol muddatli to'lov mavjud. Uni yopganingizdan so'ng yangi limit olishingiz mumkin.",
    // myid — missing profile fields (fixable)
    address_absent:
      "Profilingizda manzil ko'rsatilmagan. Ma'lumotlarni to'ldiring va qayta urinib ko'ring.",
    pinfl_absent: "JSHSHIR ko'rsatilmagan. Ma'lumotlarni to'ldiring va qayta urinib ko'ring.",
    passport_series_absent:
      "Pasport seriyasi ko'rsatilmagan. Ma'lumotlarni to'ldiring va qayta urinib ko'ring.",
    passport_number_absent:
      "Pasport raqami ko'rsatilmagan. Ma'lumotlarni to'ldiring va qayta urinib ko'ring.",
    doc_type_absent: "Hujjat turi ko'rsatilmagan. Ma'lumotlarni to'ldiring va qayta urinib ko'ring.",
    region_absent: "Viloyat ko'rsatilmagan. Ma'lumotlarni to'ldiring va qayta urinib ko'ring.",
    district_absent: "Tuman ko'rsatilmagan. Ma'lumotlarni to'ldiring va qayta urinib ko'ring.",
    phone_absent:
      "Telefon raqami ko'rsatilmagan. Ma'lumotlarni to'ldiring va qayta urinib ko'ring.",
    // myid — business knockouts
    age_below: "Yoshingiz kredit olish uchun belgilangan eng kam yoshdan past.",
    age_above: "Yoshingiz kredit olish uchun belgilangan eng yuqori yoshdan oshgan.",
    not_resident_uzbekistan: "Xizmat faqat O'zbekiston rezidentlari uchun mavjud.",
    // katm_claim
    oneid_locked:
      "One ID orqali ma'lumotlaringizga kirish ochilmagan. One ID hisobingizni oching va qayta urinib ko'ring.",
    // katm_mib
    mib_enforcement_found: "Sizga nisbatan majburiy ijro ish yuritilmoqda.",
    // katm_077
    credit_ban: "Siz kreditlash taqiqi reestrida turibsiz.",
    has_defaults: "Kredit tarixingizda jiddiy qarzdorliklar aniqlandi.",
    judicial_or_decommissioned: "Kreditlaringizdan biri sud undiruvida yoki balansdan chiqarilgan.",
    has_actual_overdue_debts_from_60_to_90:
      "Sizda 60–90 kun muddati o'tgan qarzdorlik mavjud.",
    has_actual_overdue_debts_from_30_to_60:
      "Sizda 30–60 kun muddati o'tgan qarzdorlik mavjud.",
    // katm_inps
    no_income: "Rasmiy daromadingiz tasdiqlanmadi.",
    // model stage
    model_stop_factor: "Skoring natijalariga ko'ra kredit limiti ajratilmadi.",
    zero_limit: "Hozircha sizga kredit limiti ajratilmadi.",
    // pre-run profile bucket
    data_missing: "Ma'lumotlaringiz to'liq emas. Profilni to'ldiring va qayta urinib ko'ring.",
    // codeless / unknown fallback
    unknown: "Hozircha kredit limitini hisoblab bo'lmadi. Keyinroq qayta urinib ko'ring.",
  },
  ru: {
    // active_deal
    active_deal_exists:
      'У вас есть активная рассрочка. Новый лимит станет доступен после её погашения.',
    // myid — missing profile fields (fixable)
    address_absent: 'В профиле не указан адрес. Заполните данные и повторите попытку.',
    pinfl_absent: 'Не указан ПИНФЛ. Заполните данные и повторите попытку.',
    passport_series_absent: 'Не указана серия паспорта. Заполните данные и повторите попытку.',
    passport_number_absent: 'Не указан номер паспорта. Заполните данные и повторите попытку.',
    doc_type_absent: 'Не указан тип документа. Заполните данные и повторите попытку.',
    region_absent: 'Не указана область. Заполните данные и повторите попытку.',
    district_absent: 'Не указан район. Заполните данные и повторите попытку.',
    phone_absent: 'Не указан номер телефона. Заполните данные и повторите попытку.',
    // myid — business knockouts
    age_below: 'Ваш возраст меньше минимально допустимого для получения кредита.',
    age_above: 'Ваш возраст превышает максимально допустимый для получения кредита.',
    not_resident_uzbekistan: 'Услуга доступна только резидентам Узбекистана.',
    // katm_claim
    oneid_locked:
      'Доступ к вашим данным через One ID закрыт. Разблокируйте аккаунт One ID и повторите попытку.',
    // katm_mib
    mib_enforcement_found: 'В отношении вас ведётся исполнительное производство.',
    // katm_077
    credit_ban: 'Вы находитесь в реестре запрета на кредитование.',
    has_defaults: 'В вашей кредитной истории обнаружены серьёзные задолженности.',
    judicial_or_decommissioned:
      'Один из ваших кредитов находится на судебном взыскании или списан.',
    has_actual_overdue_debts_from_60_to_90:
      'У вас есть просроченная задолженность от 60 до 90 дней.',
    has_actual_overdue_debts_from_30_to_60:
      'У вас есть просроченная задолженность от 30 до 60 дней.',
    // katm_inps
    no_income: 'Ваш официальный доход не подтверждён.',
    // model stage
    model_stop_factor: 'По результатам скоринга кредитный лимит не выделен.',
    zero_limit: 'На данный момент кредитный лимит вам не выделен.',
    // pre-run profile bucket
    data_missing: 'Ваши данные заполнены не полностью. Заполните профиль и повторите попытку.',
    // codeless / unknown fallback
    unknown: 'Сейчас не удалось рассчитать кредитный лимит. Попробуйте позже.',
  },
};

// Client-facing rejection text for a reasonCode. Falls back to a generic
// message when the code is absent (the codeless failed/error paths) or unknown,
// so a raw code string never reaches the client.
export function reasonMessage(lang: SupportedLang, code?: string): string {
  const dict = rejectReasonCodes[lang];
  return (code && dict[code]) || dict.unknown;
}
