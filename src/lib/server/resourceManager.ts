import { typeFromMimetype as resourceTypeFromMimetype, type Resource, type ResourceType } from "$lib/common/resources";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { v7 } from "uuid";


type ResourceRecord = Resource & {filepath: string;}

const RESOURCE_DATA_DIR =  process.env.RESOURCE_DATA_DIR || "data/resources";
console.log(`Using resource data directory: ${RESOURCE_DATA_DIR}`);
if (!existsSync(RESOURCE_DATA_DIR)) {
    mkdirSync(RESOURCE_DATA_DIR, { recursive: true });
}

class ResourceManager {
    private resources: Map<string, ResourceRecord> = new Map();
    private readonly resourceMapFile: string;
    constructor(readonly resourceDataDir: string = RESOURCE_DATA_DIR) {
        this.resourceMapFile = `${this.resourceDataDir}/resourceMap.json`;
        this.loadResourceMap();
    }

    listResources(): Resource[] {
        const resourceList: Resource[] = [];
        for (const [id, resource] of this.resources.entries()) {
            resourceList.push({ id, name: resource.name, type: resource.type, mimetype: resource.mimetype });
        }
        return resourceList;
    }

    private loadResourceMap(){
        if (existsSync(this.resourceMapFile)) {
            const resourceMapData = JSON.parse(readFileSync(this.resourceMapFile, "utf-8"));
            for (const [id, resource] of Object.entries(resourceMapData)) {
                this.resources.set(id, resource as ResourceRecord);
            }
        }
    }

    private saveResourceMap(){
        const resourceMapData: Record<string, ResourceRecord> = {};
        for (const [id, resource] of this.resources.entries()) {
            resourceMapData[id] = resource;
        }
        writeFileSync(this.resourceMapFile, JSON.stringify(resourceMapData, null, 2), "utf-8");
    }

    findResourceById(id: string): Resource | null {
        const resource = this.resources.get(id);
        if (!resource) return null;
        const { filepath, ...rest } = resource;
        return rest;
    }

    newResource(blob: Buffer, name: string, mimetype: string): string {
        const id = v7();
        const filepath = `${this.resourceDataDir}/${id}`;
        writeFileSync(filepath, blob);
        const type = resourceTypeFromMimetype(mimetype);
        const resource: ResourceRecord = { id, name, type, mimetype, filepath };
        this.resources.set(id, resource);
        this.saveResourceMap();
        return id;
    }

    getResourceData(id: string): Buffer | null {
        const resource = this.resources.get(id);
        if (!resource) return null;
        return readFileSync(resource.filepath);
    }

    deleteResource(id: string): boolean {
        const resource = this.resources.get(id);
        if (!resource) return false;
        try {
            this.resources.delete(id);
            if(existsSync(resource.filepath)){
                // Delete the resource file
                unlinkSync(resource.filepath);
            }
            this.saveResourceMap();
            return true;
        } catch (error) {            
            console.error(`Failed to delete resource file for ID ${id}:`, error);
            return false;
        } 
    }
}

export const resourceManager = new ResourceManager();