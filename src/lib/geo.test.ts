import { describe, it, expect } from 'vitest';
import { distanceMeters, formatDistance, walkMinutes, bikeMinutes, clampRadius, nearestTarget, ArrivalDetector, googleMapsDirectionsUrl } from './geo';

const PUNTO_A = { lat: 37.3859, lng: -5.9931 };
const PUNTO_B = { lat: 37.3831, lng: -5.9903 };
const PUNTO_C = { lat: 37.3899, lng: -5.9887 };

describe('distanceMeters', () => {
  it('è zero tra un punto e sé stesso', () => {
    expect(distanceMeters(PUNTO_C, PUNTO_C)).toBe(0);
  });
  it('calcola una distanza plausibile tra due punti urbani (~350-450 m)', () => {
    const d = distanceMeters(PUNTO_A, PUNTO_B);
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(500);
  });
  it('è simmetrica', () => {
    expect(distanceMeters(PUNTO_C, PUNTO_B)).toBeCloseTo(distanceMeters(PUNTO_B, PUNTO_C), 6);
  });
});

describe('formatDistance', () => {
  it('mostra metri sotto il km', () => {
    expect(formatDistance(345)).toBe('345 m');
  });
  it('mostra km con un decimale sopra il km', () => {
    expect(formatDistance(1234)).toBe('1.2 km');
  });
});

describe('tempi di percorrenza', () => {
  it('walkMinutes cresce con la distanza ed è ≥1', () => {
    expect(walkMinutes(0)).toBeGreaterThanOrEqual(1);
    expect(walkMinutes(2000)).toBeGreaterThan(walkMinutes(500));
  });
  it('bici più veloce che a piedi su distanze urbane', () => {
    expect(bikeMinutes(3000)).toBeLessThan(walkMinutes(3000));
  });
});

describe('clampRadius', () => {
  it('limita il raggio tra 40 e 100 m', () => {
    expect(clampRadius(10)).toBe(40);
    expect(clampRadius(70)).toBe(70);
    expect(clampRadius(500)).toBe(100);
  });
  it('gestisce input non numerici con il default', () => {
    expect(clampRadius(Number.NaN)).toBe(60);
  });
});

describe('nearestTarget', () => {
  it('trova il bersaglio più vicino', () => {
    const res = nearestTarget(PUNTO_C, [
      { id: 'a', coords: PUNTO_A },
      { id: 'b', coords: PUNTO_B },
      { id: 'c', coords: { lat: 37.3899, lng: -5.989 } },
    ]);
    expect(res?.target.id).toBe('c');
  });
  it('restituisce null senza bersagli', () => {
    expect(nearestTarget(PUNTO_C, [])).toBeNull();
  });
});

describe('ArrivalDetector', () => {
  const far = { lat: 37.4, lng: -6.0 };
  const near = { lat: 37.38312, lng: -5.99031 }; // a pochi metri dal punto B

  it('annuncia UNA SOLA volta per destinazione', () => {
    const det = new ArrivalDetector(60);
    expect(det.update('punto-b', far, PUNTO_B, 10)).toBe('outside');
    expect(det.update('punto-b', near, PUNTO_B, 10)).toBe('arrived');
    // Restando dentro non ri-annuncia
    expect(det.update('punto-b', near, PUNTO_B, 10)).toBe('inside');
    expect(det.update('punto-b', near, PUNTO_B, 10)).toBe('inside');
  });

  it('non ri-annuncia dopo una breve uscita (isteresi), ri-annuncia solo dopo reset', () => {
    const det = new ArrivalDetector(60);
    det.update('x', near, PUNTO_B, 10); // arrived
    // esce di poco (entro l'isteresi) e rientra: nessun nuovo annuncio
    const justOutside = { lat: 37.3838, lng: -5.9903 }; // ~75-80 m
    expect(det.update('x', justOutside, PUNTO_B, 10)).not.toBe('arrived');
    expect(det.update('x', near, PUNTO_B, 10)).toBe('inside');
    // dopo reset esplicito, può ri-annunciare
    det.reset('x');
    expect(det.update('x', near, PUNTO_B, 10)).toBe('arrived');
  });

  it('ignora fix con precisione pessima', () => {
    const det = new ArrivalDetector(60);
    expect(det.update('y', near, PUNTO_B, 500)).toBe('low-accuracy');
  });

  it('cambiando destinazione, la nuova può annunciare', () => {
    const det = new ArrivalDetector(60);
    det.update('a', near, PUNTO_B, 10); // arrived su a
    const nearCat = { lat: 37.38592, lng: -5.99308 };
    expect(det.update('b', nearCat, PUNTO_A, 10)).toBe('arrived');
  });

  it('setRadius aggiorna la soglia con i limiti 40–100', () => {
    const det = new ArrivalDetector(60);
    det.setRadius(1000);
    // 90 m dal bersaglio: dentro con raggio 100
    const at90m = { lat: PUNTO_B.lat + 0.00081, lng: PUNTO_B.lng };
    expect(det.update('z', at90m, PUNTO_B, 10)).toBe('arrived');
  });
});

describe('googleMapsDirectionsUrl', () => {
  it('genera un URL di navigazione a piedi valido', () => {
    const url = googleMapsDirectionsUrl(PUNTO_B, PUNTO_C);
    expect(url).toContain('google.com/maps/dir');
    expect(url).toContain('walking');
    expect(url).toContain(String(PUNTO_B.lat));
  });
});
