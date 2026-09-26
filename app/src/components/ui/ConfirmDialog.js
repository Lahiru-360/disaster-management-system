import { Modal, Pressable, Text, View } from 'react-native';

export default function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-ink/[0.46] px-6">
        <View className="w-full max-w-[340px] rounded-ds-card bg-paper p-6">
          <Text className="font-display text-[21px] tracking-[-0.03em] text-ink">{title}</Text>
          <Text className="mt-[9px] text-[14px] leading-[21px] text-muted">{body}</Text>

          <View className="mt-6 gap-3">
            <Pressable
              onPress={onCancel}
              className="h-[54px] items-center justify-center rounded-ds-lg bg-ink"
            >
              <Text className="text-body font-semibold tracking-[-0.01em] text-paper">
                {cancelLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              className={[
                'h-[54px] items-center justify-center rounded-ds-lg border-[1.5px] bg-paper',
                destructive ? 'border-danger' : 'border-line',
              ].join(' ')}
            >
              <Text
                className={[
                  'text-body font-semibold tracking-[-0.01em]',
                  destructive ? 'text-danger-ink' : 'text-ink',
                ].join(' ')}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
