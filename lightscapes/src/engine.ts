import type { ClocktowerClockModel, LightOverride } from "../../src/lib/model/common/ClocktowerClockModel.ts";
import { TIMES_OF_DAY, type TimeOfDay } from "../../src/lib/model/client/types.ts";
import type { BellEvent, Command, Config, LightState, SceneEntry, Spectrum } from "./config.ts";
import type { ClockFollower } from "./clock.ts";
import type { Zigbee } from "./zigbee.ts";
import { spectrumAt, type SpectrumColor } from "./spectrum.ts";
import { hexToMireds, miredsToHex } from "../public/whites.js";

/** How long a preview from the configuration page holds the lights before they go back to following the game. */
const PREVIEW_MS = 60_000;
/** A spectrum being played through starts after this, so its lights can fade to the first colour first. */
const PLAY_LEAD_MS = 1000;
/** How often a spectrum being played through moves its lights along. */
const PLAY_STEP_MS = 1000;
/** How long a spectrum played through holds its last colour before the lights go back to the game. */
const PLAY_HOLD_MS = 5000;
const ACTIVITY_LENGTH = 30;
/** The town square's sky stops just short of night until the day's over, so the spectrum does too. */
const DAY_PROGRESS_CAP = 0.99;
/** The shortest fade between spectrum updates, so a stop just ahead doesn't make a burst of them. */
const MIN_STEP_MS = 500;
/** How long the lights take to follow the remote's override as it's changed (it's sent as often as every 400ms). */
const OVERRIDE_FADE_SECONDS = 0.5;

export type Activity = { at: number; text: string };

/** Zigbee2MQTT's payload for a light state, fading over `transition` seconds. */
function lightPayload(light: LightState, transition: number): Record<string, unknown> {
    if(!light.on) return { state: 'OFF', transition };
    const payload: Record<string, unknown> = { state: 'ON', transition };
    if(light.brightness !== undefined) payload.brightness = light.brightness;
    if(light.color?.kind === 'rgb') payload.color = { hex: light.color.hex };
    else if(light.color?.kind === 'temp') payload.color_temp = light.color.mireds;
    return payload;
}

/** A light following a spectrum, at `scale` (0-1) of the spectrum's brightness. */
type SpectrumTarget = { name: string; scale: number };

/** The spectrums a phase's lights follow, with the lights that follow each. */
function spectrumsIn(phase: TimeOfDay, config: Config): { spectrum: Spectrum; targets: SpectrumTarget[] }[] {
    return config.spectrums.map(spectrum => ({
        spectrum,
        targets: config.phases[phase]
            .filter(e => e.light.on && e.light.color?.kind === 'spectrum' && e.light.color.id === spectrum.id)
            .map(e => ({ name: e.target, scale: (e.light.brightness ?? 254) / 254 }))
    })).filter(s => s.targets.length > 0);
}

const COMMAND_LABELS: Record<Command, string> = {
    day: 'Day', startPause: 'Start/pause', dusk: 'Dusk', night: 'Night', ringBell: 'Ring the bell', sting: 'Sting'
};

const BELL_LABELS: Record<BellEvent, string> = {
    startBell: 'Start of day bell', reminderBell: 'Reminder bell', handBell: 'Hand bell'
};

/**
 * Keeps the lights in step with the game: each phase's scene, the spectrums its lights follow and the bells' effects. The lights
 * are set from the clock's state rather than from what changed, so reconnecting (to Clockmaker or Zigbee2MQTT) puts
 * them right again.
 */
export class Engine {
    activity: Activity[] = [];

    #config: Config;
    #clock: ClockFollower;
    #zigbee: Zigbee;

    /** The remote's override the lights are showing (as JSON), or null when they're not, or to set them again. */
    #appliedOverride: string | null = null;
    /** The phase whose scene the lights are showing, or null to set them again on the next update. */
    #appliedPhase: TimeOfDay | null = null;
    /** What each spectrum's lights (by its id) were last sent, so they're not sent the same again. */
    #lastSpectrum = new Map<string, SpectrumColor>();
    /** When each spectrum's lights are next moved along, each at its own interval. */
    #spectrumTimers = new Map<string, ReturnType<typeof setTimeout>>();

    #reminderTimer: ReturnType<typeof setTimeout> | null = null;
    /** The countdown (by its start time) whose reminder bell has rung, so it only rings once. */
    #reminderRungFor: number | null = null;

    /** How long the lights take to go back to the phase's after a bell, in place of the phase's own fade. */
    #returnTransition: number | null = null;

    /** While a bell's effect or a preview holds the lights, the game's changes wait. */
    #holdTimer: ReturnType<typeof setTimeout> | null = null;
    #previewTimer: ReturnType<typeof setTimeout> | null = null;
    previewing: string | null = null;
    /** The spectrum being played through (by its id), for the page to follow. */
    playing: string | null = null;
    #playTimer: ReturnType<typeof setTimeout> | null = null;

    #learners: ((press: { device: string; action: string } | null) => void)[] = [];

    constructor(config: Config, clock: ClockFollower, zigbee: Zigbee) {
        this.#config = config;
        this.#clock = clock;
        this.#zigbee = zigbee;

        clock.on('clock', () => this.#update());
        clock.on('connection', connection => {
            if(connection === 'connected'){
                this.#log('Connected to Clockmaker');
                // The lights may have been changed while it was away
                this.#reset();
            } else if(connection === 'error') this.#log(`Clockmaker: ${clock.error}`);
        });
        clock.on('bell', bell => this.#ringBell(bell === 'start' ? 'startBell' : 'handBell'));
        zigbee.on('online', () => {
            this.#reset();
            this.#update();
        });
        zigbee.on('action', (device, action) => this.#press(device, action));

        clock.configure(config.clockmaker);
    }

    get config() { return this.#config; }

    /** Whether the remote's overriding the lights: then they don't follow the game, the bells or previews. */
    get overridden(): boolean { return this.#clock.clock?.lightOverride !== undefined; }

    configure(config: Config) {
        this.#config = config;
        this.#clock.configure(config.clockmaker);
        this.#reset();
        this.#update();
    }

    /** How far through the day's countdown the clock is, 0-1: 0 before it starts, as the town square shows it. */
    progress(at = this.#clock.serverNow()): number {
        const time = this.#clock.clock?.time;
        if(!time || time.serverStartTime === null) return 0;
        if(time.duration <= 0) return 1;
        return Math.min(1, Math.max(0, (at - time.serverStartTime) / (time.duration * 1000)));
    }

    #log(text: string) {
        console.log(text);
        this.activity.unshift({ at: Date.now(), text });
        this.activity.length = Math.min(this.activity.length, ACTIVITY_LENGTH);
    }

    #reset() {
        this.#appliedOverride = null;
        this.#appliedPhase = null;
        this.#lastSpectrum.clear();
    }

    #clearSpectrumTimers() {
        for(const timer of this.#spectrumTimers.values()) clearTimeout(timer);
        this.#spectrumTimers.clear();
    }

    #held(): boolean {
        return this.#holdTimer !== null || this.#previewTimer !== null;
    }

    /** Sets the lights, except those following a spectrum, which are set by it. */
    #setScene(entries: SceneEntry[], transition: number) {
        for(const entry of entries){
            if(entry.light.on && entry.light.color?.kind === 'spectrum') continue;
            this.#zigbee.set(entry.target, lightPayload(entry.light, transition));
            if(entry.light.effect) this.#zigbee.set(entry.target, { effect: entry.light.effect });
        }
    }

    #setSpectrum(color: SpectrumColor, transition: number, targets: readonly SpectrumTarget[]) {
        for(const { name, scale } of targets){
            // A light that says it does colours but not whites gets the white's colour
            const device = this.#zigbee.devices.find(d => d.name === name);
            const white = color.mireds !== null && !(device?.color && !device.colorTemp);
            this.#zigbee.set(name, {
                state: 'ON', ...(white ? { color_temp: color.mireds } : { color: { hex: color.hex } }),
                brightness: Math.max(1, Math.round(color.brightness * scale)), transition
            });
        }
    }

    /** Puts the lights in step with the clock, if they aren't already. */
    #update() {
        const clock = this.#clock.clock;
        const transition = this.#returnTransition ?? this.#config.transitionSeconds;
        this.#returnTransition = null;
        if(!clock) return;
        this.#scheduleReminder(clock);
        this.#clearSpectrumTimers();
        if(clock.lightOverride) return this.#setOverride(clock.lightOverride);
        if(this.#appliedOverride !== null){
            this.#log('Override ended: back to the game');
            this.#reset();
        }
        if(this.#held()) return;

        const phase = clock.timeOfDay;
        if(phase !== this.#appliedPhase){
            this.#log(`${phase[0].toUpperCase()}${phase.slice(1)}: setting the lights`);
            this.#setScene(this.#config.phases[phase], transition);
            this.#appliedPhase = phase;
            this.#lastSpectrum.clear();
        }
        for(const { spectrum, targets } of spectrumsIn(phase, this.#config)) this.#updateSpectrum(clock, spectrum, targets, transition);
    }

    /** Moves one spectrum's lights along, when its timer's up. */
    #tickSpectrum(id: string) {
        this.#spectrumTimers.delete(id);
        const clock = this.#clock.clock;
        if(!clock || clock.lightOverride || this.#held()) return;
        if(clock.timeOfDay !== this.#appliedPhase) return this.#update();
        const following = spectrumsIn(clock.timeOfDay, this.#config).find(s => s.spectrum.id === id);
        if(following) this.#updateSpectrum(clock, following.spectrum, following.targets, this.#config.transitionSeconds);
    }

    /** How far along a spectrum its lights are in a phase: the first colour in the morning, the last at dusk and night. */
    #spectrumProgress(phase: TimeOfDay, at: number): number {
        if(phase === 'morning') return 0;
        if(phase === 'day') return Math.min(this.progress(at), DAY_PROGRESS_CAP);
        return 1;
    }

    /** `firstTransition` is how long the lights take to get to the spectrum, if they aren't following it yet. */
    #updateSpectrum(clock: ClocktowerClockModel, spectrum: Spectrum, targets: readonly SpectrumTarget[], firstTransition: number) {
        const { id, stops, intervalSeconds } = spectrum;
        const startTime = clock.timeOfDay === 'day' ? clock.time.serverStartTime : null;
        const now = this.#clock.serverNow();
        const last = this.#lastSpectrum.get(id);
        const first = last === undefined;

        // Straight to where the sky is to begin with. Once going, each colour is the one due at the end of its fade, so
        // the lights arrive with the sky rather than after it - and a fade ends on any stop before the next update, so
        // a short-lived colour (like the sunset) isn't stepped over.
        let target = now;
        if(startTime !== null && !first){
            target = now + intervalSeconds * 1000;
            const durationMs = clock.time.duration * 1000;
            for(const stop of stops){
                const at = startTime + Math.min(stop.at, DAY_PROGRESS_CAP) * durationMs;
                if(at > now + MIN_STEP_MS && at < target){
                    target = at;
                    break;
                }
            }
        }
        const transition = first ? firstTransition : (target - now) / 1000;
        const color = spectrumAt(stops, this.#spectrumProgress(clock.timeOfDay, target));
        if(color.hex !== last?.hex || color.brightness !== last.brightness || color.mireds !== last.mireds){
            this.#setSpectrum(color, Math.round(transition * 10) / 10, targets);
            this.#lastSpectrum.set(id, color);
        }
        if(startTime !== null && this.progress(now) < DAY_PROGRESS_CAP){
            const next = first ? Math.max(firstTransition * 1000, MIN_STEP_MS) : target - now;
            this.#spectrumTimers.set(id, setTimeout(() => this.#tickSpectrum(id), next));
        }
    }

    /** Every light in any phase's scene, at the remote's override: it trumps the bells and previews, so ends them. */
    #setOverride(override: LightOverride) {
        const key = JSON.stringify(override);
        if(key === this.#appliedOverride) return;
        const first = this.#appliedOverride === null;
        if(first){
            this.#log('Overridden from the remote');
            if(this.#holdTimer !== null) clearTimeout(this.#holdTimer);
            this.#holdTimer = null;
            if(this.#previewTimer !== null) clearTimeout(this.#previewTimer);
            this.#previewTimer = null;
            this.#stopPlaying();
            this.previewing = null;
        }
        this.#appliedOverride = key;
        this.#appliedPhase = null;
        this.#lastSpectrum.clear();
        const transition = first ? this.#config.transitionSeconds : OVERRIDE_FADE_SECONDS;
        const targets = new Set(TIMES_OF_DAY.flatMap(phase => this.#config.phases[phase].map(e => e.target)));
        for(const name of targets){
            // A light that does colours but not whites gets the white's colour, and one that does whites but not colours the nearest white
            const device = this.#zigbee.devices.find(d => d.name === name);
            const color = override.color.kind === 'temp'
                ? (device?.color && !device.colorTemp ? { color: { hex: miredsToHex(override.color.mireds) } } : { color_temp: override.color.mireds })
                : (device?.colorTemp && !device.color ? { color_temp: hexToMireds(override.color.hex) } : { color: { hex: override.color.hex } });
            this.#zigbee.set(name, { state: 'ON', ...color, brightness: override.brightness, transition });
        }
    }

    /** Rings the reminder bell's effect when the countdown gets to the clock's reminder time. */
    #scheduleReminder(clock: ClocktowerClockModel) {
        if(this.#reminderTimer !== null) clearTimeout(this.#reminderTimer);
        this.#reminderTimer = null;
        const { serverStartTime, duration, ringBellWhen } = clock.time;
        if(serverStartTime === null || ringBellWhen === undefined || this.#reminderRungFor === serverStartTime) return;
        const delay = serverStartTime + (duration - ringBellWhen) * 1000 - this.#clock.serverNow();
        // Missed by more than a moment (e.g. connected partway through the day): it's not rung late
        if(delay < -1000) return;
        this.#reminderTimer = setTimeout(() => {
            this.#reminderTimer = null;
            this.#reminderRungFor = serverStartTime;
            this.#ringBell('reminderBell');
        }, Math.max(0, delay));
    }

    #ringBell(bell: BellEvent, config = this.#config) {
        const effect = config.bells[bell];
        if(effect.entries.length === 0) return;
        if(this.overridden) return this.#log(`${BELL_LABELS[bell]}: not flashed, the lights are overridden`);
        this.#log(`${BELL_LABELS[bell]}: flashing the lights`);
        this.#setScene(effect.entries, effect.fadeSeconds);
        if(effect.holdSeconds <= 0) return;
        if(this.#holdTimer !== null) clearTimeout(this.#holdTimer);
        this.#holdTimer = setTimeout(() => {
            this.#holdTimer = null;
            // Back to the phase's lights (or what's being previewed, if that's still on)
            if(this.previewing === null){
                this.#returnTransition = effect.fadeSeconds;
                this.#reset();
                this.#update();
            }
        }, (effect.fadeSeconds + effect.holdSeconds) * 1000);
    }

    /**
     * Shows a phase's lights (at `progress` through the day, for the spectrums) for a while, whatever the game's doing.
     * From `config` if given, to try out changes before they're saved.
     */
    preview(phase: TimeOfDay, progress = 0, config = this.#config) {
        this.#startPreview(`${phase}${phase === 'day' ? ` at ${Math.round(progress * 100)}%` : ''}`);
        this.#setScene(config.phases[phase], config.transitionSeconds);
        const at = phase === 'day' ? progress : phase === 'morning' ? 0 : 1;
        for(const { spectrum, targets } of spectrumsIn(phase, config)) this.#setSpectrum(spectrumAt(spectrum.stops, at), 1, targets);
    }

    /**
     * Plays a spectrum through from its first colour to its last over `seconds`, on the lights that follow it in any
     * phase, then holds the last a moment before going back to the game.
     */
    playSpectrum(spectrum: Spectrum, seconds: number, config = this.#config) {
        // A light following it in several phases plays at its brightness in the first
        const targets = [...new Map(TIMES_OF_DAY.flatMap(phase =>
            spectrumsIn(phase, config).find(s => s.spectrum.id === spectrum.id)?.targets ?? []).reverse()
            .map(t => [t.name, t])).values()];
        const durationMs = seconds * 1000;
        this.#startPreview(`${spectrum.name}, played over ${seconds}s`, PLAY_LEAD_MS + durationMs + PLAY_HOLD_MS);
        this.playing = spectrum.id;
        const start = Date.now() + PLAY_LEAD_MS;
        const end = start + durationMs;
        this.#setSpectrum(spectrumAt(spectrum.stops, 0), PLAY_LEAD_MS / 1000, targets);

        // As in the game: each colour is the one due at the end of its fade, and a fade ends on any stop before then
        const step = () => {
            const now = Date.now();
            let target = Math.min(now + PLAY_STEP_MS, end);
            for(const stop of spectrum.stops){
                const at = start + stop.at * durationMs;
                if(at > now + MIN_STEP_MS && at < target){
                    target = at;
                    break;
                }
            }
            this.#setSpectrum(spectrumAt(spectrum.stops, (target - start) / durationMs), Math.round((target - now) / 100) / 10, targets);
            this.#playTimer = target < end ? setTimeout(step, target - now) : null;
        };
        this.#playTimer = setTimeout(step, PLAY_LEAD_MS);
    }

    previewBell(bell: BellEvent, config = this.#config) {
        this.#ringBell(bell, config);
    }

    #stopPlaying() {
        if(this.#playTimer !== null) clearTimeout(this.#playTimer);
        this.#playTimer = null;
        this.playing = null;
    }

    #startPreview(what: string, ms = PREVIEW_MS) {
        if(this.#previewTimer !== null) clearTimeout(this.#previewTimer);
        this.#stopPlaying();
        this.#clearSpectrumTimers();
        this.previewing = what;
        this.#previewTimer = setTimeout(() => this.endPreview(), ms);
    }

    /** Back to following the game. */
    endPreview() {
        if(this.#previewTimer !== null) clearTimeout(this.#previewTimer);
        this.#previewTimer = null;
        this.#stopPlaying();
        this.previewing = null;
        this.#reset();
        this.#update();
    }

    /** The next button press, for binding it, or null if there isn't one in time. It's not acted on. */
    learn(timeoutMs: number): Promise<{ device: string; action: string } | null> {
        return new Promise(resolve => {
            const learner = (press: { device: string; action: string } | null) => {
                clearTimeout(timeout);
                resolve(press);
            };
            const timeout = setTimeout(() => {
                this.#learners = this.#learners.filter(l => l !== learner);
                resolve(null);
            }, timeoutMs);
            this.#learners.push(learner);
        });
    }

    #press(device: string, action: string) {
        if(this.#learners.length){
            const learners = this.#learners;
            this.#learners = [];
            for(const learner of learners) learner({ device, action });
            return;
        }
        const binding = this.#config.buttons.find(b => b.device === device && b.action === action);
        if(!binding) return;
        this.#log(`${device} (${action}): ${COMMAND_LABELS[binding.command]}`);
        this.#run(binding.command).catch(err => this.#log(`${COMMAND_LABELS[binding.command]} failed: ${err instanceof Error ? err.message : err}`));
    }

    async #run(command: Command) {
        const clock = this.#clock.clock;
        switch(command){
            case 'day':
            case 'dusk':
            case 'night':
                return this.#clock.command('/api/clock/{clock}/timeOfDay', { timeOfDay: command });
            case 'startPause':
                if(clock?.time.serverStartTime !== null && clock?.time.serverStartTime !== undefined) return this.#clock.command('/api/clock/{clock}/stop');
                // Only a timer that's set up can be started; Day sets one up
                if(clock?.timeOfDay === 'morning') return this.#clock.command('/api/clock/{clock}/start');
                this.#log('Start/pause: no timer is set up (press Day first)');
                return;
            case 'ringBell':
                return this.#clock.command('/api/clock/{clock}/ringBell');
            case 'sting':
                return this.#clock.command('/api/stingEngine/trigger');
        }
    }
}
