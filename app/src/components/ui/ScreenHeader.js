import { Pressable, Text, View } from 'react-native';

export default function ScreenHeader({ title, small = false, onBack, rightSlot, className }) {
  return (
    <View
      className={[
        'min-h-12 flex-row items-center justify-between gap-3 px-[22px] pb-[10px] pt-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          className="h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-line bg-haze"
        >
          <Text className="text-[15px] font-semibold text-ink">‹</Text>
        </Pressable>
      ) : null}

      <Text
        className={[
          'flex-1 font-display text-ink',
          small ? 'text-[17px] tracking-[-0.015em]' : 'text-[25px] tracking-[-0.032em]',
        ].join(' ')}
        numberOfLines={1}
      >
        {title}
      </Text>

      {rightSlot ?? null}
    </View>
  );
}
