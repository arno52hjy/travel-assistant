export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function haversineDistance(a: Place, b: Place): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c = sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon;
  return R * 2 * Math.asin(Math.sqrt(c));
}

// 最近邻算法：找最优游览顺序
export function optimizeRoute(places: Place[]): Place[] {
  if (places.length <= 2) return places;

  const visited = new Set<number>();
  const route: Place[] = [];
  let current = 0;

  while (route.length < places.length) {
    visited.add(current);
    route.push(places[current]);

    let nearest = -1;
    let minDist = Infinity;

    for (let i = 0; i < places.length; i++) {
      if (!visited.has(i)) {
        const dist = haversineDistance(places[current], places[i]);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
    }
    if (nearest !== -1) current = nearest;
  }
  return route;
}

// 计算总路线距离（km）
export function totalDistance(places: Place[]): number {
  let total = 0;
  for (let i = 0; i < places.length - 1; i++) {
    total += haversineDistance(places[i], places[i + 1]);
  }
  return Math.round(total * 10) / 10;
}