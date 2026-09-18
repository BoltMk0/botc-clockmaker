import { isAmbienceEngineModel, type AmbienceEngineModel } from "$lib/audio/common/model/ambienceEngineModel";
import { getMimeTypeForExtension } from "../common/util";
import { encodeResourceId, findResourceById, getResourceData } from "./resources";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

const AMBIENCE_ENGINE_CONFIG_MANAGER = new JSONSingletonResourceManager<AmbienceEngineModel>(
    'ambience-engine-config',
    isAmbienceEngineModel
);

// One-time migration from the old flat-file appconfig resource, so an existing ambience mix isn't lost.
if (AMBIENCE_ENGINE_CONFIG_MANAGER.value === null) {
    const legacyId = encodeResourceId('appconfig', 'ambience-engine-config', getMimeTypeForExtension('.json'));
    const legacyResource = findResourceById(legacyId);
    const legacyData = legacyResource && getResourceData(legacyResource);
    if (legacyData) {
        try {
            const model = JSON.parse(legacyData.toString('utf-8'));
            if (isAmbienceEngineModel(model)) {
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
