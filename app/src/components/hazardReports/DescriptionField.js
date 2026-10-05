import { Text, View } from 'react-native';

import { DESCRIPTION_MAX_LENGTH } from '../../constants/hazardReports';
import TextInput from '../ui/TextInput';

// UC02 step 4: a short description with an "n/200" counter. maxLength stops
// typing past the limit, so the counter can't go over.
export default function DescriptionField({ value, onChangeText, error, disabled = false }) {
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="e.g. Water level rising near the bridge"
        multiline
        maxLength={DESCRIPTION_MAX_LENGTH}
        disabled={disabled}
        error={error}
        containerClassName="mb-1"
        accessibilityLabel="Description"
      />
      <Text className="mb-4 text-right text-[13px] font-medium text-muted">
        {value.length}/{DESCRIPTION_MAX_LENGTH}
      </Text>
    </View>
  );
}
