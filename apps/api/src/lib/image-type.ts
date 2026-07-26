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

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Pixel dimensions of `buf`, or null if they can't be read from its header.
 *
 * Hand-rolled rather than pulled from a dependency, in the same spirit as
 * sniffImageMime above: this only ever needs to read a handful of bytes off the
 * front of three formats we already agreed to accept, and the alternative is a
 * transitive image-decoding tree in a service that never decodes an image.
 *
 * Only headers are parsed — nothing here validates that the rest of the file is
 * intact, so a null means "we could not tell", never "the image is safe".
 */
export function readImageSize(buf: Buffer): ImageSize | null {
  switch (sniffImageMime(buf)) {
    case 'image/png':
      return readPngSize(buf);
    case 'image/jpeg':
      return readJpegSize(buf);
    case 'image/webp':
      return readWebpSize(buf);
    default:
      return null;
  }
}

// PNG mandates IHDR as the first chunk, so width/height sit at a fixed offset:
// 8 magic + 4 length + 4 type = 16.
function readPngSize(buf: Buffer): ImageSize | null {
  if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// JPEG has no fixed header: dimensions live in the frame header (SOFn), which
// sits after an arbitrary run of metadata segments (EXIF thumbnails, colour
// profiles), so the segment chain has to be walked.
function readJpegSize(buf: Buffer): ImageSize | null {
  let offset = 2; // past SOI
  while (offset + 9 < buf.length) {
    // Segments may be padded with extra 0xff fill bytes.
    while (buf[offset] === 0xff && buf[offset + 1] === 0xff) offset++;
    if (buf[offset] !== 0xff) return null;

    const marker = buf[offset + 1]!;
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    const length = buf.readUInt16BE(offset + 2);
    if (length < 2) return null;

    // SOF0..SOF15, minus the three markers that share the range but are not
    // frame headers: DHT (c4), JPG (c8) and DAC (cc).
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      // ...marker, length(2), precision(1), height(2), width(2)
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }

    offset += 2 + length;
  }
  return null;
}

// Three incompatible layouts hide behind one RIFF/WEBP container, and an export
// preset picks between them without telling anyone, so all three are handled.
function readWebpSize(buf: Buffer): ImageSize | null {
  const format = buf.toString('ascii', 12, 16);

  // Lossy: VP8 bitstream, dimensions after the 3-byte start code, 14 bits each.
  if (format === 'VP8 ') {
    if (buf.length < 30) return null;
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }

  // Lossless: 14 bits of (width-1) then 14 bits of (height-1), packed LE.
  if (format === 'VP8L') {
    if (buf.length < 25) return null;
    const bits = buf.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  // Extended (animation / alpha / metadata): 24-bit LE canvas size, minus one.
  if (format === 'VP8X') {
    if (buf.length < 30) return null;
    return {
      width: buf.readUIntLE(24, 3) + 1,
      height: buf.readUIntLE(27, 3) + 1,
    };
  }

  return null;
}
