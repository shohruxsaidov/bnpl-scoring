import { Type } from '@sinclair/typebox';

// Bounds are deliberately the global ones. A tighter Uzbekistan box would catch
// more (notably a swapped lat/lng, since Tashkent's 69.24 is a legal latitude
// but not a legal Uzbek one) — but it would also reject a real border-town
// branch with no way for the admin to override. So the UZ check lives in the
// admin UI as a warning; the API only refuses what cannot be a coordinate.
export const Latitude = Type.Union([Type.Number({ minimum: -90, maximum: 90 }), Type.Null()]);
export const Longitude = Type.Union([Type.Number({ minimum: -180, maximum: 180 }), Type.Null()]);

type CoordinatePatch = { latitude?: number | null; longitude?: number | null };

// Coordinates are set together and cleared together. A body carrying only one
// half would write a row that is neither located nor unlocated.
export function hasLonelyCoordinate(body: CoordinatePatch): boolean {
  return (body.latitude == null) !== (body.longitude == null);
}
