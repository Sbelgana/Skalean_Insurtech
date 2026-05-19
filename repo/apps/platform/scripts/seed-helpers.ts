/**
 * Seed helpers for Skalean InsurTech dev seeds.
 * Generators: ICE, CIN, phone MA, police number, invoice number, ULID.
 * Utilities: pickRandom, randomBetween, randomDateInRange, holiday/Ramadan checks.
 * Aucune emoji (decision-006). Timezone Africa/Casablanca (decision-002).
 */
import { ulid } from 'ulid';

/**
 * Genere un ICE 15 chiffres (Identifiant Commun de l'Entreprise).
 * Format : 9 chiffres entreprise + 4 chiffres etablissement + 2 chiffres TVA.
 * Pour seeds dev : 15 chiffres aleatoires.
 */
export function generateIce(): string {
  let ice = '';
  for (let i = 0; i < 15; i++) {
    ice += Math.floor(Math.random() * 10).toString();
  }
  return ice;
}

/**
 * Genere une CIN format MA : 1-2 lettres prefecture + 6 chiffres.
 * Prefixes : A (Rabat), B (Casablanca), BH (Casablanca-Anfa), BE (Casablanca-Hay Hassani),
 * C (Fes), D (Marrakech), E (Tanger), F (Agadir), etc.
 */
export function generateCin(): string {
  const prefixes = [
    'A', 'B', 'BH', 'BE', 'C', 'D', 'E', 'F', 'G', 'H',
    'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z',
  ];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)] ?? 'A';
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${digits}`;
}

/**
 * Genere telephone marocain E.164.
 * 80% mobile (+2126XXXXXXXX ou +2127XXXXXXXX), 20% fixe (+2125XXXXXXXX).
 */
export function generatePhoneMa(): string {
  const isMobile = Math.random() < 0.8;
  if (isMobile) {
    const operator = Math.random() < 0.5 ? '6' : '7';
    const rest = Math.floor(10000000 + Math.random() * 90000000).toString();
    return `+212${operator}${rest}`;
  }
  const region = Math.floor(Math.random() * 9) + 1;
  const rest = Math.floor(1000000 + Math.random() * 9000000).toString();
  return `+2125${region}${rest}`;
}

/**
 * Genere numero de police format POL-YYYY-NNNN.
 */
export function generatePoliceNumber(year: number, sequence: number): string {
  return `POL-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Genere numero de facture format INV-YYYY-NNNN.
 */
export function generateInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Genere un ULID (Universally Unique Lexicographically Sortable Identifier).
 */
export function generateUlid(): string {
  return ulid();
}

/**
 * Pick aleatoire dans un tableau.
 */
export function pickRandom<T>(arr: T[]): T {
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) throw new Error('pickRandom called on empty array');
  return item;
}

/**
 * Random integer entre min et max inclus.
 */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random date entre offsetDaysMin et offsetDaysMax par rapport a maintenant.
 * Offset negatif = passe, positif = futur.
 * Retourne ISO string.
 */
export function randomDateInRange(offsetDaysMin: number, offsetDaysMax: number): string {
  const now = Date.now();
  const minMs = now + offsetDaysMin * 86400000;
  const maxMs = now + offsetDaysMax * 86400000;
  const ts = minMs + Math.random() * (maxMs - minMs);
  return new Date(ts).toISOString();
}

/**
 * BAM Holidays Maroc 2026 (Bank Al-Maghrib calendar).
 */
const HOLIDAYS_2026: string[] = [
  '2026-01-01', // Jour de l'An
  '2026-01-11', // Manifeste de l'Independance
  '2026-03-20', // Aid El Fitr (estime)
  '2026-03-21', // Aid El Fitr +1
  '2026-05-01', // Fete du Travail
  '2026-05-26', // Aid El Adha (estime)
  '2026-05-27', // Aid El Adha +1
  '2026-07-16', // Awal Moharram
  '2026-07-30', // Fete du Trone
  '2026-08-14', // Allegeance Oued Ed-Dahab
  '2026-08-20', // Revolution du Roi et du Peuple
  '2026-08-21', // Fete de la Jeunesse
  '2026-09-24', // Aid El Mawlid
  '2026-11-06', // Marche Verte
  '2026-11-18', // Independance
];

export function isMoroccoHoliday2026(date: Date): boolean {
  const iso = date.toISOString().slice(0, 10);
  return HOLIDAYS_2026.includes(iso);
}

/**
 * Ramadan 2026 : du 18 fevrier 2026 au 19 mars 2026 (estime selon calendrier Hijri).
 */
export function isInRamadan2026(date: Date): boolean {
  const start = new Date('2026-02-18T00:00:00.000Z').getTime();
  const end = new Date('2026-03-19T23:59:59.999Z').getTime();
  const t = date.getTime();
  return t >= start && t <= end;
}
