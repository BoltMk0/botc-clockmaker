import { getFullPreset, updatePreset } from '$lib/resources/server/presets';
import { getScriptWithCharacters } from '$lib/resources/server/scripts';
import type { PresetFull } from '$lib/resources/common/gameData';
import { fail } from '@sveltejs/kit';

export async function load({ params }) {
    // A new preset isn't created until it's saved from the editor's final step.
    if (params.presetId === 'new') {
        const script = getScriptWithCharacters(params.id);
        if (!script) return { preset: null, error: 'Script not found' };
        const preset: PresetFull = { id: 'new', name: null, script_id: script.id, character_ids: [], bluff_sets: [], evil_victories: 0, good_victories: 0, script };
        return { preset };
    }
    const preset = getFullPreset(params.presetId);
    if (!preset) {
        console.warn(`Preset with id "${params.presetId}" not found`);
        return { preset: null, error: 'Preset not found' };
    }
    return { preset };
}

export const actions = {
    save: async ({ request, params }) => {
        try {
            const body = await request.formData();

            const name = body.get('name')?.toString().trim() || null;
            const characterIdsRaw = body.get('characterIds')?.toString() || '';
            const characterIds = characterIdsRaw === '' ? [] : characterIdsRaw.split(',').filter(s => s !== '');
            const bluffSets: string[][] = JSON.parse(body.get('bluffSets')?.toString() || '[]');

            updatePreset(params.presetId, { name, character_ids: characterIds, bluff_sets: bluffSets });

            return { success: true };
        } catch (e) {
            console.error(`Failed to save preset with id "${params.presetId}"`, e);
            return fail(500, { success: false, error: 'Failed to save preset' });
        }
    }
}
