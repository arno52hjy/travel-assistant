import { useState, useRef, useEffect } from 'react';
import { geocodeAddress, searchPlaces } from '../services/maps';
import type { PlaceSuggestion } from '../services/maps';
import type { Place } from '../utils/tsp';
import { MapPin, Plus, X, Search, Navigation, Flag, Pin } from 'lucide-react';

const CARD_GRADIENTS = [
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-violet-400 to-violet-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-cyan-400 to-cyan-600',
];

interface PlaceSearchProps {
  places: Place[];
  origin: Place | null;
  destination: Place | null;
  onAdd: (place: Place) => void;
  onRemove: (id: string) => void;
  onSetOrigin: (place: Place | null) => void;
  onSetDestination: (place: Place | null) => void;
}

export default function PlaceSearch({ places, origin, destination, onAdd, onRemove, onSetOrigin, onSetDestination }: PlaceSearchProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState<'waypoint' | 'origin' | 'destination'>('waypoint');
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(input.trim());
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectPlace(suggestion: PlaceSuggestion) {
    const newPlace: Place = {
      id: Date.now().toString(),
      name: suggestion.name,
      lat: suggestion.lat,
      lng: suggestion.lng,
      address: suggestion.address,
    };

    if (activeEndpoint === 'origin') {
      onSetOrigin(newPlace);
    } else if (activeEndpoint === 'destination') {
      onSetDestination(newPlace);
    } else {
      onAdd(newPlace);
    }
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveEndpoint('waypoint');
  }

  async function handleAdd() {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setShowSuggestions(false);

    if (suggestions.length > 0) {
      selectPlace(suggestions[0]);
      setLoading(false);
      return;
    }

    const coords = await geocodeAddress(input.trim());
    if (!coords) {
      setError('找不到该地址，请尝试更具体的地名');
      setLoading(false);
      return;
    }

    const newPlace: Place = {
      id: Date.now().toString(),
      name: input.trim(),
      lat: coords.lat,
      lng: coords.lng,
    };

    if (activeEndpoint === 'origin') {
      onSetOrigin(newPlace);
    } else if (activeEndpoint === 'destination') {
      onSetDestination(newPlace);
    } else {
      onAdd(newPlace);
    }
    setInput('');
    setLoading(false);
    setActiveEndpoint('waypoint');
  }

  function clearEndpoint(type: 'origin' | 'destination') {
    if (type === 'origin') onSetOrigin(null);
    else onSetDestination(null);
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
      <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <MapPin className="text-blue-500" size={18} />
        </div>
        添加目的地
      </h2>

      {/* 起点（可选） */}
      <div className="border border-dashed border-gray-200 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <Flag size={12} className="text-green-500" />
          起点（可选）
        </p>
        {origin ? (
          <div className="flex items-center gap-3 bg-gradient-to-r from-green-50 to-white rounded-xl px-4 py-3 border border-green-200 group">
            <span className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 text-white rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">起</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-gray-800 truncate">{origin.name}</p>
              {origin.address && <p className="text-xs text-gray-400 truncate">{origin.address}</p>}
            </div>
            <button onClick={() => clearEndpoint('origin')} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setInput(''); setActiveEndpoint('origin'); }}
            className="w-full text-left text-sm text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg px-3 py-2 transition-colors"
          >
            + 设置出发地
          </button>
        )}
      </div>

      {/* 已添加的途经点 */}
      {places.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            途经点 · {places.length} 个
          </p>
          {places.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white rounded-xl px-4 py-3 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group"
            >
              <span className={`w-8 h-8 bg-gradient-to-br ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]} text-white rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm`}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-gray-800 truncate">{p.name}</p>
                {p.address && <p className="text-xs text-gray-400 truncate">{p.address}</p>}
              </div>
              <button onClick={() => onRemove(p.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 终点（可选） */}
      <div className="border border-dashed border-gray-200 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <Pin size={12} className="text-red-500" />
          终点（可选）
        </p>
        {destination ? (
          <div className="flex items-center gap-3 bg-gradient-to-r from-red-50 to-white rounded-xl px-4 py-3 border border-red-200 group">
            <span className="w-8 h-8 bg-gradient-to-br from-red-400 to-red-600 text-white rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">终</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-gray-800 truncate">{destination.name}</p>
              {destination.address && <p className="text-xs text-gray-400 truncate">{destination.address}</p>}
            </div>
            <button onClick={() => clearEndpoint('destination')} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setInput(''); setActiveEndpoint('destination'); }}
            className="w-full text-left text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors"
          >
            + 设置目的地
          </button>
        )}
      </div>

      {/* 搜索输入框 */}
      <div ref={containerRef} className="relative">
        {activeEndpoint !== 'waypoint' && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              activeEndpoint === 'origin' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              正在设置{activeEndpoint === 'origin' ? '起点' : '终点'}
            </span>
            <button onClick={() => setActiveEndpoint('waypoint')} className="text-xs text-gray-400 hover:text-gray-600">
              取消
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-shadow"
              placeholder={
                activeEndpoint === 'origin' ? '搜索起点...' :
                activeEndpoint === 'destination' ? '搜索终点...' :
                '输入地名搜索，如：温州南、西湖...'
              }
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-xl flex items-center gap-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Plus size={16} />
            {loading ? '搜索中...' : '添加'}
          </button>
        </div>

        {showSuggestions && (
          <div className="absolute left-0 right-20 top-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => selectPlace(s)}
                className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Navigation size={14} className="text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                  {s.address && <p className="text-xs text-gray-400 truncate">{s.address}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
