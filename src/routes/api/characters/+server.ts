import { json } from '@sveltejs/kit';
import { listCharacters, listCharactersByCategory, addCharacter } from '$lib/resources/server/characters';
import { ALL_CHARACTER_CATEGORIES, type CharacterCategory } from '$lib/resources/common/gameData';

const VALID_CATEGORIES = ALL_CHARACTER_CATEGORIES;

export async function GET({ url }) {
    const category = url.searchParams.get('category') as CharacterCategory | null;
    if (category !== null) {
        if (!VALID_CATEGORIES.includes(category)) {
            return json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
        }
        return json(listCharactersByCategory(category));
    }
    return json(listCharacters());
}

export async function POST({ request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { name, category, rules, player_count, wakes_first_night, wakes_other_nights, defaultFirstNightOrder, defaultOtherNightOrder } = body;
    if (!name || !category || !rules) {
        return json({ error: 'name, category and rules are required' }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category)) {
        return json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
    }

    const character = addCharacter({
        name,
        category,
        rules,
        player_count: player_count ?? 1,
        wakes_first_night: wakes_first_night ?? false,
        wakes_other_nights: wakes_other_nights ?? false,
        defaultFirstNightOrder: defaultFirstNightOrder ?? null,
        defaultOtherNightOrder: defaultOtherNightOrder ?? null
    });
    return json(character, { status: 201 });
}
