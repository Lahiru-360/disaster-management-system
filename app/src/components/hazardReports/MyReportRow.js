import { Text, View } from 'react-native';

import { dismissalReasonLabel, hazardTypeLabel } from '../../constants/hazardReports';
import { formatRelativeTime } from '../../utils/format';
import Badge from '../ui/Badge';

// How each status reads on the reporter's list (UC02 steps 8, 14 and A1.3).
function statusBadge(report) {
  switch (report.status) {
    case 'CONFIRMED':
      return { variant: 'positive', label: 'Confirmed' };
    case 'DISMISSED':
      return {
        variant: 'muted',
        label: report.dismissalReason
          ? `Dismissed · ${dismissalReasonLabel(report.dismissalReason)}`
          : 'Dismissed',
      };
    default:
      return { variant: 'warning', label: 'Pending verification' };
  }
}

// One of the reporter's own reports on My reports: reference, type, when it
// was sent, and where its review stands.
export default function MyReportRow({ report }) {
  const badge = statusBadge(report);

  return (
    <View className="mb-3 rounded-ds-card border-[1.5px] border-line bg-paper p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-body font-semibold text-ink">{report.referenceNo}</Text>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </View>
      <Text className="mt-1 text-[14px] text-ink">{hazardTypeLabel(report.hazardType)}</Text>
      <Text className="mt-1 text-[13px] text-muted">{formatRelativeTime(report.submittedAt)}</Text>
    </View>
  );
}
