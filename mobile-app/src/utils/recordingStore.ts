/**
 * recordingStore.ts
 * Shared utility to save audio recordings to a persistent folder
 * and maintain an AsyncStorage index of metadata.
 */
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORDINGS_DIR = FileSystem.documentDirectory + 'vocal_recordings/';
const RECORDINGS_KEY = 'vocal_recordings_index';

export interface RecordingMeta {
  id: string;        // uuid-ish: timestamp string
  filename: string;  // just the filename, not full path
  uri: string;       // full path on device
  timestamp: string; // ISO
  type: 'vocalytics' | 'guru';
  durationMs?: number;
  note?: string;     // detected note if available
  sargam?: string;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
}

export async function saveRecording(
  sourceUri: string,
  type: 'vocalytics' | 'guru',
  extras?: { note?: string; sargam?: string; durationMs?: number }
): Promise<RecordingMeta | null> {
  try {
    await ensureDir();
    const id = Date.now().toString();
    const filename = `${type}_${id}.wav`;
    const destUri = RECORDINGS_DIR + filename;

    await FileSystem.copyAsync({ from: sourceUri, to: destUri });

    const meta: RecordingMeta = {
      id,
      filename,
      uri: destUri,
      timestamp: new Date().toISOString(),
      type,
      durationMs: extras?.durationMs,
      note: extras?.note,
      sargam: extras?.sargam,
    };

    // Prepend to index
    const existing = await loadRecordingsIndex();
    existing.unshift(meta);
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(existing));
    return meta;
  } catch (e) {
    console.error('saveRecording error:', e);
    return null;
  }
}

export async function loadRecordingsIndex(): Promise<RecordingMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
    if (!raw) return [];
    const list: RecordingMeta[] = JSON.parse(raw);
    // Filter out records whose files no longer exist on disk
    const checked = await Promise.all(
      list.map(async (r) => {
        const info = await FileSystem.getInfoAsync(r.uri);
        return info.exists ? r : null;
      })
    );
    const valid = checked.filter(Boolean) as RecordingMeta[];
    // Update index if any files were missing
    if (valid.length !== list.length) {
      await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

export async function deleteRecording(id: string): Promise<void> {
  try {
    const list = await loadRecordingsIndex();
    const target = list.find((r) => r.id === id);
    if (target) {
      const info = await FileSystem.getInfoAsync(target.uri);
      if (info.exists) await FileSystem.deleteAsync(target.uri, { idempotent: true });
    }
    const updated = list.filter((r) => r.id !== id);
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('deleteRecording error:', e);
  }
}

export async function deleteRecordingsBatch(ids: string[]): Promise<void> {
  try {
    const list = await loadRecordingsIndex();
    const idSet = new Set(ids);
    await Promise.all(
      list.filter((r) => idSet.has(r.id)).map(async (r) => {
        try {
          const info = await FileSystem.getInfoAsync(r.uri);
          if (info.exists) await FileSystem.deleteAsync(r.uri, { idempotent: true });
        } catch (_) {}
      })
    );
    const updated = list.filter((r) => !idSet.has(r.id));
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('deleteRecordingsBatch error:', e);
  }
}
