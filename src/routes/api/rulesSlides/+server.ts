import { error, json } from '@sveltejs/kit';
import { listRulesSlidesResoirces, saveNewRulesSlide } from '$lib/resources/server/rules-slides';

export async function GET(){
    return json(listRulesSlidesResoirces());
}

/** Uploads a new slide, as multipart form data with a `file` field. Named after the file. */
export async function POST({ request }){
    const file = (await request.formData()).get('file');
    if(!(file instanceof File) || file.size === 0) return error(400, { message: 'Expected a non-empty "file"' });
    try {
        return json({ id: saveNewRulesSlide(file.name, Buffer.from(await file.arrayBuffer())) }, { status: 201 });
    } catch(e) {
        return error(415, { message: e instanceof Error ? e.message : String(e) });
    }
}
