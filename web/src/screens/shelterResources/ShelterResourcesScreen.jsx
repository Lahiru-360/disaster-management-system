import { Building2, Package, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { areasApi, coordinationApi } from '../../api';
import DispatchDialog from '../../components/shelterResources/DispatchDialog';
import IncidentHeader from '../../components/shelterResources/IncidentHeader';
import LogReliefSupplyDialog from '../../components/shelterResources/LogReliefSupplyDialog';
import LiveOpsMap from '../../components/shelterResources/LiveOpsMap';
import OrganisationFilter from '../../components/shelterResources/OrganisationFilter';
import ReassignPrompt from '../../components/shelterResources/ReassignPrompt';
import RegisterShelterDialog from '../../components/shelterResources/RegisterShelterDialog';
import RescueTeamsTable from '../../components/shelterResources/RescueTeamsTable';
import ShelterStatusTable from '../../components/shelterResources/ShelterStatusTable';
import SummaryCards from '../../components/shelterResources/SummaryCards';
import SupplyLogTable from '../../components/shelterResources/SupplyLogTable';
import UnassignedIncidentsTable from '../../components/shelterResources/UnassignedIncidentsTable';
import UpdateOccupancyDialog from '../../components/shelterResources/UpdateOccupancyDialog';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import Select from '../../components/ui/Select';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import useUnansweredDispatches from '../../hooks/useUnansweredDispatches';

// A titled white panel holding one part of the dashboard (a table or the map).
function Panel({ title, action, children, className }) {
  return (
    <section
      className={['rounded-xl border border-line bg-paper p-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mb-2.5 flex min-h-9 items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold text-ink">{title}</h2>
        {action ?? null}
      </div>
      {children}
    </section>
  );
}

// The three big action buttons along the bottom of the dashboard.
const ACTION_STYLES = {
  navy: 'bg-navy text-paper hover:bg-navy-hi',
  success: 'bg-success-ink text-paper hover:opacity-90',
  outline: 'border border-line bg-navy-soft text-navy hover:bg-haze',
};

function ActionButton({ Icon, title, detail, tone, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex cursor-pointer items-center gap-3 rounded-xl px-5 py-2.5 text-left transition',
        'focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        ACTION_STYLES[tone],
      ].join(' ')}
    >
      <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
      <span>
        <span className="block text-[15px] font-bold">{title}</span>
        <span className="block text-[12px] opacity-80">{detail}</span>
      </span>
    </button>
  );
}

const errorMessage = (error, fallback) => error?.response?.data?.error?.message ?? fallback;

// UC03 main flow steps 1-2 and 14 (DMS-140): the Shelter & Resource
// Coordination dashboard. A district officer sees their own district; a DMC
// or duty officer picks one first, since the server requires it for them.
// The dashboard refetches whenever the district or the organisation filter
// changes, and again after the occupancy (DMS-141), dispatch (DMS-142) and
// supply (DMS-143) dialogs save, and after a shelter is registered (DMS-144).
// The unassigned incidents (E3, DMS-149) are read with it and again once an
// incident is queued or a team is assigned to one.
export default function ShelterResourcesScreen() {
  const { user } = useAuth();
  const isDmc = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(user?.role);
  const canCoordinate = isDmc || user?.role === ROLES.DISTRICT_OFFICER;

  const [districts, setDistricts] = useState(null);
  const [districtsError, setDistrictsError] = useState(null);
  const [districtId, setDistrictId] = useState(null);

  const [organisations, setOrganisations] = useState([]);
  const [organisationId, setOrganisationId] = useState(null);

  const [picture, setPicture] = useState(null);
  const [pictureError, setPictureError] = useState(null);

  // E3: the district's UNASSIGNED dispatches; null until the first answer.
  const [unassigned, setUnassigned] = useState(null);
  const [unassignedError, setUnassignedError] = useState(null);

  // The shelter whose row opened the Update Shelter Occupancy dialog (step 3).
  const [occupancyShelterId, setOccupancyShelterId] = useState(null);
  // Whether the Log Relief Supply dialog (steps 12-13) is open.
  const [logSupplyOpen, setLogSupplyOpen] = useState(false);
  // Whether the Dispatch Rescue Team dialog (steps 6-9) is open, and for what:
  // `reassigning` is the declined or unresponsive dispatch it was reopened for
  // (A3.3, E4.2).
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [reassigning, setReassigning] = useState(null);
  // The queued incident the dialog was reopened to give a team (E3).
  const [assigning, setAssigning] = useState(null);
  // Whether the Register shelter dialog (A1) is open.
  const [registerOpen, setRegisterOpen] = useState(false);

  useEffect(() => {
    if (!isDmc) return;
    areasApi
      .listDistricts()
      .then(setDistricts, (error) =>
        setDistrictsError(errorMessage(error, 'Districts could not be loaded.')),
      );
  }, [isDmc]);

  const ready = canCoordinate && (!isDmc || Boolean(districtId));

  const loadPicture = useCallback(() => {
    const params = { districtId: isDmc ? districtId : undefined, organisationId };
    return coordinationApi.getOperationalPicture(params).then(
      (loaded) => {
        setPicture(loaded);
        setPictureError(null);
        if (!organisationId) {
          setOrganisations(loaded.totalsByOrganisation.map((row) => row.organisation));
        }
      },
      (error) => setPictureError(errorMessage(error, 'The dashboard could not be loaded.')),
    );
  }, [isDmc, districtId, organisationId]);

  const loadUnassigned = useCallback(
    () =>
      coordinationApi
        .listDispatches({ districtId: isDmc ? districtId : undefined, status: ['UNASSIGNED'] })
        .then(
          (loaded) => {
            setUnassigned(loaded);
            setUnassignedError(null);
          },
          (error) =>
            setUnassignedError(
              errorMessage(error, 'The unassigned incidents could not be loaded.'),
            ),
        ),
    [isDmc, districtId],
  );

  useEffect(() => {
    if (!ready) return;
    loadPicture();
    loadUnassigned();
  }, [ready, loadPicture, loadUnassigned]);

  // A flagged update keeps its dialog open on the suggestion (A2); anything else is done.
  const handleOccupancyUpdated = (result) => {
    if (!result.flagged) setOccupancyShelterId(null);
    loadPicture();
  };

  const handleDispatched = () => {
    setDispatchOpen(false);
    if (reassigning) handledUnanswered(reassigning);
    setReassigning(null);
    setAssigning(null);
    loadPicture();
    loadUnassigned();
  };

  // E3.2: no team was free, so the incident is queued and the DMC asked for
  // support. A declined dispatch that led here has been dealt with too.
  const handleQueued = () => {
    setDispatchOpen(false);
    if (reassigning) handledUnanswered(reassigning);
    setReassigning(null);
    loadUnassigned();
  };

  // A declined or unresponsive dispatch has been dealt with (reassigned or dismissed): drop its
  // prompt, and the inbox link's `?dispatch=` that pointed at it.
  function handledUnanswered(dispatch) {
    dismissUnanswered(dispatch.id);
    if (searchParams.get('dispatch') === dispatch.id) {
      setSearchParams({}, { replace: true });
    }
  }

  // A3.3, E4.2: choose another team for the dispatch's incident, with the team
  // that declined or never answered left out.
  const openReassign = (dispatch) => {
    setReassigning(dispatch);
    setDispatchOpen(true);
  };

  // E3: a team is free, so give it to a queued incident from the list.
  const openAssign = (dispatch) => {
    setAssigning(dispatch);
    setDispatchOpen(true);
  };

  const closeDispatch = () => {
    setDispatchOpen(false);
    setReassigning(null);
    setAssigning(null);
  };

  // E4: an UNAVAILABLE team (it never answered) goes back in the available list.
  const [markingTeamId, setMarkingTeamId] = useState(null);
  const [markError, setMarkError] = useState(null);

  const handleMarkAvailable = async (team) => {
    setMarkingTeamId(team.id);
    setMarkError(null);
    try {
      await coordinationApi.markTeamAvailable(team.id);
      await loadPicture();
    } catch (error) {
      setMarkError(errorMessage(error, `${team.name} could not be marked available.`));
    } finally {
      setMarkingTeamId(null);
    }
  };

  const handleShelterRegistered = () => {
    setRegisterOpen(false);
    loadPicture();
  };

  const handleSupplyLogged = () => {
    setLogSupplyOpen(false);
    loadPicture();
  };

  // Only a district officer updates occupancy or logs supplies, and only while
  // an incident is active (the server refuses otherwise); the DMC just reads.
  const canWrite = !isDmc && Boolean(picture?.incident);

  // A3.2, E4.2: while the dashboard is open, ask every 15 s whether a team
  // declined or never answered.
  const [searchParams, setSearchParams] = useSearchParams();
  const { unanswered, dismiss: dismissUnanswered } = useUnansweredDispatches({
    enabled: canWrite,
    userId: user?.id,
    focusId: searchParams.get('dispatch'),
    onNewDispatch: loadPicture,
  });

  // What the Dispatch dialog opens with: a declined or unresponsive dispatch to
  // reassign (A3.3, E4.2),
  // a queued incident to give a team (E3), or nothing for a new dispatch.
  let dispatchInitial;
  if (reassigning) {
    dispatchInitial = {
      incidentLocation: reassigning.incidentLocation,
      priority: reassigning.priority,
      excludeTeamIds: [reassigning.team.id],
    };
  } else if (assigning) {
    dispatchInitial = {
      incidentLocation: assigning.incidentLocation,
      priority: assigning.priority,
      queuedDispatchId: assigning.id,
    };
  }

  const districtName = isDmc
    ? districts?.find((d) => d.id === districtId)?.name
    : picture?.district?.name;

  return (
    <Screen className="py-5!">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.03em] text-ink">
            Shelter and Resource Coordination
          </h1>
          <p className="text-[14px] text-muted">
            Manage shelters, rescue teams and relief supplies for effective disaster response.
          </p>
        </div>
        {picture && ready && !pictureError ? (
          <IncidentHeader incident={picture.incident} districtName={districtName} />
        ) : null}
      </div>

      {!canCoordinate ? (
        <Notice variant="error" className="mt-4">
          Coordinating shelters and resources needs the district or DMC officer role.
        </Notice>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {isDmc ? (
            <div className="max-w-xs">
              {districtsError ? (
                <Notice variant="error">{districtsError}</Notice>
              ) : (
                <Select
                  label="District"
                  placeholder="Select a district"
                  value={districtId ?? ''}
                  onChange={(event) => setDistrictId(event.target.value || null)}
                  disabled={!districts}
                  options={(districts ?? []).map((district) => ({
                    value: district.id,
                    label: district.name,
                  }))}
                />
              )}
            </div>
          ) : null}

          {!ready ? (
            <EmptyState
              icon="⌂"
              title="Choose a district"
              description="Pick a district above to see its coordination dashboard."
            />
          ) : pictureError ? (
            <Notice variant="error">{pictureError}</Notice>
          ) : !picture ? (
            <Loader className="mt-6" />
          ) : (
            <>
              {canWrite ? (
                <ReassignPrompt
                  dispatches={unanswered}
                  onReassign={openReassign}
                  onDismiss={handledUnanswered}
                />
              ) : null}

              <SummaryCards summary={picture.summary} />

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Panel title="Shelter Status">
                  <ShelterStatusTable
                    shelters={picture.shelters}
                    onSelect={canWrite ? (row) => setOccupancyShelterId(row.id) : undefined}
                  />
                </Panel>

                <Panel
                  title="Live Operations Map"
                  action={
                    <OrganisationFilter
                      organisations={organisations}
                      value={organisationId}
                      onChange={setOrganisationId}
                    />
                  }
                >
                  <LiveOpsMap shelters={picture.shelters} teams={picture.teams} />
                </Panel>

                <Panel title="Rescue Teams">
                  {markError ? (
                    <Notice variant="error" className="mb-2">
                      {markError}
                    </Notice>
                  ) : null}
                  <RescueTeamsTable
                    teams={picture.teams}
                    onMarkAvailable={canWrite ? handleMarkAvailable : undefined}
                    busyId={markingTeamId}
                  />
                </Panel>

                <Panel title="Recent Relief Supply Logs">
                  <SupplyLogTable distributions={picture.recentDistributions} />
                </Panel>
              </div>

              {/* E3: shown only while an incident waits for a team, so the
                  dashboard fits on one screen the rest of the time. */}
              {unassignedError || unassigned?.length > 0 ? (
                <Panel title="Unassigned Incidents">
                  {unassignedError ? (
                    <Notice variant="error">{unassignedError}</Notice>
                  ) : (
                    <UnassignedIncidentsTable
                      dispatches={unassigned}
                      onDispatch={canWrite ? openAssign : undefined}
                    />
                  )}
                </Panel>
              ) : null}

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-paper p-3 md:grid-cols-3">
                <ActionButton
                  Icon={Send}
                  title="Dispatch Rescue Team"
                  detail="Assign a team to an incident"
                  tone="navy"
                  disabled={!canWrite}
                  onClick={() => setDispatchOpen(true)}
                />
                <ActionButton
                  Icon={Package}
                  title="Log Relief Supply"
                  detail="Record distributed supplies"
                  tone="success"
                  disabled={!canWrite}
                  onClick={() => setLogSupplyOpen(true)}
                />
                <ActionButton
                  Icon={Building2}
                  title="Manage Shelters"
                  detail="Register a new shelter"
                  tone="outline"
                  disabled={!canWrite}
                  onClick={() => setRegisterOpen(true)}
                />
              </div>
            </>
          )}
        </div>
      )}

      {occupancyShelterId && picture ? (
        <UpdateOccupancyDialog
          shelters={picture.shelters}
          initialShelterId={occupancyShelterId}
          onClose={() => setOccupancyShelterId(null)}
          onUpdated={handleOccupancyUpdated}
          onRedirected={loadPicture}
        />
      ) : null}

      {dispatchOpen && picture ? (
        <DispatchDialog
          mapCenter={picture.shelters[0]?.location}
          initial={dispatchInitial}
          onClose={closeDispatch}
          onDispatched={handleDispatched}
          onQueued={handleQueued}
        />
      ) : null}

      {registerOpen && picture ? (
        <RegisterShelterDialog
          mapCenter={picture.shelters[0]?.location}
          onClose={() => setRegisterOpen(false)}
          onRegistered={handleShelterRegistered}
        />
      ) : null}

      {logSupplyOpen && picture ? (
        <LogReliefSupplyDialog
          shelters={picture.shelters}
          onClose={() => setLogSupplyOpen(false)}
          onLogged={handleSupplyLogged}
        />
      ) : null}
    </Screen>
  );
}
