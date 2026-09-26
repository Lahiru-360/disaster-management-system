import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { authApi } from '../../api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import { roleLabel } from '../../constants/roles';
import useAuth from '../../hooks/useAuth';
import { formatShortDate } from '../../utils/format';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

function Divider() {
  return <View className="h-px bg-line" />;
}

function FactRow({ label, value, trailing }) {
  return (
    <View className="flex-row items-center justify-between py-[14px]">
      <View>
        <Text className="text-[12.5px] font-semibold text-muted">{label}</Text>
        <Text className="mt-[2px] text-[14.5px] font-semibold text-ink">{value}</Text>
      </View>
      {trailing ? <Text className="text-[11.5px] text-muted-dark">{trailing}</Text> : null}
    </View>
  );
}

function NavRow({ label, onPress }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between py-[14px]">
      <Text className="text-[14.5px] font-semibold text-ink">{label}</Text>
      <Text className="text-[17px] font-semibold text-muted-dark">›</Text>
    </Pressable>
  );
}

export default function AccountSettingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, logout, deactivateAccount } = useAuth();

  // AuthContext's user already carries createdAt from login/register/bootstrap
  // (docs/api-contract.md §5.1-5.2, §5.5), so this only round-trips to
  // /auth/me for a context copy that predates that field - status starts
  // READY already in the common case and never flashes a loader.
  const [createdAt, setCreatedAt] = useState(user?.createdAt ?? null);
  const [status, setStatus] = useState(user?.createdAt ? STATUS.READY : STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [deactivateConfirmVisible, setDeactivateConfirmVisible] = useState(false);

  // ChangePasswordScreen navigates back here with this param
  // instead of a plain goBack() so there's somewhere to hand the
  // confirmation. Latched into state during render (same "adjust state from
  // a prop/param change" pattern RootNavigator.js uses) rather than in an
  // effect, so it stays true even once the effect below clears the param -
  // otherwise the notice would flash and vanish on the very next render.
  const [passwordChangedNotice, setPasswordChangedNotice] = useState(false);
  const [seenPasswordChangedParam, setSeenPasswordChangedParam] = useState(
    route.params?.passwordChanged,
  );
  if (route.params?.passwordChanged !== seenPasswordChangedParam) {
    setSeenPasswordChangedParam(route.params?.passwordChanged);
    if (route.params?.passwordChanged) {
      setPasswordChangedNotice(true);
    }
  }

  // Clearing the param is a real sync-with-navigation's-own-state effect
  // (unlike the local notice flag above), so it stays here rather than
  // moving into the render body too.
  useEffect(() => {
    if (route.params?.passwordChanged) {
      navigation.setParams({ passwordChanged: undefined });
    }
  }, [route.params?.passwordChanged, navigation]);

  useEffect(() => {
    if (user?.createdAt) return undefined;

    let cancelled = false;

    async function loadCreatedAt() {
      try {
        const result = await authApi.getCurrentUser();
        if (!cancelled) {
          setCreatedAt(result.user.createdAt);
          setStatus(STATUS.READY);
        }
      } catch {
        if (!cancelled) setStatus(STATUS.ERROR);
      }
    }

    loadCreatedAt();

    return () => {
      cancelled = true;
    };
  }, [user, reloadToken]);

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.ERROR) {
    return (
      <EmptyState
        className="bg-paper"
        message="We couldn't load your account details."
        actionLabel="Retry"
        onAction={() => {
          setStatus(STATUS.LOADING);
          setReloadToken((token) => token + 1);
        }}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title="Account" small onBack={() => navigation.goBack()} />

      <ScrollView className="flex-1" contentContainerClassName="px-[22px] pb-6">
        {passwordChangedNotice ? (
          <Notice className="mb-4">Your password was changed.</Notice>
        ) : null}

        <SectionLabel>Account details</SectionLabel>
        <View className="mt-2">
          <FactRow label="Name" value={user?.name} />
          <Divider />
          <FactRow label="Email" value={user?.email} />
          <Divider />
          <FactRow label="Role" value={roleLabel(user?.role)} trailing="Permanent" />
          <Divider />
          <FactRow
            label="Member since"
            value={createdAt ? formatShortDate(new Date(createdAt)) : ''}
          />
        </View>

        <SectionLabel className="mt-6">Security</SectionLabel>
        <View className="mt-2">
          <NavRow label="Change password" onPress={() => navigation.navigate('ChangePassword')} />
          <Divider />
          <NavRow label="Log out" onPress={() => setLogoutConfirmVisible(true)} />
        </View>
      </ScrollView>

      <Pressable
        onPress={() => setDeactivateConfirmVisible(true)}
        className="items-center px-[22px] py-2"
      >
        <Text className="text-[14px] font-semibold text-danger">Deactivate account</Text>
      </Pressable>

      <ConfirmDialog
        visible={logoutConfirmVisible}
        destructive
        title="Log out?"
        body="You'll need to sign in again to access your account."
        confirmLabel="Log out"
        cancelLabel="Cancel"
        onConfirm={logout}
        onCancel={() => setLogoutConfirmVisible(false)}
      />

      <ConfirmDialog
        visible={deactivateConfirmVisible}
        destructive
        title="Deactivate account?"
        body="You'll be signed out everywhere and won't be able to sign in again. Your data is kept — nothing is deleted."
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        onConfirm={deactivateAccount}
        onCancel={() => setDeactivateConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}
