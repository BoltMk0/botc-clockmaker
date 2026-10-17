import type { ClocktowerClockModel } from "../../src/lib/model/common/ClocktowerClockModel.ts";
import type { TimeOfDay } from "../../src/lib/model/client/types.ts";
import type { BellEvent, Command, Config, LightState, SceneEntry, Spectrum } from "./config.ts";
import type { ClockFollower } from "./clock.ts";
import type { Zigbee } from "./zigbee.ts";
import { spectrumAt, type SpectrumColor } from "./spectrum.ts";

/** How long a preview from the configuration page holds the lights before they go back to following the game. */
const PREVIEW_MS = 60_000;
const ACTIVITY_LENGTH = 30;
/** The town square's sky stops just short of night until the day's over, so the spectrum does too. */
const DAY_PROGRESS_CAP = 0.99;
/** The shortest fade between spectrum updates, so a stop just ahead doesn't make a burst of them. */
const MIN_STEP_MS = 500;

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

/** The spectrums a phase's lights follow, with the lights that follow each. */
function spectrumsIn(phase: TimeOfDay, config: Config): { spectrum: Spectrum; targets: string[] }[] {
    return config.spectrums.map(spectrum => ({
        spectrum,
        targets: config.phases[phase]
            .filter(e => e.light.on && e.light.color?.kind === 'spectrum' && e.light.color.id === spectrum.id)
            .map(e => e.target)
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

    /** The phase whose scene the lights are showing, or null to set them again on the next update. */
    #appliedPhase: TimeOfDay | null = null;
    /** What each spectrum's lights (by its id) were last sent, so they're not sent the same again. */
    #lastSpectrum = new Map<string, SpectrumColor>();
    /** When each spectrum's lights are next moved along, each at its own interval. */
    #spectrumTimers = new Map<string, ReturnType<typeof setTimeout>>();

    #reminderTimer: ReturnType<typeof setTimeout> | null = null;
    /** The countdown (by its start time) whose reminder bell has rung, so it only rings once. */
    #reminderRungFor: number | null = null;

    /** While a bell's effect or a preview holds the lights, the game's changes wait. */
    #holdTimer: ReturnType<typeof setTimeout> | null = null;
    #previewTimer: ReturnType<typeof setTimeout> | null = null;
    previewing: string | null = null;

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

    #setSpectrum(color: SpectrumColor, transition: number, targets: readonly string[]) {
        for(const target of targets){
            // A light that says it does colours but not whites gets the white's colour
            const device = this.#zigbee.devices.find(d => d.name === target);
            const white = color.mireds !== null && !(device?.color && !device.colorTemp);
            this.#zigbee.set(target, {
                state: 'ON', ...(white ? { color_temp: color.mireds } : { color: { hex: color.hex } }),
                brightness: color.brightness, transition
            });
        }
    }

    /** Puts the lights in step with the clock, if they aren't already. */
    #update() {
        const clock = this.#clock.clock;
        if(!clock) return;
        this.#scheduleReminder(clock);
        this.#clearSpectrumTimers();
        if(this.#held()) return;

        const phase = clock.timeOfDay;
        if(phase !== this.#appliedPhase){
            this.#log(`${phase[0].toUpperCase()}${phase.slice(1)}: setting the lights`);
            this.#setScene(this.#config.phases[phase], this.#config.transitionSeconds);
            this.#appliedPhase = phase;
            this.#lastSpectrum.clear();
        }
        for(const { spectrum, targets } of spectrumsIn(phase, this.#config)) this.#updateSpectrum(clock, spectrum, targets);
    }

    /** Moves one spectrum's lights along, when its timer's up. */
    #tickSpectrum(id: string) {
        this.#spectrumTimers.delete(id);
        const clock = this.#clock.clock;
        if(!clock || this.#held()) return;
        if(clock.timeOfDay !== this.#appliedPhase) return this.#update();
        const following = spectrumsIn(clock.timeOfDay, this.#config).find(s => s.spectrum.id === id);
        if(following) this.#updateSpectrum(clock, following.spectrum, following.targets);
    }

    /** How far along a spectrum its lights are in a phase: the first colour in the morning, the last at dusk and night. */
    #spectrumProgress(phase: TimeOfDay, at: number): number {
        if(phase === 'morning') return 0;
        if(phase === 'day') return Math.min(this.progress(at), DAY_PROGRESS_CAP);
        return 1;
    }

    #updateSpectrum(clock: ClocktowerClockModel, spectrum: Spectrum, targets: readonly string[]) {
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
        const transition = first ? this.#config.transitionSeconds : (target - now) / 1000;
        const color = spectrumAt(stops, this.#spectrumProgress(clock.timeOfDay, target));
        if(color.hex !== last?.hex || color.brightness !== last.brightness || color.mireds !== last.mireds){
            this.#setSpectrum(color, Math.round(transition * 10) / 10, targets);
            this.#lastSpectrum.set(id, color);
        }
        if(startTime !== null && this.progress(now) < DAY_PROGRESS_CAP){
            const next = first ? Math.max(this.#config.transitionSeconds * 1000, MIN_STEP_MS) : target - now;
            this.#spectrumTimers.set(id, setTimeout(() => this.#tickSpectrum(id), next));
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
        this.#log(`${BELL_LABELS[bell]}: flashing the lights`);
        this.#setScene(effect.entries, 0);
        if(effect.holdSeconds <= 0) return;
        if(this.#holdTimer !== null) clearTimeout(this.#holdTimer);
        this.#holdTimer = setTimeout(() => {
            this.#holdTimer = null;
            // Back to the phase's lights (or what's being previewed, if that's still on)
            if(this.previewing === null){
                this.#reset();
                this.#update();
            }
        }, effect.holdSeconds * 1000);
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

    previewBell(bell: BellEvent, config = this.#config) {
        this.#ringBell(bell, config);
    }

    #startPreview(what: string) {
        if(this.#previewTimer !== null) clearTimeout(this.#previewTimer);
        this.#clearSpectrumTimers();
        this.previewing = what;
        this.#previewTimer = setTimeout(() => this.endPreview(), PREVIEW_MS);
    }

    /** Back to following the game. */
    endPreview() {
        if(this.#previewTimer !== null) clearTimeout(this.#previewTimer);
        this.#previewTimer = null;
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
