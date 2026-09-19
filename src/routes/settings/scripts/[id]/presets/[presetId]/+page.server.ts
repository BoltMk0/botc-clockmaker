import { getFullPreset, updatePreset } from '$lib/resources/server/presets';
import { fail } from '@sveltejs/kit';

export async function load({ params }) {
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
            const bluffIdsRaw = body.get('bluffIds')?.toString() || '';
            const bluffIds = bluffIdsRaw === '' ? [] : bluffIdsRaw.split(',').filter(s => s !== '');

            updatePreset(params.presetId, { name, character_ids: characterIds, bluff_ids: bluffIds });

            return { success: true };
        } catch (e) {
            console.error(`Failed to save preset with id "${params.presetId}"`, e);
            return fail(500, { success: false, error: 'Failed to save preset' });
        }
    }
}
