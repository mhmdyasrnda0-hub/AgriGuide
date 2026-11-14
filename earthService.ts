import { EnvironmentalSnapshot, FarmProfile } from '../types/fieldshift';
import { sanitizeEnvironmentalSnapshot } from '../lib/validators';

export async function fetchEarthSnapshot(farm: FarmProfile): Promise<EnvironmentalSnapshot> {
  const res = await fetch(
    `/api/earth-intelligence?lat=${encodeURIComponent(farm.centerLat)}&lng=${encodeURIComponent(
      farm.centerLng
    )}&farmId=${encodeURIComponent(farm.id)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `NASA POWER request failed (${res.status})`);
  }
  const validated = sanitizeEnvironmentalSnapshot(data);
  if (!validated) {
    throw new Error('NASA POWER service returned an incomplete environmental snapshot.');
  }
  return validated;
}
