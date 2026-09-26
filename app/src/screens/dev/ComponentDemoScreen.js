import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Brand from '../../components/ui/Brand';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ProgressPips from '../../components/ui/ProgressPips';
import RoleStrip from '../../components/ui/RoleStrip';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import SegmentedControl from '../../components/ui/SegmentedControl';
import TextInput from '../../components/ui/TextInput';
import { formatRelativeTime } from '../../utils/format';

function Section({ title, children }) {
  return (
    <View className="mb-8">
      <Text className="mb-3 text-lg font-semibold text-text-primary">{title}</Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}

function ButtonSection() {
  return (
    <>
      <Section title="Button - primary">
        <Button trailingArrow>Continue</Button>
        <Button fullWidth={false} trailingArrow className="self-start">
          Inline action
        </Button>
      </Section>

      <Section title="Button - small">
        <Button variant="small" fullWidth={false} className="self-start">
          Change
        </Button>
      </Section>

      <Section title="Button - states">
        <Button trailingArrow loading>
          Continue
        </Button>
        <Button trailingArrow disabled>
          Disabled
        </Button>
        <Button variant="small" fullWidth={false} disabled className="self-start">
          Change
        </Button>
      </Section>
    </>
  );
}

function TextInputSection() {
  const [email, setEmail] = useState('');
  const [focusedValue, setFocusedValue] = useState('');

  return (
    <Section title="TextInput">
      <TextInput
        label="Resting field"
        placeholder="you@example.com"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        autoFocus
        label="Focused field"
        placeholder="Tap to focus"
        value={focusedValue}
        onChangeText={setFocusedValue}
      />
      <TextInput label="Password" placeholder="Password" secureTextEntry />
      <TextInput label="With error" placeholder="Username" error="This field is required" />
      <TextInput label="Disabled" placeholder="Can't touch this" disabled />
      <TextInput
        label="With hint"
        placeholder="Display name"
        hint="This is shown to other people using the app."
      />
      <TextInput
        label="Error replaces hint"
        placeholder="Display name"
        hint="This is shown to other people using the app."
        error="Display name is required"
      />
    </Section>
  );
}

function CardSection() {
  return (
    <>
      <Section title="Card - base">
        <Card>
          <Text className="font-display text-title text-ink">Card title</Text>
          <Text className="mt-[5px] text-desc text-muted">
            Consistent padding, background, and border radius for list items and content blocks.
          </Text>
        </Card>
      </Section>

      <Section title="Card - selectable">
        <Card
          title="I'm looking for work"
          description="A short description of what this option means."
          onPress={() => {}}
        />
        <Card
          title="I'm hiring"
          description="A selected card, with its description underneath."
          selected
          onPress={() => {}}
        />
      </Section>
    </>
  );
}

function EmptyStateSection() {
  return (
    <Section title="EmptyState">
      <View className="h-64 overflow-hidden rounded-lg border border-border">
        <EmptyState message="No results found." actionLabel="Retry" onAction={() => {}} />
      </View>
    </Section>
  );
}

function LoaderSection() {
  return (
    <Section title="Loader">
      <Text className="mb-1 text-sm text-text-secondary">Inline</Text>
      <Loader />
      <Text className="mb-1 mt-3 text-sm text-text-secondary">Full-screen</Text>
      <View className="h-40 overflow-hidden rounded-lg border border-border">
        <Loader fullScreen />
      </View>
    </Section>
  );
}

function DesignTokensSection() {
  return (
    <Section title="Design tokens">
      <Text className="font-display text-h1 text-ink">Aa</Text>
      <Text className="mt-2 text-sm text-text-secondary">
        font-display text-h1 text-ink - verifies the display token set (Schibsted Grotesk, size, and
        color) renders correctly on device.
      </Text>
    </Section>
  );
}

const COLOR_TOKEN_SWATCHES = [
  { name: 'ink', className: 'bg-ink' },
  { name: 'paper', className: 'bg-paper' },
  { name: 'haze', className: 'bg-haze' },
  { name: 'line', className: 'bg-line' },
  { name: 'muted', className: 'bg-muted' },
  { name: 'muted-dark', className: 'bg-muted-dark' },
  { name: 'signal', className: 'bg-signal' },
  { name: 'signal-soft', className: 'bg-signal-soft' },
  { name: 'signal-ink', className: 'bg-signal-ink' },
  { name: 'danger', className: 'bg-danger' },
  { name: 'danger-soft', className: 'bg-danger-soft' },
  { name: 'danger-ink', className: 'bg-danger-ink' },
  { name: 'success-soft', className: 'bg-success-soft' },
  { name: 'success-ink', className: 'bg-success-ink' },
  { name: 'warning-soft', className: 'bg-warning-soft' },
  { name: 'warning-ink', className: 'bg-warning-ink' },
];

const RADIUS_TOKEN_SWATCHES = [
  { name: 'ds-sheet', className: 'rounded-ds-sheet bg-haze' },
  { name: 'ds-lg', className: 'rounded-ds-lg bg-haze' },
  { name: 'ds-md', className: 'rounded-ds-md bg-haze' },
  { name: 'ds-sm', className: 'rounded-ds-sm bg-haze' },
];

function TokenSwatch({ name, prefix, swatchClassName }) {
  return (
    <View className="w-[84px] items-center gap-1.5">
      <View className={['h-12 w-12 border border-line', swatchClassName].join(' ')} />
      <Text className="text-center text-[10px] text-text-secondary">
        {prefix}
        {name}
      </Text>
    </View>
  );
}

function TokenSwatchSection() {
  return (
    <Section title="Design tokens - v3 swatches">
      <Text className="text-sm text-text-secondary">
        Every v3 colour token and radius, rendered from its Tailwind class name so the set can be
        checked on a device instead of read out of tailwind.config.js.
      </Text>

      <View className="mt-1 flex-row flex-wrap gap-4">
        {COLOR_TOKEN_SWATCHES.map((token) => (
          <TokenSwatch
            key={token.name}
            name={token.name}
            prefix="bg-"
            swatchClassName={token.className}
          />
        ))}
      </View>

      <Text className="mb-1 mt-6 text-sm font-medium text-text-primary">Radius - ds-*</Text>
      <View className="flex-row flex-wrap gap-4">
        {RADIUS_TOKEN_SWATCHES.map((token) => (
          <TokenSwatch
            key={token.name}
            name={token.name}
            prefix="rounded-"
            swatchClassName={token.className}
          />
        ))}
      </View>
    </Section>
  );
}

function AuthPrimitivesSection() {
  return (
    <Section title="Auth primitives">
      <View className="self-start rounded-ds-lg bg-ink p-4">
        <Brand />
      </View>
      <ProgressPips total={4} current={2} caption />
      <Notice>A notice gives short, helpful context about the step you&apos;re on.</Notice>
      <Notice variant="error">Something went wrong. Please try again.</Notice>
      <RoleStrip value="I'm looking for work" onAction={() => {}} />
    </Section>
  );
}

function ScreenSection() {
  return (
    <Section title="Screen">
      <Text className="text-sm text-text-secondary">
        This demo screen is itself wrapped in {'<Screen scroll>'} - safe area insets, horizontal
        padding, and scrolling come from it, so nothing below re-implements that layout.
      </Text>
    </Section>
  );
}

function BadgeSection() {
  return (
    <Section title="Badge">
      <View className="flex-row flex-wrap gap-2">
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="positive">Positive</Badge>
        <Badge variant="strong">Strong</Badge>
        <Badge variant="muted">Muted</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Danger</Badge>
      </View>
    </Section>
  );
}

function ChipSection() {
  const [scheduleValue, setScheduleValue] = useState('weekday');
  const [skillSelected, setSkillSelected] = useState(true);

  return (
    <Section title="Chip">
      <Text className="text-sm text-text-secondary">Default size, selectable</Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip selected={scheduleValue === 'weekday'} onPress={() => setScheduleValue('weekday')}>
          Weekday evenings
        </Chip>
        <Chip selected={scheduleValue === 'weekends'} onPress={() => setScheduleValue('weekends')}>
          Weekends
        </Chip>
      </View>

      <Text className="mt-3 text-sm text-text-secondary">Small size, selectable</Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip size="sm" selected={skillSelected} onPress={() => setSkillSelected((v) => !v)}>
          Tutoring
        </Chip>
        <Chip size="sm" selected={!skillSelected} onPress={() => setSkillSelected((v) => !v)}>
          Excel
        </Chip>
      </View>

      <Text className="mt-3 text-sm text-text-secondary">Static (no onPress)</Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip>Customer service</Chip>
      </View>
    </Section>
  );
}

function AvatarSection() {
  const imageUri = 'https://i.pravatar.cc/150?img=12';

  return (
    <Section title="Avatar">
      <Text className="text-sm text-text-secondary">With image</Text>
      <View className="flex-row items-center gap-4">
        <Avatar uri={imageUri} name="Ashan Perera" size="sm" />
        <Avatar uri={imageUri} name="Ashan Perera" size="md" />
        <Avatar uri={imageUri} name="Ashan Perera" size="lg" />
      </View>

      <Text className="mt-3 text-sm text-text-secondary">No image - initials fallback</Text>
      <View className="flex-row items-center gap-4">
        <Avatar name="Ashan Perera" size="sm" />
        <Avatar name="Ashan Perera" size="md" />
        <Avatar name="Ashan Perera" size="lg" />
      </View>
    </Section>
  );
}

function SectionLabelSection() {
  return (
    <Section title="SectionLabel">
      <SectionLabel>Skills</SectionLabel>
    </Section>
  );
}

function ScreenHeaderSection() {
  return (
    <Section title="ScreenHeader">
      <Text className="text-sm text-text-secondary">Default title, avatar right slot</Text>
      <View className="overflow-hidden rounded-lg border border-border bg-paper">
        <ScreenHeader title="Explore" rightSlot={<Avatar name="Ashan Perera" size="sm" />} />
      </View>

      <Text className="mt-3 text-sm text-text-secondary">Small title, back button</Text>
      <View className="overflow-hidden rounded-lg border border-border bg-paper">
        <ScreenHeader title="Work experience" small onBack={() => {}} />
      </View>

      <Text className="mt-3 text-sm text-text-secondary">
        Small title, back button, text action right slot
      </Text>
      <View className="overflow-hidden rounded-lg border border-border bg-paper">
        <ScreenHeader
          title="Work experience"
          small
          onBack={() => {}}
          rightSlot={<Text className="text-[14px] font-bold text-signal">+ Add</Text>}
        />
      </View>
    </Section>
  );
}

function HeroHeaderSection() {
  const [stickyVisible, setStickyVisible] = useState(false);

  return (
    <Section title="HeroHeader">
      <Text className="text-sm text-text-secondary">
        Scroll inside the box below: the ink hero scrolls away with the content and the white sticky
        bar takes over, exactly as a screen composing HeroHeader/HeroStickyBar/HeroSheet would wire
        it.
      </Text>
      <View className="h-[420px] overflow-hidden rounded-lg border border-border">
        <ScrollView
          onScroll={(event) => setStickyVisible(event.nativeEvent.contentOffset.y > 160)}
          scrollEventThrottle={16}
        >
          <HeroHeader>
            <Text className="text-center font-display text-[22px] text-paper">Ashan Perera</Text>
            <Text className="mt-1 text-center text-[13px] text-muted-dark">
              Job Seeker · Colombo
            </Text>
          </HeroHeader>
          <HeroSheet>
            <View className="gap-3 px-5 py-6">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
                <View key={row} className="h-12 rounded-md bg-haze" />
              ))}
            </View>
          </HeroSheet>
        </ScrollView>

        <View className="absolute left-0 right-0 top-0">
          <HeroStickyBar title="Ashan Perera" visible={stickyVisible} onBack={() => {}} />
        </View>
      </View>
    </Section>
  );
}

function SegmentedControlSection() {
  const [status, setStatus] = useState('all');

  return (
    <Section title="SegmentedControl">
      <SegmentedControl
        options={[
          { value: 'all', label: 'All 7' },
          { value: 'live', label: 'Live 3' },
          { value: 'decided', label: 'Decided 4' },
        ]}
        value={status}
        onChange={setStatus}
      />
    </Section>
  );
}

function ConfirmDialogSection() {
  const [openDialog, setOpenDialog] = useState(null);

  return (
    <Section title="ConfirmDialog">
      <Button variant="small" fullWidth={false} onPress={() => setOpenDialog('default')}>
        Open - default
      </Button>
      <Button variant="small" fullWidth={false} onPress={() => setOpenDialog('destructive')}>
        Open - destructive
      </Button>

      <ConfirmDialog
        visible={openDialog === 'default'}
        title="Archive this item?"
        body="You can restore it later."
        confirmLabel="Archive"
        cancelLabel="Cancel"
        onConfirm={() => setOpenDialog(null)}
        onCancel={() => setOpenDialog(null)}
      />
      <ConfirmDialog
        visible={openDialog === 'destructive'}
        destructive
        title="Delete this item?"
        body="This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={() => setOpenDialog(null)}
        onCancel={() => setOpenDialog(null)}
      />
    </Section>
  );
}

function FormattersSection() {
  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const relativeTimeExamples = [
    { label: 'Under a minute', date: new Date(now.getTime() - 30 * 1000) },
    { label: 'Under an hour', date: new Date(now.getTime() - 20 * 60 * 1000) },
    { label: 'Under a day', date: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
    { label: 'Under a week', date: new Date(now.getTime() - 5 * DAY_MS) },
    { label: 'Beyond a week', date: new Date(now.getTime() - 20 * DAY_MS) },
  ];

  return (
    <Section title="Formatters">
      <Text className="text-sm font-medium text-text-primary">Relative time</Text>
      {relativeTimeExamples.map((example) => (
        <Text key={example.label} className="text-sm text-text-secondary">
          {example.label}: {formatRelativeTime(example.date, now)}
        </Text>
      ))}
    </Section>
  );
}

export default function ComponentDemoScreen() {
  return (
    <Screen scroll>
      <Text className="mb-6 text-2xl font-bold text-text-primary">UI Kit</Text>
      <ScreenSection />
      <DesignTokensSection />
      <TokenSwatchSection />
      <AuthPrimitivesSection />
      <ButtonSection />
      <TextInputSection />
      <CardSection />
      <EmptyStateSection />
      <LoaderSection />
      <BadgeSection />
      <ChipSection />
      <AvatarSection />
      <SectionLabelSection />
      <ScreenHeaderSection />
      <HeroHeaderSection />
      <SegmentedControlSection />
      <ConfirmDialogSection />
      <FormattersSection />
    </Screen>
  );
}
