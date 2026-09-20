import { deleteResource, findResourceById, getResourceData } from '$lib/resources/server/resources';

/** Parses a single `bytes=start-end` range header. Returns null if absent/unsupported, 'invalid' if unsatisfiable. */
function parseRange(header: string | null, size: number): {start: number, end: number} | 'invalid' | null {
    if(!header) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if(!match) return null;
    let start: number, end: number;
    if(match[1] === '' && match[2] === '') return null;
    if(match[1] === ''){
        // Suffix range: last N bytes
        const suffix = parseInt(match[2]);
        start = Math.max(0, size - suffix);
        end = size - 1;
    } else {
        start = parseInt(match[1]);
        end = match[2] === '' ? size - 1 : Math.min(parseInt(match[2]), size - 1);
    }
    if(start >= size || start > end) return 'invalid';
    return {start, end};
}

export async function GET({params, request}){
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
    const baseHeaders = {
        "Content-Type": resource.mimetype,
        "Content-Disposition": `inline; filename="${resource.name}"`,
        "Accept-Ranges": "bytes"
    };

    // Media elements need Range support to seek (e.g. random start offsets for ambience tracks).
    const range = parseRange(request.headers.get('range'), bytes.byteLength);
    if(range === 'invalid'){
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.byteLength}` } });
    }
    if(range){
        const slice = bytes.subarray(range.start, range.end + 1);
        return new Response(slice, {
            status: 206,
            headers: {
                ...baseHeaders,
                "Content-Length": String(slice.byteLength),
                "Content-Range": `bytes ${range.start}-${range.end}/${bytes.byteLength}`
            }
        });
    }
    return new Response(bytes, {
        headers: {
            ...baseHeaders,
            "Content-Length": String(bytes.byteLength)
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
