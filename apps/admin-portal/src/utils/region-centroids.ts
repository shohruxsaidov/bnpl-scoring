// Where to open the map when a branch has no pin yet. Keyed by the oblast ids in
// the api's references/regions.json — a branch's regionId may hold a district id
// instead, so callers resolve it up to its parent first (see useRegions).
//
// These are administrative centres, not geometric centroids: the true centroid of
// Karakalpakstan is empty desert, which is a useless place to start looking for a
// shop.
export const OBLAST_CENTROIDS: Record<number, [number, number]> = {
  1703: [40.7821, 72.3442], // Andijan
  1706: [39.7747, 64.4286], // Bukhara
  1708: [40.1158, 67.8422], // Jizzakh
  1710: [38.86, 65.79], // Kashkadarya (Karshi)
  1712: [40.0844, 65.3792], // Navoi
  1714: [40.9983, 71.6726], // Namangan
  1718: [39.6542, 66.9597], // Samarkand
  1722: [37.2242, 67.2783], // Surkhandarya (Termez)
  1724: [40.4897, 68.7842], // Syrdarya (Gulistan)
  1726: [41.3111, 69.2797], // Tashkent city
  1727: [41.0167, 69.3417], // Tashkent region (Nurafshon)
  1730: [40.3864, 71.7864], // Fergana
  1733: [41.55, 60.6317], // Khorezm (Urgench)
  1735: [42.46, 59.61], // Karakalpakstan (Nukus)
}

export const TASHKENT: [number, number] = [41.3111, 69.2797]

// Uzbekistan's bounding box. Used only to warn — never to reject — because the
// box is an approximation and a real border-town branch may fall outside it.
// Its actual job is catching a swapped lat/lng on paste: Tashkent's 69.24 is a
// legal latitude worldwide, but not a legal one here.
const UZ_BOUNDS = { minLat: 37.1, maxLat: 45.6, minLng: 55.9, maxLng: 73.2 }

export function isInsideUzbekistan(lat: number, lng: number): boolean {
  return (
    lat >= UZ_BOUNDS.minLat &&
    lat <= UZ_BOUNDS.maxLat &&
    lng >= UZ_BOUNDS.minLng &&
    lng <= UZ_BOUNDS.maxLng
  )
}

// Accepts what a person actually pastes out of Yandex Maps: "41.31, 69.27",
// "41.31 69.27", or the same with a trailing comma.
export function parseCoordinatePair(input: string): [number, number] | null {
  const parts = input.trim().split(/[\s,]+/).filter(Boolean)
  if (parts.length !== 2) return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
}
