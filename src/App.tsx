import { useState } from 'react';
import type { Place } from './utils/tsp';
import PlaceSearch from './components/PlaceSearch';
import MapView from './components/MapView';
import { MapPin } from 'lucide-react';

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);

  function handleAdd(place: Place) {
    setPlaces(prev => [...prev, place]);
  }

  function handleRemove(id: string) {
    setPlaces(prev => prev.filter(p => p.id !== id));
  }

  const hasAnyPlace = places.length > 0 || origin != null || destination != null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部标题栏 */}
      <header className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 shadow-md py-5 px-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <MapPin className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide">旅行助手</h1>
          <p className="text-xs text-blue-100">多地点路线规划 · 周边景点美食推荐</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <PlaceSearch
          places={places}
          origin={origin}
          destination={destination}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onSetOrigin={setOrigin}
          onSetDestination={setDestination}
        />

        {hasAnyPlace && (
          <MapView
            places={places}
            origin={origin}
            destination={destination}
          />
        )}

        {!hasAnyPlace && (
          <div className="text-center py-20 text-gray-400">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MapPin size={36} className="text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-500">添加至少一个目的地开始规划</p>
            <p className="text-sm mt-1.5 text-gray-400">例如：故宫、西湖、外滩、洪崖洞</p>
          </div>
        )}
      </main>
    </div>
  );
}
