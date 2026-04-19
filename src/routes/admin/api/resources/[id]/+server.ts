import { deleteResource, findResourceById, getResourceData } from '$lib/server/resources';

export async function GET({params}){
    const resource =findResourceById(params.id);
    if (!resource) {
        return new Response("Resource not found", { status: 404 });
    }
    const data = getResourceData(resource);
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
    const success = deleteResource(params.id);
    if (!success) {
        return new Response("Failed to delete resource", { status: 500 });
    }
    return new Response(null, { status: 204 });
}