import { Text, View } from 'react-native';

import Button from '../ui/Button';

// UC02 step 8, on the device: "Submitted – pending verification · Ref
// GR-2481", with the two ways on from there.
export default function SubmittedState({ referenceNo, onViewReports, onReportAnother }) {
  return (
    <View className="flex-1 items-center justify-center px-2 py-12">
      <View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-success-soft">
        <Text className="text-[24px] font-bold text-success-ink">✓</Text>
      </View>
      <Text className="text-center font-display text-[22px] text-ink">
        Submitted – pending verification
      </Text>
      <Text className="mb-8 mt-2 text-center text-body text-muted">Ref {referenceNo}</Text>
      <Text className="mb-8 text-center text-[13px] text-muted">
        The duty officer for your district will review it. You&apos;ll get a message when they do.
      </Text>
      <Button onPress={onViewReports}>View my reports</Button>
      <Button variant="outline" className="mt-3" onPress={onReportAnother}>
        Report another
      </Button>
    </View>
  );
}
