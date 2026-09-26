import { useState } from 'react';
import { Image, Text, View } from 'react-native';

const SIZE_STYLES = {
  sm: { box: 'h-[34px] w-[34px]', text: 'text-[12.5px]' },
  md: { box: 'h-11 w-11', text: 'text-[15px]' },
  lg: { box: 'h-[84px] w-[84px]', text: 'text-[26px]' },
};

function getInitials(name) {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// A business's own avatar is square rather than round - the v3 mockup uses
// this as the only visual marker distinguishing a business from a seeker
// wherever an avatar appears alone, so it needs to survive independent of
// whatever name/label sits next to it.
export default function Avatar({ uri, name, size = 'md', square = false, className, ...props }) {
  const [failed, setFailed] = useState(false);
  const sizeStyles = SIZE_STYLES[size] ?? SIZE_STYLES.md;
  const shape = square ? 'rounded-[24px]' : 'rounded-full';

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        className={[shape, sizeStyles.box, className].filter(Boolean).join(' ')}
        {...props}
      />
    );
  }

  return (
    <View
      className={[
        'items-center justify-center border-[1.5px] border-line bg-haze',
        shape,
        sizeStyles.box,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <Text className={['font-display text-ink', sizeStyles.text].join(' ')}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
