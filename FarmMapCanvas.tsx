/// <reference types="google.maps" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { GeoPoint } from '../types/fieldshift';
import { isValidCoordinate } from '../lib/geo';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents, useMap as useLeafletMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';

interface FarmMapCanvasProps {
  apiKey: string;
  center: GeoPoint | null;
  boundary: GeoPoint[];
  interactionMode: 'point' | 'polygon';
  onSetPoint: (pt: GeoPoint) => void;
  onUpdateBoundary: (pts: GeoPoint[]) => void;
  language: 'en' | 'ar';
}

function MapInner({
  center,
  boundary,
  interactionMode,
  onSetPoint,
  onUpdateBoundary,
}: Omit<FarmMapCanvasProps, 'apiKey' | 'language'>) {
  const map = useMap();
  const status = useApiLoadingStatus();
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const lastCenterRef = useRef<string>('');
  const latestRef = useRef({ interactionMode, boundary, onSetPoint, onUpdateBoundary });
  latestRef.current = { interactionMode, boundary, onSetPoint, onUpdateBoundary };

  // Pan map when center changes externally (e.g., search or GPS)
  useEffect(() => {
    if (!map || !center) return;
    const key = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
    if (key !== lastCenterRef.current) {
      lastCenterRef.current = key;
      map.panTo(center);
      if ((map.getZoom() ?? 4) < 13) {
        map.setZoom(15);
      }
    }
  }, [map, center]);

  // Render polygon overlay declaratively via Google Maps Polygon instance
  useEffect(() => {
    if (!map) return;
    if (!polygonRef.current) {
      polygonRef.current = new google.maps.Polygon({
        map,
        paths: boundary,
        strokeColor: '#1769E0',
        strokeOpacity: 0.95,
        strokeWeight: 2.5,
        fillColor: '#1769E0',
        fillOpacity: 0.22,
        clickable: false,
      });
    } else {
      polygonRef.current.setPath(boundary);
      polygonRef.current.setMap(boundary.length > 0 ? map : null);
    }
  }, [map, boundary]);

  useEffect(() => {
    return () => {
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
    };
  }, []);

  // Attach map click listener once using refs so rapid clicks never miss
  useEffect(() => {
    if (!map) return;
    map.setOptions({
      draggableCursor: 'crosshair',
    });
    const listener = map.addListener('click', (ev: google.maps.MapMouseEvent) => {
      if (!ev.latLng) return;
      const pt = {
        lat: Number(ev.latLng.lat().toFixed(6)),
        lng: Number(ev.latLng.lng().toFixed(6)),
      };
      const cur = latestRef.current;
      if (cur.interactionMode === 'point') {
        cur.onSetPoint(pt);
      } else {
        cur.onUpdateBoundary([...cur.boundary, pt]);
      }
    });
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map]);

  if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#F7FAFE] p-6 text-center text-xs text-[#66758A]">
        Unable to load interactive Google Map. You can still search or enter coordinates below.
      </div>
    );
  }

  return (
    <>
      {center && (
        <AdvancedMarker position={center} title="Farm location">
          <Pin background="#1769E0" borderColor="#0B2A5B" glyphColor="#FFFFFF" />
        </AdvancedMarker>
      )}
      {boundary.map((pt, idx) => (
        <AdvancedMarker key={`${idx}-${pt.lat}-${pt.lng}`} position={pt}>
          <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-[#1769E0] shadow pointer-events-none" />
        </AdvancedMarker>
      ))}
    </>
  );
}

export function PlacesSearchInput({
  apiKey,
  onSelectPlace,
  placeholder,
}: {
  apiKey: string;
  onSelectPlace: (loc: { lat: number; lng: number; label: string }) => void;
  placeholder: string;
}) {
  const [queryText, setQueryText] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sdkSuggestions, setSdkSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const suppressFetchRef = useRef(false);

  const handleFallbackSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = queryText.trim();
    if (!trimmed) return;
    setDropdownOpen(false);
    setSdkSuggestions([]);
    suppressFetchRef.current = true;

    const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lng = Number(coordMatch[2]);
      if (isValidCoordinate(lat, lng)) {
        setError(null);
        onSelectPlace({
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        });
        return;
      }
    }

    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.quotaExceeded) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        throw new Error(data.error || 'Location not found');
      }
      onSelectPlace({
        lat: data.lat,
        lng: data.lng,
        label: data.formattedAddress || trimmed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <form onSubmit={handleFallbackSearch} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={queryText}
            onChange={(e) => {
              suppressFetchRef.current = false;
              setQueryText(e.target.value);
              setDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDropdownOpen(false);
                setSdkSuggestions([]);
              }
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full rounded-xl border border-[#DCE7F5] bg-white px-3.5 py-2.5 text-sm text-[#12233F] placeholder:text-[#66758A] focus:outline-none focus:border-[#1769E0]"
          />
          {apiKey && dropdownOpen && !suppressFetchRef.current && (
            <PlacesSdkListener
              input={queryText}
              onSuggestions={setSdkSuggestions}
              onSelectPlace={(loc) => {
                suppressFetchRef.current = true;
                setDropdownOpen(false);
                setSdkSuggestions([]);
                setQueryText(loc.label);
                onSelectPlace(loc);
              }}
              suggestions={sdkSuggestions}
            />
          )}
        </div>
        <button
          type="submit"
          disabled={searching || !queryText.trim()}
          className="px-4 py-2.5 rounded-xl bg-[#0B2A5B] text-white text-xs font-semibold hover:bg-[#1769E0] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {searching ? '...' : 'Locate'}
        </button>
      </form>
      {error && <p className="text-xs text-[#E45C67]">{error}</p>}
    </div>
  );
}

function PlacesSdkListener({
  input,
  onSuggestions,
  suggestions,
  onSelectPlace,
}: {
  input: string;
  onSuggestions: (s: google.maps.places.AutocompleteSuggestion[]) => void;
  suggestions: google.maps.places.AutocompleteSuggestion[];
  onSelectPlace: (loc: { lat: number; lng: number; label: string }) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!placesLib || input.trim().length < 3) {
      onSuggestions([]);
      return;
    }
    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!tokenRef.current) {
      tokenRef.current = new AutocompleteSessionToken();
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: input.trim(),
        sessionToken: tokenRef.current!,
      })
        .then((res) => {
          if (!cancelled) onSuggestions(res.suggestions.slice(0, 5));
        })
        .catch(() => {
          if (!cancelled) onSuggestions([]);
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, input, onSuggestions]);

  const handlePick = useCallback(
    async (s: google.maps.places.AutocompleteSuggestion) => {
      if (!s.placePrediction) return;
      try {
        const place = s.placePrediction.toPlace();
        await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
        if (place.location) {
          onSelectPlace({
            lat: Number(place.location.lat().toFixed(6)),
            lng: Number(place.location.lng().toFixed(6)),
            label: place.formattedAddress || place.displayName || s.placePrediction.text.text,
          });
        }
        tokenRef.current = null;
      } catch {
        onSuggestions([]);
      }
    },
    [onSelectPlace, onSuggestions]
  );

  if (suggestions.length === 0) return null;

  return (
    <ul className="absolute z-20 mt-1 w-full bg-white border border-[#DCE7F5] rounded-xl shadow-lg max-h-52 overflow-y-auto">
      {suggestions.map((s, idx) => (
        <li key={idx}>
          <button
            type="button"
            onClick={() => handlePick(s)}
            className="w-full text-start px-3.5 py-2.5 text-xs text-[#12233F] hover:bg-[#EAF3FF] border-b last:border-b-0 border-[#DCE7F5]/60 cursor-pointer"
          >
            {s.placePrediction?.text.text}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Leaflet default pin icon fix for bundlers
const defaultLeafletIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function LeafletMapEvents({
  interactionMode,
  boundary,
  onSetPoint,
  onUpdateBoundary,
}: {
  interactionMode: 'point' | 'polygon';
  boundary: GeoPoint[];
  onSetPoint: (pt: GeoPoint) => void;
  onUpdateBoundary: (pts: GeoPoint[]) => void;
}) {
  useMapEvents({
    click(e) {
      const pt = { lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) };
      if (interactionMode === 'point') {
        onSetPoint(pt);
      } else {
        onUpdateBoundary([...boundary, pt]);
      }
    },
  });
  return null;
}

function LeafletMapSync({ center }: { center: GeoPoint | null }) {
  const map = useLeafletMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), 14));
    }
  }, [center, map]);
  return null;
}

function FreeOpenStreetMap({
  center,
  boundary,
  interactionMode,
  onSetPoint,
  onUpdateBoundary,
  language,
}: {
  center: GeoPoint | null;
  boundary: GeoPoint[];
  interactionMode: 'point' | 'polygon';
  onSetPoint: (pt: GeoPoint) => void;
  onUpdateBoundary: (pts: GeoPoint[]) => void;
  language: 'en' | 'ar';
}) {
  const defaultPos: [number, number] = center ? [center.lat, center.lng] : [30.0444, 31.2357];
  const isAr = language === 'ar';

  return (
    <div className="relative h-[360px] sm:h-[400px] w-full rounded-2xl overflow-hidden border border-[#DCE7F5] z-0">
      <MapContainer
        center={defaultPos}
        zoom={center ? 14 : 6}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LeafletMapSync center={center} />
        <LeafletMapEvents
          interactionMode={interactionMode}
          boundary={boundary}
          onSetPoint={onSetPoint}
          onUpdateBoundary={onUpdateBoundary}
        />
        {center && (
          <Marker position={[center.lat, center.lng]} icon={defaultLeafletIcon} />
        )}
        {boundary.length > 0 && (
          <Polygon
            positions={boundary.map((p) => [p.lat, p.lng] as LatLngExpression)}
            pathOptions={{ color: '#1769E0', fillColor: '#1769E0', fillOpacity: 0.25, weight: 2.5 }}
          />
        )}
      </MapContainer>
      <div className="absolute bottom-2 start-2 z-[400] bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#DCE7F5] text-[11px] font-medium text-[#0B2A5B] shadow-sm">
        {isAr ? 'خريطة تفاعلية (انقر على الخريطة لتحديد موقع الحقل)' : 'Interactive Map (Click to pinpoint or draw)'}
      </div>
    </div>
  );
}

export function FarmMapCanvas({
  apiKey,
  center,
  boundary,
  interactionMode,
  onSetPoint,
  onUpdateBoundary,
  language,
  searchPlaceholder,
  onSelectSearchPlace,
}: FarmMapCanvasProps & {
  searchPlaceholder: string;
  onSelectSearchPlace: (loc: { lat: number; lng: number; label: string }) => void;
}) {
  const defaultCenter = center || { lat: 30.0444, lng: 31.2357 };
  const defaultZoom = center ? 14 : 3;

  if (!apiKey) {
    return (
      <div className="space-y-3">
        <PlacesSearchInput
          apiKey=""
          onSelectPlace={onSelectSearchPlace}
          placeholder={searchPlaceholder}
        />
        <FreeOpenStreetMap
          center={center}
          boundary={boundary}
          interactionMode={interactionMode}
          onSetPoint={onSetPoint}
          onUpdateBoundary={onUpdateBoundary}
          language={language}
        />
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} language={language} libraries={['places', 'marker', 'geometry']}>
      <div className="space-y-3">
        <PlacesSearchInput
          apiKey={apiKey}
          onSelectPlace={onSelectSearchPlace}
          placeholder={searchPlaceholder}
        />
        <div
          data-testid="farm-map-container"
          className="h-[360px] sm:h-[400px] w-full rounded-2xl overflow-hidden border border-[#DCE7F5] bg-[#EAF3FF]"
        >
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={defaultCenter}
            defaultZoom={defaultZoom}
            mapTypeId="hybrid"
            clickableIcons={false}
            gestureHandling="greedy"
            disableDoubleClickZoom={interactionMode === 'polygon'}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <MapInner
              center={center}
              boundary={boundary}
              interactionMode={interactionMode}
              onSetPoint={onSetPoint}
              onUpdateBoundary={onUpdateBoundary}
            />
          </GoogleMap>
        </div>
      </div>
    </APIProvider>
  );
}
