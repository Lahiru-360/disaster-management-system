import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { dispatchesApi, hazardReportsApi } from '../../api';
import AlertCard from '../../components/alerts/AlertCard';
import NotificationItem from '../../components/notifications/NotificationItem';
import Avatar from '../../components/ui/Avatar';
import Brand from '../../components/ui/Brand';
import HeroHeader, { HeroSheet } from '../../components/ui/HeroHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import { roleLabel, ROLES, TABS, tabsForRole } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import useInbox from '../../hooks/useInbox';
import offlineReportQueue from '../../store/offlineReportQueue';
import { tabForLink } from '../../utils/notificationLinks';

// How many inbox items the Recent updates list shows.
const RECENT_COUNT = 3;

// A dispatch the team still has to act on (§13.7.5).
const OPEN_DISPATCH = ['ASSIGNED', 'ACKNOWLEDGED', 'ON_SITE'];

// Icon tile tones, the same set as the web dashboard's stat cards.
const TONES = {
  navy: { tile: 'bg-navy-soft', icon: '#0B1F3A' },
  warning: { tile: 'bg-warning-soft', icon: '#B54708' },
  success: { tile: 'bg-success-soft', icon: '#067647' },
  danger: { tile: 'bg-danger-soft', icon: '#B42318' },
};

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(now = new Date()) {
  return now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

// One figure in the stats row: a tinted icon tile, the number and its label.
function StatTile({ icon, tone, value, label }) {
  const colours = TONES[tone] ?? TONES.navy;
  return (
    <View className="flex-1 rounded-ds-card border-[1.5px] border-line bg-paper p-4">
      <View
        className={['h-9 w-9 items-center justify-center rounded-ds-sm', colours.tile].join(' ')}
      >
        <Ionicons name={icon} size={18} color={colours.icon} />
      </View>
      <Text className="mt-3 font-display text-[24px] tracking-[-0.03em] text-ink">
        {value ?? '–'}
      </Text>
      <Text className="mt-0.5 text-[12.5px] font-semibold text-muted">{label}</Text>
    </View>
  );
}

// One quick action: a row that opens a tab, with a count when it has one.
function ActionRow({ icon, tone, title, detail, count, onPress }) {
  const colours = TONES[tone] ?? TONES.navy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-[14px] py-[14px] active:opacity-70"
    >
      <View
        className={['h-11 w-11 items-center justify-center rounded-ds-md', colours.tile].join(' ')}
      >
        <Ionicons name={icon} size={21} color={colours.icon} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-ink">{title}</Text>
        <Text className="mt-[2px] text-[12.5px] text-muted">{detail}</Text>
      </View>
      {count ? (
        <View className="min-w-[22px] items-center rounded-full bg-navy px-2 py-[3px]">
          <Text className="text-[11px] font-bold text-paper">{count}</Text>
        </View>
      ) : null}
      <Text className="text-[17px] font-semibold text-muted-dark">›</Text>
    </Pressable>
  );
}

function Divider() {
  return <View className="h-px bg-line" />;
}

// The Home tab for every field role: a navy hero greeting the user (the same
// navy as the web console's top bar and dashboard banner), the latest hazard
// warning sent to them, their figures at a glance, quick ways into the other
// tabs, and the newest inbox items. Citizens and volunteers see their reports;
// a rescue team lead sees the team's assignments. Reloads the figures whenever
// the tab comes into view, and everything on pull-to-refresh.
export default function HomeScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const inbox = useInbox();
  const tabs = tabsForRole(user?.role);
  const isLead = user?.role === ROLES.RESCUE_TEAM_LEAD;

  const [reports, setReports] = useState(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [mine, setMine] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isLead) return undefined;
    let current = true;
    offlineReportQueue.list().then((items) => current && setQueuedCount(items.length));
    const unsubscribe = offlineReportQueue.subscribe((items) => setQueuedCount(items.length));
    return () => {
      current = false;
      unsubscribe();
    };
  }, [isLead]);

  // A failure leaves the figures as dashes; the tab itself says what went wrong.
  const loadFigures = useCallback(
    () =>
      isLead
        ? dispatchesApi.getMine().then(setMine, () => {})
        : hazardReportsApi.listMine().then(setReports, () => {}),
    [isLead],
  );

  useFocusEffect(
    useCallback(() => {
      loadFigures();
    }, [loadFigures]),
  );

  function refresh() {
    setRefreshing(true);
    inbox.refresh();
    loadFigures().finally(() => setRefreshing(false));
  }

  const openItem = (item) => {
    inbox.markRead(item.id);
    const tab = tabForLink(item.link);
    navigation.navigate(tab && tabs.includes(tab) ? tab : TABS.INBOX);
  };

  const latestAlert = inbox.notifications.find((item) => item.type === 'HAZARD_ALERT');
  const recent = inbox.notifications.filter((item) => item !== latestAlert).slice(0, RECENT_COUNT);

  const countReports = (status) =>
    reports ? reports.filter((report) => report.status === status).length : null;
  const openDispatches = mine
    ? mine.dispatches.filter((d) => OPEN_DISPATCH.includes(d.status))
    : [];
  const newDispatches = openDispatches.filter((d) => d.status === 'ASSIGNED').length;

  const stats = isLead
    ? [
        { icon: 'flash', tone: 'danger', value: mine ? newDispatches : null, label: 'New' },
        {
          icon: 'navigate',
          tone: 'navy',
          value: mine ? openDispatches.length - newDispatches : null,
          label: 'In progress',
        },
        { icon: 'notifications', tone: 'warning', value: inbox.unreadCount, label: 'Unread' },
      ]
    : [
        { icon: 'time', tone: 'warning', value: countReports('PENDING'), label: 'Pending' },
        {
          icon: 'checkmark-circle',
          tone: 'success',
          value: countReports('CONFIRMED'),
          label: 'Confirmed',
        },
        { icon: 'cloud-upload', tone: 'navy', value: queuedCount, label: 'Not sent' },
      ];

  const actions = [
    {
      tab: TABS.REPORT,
      icon: 'megaphone',
      tone: 'danger',
      title: 'Report a hazard',
      detail: 'Send a photo and location to the duty officer',
    },
    {
      tab: TABS.MY_REPORTS,
      icon: 'document-text',
      tone: 'navy',
      title: 'My reports',
      detail: 'See where each review stands',
      count: queuedCount,
    },
    {
      tab: TABS.ASSIGNMENTS,
      icon: 'clipboard',
      tone: 'danger',
      title: 'Assignments',
      detail: mine?.team ? `${mine.team.name} · ${mine.team.organisation?.name}` : 'Your team',
      count: newDispatches,
    },
    {
      tab: TABS.INBOX,
      icon: 'notifications',
      tone: 'warning',
      title: 'Inbox',
      detail: 'Hazard warnings and updates',
      count: inbox.unreadCount,
    },
  ].filter((action) => tabs.includes(action.tab));

  return (
    <View className="flex-1 bg-navy">
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#FFFFFF" />
        }
      >
        <HeroHeader
          leftSlot={<Brand />}
          rightSlot={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Account settings"
              onPress={() => navigation.navigate('AccountSettings')}
            >
              <Avatar name={user?.name} size="sm" />
            </Pressable>
          }
          contentClassName="pt-5"
        >
          <Text className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/60">
            {todayLabel()}
          </Text>
          <Text className="mt-2 font-display text-[30px] leading-[34px] tracking-[-0.035em] text-paper">
            {greeting()},{'\n'}
            {user?.name?.split(' ')[0]}
          </Text>
          <View className="mt-4 flex-row items-center gap-2">
            <View className="rounded-full border border-white/[0.14] bg-white/10 px-3 py-[5px]">
              <Text className="text-[12px] font-semibold text-paper">{roleLabel(user?.role)}</Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/10 px-3 py-[5px]">
              <View
                className={[
                  'h-1.5 w-1.5 rounded-full',
                  latestAlert && latestAlert.readAt === null ? 'bg-danger' : 'bg-success',
                ].join(' ')}
              />
              <Text className="text-[12px] font-semibold text-paper">
                {latestAlert && latestAlert.readAt === null ? 'New warning' : 'No new warnings'}
              </Text>
            </View>
          </View>
        </HeroHeader>

        <HeroSheet className="px-[22px] pb-8 pt-6">
          {latestAlert ? (
            <>
              <SectionLabel>Latest warning</SectionLabel>
              <AlertCard notification={latestAlert} onPress={openItem} />
            </>
          ) : null}

          <SectionLabel className={latestAlert ? 'mt-4' : undefined}>
            {isLead ? 'Your assignments' : 'Your reports'}
          </SectionLabel>
          <View className="mt-3 flex-row gap-3">
            {stats.map((stat) => (
              <StatTile key={stat.label} {...stat} />
            ))}
          </View>

          <SectionLabel className="mt-7">Quick actions</SectionLabel>
          <View className="mt-1">
            {actions.map((action, index) => (
              <View key={action.tab}>
                {index > 0 ? <Divider /> : null}
                <ActionRow {...action} onPress={() => navigation.navigate(action.tab)} />
              </View>
            ))}
          </View>

          <View className="mt-6 flex-row items-center justify-between">
            <SectionLabel>Recent updates</SectionLabel>
            <Pressable onPress={() => navigation.navigate(TABS.INBOX)} hitSlop={8}>
              <Text className="text-[13px] font-semibold text-navy">See all</Text>
            </Pressable>
          </View>
          {recent.length > 0 ? (
            recent.map((item, index) => (
              <View key={item.id}>
                {index > 0 ? <Divider /> : null}
                <NotificationItem notification={item} onPress={openItem} />
              </View>
            ))
          ) : (
            <Text className="mt-3 text-[13.5px] text-muted">
              {inbox.loading
                ? 'Loading…'
                : 'Nothing new. Updates about your work will appear here.'}
            </Text>
          )}

          {__DEV__ ? (
            <Pressable
              onPress={() => navigation.navigate('ComponentDemo')}
              className="mt-6 items-center py-2"
            >
              <Text className="text-[13px] font-semibold text-muted">UI kit</Text>
            </Pressable>
          ) : null}
        </HeroSheet>
      </ScrollView>

      {/* HeroHeader turns the status bar light; give it back to the other
          tabs and pushed screens, which sit on white. */}
      {isFocused ? null : <StatusBar style="dark" />}
    </View>
  );
}
