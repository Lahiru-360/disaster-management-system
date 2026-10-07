import Card from '../ui/Card';

// Step 2's four summary cards (PMP "Step 2 layout"). `summary` is the
// operational picture's `summary` object.
export default function SummaryCards({ summary }) {
  const cards = [
    {
      label: 'Total shelters',
      value: summary.shelters,
      detail: `${summary.sheltersNearCapacity} near capacity`,
    },
    {
      label: 'Rescue teams',
      value: summary.teams,
      detail: `${summary.teamsAvailable} available`,
    },
    {
      label: 'Relief supplies',
      value: summary.suppliesDistributed.toLocaleString('en-US'),
      detail: 'items dispatched',
    },
    {
      label: 'Affected people',
      value: summary.affectedPeople.toLocaleString('en-US'),
      detail: 'current occupancy',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <p className="text-[13px] font-semibold text-muted">{card.label}</p>
          <p className="mt-1 text-[28px] font-bold text-ink tabular-nums">{card.value}</p>
          <p className="mt-0.5 text-[13px] text-muted">{card.detail}</p>
        </Card>
      ))}
    </div>
  );
}
