import type { Layer, LightState, Program, SceneEntry } from "@boltmk0/lightscapes/protocol";
import { kelvinToHex } from "@boltmk0/lightscapes/color";
import { TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
import type { ClocktowerClockModel, LightOverride } from "$lib/model/common/ClocktowerClockModel";
import {
    COMMANDS, REACTION_EVENTS, emptyReactions, normalizeLightingPreset, presetTargets,
    type Command, type LightingPreset, type ReactionEvent
} from "./lightingPreset";

/** The town square's sky stops just short of night until the day's over, so the spectrums do too. */
export const DAY_PROGRESS_CAP = 0.99;

export const PRIORITY = { phase: 0, reaction: 50, override: 100, preview: 200 } as const;

export const phaseScene = (phase: TimeOfDay) => `phase.${phase}`;
export const reactionScene = (event: ReactionEvent) => `reaction.${event}`;

/** A preset as the hubs are sent it: a scene for each phase and reaction, and a timeline for each spectrum. */
export function presetProgram(preset: LightingPreset | null): Program {
    if(!preset) return { scenes: {}, timelines: {}, fadeSeconds: 2 };
    return {
        fadeSeconds: preset.fadeSeconds,
        scenes: {
            ...Object.fromEntries(TIMES_OF_DAY.map(phase => [phaseScene(phase), { entries: preset.phases[phase] }])),
            ...Object.fromEntries(REACTION_EVENTS.map(event => [reactionScene(event), { entries: preset.reactions[event].entries }]))
        },
        timelines: Object.fromEntries(preset.spectrums.map(spectrum => [spectrum.id, {
            stepSeconds: spectrum.stepSeconds,
            stops: spectrum.stops.map(stop => ({
                at: stop.at,
                color: stop.white ? { kind: 'white' as const, kelvin: stop.kelvin } : { kind: 'rgb' as const, hex: stop.hex },
                brightness: stop.brightness
            }))
        }]))
    };
}

/**
 * The phase's scene, with the spectrums its lights follow showing their first colour in the morning, following the
 * countdown in the day, and their last colour at dusk and night.
 */
export function phaseLayer(clock: ClocktowerClockModel): Layer {
    const phase = clock.timeOfDay;
    const layer: Layer = { id: 'phase', priority: PRIORITY.phase, scene: phaseScene(phase) };
    if(phase === 'morning') layer.clock = { kind: 'fixed', position: 0 };
    else if(phase === 'day' && clock.time.serverStartTime !== null){
        layer.clock = { kind: 'running', startedAt: clock.time.serverStartTime, durationMs: clock.time.duration * 1000, cap: DAY_PROGRESS_CAP };
    }
    else if(phase === 'day') layer.clock = { kind: 'fixed', position: 0 };
    else layer.clock = { kind: 'fixed', position: 1 };
    return layer;
}

/** The remote's override as a light state: Zigbee's 1-254 and mireds, as the remote has them, to 0-1 and kelvin. */
export function overrideLight(override: LightOverride): LightState {
    return {
        on: true,
        brightness: Math.min(1, Math.max(0, override.brightness / 254)),
        color: override.color.kind === 'rgb'
            ? { kind: 'rgb', hex: override.color.hex }
            : { kind: 'white', kelvin: Math.round(1_000_000 / override.color.mireds) }
    };
}

/** Every light in any phase's scene, at the remote's override. */
export function overrideLayer(preset: LightingPreset, override: LightOverride, fadeSeconds: number): Layer {
    const light = overrideLight(override);
    return {
        id: 'override',
        priority: PRIORITY.override,
        scene: { entries: presetTargets(preset).map(target => ({ target, light })) },
        fadeSeconds
    };
}

/** A reaction's lights as a cue, or null if it sets none. */
export function reactionCue(preset: LightingPreset, event: ReactionEvent): Layer | null {
    const reaction = preset.reactions[event];
    if(reaction.entries.length === 0) return null;
    return { id: event, priority: PRIORITY.reaction, scene: reactionScene(event), fadeSeconds: reaction.fadeSeconds, holdSeconds: reaction.holdSeconds };
}

/** When the reminder bell rings, in server time, or null if it won't. */
export function reminderAt(clock: ClocktowerClockModel): number | null {
    const { serverStartTime, duration, ringBellWhen } = clock.time;
    if(serverStartTime === null || ringBellWhen === undefined) return null;
    return serverStartTime + (duration - ringBellWhen) * 1000;
}

// --- Settings from before Lightscapes was driven by Clockmaker -------------------------------------------------------

const asZigbee = (name: string) => name.includes(':') ? name : `z2m:${name}`;

type OldLight = { on?: boolean; brightness?: number; color?: { kind?: string; hex?: string; mireds?: number; id?: string }; effect?: string };

function oldLight(light: OldLight): LightState {
    const state: LightState = { on: light.on !== false };
    if(typeof light.brightness === 'number') state.brightness = Math.min(1, Math.max(0, light.brightness / 254));
    const c = light.color;
    if(c?.kind === 'rgb' && typeof c.hex === 'string') state.color = { kind: 'rgb', hex: c.hex };
    else if(c?.kind === 'temp' && typeof c.mireds === 'number') state.color = { kind: 'white', kelvin: Math.round(1_000_000 / c.mireds) };
    else if(c?.kind === 'spectrum' && typeof c.id === 'string') state.color = { kind: 'timeline', id: c.id };
    if(typeof light.effect === 'string' && light.effect) state.effect = light.effect;
    return state;
}

function oldEntries(value: unknown): SceneEntry[] {
    if(!Array.isArray(value)) return [];
    return value.filter(e => typeof e?.target === 'string').map(e => ({ target: asZigbee(e.target), light: oldLight(e.light ?? {}) }));
}

const OLD_BELLS: Record<string, ReactionEvent> = { startBell: 'bell.start', reminderBell: 'bell.reminder', handBell: 'bell.hand' };

/**
 * A preset from a hub's settings before Clockmaker drove it (its lightscapes.json): lights by their Zigbee2MQTT name
 * become `z2m:` ones, brightness 1-254 becomes 0-1, and whites in mireds become kelvin. Throws if it can't be read.
 */
export function presetFromLegacy(config: unknown, id: string, name: string): LightingPreset {
    const old = (typeof config === 'object' && config !== null ? config : {}) as Record<string, any>;
    const reactions = emptyReactions();
    for(const [bell, event] of Object.entries(OLD_BELLS)){
        const effect = old.bells?.[bell];
        if(!effect) continue;
        reactions[event] = {
            entries: oldEntries(effect.entries),
            fadeSeconds: typeof effect.fadeSeconds === 'number' ? effect.fadeSeconds : 1,
            holdSeconds: typeof effect.holdSeconds === 'number' ? effect.holdSeconds : 2
        };
    }
    return normalizeLightingPreset({
        id, name, createdAt: Date.now(),
        fadeSeconds: typeof old.transitionSeconds === 'number' ? old.transitionSeconds : 2,
        phases: Object.fromEntries(TIMES_OF_DAY.map(phase => [phase, oldEntries(old.phases?.[phase])])),
        spectrums: (Array.isArray(old.spectrums) ? old.spectrums : []).map((s: any) => ({
            id: s.id, name: s.name,
            stepSeconds: s.intervalSeconds ?? 10,
            stops: (s.stops ?? []).map((stop: any) => ({
                at: stop.at,
                white: stop.white !== false,
                hex: stop.white !== false && typeof stop.mireds === 'number' ? stop.hex ?? kelvinToHex(1_000_000 / stop.mireds) : stop.hex,
                kelvin: typeof stop.mireds === 'number' ? Math.round(1_000_000 / stop.mireds) : 2700,
                brightness: typeof stop.brightness === 'number' ? Math.min(1, Math.max(0, stop.brightness / 254)) : 1
            }))
        })),
        reactions,
        buttons: (Array.isArray(old.buttons) ? old.buttons : [])
            .filter((b: any) => COMMANDS.includes(b?.command as Command))
            .map((b: any) => ({ device: asZigbee(String(b.device)), action: String(b.action), command: b.command }))
    });
}
