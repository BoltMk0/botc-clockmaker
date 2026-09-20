import { isCustomMessageList } from "$lib/common/customMessage";
import { getCustomMessages, saveCustomMessages } from "$lib/resources/server/customMessages";
import { error, json } from "@sveltejs/kit";

export async function GET() {
    return json(getCustomMessages());
}

export async function POST({ request }) {
    const data = await request.json();
    if (!isCustomMessageList(data)) return error(400, { message: 'Invalid data - not valid custom messages' });
    saveCustomMessages(data);
    return new Response();
}
