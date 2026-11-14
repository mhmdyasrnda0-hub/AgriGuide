import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDecisionWeights,
  normalizeFarmProfile,
  sanitizeEnvironmentalSnapshot,
  sanitizeFieldScanResponse,
  sanitizeSoilData,
  validateEmailFormat,
  validateSignInInput,
  validateSignUpInput,
} from './validators.js';
import { FarmProfile } from '../types/fieldshift.js';

describe('Schema Validators & Boundary Sanitization', () => {
  it('sanitizes out-of-range soil lab metrics safely', () => {
    const cleaned = sanitizeSoilData({
      ph: 99, // invalid > 10.5
      ecSalinityDsM: 3.456,
      nitrogenPpm: -10, // invalid < 0
      phosphorusPpm: 28.4,
      texture: 'loam',
      source: 'user-provided data',
    });
    assert.ok(cleaned);
    assert.equal(cleaned.ph, undefined);
    assert.equal(cleaned.ecSalinityDsM, 3.46);
    assert.equal(cleaned.nitrogenPpm, undefined);
    assert.equal(cleaned.phosphorusPpm, 28.4);
    assert.equal(cleaned.texture, 'loam');
  });

  it('normalizes farm profile coordinates and computes boundary area cleanly', () => {
    const raw: FarmProfile = {
      id: 'bad/id with spaces',
      name: '   Northern Field   ',
      locationLabel: 'Konya',
      centerLat: 37.87,
      centerLng: 32.49,
      locationAccuracyMode: 'point',
      boundary: [
        { lat: 37.87, lng: 32.49 },
        { lat: 37.87, lng: 32.5 },
        { lat: 37.879, lng: 32.5 },
        { lat: 37.879, lng: 32.49 },
      ],
      previousCrop: 'wheat',
      currentCrop: 'none',
      season: 'winter',
      waterAvailability: 'limited',
      goal: 'drought_resilience',
      createdAt: '',
      updatedAt: '',
    };
    const norm = normalizeFarmProfile(raw);
    assert.equal(norm.id, 'bad_id_with_spaces');
    assert.equal(norm.name, 'Northern Field');
    assert.equal(norm.locationAccuracyMode, 'polygon');
    assert.ok(norm.areaHectares && norm.areaHectares > 80);
  });

  it('normalizes custom weights to sum cleanly to 1.0', () => {
    const w = normalizeDecisionWeights({ water: 6, climate: 2, soil: 1, season: 1, rotation: 0 });
    const total = w.water + w.climate + w.soil + w.season + w.rotation;
    assert.ok(Math.abs(total - 1.0) < 0.001);
    assert.equal(w.water, 0.6);
  });

  it('rejects malformed environmental and scan payloads gracefully', () => {
    assert.equal(sanitizeEnvironmentalSnapshot(null), null);
    assert.equal(sanitizeEnvironmentalSnapshot({ id: 'missing-fields' }), null);

    const scan = sanitizeFieldScanResponse(
      {
        qualityStatus: 'usable',
        confidenceScore: 0.84, // normalized 0-1 converted to 84
        detectedCrop: 'wheat',
        detectedCropLabel: 'Wheat',
        preliminaryAssessment: 'Leaf tip dryness observed',
      },
      'farm_1',
      'crop_photo',
      'wheat.jpg'
    );
    assert.ok(scan);
    assert.equal(scan.confidenceScore, 84);
    assert.equal(scan.confidenceLevel, 'high');
  });

  it('validates sign-in and sign-up credentials honestly in EN and AR', () => {
    assert.equal(validateEmailFormat('farmer@fieldshift.org'), true);
    assert.equal(validateEmailFormat('not-an-email'), false);

    assert.ok(validateSignInInput('', 'pass', 'en'));
    assert.ok(validateSignInInput('bad', 'pass', 'ar'));
    assert.equal(validateSignInInput('farmer@fieldshift.org', 'secret123', 'en'), null);

    assert.ok(validateSignUpInput('Ali', 'Hassan', 'ali@test.com', '1234', 'en'));
    assert.equal(validateSignUpInput('Ali', 'Hassan', 'ali@test.com', 'strongpass123', 'en'), null);
  });
});
