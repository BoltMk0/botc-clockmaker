import { error, json } from '@sveltejs/kit';
import { listRulesSlidesResoirces, setRulesSlidesOrder } from '$lib/resources/server/rules-slides';

/** Sets the slideshow order: a JSON array of slide ids. Returns the slides in their new order. */
export async function PUT({ request }){
    const ids = await request.json().catch(() => null);
    if(!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) return error(400, { message: 'Expected an array of slide ids' });
    setRulesSlidesOrder(ids);
    return json(listRulesSlidesResoirces());
}
