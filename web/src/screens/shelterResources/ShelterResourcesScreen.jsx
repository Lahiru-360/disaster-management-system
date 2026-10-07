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
import UpdateOccupancyDialog from '../../components/shelterResources/UpdateOccupancyDialog';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import Select from '../../components/ui/Select';
import { ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import useDeclinedDispatches from '../../hooks/useDeclinedDispatches';

const errorMessage = (error, fallback) => error?.response?.data?.error?.message ?? fallback;

// UC03 main flow steps 1-2 and 14 (DMS-140): the Shelter & Resource
// Coordination dashboard. A district officer sees their own district; a DMC
// or duty officer picks one first, since the server requires it for them.
// The dashboard refetches whenever the district or the organisation filter
// changes, and again after the occupancy (DMS-141), dispatch (DMS-142) and
// supply (DMS-143) dialogs save, and after a shelter is registered (DMS-144).
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

  // The shelter whose row opened the Update Shelter Occupancy dialog (step 3).
  const [occupancyShelterId, setOccupancyShelterId] = useState(null);
  // Whether the Log Relief Supply dialog (steps 12-13) is open.
  const [logSupplyOpen, setLogSupplyOpen] = useState(false);
  // Whether the Dispatch Rescue Team dialog (steps 6-9) is open, and for what:
  // `reassigning` is the declined dispatch it was reopened for (A3.3).
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [reassigning, setReassigning] = useState(null);
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

  useEffect(() => {
    if (!ready) return;
    loadPicture();
  }, [ready, loadPicture]);

  // A flagged update keeps its dialog open on the suggestion (A2); anything else is done.
  const handleOccupancyUpdated = (result) => {
    if (!result.flagged) setOccupancyShelterId(null);
    loadPicture();
  };

  const handleDispatched = () => {
    setDispatchOpen(false);
    if (reassigning) handledDecline(reassigning);
    setReassigning(null);
    loadPicture();
  };

  // A declined dispatch has been dealt with (reassigned or dismissed): drop its
  // prompt, and the inbox link's `?dispatch=` that pointed at it.
  function handledDecline(dispatch) {
    dismissDecline(dispatch.id);
    if (searchParams.get('dispatch') === dispatch.id) {
      setSearchParams({}, { replace: true });
    }
  }

  // A3.3: choose another team for the declined dispatch's incident, with the
  // team that declined left out.
  const openReassign = (dispatch) => {
    setReassigning(dispatch);
    setDispatchOpen(true);
  };

  const closeDispatch = () => {
    setDispatchOpen(false);
    setReassigning(null);
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

  // A3.2: while the dashboard is open, ask every 15 s whether a team declined.
  const [searchParams, setSearchParams] = useSearchParams();
  const { declined, dismiss: dismissDecline } = useDeclinedDispatches({
    enabled: canWrite,
    userId: user?.id,
    focusId: searchParams.get('dispatch'),
    onNewDecline: loadPicture,
  });

  const districtName = isDmc
    ? districts?.find((d) => d.id === districtId)?.name
    : picture?.district?.name;

  return (
    <Screen>
      <ScreenHeader title="Shelter & Resources" />

      {!canCoordinate ? (
        <Notice variant="error" className="mt-4">
          Coordinating shelters and resources needs the district or DMC officer role.
        </Notice>
      ) : (
        <div className="mt-5 flex flex-col gap-6">
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
              <IncidentHeader incident={picture.incident} districtName={districtName}>
                <Button
                  variant="outline"
                  fullWidth={false}
                  disabled={!canWrite}
                  onClick={() => setDispatchOpen(true)}
                >
                  Dispatch Rescue Team
                </Button>
                <Button
                  variant="outline"
                  fullWidth={false}
                  disabled={!canWrite}
                  onClick={() => setLogSupplyOpen(true)}
                >
                  Log Relief Supply
                </Button>
                <Button
                  variant="outline"
                  fullWidth={false}
                  disabled={!canWrite}
                  onClick={() => setRegisterOpen(true)}
                >
                  Manage Shelters
                </Button>
              </IncidentHeader>

              {canWrite ? (
                <ReassignPrompt
                  dispatches={declined}
                  onReassign={openReassign}
                  onDismiss={handledDecline}
                />
              ) : null}

              <SummaryCards summary={picture.summary} />

              <div className="flex items-center justify-between">
                <SectionLabel>Live Operations Map</SectionLabel>
                <OrganisationFilter
                  organisations={organisations}
                  value={organisationId}
                  onChange={setOrganisationId}
                />
              </div>
              <LiveOpsMap shelters={picture.shelters} teams={picture.teams} />

              <section>
                <SectionLabel className="mb-2">Shelter Status</SectionLabel>
                <ShelterStatusTable
                  shelters={picture.shelters}
                  onSelect={canWrite ? (row) => setOccupancyShelterId(row.id) : undefined}
                />
              </section>

              <section>
                <SectionLabel className="mb-2">Rescue Teams</SectionLabel>
                <RescueTeamsTable teams={picture.teams} />
              </section>

              <section>
                <SectionLabel className="mb-2">Recent Relief Supply Logs</SectionLabel>
                <SupplyLogTable distributions={picture.recentDistributions} />
              </section>
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
          initial={
            reassigning
              ? {
                  incidentLocation: reassigning.incidentLocation,
                  priority: reassigning.priority,
                  excludeTeamIds: [reassigning.team.id],
                }
              : undefined
          }
          onClose={closeDispatch}
          onDispatched={handleDispatched}
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
