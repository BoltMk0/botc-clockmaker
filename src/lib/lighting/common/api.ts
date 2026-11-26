import type { HubView } from "@boltmk0/lightscapes/controller";
import type { InputInfo, LightId, LightInfo } from "@boltmk0/lightscapes/protocol";
import type { TimeOfDay } from "$lib/model/client/types";
import type { ReactionEvent } from "./lightingPreset";

/** A hub as Settings and Play show it. */
export type HubSummary = HubView & {
    /** The game it follows, if any. */
    clockId: string | null;
    /** Settings it had before Clockmaker drove it, to import, if it has them. */
    hasLegacyConfig: boolean;
    /** What it's previewing from Settings, if anything. */
    previewing: string | null;
};

/** What a preview from Settings shows: a phase (at a point through the day), a reaction, or a spectrum played through. */
export type PreviewRequest =
    | { phase: TimeOfDay; progress?: number }
    | { reaction: ReactionEvent }
    | { play: string; seconds: number };

/** GET /api/lightscapes */
export type LightingOverview = {
    hubs: HubSummary[];
    presets: { id: string; name: string }[];
    /** The oldest preset: what games use that haven't picked one. */
    defaultPresetId: string | null;
    games: { id: string; name: string; lightingPresetId: string | null }[];
};

export async function fetchOverview(): Promise<LightingOverview> {
    const res = await fetch('/api/lightscapes');
    if(!res.ok) throw new Error(`Couldn't get the hubs (${res.status})`);
    return res.json();
}

/** Something done to a hub (see /api/lightscapes/hubs/[hubId]). Throws with the server's message if it fails. */
export async function hubAction<T = object>(hubId: string, body: { action: string } & Record<string, unknown>): Promise<T> {
    const res = await fetch(`/api/lightscapes/hubs/${encodeURIComponent(hubId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if(!res.ok) throw new Error(await res.json().then(j => j.message).catch(() => res.statusText));
    return res.json();
}

/** A light or button, with the hubs that have it. */
export type CatalogEntry<T> = { info: T; hubs: string[] };

/** Every approved hub's lights and buttons, as they last said they had (so they can be picked while a hub's offline). */
export type Catalog = {
    lights: Map<LightId, CatalogEntry<LightInfo>>;
    inputs: Map<string, CatalogEntry<InputInfo>>;
};

export function catalog(hubs: HubSummary[]): Catalog {
    const lights = new Map<LightId, CatalogEntry<LightInfo>>();
    const inputs = new Map<string, CatalogEntry<InputInfo>>();
    for(const hub of hubs){
        if(hub.status !== 'approved' || !hub.inventory) continue;
        for(const light of hub.inventory.lights){
            const entry = lights.get(light.id);
            if(entry) entry.hubs.push(hub.name);
            else lights.set(light.id, { info: light, hubs: [hub.name] });
        }
        for(const input of hub.inventory.inputs){
            const entry = inputs.get(input.id);
            if(entry) entry.hubs.push(hub.name);
            else inputs.set(input.id, { info: input, hubs: [hub.name] });
        }
    }
    return { lights, inputs };
}

/** A light id without its adapter's prefix (z2m:Hall is Hall), for showing one no hub has. */
export function bareName(id: string): string {
    const colon = id.indexOf(':');
    return colon === -1 ? id : id.slice(colon + 1);
}
