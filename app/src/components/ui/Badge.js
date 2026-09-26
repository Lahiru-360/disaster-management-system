import { Text } from 'react-native';

const VARIANT_STYLES = {
  neutral: 'bg-haze text-muted',
  positive: 'bg-success-soft text-success-ink',
  strong: 'bg-signal-soft text-signal-ink',
  muted: 'bg-haze text-muted-dark',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
};

export default function Badge({ children, variant = 'neutral', className, ...props }) {
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.neutral;

  return (
    <Text
      className={[
        'self-start rounded-full px-2.5 py-1 text-[11px] font-semibold',
        styles,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </Text>
  );
}
