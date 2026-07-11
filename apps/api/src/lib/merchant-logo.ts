import { env } from '@env';

// The merchant logo's URL is derived from (merchantId, logoFileId) rather than
// stored, so a stale string can never outlive the file it points at.
//
// It is absolute because the mobile app is not same-origin: a relative path
// would render as a blank image there. The ?v=<fileId> makes the URL unique per
// uploaded file, which is what lets the serving route mark the bytes immutable —
// a replacement mints a new URL instead of hiding behind a cached old one.
export function buildMerchantLogoUrl(
  merchantId: number,
  logoFileId: number | null,
): string | null {
  if (logoFileId == null) return null;
  return `${env.PUBLIC_BASE_URL}/api/v1/public/merchants/${merchantId}/logo?v=${logoFileId}`;
}
