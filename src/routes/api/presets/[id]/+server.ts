import { json } from '@sveltejs/kit';
import { isValidPresetRating } from '$lib/resources/common/gameData';
import { deletePreset, getFullPreset, getPreset, updatePreset } from '$lib/resources/server/presets';

export async function GET({ params, url }) {
    const id = params.id;
    const withCharacters = url.searchParams.get('characters') === 'true';
    if (withCharacters) {
        const preset = getFullPreset(id);
        if (preset === null) {
            return json({ error: `Preset with id "${id}" not found` }, { status: 404 });
        }
        return json(preset);
    }
    const preset = getPreset(id);
    if (preset === null) {
        return json({ error: `Preset with id "${id}" not found` }, { status: 404 });
    }
    return json(preset);
}

export async function PATCH({ params, request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { name, character_ids, grim_character_ids, bluff_sets, rating, notes } = body;
    if (rating !== undefined && rating !== null && !isValidPresetRating(rating)) {
        return json({ error: 'rating must be a whole number of stars from 1 to 5, or null' }, { status: 400 });
    }
    if (notes !== undefined && typeof notes !== 'string') {
        return json({ error: 'notes must be a string' }, { status: 400 });
    }
    const preset = updatePreset(params.id, { name: typeof name === 'string' ? (name.trim() || null) : name, character_ids, grim_character_ids, bluff_sets, rating, notes: notes?.trim() });
    if (!preset) return json({ error: 'Preset not found' }, { status: 404 });
    return json(preset);
}

export async function DELETE({ params }) {
    const success = deletePreset(params.id);
    if (!success) {
        return json({ error: `Preset with id "${params.id}" not found` }, { status: 400 });
    }
    return new Response(null, { status: 204 });
}
