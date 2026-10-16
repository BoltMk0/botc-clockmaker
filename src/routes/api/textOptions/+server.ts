import { isTextOptionList } from "$lib/common/message";
import { getTextOptions, saveTextOptions } from "$lib/resources/server/textOptions";
import { error, json } from "@sveltejs/kit";

export async function GET() {
    return json(getTextOptions());
}

export async function POST({ request }) {
    const data = await request.json();
    if (!isTextOptionList(data)) return error(400, { message: 'Invalid data - not valid text options' });
    saveTextOptions(data);
    return new Response();
}
