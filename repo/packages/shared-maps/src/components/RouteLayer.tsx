'use client';
/**
 * Composant RouteLayer -- affiche un itineraire sur la carte Mapbox.
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import mapboxgl from 'mapbox-gl';
import { useEffect, useId } from 'react';
import { useMapboxMap } from './Map';

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface RouteLayerProps {
  /** Geometrie de l'itineraire GeoJSON LineString */
  geometry: RouteGeometry | null;
  /** Couleur de la ligne. Par defaut: #E95D2C */
  lineColor?: string | undefined;
  /** Epaisseur de la ligne. Par defaut: 4 */
  lineWidth?: number | undefined;
  /** Opacite de la ligne. Par defaut: 0.85 */
  lineOpacity?: number | undefined;
  /** Ajuster la vue a l'itineraire */
  fitBounds?: boolean | undefined;
  /** Marge pour fitBounds en pixels */
  fitBoundsPadding?: number | undefined;
}

/**
 * Couche d'itineraire GeoJSON sur la carte Mapbox.
 */
export function RouteLayer({
  geometry,
  lineColor = '#E95D2C',
  lineWidth = 4,
  lineOpacity = 0.85,
  fitBounds = true,
  fitBoundsPadding = 60,
}: RouteLayerProps) {
  const map = useMapboxMap();
  const uid = useId();
  const sourceId = `route-source-${uid}`;
  const layerId = `route-layer-${uid}`;

  useEffect(() => {
    if (!map) return;

    const data: GeoJSON.Feature<GeoJSON.LineString> | GeoJSON.FeatureCollection = geometry
      ? {
          type: 'Feature',
          geometry: geometry,
          properties: {},
        }
      : { type: 'FeatureCollection', features: [] };

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data });
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': lineColor,
          'line-width': lineWidth,
          'line-opacity': lineOpacity,
        },
      });
    } else {
      const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      src.setData(data);
    }

    // Ajuster la vue aux bornes de l'itineraire
    if (fitBounds && geometry && geometry.coordinates.length > 0) {
      const bounds = geometry.coordinates.reduce(
        (b, coord) => b.extend(coord as [number, number]),
        new mapboxgl.LngLatBounds(
          geometry.coordinates[0] as [number, number],
          geometry.coordinates[0] as [number, number],
        ),
      );
      map.fitBounds(bounds, { padding: fitBoundsPadding });
    }

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, geometry, lineColor, lineWidth, lineOpacity, fitBounds, fitBoundsPadding, sourceId, layerId]);

  return null;
}
