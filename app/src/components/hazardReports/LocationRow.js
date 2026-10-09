import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import Button from '../ui/Button';

// "6.9382 N, 79.9012 E" - Sri Lanka is north of the equator and east of
// Greenwich, but the hemisphere letters follow the sign anyway.
export function formatCoordinates({ latitude, longitude }) {
  const lat = `${Math.abs(latitude).toFixed(4)} ${latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(longitude).toFixed(4)} ${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}

// The pin's colour: `danger` (icon fonts take a colour value, not a class).
const PIN_COLOR = '#D92D20';

// UC02 step 3 / A2 (§5.1 wireframe): "GPS: 6.9382 N, 79.9012 E" with a Set
// manually button always beside it, and "Manually entered" once the reporter
// has set it by hand. While the GPS is fixing the row says so; with no fix it
// says "Location unavailable" and offers to try again.
export default function LocationRow({
  location,
  status,
  source,
  placeName,
  onRetry,
  onSetManually,
  error,
}) {
  const manual = source === 'MANUAL' && location;

  const text = manual
    ? `${placeName ? `${placeName}: ` : ''}${formatCoordinates(location)}`
    : status === 'ready' && location
      ? `GPS: ${formatCoordinates(location)}`
      : status === 'locating'
        ? 'Finding your location…'
        : 'Location unavailable';

  return (
    <View className="mb-4">
      <View
        className={[
          'min-h-[58px] flex-row items-center justify-between gap-3 rounded-ds-lg border-[1.5px] px-[18px] py-3',
          error ? 'border-danger bg-paper' : 'border-transparent bg-haze',
        ].join(' ')}
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-danger-soft">
          <MaterialCommunityIcons
            name={status === 'unavailable' && !manual ? 'map-marker-off' : 'map-marker'}
            size={22}
            color={PIN_COLOR}
          />
        </View>
        <Text className="flex-1 text-[14px] font-medium text-ink">{text}</Text>
        <Button variant="small" fullWidth={false} onPress={onSetManually}>
          Set manually
        </Button>
      </View>
      {manual ? (
        <Text className="mt-1.5 text-[13px] italic text-muted">Manually entered</Text>
      ) : status === 'unavailable' ? (
        <Button variant="small" fullWidth={false} className="mt-2" onPress={onRetry}>
          Try GPS again
        </Button>
      ) : null}
      {error ? <Text className="mt-1.5 text-[13px] font-medium text-danger">{error}</Text> : null}
    </View>
  );
}
