import { isStingEngineModel, type StingEngineModel } from "$lib/audio/common/model/stingEngineModel";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

const STING_ENGINE_CONFIG_MANAGER = new JSONSingletonResourceManager<StingEngineModel>(
    'sting-engine-config',
    isStingEngineModel
);

export function loadStingEngineModelFromResources(): StingEngineModel | null {
    return STING_ENGINE_CONFIG_MANAGER.value;
}

export function saveStingEngineModel(model: StingEngineModel) {
    STING_ENGINE_CONFIG_MANAGER.save(model);
}
