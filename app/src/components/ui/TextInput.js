import { useState } from 'react';
import { Text, TextInput as RNTextInput, View } from 'react-native';

export default function TextInput({
  label,
  error,
  hint,
  disabled = false,
  secureTextEntry = false,
  multiline = false,
  className,
  containerClassName,
  onFocus,
  onBlur,
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View className={['mb-4', containerClassName].filter(Boolean).join(' ')}>
      {label ? <Text className="mb-2 text-label text-ink">{label}</Text> : null}

      <RNTextInput
        editable={!disabled}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        className={[
          multiline ? 'min-h-[100px] py-[14px]' : 'h-[58px]',
          'rounded-ds-lg border-[1.5px] px-[18px] text-body font-medium text-ink',
          'placeholder:font-normal placeholder:text-placeholder',
          hasError
            ? 'border-danger bg-paper'
            : isFocused
              ? 'border-ink bg-paper'
              : 'border-transparent bg-haze',
          disabled && 'opacity-40',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />

      {hasError ? (
        <Text className="mt-1.5 text-[13px] font-medium text-danger">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-[13px] font-medium text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
