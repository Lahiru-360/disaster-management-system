import { Pressable, Text, View } from 'react-native';

const SIZE_STYLES = {
  default: { container: 'px-[13px] py-[7px]', text: 'text-[13px]' },
  sm: { container: 'px-3 py-[6px]', text: 'text-[12.5px]' },
};

export default function Chip({
  children,
  selected = false,
  size = 'default',
  onPress,
  className,
  ...props
}) {
  const Container = onPress ? Pressable : View;
  const sizeStyles = SIZE_STYLES[size] ?? SIZE_STYLES.default;

  return (
    <Container
      onPress={onPress}
      className={[
        'self-start rounded-full border-[1.5px]',
        sizeStyles.container,
        selected ? 'border-ink bg-ink' : 'border-line bg-haze',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <Text
        className={[sizeStyles.text, 'font-semibold', selected ? 'text-paper' : 'text-ink'].join(
          ' ',
        )}
      >
        {children}
      </Text>
    </Container>
  );
}
