import { error, json } from '@sveltejs/kit';
import { existsSync, readFileSync, statSync } from 'fs';
import { isClockSfxSlot } from '$lib/audio/common/clockSfxPreset';
import {
    deleteClockSfxFile, getClockSfxFileMimeType, getClockSfxFilePath, getClockSfxPreset, setClockSfxFile,
    UnsupportedClockSfxFileError
} from '$lib/resources/server/clock-sfx-presets';
import { fileResponse } from '$lib/resources/server/fileResponse';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';

function resolve(params: { id: string, slot: string }) {
    if(!isClockSfxSlot(params.slot)) error(404, { message: `Unknown sound "${params.slot}"` });
    const preset = getClockSfxPreset(params.id);
    if(!preset) error(404, { message: 'Clock SFX preset not found' });
    return { preset, slot: params.slot };
}

export async function GET({ params, request }){
    const { preset, slot } = resolve(params);
    const filepath = getClockSfxFilePath(preset, slot);
    if(!filepath || !existsSync(filepath)) return new Response("Sound not found", { status: 404 });
    return fileResponse(
        request,
        statSync(filepath),
        () => existsSync(filepath) ? readFileSync(filepath) : null,
        getClockSfxFileMimeType(preset, slot)!,
        `${preset.id}-${slot}${preset[slot]!.ext}`
    );
}

/** Uploads the sound, as multipart form data with a `file` field. Replaces any existing one. */
export async function POST({ params, request }){
    const { preset, slot } = resolve(params);
    const file = (await request.formData()).get('file');
    if(!(file instanceof File) || file.size === 0) return error(400, { message: 'Expected a non-empty "file"' });
    try {
        const updated = setClockSfxFile(preset.id, slot, file.name, Buffer.from(await file.arrayBuffer()));
        getBOTCTClockInstanceManager().refreshClockSfxPreset(preset.id);
        return json(updated);
    } catch(e) {
        if(e instanceof UnsupportedClockSfxFileError) return error(415, { message: e.message });
        throw e;
    }
}

export async function DELETE({ params }){
    const { preset, slot } = resolve(params);
    const updated = deleteClockSfxFile(preset.id, slot);
    getBOTCTClockInstanceManager().refreshClockSfxPreset(preset.id);
    return json(updated);
}
