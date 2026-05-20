'use client';
/**
 * Composant UserLocationMarker -- affiche la position GPS de l'utilisateur.
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import { useMapboxMap } from './Map';

export interface UserLocationMarkerProps {
  /** Position GPS [lng, lat] */
  position: [number, number] | null;
  /** Precision en metres */
  accuracy?: number | undefined;
  /** Couleur du marqueur. Par defaut: #E95D2C */
  color?: string | undefined;
  /** Afficher le cercle de precision */
  showAccuracyCircle?: boolean | undefined;
}

/** Convertit des metres en pixels a zoom maximal */
function metersToPixelsAtMaxZoom(meters: number, latitude: number): number {
  return meters / (0.075 * Math.cos((latitude * Math.PI) / 180));
}

/**
 * Marqueur de position utilisateur avec cercle de precision optionnel.
 */
export function UserLocationMarker({
  position,
  accuracy,
  color = '#E95D2C',
  showAccuracyCircle = true,
}: UserLocationMarkerProps) {
  const map = useMapboxMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const sourceId = useRef(`user-loc-${Math.random().toString(36).slice(2)}`);
  const layerId = useRef(`user-loc-acc-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!map || !position) return;

    // Nettoyer le marqueur precedent
    markerRef.current?.remove();

    // Creer l'element du marqueur
    const el = document.createElement('div');
    el.style.width = '18px';
    el.style.height = '18px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = color;
    el.style.border = '3px solid #FFFFFF';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)';

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat(position)
      .addTo(map);
    markerRef.current = marker;

    // Cercle de precision
    if (showAccuracyCircle && accuracy !== undefined) {
      const sid = sourceId.current;
      const lid = layerId.current;

      const circleData: GeoJSON.Feature<GeoJSON.Point> = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: position },
        properties: {},
      };

      if (!map.getSource(sid)) {
        map.addSource(sid, { type: 'geojson', data: circleData });
        map.addLayer({
          id: lid,
          type: 'circle',
          source: sid,
          paint: {
            'circle-radius': {
              stops: [
                [0, 0],
                [20, metersToPixelsAtMaxZoom(accuracy, position[1])],
              ],
              base: 2,
            },
            'circle-color': color,
            'circle-opacity': 0.15,
            'circle-stroke-width': 1,
            'circle-stroke-color': color,
            'circle-stroke-opacity': 0.4,
          },
        });
      } else {
        const src = map.getSource(sid) as mapboxgl.GeoJSONSource;
        src.setData(circleData);
      }
    }

    return () => {
      marker.remove();
      markerRef.current = null;
      const sid = sourceId.current;
      const lid = layerId.current;
      if (map.getLayer(lid)) map.removeLayer(lid);
      if (map.getSource(sid)) map.removeSource(sid);
    };
  }, [map, position, accuracy, color, showAccuracyCircle]);

  return null;
}
