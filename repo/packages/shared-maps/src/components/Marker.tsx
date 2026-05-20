'use client';
/**
 * Composant Marker -- marqueur Mapbox GL JS avec support popup.
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */
import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import { useMapboxMap } from './Map';

export interface MarkerProps {
  /** Position du marqueur [lng, lat] */
  position: [number, number];
  /** Couleur du marqueur Mapbox par defaut */
  color?: string | undefined;
  /** Element DOM personnalise pour le marqueur */
  element?: HTMLElement | undefined;
  /** Contenu HTML de la popup */
  popupHtml?: string | undefined;
  /** Marqueur draggable */
  draggable?: boolean | undefined;
  /** Callback apres deplacement du marqueur */
  onDragEnd?: ((lngLat: [number, number]) => void) | undefined;
  /** Callback au clic sur le marqueur */
  onClick?: (() => void) | undefined;
  /** Ancrage du marqueur sur l'element */
  anchor?: mapboxgl.Anchor | undefined;
}

/**
 * Marqueur Mapbox GL. Retourne null (pas d'element DOM direct).
 * Le marqueur est ajoute a la carte via l'API Mapbox.
 */
export function Marker({
  position,
  color,
  element,
  popupHtml,
  draggable = false,
  onDragEnd,
  onClick,
  anchor,
}: MarkerProps) {
  const map = useMapboxMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const markerOptions: mapboxgl.MarkerOptions = {
      draggable,
    };
    if (color !== undefined) markerOptions.color = color;
    if (element !== undefined) markerOptions.element = element;
    if (anchor !== undefined) markerOptions.anchor = anchor;

    const marker = new mapboxgl.Marker(markerOptions)
      .setLngLat(position)
      .addTo(map);

    if (popupHtml) {
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml);
      marker.setPopup(popup);
    }

    if (onDragEnd) {
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        onDragEnd([lngLat.lng, lngLat.lat]);
      });
    }

    if (onClick) {
      marker.getElement().addEventListener('click', onClick);
    }

    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, position, color, element, popupHtml, draggable, onDragEnd, onClick, anchor]);

  return null;
}
