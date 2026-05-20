'use client';
/**
 * SearchBox -- adresse autocomplete via Mapbox Geocoding API
 * Reference: task-1.4.10 Sprint 4 Phase 1
 * Note: utilise l'API directe (pas @mapbox/mapbox-gl-geocoder) pour meilleur support TypeScript.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface SearchBoxResult {
  placeName: string;
  coordinates: [number, number];
  raw: Record<string, unknown>;
}

export interface SearchBoxProps {
  country?: string | undefined;
  language?: 'fr' | 'ar' | 'en' | undefined;
  placeholder?: string | undefined;
  onResult?: ((result: SearchBoxResult) => void) | undefined;
  onClear?: (() => void) | undefined;
  limit?: number | undefined;
  className?: string | undefined;
}

const PLACEHOLDERS: Record<string, string> = {
  fr: 'Rechercher une adresse au Maroc',
  ar: 'ابحث عن عنوان في المغرب',
  en: 'Search address in Morocco',
};

const DEBOUNCE_MS = 300;

/**
 * Boite de recherche d'adresse avec autocompletion Mapbox Geocoding API.
 * Contraint au Maroc (country=ma) par defaut.
 */
export function SearchBox({
  country = 'ma',
  language = 'fr',
  placeholder,
  onResult,
  onClear,
  limit = 5,
  className,
}: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchBoxResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = typeof process !== 'undefined' ? process.env['NEXT_PUBLIC_MAPBOX_TOKEN'] : undefined;

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (!q || q.length < 2 || !token) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&country=${country}&language=${language}&limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = (await res.json()) as { features?: Array<{ place_name: string; center: [number, number] }> };
        setSuggestions(
          (data.features ?? []).map((f) => ({
            placeName: f.place_name,
            coordinates: f.center,
            raw: f as Record<string, unknown>,
          })),
        );
      } finally {
        setLoading(false);
      }
    },
    [country, language, limit, token],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSuggestions]);

  const handleSelect = (result: SearchBoxResult) => {
    setQuery(result.placeName);
    setSuggestions([]);
    onResult?.(result);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    onClear?.();
  };

  return (
    <div className={`relative ${className ?? ''}`} data-testid="search-box">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? PLACEHOLDERS[language] ?? PLACEHOLDERS['fr']}
        aria-label={placeholder ?? PLACEHOLDERS[language]}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        data-testid="search-box-input"
      />
      {query.length > 0 && (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          x
        </button>
      )}
      {loading && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-md border bg-white p-2 text-xs text-gray-500 shadow">
          Chargement...
        </div>
      )}
      {!loading && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-white shadow-lg"
          data-testid="search-suggestions"
        >
          {suggestions.map((s, i) => (
            <li key={i} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => handleSelect(s)}
              >
                {s.placeName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
