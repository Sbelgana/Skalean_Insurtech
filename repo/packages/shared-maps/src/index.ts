/**
 * @insurtech/shared-maps -- public API
 * Reference: task-1.4.10 Sprint 4 Phase 1
 */

export { Map, useMapboxMap } from './components/Map';
export type { MapProps } from './components/Map';

export { Marker } from './components/Marker';
export type { MarkerProps } from './components/Marker';

export { MarkerCluster } from './components/MarkerCluster';
export type { MarkerClusterProps, ClusterPoint } from './components/MarkerCluster';

export { UserLocationMarker } from './components/UserLocationMarker';
export type { UserLocationMarkerProps } from './components/UserLocationMarker';

export { SearchBox } from './components/SearchBox';
export type { SearchBoxProps, SearchBoxResult } from './components/SearchBox';

export { RouteLayer } from './components/RouteLayer';
export type { RouteLayerProps, RouteGeometry } from './components/RouteLayer';

export { useGeolocation } from './hooks/useGeolocation';
export type { UseGeolocationOptions, UseGeolocationResult } from './hooks/useGeolocation';

export { useReverseGeocoding } from './hooks/useReverseGeocoding';
export type { UseReverseGeocodingOptions, ReverseGeocodingResult } from './hooks/useReverseGeocoding';

export { useDirections } from './hooks/useDirections';
export type { UseDirectionsOptions, DirectionsResult, DirectionsProfile } from './hooks/useDirections';

export {
  CASABLANCA_CENTER,
  CASABLANCA_BOUNDS,
  CASABLANCA_DISTRICTS,
  DEFAULT_ZOOM,
  MA_COUNTRY_CODE,
  toMapboxLocale,
} from './lib/casablanca';
export type { MapboxLocale } from './lib/casablanca';

export const VERSION = '0.1.0';
