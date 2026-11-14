import { GeoPoint } from '../types/fieldshift';

const EARTH_RADIUS_M = 6378137;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Computes great-circle Haversine distance in kilometers between two coordinates.
 */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  if (!isValidCoordinate(a.lat, a.lng) || !isValidCoordinate(b.lat, b.lng)) {
    return 0;
  }
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * (EARTH_RADIUS_M / 1000) * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}

/**
 * Computes geodesic polygon perimeter in meters by summing Haversine segment lengths.
 */
export function computePolygonPerimeterMeters(points: GeoPoint[]): number {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let totalMeters = 0;
  const edgeCount = points.length >= 3 ? points.length : 1;
  for (let i = 0; i < edgeCount; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    totalMeters += haversineDistanceKm(p1, p2) * 1000;
  }
  return Math.round(totalMeters);
}

/**
 * Computes real spherical geodesic polygon area in hectares from lat/lng vertices.
 * Uses the standard spherical excess approximation suitable for agricultural field polygons.
 */
export function computePolygonAreaHectares(points: GeoPoint[]): number {
  if (!Array.isArray(points) || points.length < 3) return 0;
  for (const pt of points) {
    if (!isValidCoordinate(pt.lat, pt.lng)) return 0;
  }

  let areaSqMeters = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const lat1 = toRad(p1.lat);
    const lat2 = toRad(p2.lat);
    const dLng = toRad(p2.lng - p1.lng);
    areaSqMeters += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  areaSqMeters = Math.abs((areaSqMeters * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
  return Number((areaSqMeters / 10000).toFixed(2));
}

export function computePolygonCentroid(points: GeoPoint[]): GeoPoint | null {
  if (!Array.isArray(points) || points.length === 0) return null;
  const valid = points.filter((p) => isValidCoordinate(p.lat, p.lng));
  if (valid.length === 0) return null;
  const sum = valid.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: Number((sum.lat / valid.length).toFixed(6)),
    lng: Number((sum.lng / valid.length).toFixed(6)),
  };
}

export function validatePolygon(points: GeoPoint[]): {
  valid: boolean;
  areaHectares: number;
  perimeterMeters: number;
  reason?: string;
} {
  if (!Array.isArray(points) || points.length < 3) {
    return {
      valid: false,
      areaHectares: 0,
      perimeterMeters: 0,
      reason: 'At least 3 vertices are required to close a parcel polygon.',
    };
  }
  for (const pt of points) {
    if (!isValidCoordinate(pt.lat, pt.lng)) {
      return {
        valid: false,
        areaHectares: 0,
        perimeterMeters: 0,
        reason: 'Polygon contains out-of-range coordinates.',
      };
    }
  }
  const areaHectares = computePolygonAreaHectares(points);
  const perimeterMeters = computePolygonPerimeterMeters(points);
  if (areaHectares <= 0 || perimeterMeters < 10) {
    return {
      valid: false,
      areaHectares,
      perimeterMeters,
      reason: 'Polygon vertices are collinear or span too small an area (< 0.01 ha).',
    };
  }
  return { valid: true, areaHectares, perimeterMeters };
}

export function formatArea(hectares?: number): string {
  if (hectares === undefined || hectares === null || Number.isNaN(hectares)) {
    return 'Not measured';
  }
  const acres = hectares * 2.47105;
  return `${hectares.toFixed(2)} ha (${acres.toFixed(2)} ac)`;
}
