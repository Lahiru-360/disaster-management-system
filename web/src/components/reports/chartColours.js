// Colours for the report charts. Recharts draws SVG and takes colours as
// props, not classes, so these point at the design tokens in global.css
// through their CSS variables: still one palette, never raw hex.
const token = (name) => `var(--color-${name})`;

// For series that only need telling apart (districts, organisations), in turn.
export const SERIES_COLOURS = Object.freeze([
  token('navy'),
  token('caution'),
  token('success'),
  token('warning'),
  token('danger'),
  token('muted'),
]);

export const seriesColour = (index) => SERIES_COLOURS[index % SERIES_COLOURS.length];

export const CHANNEL_COLOURS = Object.freeze({
  PUSH: token('navy'),
  SMS: token('success'),
  AUDIBLE: token('caution'),
});

// The colours global.css gives severity-low ... severity-severe. Those are
// `@theme inline` tokens, which have no CSS variable of their own, so the
// chart names the colours they point at.
export const SEVERITY_COLOURS = Object.freeze({
  LOW: token('navy'),
  MEDIUM: token('warning'),
  HIGH: token('caution'),
  SEVERE: token('danger'),
});

export const CHART = Object.freeze({
  grid: token('line'),
  axis: token('muted'),
  gapFill: token('warning-soft'),
  // The band behind the hovered bar group.
  cursor: token('haze'),
});
