import { Text, View } from 'react-native';

import { getPasswordStrength } from '../../utils/validation';

const BAR_STYLES = {
  weak: 'bg-danger',
  medium: 'bg-strength-medium',
  strong: 'bg-success-ink',
};

const LABEL_STYLES = {
  weak: 'text-danger-ink',
  medium: 'text-warning-ink',
  strong: 'text-success-ink',
};

// Three bars, filled left to right, label reads as an instruction rather
// than a verdict. Shared by ChangePasswordScreen and ResetPasswordScreen so
// the three-bar rule lives in one place instead of being copied per screen.
export default function PasswordStrengthMeter({ password, className }) {
  const strength = getPasswordStrength(password);
  if (!strength) return null;

  return (
    <View className={['-mt-2 mb-4', className].filter(Boolean).join(' ')}>
      <View className="flex-row gap-[6px]">
        {[1, 2, 3].map((bar) => (
          <View
            key={bar}
            className={[
              'h-1 flex-1 rounded-full',
              bar <= strength.filledBars ? BAR_STYLES[strength.level] : 'bg-line',
            ].join(' ')}
          />
        ))}
      </View>
      <Text
        className={['mt-[7px] text-[11.5px] font-semibold', LABEL_STYLES[strength.level]].join(' ')}
      >
        {strength.label}
      </Text>
    </View>
  );
}
