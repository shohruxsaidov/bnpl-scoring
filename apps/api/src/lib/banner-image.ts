import { env } from '@env';
import type { SupportedLang } from '../i18n/index';

// Same shape and the same reasoning as buildMerchantLogoUrl: derived from
// (bannerId, lang, fileId) rather than stored, so a stale string can never
// outlive the file it points at; absolute because the mobile app is not
// same-origin; ?v=<fileId> makes the URL unique per uploaded image, which is
// what lets the serving route mark the bytes immutable.
//
// Unlike a merchant logo, the route behind this URL only serves banners that are
// currently live — art for a campaign that starts next month 404s until it does.
export function buildBannerImageUrl(bannerId: number, lang: SupportedLang, fileId: number): string {
  return `${env.PUBLIC_BASE_URL}/api/v1/public/banners/${bannerId}/image/${lang}?v=${fileId}`;
}
