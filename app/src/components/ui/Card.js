import { Pressable, Text, View } from 'react-native';

export default function Card({
  children,
  title,
  description,
  selected = false,
  onPress,
  className,
  ...props
}) {
  const isSelectable = title !== undefined;
  const isSelected = isSelectable && selected;
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      className={[
        'rounded-ds-card border-[1.5px] p-5',
        isSelected ? 'border-ink bg-ink' : 'border-line bg-paper',
        isSelectable && 'flex-row items-start gap-[14px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {isSelectable ? (
        <>
          <View className="flex-1">
            <Text
              className={['font-display text-title', isSelected ? 'text-paper' : 'text-ink'].join(
                ' ',
              )}
            >
              {title}
            </Text>
            {description ? (
              <Text
                className={[
                  'mt-[5px] text-desc',
                  isSelected ? 'text-muted-dark' : 'text-muted',
                ].join(' ')}
              >
                {description}
              </Text>
            ) : null}
          </View>

          <View
            className={[
              'mt-0.5 h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
              isSelected ? 'bg-signal' : 'border-[1.5px] border-line',
            ].join(' ')}
          >
            {isSelected ? <Text className="text-[13px] font-bold text-paper">✓</Text> : null}
          </View>
        </>
      ) : (
        children
      )}
    </Container>
  );
}
