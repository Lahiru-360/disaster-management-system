const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatShortDate(date) {
  return `${date.getDate()} ${MONTH_ABBREVIATIONS[date.getMonth()]}`;
}

export function formatRelativeTime(date, now = new Date()) {
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();

  if (diffMs < MINUTE_MS) {
    return 'Just now';
  }
  if (diffMs < HOUR_MS) {
    return `${Math.floor(diffMs / MINUTE_MS)}m ago`;
  }
  if (diffMs < DAY_MS) {
    return `${Math.floor(diffMs / HOUR_MS)}h ago`;
  }
  if (diffMs < WEEK_MS) {
    return `${Math.floor(diffMs / DAY_MS)}d ago`;
  }
  return formatShortDate(target);
}

// Binary units (1024, not 1000) since these are file sizes off the device
// picker/server, not network-transfer estimates - matches how OSes report
// picked-file sizes back to the app.
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMonthYear(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return `${MONTH_ABBREVIATIONS[date.getMonth()]} ${date.getFullYear()}`;
}

// A start date plus either an end date or an ongoing flag. With no end date
// and ongoing unset, it reads as the start month alone rather than assuming
// "Present".
export function formatDateRange({ startDate, endDate, ongoing = false }) {
  const start = formatMonthYear(startDate);
  const end = ongoing ? 'Present' : formatMonthYear(endDate);

  if (start && end) {
    return start === end ? start : `${start} - ${end}`;
  }
  return start || end || null;
}
