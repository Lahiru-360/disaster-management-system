import { ActivityIndicator, Pressable, Text } from 'react-native';

const VARIANT_STYLES = {
  primary: {
    container: 'h-[58px] rounded-ds-lg bg-signal gap-[10px]',
    text: 'text-body font-semibold text-paper tracking-[-0.01em]',
    spinnerClassName: 'text-paper',
  },
  small: {
    container: 'h-9 rounded-ds-sm border-[1.5px] border-line bg-paper px-4',
    text: 'text-label text-ink',
    spinnerClassName: 'text-ink',
  },
  outline: {
    container: 'h-[58px] rounded-ds-lg border-[1.5px] border-line bg-paper gap-[10px]',
    text: 'text-body font-semibold text-ink tracking-[-0.01em]',
    spinnerClassName: 'text-ink',
  },
  'small-danger': {
    container: 'h-9 rounded-ds-sm border-[1.5px] border-danger bg-paper px-4',
    text: 'text-label text-danger-ink',
    spinnerClassName: 'text-danger-ink',
  },
};

export default function Button({
  children,
  variant = 'primary',
  trailingArrow = false,
  disabled = false,
  loading = false,
  fullWidth = true,
  onPress,
  className,
  ...props
}) {
  const isDisabled = disabled || loading;
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.primary;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      className={[
        'flex-row items-center justify-center',
        styles.container,
        fullWidth && 'w-full',
        isDisabled && 'opacity-40',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <ActivityIndicator className={styles.spinnerClassName} />
      ) : (
        <>
          <Text className={styles.text}>{children}</Text>
          {variant === 'primary' && trailingArrow && (
            <Text className="text-[15px] font-semibold text-paper tracking-[-0.01em]">→</Text>
          )}
        </>
      )}
    </Pressable>
  );
}
