import { json } from '@sveltejs/kit';
import { getCharacterById, updateCharacter, deleteCharacter } from '$lib/resources/server/characters';
import type { CharacterCategory } from '$lib/resources/common/gameData';

const VALID_CATEGORIES: CharacterCategory[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveler'];

export async function GET({ params }) {
    const character = getCharacterById(params.id);
    if (!character) return json({ error: 'Character not found' }, { status: 404 });
    return json(character);
}

export async function PATCH({ params, request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { name, category, rules } = body;
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
        return json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
    }

    const character = updateCharacter(params.id, { name, category, rules });
    if (!character) return json({ error: 'Character not found' }, { status: 404 });
    return json(character);
}

export async function DELETE({ params }) {
    const deleted = deleteCharacter(params.id);
    if (!deleted) return json({ error: 'Character not found' }, { status: 404 });
    return new Response(null, { status: 204 });
}
