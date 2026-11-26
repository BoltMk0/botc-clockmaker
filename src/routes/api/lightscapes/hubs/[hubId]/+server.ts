import { error, json } from '@sveltejs/kit';
import { getLightingService } from '$lib/lighting/server/service';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { addLightingPreset } from '$lib/lighting/server/presets';
import { presetFromLegacy } from '$lib/lighting/common/program';
import { normalizeLightingPreset, LightingPresetError } from '$lib/lighting/common/lightingPreset';
import { v7 } from 'uuid';

type Body =
    | { action: 'approve' }
    | { action: 'remove' }
    | { action: 'assign'; clockId: string | null }
    | { action: 'refreshStates' }
    | { action: 'learn' }
    | { action: 'preview'; preset: unknown; request: unknown }
    | { action: 'endPreview' }
    | { action: 'importLegacy' }
    | { action: 'forgetLegacy' };

/** Things done to one hub, from Settings and Play. */
export async function POST({ params, request }) {
    const service = getLightingService();
    const hub = service.hubs().find(h => h.hubId === params.hubId);
    if (!hub) error(404, 'No such hub');
    const body = await request.json() as Body;

    switch (body.action) {
        case 'approve':
            service.controller.approve(hub.hubId);
            return json({});
        case 'remove':
            service.assign(hub.hubId, null);
            service.controller.remove(hub.hubId);
            return json({});
        case 'assign': {
            const clockId = body.clockId;
            if (hub.status !== 'approved') error(409, 'Approve the hub first');
            if (clockId !== null && !getBOTCTClockInstanceManager().hasInstance(clockId)) error(404, 'No such game');
            service.assign(hub.hubId, clockId);
            return json({});
        }
        case 'refreshStates':
            service.refreshStates(hub.hubId);
            return json({});
        case 'learn':
            if (!hub.online) error(409, 'That hub is offline');
            return json({ press: await service.learn(hub.hubId) });
        case 'preview': {
            let preset;
            try {
                preset = normalizeLightingPreset(body.preset);
            } catch (err) {
                if (err instanceof LightingPresetError) error(400, err.message);
                throw err;
            }
            const problem = service.preview(hub.hubId, preset, body.request as never);
            if (problem) error(409, problem);
            return json({});
        }
        case 'endPreview':
            service.endPreview(hub.hubId);
            return json({});
        case 'importLegacy': {
            const legacy = service.legacyConfig(hub.hubId);
            if (legacy === undefined) error(404, "The hub hasn't any old settings");
            let preset;
            try {
                preset = addLightingPreset(presetFromLegacy(legacy, v7(), `${hub.name} (imported)`));
            } catch (err) {
                if (err instanceof LightingPresetError) error(400, `Couldn't read its old settings: ${err.message}`);
                throw err;
            }
            service.forgetLegacyConfig(hub.hubId);
            service.presetChanged();
            return json({ preset: { id: preset.id, name: preset.name } });
        }
        case 'forgetLegacy':
            service.forgetLegacyConfig(hub.hubId);
            return json({});
        default:
            error(400, 'Unknown action');
    }
}
