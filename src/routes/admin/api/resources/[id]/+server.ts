import { resourceManager } from '$lib/server/resourceManager.js';

export async function GET({params}){
    const resource =resourceManager.findResourceById(params.id);
    if (!resource) {
        return new Response("Resource not found", { status: 404 });
    }
    const data = resourceManager.getResourceData(params.id);
    if (!data) {
        return new Response("Resource data not found", { status: 404 });
    }
    // Node Buffer isn't typed as a valid web BodyInit; convert for Response.
    return new Response(new Uint8Array(data), {
        headers: {
            "Content-Type": resource.mimetype,
            "Content-Disposition": `inline; filename="${resource.name}"`
        }
    });
}

export async function DELETE({params}){
    const success = resourceManager.deleteResource(params.id);
    if (!success) {
        return new Response("Failed to delete resource", { status: 500 });
    }
    return new Response(null, { status: 204 });
}