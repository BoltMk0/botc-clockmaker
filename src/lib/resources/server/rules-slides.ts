import { v7 } from "uuid";
import type { Resource } from "../common/types";
import { deleteResource, encodeResourceId, listResources, saveResource } from "./resources";
import { getMimeTypeForExtension } from "../common/util";

export function listRulesSlidesResoirces(): (Resource)[] {
    const slides = listResources('rules-slide');
    console.debug(`Found ${slides.length} rules slide resources`)
    return slides;
}

export function saveNewRulesSlide(imageData: Buffer){
    const id = v7();
    const rid = encodeResourceId('rules-slide', id, getMimeTypeForExtension('.json'));
    saveResource(rid, imageData);
}
