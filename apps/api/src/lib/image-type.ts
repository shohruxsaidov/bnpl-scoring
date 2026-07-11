// Magic-byte identification for the image formats we agree to serve publicly.
//
// A multipart part's `mimetype` is whatever the caller typed into the request —
// it is not evidence. Anything we later stream back from our own origin has to
// be identified from its actual bytes, or an admin could store an HTML/script
// payload under an image/png label and we would serve it as same-origin content.
//
// SVG is deliberately absent and must stay absent: it is XML, it can carry
// <script>, and there is no byte signature that makes a given SVG safe.

export const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/** The real format of `buf`, or null if it isn't one we accept. */
export function sniffImageMime(buf: Buffer): AllowedImageMime | null {
  if (buf.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) return 'image/png';
  if (buf.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) return 'image/jpeg';
  // WebP is a RIFF container: "RIFF" <u32 size> "WEBP".
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
