import { Text, View } from 'react-native';

// The §5.1 wireframe's banner at the top of the report form while the phone
// is offline (UC02 A3): reports can still be made and are sent later.
export default function OfflineBanner() {
  return (
    <View
      accessibilityRole="alert"
      className="mb-4 flex-row items-center gap-[10px] rounded-ds-md bg-warning-soft px-[14px] py-[12px]"
    >
      <View className="h-[18px] w-[18px] items-center justify-center rounded-full bg-strength-medium">
        <Text className="text-[11px] font-bold text-paper">!</Text>
      </View>
      <Text className="flex-1 text-[13px] font-medium text-warning-ink">
        You&apos;re offline – your report will be sent automatically
      </Text>
    </View>
  );
}
