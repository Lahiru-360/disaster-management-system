import { Text, View } from 'react-native';

import { HAZARD_TYPES } from '../../constants/hazardReports';
import Chip from '../ui/Chip';

// UC02 step 4: exactly one hazard type - Rising river / Flood, Landslide,
// Blocked road or Other. Tapping the selected chip keeps it selected.
export default function HazardTypeChips({ value, onChange, error, disabled = false }) {
  return (
    <View className="mb-4">
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {HAZARD_TYPES.map((type) => (
          <Chip
            key={type.value}
            selected={value === type.value}
            onPress={disabled ? undefined : () => onChange(type.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === type.value }}
          >
            {type.label}
          </Chip>
        ))}
      </View>
      {error ? <Text className="mt-1.5 text-[13px] font-medium text-danger">{error}</Text> : null}
    </View>
  );
}
