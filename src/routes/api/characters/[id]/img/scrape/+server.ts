import { scrape } from '$lib/scraper/server/char_icon_scraper.js';
import { getCharacterById } from '$lib/server/database/characters';
import { json } from '@sveltejs/kit';

export async function POST({ params, request, fetch}) {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return json({status: 'error', error: 'Invalid id'}, { status: 400 });
    const character = await getCharacterById(id);
    if (!character) return json({status: 'error', error: 'Character not found'}, { status: 404 });

    const origin = request.headers.get('origin') || '';
    const result = await scrape(origin, character).catch(er=>{
        console.error(`Error scraping character ${character.name}:`, er);
        return json({status: 'error', error: `Error scraping character: ${er.message}`}, { status: 500 });
    });
    if(result instanceof Response){
        return result;
    }
    switch(result.status){
        case 'exists':
            return json(result, { status: 200 });
        case 'not_found':
            return json(result, { status: 404 });
        case 'error':
            return json(result, { status: 500 });
        case 'scraped':
            return json(result, { status: 200 });
    }
}