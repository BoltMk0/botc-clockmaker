import { ALL_RESOURCE_TYPES, getAcceptedExtensionsForResourceType, getAcceptedMimeTypeForResourceType, type Resource, type ResourceType } from "$lib/common/resources";
import { getExtensionForMimeType, getMimeTypeForExtension } from "$lib/common/util";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { get } from "http";


const RESOURCE_DATA_DIR =  process.env.RESOURCE_DATA_DIR || "data/resources";
console.log(`Using resource data directory: ${RESOURCE_DATA_DIR}`);
if (!existsSync(RESOURCE_DATA_DIR)) {
    mkdirSync(RESOURCE_DATA_DIR, { recursive: true });
}

function getResourceDirpath(resourceType: ResourceType, create: boolean = false): string {
    const dirpath = `${RESOURCE_DATA_DIR}/${resourceType}`;
    if (create && !existsSync(dirpath)) {
        mkdirSync(dirpath, { recursive: true });
    }
    return dirpath;
}

function prettifyResourceName(name: string): string {
    return name.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}


function idToResourceName(id: string, type: ResourceType|null = null): string {
    for(const t of type ? [type] : ALL_RESOURCE_TYPES){
        if(id.startsWith(`${t}-`)){
            id = id.slice(t.length + 1);
            break;
        }
    }
    return prettifyResourceName(id.split('.', 2)[0].replace(/[-_]+/g, " ").trim());
}

export function parseResourceId(resourceId: string): Resource | null {
    let remainder = resourceId;
    let localType: ResourceType | null = null;
    
    for(const type of ALL_RESOURCE_TYPES){
        if(remainder.startsWith(`${type}-`)){
            localType = type;
            remainder = remainder.slice(type.length + 1); // Remove the type prefix and the following hyphen
            break;
        }
    }

    if(localType == null) return null;

    let ext = remainder.split(".", 2).pop() || "";
    if(ext) ext = `.${ext}`;
    if(!getAcceptedExtensionsForResourceType(localType).includes(ext)) return null;

    let mimeType = getMimeTypeForExtension(ext);
    if(mimeType == null) return null;

    return { id: resourceId, name: idToResourceName(resourceId, localType), type: localType, mimetype: mimeType };
}


export function listResources(type: ResourceType){
    const dirpath = getResourceDirpath(type, true);
    const files = existsSync(dirpath) ? readdirSync(dirpath) : [];
    return files.map(parseResourceId).filter(r=>r?.type === type) as Resource[];
}

export function findResourceById(id: string): Resource | null {
    const resource = parseResourceId(id);
    if(!resource) return null;
    const filepath = getResourceFilePath(resource);
    if (!existsSync(filepath)) return null;
    return resource;
}   

export function getResourceFilePath(resource: Omit<Resource, 'name'|'mimetype'>, createDirs: boolean = false): string {
    return `${getResourceDirpath(resource.type, createDirs)}/${resource.id}`;
}

export function getResourceData(resource: Resource): Buffer | null {
    const filepath = getResourceFilePath(resource);
    if (!existsSync(filepath)) return null;
    return Buffer.from(readFileSync(filepath));
}

export function saveResource(id: string, data: Buffer) {
    const resource = parseResourceId(id);
    if(!resource) throw new Error(`Invalid resource ID: ${id}`);
    const filepath = getResourceFilePath({id: resource.id, type: resource.type}, true);
    writeFileSync(filepath, data);
}

export function createResource(name: string, type: ResourceType, mimeType: string, data: Buffer): string {
    const id = `${type}-${name.replace(/\s+/g, "_").toLowerCase()}${getExtensionForMimeType(mimeType)}`;
    saveResource(id, data);
    return id;
}

export function deleteResource(id: string): boolean {
    const resource = findResourceById(id);
    if(!resource) return false;
    const filepath = getResourceFilePath(resource);
    if (!existsSync(filepath)) return false;
    try {
        unlinkSync(filepath);
        return true;
    } catch (err) {
        console.error(`Error deleting resource file ${filepath}:`, err);
        return false;
    }
}

export function generateResourceId(type: ResourceType, name: string): string {
    const mimeType = getAcceptedMimeTypeForResourceType(type);
    const ext = getExtensionForMimeType(mimeType);
    return `${type}-${name.replace(/\s+/g, "_").toLowerCase()}${ext}`;
};