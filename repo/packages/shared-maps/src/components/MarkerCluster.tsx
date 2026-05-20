'use client';
/**
 * Composant MarkerCluster -- clustering de marqueurs avec Supercluster.
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import type * as mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import Supercluster from 'supercluster';
import { useMapboxMap } from './Map';

export interface ClusterPoint {
  id: string;
  coordinates: [number, number];
  properties?: Record<string, unknown> | undefined;
}

export interface MarkerClusterProps {
  /** Points a afficher sur la carte */
  points: ClusterPoint[];
  /** Rayon de clustering en pixels. Par defaut: 50 */
  radius?: number | undefined;
  /** Zoom maximal de clustering. Par defaut: 17 */
  maxZoom?: number | undefined;
  /** Couleur des clusters. Par defaut: #E95D2C (orange Skalean) */
  clusterColor?: string | undefined;
  /** Couleur du texte des clusters. Par defaut: #FFFFFF */
  clusterTextColor?: string | undefined;
  /** Callback au clic sur un point individuel */
  onPointClick?: ((point: ClusterPoint) => void) | undefined;
}

const SOURCE_ID_PREFIX = 'marker-cluster-source';
const CLUSTER_LAYER_PREFIX = 'marker-cluster-layer';
const COUNT_LAYER_PREFIX = 'marker-cluster-count';
const UNCLUSTERED_LAYER_PREFIX = 'marker-unclustered';

/**
 * Couche de clustering de marqueurs utilisant Supercluster et Mapbox GL.
 */
export function MarkerCluster({
  points,
  radius = 50,
  maxZoom = 17,
  clusterColor = '#E95D2C',
  clusterTextColor = '#FFFFFF',
  onPointClick,
}: MarkerClusterProps) {
  const map = useMapboxMap();
  const idRef = useRef(`${SOURCE_ID_PREFIX}-${Math.random().toString(36).slice(2)}`);
  const sourceId = idRef.current;
  const clusterLayerId = `${CLUSTER_LAYER_PREFIX}-${sourceId}`;
  const countLayerId = `${COUNT_LAYER_PREFIX}-${sourceId}`;
  const unclusteredLayerId = `${UNCLUSTERED_LAYER_PREFIX}-${sourceId}`;

  useEffect(() => {
    if (!map) return;

    // Convertir les points en GeoJSON
    const geoJsonFeatures: GeoJSON.Feature<GeoJSON.Point>[] = points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: p.coordinates },
      properties: { id: p.id, ...(p.properties ?? {}) },
    }));

    const geoJsonData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: geoJsonFeatures,
    };

    // Utiliser Supercluster pour le clustering cote client
    const supercluster = new Supercluster({ radius, maxZoom });
    supercluster.load(
      geoJsonFeatures.map((f) => ({
        type: 'Feature' as const,
        geometry: f.geometry,
        properties: f.properties ?? {},
      })),
    );

    // Ajouter la source GeoJSON
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geoJsonData,
        cluster: true,
        clusterMaxZoom: maxZoom,
        clusterRadius: radius,
      });
    } else {
      const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      src.setData(geoJsonData);
    }

    // Couche des cercles de cluster
    if (!map.getLayer(clusterLayerId)) {
      map.addLayer({
        id: clusterLayerId,
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': clusterColor,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            10,
            30,
            100,
            40,
          ],
          'circle-opacity': 0.85,
        },
      });
    }

    // Couche du nombre de points dans le cluster
    if (!map.getLayer(countLayerId)) {
      map.addLayer({
        id: countLayerId,
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: {
          'text-color': clusterTextColor,
        },
      });
    }

    // Couche des points non groupes
    if (!map.getLayer(unclusteredLayerId)) {
      map.addLayer({
        id: unclusteredLayerId,
        type: 'circle',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': clusterColor,
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      });
    }

    // Clic sur un cluster -> zoom in
    const handleClusterClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] });
      if (!features.length) return;
      const clusterId = features[0]?.properties?.['cluster_id'] as number | undefined;
      if (clusterId === undefined) return;
      // biome-ignore lint: mapbox source typed as GeoJSONSource
      const src = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
      // biome-ignore lint/suspicious/noExplicitAny: callback API from @types/mapbox-gl 3.4.1
      src.getClusterExpansionZoom(clusterId, (err: unknown, expansionZoom: number | null | undefined) => {
        if (err || expansionZoom == null) return;
        const geom = features[0]?.geometry;
        if (geom?.type !== 'Point') return;
        map.easeTo({ center: geom.coordinates as [number, number], zoom: expansionZoom });
      });
    };

    // Clic sur un point individuel
    const handlePointClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [unclusteredLayerId] });
      if (!features.length || !onPointClick) return;
      const feature = features[0];
      if (!feature) return;
      const pointId = feature.properties?.['id'] as string | undefined;
      if (!pointId) return;
      const found = points.find((p) => p.id === pointId);
      if (found) onPointClick(found);
    };

    map.on('click', clusterLayerId, handleClusterClick);
    map.on('click', unclusteredLayerId, handlePointClick);
    map.on('mouseenter', clusterLayerId, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', clusterLayerId, () => { map.getCanvas().style.cursor = ''; });

    return () => {
      map.off('click', clusterLayerId, handleClusterClick);
      map.off('click', unclusteredLayerId, handlePointClick);
      if (map.getLayer(countLayerId)) map.removeLayer(countLayerId);
      if (map.getLayer(clusterLayerId)) map.removeLayer(clusterLayerId);
      if (map.getLayer(unclusteredLayerId)) map.removeLayer(unclusteredLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
    // JSON.stringify(points) pour detecter les changements de contenu
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional serialization dependency
  }, [map, JSON.stringify(points), radius, maxZoom, clusterColor, clusterTextColor, onPointClick, sourceId, clusterLayerId, countLayerId, unclusteredLayerId]);

  return null;
}
