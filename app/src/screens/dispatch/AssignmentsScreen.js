import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text } from 'react-native';

import { dispatchesApi } from '../../api';
import AssignmentCard from '../../components/dispatch/AssignmentCard';
import DeclineSheet from '../../components/dispatch/DeclineSheet';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

const errorMessage = (failure, fallback) => failure?.response?.data?.error?.message ?? fallback;

// The Rescue Team App's Assignments tab (UC03 steps 10-11, §5.2): the team
// the signed-in lead leads and its assignments (GET /api/dispatches/mine,
// contract §13.7.5). A new one counts down to its deadline and is
// acknowledged here; then the lead marks the team on site and, later,
// completed. Reloads whenever the tab comes into view and on pull-to-refresh,
// and again when a countdown ends, since the server decides that an
// assignment has expired. When an action is refused (the deadline passed, or
// the status moved on) the server's message shows and the list is read again.
export default function AssignmentsScreen() {
  const [mine, setMine] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  // The assignment whose Decline sheet is open (A3.1), and how sending it went.
  const [declining, setDeclining] = useState(null);
  const [declineSending, setDeclineSending] = useState(false);
  const [declineError, setDeclineError] = useState(null);

  const load = useCallback(
    () =>
      dispatchesApi.getMine().then(
        (loaded) => {
          setMine(loaded);
          setError(null);
        },
        (failure) =>
          setError(
            errorMessage(failure, 'Your assignments could not be loaded. Pull down to try again.'),
          ),
      ),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function refresh() {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }

  // Sends one action for a dispatch, then shows where it stands now.
  async function act(dispatch, send, failureText) {
    if (busyId) return;
    setBusyId(dispatch.id);
    setActionError(null);
    try {
      await send(dispatch.id);
    } catch (failure) {
      setActionError(errorMessage(failure, failureText));
    }
    await load();
    setBusyId(null);
  }

  function openDecline(dispatch) {
    setActionError(null);
    setDeclineError(null);
    setDeclining(dispatch);
  }

  // A3.1-A3.2: send the reason. A refused reason (400) stays in the sheet to be
  // corrected; any other refusal - the deadline passed, or it was acknowledged
  // meanwhile (409) - closes it and shows the server's message, since there is
  // nothing left to decline.
  async function sendDecline(reason) {
    setDeclineSending(true);
    setDeclineError(null);
    try {
      await dispatchesApi.decline(declining.id, reason);
      setDeclining(null);
    } catch (failure) {
      const message = errorMessage(failure, 'The assignment could not be declined. Try again.');
      if (failure?.response?.status === 400 || !failure?.response) {
        setDeclineError(message);
      } else {
        setDeclining(null);
        setActionError(message);
      }
    }
    await load();
    setDeclineSending(false);
  }

  const team = mine?.team ?? null;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Assignments" className="px-0" />
      {team ? (
        <Text className="-mt-1 mb-2 text-sm text-muted-dark">
          {team.name} · {team.organisation.name}
        </Text>
      ) : null}
      {error ? (
        <Notice variant="error" className="mb-3">
          {error}
        </Notice>
      ) : null}
      {actionError ? (
        <Notice variant="error" className="mb-3">
          {actionError}
        </Notice>
      ) : null}
      {mine === null && !error ? (
        <Loader />
      ) : (
        <FlatList
          data={mine?.dispatches ?? []}
          keyExtractor={(dispatch) => dispatch.id}
          renderItem={({ item }) => (
            <AssignmentCard
              dispatch={item}
              team={team}
              busy={busyId === item.id}
              onAcknowledge={(dispatch) =>
                act(
                  dispatch,
                  dispatchesApi.acknowledge,
                  'The assignment could not be acknowledged. Try again.',
                )
              }
              onDecline={openDecline}
              onOnSite={(dispatch) =>
                act(
                  dispatch,
                  dispatchesApi.markOnSite,
                  'Could not mark the team on site. Try again.',
                )
              }
              onComplete={(dispatch) =>
                act(
                  dispatch,
                  dispatchesApi.complete,
                  'Could not complete the assignment. Try again.',
                )
              }
              onExpire={load}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                message={
                  team
                    ? 'No assignments yet. New ones from the district officer will appear here.'
                    : "You don't lead a rescue team yet, so there are no assignments to show."
                }
              />
            )
          }
          contentContainerClassName="pb-6"
        />
      )}

      <DeclineSheet
        visible={declining !== null}
        submitting={declineSending}
        error={declineError}
        onDecline={sendDecline}
        onClose={() => setDeclining(null)}
      />
    </Screen>
  );
}
