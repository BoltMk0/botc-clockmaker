import { checkLightState, ProtocolError, type LightState, type SceneEntry } from "@boltmk0/lightscapes/protocol";
import { TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";

/**
 * A colour a spectrum's lights fade through. It keeps both a colour and a white, so switching between them gets back
 * the one it had.
 */
export type SpectrumStop = {
    /** How far through the day's countdown, 0-1. */
    at: number;
    /** Use the bulbs' white light, at `kelvin`, rather than the colour. */
    white: boolean;
    hex: string;
    kelvin: number;
    /** 0-1 */
    brightness: number;
};

/**
 * Colours a phase's lights can follow, fading through them as the day's countdown runs, as the town square's sky does.
 * In the morning they show the first colour, and at dusk and night the last.
 */
export type Spectrum = {
    /** What a light's colour picks it by (as a timeline), so it can be renamed. */
    id: string;
    name: string;
    stops: SpectrumStop[];
    /** How often its lights are moved along, fading from one colour to the next in between. */
    stepSeconds: number;
};

/** What makes the lights react: the bells, and the mixer's stings. */
export const REACTION_EVENTS = ['bell.start', 'bell.reminder', 'bell.hand', 'sting.0', 'sting.1'] as const;
export type ReactionEvent = typeof REACTION_EVENTS[number];

export const REACTION_LABELS: Record<ReactionEvent, string> = {
    'bell.start': 'Start of day bell',
    'bell.reminder': 'Reminder bell',
    'bell.hand': 'Hand bell, and the end of the day',
    'sting.0': 'Sting A',
    'sting.1': 'Sting B'
};

/** Lights set when the event happens: fading to them, held, then fading back to the phase's. */
export type Reaction = { entries: SceneEntry[]; fadeSeconds: number; holdSeconds: number };

export const COMMANDS = ['day', 'startPause', 'dusk', 'night', 'ringBell', 'sting'] as const;
export type Command = typeof COMMANDS[number];

export const COMMAND_LABELS: Record<Command, string> = {
    day: 'Day (set the timer up)', startPause: 'Start / pause the timer', dusk: 'Dusk', night: 'Night',
    ringBell: 'Ring the bell', sting: 'Play the armed sting'
};

/** A button's action (e.g. single, double, hold), and what it does to the clock. */
export type ButtonBinding = { device: string; action: string; command: Command };

/** Everything a game's lights do: a scene for each phase, the spectrums, reactions to the bells, and buttons. */
export type LightingPreset = {
    id: string;
    name: string;
    createdAt: number;
    /** How long the lights take to change to a new phase's, in seconds. */
    fadeSeconds: number;
    phases: Record<TimeOfDay, SceneEntry[]>;
    spectrums: Spectrum[];
    reactions: Record<ReactionEvent, Reaction>;
    buttons: ButtonBinding[];
};

export function emptyReactions(): Record<ReactionEvent, Reaction> {
    return Object.fromEntries(REACTION_EVENTS.map(e => [e, { entries: [] as SceneEntry[], fadeSeconds: 1, holdSeconds: 2 }])) as Record<ReactionEvent, Reaction>;
}

export function newLightingPreset(id: string, name: string): LightingPreset {
    return {
        id, name, createdAt: Date.now(),
        fadeSeconds: 2,
        phases: { morning: [], day: [], dusk: [], night: [] },
        spectrums: [],
        reactions: emptyReactions(),
        buttons: []
    };
}

export class LightingPresetError extends Error {}

function fail(path: string, message: string): never {
    throw new LightingPresetError(`${path}: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, path: string): string {
    if(typeof value !== 'string') fail(path, 'should be text');
    return value.trim();
}

function num(value: unknown, path: string, min: number, max: number): number {
    if(typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'should be a number');
    if(value < min || value > max) fail(path, `should be between ${min} and ${max}`);
    return value;
}

function arr(value: unknown, path: string): unknown[] {
    if(!Array.isArray(value)) fail(path, 'should be a list');
    return value;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** `spectrums` are the ids a light's colour can follow, or null where it can't follow one. */
function entries(value: unknown, path: string, spectrums: ReadonlySet<string> | null): SceneEntry[] {
    return arr(value ?? [], path).map((entry, i) => {
        const p = `${path}[${i}]`;
        if(!isObject(entry)) fail(p, 'should be a light and what to set it to');
        const target = str(entry.target, `${p}.target`);
        if(!target) fail(`${p}.target`, 'pick a light or group');
        let light: LightState;
        try {
            light = checkLightState(entry.light, `${p}.light`);
        } catch(err) {
            if(err instanceof ProtocolError) fail(p, err.message);
            throw err;
        }
        if(light.color?.kind === 'timeline'){
            if(spectrums === null) fail(`${p}.light.color`, 'spectrums can only be followed in a phase');
            if(!spectrums.has(light.color.id)) fail(`${p}.light.color`, 'pick a spectrum');
        }
        if(light.effect === '') delete light.effect;
        return { target, light };
    });
}

/** Checks a preset (from the page, or the file), filling in anything missing. Throws a LightingPresetError saying what's wrong. */
export function normalizeLightingPreset(value: unknown): LightingPreset {
    if(!isObject(value)) fail('preset', 'should be an object');
    const id = str(value.id, 'id');
    if(!id) fail('id', 'should be set');
    const name = str(value.name, 'name');
    if(!name) fail('name', 'give it a name');
    const preset = newLightingPreset(id, name);
    preset.createdAt = typeof value.createdAt === 'number' ? value.createdAt : Date.now();
    if(value.fadeSeconds !== undefined) preset.fadeSeconds = num(value.fadeSeconds, 'fadeSeconds', 0, 60);

    preset.spectrums = arr(value.spectrums ?? [], 'spectrums').map((spectrum, i) => {
        const path = `spectrums[${i}]`;
        if(!isObject(spectrum)) fail(path, 'should be a spectrum');
        const id = str(spectrum.id, `${path}.id`);
        if(!id) fail(`${path}.id`, 'should be set');
        const name = str(spectrum.name, `${path}.name`);
        if(!name) fail(`${path}.name`, 'give it a name');
        const stops = arr(spectrum.stops ?? [], `${path}.stops`).map((stop, j) => {
            const p = `${path}.stops[${j}]`;
            if(!isObject(stop)) fail(p, 'should be a colour');
            const hex = str(stop.hex, `${p}.hex`).toLowerCase();
            if(!HEX.test(hex)) fail(`${p}.hex`, 'should be a colour like #ffaa00');
            return {
                at: num(stop.at, `${p}.at`, 0, 1),
                white: stop.white !== false,
                hex,
                kelvin: Math.round(num(stop.kelvin, `${p}.kelvin`, 1000, 20000)),
                brightness: num(stop.brightness, `${p}.brightness`, 0, 1)
            };
        }).sort((a, b) => a.at - b.at);
        if(stops.length === 0) fail(`${path}.stops`, `add at least one colour to ${name}`);
        const stepSeconds = spectrum.stepSeconds === undefined ? 10 : num(spectrum.stepSeconds, `${path}.stepSeconds`, 1, 300);
        return { id, name, stops, stepSeconds };
    });
    preset.spectrums.forEach((spectrum, i) => {
        if(preset.spectrums.findIndex(s => s.id === spectrum.id) !== i) fail(`spectrums[${i}].id`, 'is used twice');
        if(preset.spectrums.findIndex(s => s.name === spectrum.name) !== i) fail(`spectrums[${i}].name`, `there's already a spectrum called ${spectrum.name}`);
    });
    const spectrumIds = new Set(preset.spectrums.map(s => s.id));

    if(value.phases !== undefined){
        if(!isObject(value.phases)) fail('phases', 'should be an object');
        for(const phase of TIMES_OF_DAY) preset.phases[phase] = entries(value.phases[phase], `phases.${phase}`, spectrumIds);
    }

    if(value.reactions !== undefined){
        if(!isObject(value.reactions)) fail('reactions', 'should be an object');
        for(const event of REACTION_EVENTS){
            const reaction = value.reactions[event];
            if(reaction === undefined) continue;
            if(!isObject(reaction)) fail(`reactions.${event}`, 'should be an object');
            preset.reactions[event] = {
                entries: entries(reaction.entries, `reactions.${event}.entries`, null),
                fadeSeconds: reaction.fadeSeconds === undefined ? 1 : num(reaction.fadeSeconds, `reactions.${event}.fadeSeconds`, 0, 5),
                holdSeconds: reaction.holdSeconds === undefined ? 2 : num(reaction.holdSeconds, `reactions.${event}.holdSeconds`, 0, 120)
            };
        }
    }

    preset.buttons = arr(value.buttons ?? [], 'buttons').map((binding, i) => {
        const path = `buttons[${i}]`;
        if(!isObject(binding)) fail(path, 'should be a button binding');
        const device = str(binding.device, `${path}.device`);
        const action = str(binding.action, `${path}.action`);
        if(!device) fail(`${path}.device`, 'pick a button');
        if(!action) fail(`${path}.action`, 'pick an action');
        if(!COMMANDS.includes(binding.command as Command)) fail(`${path}.command`, 'pick what it does');
        return { device, action, command: binding.command as Command };
    });

    return preset;
}

export function isLightingPreset(value: unknown): value is LightingPreset {
    try {
        normalizeLightingPreset(value);
        return true;
    } catch {
        return false;
    }
}

/** Every light any phase of the preset sets: what the remote's override sets. */
export function presetTargets(preset: LightingPreset): string[] {
    return [...new Set(TIMES_OF_DAY.flatMap(phase => preset.phases[phase].map(e => e.target)))];
}
