import { Text, View } from 'react-native';

function normaliseStep(value, maximum) {
  const numericValue = Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(Math.max(numericValue, 0), maximum);
}

export default function ProgressPips({ total, current, caption, className }) {
  const stepTotal = Math.max(0, Number.isFinite(total) ? Math.floor(total) : 0);
  const currentStep = normaliseStep(current, stepTotal);
  const captionText = caption === true ? `Step ${currentStep} of ${stepTotal}` : caption;

  return (
    <View className={['gap-3', className].filter(Boolean).join(' ')}>
      <View className="flex-row gap-[6px]">
        {Array.from({ length: stepTotal }, (_, index) => (
          <View
            key={index}
            className={[
              'h-1 flex-1 rounded-[2px]',
              index < currentStep ? 'bg-signal' : 'bg-line',
            ].join(' ')}
          />
        ))}
      </View>

      {captionText ? (
        <Text className="text-caption uppercase text-muted">{captionText}</Text>
      ) : null}
    </View>
  );
}
