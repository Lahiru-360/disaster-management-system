import L from 'leaflet';
import { Crosshair, Flag, House, MapPin, TriangleAlert, Users } from 'lucide-react';
import { useId } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

// Roughly the middle of Sri Lanka, at a zoom that shows the whole island.
const SRI_LANKA = { lat: 7.8731, lng: 80.7718 };
const ISLAND_ZOOM = 7;

// The marker kinds the wireframes draw: a report pin (UC02), shelters, teams
// and the incident on the live map (UC03), and a picked point (pin-on-map).
const MARKER_TYPES = {
  report: { Icon: Flag, tone: 'warning' },
  shelter: { Icon: House, tone: 'success' },
  team: { Icon: Users, tone: 'info' },
  incident: { Icon: TriangleAlert, tone: 'danger' },
  pin: { Icon: MapPin, tone: 'info' },
};

// The same tones as StatusBadge, as solid fills so a marker reads on any tile.
const TONE_STYLES = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-navy',
  neutral: 'bg-muted',
};

// Leaflet draws markers outside React, so each icon is rendered to HTML once
// per type and tone and reused.
const iconCache = new Map();

function markerIcon(type, tone) {
  const kind = MARKER_TYPES[type] ?? MARKER_TYPES.pin;
  const fill = TONE_STYLES[tone ?? kind.tone] ?? TONE_STYLES.neutral;
  const key = `${type}:${fill}`;

  if (!iconCache.has(key)) {
    const { Icon } = kind;
    const html = renderToStaticMarkup(
      <span
        className={[
          'flex h-8 w-8 items-center justify-center rounded-full border-2 border-paper text-paper shadow-md',
          fill,
        ].join(' ')}
      >
        <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
      </span>,
    );
    iconCache.set(
      key,
      L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16] }),
    );
  }
  return iconCache.get(key);
}

// Click anywhere to pick that point. From the keyboard, the arrow keys pan the
// map under the crosshair and Enter or Space picks the point it marks.
function PickHandler({ onPick }) {
  const map = useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
    keydown: (event) => {
      const { key, target } = event.originalEvent;
      if (target !== map.getContainer() || (key !== 'Enter' && key !== ' ')) return;

      event.originalEvent.preventDefault();
      const centre = map.getCenter();
      onPick(centre.lat, centre.lng);
    },
  });
  return null;
}

/**
 * An OpenStreetMap map with typed markers and optional click-to-pin.
 * Presentational only: the caller owns the markers and the picked point.
 *
 * `markers`: [{ id, lat, lng, type, label, tone? }], where `type` is one of
 * report, shelter, team, incident or pin, and `tone` overrides the type's
 * colour (success, warning, danger, info, neutral). `label` is the marker's
 * accessible name. `onMarkerClick(marker)` fires on click or Enter.
 *
 * `onPick(lat, lng)` turns on picking; `picked` ({ lat, lng }) shows the
 * chosen point. `center` and `zoom` set the first view only, as in Leaflet.
 */
export default function MapView({
  markers = [],
  center = SRI_LANKA,
  zoom = ISLAND_ZOOM,
  onMarkerClick,
  onPick,
  picked,
  label = 'Map',
  className,
}) {
  const hintId = useId();

  return (
    <div
      role="region"
      aria-label={label}
      aria-describedby={onPick ? hintId : undefined}
      // isolate keeps Leaflet's own z-indexes inside the map, under Modal.
      className={['relative isolate h-80 overflow-hidden rounded-xl border border-line', className]
        .filter(Boolean)
        .join(' ')}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className={['h-full w-full', onPick ? 'cursor-crosshair' : ''].join(' ')}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={markerIcon(marker.type, marker.tone)}
            title={marker.label}
            alt={marker.label}
            eventHandlers={onMarkerClick ? { click: () => onMarkerClick(marker) } : undefined}
          />
        ))}
        {picked && (
          <Marker
            position={[picked.lat, picked.lng]}
            icon={markerIcon('pin')}
            title="Picked location"
            alt="Picked location"
          />
        )}
        {onPick && <PickHandler onPick={onPick} />}
      </MapContainer>

      {onPick && (
        <>
          <Crosshair
            size={24}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2 text-navy"
          />
          <p
            id={hintId}
            className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-md bg-paper/90 px-2 py-1 text-[12px] text-muted"
          >
            Click the map to pick a point, or move with the arrow keys and press Enter.
          </p>
        </>
      )}
    </div>
  );
}
