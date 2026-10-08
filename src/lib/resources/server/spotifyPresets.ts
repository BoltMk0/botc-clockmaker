import { isSpotifyPreset, migrateLegacySpotifyPreset, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

/** Also upgrades saved presets from before the dusk phase, so they validate. They're written back on the next save. */
function isSpotifyPresetListMigrating(data: unknown): data is SpotifyPreset[] {
    if (!Array.isArray(data)) return false;
    data.forEach(migrateLegacySpotifyPreset);
    return data.every(isSpotifyPreset);
}

const SPOTIFY_PRESETS_MANAGER = new JSONSingletonResourceManager<SpotifyPreset[]>('spotify_presets', isSpotifyPresetListMigrating);

export function getSpotifyPresets(): SpotifyPreset[] {
    return SPOTIFY_PRESETS_MANAGER.value ?? [];
}

export function saveSpotifyPresets(presets: SpotifyPreset[]) {
    SPOTIFY_PRESETS_MANAGER.save(presets);
}
