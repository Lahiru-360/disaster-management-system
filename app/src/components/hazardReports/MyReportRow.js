import { Pressable, Text, View } from 'react-native';

import { dismissalReasonLabel, hazardTypeLabel } from '../../constants/hazardReports';
import { formatRelativeTime } from '../../utils/format';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

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
    case 'QUEUED':
    case 'WAITING':
      return { variant: 'strong', label: 'Waiting to send' };
    case 'SENDING':
      return { variant: 'neutral', label: 'Sending…' };
    case 'NEEDS_ATTENTION':
      return { variant: 'danger', label: 'Needs attention' };
    default:
      return { variant: 'warning', label: 'Pending verification' };
  }
}

// One of the reporter's own reports on My reports: reference, type, when it
// was sent, and where its review stands. A report still on the phone (A3/E2)
// also says why it is waiting, offers Retry now, and - when the server refused
// it - opens the form to correct it (`onPress`).
export default function MyReportRow({ report, onRetry, onPress }) {
  const badge = statusBadge(report);
  const onPhone = Boolean(report.queued);
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className={[
        'mb-3 rounded-ds-card border-[1.5px] bg-paper p-4',
        report.status === 'NEEDS_ATTENTION' ? 'border-danger' : 'border-line',
      ].join(' ')}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-body font-semibold text-ink">{report.referenceNo}</Text>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </View>
      <Text className="mt-1 text-[14px] text-ink">{hazardTypeLabel(report.hazardType)}</Text>
      <Text className="mt-1 text-[13px] text-muted">{formatRelativeTime(report.submittedAt)}</Text>
      {onPhone && report.note ? (
        <Text
          className={[
            'mt-2 text-[13px]',
            report.status === 'NEEDS_ATTENTION' ? 'text-danger-ink' : 'text-muted',
          ].join(' ')}
        >
          {report.note}
        </Text>
      ) : null}
      {onPhone && report.status !== 'SENDING' ? (
        <Button variant="small" fullWidth={false} className="mt-3" onPress={onRetry}>
          Retry now
        </Button>
      ) : null}
    </Container>
  );
}
