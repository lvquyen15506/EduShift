import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './api';

const STORAGE_KEY = 'edushift.student.push.token';

function projectId(): string | null {
  const value = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof value === 'string' && value ? value : null;
}

export async function registerPushToken(accessToken: string) {
  const id = projectId();
  if (!id || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('updates', { name: 'Cập nhật EduShift', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;
  const result = await Notifications.getExpoPushTokenAsync({ projectId: id });
  const token = result.data;
  await api('/api/push-tokens', { method: 'POST', token: accessToken, body: { token, platform: Platform.OS } });
  await SecureStore.setItemAsync(STORAGE_KEY, token);
}

export async function removePushToken(accessToken: string) {
  const token = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!token) return;
  await api('/api/push-tokens', { method: 'DELETE', token: accessToken, body: { token, platform: Platform.OS } });
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
