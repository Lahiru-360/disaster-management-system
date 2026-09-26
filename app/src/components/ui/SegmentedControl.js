import { Pressable, Text, View } from 'react-native';

export default function SegmentedControl({ options = [], value, onChange, className }) {
  return (
    <View
      className={['flex-row gap-[18px] border-b border-line', className].filter(Boolean).join(' ')}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange?.(option.value)}
            className="relative pb-[10px]"
          >
            <Text
              className={[
                'text-[13.5px]',
                isActive ? 'font-bold text-ink' : 'font-semibold text-muted-dark',
              ].join(' ')}
            >
              {option.label}
            </Text>
            {isActive ? (
              <View className="absolute -bottom-px left-0 right-0 h-[2.5px] rounded-full bg-signal" />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
