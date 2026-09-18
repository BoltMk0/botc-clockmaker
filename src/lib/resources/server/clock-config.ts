import { isClocktowerModel, type ClocktowerModel } from "$lib/model/common/ClocktowerModel";
import { JSONMultiResourceManager } from "./jsonResourceManager";
import { listResources, getResourceData } from "./resources";

export const CLOCK_CONFIG_MANAGER = new JSONMultiResourceManager<ClocktowerModel>(
    'clock-config',
    isClocktowerModel,
    (m) => m.clock.clockId
);

// One-time migration from the old flat-file clockconfig resources, so existing clock instances aren't lost.
if (CLOCK_CONFIG_MANAGER.values.length === 0) {
    for (const resource of listResources('clockconfig')) {
        const data = getResourceData(resource);
        if (!data) continue;
        try {
            const model = JSON.parse(data.toString('utf-8'));
            if (isClocktowerModel(model)) {
                CLOCK_CONFIG_MANAGER.add(model);
                console.log(`Migrated legacy clock config for instance ${model.clock.clockId}`);
            }
        } catch (e) {
            console.warn(`Failed to migrate legacy clock config resource ${resource.id}`, e);
        }
    }
}
