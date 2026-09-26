import { Text } from 'react-native';

export default function SectionLabel({ children, className, ...props }) {
  return (
    <Text
      className={['text-[11px] font-bold uppercase tracking-[0.13em] text-muted', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </Text>
  );
}
