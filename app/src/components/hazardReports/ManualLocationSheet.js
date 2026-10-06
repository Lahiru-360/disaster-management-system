import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { areasApi, placesApi } from '../../api';
import Button from '../ui/Button';
import SegmentedControl from '../ui/SegmentedControl';
import TextInput from '../ui/TextInput';

// The middle of Sri Lanka, for a reporter with no home district on file.
const SRI_LANKA = { latitude: 7.8731, longitude: 80.7718, delta: 2.5 };
const DISTRICT_DELTA = 0.2;
const SEARCH_DELAY_MS = 300;
const TABS = [
  { value: 'map', label: 'Pin on map' },
  { value: 'search', label: 'Search a place' },
];

// UC02 A2.2: when there is no GPS fix (or the reporter prefers), set the
// location by hand - a pin on a map centred on their home district, or a
// town or village from the gazetteer (GET /api/places). `onChoose` gets
// `{ latitude, longitude }` and, from a search, the place's name.
export default function ManualLocationSheet({ visible, homeDistrictId, onChoose, onClose }) {
  const [tab, setTab] = useState('map');
  const [region, setRegion] = useState(null);
  const [pin, setPin] = useState(null);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState([]);
  const [searchError, setSearchError] = useState(null);

  // Centre on the home district (its centroid from GET /api/districts).
  useEffect(() => {
    if (!visible) return undefined;
    let current = true;
    areasApi.listDistricts().then(
      (districts) => {
        if (!current) return;
        const home = districts.find((district) => district.id === homeDistrictId);
        setRegion(
          home
            ? { latitude: home.centroid.lat, longitude: home.centroid.lng, delta: DISTRICT_DELTA }
            : SRI_LANKA,
        );
      },
      () => current && setRegion(SRI_LANKA),
    );
    return () => {
      current = false;
    };
  }, [visible, homeDistrictId]);

  // Search as the reporter types, after a short pause; 2 characters minimum (§9.8).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return undefined;
    let current = true;
    const timer = setTimeout(() => {
      placesApi.search(q).then(
        (found) => {
          if (!current) return;
          setPlaces(found);
          setSearchError(null);
        },
        () => current && setSearchError('Places could not be searched. Try again.'),
      );
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  const shownPlaces = query.trim().length < 2 ? [] : places;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-ink/40">
        <View className="h-[80%] rounded-t-ds-card bg-paper px-4 pb-8 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-display text-[19px] text-ink">Set location manually</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Text className="text-body font-semibold text-muted">Close</Text>
            </Pressable>
          </View>
          <SegmentedControl options={TABS} value={tab} onChange={setTab} className="mb-4" />

          {tab === 'map' ? (
            <View className="flex-1">
              <Text className="mb-2 text-[13px] text-muted">Tap the map where the hazard is.</Text>
              {region ? (
                <MapView
                  className="flex-1 rounded-ds-lg"
                  style={{ flex: 1 }}
                  initialRegion={{
                    latitude: region.latitude,
                    longitude: region.longitude,
                    latitudeDelta: region.delta,
                    longitudeDelta: region.delta,
                  }}
                  onPress={(event) => setPin(event.nativeEvent.coordinate)}
                >
                  {pin ? <Marker coordinate={pin} /> : null}
                </MapView>
              ) : (
                <View className="flex-1 items-center justify-center rounded-ds-lg bg-haze">
                  <Text className="text-[13px] text-muted">Loading map…</Text>
                </View>
              )}
              <Button
                className="mt-4"
                disabled={!pin}
                onPress={() => onChoose({ latitude: pin.latitude, longitude: pin.longitude })}
              >
                Use this location
              </Button>
            </View>
          ) : (
            <View className="flex-1">
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Town or village, e.g. Kolonnawa"
                autoFocus
                autoCorrect={false}
                accessibilityLabel="Place name"
                error={searchError}
              />
              <FlatList
                data={shownPlaces}
                keyExtractor={(place) => place.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => onChoose(item.location, item.name)}
                    accessibilityRole="button"
                    className="border-b border-line py-3"
                  >
                    <Text className="text-body font-semibold text-ink">{item.name}</Text>
                    <Text className="text-[13px] text-muted">{item.district.name} District</Text>
                  </Pressable>
                )}
                ListEmptyComponent={
                  query.trim().length >= 2 ? (
                    <Text className="py-3 text-[13px] text-muted">No places match.</Text>
                  ) : null
                }
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
