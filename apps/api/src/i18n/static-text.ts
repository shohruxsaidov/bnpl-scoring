import type { SupportedLang } from './index';

// ---------------------------------------------------------------------------
// Long-form, client-facing copy the app renders as-is — no codes, no arguments,
// nothing derived from a run. Kept beside the reason codes rather than in the
// flat error dictionaries (i18n/uz.ts, i18n/ru.ts): those are one-line messages
// keyed by an error code, and these are screens of instructions.
// ---------------------------------------------------------------------------

/**
 * What the client has to do in OneID before we can score them: KATM only
 * answers for a user who has granted the bureau access there, so a run started
 * without it comes back rejected for a reason the app cannot fix on its own.
 * Returned by GET /client/scoring/status in the caller's language.
 */
export const scoringAgreementText: Record<SupportedLang, string> = {
  uz: [
    'Biz orqali skoring qilishdan oldin quyidagilarni amalga oshiring',
    "1. Mobil qurilmangizga GooglePlay (https://play.google.com/store/apps/details?id=uz.egov.oneId) yoki AppStore (https://apps.apple.com/uz/app/oneid-mobile/id1617964681)'dan OneID ilovasini yuklab oling.",
    "2. Mobile-ID yoki MyID orqali tezkor avtorizatsiyadan o'ting.",
    "3. boshqarish bo'limiga o'tib xizmatni faollashtiring",
    "4. ostdagi ro'yxatdan KATM (KREDIT-AXBOROT TAHLILIY MARKAZI) topib ustiga bosib ruxsat bering.",
  ].join('\n'),
  ru: [
    'перед скоринг выполните следующие действия:',
    '1. Загрузите приложение OneID на свое мобильное устройство из Google Play (https://play.google.com/store/apps/details?id=uz.egov.oneId) или App Store (https://apps.apple.com/uz/app/oneid-mobile/id1617964681)',
    '2. Пройдите быструю авторизацию через Mobile-ID или MyID.',
    '3. Перейдите в раздел управления и активируйте услугу.',
    '4. Найдите в списке ниже KATM (KREDIT-AXBOROT TAHLILIY MARKAZI) и нажмите на него для активации.',
  ].join('\n'),
};

/** The instructions in the caller's language, falling back to Uzbek as the
 *  dictionaries do. */
export function agreementText(lang: SupportedLang): string {
  return scoringAgreementText[lang] ?? scoringAgreementText.uz;
}
