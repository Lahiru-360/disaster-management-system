import AsyncStorage from '@react-native-async-storage/async-storage';

import { OfflineQueue } from './OfflineQueue';

// The app's one offline hazard report queue (UC02 A3), kept in AsyncStorage.
const offlineReportQueue = new OfflineQueue(AsyncStorage);

export default offlineReportQueue;
