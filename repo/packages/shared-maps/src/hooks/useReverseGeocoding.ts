'use client';
/**
 * Hook useReverseGeocoding -- geocodage inverse via Mapbox Geocoding API.
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { useQuery } from '@tanstack/react-query';

export interface UseReverseGeocodingOptions {
  /** Langue des resultats. Par defaut: 'fr' */
  language?: 'fr' | 'ar' | 'en' | undefined;
  /** Types de lieux a retourner */
  types?: string | undefined;
}

export interface ReverseGeocodingResult {
  placeName: string;
  city: string | null;
  country: string | null;
  coordinates: [number, number];
}

/**
 * Hook de geocodage inverse: convertit des coordonnees en adresse lisible.
 * Utilise @tanstack/react-query pour le cache et la gestion des requetes.
 */
export function useReverseGeocoding(
  longitude: number | null,
  latitude: number | null,
  options: UseReverseGeocodingOptions = {},
) {
  const language = options.language ?? 'fr';
  const types = options.types ?? 'place,address';
  const token = process.env['NEXT_PUBLIC_MAPBOX_TOKEN'];

  return useQuery<ReverseGeocodingResult>({
    queryKey: ['reverse-geocoding', longitude, latitude, language, types],
    enabled: longitude !== null && latitude !== null && Boolean(token),
    queryFn: async () => {
      if (longitude === null || latitude === null || !token) {
        throw new Error('Coordonnees ou token manquants.');
      }
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&language=${language}&types=${types}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocodage inverse echoue: ${res.status}`);
      const data = (await res.json()) as {
        features?: Array<{
          place_name: string;
          center?: [number, number];
          context?: Array<{ id: string; text: string }>;
        }>;
      };
      const feature = data.features?.[0];
      if (!feature) throw new Error('Aucun resultat de geocodage inverse.');

      const context = feature.context ?? [];
      const cityEntry = context.find((c) => c.id.startsWith('place.'));
      const countryEntry = context.find((c) => c.id.startsWith('country.'));

      return {
        placeName: feature.place_name,
        city: cityEntry?.text ?? null,
        country: countryEntry?.text ?? null,
        coordinates: feature.center ?? [longitude, latitude],
      };
    },
  });
}
