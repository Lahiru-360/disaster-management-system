import MapView from '../ui/MapView';

// Step 2's Live Operations Map. The combined picture carries no coordinates
// for the incident itself or for relief supplies (recentDistributions name a
// shelter and an organisation, not a point), so the map plots shelters and
// rescue teams only - logged as a design decision for DMS-116.
const SHELTER_TONES = {
  AVAILABLE: 'success',
  FILLING_UP: 'warning',
  NEAR_CAPACITY: 'warning',
  FULL: 'danger',
};

const TEAM_TONES = {
  AVAILABLE: 'success',
  DISPATCHED: 'info',
  ON_SITE: 'info',
  UNAVAILABLE: 'neutral',
};

const LEGEND = [
  { type: 'shelter', tone: 'success', label: 'Shelter' },
  { type: 'team', tone: 'info', label: 'Rescue team' },
];

const LEGEND_DOT_FILL = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-navy',
  neutral: 'bg-muted',
};

export default function LiveOpsMap({ shelters, teams }) {
  const markers = [
    ...shelters.map((shelter) => ({
      id: `shelter-${shelter.id}`,
      lat: shelter.location.lat,
      lng: shelter.location.lng,
      type: 'shelter',
      tone: SHELTER_TONES[shelter.status],
      label: `${shelter.name} – ${shelter.status.replace('_', ' ').toLowerCase()}`,
    })),
    ...teams.map((team) => ({
      id: `team-${team.id}`,
      lat: team.currentLocation.lat,
      lng: team.currentLocation.lng,
      type: 'team',
      tone: TEAM_TONES[team.status],
      label: `${team.name} (${team.organisation.name}) – ${team.status.toLowerCase()}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <MapView markers={markers} label="Live operations map" className="h-48 flex-1" />
      <ul className="flex gap-4 text-[13px] text-ink md:flex-col md:gap-3">
        {LEGEND.map((entry) => (
          <li key={entry.type} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={['h-3 w-3 rounded-full', LEGEND_DOT_FILL[entry.tone]].join(' ')}
            />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
