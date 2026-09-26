// The scroll behaviour shared by every screen that opens on the gradient
// hero, kept in one place so those screens don't each keep their own copy of
// the offset maths and drift apart.
//
// `HeroHeader`, `HeroStickyBar` and `HeroSheet` render the blocks and hold
// no scroll state of their own; this hook supplies it.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated } from 'react-native';

// Used only for the frames before the hero has reported its own height.
// The hero is measured on layout, so this never decides the real handover
// point - it just keeps the bar hidden until the measurement lands.
const FALLBACK_HERO_HEIGHT = 260;

// How far above the handover point the bar starts fading in. Roughly the
// bar's own height, so it reads as the bar sliding in underneath the status
// bar exactly as the hero clears the top rather than popping into place.
const DEFAULT_FADE_BAND = 56;

// The bar only becomes touchable once it is essentially solid, and only
// stops being touchable once it is essentially gone. Both are read as a
// fraction of the fade band. Without the gap between them, a scroll resting
// on the handover point would re-render on every frame.
const INTERACTIVE_AT = 0.9;
const INERT_AT = 0.1;

/**
 * Drives the hero → sticky bar handover for one scrolling screen.
 *
 * The opacity is interpolated from the scroll offset on the native side, so
 * the fade never waits on a JS frame and there is no flicker at the point
 * where the hero leaves and the bar takes over. React state changes once
 * per crossing - to flip `pointerEvents` - not once per scroll event.
 *
 * Compose it like this (the sticky bar stays mounted; the wrapper's opacity
 * is what shows and hides it, which is why `visible` is always true):
 *
 *   const hero = useHeroScroll();
 *
 *   <Animated.ScrollView onScroll={hero.onScroll}
 *     scrollEventThrottle={hero.scrollEventThrottle}>
 *     <View onLayout={hero.onHeroLayout}>
 *       <HeroHeader onBack={goBack}>{...}</HeroHeader>
 *     </View>
 *     <HeroSheet>{...}</HeroSheet>
 *   </Animated.ScrollView>
 *
 *   <Animated.View
 *     pointerEvents={hero.stickyPointerEvents}
 *     style={hero.stickyStyle}
 *     className="absolute inset-x-0 top-0"
 *   >
 *     <SafeAreaView edges={['top']} className="bg-paper">
 *       <HeroStickyBar visible title={name} onBack={goBack} />
 *     </SafeAreaView>
 *   </Animated.View>
 *
 * `HeroSheet` already carries the `sheet` radius on both top corners, so the
 * white section beneath the hero needs nothing extra here.
 *
 * @param {object} [options]
 * @param {number} [options.fadeBand] Pixels of scroll the fade is spread over.
 * @returns {{
 *   onScroll: Function,
 *   scrollEventThrottle: number,
 *   onHeroLayout: Function,
 *   stickyStyle: object,
 *   stickyPointerEvents: 'auto' | 'none',
 *   isStickyVisible: boolean,
 *   scrollY: Animated.Value,
 * }}
 */
export default function useHeroScroll({ fadeBand = DEFAULT_FADE_BAND } = {}) {
  // Lazy state rather than a ref: the value is created once and never
  // replaced, and it is read during render by the interpolation below.
  const [scrollY] = useState(() => new Animated.Value(0));
  const [heroHeight, setHeroHeight] = useState(FALLBACK_HERO_HEIGHT);
  const [isStickyVisible, setIsStickyVisible] = useState(false);

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  // The hero is fully off-screen at `heroHeight`; the fade finishes there.
  // `Math.max(1, …)` keeps the input range strictly increasing on the first
  // frames of a very short hero, which an interpolation requires.
  const stickyOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [Math.max(0, heroHeight - fadeBand), Math.max(1, heroHeight)],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [scrollY, heroHeight, fadeBand],
  );

  // The offset is owned natively, so the only thing JS still needs from it
  // is when the bar becomes touchable. A listener on the value itself keeps
  // working under the native driver; the interpolation above stays entirely
  // on the native side.
  useEffect(() => {
    const interactiveAt = heroHeight - fadeBand * (1 - INTERACTIVE_AT);
    const inertAt = heroHeight - fadeBand * (1 - INERT_AT);

    const id = scrollY.addListener(({ value }) => {
      setIsStickyVisible((wasVisible) => {
        if (!wasVisible && value >= interactiveAt) return true;
        if (wasVisible && value <= inertAt) return false;
        return wasVisible;
      });
    });

    return () => scrollY.removeListener(id);
  }, [scrollY, heroHeight, fadeBand]);

  const onHeroLayout = useCallback((event) => {
    const { height } = event.nativeEvent.layout;
    // Layout fires on every rotation and font change; ignore the no-ops so
    // the interpolation is not rebuilt mid-scroll.
    setHeroHeight((current) => (Math.round(height) === Math.round(current) ? current : height));
  }, []);

  const stickyStyle = useMemo(() => ({ opacity: stickyOpacity }), [stickyOpacity]);

  return {
    onScroll,
    scrollEventThrottle: 16,
    onHeroLayout,
    stickyStyle,
    stickyPointerEvents: isStickyVisible ? 'auto' : 'none',
    isStickyVisible,
    scrollY,
  };
}
