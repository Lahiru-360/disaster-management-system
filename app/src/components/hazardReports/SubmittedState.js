import { Text, View } from 'react-native';

import Button from '../ui/Button';

// After Submit, on the device. Sent (step 8): "Submitted – pending
// verification · Ref GR-2481". Saved offline (A3.1): "Saved offline – will be
// sent automatically", with no reference yet - the server gives one when the
// report reaches it. Both offer the same two ways on.
export default function SubmittedState({
  referenceNo,
  savedOffline = false,
  onViewReports,
  onReportAnother,
}) {
  return (
    <View className="flex-1 items-center justify-center px-2 py-12">
      <View
        className={[
          'mb-5 h-14 w-14 items-center justify-center rounded-full',
          savedOffline ? 'bg-warning-soft' : 'bg-success-soft',
        ].join(' ')}
      >
        <Text
          className={[
            'text-[24px] font-bold',
            savedOffline ? 'text-warning-ink' : 'text-success-ink',
          ].join(' ')}
        >
          {savedOffline ? '↑' : '✓'}
        </Text>
      </View>
      <Text className="text-center font-display text-[22px] text-ink">
        {savedOffline
          ? 'Saved offline – will be sent automatically'
          : 'Submitted – pending verification'}
      </Text>
      {savedOffline ? null : (
        <Text className="mt-2 text-center text-body text-muted">Ref {referenceNo}</Text>
      )}
      <Text className="mb-8 mt-8 text-center text-[13px] text-muted">
        {savedOffline
          ? 'It is kept on this phone and sent as soon as you are back online. You can see it in My reports.'
          : 'The duty officer for your district will review it. You’ll get a message when they do.'}
      </Text>
      <Button onPress={onViewReports}>View my reports</Button>
      <Button variant="outline" className="mt-3" onPress={onReportAnother}>
        Report another
      </Button>
    </View>
  );
}
