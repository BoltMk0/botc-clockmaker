import { ALL_RESOURCE_TYPES, isValidResourceType } from "$lib/resources/common/types";
import { createResource, deleteResource, listResources } from "$lib/resources/server/resources";
import type { Actions } from "./$types";

export async function load(){
    const resources = ALL_RESOURCE_TYPES.flatMap(listResources);
    return { resources };
}

export const actions: Actions = {
    newResource: async ({ request }) => {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const name = formData.get("name") as string;
        const type = formData.get("type") as string;
        if (!file) {
            return { success: false, error: "No file uploaded" };
        }
        if(!type || !isValidResourceType(type)){
            return { success: false, error: "Invalid or missing resource type" };
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const nameFromFilename = file.name.replace(/\.[^/.]+$/, "").replaceAll(/[_-]+/g, " ").trim();

        const id = createResource(name.length > 0 ? name : nameFromFilename, type, file.type, buffer);
        return { success: true, id };
    },

    deleteResource: async ({ request }) => {
        console.log("deleteResource action called");
        const formData = await request.json();
        const id = formData.id as string;
        if (!id) {
            return { success: false, error: "No resource ID provided" };
        }
        const success = deleteResource(id);
        if (!success) {
            return { success: false, error: "Failed to delete resource" };
        }
        return { success: true };
    }
}