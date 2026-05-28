import { useEffect, useRef, useState, useMemo } from 'react';
import { loadAMap, getNearbyPlaces, planAllSegments } from '../services/maps';
import { optimizeRoute, haversineDistance, type Place } from '../utils/tsp';
import type { TransportMode, RouteSegmentResult } from '../types/route';
import { Car, Bike, Route, Clock, MapPin, ChevronRight, ImageOff } from 'lucide-react';

const MODE_COLORS: Record<TransportMode, string> = {
  straight: '#3B82F6',
  driving: '#16A34A',
  cycling: '#F59E0B',
};

const ATTRACTION_KEYWORDS = [
  '风景名胜', '公园', '景点', '寺庙', '教堂', '纪念馆', '博物馆',
  '古建筑', '遗址', '园林', '山水', '海滩', '古镇', '老街', '塔',
  '植物园', '动物园', '游乐园', '水族馆', '名胜', '古迹', '故居',
];

const FOOD_KEYWORDS = [
  '餐饮', '餐厅', '美食', '小吃', '火锅', '烧烤', '咖啡', '奶茶',
  '面馆', '海鲜', '日料', '西餐', '中餐', '快餐', '甜点', '烘焙',
  '茶', '料理', '酒店', '酒吧', '自助', '串串',
];

function isAttraction(type: string): boolean {
  if (!type) return false;
  return ATTRACTION_KEYWORDS.some(k => type.includes(k));
}

function isFood(type: string): boolean {
  if (!type) return false;
  return FOOD_KEYWORDS.some(k => type.includes(k));
}

const TYPE_GRADIENTS = [
  'from-blue-400 to-cyan-500',
  'from-emerald-400 to-teal-500',
  'from-violet-400 to-purple-500',
  'from-orange-400 to-amber-500',
  'from-rose-400 to-pink-500',
  'from-indigo-400 to-blue-500',
  'from-teal-400 to-green-500',
  'from-fuchsia-400 to-purple-500',
];

function getTypeGradient(type?: string): string {
  if (!type) return TYPE_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = ((hash << 5) - hash) + type.charCodeAt(i);
    hash |= 0;
  }
  return TYPE_GRADIENTS[Math.abs(hash) % TYPE_GRADIENTS.length];
}

function PoiCard({ poi }: { poi: any }) {
  const [imgError, setImgError] = useState(false);
  const photoUrl = poi.photos?.[0]?.url;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-gray-200 transition-all group">
      <div className="h-24 bg-gray-100 relative overflow-hidden">
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={poi.name || ''}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${getTypeGradient(poi.type)} flex items-center justify-center`}>
            <ImageOff size={24} className="text-white/60" />
          </div>
        )}
        <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
          {poi.type?.split(';')[0] || '景点'}
        </span>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-medium text-gray-800 truncate" title={poi.name}>{poi.name}</p>
        {poi.distance != null && (
          <p className="text-[10px] text-gray-400 mt-0.5">{(poi.distance / 1000).toFixed(1)} km</p>
        )}
      </div>
    </div>
  );
}

const CARD_GRADIENTS = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-violet-500 to-violet-600',
  'from-amber-500 to-amber-600',
  'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600',
];

interface MapViewProps {
  places: Place[];
  origin: Place | null;
  destination: Place | null;
}

export default function MapView({ places, origin, destination }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const amapRef = useRef<any>(null);
  const initRef = useRef(false);

  const [optimized, setOptimized] = useState<Place[]>([]);
  const [nearby, setNearby] = useState<any[]>([]);
  const [transportMode, setTransportMode] = useState<TransportMode>('straight');
  const [routeSegments, setRouteSegments] = useState<RouteSegmentResult[]>([]);
  const [isRouting, setIsRouting] = useState(false);

  const nearbyAttractions = useMemo(() => nearby.filter(p => isAttraction(p.type || '')), [nearby]);
  const nearbyFood = useMemo(() => nearby.filter(p => isFood(p.type || '')), [nearby]);

  const fullRoute = useMemo(() => {
    const mid = places.length > 0 ? optimizeRoute(places) : [];
    const result: Place[] = [];
    if (origin) result.push(origin);
    for (const p of mid) result.push(p);
    if (destination) result.push(destination);
    return result;
  }, [places, origin, destination]);

  // places/origin/destination 变化 → 重新初始化所有
  useEffect(() => {
    if (fullRoute.length === 0) {
      setOptimized([]);
      setNearby([]);
      setRouteSegments([]);
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      polylinesRef.current.forEach(p => p.setMap(null));
      polylinesRef.current = [];
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }
      return;
    }

    initRef.current = true;
    setOptimized(fullRoute);
    setTransportMode('straight');
    initMap(fullRoute);
  }, [fullRoute]);

  // transportMode 变化 → 重新绘制路线（跳过初始化阶段）
  useEffect(() => {
    if (initRef.current) {
      initRef.current = false;
      return;
    }
    if (optimized.length < 2 || !mapInstanceRef.current) return;
    drawRoutes(optimized, transportMode);
  }, [transportMode]);

  async function initMap(route: Place[]) {
    const AMap = await loadAMap();
    amapRef.current = AMap;
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    if (mapInstanceRef.current) {
      mapInstanceRef.current.destroy();
      mapInstanceRef.current = null;
    }

    const map = new AMap.Map(mapRef.current, {
      center: [route[0].lng, route[0].lat],
      zoom: 13,
    });
    mapInstanceRef.current = map;

    const hasOrigin = origin != null;
    const hasDest = destination != null;

    route.forEach((place, index) => {
      const isFirst = index === 0 && hasOrigin;
      const isLast = index === route.length - 1 && hasDest;
      const label = isFirst ? '起' : isLast ? '终' : String(hasOrigin ? index : index + 1);
      const bg = isFirst ? '#22C55E' : isLast ? '#EF4444' : '#3B82F6';

      const marker = new AMap.Marker({
        position: [place.lng, place.lat],
        title: place.name,
        label: {
          content: `<div style="background:${bg};color:white;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">${label}</div>`,
          offset: new AMap.Pixel(-13, -13),
        },
      });
      marker.setMap(map);
      markersRef.current.push(marker);
    });

    map.setFitView();

    // 周边景点
    const allNearbyMap = new Map<string, any>();
    for (const p of route) {
      const results = await getNearbyPlaces(p.lat, p.lng);
      for (const poi of results) {
        if (!allNearbyMap.has(poi.id)) {
          allNearbyMap.set(poi.id, poi);
        }
      }
    }
    const allNearby = Array.from(allNearbyMap.values());
    allNearby.sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
    setNearby(allNearby.slice(0, 50));

    drawRoutes(route, 'straight');
  }

  async function drawRoutes(order: Place[], mode: TransportMode) {
    const map = mapInstanceRef.current;
    if (!map || order.length < 2) return;

    setIsRouting(true);
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    const AMap = amapRef.current || await loadAMap();
    const segments = await planAllSegments(order, mode);
    setRouteSegments(segments);

    const color = MODE_COLORS[mode];
    for (const seg of segments) {
      const poly = new AMap.Polyline({
        path: seg.path,
        strokeColor: color,
        strokeWeight: seg.fallback ? 3 : 5,
        strokeOpacity: 0.85,
        strokeStyle: seg.fallback ? 'dashed' : 'solid',
        lineJoin: 'round',
        lineCap: 'round',
      });
      poly.setMap(map);
      polylinesRef.current.push(poly);
    }

    setIsRouting(false);
  }

  if (places.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-2xl text-gray-400 border border-dashed border-gray-200">
        <MapPin size={40} className="mb-3 opacity-20" />
        <p className="text-sm">请先添加目的地</p>
      </div>
    );
  }

  const totalDist = routeSegments.reduce((s, seg) => s + seg.distance, 0);
  const totalTime = routeSegments.reduce((s, seg) => s + seg.duration, 0);

  return (
    <div className="space-y-5">
      {/* 交通模式切换 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1.5">
          <button
            onClick={() => setTransportMode('straight')}
            disabled={isRouting}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              transportMode === 'straight'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            } ${isRouting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Route size={15} />
            直线
          </button>
          <button
            onClick={() => setTransportMode('driving')}
            disabled={isRouting}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              transportMode === 'driving'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            } ${isRouting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Car size={15} />
            驾车
          </button>
          <button
            onClick={() => setTransportMode('cycling')}
            disabled={isRouting}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              transportMode === 'cycling'
                ? 'bg-white text-amber-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            } ${isRouting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Bike size={15} />
            骑行
          </button>
        </div>
        {isRouting && (
          <span className="text-xs text-gray-400 animate-pulse">计算路线中...</span>
        )}
      </div>

      {/* 地图 */}
      <div ref={mapRef} className="w-full h-80 rounded-2xl shadow-md overflow-hidden border border-gray-100" />

      {/* 旅程卡片：目的地 + 路线连接 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
          <MapPin size={18} className="text-blue-500" />
          旅程路线
        </h3>
        <div className="space-y-0">
          {optimized.map((p, i) => {
            const isOrigin = origin != null && i === 0;
            const isDest = destination != null && i === optimized.length - 1;
            let badge: string;
            let badgeGradient: string;
            if (isOrigin) {
              badge = '起';
              badgeGradient = 'from-green-500 to-green-600';
            } else if (isDest) {
              badge = '终';
              badgeGradient = 'from-red-500 to-red-600';
            } else {
              const idx = origin != null ? i : i + 1;
              badge = String(idx);
              badgeGradient = CARD_GRADIENTS[(i - (origin != null ? 1 : 0)) % CARD_GRADIENTS.length];
            }

            return (
            <div key={p.id}>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <span className={`w-9 h-9 bg-gradient-to-br ${badgeGradient} text-white rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm`}>
                    {badge}
                  </span>
                  {i < optimized.length - 1 && (
                    <div className="w-0.5 h-8 bg-gray-200 my-1 rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <p className={`font-semibold text-sm ${isOrigin ? 'text-green-700' : isDest ? 'text-red-700' : 'text-gray-800'}`}>{p.name}</p>
                  {p.address && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{p.address}</p>
                  )}
                  {i < optimized.length - 1 && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Route size={12} />
                        {haversineDistance(p, optimized[i + 1]).toFixed(1)} km
                      </span>
                      {routeSegments[i] && routeSegments[i].duration > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {Math.round(routeSegments[i].duration / 60)}分钟
                        </span>
                      )}
                      <ChevronRight size={14} className="text-gray-300" />
                      <span className="font-medium text-gray-500 truncate">{optimized[i + 1].name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {routeSegments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {transportMode === 'driving' ? '🚗 驾车' : transportMode === 'cycling' ? '🚴 骑行' : '📏 直线'}
            </span>
            <span className="font-semibold text-gray-700">
              总计 {(totalDist / 1000).toFixed(1)} km
              {transportMode !== 'straight' && totalTime > 0 &&
                ` · 约${Math.round(totalTime / 60)}分钟`}
            </span>
          </div>
        )}
      </div>

      {/* 周边景点 */}
      {nearbyAttractions.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-lg">🏞️</span>
            周边景点
            <span className="text-xs text-gray-400 font-normal ml-1">{nearbyAttractions.length}个</span>
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {nearbyAttractions.map((poi, i) => (
              <PoiCard key={poi.id || i} poi={poi} />
            ))}
          </div>
        </div>
      )}

      {/* 周边美食 */}
      {nearbyFood.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-lg">🍜</span>
            周边美食
            <span className="text-xs text-gray-400 font-normal ml-1">{nearbyFood.length}个</span>
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {nearbyFood.map((poi, i) => (
              <PoiCard key={poi.id || i} poi={poi} />
            ))}
          </div>
        </div>
      )}

      {/* 路线详情时间线 */}
      {routeSegments.length > 0 && (transportMode === 'driving' || transportMode === 'cycling') && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-gray-500" />
            路线详情
          </h3>
          <div className="relative">
            {routeSegments.map((seg, i) => (
              <div key={i} className="flex gap-3 mb-3 last:mb-0">
                <div className="flex flex-col items-center">
                  <div
                    className="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0"
                    style={{ borderColor: MODE_COLORS[transportMode], backgroundColor: seg.fallback ? 'transparent' : MODE_COLORS[transportMode] }}
                  />
                  {i < routeSegments.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gray-200 my-0.5 min-h-[20px]" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-xs text-gray-400">
                    第{i + 1}段
                    {seg.fallback && <span className="text-amber-500 ml-1">(无路线数据)</span>}
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    {optimized[i]?.name ?? '?'} → {optimized[i + 1]?.name ?? '?'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(seg.distance / 1000).toFixed(1)} km
                    {seg.duration > 0 && ` · ${Math.round(seg.duration / 60)}分钟`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
