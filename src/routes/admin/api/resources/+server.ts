import { resourceManager } from "$lib/server/resourceManager";
import { json } from "@sveltejs/kit";

export async function GET(){
    return json(resourceManager.listResources());
}

export async function POST({ request }: { request: Request }){
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
        return json({ error: "No file uploaded" }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const id = resourceManager.newResource(buffer, file.name, file.type);
    return json({ id });
}

