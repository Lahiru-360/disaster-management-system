import { Text, View } from 'react-native';

import Button from './Button';

export default function RoleStrip({
  label = 'Signing up as',
  value,
  actionLabel = 'Change',
  onAction,
  className,
  ...props
}) {
  return (
    <View
      className={[
        'flex-row items-center justify-between gap-3 rounded-ds-lg bg-haze py-[11px] pl-[18px] pr-[11px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <View className="flex-1">
        <Text className="text-overline uppercase text-muted">{label}</Text>
        <Text className="mt-[2px] text-[15px] font-semibold text-ink">{value}</Text>
      </View>
      {actionLabel ? (
        <Button variant="small" fullWidth={false} onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
