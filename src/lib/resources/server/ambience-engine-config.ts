import { isAmbienceEngineModel, type AmbienceEngineModel } from "$lib/audio/common/model/ambienceEngineModel";
import { getMimeTypeForExtension } from "../common/util";
import { encodeResourceId, findResourceById, findResourceByName, getResourceData, saveResource } from "./resources";

function getAmbienceEngineModelResourceId(): string {
    return encodeResourceId('appconfig', 'ambience-engine-config', getMimeTypeForExtension('.json'));
}

export function loadAmbienceEngineModelFromResources(): AmbienceEngineModel|null {
    const res = findResourceById(getAmbienceEngineModelResourceId());
    if(res === null) return null;
    const data = getResourceData(res);
    const model = JSON.parse(String(data));
    if(!isAmbienceEngineModel(model)){
        console.error('Failed to load AmbienceEngineModel from resource - invalid data');
        return null;
    }
    return model;
}

export function saveAmbienceEngineModel(model: AmbienceEngineModel){
    if(!isAmbienceEngineModel(model)){
        throw new Error("Attempt to save invalid ambience engine model");
    }
    saveResource(getAmbienceEngineModelResourceId(), Buffer.from(JSON.stringify(model), 'utf-8'));
}