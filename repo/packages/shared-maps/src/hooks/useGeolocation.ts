'use client';
/**
 * Hook useGeolocation -- acces a la geolocalisation du navigateur.
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import { useEffect, useState } from 'react';

export interface UseGeolocationOptions {
  /** Surveiller la position en continu */
  watch?: boolean | undefined;
  /** Options Geolocation API */
  enableHighAccuracy?: boolean | undefined;
  timeout?: number | undefined;
  maximumAge?: number | undefined;
}

export interface UseGeolocationResult {
  /** Position [lng, lat] ou null si non disponible */
  position: [number, number] | null;
  /** Precision en metres */
  accuracy: number | null;
  /** Chargement en cours */
  loading: boolean;
  /** Erreur de geolocalisation */
  error: GeolocationPositionError | Error | null;
}

const DEFAULT_OPTIONS: Required<UseGeolocationOptions> = {
  watch: false,
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

/**
 * Hook d'acces a la geolocalisation du navigateur.
 * Supporte le mode ponctuel (getCurrentPosition) et continu (watchPosition).
 */
export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationResult {
  const opts: Required<UseGeolocationOptions> = {
    watch: options.watch ?? DEFAULT_OPTIONS.watch,
    enableHighAccuracy: options.enableHighAccuracy ?? DEFAULT_OPTIONS.enableHighAccuracy,
    timeout: options.timeout ?? DEFAULT_OPTIONS.timeout,
    maximumAge: options.maximumAge ?? DEFAULT_OPTIONS.maximumAge,
  };

  const [position, setPosition] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<GeolocationPositionError | Error | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError(new Error('Geolocation API non disponible dans ce navigateur.'));
      setLoading(false);
      return;
    }

    const positionOptions: PositionOptions = {};
    if (opts.enableHighAccuracy !== undefined) positionOptions.enableHighAccuracy = opts.enableHighAccuracy;
    if (opts.timeout !== undefined) positionOptions.timeout = opts.timeout;
    if (opts.maximumAge !== undefined) positionOptions.maximumAge = opts.maximumAge;

    const onSuccess = (pos: GeolocationPosition) => {
      setPosition([pos.coords.longitude, pos.coords.latitude]);
      setAccuracy(pos.coords.accuracy);
      setLoading(false);
      setError(null);
    };

    const onError = (err: GeolocationPositionError) => {
      setError(err);
      setLoading(false);
    };

    if (opts.watch) {
      const watchId = navigator.geolocation.watchPosition(onSuccess, onError, positionOptions);
      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, positionOptions);
      return undefined;
    }
  }, [opts.watch, opts.enableHighAccuracy, opts.timeout, opts.maximumAge]);

  return { position, accuracy, loading, error };
}
