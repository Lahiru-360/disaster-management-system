import { ActivityIndicator, View } from 'react-native';

export default function Loader({ fullScreen = false, size = 'large', className, ...props }) {
  return (
    <View
      className={[
        fullScreen
          ? 'flex-1 items-center justify-center bg-bg-main'
          : 'items-center justify-center py-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <ActivityIndicator size={size} className="text-signal" />
    </View>
  );
}
