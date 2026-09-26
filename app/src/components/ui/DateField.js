import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateString(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** A tappable field that opens the native date picker - Android inline, iOS a bottom sheet. */
export default function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  optional = false,
  placeholder = 'Select a date',
  error,
  disabled,
  containerClassName,
}) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(
    () => parseDateString(value) || minimumDate || new Date(),
  );

  function openPicker() {
    if (disabled) return;
    setDraftDate(parseDateString(value) || minimumDate || new Date());
    setOpen(true);
  }

  function handleAndroidChange(event, selectedDate) {
    setOpen(false);
    if (event.type === 'set' && selectedDate) {
      onChange(toDateString(selectedDate));
    }
  }

  function handleIosChange(_event, selectedDate) {
    if (selectedDate) setDraftDate(selectedDate);
  }

  function confirmIos() {
    onChange(toDateString(draftDate));
    setOpen(false);
  }

  return (
    <View className={['mb-4', containerClassName].filter(Boolean).join(' ')}>
      <View className="mb-2 flex-row items-center justify-between">
        {label ? <Text className="text-label text-ink">{label}</Text> : null}
        {optional && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <Text className="text-[12.5px] font-semibold text-muted">Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={openPicker}
        disabled={disabled}
        className={[
          'h-[58px] justify-center rounded-ds-lg border-[1.5px] px-[18px]',
          error ? 'border-danger bg-paper' : 'border-transparent bg-haze',
          disabled && 'opacity-40',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Text
          className={
            value ? 'text-body font-medium text-ink' : 'text-body font-normal text-placeholder'
          }
        >
          {value || placeholder}
        </Text>
      </Pressable>

      {error ? <Text className="mt-1.5 text-[13px] font-medium text-danger">{error}</Text> : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draftDate}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleAndroidChange}
        />
      ) : null}

      <Modal
        visible={open && Platform.OS === 'ios'}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1 justify-end bg-ink/[0.46]" onPress={() => setOpen(false)}>
          <Pressable
            className="rounded-t-ds-sheet bg-paper px-[22px] pb-8 pt-3.5"
            onPress={() => {}}
          >
            <View className="mx-auto mb-3.5 h-[5px] w-11 rounded-full bg-line" />
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={handleIosChange}
            />
            <Pressable
              onPress={confirmIos}
              className="mt-2 h-[54px] items-center justify-center rounded-ds-lg bg-signal"
            >
              <Text className="text-body font-semibold tracking-[-0.01em] text-paper">Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
