import { get, writable, type Unsubscriber, type Writable } from "svelte/store";
import { AudioTrack } from "./AudioTrack";
import type { ClientModelListenerType, ClockClientModel } from "../model";
import type { AudioTrackBase } from "./AudioTrackBase";
import { writableThatDoesntPollTooMuch } from "$lib/common/WritableThatDoesntPollTooMuch";
import type { AudioParams } from "$lib/common/AudioParams";
// import { createLogger, type Logger } from "vite";

export type ClockAudioTrackOptions = {
    enableParamsTx?: boolean;
}

export class ClockAudioTrack implements AudioTrackBase, ClientModelListenerType {
    static readonly TAG: string = "ClockAudioTrack";
    readonly logger = console;
    private unsubscribers: Unsubscriber[] = [];

    private readonly finalBellAudioModel: AudioTrack;
    private readonly reminderBellAudioModel: AudioTrack;

    private readonly audioParamsGainTxBufferStore: ReturnType<typeof writableThatDoesntPollTooMuch<number>> | undefined;
    private readonly audioParamsPanTxBufferStore: ReturnType<typeof writableThatDoesntPollTooMuch<number>> | undefined;

    gain: Writable<number>;
    pan: Writable<number>;

    constructor(audioContext: AudioContext, readonly clockModel: ClockClientModel, outputNode: AudioNode = audioContext.destination, options: ClockAudioTrackOptions = {}){
        // this.logger = createLogger('info', {prefix: `${ClockAudioTrack.TAG}[${this.clockModel.clockId}]`});
        this.logger.info(`Initializing ClockAudioTrack`);
        this.finalBellAudioModel = new AudioTrack(audioContext, new Audio(), outputNode);
        this.reminderBellAudioModel = new AudioTrack(audioContext, new Audio(), outputNode);
        
        this.finalBellAudioModel.audio.src = clockModel.finalBellURL();
        this.finalBellAudioModel.audio.load();

        this.reminderBellAudioModel.audio.src = clockModel.reminderBellURL();
        this.reminderBellAudioModel.audio.load();

        this.finalBellAudioModel.audio.onload = (ev)=>{
            this.logger.info("Final bell audio loaded successfully.");
        }
        this.reminderBellAudioModel.audio.onload = (ev)=>{
            this.logger.info("Reminder bell audio loaded successfully.");
        }

        let initParams = get(clockModel.audioParams);
        this.gain = writable(initParams.gain);
        this.pan = writable(initParams.pan);

        this.clockModel.addListener(this);

        if(options.enableParamsTx){
            this.audioParamsGainTxBufferStore = writableThatDoesntPollTooMuch(get(this.gain), 100);
            this.audioParamsPanTxBufferStore = writableThatDoesntPollTooMuch(get(this.pan), 100);
        }

        this.logger.log("ClockAudioTrack initialized with gain:", this.gain, "pan:", this.pan);

        this.setup();
    }

    private setup(){
        this.teardown();
        this.logger.info(`Setting up ClockAudioTrackModel`);
        this.unsubscribers.push(this.clockModel.audioParams.subscribe(params=>{
            this.gain.set(params.gain);
            this.pan.set(params.pan);
        }));

        this.unsubscribers.push(this.gain.subscribe(gain=>{
            if(this.audioParamsGainTxBufferStore){
                this.audioParamsGainTxBufferStore.set(gain);
            }
            this.finalBellAudioModel.gain.set(gain);
            this.reminderBellAudioModel.gain.set(gain);
        }));

        this.unsubscribers.push(this.pan.subscribe(pan=>{
            if(this.audioParamsPanTxBufferStore){
                this.audioParamsPanTxBufferStore.set(pan);
            }
            this.finalBellAudioModel.pan.set(pan);
            this.reminderBellAudioModel.pan.set(pan);
        }));

        if(this.audioParamsGainTxBufferStore && this.audioParamsPanTxBufferStore){
            this.unsubscribers.push(this.audioParamsGainTxBufferStore.subscribe(gain=>{
                fetch(`/admin/api/clock/${this.clockModel.clockId}/audioParams`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({gain, pan: get(this.pan)})
                }).catch(err=>{
                    console.error("Error sending audioParams update to server:", err);
                });
            }));
            this.unsubscribers.push(this.audioParamsPanTxBufferStore.subscribe(pan=>{
                fetch(`/admin/api/clock/${this.clockModel.clockId}/audioParams`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({gain: get(this.gain), pan})
                }).catch(err=>{
                    console.error("Error sending audioParams update to server:", err);
                });
            }));
        }

        this.clockModel.addListener(this);
    }

    private teardown(){
        this.logger.info(`Tearing down ClockAudioTrackModel`);
        for(const u of this.unsubscribers){
            u();
        }
        this.unsubscribers = [];
        this.clockModel.removeListener(this);
    }

    close(){
        this.teardown();
        this.finalBellAudioModel.close();
        this.reminderBellAudioModel.close();
    }


    // CLIENT MODEL LISTENER CALLBACKS
    onFinalBellRing?: (() => void) | undefined = ()=>{
        this.finalBellAudioModel.audio.currentTime = 0;
        this.finalBellAudioModel.audio.play().then(()=>{
            this.logger.info("Played final bell audio");
        }).catch((err)=>{
            this.logger.error("Error playing final bell audio:", err);
        });
    };

    onBellRingRequest?: (() => void) | undefined = ()=>{
        this.onFinalBellRing?.();
    };

    onClockReset?: (() => void) | undefined;

    onReminderBellRing?: (() => void) | undefined = ()=>{
        this.reminderBellAudioModel.audio.currentTime = 0;
        this.reminderBellAudioModel.audio.play().then(()=>{
            this.logger.info("Played reminder bell audio");
        }).catch((err)=>{
            this.logger.error("Error playing reminder bell audio:", err);
        });
    };

    onAudioParamsChanged?: ((params: AudioParams) => void) | undefined = (params)=>{
        this.logger.info("Audio params changed:", params);
        this.gain.set(params.gain);
        this.pan.set(params.pan);
    };

    getGainDB(): number {
        return  20 * Math.log10(get(this.gain));
    }

    setGainDB(gainDB: number): void {
        this.gain.set(Math.pow(10, gainDB / 20));
    }
}