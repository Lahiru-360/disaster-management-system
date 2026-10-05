import { Text, View } from 'react-native';

import Button from '../ui/Button';

// "6.9382 N, 79.9012 E" - Sri Lanka is north of the equator and east of
// Greenwich, but the hemisphere letters follow the sign anyway.
export function formatCoordinates({ latitude, longitude }) {
  const lat = `${Math.abs(latitude).toFixed(4)} ${latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(longitude).toFixed(4)} ${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}

// UC02 step 3: the position the device's location service gave, shown as
// "GPS: 6.9382 N, 79.9012 E". While it is being fixed the row says so; when
// there is no fix it offers a retry (setting it by hand is A2, DMS-133).
export default function LocationRow({ location, status, onRetry, error }) {
  return (
    <View className="mb-4">
      <View
        className={[
          'min-h-[58px] flex-row items-center justify-between gap-3 rounded-ds-lg border-[1.5px] px-[18px] py-3',
          error ? 'border-danger bg-paper' : 'border-transparent bg-haze',
        ].join(' ')}
      >
        <Text className="flex-1 text-body font-medium text-ink">
          {status === 'ready' && location
            ? `GPS: ${formatCoordinates(location)}`
            : status === 'locating'
              ? 'Finding your location…'
              : 'Location unavailable'}
        </Text>
        {status === 'unavailable' ? (
          <Button variant="small" fullWidth={false} onPress={onRetry}>
            Try again
          </Button>
        ) : null}
      </View>
      {error ? <Text className="mt-1.5 text-[13px] font-medium text-danger">{error}</Text> : null}
    </View>
  );
}
