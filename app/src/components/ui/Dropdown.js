import { useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export default function Dropdown({
  label,
  error,
  disabled = false,
  placeholder = 'Select an option',
  options = [],
  value,
  onChange,
  className,
  containerClassName,
  ...props
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const triggerRef = useRef(null);
  const selected = options.find((option) => option.value === value);

  const openMenu = () => {
    if (disabled) return;
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  return (
    <View className={['mb-4', containerClassName].filter(Boolean).join(' ')}>
      {label ? <Text className="mb-2 text-label text-ink">{label}</Text> : null}

      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        disabled={disabled}
        className={[
          'h-[58px] flex-row items-center justify-between rounded-ds-lg border-[1.5px] px-[18px]',
          error
            ? 'border-danger bg-paper'
            : open
              ? 'border-ink bg-paper'
              : 'border-transparent bg-haze',
          disabled && 'opacity-40',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        <Text
          className={
            selected ? 'text-body font-medium text-ink' : 'text-body font-normal text-placeholder'
          }
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Text className="text-muted">▾</Text>
      </Pressable>

      {error ? <Text className="mt-1.5 text-[13px] font-medium text-danger">{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          {anchor ? (
            <View
              className="absolute rounded-ds-lg border-[1.5px] border-line bg-paper"
              style={{ top: anchor.y + anchor.height + 4, left: anchor.x, width: anchor.width }}
            >
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange?.(option.value);
                    setOpen(false);
                  }}
                  className={['px-4 py-3', option.value === value ? 'bg-signal-soft' : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <Text
                    className={
                      option.value === value
                        ? 'text-body font-semibold text-signal-ink'
                        : 'text-body text-ink'
                    }
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
