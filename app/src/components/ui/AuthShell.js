import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

function EmberGlow() {
  return (
    <View pointerEvents="none" className="absolute -right-[110px] -top-[120px] h-[340px] w-[340px]">
      <Svg width={340} height={340} viewBox="0 0 340 340">
        <Defs>
          <RadialGradient id="emberGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="rgb(255, 74, 28)" stopOpacity={0.34} />
            <Stop offset="46%" stopColor="rgb(255, 74, 28)" stopOpacity={0.08} />
            <Stop offset="72%" stopColor="rgb(255, 74, 28)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="340" height="340" fill="url(#emberGlow)" />
      </Svg>
    </View>
  );
}

/**
 * Presentational layout shared by the auth screens.
 *
 * `header` is rendered in the dark region. The sheet children are a flex column,
 * which lets a screen use a `flex-1` spacer to align content at the bottom.
 */
export default function AuthShell({
  header,
  children,
  className,
  headerClassName,
  sheetClassName,
  contentClassName,
  scroll = false,
  keyboardVerticalOffset = 0,
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
      className={['flex-1', className].filter(Boolean).join(' ')}
    >
      <View className="flex-1 overflow-hidden bg-ink">
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <EmberGlow />

        <SafeAreaView
          edges={['top']}
          className={['relative px-[26px] pb-[34px]', headerClassName].filter(Boolean).join(' ')}
        >
          {header}
        </SafeAreaView>

        <View
          className={['flex-1 overflow-hidden rounded-t-ds-sheet bg-paper', sheetClassName]
            .filter(Boolean)
            .join(' ')}
        >
          <SafeAreaView edges={['bottom']} className="flex-1">
            {scroll ? (
              <ScrollView
                className="flex-1"
                contentContainerClassName="flex-grow"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                onTouchStart={Keyboard.dismiss}
              >
                <View
                  className={['flex-1 flex-col px-[26px] pt-[30px]', contentClassName]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {children}
                </View>
              </ScrollView>
            ) : (
              <View
                className={['flex-1 flex-col px-[26px] pt-[30px]', contentClassName]
                  .filter(Boolean)
                  .join(' ')}
              >
                {children}
              </View>
            )}
          </SafeAreaView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
