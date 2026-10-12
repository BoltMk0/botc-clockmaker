import type { Resource } from "../common/types";
import { JSONSingletonResourceManager } from "./jsonResourceManager";
import { createUniqueResource, listResources } from "./resources";

function isStringList(data: unknown): data is string[] {
    return Array.isArray(data) && data.every(s => typeof s === 'string');
}

/** The slideshow order, as slide ids. Slides missing from it (e.g. from before it existed) go last, in name order. */
const RULES_SLIDES_ORDER_MANAGER = new JSONSingletonResourceManager<string[]>('rules_slides_order', isStringList);

/** In the order they're shown. */
export function listRulesSlidesResoirces(): (Resource)[] {
    const slides = listResources('rules-slide').sort((a, b) => a.id.localeCompare(b.id));
    const order = RULES_SLIDES_ORDER_MANAGER.value ?? [];
    const rank = (s: Resource) => {
        const i = order.indexOf(s.id);
        return i < 0 ? order.length : i;
    };
    // Stable sort: unordered slides keep their name order
    slides.sort((a, b) => rank(a) - rank(b));
    console.debug(`Found ${slides.length} rules slide resources`)
    return slides;
}

/** Sets the slideshow order. Ids that aren't slides are dropped; slides left out go last. */
export function setRulesSlidesOrder(ids: string[]) {
    const existing = new Set(listResources('rules-slide').map(s => s.id));
    RULES_SLIDES_ORDER_MANAGER.save(ids.filter(id => existing.has(id)));
}

/** Stores an uploaded image as a new slide at the end, named after the file. Returns its id. Throws for an unsupported file type. */
export function saveNewRulesSlide(filename: string, imageData: Buffer): string {
    const current = listRulesSlidesResoirces().map(s => s.id);
    const id = createUniqueResource('rules-slide', filename, imageData);
    setRulesSlidesOrder([...current, id]);
    return id;
}
