import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TIMES_OF_DAY, type TimeOfDay } from "../../src/lib/model/client/types.ts";
import { ENV } from "./env.ts";
import { hexToMireds } from "../public/whites.js";

/** What a light (or group) is set to. Anything left out is left as it is. */
export type LightState = {
    on: boolean;
    /** 1-254 */
    brightness?: number;
    /** A spectrum's colour follows the spectrum (in a phase only), its brightness too. */
    color?: { kind: 'rgb'; hex: string } | { kind: 'temp'; mireds: number } | { kind: 'spectrum'; id: string };
    /** A Zigbee2MQTT effect, such as blink or breathe, played after the rest is set. */
    effect?: string;
};

/** One light or group (by its Zigbee2MQTT friendly name) and what to set it to. */
export type SceneEntry = { target: string; light: LightState };

export type SpectrumStop = {
    /** How far through the day's countdown, 0-1. */
    at: number;
    hex: string;
    /** 1-254 */
    brightness: number;
    /** Use the bulbs' white light, at `mireds`, rather than the colour. */
    white: boolean;
    /** The white's colour temperature. Kept when it's a colour, as `hex` is when it's white, for switching back. */
    mireds: number;
};

/**
 * Colours a phase's lights can follow, fading through them as the day's countdown runs, as the town square's sky does.
 * In the morning they show the first colour, and at dusk and night the last.
 */
export type Spectrum = {
    /** What a light's colour picks it by, so it can be renamed. */
    id: string;
    name: string;
    stops: SpectrumStop[];
    /** How often the lights are moved along, fading from one colour to the next in between. */
    intervalSeconds: number;
};

export const BELL_EVENTS = ['startBell', 'reminderBell', 'handBell'] as const;
export type BellEvent = typeof BELL_EVENTS[number];

/** Lights set when a bell rings, held for a while before going back to the phase's. */
export type BellEffect = { entries: SceneEntry[]; holdSeconds: number };

export const COMMANDS = ['day', 'startPause', 'dusk', 'night', 'ringBell', 'sting'] as const;
export type Command = typeof COMMANDS[number];

/** A Zigbee button's action (e.g. single, double, hold), and what it does to the clock. */
export type ButtonBinding = { device: string; action: string; command: Command };

export type Config = {
    clockmaker: {
        /** e.g. http://homelab:3000 */
        url: string;
        /** The API token from Clockmaker's settings. */
        token: string;
        clockId: string;
    };
    /** How long the lights take to change to a new phase's, in seconds. */
    transitionSeconds: number;
    phases: Record<TimeOfDay, SceneEntry[]>;
    spectrums: Spectrum[];
    bells: Record<BellEvent, BellEffect>;
    buttons: ButtonBinding[];
};

export function defaultConfig(): Config {
    return {
        clockmaker: { url: '', token: '', clockId: '' },
        transitionSeconds: 2,
        phases: { morning: [], day: [], dusk: [], night: [] },
        spectrums: [],
        bells: {
            startBell: { entries: [], holdSeconds: 2 },
            reminderBell: { entries: [], holdSeconds: 2 },
            handBell: { entries: [], holdSeconds: 2 }
        },
        buttons: []
    };
}

export class ConfigError extends Error {}

function fail(path: string, message: string): never {
    throw new ConfigError(`${path}: ${message}`);
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

function hex(value: unknown, path: string): string {
    const text = str(value, path);
    if(!HEX.test(text)) fail(path, 'should be a colour like #ffaa00');
    return text.toLowerCase();
}

/** `spectrums` are the ids a light's colour can pick, or null where spectrums can't be picked. */
function lightState(value: unknown, path: string, spectrums: ReadonlySet<string> | null): LightState {
    if(!isObject(value)) fail(path, 'should be a light state');
    if(typeof value.on !== 'boolean') fail(`${path}.on`, 'should be true or false');
    const light: LightState = { on: value.on };
    if(value.brightness !== undefined) light.brightness = Math.round(num(value.brightness, `${path}.brightness`, 1, 254));
    if(value.color !== undefined){
        const color = value.color;
        if(!isObject(color)) fail(`${path}.color`, 'should be a colour');
        if(color.kind === 'rgb') light.color = { kind: 'rgb', hex: hex(color.hex, `${path}.color.hex`) };
        else if(color.kind === 'temp') light.color = { kind: 'temp', mireds: Math.round(num(color.mireds, `${path}.color.mireds`, 50, 1000)) };
        else if(color.kind === 'spectrum'){
            if(spectrums === null) fail(`${path}.color`, 'spectrums can only be picked in a phase');
            const id = str(color.id, `${path}.color.id`);
            if(!spectrums.has(id)) fail(`${path}.color`, 'pick a spectrum');
            light.color = { kind: 'spectrum', id };
            // The spectrum has its own
            delete light.brightness;
        }
        else fail(`${path}.color.kind`, 'should be rgb, temp or spectrum');
    }
    if(value.effect !== undefined && value.effect !== ''){
        light.effect = str(value.effect, `${path}.effect`);
    }
    return light;
}

function sceneEntries(value: unknown, path: string, spectrums: ReadonlySet<string> | null = null): SceneEntry[] {
    return arr(value ?? [], path).map((entry, i) => {
        if(!isObject(entry)) fail(`${path}[${i}]`, 'should be a scene entry');
        const target = str(entry.target, `${path}[${i}].target`);
        if(!target) fail(`${path}[${i}].target`, 'pick a light or group');
        return { target, light: lightState(entry.light, `${path}[${i}].light`, spectrums) };
    });
}

/** Checks a configuration (from the page, or the file), filling in anything missing. Throws a ConfigError if it's wrong. */
export function normalizeConfig(value: unknown): Config {
    if(!isObject(value)) fail('config', 'should be an object');
    const config = defaultConfig();

    if(value.clockmaker !== undefined){
        if(!isObject(value.clockmaker)) fail('clockmaker', 'should be an object');
        const { url, token, clockId } = value.clockmaker;
        config.clockmaker.url = str(url ?? '', 'clockmaker.url').replace(/\/+$/, '');
        if(config.clockmaker.url && !/^https?:\/\//.test(config.clockmaker.url)) fail('clockmaker.url', 'should start with http:// or https://');
        config.clockmaker.token = str(token ?? '', 'clockmaker.token');
        config.clockmaker.clockId = str(clockId ?? '', 'clockmaker.clockId');
    }

    if(value.transitionSeconds !== undefined) config.transitionSeconds = num(value.transitionSeconds, 'transitionSeconds', 0, 60);

    // Configurations saved before there could be several have one `spectrum`, with the lights that follow it
    const legacy = value.spectrums === undefined && isObject(value.spectrum) ? value.spectrum : null;
    const spectrums = legacy ? [{ id: 'day', name: 'Day', stops: legacy.stops ?? [], intervalSeconds: legacy.intervalSeconds }] : value.spectrums;
    if(spectrums !== undefined){
        config.spectrums = arr(spectrums, 'spectrums').map((spectrum, i) => {
            const path = `spectrums[${i}]`;
            if(!isObject(spectrum)) fail(path, 'should be a spectrum');
            const id = str(spectrum.id, `${path}.id`);
            if(!id) fail(`${path}.id`, 'should be set');
            const name = str(spectrum.name, `${path}.name`);
            if(!name) fail(`${path}.name`, 'give it a name');
            const stops = arr(spectrum.stops ?? [], `${path}.stops`).map((stop, j) => {
                const stopPath = `${path}.stops[${j}]`;
                if(!isObject(stop)) fail(stopPath, 'should be a colour stop');
                const color = hex(stop.hex, `${stopPath}.hex`);
                return {
                    at: num(stop.at, `${stopPath}.at`, 0, 1),
                    hex: color,
                    brightness: Math.round(num(stop.brightness, `${stopPath}.brightness`, 1, 254)),
                    white: stop.white !== false,
                    // Stops saved before they had one get the white nearest their colour
                    mireds: stop.mireds === undefined ? hexToMireds(color) : Math.round(num(stop.mireds, `${stopPath}.mireds`, 50, 1000))
                };
            }).sort((a, b) => a.at - b.at);
            if(stops.length === 0 && !legacy) fail(`${path}.stops`, `add at least one colour to ${name}`);
            const intervalSeconds = spectrum.intervalSeconds === undefined ? 10 : num(spectrum.intervalSeconds, `${path}.intervalSeconds`, 1, 300);
            return { id, name, stops, intervalSeconds };
        }).filter(spectrum => spectrum.stops.length > 0);
        config.spectrums.forEach((spectrum, i) => {
            if(config.spectrums.findIndex(s => s.id === spectrum.id) !== i) fail(`spectrums[${i}].id`, 'is used twice');
            if(config.spectrums.findIndex(s => s.name === spectrum.name) !== i) fail(`spectrums[${i}].name`, `there's already a spectrum called ${spectrum.name}`);
        });
    }
    const spectrumIds = new Set(config.spectrums.map(s => s.id));

    if(value.phases !== undefined){
        if(!isObject(value.phases)) fail('phases', 'should be an object');
        for(const phase of TIMES_OF_DAY) config.phases[phase] = sceneEntries(value.phases[phase], `phases.${phase}`, spectrumIds);
    }

    // The old spectrum's lights follow it, in place of what the day (and the morning, if it held there) set them to
    if(legacy?.enabled === true && spectrumIds.has('day')){
        const targets = arr(legacy.targets ?? [], 'spectrum.targets').map((t, i) => str(t, `spectrum.targets[${i}]`)).filter(t => t);
        const phases: TimeOfDay[] = legacy.holdInMorning === false ? ['day'] : ['morning', 'day'];
        for(const phase of phases){
            config.phases[phase] = [
                ...config.phases[phase].filter(e => !targets.includes(e.target)),
                ...targets.map(target => ({ target, light: { on: true, color: { kind: 'spectrum' as const, id: 'day' } } }))
            ];
        }
    }

    if(value.bells !== undefined){
        if(!isObject(value.bells)) fail('bells', 'should be an object');
        for(const bell of BELL_EVENTS){
            const effect = value.bells[bell];
            if(effect === undefined) continue;
            if(!isObject(effect)) fail(`bells.${bell}`, 'should be an object');
            config.bells[bell] = {
                entries: sceneEntries(effect.entries, `bells.${bell}.entries`),
                holdSeconds: effect.holdSeconds === undefined ? 2 : num(effect.holdSeconds, `bells.${bell}.holdSeconds`, 0, 120)
            };
        }
    }

    if(value.buttons !== undefined){
        config.buttons = arr(value.buttons, 'buttons').map((binding, i) => {
            const path = `buttons[${i}]`;
            if(!isObject(binding)) fail(path, 'should be a button binding');
            const device = str(binding.device, `${path}.device`);
            const action = str(binding.action, `${path}.action`);
            if(!device) fail(`${path}.device`, 'pick a button');
            if(!action) fail(`${path}.action`, 'pick an action');
            if(!COMMANDS.includes(binding.command as Command)) fail(`${path}.command`, 'pick what it does');
            return { device, action, command: binding.command as Command };
        });
    }

    return config;
}

const CONFIG_FILE = join(ENV.dataDir, 'lightscapes.json');

export function loadConfig(): Config {
    if(!existsSync(CONFIG_FILE)) return defaultConfig();
    try {
        return normalizeConfig(JSON.parse(readFileSync(CONFIG_FILE, 'utf8')));
    } catch(err) {
        // Not overwritten until saved from the page, so a hand edit gone wrong can still be fixed
        console.error(`Couldn't read ${CONFIG_FILE}, starting with an empty configuration:`, err);
        return defaultConfig();
    }
}

export function saveConfig(config: Config): void {
    mkdirSync(ENV.dataDir, { recursive: true });
    const temp = `${CONFIG_FILE}.tmp`;
    writeFileSync(temp, JSON.stringify(config, null, '\t'));
    renameSync(temp, CONFIG_FILE);
}
