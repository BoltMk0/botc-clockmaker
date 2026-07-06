import { deleteResource, findResourceById, getResourceData } from '$lib/resources/server/resources';

export async function GET({params}){
    const resource =findResourceById(params.id);
    if (!resource) {
        console.warn(`Resource with id ${params.id} not found`);
        return new Response("Resource not found", { status: 404 });
    }
    const data = getResourceData(resource);
    if (!data) {
        console.warn(`Resource ${resource.name} found but data is missing`);
        return new Response("Resource data not found", { status: 404 });
    }
    // Node Buffer isn't typed as a valid web BodyInit; convert for Response.
    const bytes = new Uint8Array(data);
    return new Response(bytes, {
        headers: {
            "Content-Type": resource.mimetype,
            "Content-Disposition": `inline; filename="${resource.name}"`,
            "Content-Length": String(bytes.byteLength),
            "Accept-Ranges": "bytes"
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