import type { TransportMode, RouteSegmentResult } from '../types/route';
import type { Place } from '../utils/tsp';

export async function loadAMap(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).AMap && (window as any).AMap.Geocoder) {
      resolve((window as any).AMap);
      return;
    }
    (window as any)._AMapSecurityConfig = {
      securityJsCode: import.meta.env.VITE_AMAP_SCODE,
    };
    (window as any).onAMapLoaded = () => {
      resolve((window as any).AMap);
    };
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${import.meta.env.VITE_AMAP_KEY}&plugin=AMap.Geocoder,AMap.PlaceSearch,AMap.Driving,AMap.Riding&callback=onAMapLoaded`;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export interface PlaceSuggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
  photos?: Array<{ url: string; title?: string }>;
  type?: string;
}

// 输入关键词搜索地点（PlaceSearch 关键词检索）
export async function searchPlaces(keyword: string): Promise<PlaceSuggestion[]> {
  const AMap = await loadAMap();
  return new Promise((resolve) => {
    const placeSearch = new AMap.PlaceSearch({ pageSize: 10, extensions: 'all' });
    placeSearch.search(keyword, (status: string, result: any) => {
      if (status === 'complete' && result.poiList) {
        const pois: PlaceSuggestion[] = result.poiList.pois.map((poi: any) => ({
          name: poi.name,
          address: poi.pname || poi.address || '',
          lat: poi.location.lat,
          lng: poi.location.lng,
          photos: poi.photos,
          type: poi.type,
        }));
        resolve(pois);
      } else {
        resolve([]);
      }
    });
  });
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const AMap = await loadAMap();

  // 先尝试地理编码
  const geoResult = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
    const geocoder = new AMap.Geocoder();
    geocoder.getLocation(address, (status: string, result: any) => {
      if (status === 'complete' && result.geocodes.length > 0) {
        const loc = result.geocodes[0].location;
        resolve({ lat: loc.lat, lng: loc.lng });
      } else {
        resolve(null);
      }
    });
  });

  if (geoResult) return geoResult;

  // 地理编码失败，回退到 POI 关键词搜索
  const pois = await searchPlaces(address);
  if (pois.length > 0) {
    return { lat: pois[0].lat, lng: pois[0].lng };
  }

  return null;
}

export async function getNearbyPlaces(lat: number, lng: number, radius: number = 5000): Promise<any[]> {
  const AMap = await loadAMap();
  return new Promise((resolve) => {
    const placeSearch = new AMap.PlaceSearch({ radius, pageSize: 25, extensions: 'all' });
    placeSearch.searchNearBy('风景名胜|公园|景点|餐饮|购物|娱乐', [lng, lat], radius, (status: string, result: any) => {
      if (status === 'complete' && result.poiList) {
        resolve(result.poiList.pois);
      } else {
        resolve([]);
      }
    });
  });
}

// ---- 路线规划 ----

function flattenPath(steps: any[]): Array<[number, number]> {
  const path: Array<[number, number]> = [];
  for (const step of steps) {
    if (!step.path) continue;
    for (const pt of step.path) {
      if (Array.isArray(pt)) {
        path.push([pt[0], pt[1]]);
      } else if (pt.lng != null && pt.lat != null) {
        path.push([pt.lng, pt.lat]);
      }
    }
  }
  return path;
}

function straightSegment(
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
  mode: TransportMode,
): RouteSegmentResult {
  const dlat = (destination.lat - origin.lat) * (Math.PI / 180);
  const dlng = (destination.lng - origin.lng) * (Math.PI / 180);
  const a = Math.sin(dlat / 2) ** 2 +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) * Math.sin(dlng / 2) ** 2;
  const distMeters = 6371000 * 2 * Math.asin(Math.sqrt(a));

  return {
    path: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
    distance: Math.round(distMeters),
    duration: 0,
    mode,
    fallback: true,
  };
}

function loadPlugin(AMap: any, pluginName: string): Promise<void> {
  return new Promise((resolve) => {
    AMap.plugin(pluginName, () => resolve());
  });
}

async function planDrivingRoute(
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
): Promise<RouteSegmentResult> {
  const AMap = await loadAMap();
  await loadPlugin(AMap, 'AMap.Driving');

  return new Promise((resolve, reject) => {
    const driving = new AMap.Driving({ policy: 0 });
    driving.search(
      new AMap.LngLat(origin.lng, origin.lat),
      new AMap.LngLat(destination.lng, destination.lat),
      (status: string, result: any) => {
        if (status === 'complete' && result.routes && result.routes.length > 0) {
          const route = result.routes[0];
          try {
            const path = flattenPath(route.steps);
            resolve({
              path: path.length > 0 ? path : [[origin.lng, origin.lat], [destination.lng, destination.lat]],
              distance: route.distance || 0,
              duration: route.time || 0,
              mode: 'driving',
              fallback: false,
            });
          } catch {
            reject(new Error('Failed to flatten path'));
          }
        } else {
          reject(new Error('No driving route found'));
        }
      },
    );
  });
}

async function planCyclingRoute(
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
): Promise<RouteSegmentResult> {
  const AMap = await loadAMap();
  await loadPlugin(AMap, 'AMap.Riding');

  return new Promise((resolve, reject) => {
    const riding = new AMap.Riding();
    riding.search(
      new AMap.LngLat(origin.lng, origin.lat),
      new AMap.LngLat(destination.lng, destination.lat),
      (status: string, result: any) => {
        if (status === 'complete' && result.routes && result.routes.length > 0) {
          const route = result.routes[0];
          try {
            const path = flattenPath(route.steps);
            resolve({
              path: path.length > 0 ? path : [[origin.lng, origin.lat], [destination.lng, destination.lat]],
              distance: route.distance || 0,
              duration: route.time || 0,
              mode: 'cycling',
              fallback: false,
            });
          } catch {
            reject(new Error('Failed to flatten path'));
          }
        } else {
          reject(new Error('No cycling route found'));
        }
      },
    );
  });
}

export async function planRouteSegment(
  origin: { lng: number; lat: number },
  destination: { lng: number; lat: number },
  mode: TransportMode,
): Promise<RouteSegmentResult> {
  if (mode === 'straight') {
    return straightSegment(origin, destination, mode);
  }
  try {
    if (mode === 'driving') {
      return await planDrivingRoute(origin, destination);
    }
    return await planCyclingRoute(origin, destination);
  } catch {
    return straightSegment(origin, destination, mode);
  }
}

export async function planAllSegments(
  places: Place[],
  mode: TransportMode,
): Promise<RouteSegmentResult[]> {
  if (places.length < 2) return [];
  const tasks: Promise<RouteSegmentResult>[] = [];
  for (let i = 0; i < places.length - 1; i++) {
    tasks.push(planRouteSegment(places[i], places[i + 1], mode));
  }
  return Promise.all(tasks);
}