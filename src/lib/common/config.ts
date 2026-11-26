export type Config = {
    teamName: string|null;
    theme: {
        hue: number;
    };
    /** The ClockSfxPreset this clock rings, or null for no bells. */
    clockSfxPresetId: string|null;
    /** The Lightscapes lighting preset its hubs show; the default (oldest) one if it's not set, or it's gone. */
    lightingPresetId?: string|null;
}

export function isConfig(data: any): data is Config {
    if(typeof data !== 'object') return false;
    if(typeof data.teamName !== 'string') return false;
    if(typeof data.theme !== 'object') return false;
    if(typeof data.clockSfxPresetId !== 'string' && data.clockSfxPresetId !== null) return false;
    if(data.lightingPresetId !== undefined && typeof data.lightingPresetId !== 'string' && data.lightingPresetId !== null) return false;
    return true;
}

/** Before clock SFX presets, each clock picked its own bell sounds from the generic sfx resources. */
export type LegacyResourceMapping = {
    finalBell: { resource_id: string|null };
    reminderBell: { resource_id: string|null };
};

export type ClockInstanceInfo = {
    id: string;
    config: Config;
}

export function getDefaultConfig(): Config {
    return {
        teamName: "Team 1",
        theme: {
            hue: 0,
        },
        clockSfxPresetId: null
    };
}
