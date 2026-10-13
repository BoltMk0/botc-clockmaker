import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TIMES_OF_DAY, type TimeOfDay } from "../../src/lib/model/client/types.ts";
import { ENV } from "./env.ts";

/** What a light (or group) is set to. Anything left out is left as it is. */
export type LightState = {
    on: boolean;
    /** 1-254 */
    brightness?: number;
    color?: { kind: 'rgb'; hex: string } | { kind: 'temp'; mireds: number };
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
};

/** The colours the day's lights fade through as the countdown runs, as the town square's sky does. */
export type Spectrum = {
    enabled: boolean;
    /** The lights and groups that follow it; the day's scene sets the rest. */
    targets: string[];
    stops: SpectrumStop[];
    /** How often the lights are moved along, fading from one colour to the next in between. */
    intervalSeconds: number;
    /** Show the spectrum's first colour in the morning too, as the town square does before the countdown starts. */
    holdInMorning: boolean;
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
    spectrum: Spectrum;
    bells: Record<BellEvent, BellEffect>;
    buttons: ButtonBinding[];
};

export function defaultConfig(): Config {
    return {
        clockmaker: { url: '', token: '', clockId: '' },
        transitionSeconds: 2,
        phases: { morning: [], day: [], dusk: [], night: [] },
        spectrum: { enabled: false, targets: [], stops: [], intervalSeconds: 10, holdInMorning: true },
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

function lightState(value: unknown, path: string): LightState {
    if(!isObject(value)) fail(path, 'should be a light state');
    if(typeof value.on !== 'boolean') fail(`${path}.on`, 'should be true or false');
    const light: LightState = { on: value.on };
    if(value.brightness !== undefined) light.brightness = Math.round(num(value.brightness, `${path}.brightness`, 1, 254));
    if(value.color !== undefined){
        const color = value.color;
        if(!isObject(color)) fail(`${path}.color`, 'should be a colour');
        if(color.kind === 'rgb') light.color = { kind: 'rgb', hex: hex(color.hex, `${path}.color.hex`) };
        else if(color.kind === 'temp') light.color = { kind: 'temp', mireds: Math.round(num(color.mireds, `${path}.color.mireds`, 50, 1000)) };
        else fail(`${path}.color.kind`, 'should be rgb or temp');
    }
    if(value.effect !== undefined && value.effect !== ''){
        light.effect = str(value.effect, `${path}.effect`);
    }
    return light;
}

function sceneEntries(value: unknown, path: string): SceneEntry[] {
    return arr(value ?? [], path).map((entry, i) => {
        if(!isObject(entry)) fail(`${path}[${i}]`, 'should be a scene entry');
        const target = str(entry.target, `${path}[${i}].target`);
        if(!target) fail(`${path}[${i}].target`, 'pick a light or group');
        return { target, light: lightState(entry.light, `${path}[${i}].light`) };
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

    if(value.phases !== undefined){
        if(!isObject(value.phases)) fail('phases', 'should be an object');
        for(const phase of TIMES_OF_DAY) config.phases[phase] = sceneEntries(value.phases[phase], `phases.${phase}`);
    }

    if(value.spectrum !== undefined){
        const spectrum = value.spectrum;
        if(!isObject(spectrum)) fail('spectrum', 'should be an object');
        config.spectrum.enabled = spectrum.enabled === true;
        config.spectrum.targets = arr(spectrum.targets ?? [], 'spectrum.targets').map((t, i) => str(t, `spectrum.targets[${i}]`)).filter(t => t);
        config.spectrum.stops = arr(spectrum.stops ?? [], 'spectrum.stops').map((stop, i) => {
            const path = `spectrum.stops[${i}]`;
            if(!isObject(stop)) fail(path, 'should be a colour stop');
            return {
                at: num(stop.at, `${path}.at`, 0, 1),
                hex: hex(stop.hex, `${path}.hex`),
                brightness: Math.round(num(stop.brightness, `${path}.brightness`, 1, 254))
            };
        }).sort((a, b) => a.at - b.at);
        if(spectrum.intervalSeconds !== undefined) config.spectrum.intervalSeconds = num(spectrum.intervalSeconds, 'spectrum.intervalSeconds', 1, 300);
        if(spectrum.holdInMorning !== undefined) config.spectrum.holdInMorning = spectrum.holdInMorning === true;
        if(config.spectrum.enabled && config.spectrum.stops.length === 0) fail('spectrum.stops', 'add at least one colour, or turn the spectrum off');
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
