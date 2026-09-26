import { Text, View } from 'react-native';
import Button from './Button';

export default function EmptyState({ message, actionLabel, onAction, className, ...props }) {
  return (
    <View
      className={['flex-1 items-center justify-center px-6 py-12', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <Text className="text-center text-base text-text-secondary">{message}</Text>
      {actionLabel ? (
        <Button className="mt-4" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
