'use client';
/**
 * Constantes geographiques Casablanca et helpers localisation Mapbox.
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */

/** Coordonnees centre Casablanca [lng, lat] */
export const CASABLANCA_CENTER: [number, number] = [-7.5898, 33.5731];

/** Zoom par defaut pour la carte Casablanca */
export const DEFAULT_ZOOM = 11;

/**
 * Limites geographiques de la region Grand Casablanca.
 * SW corner: [-7.7500, 33.4800], NE corner: [-7.4000, 33.7000]
 */
export const CASABLANCA_BOUNDS: [[number, number], [number, number]] = [
  [-7.75, 33.48],
  [-7.4, 33.7],
];

/** Coordonnees des principaux quartiers/arrondissements de Casablanca */
export const CASABLANCA_DISTRICTS: Record<string, [number, number]> = {
  'Ain Chock': [-7.6108, 33.5452],
  'Ain Sebaa': [-7.5481, 33.6037],
  Anfa: [-7.6528, 33.5853],
  "Ben M'sick": [-7.5828, 33.5562],
  'Hay Hassani': [-7.6701, 33.5647],
  Ittissalat: [-7.5631, 33.5731],
  'Maarif': [-7.6350, 33.5773],
  Mediouna: [-7.5174, 33.4542],
  'Moulay Rachid': [-7.5694, 33.5378],
  'Sidi Bernoussi': [-7.5101, 33.6033],
};

/** Code pays Maroc pour l'API Mapbox */
export const MA_COUNTRY_CODE = 'ma' as const;

/** Locales supportees par les cartes Mapbox dans le contexte Skalean */
export type MapboxLocale = 'fr' | 'ar' | 'en';

/**
 * Convertit une locale BCP 47 en locale Mapbox.
 * - ar-MA (Darija) -> 'fr' (etiquettes latines plus lisibles en contexte marocain)
 * - ar (arabe classique) -> 'ar'
 * - fr -> 'fr'
 * - Tout autre -> 'fr' (fallback)
 */
export function toMapboxLocale(locale: string): MapboxLocale {
  if (locale === 'ar') return 'ar';
  if (locale === 'fr') return 'fr';
  // ar-MA et autres variantes arabes: on utilise le francais pour les labels cartographiques
  if (locale.startsWith('ar')) return 'fr';
  // Fallback sur le francais pour toutes autres locales
  return 'fr';
}
