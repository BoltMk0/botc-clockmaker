import { listAmbienceResources } from "$lib/server/ambience";
import { json } from "@sveltejs/kit";

export async function GET(){
    const resources = listAmbienceResources();
    return json(resources.map(r => ({
        id: r.id,
        name: r.name,
        url: r.url
    })));
}