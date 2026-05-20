'use client';
/**
 * Hook useDirections -- calcul d'itineraire via Mapbox Directions API.
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { useQuery } from '@tanstack/react-query';
import type { RouteGeometry } from '../components/RouteLayer';

export type DirectionsProfile = 'driving' | 'driving-traffic' | 'walking' | 'cycling';

export interface UseDirectionsOptions {
  /** Profil de transport. Par defaut: 'driving' */
  profile?: DirectionsProfile | undefined;
  /** Langue des instructions. Par defaut: 'fr' */
  language?: 'fr' | 'ar' | 'en' | undefined;
  /** Inclure les instructions etape par etape */
  steps?: boolean | undefined;
}

export interface DirectionsResult {
  geometry: RouteGeometry;
  distanceMeters: number;
  durationSeconds: number;
  steps: Array<{
    instruction: string;
    distanceMeters: number;
    durationSeconds: number;
  }>;
}

/**
 * Hook de calcul d'itineraire entre deux points.
 * Utilise @tanstack/react-query pour le cache.
 */
export function useDirections(
  from: [number, number] | null,
  to: [number, number] | null,
  options: UseDirectionsOptions = {},
) {
  const profile = options.profile ?? 'driving';
  const language = options.language ?? 'fr';
  const steps = options.steps ?? false;
  const token = process.env['NEXT_PUBLIC_MAPBOX_TOKEN'];

  return useQuery<DirectionsResult>({
    queryKey: ['directions', from, to, profile, language, steps],
    enabled: from !== null && to !== null && Boolean(token),
    queryFn: async () => {
      if (!from || !to || !token) {
        throw new Error('Points ou token manquants pour le calcul d\'itineraire.');
      }
      const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?access_token=${token}&geometries=geojson&language=${language}&steps=${steps}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Calcul d'itineraire echoue: ${res.status}`);
      const data = (await res.json()) as {
        routes?: Array<{
          geometry: { type: string; coordinates: [number, number][] };
          distance: number;
          duration: number;
          legs?: Array<{
            steps?: Array<{
              maneuver?: { instruction?: string };
              distance?: number;
              duration?: number;
            }>;
          }>;
        }>;
      };
      const route = data.routes?.[0];
      if (!route) throw new Error('Aucun itineraire trouve.');

      const routeSteps = steps
        ? (route.legs?.[0]?.steps ?? []).map((s) => ({
            instruction: s.maneuver?.instruction ?? '',
            distanceMeters: s.distance ?? 0,
            durationSeconds: s.duration ?? 0,
          }))
        : [];

      return {
        geometry: { type: 'LineString' as const, coordinates: route.geometry.coordinates },
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        steps: routeSteps,
      };
    },
  });
}
