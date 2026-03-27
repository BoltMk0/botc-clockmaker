import { resourceManager } from "$lib/server/resourceManager";
import type { Actions } from "./$types";

export async function load(){
    const resources = resourceManager.listResources();
    return { resources };
}

export const actions: Actions = {
    newResource: async ({ request }) => {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const name = formData.get("name") as string;
        if (!file) {
            return { success: false, error: "No file uploaded" };
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const nameFromFilename = file.name.replace(/\.[^/.]+$/, "").replaceAll(/[_-]+/g, " ").trim();
        
        const id = resourceManager.newResource(buffer, name.length > 0 ? name : nameFromFilename, file.type);
        return { success: true, id };
    },
    deleteResource: async ({ request }) => {
        console.log("deleteResource action called");
        const formData = await request.json();
        const id = formData.id as string;
        if (!id) {
            return { success: false, error: "No resource ID provided" };
        }
        const success = resourceManager.deleteResource(id);
        if (!success) {
            return { success: false, error: "Failed to delete resource" };
        }
        return { success: true };
    }
}