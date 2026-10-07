import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import Button from '../ui/Button';
import Chip from '../ui/Chip';
import Notice from '../ui/Notice';
import TextInput from '../ui/TextInput';

// The reasons a lead can pick with one tap; "Other" asks for their own words.
const REASONS = ['Team already engaged', 'Vehicle unavailable'];
const OTHER = 'Other';

const REASON_MAX_LENGTH = 200;

// UC03 A3.1: declining an assignment needs a reason (§13.8), the officer's
// cue to choose another team. Pick "Team already engaged", "Vehicle
// unavailable" or "Other" and type one. Presentational: `onDecline(reason)`
// sends it, `submitting` and `error` come from the caller, which closes the
// sheet when the server has accepted the decline. The form is only rendered
// while visible, so each opening starts empty.
export default function DeclineSheet({ visible, submitting = false, error, onDecline, onClose }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={submitting ? undefined : onClose}
    >
      <View className="flex-1 justify-end bg-ink/40">
        <View className="rounded-t-ds-card bg-paper px-4 pb-8 pt-4">
          {visible ? (
            <DeclineForm
              submitting={submitting}
              error={error}
              onDecline={onDecline}
              onClose={onClose}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function DeclineForm({ submitting, error, onDecline, onClose }) {
  const [choice, setChoice] = useState(null);
  const [other, setOther] = useState('');

  const reason = (choice === OTHER ? other : (choice ?? '')).trim();
  const tooLong = reason.length > REASON_MAX_LENGTH;
  const canSend = reason.length > 0 && !tooLong && !submitting;

  return (
    <>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-display text-[19px] text-ink">Decline assignment</Text>
        <Pressable
          onPress={onClose}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text className="text-body font-semibold text-muted">Close</Text>
        </Pressable>
      </View>

      <Text className="mb-3 text-[13px] text-muted">
        Tell the district officer why, so they can choose another team.
      </Text>

      <View className="mb-4 flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {[...REASONS, OTHER].map((option) => (
          <Chip
            key={option}
            selected={choice === option}
            onPress={() => setChoice(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: choice === option }}
          >
            {option}
          </Chip>
        ))}
      </View>

      {choice === OTHER ? (
        <TextInput
          value={other}
          onChangeText={setOther}
          placeholder="Why can't the team take it?"
          accessibilityLabel="Reason"
          autoFocus
          multiline
          maxLength={REASON_MAX_LENGTH + 20}
          error={tooLong ? `Keep it to ${REASON_MAX_LENGTH} characters.` : undefined}
        />
      ) : null}

      {error ? (
        <Notice variant="error" className="mb-3">
          {error}
        </Notice>
      ) : null}

      <Button
        variant="primary"
        loading={submitting}
        disabled={!canSend}
        onPress={() => onDecline(reason)}
      >
        Decline assignment
      </Button>
    </>
  );
}
