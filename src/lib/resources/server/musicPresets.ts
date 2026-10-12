import { isMusicPreset, withoutMusicPlaylist, type MusicPreset } from "$lib/audio/common/musicPreset";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

function isMusicPresetList(data: unknown): data is MusicPreset[] {
    return Array.isArray(data) && data.every(isMusicPreset);
}

const MUSIC_PRESETS_MANAGER = new JSONSingletonResourceManager<MusicPreset[]>('music_presets', isMusicPresetList);

export function getMusicPresets(): MusicPreset[] {
    return MUSIC_PRESETS_MANAGER.value ?? [];
}

export function saveMusicPresets(presets: MusicPreset[]) {
    MUSIC_PRESETS_MANAGER.save(presets);
}

/** Takes a deleted playlist out of the presets, dropping any left with nothing to play. */
export function removeMusicPlaylistFromPresets(playlistId: string) {
    const current = getMusicPresets();
    const next = current.map(p => withoutMusicPlaylist(p, playlistId)).filter((p): p is MusicPreset => p !== null);
    if (next.length !== current.length || next.some((p, i) => p !== current[i])) saveMusicPresets(next);
}
