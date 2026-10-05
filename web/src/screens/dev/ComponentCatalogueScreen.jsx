import { useState } from 'react';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ChipGroup from '../../components/ui/ChipGroup';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import DataTable from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import MapView from '../../components/ui/MapView';
import Modal from '../../components/ui/Modal';
import Notice from '../../components/ui/Notice';
import ProgressBar from '../../components/ui/ProgressBar';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import Select from '../../components/ui/Select';
import StatusBadge from '../../components/ui/StatusBadge';
import Tabs from '../../components/ui/Tabs';
import TextArea from '../../components/ui/TextArea';
import TextInput from '../../components/ui/TextInput';

// The UI kit catalogue at /dev/components (dev builds only, see
// RootNavigator): every shared component in each of its states, as the kit's
// reference and a visual check. Sample data only - it calls no API.

// Swatches name their classes in full so Tailwind generates them.
const SHELTER_SWATCHES = [
  ['Available', 'bg-shelter-available', 'bg-shelter-available-soft text-shelter-available-ink'],
  ['Filling up', 'bg-shelter-filling', 'bg-shelter-filling-soft text-shelter-filling-ink'],
  [
    'Near capacity',
    'bg-shelter-near-capacity',
    'bg-shelter-near-capacity-soft text-shelter-near-capacity-ink',
  ],
  ['Full', 'bg-shelter-full', 'bg-shelter-full-soft text-shelter-full-ink'],
];

const SEVERITY_SWATCHES = [
  ['Low', 'bg-severity-low', 'bg-severity-low-soft text-severity-low-ink'],
  ['Medium', 'bg-severity-medium', 'bg-severity-medium-soft text-severity-medium-ink'],
  ['High', 'bg-severity-high', 'bg-severity-high-soft text-severity-high-ink'],
  ['Severe', 'bg-severity-severe', 'bg-severity-severe-soft text-severity-severe-ink'],
];

const SHELTERS = [
  { id: 's1', name: 'Gampaha Central College', occupants: 120, capacity: 300 },
  { id: 's2', name: 'Ja-Ela Temple Hall', occupants: 230, capacity: 280 },
  { id: 's3', name: 'Kelaniya Community Centre', occupants: 184, capacity: 200 },
  { id: 's4', name: 'Wattala Public Library', occupants: 150, capacity: 150 },
];

const MARKERS = [
  { id: 'm1', lat: 7.0917, lng: 79.9999, type: 'incident', label: 'Flood – Gampaha District' },
  { id: 'm2', lat: 7.04, lng: 79.95, type: 'shelter', label: 'Gampaha Central College' },
  { id: 'm3', lat: 7.08, lng: 79.89, type: 'shelter', tone: 'danger', label: 'Wattala (full)' },
  { id: 'm4', lat: 7.13, lng: 80.05, type: 'team', label: 'Team Alpha' },
  { id: 'm5', lat: 6.95, lng: 79.92, type: 'report', label: 'Rising river report' },
];

const OPTIONS = [
  { value: 'FLOOD', label: 'Flood' },
  { value: 'LANDSLIDE', label: 'Landslide' },
  { value: 'CYCLONE', label: 'Cyclone' },
  { value: 'DROUGHT', label: 'Drought' },
];

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <SectionLabel>{title}</SectionLabel>
      <Card className="mt-2 flex flex-col gap-4">{children}</Card>
    </section>
  );
}

function Row({ children }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function Swatches({ title, swatches }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink">{title}</p>
      <Row>
        {swatches.map(([label, fill, pill]) => (
          <span
            key={label}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold ${pill}`}
          >
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${fill}`} />
            {label}
          </span>
        ))}
      </Row>
    </div>
  );
}

export default function ComponentCatalogueScreen() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(null);
  const [tab, setTab] = useState('districts');
  const [hazard, setHazard] = useState('FLOOD');
  const [hazards, setHazards] = useState(['FLOOD']);
  const [message, setMessage] = useState('Heavy rain expected. Move to higher ground.');
  const [selected, setSelected] = useState(new Set(['s2']));
  const [picked, setPicked] = useState(null);

  const columns = [
    { key: 'name', header: 'Shelter' },
    { key: 'occupancy', header: 'Occupancy', render: (row) => `${row.occupants}/${row.capacity}` },
    {
      key: 'bar',
      header: 'Fill',
      render: (row) => <ProgressBar value={row.occupants} max={row.capacity} />,
    },
  ];

  return (
    <div className="min-h-screen bg-haze">
      <Screen className="mx-auto max-w-5xl">
        <ScreenHeader
          title="UI kit catalogue"
          rightSlot={<StatusBadge tone="warning">Dev build only</StatusBadge>}
        />

        <Section title="Design tokens">
          <Swatches title="Shelter status" swatches={SHELTER_SWATCHES} />
          <Swatches title="Severity" swatches={SEVERITY_SWATCHES} />
        </Section>

        <Section title="Button">
          <Row>
            {['primary', 'outline', 'small', 'danger'].map((variant) => (
              <Button key={variant} variant={variant} fullWidth={false}>
                {variant}
              </Button>
            ))}
            <Button fullWidth={false} loading>
              Loading
            </Button>
            <Button fullWidth={false} disabled>
              Disabled
            </Button>
          </Row>
          <div className="rounded-lg bg-navy p-3">
            <Button variant="small-inverse" fullWidth={false}>
              small-inverse
            </Button>
          </div>
        </Section>

        <Section title="StatusBadge">
          <Row>
            {['success', 'warning', 'danger', 'info', 'neutral'].map((tone) => (
              <StatusBadge key={tone} tone={tone}>
                {tone}
              </StatusBadge>
            ))}
          </Row>
        </Section>

        <Section title="Notice">
          <Notice>Only closed events are listed.</Notice>
          <Notice variant="error">Export failed - try again.</Notice>
        </Section>

        <Section title="Modal and ConfirmDialog">
          <Row>
            <Button variant="outline" fullWidth={false} onClick={() => setModalOpen(true)}>
              Open modal
            </Button>
            <Button variant="outline" fullWidth={false} onClick={() => setConfirmOpen('plain')}>
              Open confirm
            </Button>
            <Button
              variant="danger"
              fullWidth={false}
              onClick={() => setConfirmOpen('destructive')}
            >
              Open destructive confirm
            </Button>
          </Row>
          <Modal open={modalOpen} onClose={() => setModalOpen(false)} labelledBy="catalogue-modal">
            <h2 id="catalogue-modal" className="text-lg font-semibold text-ink">
              A modal
            </h2>
            <p className="mt-2 text-sm text-muted">Esc, the backdrop or the button closes it.</p>
            <Button className="mt-4" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </Modal>
          <ConfirmDialog
            open={confirmOpen !== null}
            title={confirmOpen === 'destructive' ? 'Cancel this warning?' : 'Broadcast warning?'}
            confirmLabel={confirmOpen === 'destructive' ? 'Cancel warning' : 'Broadcast'}
            destructive={confirmOpen === 'destructive'}
            onConfirm={() => setConfirmOpen(null)}
            onBack={() => setConfirmOpen(null)}
          >
            This reaches every citizen in the selected districts.
          </ConfirmDialog>
        </Section>

        <Section title="DataTable">
          <DataTable
            columns={columns}
            rows={SHELTERS}
            rowKey={(row) => row.id}
            selectable
            selectedKeys={selected}
            onSelectionChange={setSelected}
          />
          <DataTable columns={columns} rows={[]} />
        </Section>

        <Section title="ProgressBar">
          {[40, 80, 95, 100].map((value) => (
            <ProgressBar key={value} value={value} label={`${value}% full`} />
          ))}
        </Section>

        <Section title="EmptyState">
          <EmptyState
            icon="∅"
            title="No data for this selection"
            description="Try another event or a wider date range."
            action={
              <Button variant="small" fullWidth={false}>
                Reset filters
              </Button>
            }
          />
        </Section>

        <Section title="Tabs">
          <Tabs
            tabs={[
              { key: 'districts', label: 'Districts' },
              { key: 'basins', label: 'River basins' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <p className="text-sm text-muted">Selected: {tab}</p>
        </Section>

        <Section title="ChipGroup">
          <ChipGroup options={OPTIONS} value={hazard} onChange={setHazard} />
          <ChipGroup options={OPTIONS} value={hazards} onChange={setHazards} multiple />
        </Section>

        <Section title="Form fields">
          <TextInput label="Recipient email" placeholder="liaison@example.org" />
          <TextInput
            label="With an error"
            defaultValue="not-an-email"
            error="Enter an email address."
          />
          <TextInput label="Disabled" defaultValue="Read only" disabled />
          <Select label="Hazard type" options={OPTIONS} placeholder="Choose one" />
          <Select label="With an error" options={OPTIONS} error="Choose a hazard type." />
          <TextArea
            label="Message"
            maxLength={160}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            hint="Shown on every channel."
          />
          <TextArea label="With an error" value="" readOnly error="A message is required." />
        </Section>

        <Section title="Loader">
          <Loader />
        </Section>

        <Section title="MapView">
          <MapView
            markers={MARKERS}
            center={{ lat: 7.05, lng: 79.97 }}
            zoom={11}
            label="Live map"
          />
          <MapView
            onPick={(lat, lng) => setPicked({ lat, lng })}
            picked={picked}
            label="Pick a location"
          />
          <p className="text-sm text-muted">
            Picked: {picked ? `${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}` : 'nothing yet'}
          </p>
        </Section>
      </Screen>
    </div>
  );
}
