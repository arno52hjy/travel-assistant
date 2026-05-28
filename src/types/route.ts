export type TransportMode = 'straight' | 'driving' | 'cycling';

export interface RouteSegmentResult {
  path: Array<[number, number]>;
  distance: number;
  duration: number;
  mode: TransportMode;
  fallback: boolean;
}
