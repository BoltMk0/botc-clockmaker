import { isAmbienceEngineModel, type AmbienceEngineModel } from "$lib/audio/common/model/ambienceEngineModel";
import { migrateLegacyAmbienceTrack } from "$lib/audio/common/model/ambienceTrackModel";
import { getMimeTypeForExtension } from "../common/util";
import { encodeResourceId, findResourceById, getResourceData } from "./resources";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

/** Upgrades a saved model from before the dusk phase, so it validates. It's written back on the next save. */
function isAmbienceEngineModelMigrating(data: any): data is AmbienceEngineModel {
    if(Array.isArray(data?.tracks)) data.tracks.forEach(migrateLegacyAmbienceTrack);
    return isAmbienceEngineModel(data);
}

const AMBIENCE_ENGINE_CONFIG_MANAGER = new JSONSingletonResourceManager<AmbienceEngineModel>(
    'ambience-engine-config',
    isAmbienceEngineModelMigrating
);

// One-time migration from the old flat-file appconfig resource, so an existing ambience mix isn't lost.
if (AMBIENCE_ENGINE_CONFIG_MANAGER.value === null) {
    const legacyId = encodeResourceId('appconfig', 'ambience-engine-config', getMimeTypeForExtension('.json'));
    const legacyResource = findResourceById(legacyId);
    const legacyData = legacyResource && getResourceData(legacyResource);
    if (legacyData) {
        try {
            const model = JSON.parse(legacyData.toString('utf-8'));
            if (isAmbienceEngineModelMigrating(model)) {
                AMBIENCE_ENGINE_CONFIG_MANAGER.save(model);
                console.log("Migrated legacy ambience engine config");
            }
        } catch (e) {
            console.warn("Failed to migrate legacy ambience engine config resource", e);
        }
    }
}

export function loadAmbienceEngineModelFromResources(): AmbienceEngineModel | null {
    return AMBIENCE_ENGINE_CONFIG_MANAGER.value;
}

export function saveAmbienceEngineModel(model: AmbienceEngineModel) {
    AMBIENCE_ENGINE_CONFIG_MANAGER.save(model);
}
