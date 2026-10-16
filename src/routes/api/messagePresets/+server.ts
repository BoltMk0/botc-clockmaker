import { isMessagePresetList } from "$lib/common/message";
import { getMessagePresets, saveMessagePresets } from "$lib/resources/server/messagePresets";
import { error, json } from "@sveltejs/kit";

export async function GET() {
    return json(getMessagePresets());
}

export async function POST({ request }) {
    const data = await request.json();
    if (!isMessagePresetList(data)) return error(400, { message: 'Invalid data - not valid message presets' });
    saveMessagePresets(data);
    return new Response();
}
