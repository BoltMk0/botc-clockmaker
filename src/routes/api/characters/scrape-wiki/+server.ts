import { json } from '@sveltejs/kit';
import { isValidCharacterCategory, ALL_CHARACTER_CATEGORIES } from '$lib/resources/common/gameData';
import { listWikiCharacters, scrapeCharacter } from '$lib/scraper/server/char_data_scraper';

export async function GET({ url }) {
    const category = url.searchParams.get('category');
    if (!category || !isValidCharacterCategory(category)) {
        return json({ error: `category query param must be one of: ${ALL_CHARACTER_CATEGORIES.join(', ')}` }, { status: 400 });
    }

    return await listWikiCharacters(category)
        .then(listing => json(listing))
        .catch(er => json({ error: `Failed to list wiki characters: ${er.message}` }, { status: 502 }));
}

export async function POST({ request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { category, name, wikiPath } = body;
    if (!category || !isValidCharacterCategory(category)) {
        return json({ error: `category must be one of: ${ALL_CHARACTER_CATEGORIES.join(', ')}` }, { status: 400 });
    }
    if (typeof name !== 'string' || !name.trim() || typeof wikiPath !== 'string' || !wikiPath.trim()) {
        return json({ error: 'name and wikiPath are required' }, { status: 400 });
    }

    const result = await scrapeCharacter(category, name, wikiPath);
    return json(result, { status: result.status === 'error' ? 500 : 200 });
}
