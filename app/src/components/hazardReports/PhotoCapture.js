import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import Button from '../ui/Button';

// UC02 step 2: "Tap to take photo" opens the camera and shows the shot with a
// Retake option. The photo is held as the picker's asset; the screen uploads
// it on submit. If camera permission is refused, the box explains why the
// photo is needed instead of failing silently.
export default function PhotoCapture({ photo, onChange, error, disabled = false }) {
  const [permissionDenied, setPermissionDenied] = useState(false);

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets?.[0]) {
      onChange(result.assets[0]);
    }
  }

  if (photo) {
    return (
      <View className="mb-4">
        <Image
          source={{ uri: photo.uri }}
          accessibilityLabel="Photo of the hazard"
          className="h-52 w-full rounded-ds-lg bg-haze"
          resizeMode="cover"
        />
        <Button
          variant="small"
          fullWidth={false}
          className="mt-2"
          disabled={disabled}
          onPress={takePhoto}
        >
          Retake
        </Button>
      </View>
    );
  }

  return (
    <View className="mb-4">
      <Pressable
        onPress={disabled ? undefined : takePhoto}
        accessibilityRole="button"
        className={[
          'h-36 items-center justify-center rounded-ds-lg border-[1.5px] border-dashed',
          error ? 'border-danger bg-paper' : 'border-line bg-haze',
        ].join(' ')}
      >
        <Text className="text-body font-semibold text-ink">Tap to take photo</Text>
        <Text className="mt-1 text-[13px] text-muted">
          A photo helps the duty officer verify it
        </Text>
      </Pressable>
      {permissionDenied ? (
        <Text className="mt-1.5 text-[13px] font-medium text-muted">
          Camera access is off. A photo is needed so the officer can confirm the hazard - allow the
          camera in Settings, then tap again.
        </Text>
      ) : null}
      {error ? <Text className="mt-1.5 text-[13px] font-medium text-danger">{error}</Text> : null}
    </View>
  );
}
