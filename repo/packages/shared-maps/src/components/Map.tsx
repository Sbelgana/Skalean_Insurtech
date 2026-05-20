'use client';
/**
 * Composant Map -- conteneur principal Mapbox GL JS.
 * Reference: task-1.4.10 Sprint 4 Phase 1
 *
 * Consumers must import 'mapbox-gl/dist/mapbox-gl.css' in their app layout.
 */
import mapboxgl from 'mapbox-gl';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CASABLANCA_CENTER,
  DEFAULT_ZOOM,
  CASABLANCA_BOUNDS,
  toMapboxLocale,
} from '../lib/casablanca';

export interface MapProps {
  /** Jeton d'acces Mapbox. Par defaut: process.env['NEXT_PUBLIC_MAPBOX_TOKEN'] */
  token?: string | undefined;
  /** Style Mapbox (URL ou objet JSON). Par defaut: streets-v12 */
  style?: string | undefined;
  /** Centre initial [lng, lat]. Par defaut: Casablanca */
  center?: [number, number] | undefined;
  /** Zoom initial. Par defaut: 11 */
  zoom?: number | undefined;
  /** Locale pour les labels cartographiques */
  locale?: string | undefined;
  /** Contraindre la vue aux limites Casablanca */
  constrainBounds?: boolean | undefined;
  /** Classe CSS additionnelle pour le conteneur */
  className?: string | undefined;
  /** Contenu a rendre dans le contexte carte (markers, layers, etc.) */
  children?: ReactNode | undefined;
}

/** Contexte exposant l'instance mapboxgl.Map aux composants enfants */
const MapContext = createContext<mapboxgl.Map | null>(null);

/** Hook pour acceder a l'instance Mapbox depuis un composant enfant */
export function useMapboxMap(): mapboxgl.Map | null {
  return useContext(MapContext);
}

/**
 * Composant racine carte Mapbox GL JS.
 * Monte la carte dans un div et expose l'instance via MapContext.
 */
export function Map({
  token,
  style = 'mapbox://styles/mapbox/streets-v12',
  center = CASABLANCA_CENTER,
  zoom = DEFAULT_ZOOM,
  locale,
  constrainBounds = false,
  className,
  children,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);

  useEffect(() => {
    const resolvedToken = token ?? process.env['NEXT_PUBLIC_MAPBOX_TOKEN'];
    if (!resolvedToken) {
      console.error('[shared-maps] NEXT_PUBLIC_MAPBOX_TOKEN est absent. La carte ne peut pas etre initialisee.');
      return;
    }
    if (!containerRef.current) return;

    mapboxgl.accessToken = resolvedToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style,
      center,
      zoom,
    });

    if (constrainBounds) {
      map.setMaxBounds(CASABLANCA_BOUNDS);
    }

    map.on('load', () => {
      applyLocale(map, locale);
      setMapInstance(map);
    });

    map.on('error', (e) => {
      console.error('[shared-maps] Erreur Mapbox GL:', e.error);
    });

    return () => {
      map.remove();
      setMapInstance(null);
    };
    // Volontairement [] : l'effet ne doit s'executer qu'une seule fois au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MapContext.Provider value={mapInstance}>
      <div
        ref={containerRef}
        className={`w-full h-full ${className ?? ''}`}
        data-testid="mapbox-map"
      >
        {mapInstance !== null ? children : null}
      </div>
    </MapContext.Provider>
  );
}

/** Applique la locale aux couches de labels Mapbox */
function applyLocale(map: mapboxgl.Map, locale: string | undefined): void {
  if (!locale) return;
  const mapboxLocale = toMapboxLocale(locale);
  const expression = ['get', `name_${mapboxLocale}`];
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type === 'symbol') {
      try {
        map.setLayoutProperty(
          layer.id,
          'text-field',
          expression as mapboxgl.Expression,
        );
      } catch {
        // Certaines couches ne supportent pas text-field -- ignorer.
      }
    }
  }
}
