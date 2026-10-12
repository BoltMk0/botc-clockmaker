/**
 * Details about an uploaded audio asset, kept apart from the file itself (its name comes from the filename).
 * Each field is free text, and empty when unknown.
 */
export type AudioAssetMetadata = {
    /** The track's own title, which needn't match the file's name. */
    title: string;
    artist: string;
    /** Where the track came from (optional). */
    link: string;
    /** e.g. "Attribution 4.0". */
    license: string;
};

export const AUDIO_ASSET_METADATA_FIELDS = ['title', 'artist', 'link', 'license'] as const satisfies readonly (keyof AudioAssetMetadata)[];

/** Longest text kept for any one field. */
export const AUDIO_ASSET_METADATA_MAX_LENGTH = 1000;

export function emptyAudioAssetMetadata(): AudioAssetMetadata {
    return { title: '', artist: '', link: '', license: '' };
}

export function isAudioAssetMetadata(data: unknown): data is AudioAssetMetadata {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return AUDIO_ASSET_METADATA_FIELDS.every(f => typeof obj[f] === 'string' && (obj[f] as string).length <= AUDIO_ASSET_METADATA_MAX_LENGTH);
}

/** Saved metadata, keyed by asset (resource) id. */
export function isAudioAssetMetadataMap(data: unknown): data is Record<string, AudioAssetMetadata> {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
    return Object.values(data).every(isAudioAssetMetadata);
}

/** Trims every field, so whitespace-only entries count as empty. */
export function normaliseAudioAssetMetadata(metadata: AudioAssetMetadata): AudioAssetMetadata {
    return Object.fromEntries(AUDIO_ASSET_METADATA_FIELDS.map(f => [f, metadata[f].trim()])) as AudioAssetMetadata;
}

export function isAudioAssetMetadataEmpty(metadata: AudioAssetMetadata): boolean {
    return AUDIO_ASSET_METADATA_FIELDS.every(f => metadata[f].trim() === '');
}
