import { json } from '@sveltejs/kit';
import { BASE_SCRIPTS, scrapeScript } from '$lib/scraper/server/script_scraper';

export async function POST({ request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

    const { name } = body;
    const entry = BASE_SCRIPTS.find(s => s.name === name);
    if (!entry) {
        return json({ error: `name must be one of: ${BASE_SCRIPTS.map(s => s.name).join(', ')}` }, { status: 400 });
    }

    const result = await scrapeScript(entry);
    return json(result, { status: result.status === 'error' ? 500 : 200 });
}
