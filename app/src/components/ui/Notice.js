import { Text, View } from 'react-native';

const VARIANT_STYLES = {
  info: {
    container: 'bg-signal-soft',
    dot: 'bg-signal',
    text: 'text-signal-ink',
  },
  error: {
    container: 'bg-danger-soft',
    dot: 'bg-danger',
    text: 'text-danger-ink',
  },
};

export default function Notice({ children, variant = 'info', icon = '!', className, ...props }) {
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.info;

  return (
    <View
      className={[
        'flex-row items-start gap-[10px] rounded-ds-md px-[14px] py-[12px]',
        styles.container,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <View
        className={[
          'h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full',
          styles.dot,
        ].join(' ')}
      >
        <Text className="text-[11px] font-bold text-paper">{icon}</Text>
      </View>
      <Text className={['flex-1 text-[13px] font-medium leading-[18.2px]', styles.text].join(' ')}>
        {children}
      </Text>
    </View>
  );
}
