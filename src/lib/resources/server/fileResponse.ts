import type { Stats } from "fs";

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

/**
 * Serves a stored file. Revalidates on every use, but lets unchanged files come back as a bodyless 304: the ETag
 * changes when a file is re-uploaded under the same name, so replacements still show up immediately. Supports
 * Range requests, which media elements need to seek (and Safari needs to play audio at all).
 */
export function fileResponse(request: Request, stats: Stats, readData: () => Buffer | null, mimetype: string, filename: string): Response {
    const etag = `"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
    const cacheHeaders = {
        "Cache-Control": "no-cache",
        "ETag": etag,
        "Last-Modified": stats.mtime.toUTCString()
    };
    if(request.headers.get('if-none-match') === etag){
        return new Response(null, { status: 304, headers: cacheHeaders });
    }

    const data = readData();
    if (!data) {
        console.warn(`File ${filename} found but data is missing`);
        return new Response("Resource data not found", { status: 404 });
    }
    // Node Buffer isn't typed as a valid web BodyInit; convert for Response.
    const bytes = new Uint8Array(data);
    const baseHeaders = {
        "Content-Type": mimetype,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Accept-Ranges": "bytes",
        ...cacheHeaders
    };

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
