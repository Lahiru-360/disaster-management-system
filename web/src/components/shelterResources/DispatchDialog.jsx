import { useEffect, useId, useRef, useState } from 'react';

import { coordinationApi } from '../../api';
import { apiErrorMessage } from '../../utils/apiErrors';
import { DEFAULT_PRIORITY, PRIORITIES } from '../../utils/dispatchPriority';
import Button from '../ui/Button';
import Loader from '../ui/Loader';
import MapView from '../ui/MapView';
import Modal from '../ui/Modal';
import Notice from '../ui/Notice';
import Select from '../ui/Select';
import TextInput from '../ui/TextInput';

// What the server uses unless DISPATCH_ACK_TIMEOUT_MINUTES says otherwise
// (§13.7.1). Only the text before dispatching; the deadline shown after it is
// worked out from the dispatch the server returned.
const DEFAULT_ACK_MINUTES = 5;

const MAP_ZOOM = 11;

const minutesBetween = (fromIso, toIso) =>
  Math.round((new Date(toIso) - new Date(fromIso)) / 60000);

// UC03 steps 6-9 (§5.1): the officer describes the incident and pins it on the
// map, sets its priority, sees the AVAILABLE teams nearest the pin with their
// owning organisation ("Team Alpha · 2.5 km · SL Army"), and dispatches one.
// The nearest team is selected first. The server settles the race for a team
// another officer took (409 TEAM_NOT_AVAILABLE): its message shows, the list is
// read again without that team, and nothing was dispatched. Once sent, the
// dialog confirms the deadline; `onDispatched` receives the server's
// `{ dispatch }` when it is closed. Mounted only while open, so each opening
// starts fresh.
//
// A3.3 (DMS-146): `initial` reopens it for a declined dispatch - `{
// incidentLocation, priority, excludeTeamIds }` - with the same location and
// priority filled in, the teams already listed for that point and the
// declined team left out of every list.
export default function DispatchDialog({ mapCenter, initial, onClose, onDispatched }) {
  const titleId = useId();
  const teamsRequest = useRef(0);

  const excludeTeamIds = initial?.excludeTeamIds ?? [];
  const [placeLabel, setPlaceLabel] = useState(initial?.incidentLocation?.label ?? '');
  const [mapOpen, setMapOpen] = useState(false);
  const [picked, setPicked] = useState(
    initial ? { lat: initial.incidentLocation.lat, lng: initial.incidentLocation.lng } : null,
  );
  const [priority, setPriority] = useState(initial?.priority ?? DEFAULT_PRIORITY);

  // null until a point is picked; then the AVAILABLE teams, nearest first.
  const [teams, setTeams] = useState(null);
  const [teamsLoading, setTeamsLoading] = useState(Boolean(initial));
  const [teamsError, setTeamsError] = useState(null);
  const [teamId, setTeamId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  // Asks for the teams at a point. Only the latest request counts, so a slow
  // answer for an earlier pin can't replace the list for the current one.
  const requestTeams = (point) => {
    const request = (teamsRequest.current += 1);
    return coordinationApi.listAvailableTeams({ ...point, excludeTeamIds }).then(
      (list) => {
        if (request !== teamsRequest.current) return;
        setTeams(list);
        setTeamId(list[0]?.id ?? '');
        setTeamsLoading(false);
      },
      (failure) => {
        if (request !== teamsRequest.current) return;
        setTeamsError(apiErrorMessage(failure, 'The available teams could not be loaded.'));
        setTeamsLoading(false);
      },
    );
  };

  // Shows the loading state, then the teams for the point.
  const loadTeams = (point) => {
    setTeamsLoading(true);
    setTeamsError(null);
    return requestTeams(point);
  };

  // Reopened for a declined dispatch: list the teams for its point straight
  // away (the loading state is already on, from the first render).
  useEffect(() => {
    if (initial) requestTeams(initial.incidentLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on opening
  }, []);

  const handlePick = (lat, lng) => {
    setPicked({ lat, lng });
    setError(null);
    loadTeams({ lat, lng });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !picked || !teamId) return;
    setSubmitting(true);
    setError(null);
    try {
      const label = placeLabel.trim();
      const result = await coordinationApi.dispatchTeam({
        teamId,
        incidentLocation: { ...picked, ...(label ? { label } : {}) },
        priority,
      });
      setSent(result);
    } catch (failure) {
      setError(apiErrorMessage(failure, 'The team could not be dispatched. Try again.'));
      setSubmitting(false);
      // Another officer may have taken the team: show who is still available.
      if (failure?.response?.status === 409) loadTeams(picked);
    }
  };

  if (sent) {
    const { dispatch } = sent;
    const minutes = minutesBetween(dispatch.createdAt, dispatch.ackDeadline);
    return (
      <Modal open onClose={() => onDispatched(sent)} labelledBy={titleId}>
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          Team dispatched
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-muted">
          <strong className="text-ink">{dispatch.team.name}</strong> (
          {dispatch.team.organisation.name}) has been sent to{' '}
          <strong className="text-ink">
            {dispatch.incidentLocation.label ?? 'the pinned location'}
          </strong>{' '}
          with {dispatch.priority.toLowerCase()} priority.
        </p>
        <p className="mt-3 text-[13px] font-semibold text-ink">
          Acknowledgement deadline: {minutes} min
        </p>
        <div className="mt-6 flex justify-end">
          <Button fullWidth={false} onClick={() => onDispatched(sent)}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  const canDispatch = Boolean(picked && teamId);

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={!submitting}
      labelledBy={titleId}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} noValidate>
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          Dispatch Rescue Team
        </h2>

        <div className="mt-4">
          <TextInput
            label="Incident location"
            placeholder="e.g. Biyagama – flooded road"
            value={placeLabel}
            onChange={(event) => setPlaceLabel(event.target.value)}
            disabled={submitting}
            containerClassName="mb-2"
          />
          <div className="mb-4 flex items-center gap-3">
            <Button
              variant="small"
              fullWidth={false}
              onClick={() => setMapOpen((open) => !open)}
              disabled={submitting}
            >
              {mapOpen ? 'Hide map' : 'Pin on map'}
            </Button>
            <span className="text-[13px] text-muted" aria-live="polite">
              {picked
                ? `Pinned at ${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`
                : 'No point pinned yet'}
            </span>
          </div>

          {mapOpen ? (
            <MapView
              label="Pick the incident location"
              center={mapCenter}
              zoom={mapCenter ? MAP_ZOOM : undefined}
              onPick={handlePick}
              picked={picked}
              className="mb-4 h-64"
            />
          ) : null}

          <Select
            label="Priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            disabled={submitting}
            options={PRIORITIES}
          />
        </div>

        <fieldset className="mt-1" disabled={submitting}>
          <legend className="mb-1.5 text-[13px] font-semibold text-ink">Available teams</legend>
          {teamsLoading ? (
            <Loader />
          ) : teamsError ? (
            <Notice variant="error">{teamsError}</Notice>
          ) : !teams ? (
            <p className="text-[13px] text-muted">Pin the incident on the map to see the teams.</p>
          ) : teams.length === 0 ? (
            <Notice>No team available.</Notice>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {teams.map((team) => (
                <li key={team.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3.5 py-3 text-[15px] text-ink hover:bg-haze">
                    <input
                      type="radio"
                      name="team"
                      value={team.id}
                      checked={teamId === team.id}
                      onChange={() => setTeamId(team.id)}
                      className="h-4 w-4 accent-navy"
                    />
                    <span>
                      {team.name} · {team.distanceKm} km · {team.organisation.name}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <p className="mt-4 text-[13px] font-semibold text-ink">
          Acknowledgement deadline: {DEFAULT_ACK_MINUTES} min
        </p>

        {error ? (
          <Notice variant="error" className="mt-3">
            {error}
          </Notice>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" fullWidth={false} onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" fullWidth={false} loading={submitting} disabled={!canDispatch}>
            Dispatch
          </Button>
        </div>
      </form>
    </Modal>
  );
}
