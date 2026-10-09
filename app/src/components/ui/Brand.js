import { Text, View } from 'react-native';

import { APP_NAME } from '../../constants/config';

export default function Brand({ className, ...props }) {
  return (
    <View
      className={['flex-row items-center gap-[9px]', className].filter(Boolean).join(' ')}
      {...props}
    >
      <View className="h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-paper">
        <View className="flex-row items-end">
          <View className="h-[13px] w-[3px] rounded-[2px] bg-navy" />
          <View className="ml-[3px] h-[8px] w-[3px] rounded-[2px] bg-navy opacity-[0.55]" />
        </View>
      </View>
      <Text className="font-display text-wordmark text-paper">{APP_NAME}</Text>
    </View>
  );
}
