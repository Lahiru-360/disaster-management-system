import { Building2, Package, Users } from 'lucide-react';

import Card from '../ui/Card';

// Step 2's four summary cards (PMP "Step 2 layout"). `summary` is the
// operational picture's `summary` object. Each card has an icon tile in its
// own tone.
const ICON_TONES = {
  navy: 'bg-navy-soft text-navy',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

export default function SummaryCards({ summary }) {
  const cards = [
    {
      label: 'Total Shelters',
      value: summary.shelters,
      detail: `${summary.sheltersNearCapacity} near capacity`,
      Icon: Building2,
      tone: 'navy',
    },
    {
      label: 'Rescue Teams',
      value: summary.teams,
      detail: `${summary.teamsAvailable} available`,
      Icon: Users,
      tone: 'success',
    },
    {
      label: 'Relief Supplies',
      value: summary.suppliesDistributed.toLocaleString('en-US'),
      detail: 'Items dispatched',
      Icon: Package,
      tone: 'warning',
    },
    {
      label: 'Affected People',
      value: summary.affectedPeople.toLocaleString('en-US'),
      detail: 'Current occupancy',
      Icon: Users,
      tone: 'danger',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, detail, Icon, tone }) => (
        <Card key={label} className="flex items-center gap-3 p-3.5">
          <span
            className={[
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              ICON_TONES[tone],
            ].join(' ')}
          >
            <Icon size={22} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[13px] text-muted">{label}</p>
            <p className="mt-0.5 text-[22px] leading-tight font-bold text-ink tabular-nums">
              {value}
            </p>
            <p className="text-[12px] text-muted">{detail}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
