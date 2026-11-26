import { LightscapesController, type HubRecord, type HubView } from "@boltmk0/lightscapes/controller";
import type { AssignMessage, InputMessage, Layer, Program } from "@boltmk0/lightscapes/protocol";
import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";
import { getBOTCTClockInstanceManager } from "$lib/model/server/model";
import type { BOTCTClock } from "$lib/model/server/BOTCClock";
import { getStingEngineHelperInstance } from "$lib/model/server/StingEngine/StingEngineHelper";
import { TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
import { COMMAND_LABELS, type Command, type LightingPreset, type ReactionEvent } from "../common/lightingPreset";
import { PRIORITY, overrideLayer, phaseLayer, phaseScene, presetProgram, reactionCue, reminderAt } from "../common/program";
import { lightingPresetFor } from "./presets";

/** How long the lights take to follow the remote's override as it's changed (it's sent as often as every 400ms). */
const OVERRIDE_FADE_SECONDS = 0.5;
/** How long a preview from Settings holds the lights before they go back to the game. */
const PREVIEW_MS = 60_000;
/** A spectrum played through starts after this, so its lights can fade to the first colour first. */
const PLAY_LEAD_MS = 1000;
/** How long a spectrum played through holds its last colour before the lights go back to the game. */
const PLAY_HOLD_MS = 5000;
const LEARN_TIMEOUT_MS = 30_000;

function isHubRecords(value: unknown): value is HubRecord[] {
    return Array.isArray(value) && value.every(r => typeof r?.hubId === 'string' && typeof r?.secretHash === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(v => typeof v === 'string');
}

const HUBS = new JSONSingletonResourceManager<HubRecord[]>('lightscapes-hubs', isHubRecords);
/** Which game each hub follows, by hub id. */
const ASSIGNMENTS = new JSONSingletonResourceManager<Record<string, string>>('lightscapes-assignments', isStringRecord);

/** What a preview from Settings shows: a phase (at a point through the day), a reaction, or a spectrum played through. */
export type PreviewRequest =
    | { phase: TimeOfDay; progress?: number }
    | { reaction: ReactionEvent }
    | { play: string; seconds: number };

type Preview = { what: string; program: Program; layer: Layer | null; timer: ReturnType<typeof setTimeout> };

type ClockState = {
    /** The layers each of its hubs was last sent, as JSON, so the same aren't sent again. */
    sent: Map<string, string>;
    /** Whether the remote's override is on, so it fades in at the preset's pace and then follows the remote quickly. */
    overriding: boolean;
    /** The reminder bell each of its hubs was last cued for. */
    reminders: Map<string, number | null>;
};

export type HubSummary = HubView & {
    /** The game it follows, if any. */
    clockId: string | null;
    /** Settings it had before Clockmaker drove it, to import, if it has them. */
    hasLegacyConfig: boolean;
    previewing: string | null;
};

/**
 * Clockmaker's side of Lightscapes: the hubs (paired through the controller), which game each follows, and keeping each
 * hub's lights to its game: the phase, the remote's override, the bells and stings, and the preset's buttons.
 */
class LightingService {
    readonly controller: LightscapesController;
    #clocks = new Map<string, ClockState>();
    #previews = new Map<string, Preview>();
    #legacy = new Map<string, unknown>();
    #learners = new Map<string, (press: { device: string; action: string } | null) => void>();

    constructor() {
        this.controller = new LightscapesController({
            store: { load: () => HUBS.value ?? [], save: records => HUBS.save(records) },
            assignmentFor: hubId => this.#assignment(hubId)
        });
        this.controller.on('input', (hubId, input) => this.#input(hubId, input));
        this.controller.on('legacyConfig', (hubId, config) => this.#legacy.set(hubId, config));
        this.controller.on('change', hubId => {
            // A hub that's gone: forget what it was sent, so it's all sent again when it's back
            if(!this.controller.isOnline(hubId)) for(const state of this.#clocks.values()){
                state.sent.delete(hubId);
                state.reminders.delete(hubId);
            }
            if(!this.controller.hub(hubId)) this.#setAssignment(hubId, null);
        });

        const manager = getBOTCTClockInstanceManager();
        for(const model of manager.listInstances()) this.#watch(manager.getInstance(model.clock.clockId));
        manager.on('instanceCreated', (_id, instance) => this.#watch(instance));
        manager.on('instanceFreed', id => {
            this.#clocks.delete(id);
            for(const [hubId, clockId] of Object.entries(this.#assignments())) if(clockId === id) this.assign(hubId, null);
        });
        getStingEngineHelperInstance().on('trigger', (slot: number) => {
            for(const clockId of new Set(Object.values(this.#assignments()))) this.#react(clockId, `sting.${slot}` as ReactionEvent);
        });
    }

    // --- For the pages ------------------------------------------------------------------------------------------

    hubs(): HubSummary[] {
        const assignments = this.#assignments();
        return this.controller.hubs().map(hub => ({
            ...hub,
            clockId: assignments[hub.hubId] ?? null,
            hasLegacyConfig: this.#legacy.has(hub.hubId),
            previewing: this.#previews.get(hub.hubId)?.what ?? null
        }));
    }

    /** The hubs following a game. */
    hubsFor(clockId: string): string[] {
        return Object.entries(this.#assignments()).filter(([, c]) => c === clockId).map(([h]) => h);
    }

    /** Sets which game a hub follows (or none), moving it from any it followed. */
    assign(hubId: string, clockId: string | null) {
        if(!this.controller.hub(hubId)) return;
        this.#setAssignment(hubId, clockId);
        this.#endPreview(hubId, false);
        for(const state of this.#clocks.values()){
            state.sent.delete(hubId);
            state.reminders.delete(hubId);
        }
        this.controller.reassign(hubId);
        if(clockId) this.#noteSent(clockId, hubId);
    }

    /** A preset changed (or was deleted): every hub following a game that uses it is sent the new one. */
    presetChanged() {
        for(const hubId of Object.keys(this.#assignments())) if(!this.#previews.has(hubId)) this.#resendProgram(hubId);
    }

    legacyConfig(hubId: string): unknown {
        return this.#legacy.get(hubId);
    }

    forgetLegacyConfig(hubId: string) {
        this.#legacy.delete(hubId);
    }

    /**
     * Shows part of a preset (from the editor, saved or not) on a hub for a minute, whatever its game is doing. Returns
     * an error to show, or null.
     */
    preview(hubId: string, preset: LightingPreset, request: PreviewRequest): string | null {
        if(!this.controller.isOnline(hubId)) return 'That hub is offline';
        const clockId = this.#assignments()[hubId];
        if(clockId && this.#clock(clockId)?.model.clock.lightOverride) return 'The lights are overridden from the remote';
        const now = Date.now();
        let what: string;
        let layer: Layer | null = null;
        let ms = PREVIEW_MS;
        if('phase' in request){
            const at = request.phase === 'day' ? Math.min(Math.max(request.progress ?? 0, 0), 1) : request.phase === 'morning' ? 0 : 1;
            what = `${request.phase}${request.phase === 'day' ? ` at ${Math.round(at * 100)}%` : ''}`;
            layer = { id: 'preview', priority: PRIORITY.preview, scene: phaseScene(request.phase), clock: { kind: 'fixed', position: at }, expiresAt: now + PREVIEW_MS };
        } else if('reaction' in request){
            what = request.reaction;
            const cue = reactionCue(preset, request.reaction);
            if(!cue) return 'It sets no lights';
            layer = { ...cue, id: 'preview', priority: PRIORITY.preview };
            ms = ((cue.fadeSeconds ?? 0) * 2 + (cue.holdSeconds ?? 0)) * 1000 + 1000;
        } else {
            const spectrum = preset.spectrums.find(s => s.id === request.play);
            if(!spectrum) return 'No such spectrum';
            what = `${spectrum.name}, played over ${request.seconds}s`;
            ms = PLAY_LEAD_MS + request.seconds * 1000 + PLAY_HOLD_MS;
            // Every light that follows it in any phase, at its brightness in the first it follows it in
            const targets = new Map<string, number>();
            for(const phase of TIMES_OF_DAY){
                for(const e of preset.phases[phase]){
                    if(e.light.on && e.light.color?.kind === 'timeline' && e.light.color.id === spectrum.id && !targets.has(e.target)) targets.set(e.target, e.light.brightness ?? 1);
                }
            }
            layer = {
                id: 'preview', priority: PRIORITY.preview,
                scene: { entries: [...targets].map(([target, brightness]) => ({ target, light: { on: true, brightness, color: { kind: 'timeline', id: spectrum.id } } })) },
                clock: { kind: 'running', startedAt: now + PLAY_LEAD_MS, durationMs: request.seconds * 1000 },
                fadeSeconds: PLAY_LEAD_MS / 1000,
                expiresAt: now + ms
            };
        }
        this.#endPreview(hubId, false);
        const program = presetProgram(preset);
        const timer = setTimeout(() => this.#endPreview(hubId, true), ms);
        this.#previews.set(hubId, { what, program, layer, timer });
        this.controller.send(hubId, { type: 'program', program });
        this.controller.send(hubId, { type: 'layers', layers: [...this.#layers(hubId), layer] });
        return null;
    }

    /** Back to following the game. */
    endPreview(hubId: string) {
        this.#endPreview(hubId, true);
    }

    /** The next button press on a hub, for binding it, or null if there isn't one in time. It's not acted on. */
    learn(hubId: string): Promise<{ device: string; action: string } | null> {
        this.#learners.get(hubId)?.(null);
        return new Promise(resolve => {
            const timeout = setTimeout(() => finish(null), LEARN_TIMEOUT_MS);
            const finish = (press: { device: string; action: string } | null) => {
                clearTimeout(timeout);
                if(this.#learners.get(hubId) === finish) this.#learners.delete(hubId);
                resolve(press);
            };
            this.#learners.set(hubId, finish);
        });
    }

    /** Asks a hub for its lights' states again. */
    refreshStates(hubId: string) {
        this.controller.send(hubId, { type: 'getStates' });
    }

    // --- Inside -------------------------------------------------------------------------------------------------

    #assignments(): Record<string, string> {
        return ASSIGNMENTS.value ?? {};
    }

    #setAssignment(hubId: string, clockId: string | null) {
        const assignments = { ...this.#assignments() };
        if(clockId === null){
            if(!(hubId in assignments)) return;
            delete assignments[hubId];
        } else assignments[hubId] = clockId;
        ASSIGNMENTS.save(assignments);
    }

    #clock(clockId: string): BOTCTClock | null {
        const manager = getBOTCTClockInstanceManager();
        return manager.hasInstance(clockId) ? manager.getInstance(clockId) : null;
    }

    #presetFor(clockId: string): LightingPreset | null {
        const clock = this.#clock(clockId);
        return clock ? lightingPresetFor(clock.config.lightingPresetId) : null;
    }

    #state(clockId: string): ClockState {
        let state = this.#clocks.get(clockId);
        if(!state){
            state = { sent: new Map(), overriding: false, reminders: new Map() };
            this.#clocks.set(clockId, state);
        }
        return state;
    }

    #watch(clock: BOTCTClock) {
        const clockId = clock.id;
        clock.on('modelUpdated', () => this.#clockChanged(clockId));
        clock.on('bellRingRequest', bell => this.#react(clockId, bell === 'start' ? 'bell.start' : 'bell.hand'));
    }

    /** The game's layers for a hub: its phase, then the remote's override on top. */
    #layers(hubId: string): Layer[] {
        const clockId = this.#assignments()[hubId];
        const clock = clockId ? this.#clock(clockId) : null;
        const preset = clockId ? this.#presetFor(clockId) : null;
        if(!clock || !preset) return [];
        const layers = [phaseLayer(clock.model.clock)];
        const override = clock.model.clock.lightOverride;
        const state = this.#state(clockId);
        if(override){
            layers.push(overrideLayer(preset, override, state.overriding ? OVERRIDE_FADE_SECONDS : preset.fadeSeconds));
        }
        return layers;
    }

    #assignment(hubId: string): Omit<AssignMessage, 'type'> {
        const clockId = this.#assignments()[hubId];
        const clock = clockId ? this.#clock(clockId) : null;
        if(!clockId || !clock) return { following: null, program: presetProgram(null), layers: [] };
        const preview = this.#previews.get(hubId);
        return {
            following: { id: clockId, name: clock.config.teamName ?? 'A game' },
            program: preview?.program ?? presetProgram(this.#presetFor(clockId)),
            layers: [...this.#layers(hubId), ...(preview?.layer ? [preview.layer] : [])]
        };
    }

    #noteSent(clockId: string, hubId: string) {
        this.#state(clockId).sent.set(hubId, JSON.stringify(this.#layers(hubId)));
    }

    #clockChanged(clockId: string) {
        const clock = this.#clock(clockId);
        if(!clock) return;
        const state = this.#state(clockId);
        for(const hubId of this.hubsFor(clockId)){
            if(!this.controller.isOnline(hubId)) continue;
            const preview = this.#previews.get(hubId);
            const layers = this.#layers(hubId);
            const key = JSON.stringify(layers);
            if(state.sent.get(hubId) !== key){
                this.controller.send(hubId, { type: 'layers', layers: [...layers, ...(preview?.layer ? [preview.layer] : [])] });
                state.sent.set(hubId, key);
            }
            this.#cueReminder(clockId, hubId);
        }
        // Once the override's lights have faded in, they follow the remote quickly
        const overriding = clock.model.clock.lightOverride !== undefined;
        if(overriding !== state.overriding){
            state.overriding = overriding;
            if(overriding) for(const hubId of this.hubsFor(clockId)) this.#noteSent(clockId, hubId);
        }
    }

    /** Cues the reminder bell's reaction for when it'll ring, so it lands on time; or takes it back if that's changed. */
    #cueReminder(clockId: string, hubId: string) {
        const clock = this.#clock(clockId);
        const preset = this.#presetFor(clockId);
        if(!clock || !preset) return;
        const state = this.#state(clockId);
        let at = reminderAt(clock.model.clock);
        // Missed by more than a moment (e.g. connected partway through the day): it's not rung late
        if(at !== null && at < Date.now() - 1000) at = null;
        const previous = state.reminders.get(hubId) ?? null;
        if(at === previous) return;
        if(previous !== null) this.controller.send(hubId, { type: 'endCue', id: 'bell.reminder' });
        const cue = reactionCue(preset, 'bell.reminder');
        if(at !== null && cue && !clock.model.clock.lightOverride) this.controller.send(hubId, { type: 'cue', layer: cue, at });
        state.reminders.set(hubId, at);
    }

    #react(clockId: string, event: ReactionEvent) {
        const clock = this.#clock(clockId);
        const preset = this.#presetFor(clockId);
        // While the lights are overridden, the bells don't flash them
        if(!clock || !preset || clock.model.clock.lightOverride) return;
        const cue = reactionCue(preset, event);
        if(!cue) return;
        for(const hubId of this.hubsFor(clockId)) this.controller.send(hubId, { type: 'cue', layer: cue });
    }

    #resendProgram(hubId: string) {
        const clockId = this.#assignments()[hubId];
        if(!clockId) return;
        this.controller.send(hubId, { type: 'program', program: presetProgram(this.#presetFor(clockId)) });
        this.controller.send(hubId, { type: 'layers', layers: this.#layers(hubId) });
        this.#noteSent(clockId, hubId);
    }

    #endPreview(hubId: string, resend: boolean) {
        const preview = this.#previews.get(hubId);
        if(!preview) return;
        clearTimeout(preview.timer);
        this.#previews.delete(hubId);
        if(!resend) return;
        const clockId = this.#assignments()[hubId];
        if(clockId) this.#resendProgram(hubId);
        else {
            this.controller.send(hubId, { type: 'program', program: presetProgram(null) });
            this.controller.send(hubId, { type: 'layers', layers: [] });
        }
    }

    #input(hubId: string, input: InputMessage) {
        const learner = this.#learners.get(hubId);
        if(learner){
            learner({ device: input.device, action: input.action });
            return;
        }
        const clockId = this.#assignments()[hubId];
        const clock = clockId ? this.#clock(clockId) : null;
        const preset = clockId ? this.#presetFor(clockId) : null;
        const binding = preset?.buttons.find(b => b.device === input.device && b.action === input.action);
        if(!clock || !binding) return;
        console.log(`Lightscapes: ${input.device} (${input.action}): ${COMMAND_LABELS[binding.command]}`);
        try {
            this.#run(clock, binding.command);
        } catch(err) {
            console.error(`Lightscapes: ${COMMAND_LABELS[binding.command]} failed:`, err);
        }
    }

    /** What the remote's buttons do, from a hub's button. */
    #run(clock: BOTCTClock, command: Command) {
        switch(command){
            case 'day':
                clock.resetDay();
                return;
            case 'dusk':
            case 'night':
                if(clock.running) clock.endDay(command);
                else clock.timeOfDay = command;
                return;
            case 'startPause':
                if(clock.running) clock.stop();
                // Only a timer that's set up can be started; Day sets one up
                else if(clock.timeOfDay === 'morning') clock.start();
                return;
            case 'ringBell':
                clock.makeDaBellNoise();
                return;
            case 'sting':
                getStingEngineHelperInstance().trigger();
                return;
        }
    }
}

let service: LightingService | null = null;

export function getLightingService(): LightingService {
    service ??= new LightingService();
    return service;
}
