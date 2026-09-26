import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import Avatar from './Avatar';

function EmberGlow() {
  return (
    <View pointerEvents="none" className="absolute -right-[110px] -top-[130px] h-[340px] w-[340px]">
      <Svg width={340} height={340} viewBox="0 0 340 340">
        <Defs>
          <RadialGradient id="heroEmberGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="rgb(255, 74, 28)" stopOpacity={0.34} />
            <Stop offset="46%" stopColor="rgb(255, 74, 28)" stopOpacity={0.08} />
            <Stop offset="72%" stopColor="rgb(255, 74, 28)" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="340" height="340" fill="url(#heroEmberGlow)" />
      </Svg>
    </View>
  );
}

/**
 * The dark ink block, meant to sit as the first child inside a screen's own
 * ScrollView. It scrolls away with the rest of the content - this component
 * has no opinion on scroll position. Pair it with `HeroStickyBar` and
 * `HeroSheet`, which the screen renders and controls itself.
 */
export default function HeroHeader({
  onBack,
  rightSlot,
  children,
  className,
  navClassName,
  contentClassName,
}) {
  return (
    <View className={['relative overflow-hidden bg-ink', className].filter(Boolean).join(' ')}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <EmberGlow />

      <SafeAreaView edges={['top']}>
        <View
          className={['h-11 flex-row items-center justify-between px-[22px]', navClassName]
            .filter(Boolean)
            .join(' ')}
        >
          {onBack ? (
            <Pressable
              onPress={onBack}
              className="h-[34px] w-[34px] items-center justify-center rounded-full border border-white/[0.14] bg-white/10"
            >
              <Text className="text-[15px] font-semibold text-paper">‹</Text>
            </Pressable>
          ) : (
            <View className="h-[34px] w-[34px]" />
          )}

          {rightSlot ?? <View className="h-[34px] w-[34px]" />}
        </View>

        <View className={['relative px-6 pb-7 pt-2', contentClassName].filter(Boolean).join(' ')}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * White bar carrying the back button and entity name once the hero has
 * scrolled off-screen. The screen owns the scroll offset and passes
 * `visible` accordingly - this component holds no state of its own.
 */
export function HeroStickyBar({
  title,
  photo,
  avatarSquare = false,
  onBack,
  visible = false,
  className,
}) {
  if (!visible) return null;

  return (
    <View
      className={[
        'flex-row items-center gap-[9px] border-b border-line bg-paper px-[22px] py-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          className="h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-line bg-haze"
        >
          <Text className="text-[15px] font-semibold text-ink">‹</Text>
        </Pressable>
      ) : null}

      <Avatar uri={photo} name={title} size="sm" square={avatarSquare} />

      <Text
        className="flex-1 font-display text-[16px] tracking-[-0.015em] text-ink"
        style={{ textAlignVertical: 'center', includeFontPadding: false }}
        numberOfLines={1}
      >
        {title}
      </Text>
    </View>
  );
}

/**
 * White section directly below the hero, top corners rounded at the `sheet`
 * radius. Defaults to `flex-1` so it always reaches the bottom of the
 * viewport even when its content is short (an empty profile, for example) -
 * the screen must give the ScrollView's content container `flexGrow: 1`
 * (NativeWind: `contentContainerClassName="grow"`) for that to take effect.
 *
 * That matters for the curve itself, not just layout: the mockup gets its
 * visible curve because the whole screen frame sits on an ink-colored
 * canvas, so the corners this rounds away reveal ink, not more white. In
 * React Native there's no such canvas by default, so the screen must also
 * give whatever wraps the hero + this sheet an ink background - otherwise
 * the rounded corner reveals white-on-white and looks flat. Keeping this
 * sheet full-height is what keeps that ink confined to the tiny corner
 * notches instead of leaking out below short content.
 */
export function HeroSheet({ children, className }) {
  return (
    <View className={['flex-1 rounded-t-ds-sheet bg-paper', className].filter(Boolean).join(' ')}>
      {children}
    </View>
  );
}
