import {
  Bell,
  Building2,
  ChevronRight,
  ClipboardList,
  FileText,
  House,
  Megaphone,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { coordinationApi, groundReportsApi, hazardAlertsApi, notificationsApi } from '../../api';
import SeverityBadge from '../../components/hazardWarnings/SeverityBadge';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ProgressBar from '../../components/ui/ProgressBar';
import Screen from '../../components/ui/Screen';
import SectionLabel from '../../components/ui/SectionLabel';
import { hazardTypeLabel } from '../../constants/hazardReports';
import { roleLabel, ROLES } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';

// How many rows each list panel shows before "View all".
const LIST_COUNT = 5;

// Icon tile tones - the same set as the app Home's stat tiles and the
// Shelter & Resources summary cards.
const ICON_TONES = {
  navy: 'bg-navy-soft text-navy',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
};

// The shelter status rule's bands (0.75 / 0.90), as on the Shelter Status table.
const OCCUPANCY_THRESHOLDS = [
  { upTo: 74, tone: 'success' },
  { upTo: 89, tone: 'warning' },
  { upTo: Infinity, tone: 'danger' },
];

const errorMessage = (error, fallback) => error?.response?.data?.error?.message ?? fallback;

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Loads one source for the dashboard when `enabled`, as { data, error }; data
// stays null until it answers and for a role that may not read it.
function useSource(enabled, load, fallback) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    load().then(
      (data) => current && setState({ data, error: null }),
      (error) => current && setState({ data: null, error: errorMessage(error, fallback) }),
    );
    return () => {
      current = false;
    };
    // `load` and `fallback` are fixed per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return state;
}

// A pill on the navy banner.
function HeroPill({ dot, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-paper/15 bg-paper/10 px-3 py-1 text-[12px] font-semibold text-paper">
      {dot ? (
        <span aria-hidden="true" className={['h-1.5 w-1.5 rounded-full', dot].join(' ')} />
      ) : null}
      {children}
    </span>
  );
}

// One figure, opening the page it comes from when it has one.
function StatCard({ Icon, tone, label, value, detail, to }) {
  const Container = to ? Link : 'div';
  return (
    <Container
      to={to}
      className={[
        'flex items-center gap-3.5 rounded-xl border border-line bg-paper p-4',
        to &&
          'transition-colors hover:border-navy focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          ICON_TONES[tone],
        ].join(' ')}
      >
        <Icon size={22} strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">{label}</p>
        <p className="mt-0.5 text-[24px] leading-tight font-bold tracking-[-0.03em] text-ink tabular-nums">
          {value ?? '–'}
        </p>
        <p className="truncate text-[12px] text-muted">{detail}</p>
      </div>
    </Container>
  );
}

// A titled white panel, with a "View all" link when it has a page of its own.
function Panel({ title, to, children, className }) {
  return (
    <section
      className={['flex flex-col rounded-xl border border-line bg-paper p-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mb-1 flex min-h-9 items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold text-ink">{title}</h2>
        {to ? (
          <Link to={to} className="text-[13px] font-semibold text-navy hover:underline">
            View all
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PanelBody({ state, empty, children }) {
  if (state.error) return <Notice variant="error">{state.error}</Notice>;
  if (!state.data) return <Loader className="my-6" />;
  if (empty) return empty;
  return children;
}

// A quick action: the same row as the app Home's, as a card.
function ActionCard({ Icon, tone, title, detail, to }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3.5 rounded-xl border border-line bg-paper p-4 transition-colors hover:border-navy hover:bg-navy-soft focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none"
    >
      <span
        className={[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          ICON_TONES[tone],
        ].join(' ')}
      >
        <Icon size={21} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        <span className="block truncate text-[12.5px] text-muted">{detail}</span>
      </span>
      <ChevronRight size={18} className="text-muted" aria-hidden="true" />
    </Link>
  );
}

// The console's landing page for every officer role, laid out like the app's
// Home tab so the two read as one product: a navy banner greeting the officer
// with what is in force, their figures at a glance, the lists that need them
// and quick ways into the other pages. Each source is read only for a role the
// server lets read it - the active warnings for DMC and duty officers (UC01),
// the pending ground reports for a duty officer (UC02), and the district's
// operational picture for a district officer (UC03) - so no officer sees a
// 403. Every officer sees their newest notifications.
export default function DashboardScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const isDmc = [ROLES.DMC_OFFICER, ROLES.DUTY_OFFICER].includes(role);
  const isDuty = role === ROLES.DUTY_OFFICER;
  const isDistrict = role === ROLES.DISTRICT_OFFICER;

  const warnings = useSource(
    isDmc,
    () => hazardAlertsApi.listActive().then((result) => result.alerts),
    'The active warnings could not be loaded.',
  );
  const pending = useSource(
    isDuty,
    () => groundReportsApi.listPending(),
    'The pending reports could not be loaded.',
  );
  const picture = useSource(
    isDistrict,
    () => coordinationApi.getOperationalPicture(),
    'The district picture could not be loaded.',
  );
  const inbox = useSource(
    true,
    () => notificationsApi.listMine({ page: 1, limit: LIST_COUNT }),
    'Your notifications could not be loaded.',
  );

  const activeCount = warnings.data?.length;
  const pendingCount = pending.data?.reduce((sum, cluster) => sum + cluster.count, 0);
  const summary = picture.data?.summary;
  const now = new Date();

  const stats = [
    isDmc && {
      label: 'Active Warnings',
      value: activeCount,
      detail:
        activeCount === undefined
          ? 'Loading…'
          : `${warnings.data.filter((w) => w.severity === 'SEVERE').length} severe`,
      Icon: TriangleAlert,
      tone: 'danger',
      to: '/hazard-warnings',
    },
    isDuty && {
      label: 'Pending Reports',
      value: pendingCount,
      detail: pending.data ? `${pending.data.length} locations` : 'Loading…',
      Icon: ClipboardList,
      tone: 'warning',
      to: '/ground-reports',
    },
    isDistrict && {
      label: 'Shelters',
      value: summary?.shelters,
      detail: summary ? `${summary.sheltersNearCapacity} near capacity` : 'Loading…',
      Icon: Building2,
      tone: 'navy',
      to: '/shelter-resources',
    },
    isDistrict && {
      label: 'Rescue Teams',
      value: summary?.teams,
      detail: summary ? `${summary.teamsAvailable} available` : 'Loading…',
      Icon: Users,
      tone: 'success',
      to: '/shelter-resources',
    },
    isDistrict && {
      label: 'Affected People',
      value: summary?.affectedPeople.toLocaleString('en-US'),
      detail: 'Current occupancy',
      Icon: House,
      tone: 'warning',
      to: '/shelter-resources',
    },
    {
      label: 'Unread',
      value: inbox.data?.unreadCount,
      detail: 'Notifications',
      Icon: Bell,
      tone: 'navy',
    },
  ].filter(Boolean);

  const actions = [
    isDmc && {
      Icon: Megaphone,
      tone: 'danger',
      title: 'Issue Hazard Warning',
      detail: 'Alert the people in an area',
      to: '/hazard-warnings/new',
    },
    isDuty && {
      Icon: ClipboardList,
      tone: 'warning',
      title: 'Review Ground Reports',
      detail: 'Confirm or dismiss what citizens sent',
      to: '/ground-reports',
    },
    {
      Icon: House,
      tone: 'navy',
      title: 'Shelters & Resources',
      detail: 'Shelters, rescue teams and supplies',
      to: '/shelter-resources',
    },
    {
      Icon: FileText,
      tone: 'success',
      title: 'Post-Event Reports',
      detail: 'Build and share an incident report',
      to: '/reports',
    },
  ].filter(Boolean);

  // The banner's button: the officer's own first job, when they have one.
  const primary = isDmc || isDuty ? actions[0] : null;
  const PrimaryIcon = primary?.Icon;
  const severe = warnings.data?.some((w) => w.severity === 'SEVERE');
  const incident = picture.data?.incident;

  return (
    <Screen className="py-5!">
      <section className="relative overflow-hidden rounded-2xl bg-navy px-7 py-6 text-paper">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(91,140,214,0.34)_0%,rgba(91,140,214,0.08)_46%,transparent_72%)]"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.12em] text-paper/60 uppercase">
              {now.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <h1 className="mt-1.5 text-[28px] leading-tight font-bold tracking-[-0.035em]">
              {greeting(now)}, {user?.name?.split(' ')[0]}
            </h1>
            <div className="mt-3.5 flex flex-wrap gap-2">
              <HeroPill>{roleLabel(role)}</HeroPill>
              {isDmc && activeCount !== undefined ? (
                <HeroPill
                  dot={activeCount === 0 ? 'bg-success' : severe ? 'bg-danger' : 'bg-warning'}
                >
                  {activeCount === 0
                    ? 'No warnings in force'
                    : `${activeCount} warning${activeCount === 1 ? '' : 's'} in force`}
                </HeroPill>
              ) : null}
              {isDistrict && picture.data ? (
                <HeroPill dot={incident ? 'bg-danger' : 'bg-success'}>
                  {incident ? incident.name : `No active incident · ${picture.data.district?.name}`}
                </HeroPill>
              ) : null}
            </div>
          </div>
          {primary ? (
            <button
              type="button"
              onClick={() => navigate(primary.to)}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg bg-paper px-5 text-[15px] font-semibold text-navy transition-colors hover:bg-navy-soft focus-visible:ring-2 focus-visible:ring-navy-soft focus-visible:outline-none"
            >
              <PrimaryIcon size={18} aria-hidden="true" />
              {primary.title}
            </button>
          ) : null}
        </div>
      </section>

      <div
        className={[
          'mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2',
          stats.length >= 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3',
        ].join(' ')}
      >
        {stats.slice(0, 4).map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        {isDmc ? (
          <Panel title="Active Warnings" to="/hazard-warnings">
            <PanelBody
              state={warnings}
              empty={
                warnings.data?.length === 0 ? (
                  <EmptyState
                    icon={<TriangleAlert size={22} />}
                    title="No warnings in force"
                    description="Warnings you issue appear here until their all-clear."
                  />
                ) : null
              }
            >
              <ul className="divide-y divide-line">
                {warnings.data?.slice(0, LIST_COUNT).map((alert) => (
                  <li key={alert.id}>
                    <Link
                      to={`/hazard-warnings/${alert.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-haze"
                    >
                      <SeverityBadge severity={alert.severity} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-ink">
                          {hazardTypeLabel(alert.hazardType)} · {alert.referenceNo}
                        </span>
                        <span className="block truncate text-[12.5px] text-muted">
                          {alert.targets.map(({ name }) => name).join(', ')}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] text-muted">
                        {timeAgo(alert.issuedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        ) : null}

        {isDistrict ? (
          <Panel title="Shelter Status" to="/shelter-resources">
            <PanelBody
              state={picture}
              empty={
                picture.data?.shelters.length === 0 ? (
                  <EmptyState
                    icon={<Building2 size={22} />}
                    title="No shelters yet"
                    description="Register the district's shelters on Shelters & Resources."
                  />
                ) : null
              }
            >
              <ul className="divide-y divide-line">
                {[...(picture.data?.shelters ?? [])]
                  .sort((a, b) => b.rate - a.rate)
                  .slice(0, LIST_COUNT)
                  .map((shelter) => (
                    <li key={shelter.id} className="flex items-center gap-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-ink">
                          {shelter.name}
                        </span>
                        <span className="block text-[12.5px] text-muted tabular-nums">
                          {shelter.currentOccupancy} / {shelter.capacity} people
                        </span>
                      </span>
                      <ProgressBar
                        value={shelter.currentOccupancy}
                        max={shelter.capacity}
                        thresholds={OCCUPANCY_THRESHOLDS}
                        className="w-28"
                      />
                      <span className="w-10 text-right text-[13px] font-semibold text-ink tabular-nums">
                        {Math.round(shelter.rate * 100)}%
                      </span>
                    </li>
                  ))}
              </ul>
            </PanelBody>
          </Panel>
        ) : null}

        <Panel title="Recent Updates" className={isDmc || isDistrict ? undefined : 'xl:col-span-2'}>
          <PanelBody
            state={inbox}
            empty={
              inbox.data?.notifications.length === 0 ? (
                <EmptyState
                  icon={<Bell size={22} />}
                  title="Nothing new"
                  description="New reports, capacity alerts and support requests will appear here."
                />
              ) : null
            }
          >
            <ul className="divide-y divide-line">
              {inbox.data?.notifications.map((item) => {
                const unread = item.readAt === null;
                const body = (
                  <>
                    <span
                      aria-hidden="true"
                      className={[
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        unread ? 'bg-navy' : 'bg-transparent',
                      ].join(' ')}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={[
                          'block text-[14px] text-ink',
                          unread ? 'font-semibold' : 'font-medium',
                        ].join(' ')}
                      >
                        {item.title}
                      </span>
                      <span className="line-clamp-2 block text-[12.5px] text-muted">
                        {item.body}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] text-muted">
                      {timeAgo(item.createdAt)}
                    </span>
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.link ? (
                      <Link
                        to={item.link}
                        onClick={() => unread && notificationsApi.markRead(item.id).catch(() => {})}
                        className="-mx-2 flex gap-3 rounded-lg px-2 py-3 hover:bg-haze"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex gap-3 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </PanelBody>
        </Panel>
      </div>

      <SectionLabel className="mt-6 mb-3">Quick actions</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <ActionCard key={action.title} {...action} />
        ))}
      </div>
    </Screen>
  );
}
