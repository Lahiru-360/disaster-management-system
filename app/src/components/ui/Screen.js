import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Screen({
  children,
  scroll = false,
  className,
  contentClassName,
  // Bottom-tab screens should override this to ['top'] - the tab bar
  // already bakes the bottom safe-area inset into its own height, so
  // adding it here too doubles the gap above the tab bar.
  edges = ['top', 'bottom'],
  ...props
}) {
  const paddedClassName = ['px-4', contentClassName].filter(Boolean).join(' ');

  return (
    <SafeAreaView
      className={['flex-1 bg-bg-main', className].filter(Boolean).join(' ')}
      edges={edges}
    >
      {scroll ? (
        <ScrollView className="flex-1" contentContainerClassName={paddedClassName} {...props}>
          {children}
        </ScrollView>
      ) : (
        <View className={['flex-1', paddedClassName].filter(Boolean).join(' ')} {...props}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
