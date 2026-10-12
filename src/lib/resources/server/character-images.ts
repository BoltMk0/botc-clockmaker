import sharp from "sharp";
import type { Resource } from "../common/types";
import { CHARACTER_IMAGE_SIZES } from "../common/characterImages";
import { deleteResource, findResourceById, findResourceByName, encodeResourceId, getResourceData, saveResource } from "./resources";

// Scaled-down copies are always WebP: much smaller than the PNG originals, and they keep transparency.
const VARIANT_MIME_TYPE = 'image/webp';
const VARIANT_QUALITY = 85;

function character_id_to_resource_name(characterid: string): string {
    return `character-${characterid}-img`;
}

function character_id_to_resource_id(characterid: string, mimeType: string): string {
    return encodeResourceId('charactertokenimage', character_id_to_resource_name(characterid), mimeType);
}

// e.g. `charactertokenimage-character-<id>-img-128px.webp`: its own name, so it never matches the original's.
function variant_resource_id(characterid: string, size: number): string {
    return encodeResourceId('charactertokenimage', `${character_id_to_resource_name(characterid)}-${size}px`, VARIANT_MIME_TYPE);
}

export function getCharacterImageResource(characterid: string): Resource | null {
    const resource = findResourceByName(character_id_to_resource_name(characterid), 'charactertokenimage');
    if(resource == null) return null;
    return resource;
}

// A scaled-down copy of the image at every size in CHARACTER_IMAGE_SIZES (never enlarged). Rejects if the data
// isn't an image sharp can read.
async function makeVariants(data: Buffer): Promise<{ size: number, data: Buffer }[]> {
    return Promise.all(CHARACTER_IMAGE_SIZES.map(async size => ({
        size,
        data: await sharp(data)
            .resize(size, size, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: VARIANT_QUALITY })
            .toBuffer()
    })));
}

function saveVariants(characterid: string, variants: { size: number, data: Buffer }[]) {
    for (const variant of variants) saveResource(variant_resource_id(characterid, variant.size), variant.data);
}

function deleteVariants(characterid: string) {
    for (const size of CHARACTER_IMAGE_SIZES) {
        const variant = findResourceById(variant_resource_id(characterid, size));
        if (variant) deleteResource(variant);
    }
}

// Replaces the character's image (and its scaled copies) with this one. Rejects, leaving the old image in place,
// if the data can't be read as an image.
export async function setCharacterImageResource(characterid: string, data: Buffer, mimeType: string) {
    const resourceId = character_id_to_resource_id(characterid, mimeType);
    if(resourceId == null) throw new Error(`Failed to generate resource ID for character ${characterid}`);
    const variants = await makeVariants(data);
    // Clear the old image first: one saved under a different file type would otherwise be left behind (and found first).
    deleteCharacterImageResource(characterid);
    saveResource(resourceId, data);
    saveVariants(characterid, variants);
}

// Scaled copies being made on demand, per character, so simultaneous requests share one job.
const pendingVariants = new Map<string, Promise<void>>();

// The smallest stored copy of the character's image at least `minSize` px wide, or the full-size image if none is
// that big. Copies missing for an image stored before they existed are made on first request.
export async function getCharacterImageForSize(characterid: string, minSize: number): Promise<Resource | null> {
    const original = getCharacterImageResource(characterid);
    if (!original) return null;
    const size = CHARACTER_IMAGE_SIZES.find(s => s >= minSize);
    if (size === undefined) return original;

    const variantId = variant_resource_id(characterid, size);
    let variant = findResourceById(variantId);
    if (!variant) {
        let pending = pendingVariants.get(characterid);
        if (!pending) {
            const data = getResourceData(original);
            if (!data) return original;
            pending = makeVariants(data)
                .then(variants => saveVariants(characterid, variants))
                .finally(() => pendingVariants.delete(characterid));
            pendingVariants.set(characterid, pending);
        }
        try {
            await pending;
        } catch (err) {
            console.error(`Failed to make scaled images for character ${characterid}:`, err);
            return original;
        }
        variant = findResourceById(variantId);
    }
    return variant ?? original;
}

// Deletes the character's image, under whichever file type(s) it was saved, and its scaled copies.
export function deleteCharacterImageResource(characterid: string): boolean {
    deleteVariants(characterid);
    let deleted = false;
    let resource: Resource | null;
    while ((resource = getCharacterImageResource(characterid)) !== null && deleteResource(resource)) deleted = true;
    return deleted;
}
