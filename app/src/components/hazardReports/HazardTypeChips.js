import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { HAZARD_TYPES } from '../../constants/hazardReports';

// Icon colours, matching the tile classes below (icon fonts take a colour
// value, not a class): warning for the selected tile, a slate grey otherwise.
const ICON_COLOR = { selected: '#F79009', idle: '#8492A6' };

// UC02 step 4: exactly one hazard type - Rising river / Flood, Landslide,
// Blocked road or Other - as a grid of tiles with an icon above the label.
// Tapping the selected tile keeps it selected.
export default function HazardTypeChips({ value, onChange, error, disabled = false }) {
  return (
    <View className="mb-4">
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {HAZARD_TYPES.map((type) => {
          const selected = value === type.value;
          return (
            <Pressable
              key={type.value}
              onPress={disabled ? undefined : () => onChange(type.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={type.label}
              className={[
                'min-h-[84px] grow basis-[45%] items-center justify-center gap-1.5 rounded-ds-md border-[1.5px] px-2 py-3 active:opacity-80',
                selected
                  ? 'border-warning bg-warning-soft'
                  : error
                    ? 'border-danger bg-navy-soft'
                    : 'border-navy-soft bg-navy-soft',
              ].join(' ')}
            >
              <MaterialCommunityIcons
                name={type.icon}
                size={26}
                color={selected ? ICON_COLOR.selected : ICON_COLOR.idle}
              />
              <Text
                className={[
                  'text-center text-[14px] font-semibold',
                  selected ? 'text-warning-ink' : 'text-muted',
                ].join(' ')}
              >
                {type.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="mt-1.5 text-[13px] font-medium text-danger">{error}</Text> : null}
    </View>
  );
}
