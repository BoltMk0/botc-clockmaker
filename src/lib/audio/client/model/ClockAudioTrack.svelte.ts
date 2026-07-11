import { get } from "svelte/store";
import { ResourceAudioTrackModel } from "./ResourceAudioTrackModel.svelte";
import type { ClientModelListenerType, ClockClientModel } from "$lib/model/client/ClockClientModel";
import type { AudioTrackModelBase } from "./AudioTrackModelBase";
import { writableThatDoesntPollTooMuch } from "$lib/common/WritableThatDoesntPollTooMuch";
import type { AudioParams } from "$lib/common/AudioParams";
// import { createLogger, type Logger } from "vite";

export type ClockAudioTrackOptions = {
    enableParamsTx?: boolean;
}

export class ClockAudioTrackModel implements AudioTrackModelBase, ClientModelListenerType {
    static readonly TAG: string = "ClockAudioTrack";
    readonly logger = console;
    private cleanupEffects: (()=>void)|undefined = undefined;
    private unsubscribers: (()=>void)[] = [];

    private readonly finalBellAudioModel: ResourceAudioTrackModel;
    private readonly reminderBellAudioModel: ResourceAudioTrackModel;

    private readonly audioParamsGainTxBufferStore: ReturnType<typeof writableThatDoesntPollTooMuch<number>> | undefined;
    private readonly audioParamsPanTxBufferStore: ReturnType<typeof writableThatDoesntPollTooMuch<number>> | undefined;

    get gain(): number { return this.finalBellAudioModel.gain; }
    get pan(): number { return this.finalBellAudioModel.pan; }
    set gain(newValue) {
        this.finalBellAudioModel.gain = newValue;
        this.reminderBellAudioModel.gain = newValue;
    }
    set pan(newValue){
        this.finalBellAudioModel.pan = newValue;
        this.reminderBellAudioModel.pan = newValue;
    }

    get input(){
        return this.finalBellAudioModel.input;
    }


    constructor(audioContext: AudioContext, readonly clockModel: ClockClientModel, outputNode: AudioNode = audioContext.destination, options: ClockAudioTrackOptions = {}){
        this.logger.info(`Initializing ClockAudioTrack`);
        this.finalBellAudioModel = new ResourceAudioTrackModel(audioContext, outputNode);
        this.reminderBellAudioModel = new ResourceAudioTrackModel(audioContext, outputNode);
        
        const finalBellUrl =  clockModel.finalBellURL();
        const reminderBellUrl = clockModel.reminderBellURL();
        if(finalBellUrl){
            this.finalBellAudioModel.loadResource(finalBellUrl)
        } else {
            this.logger.info("No audio to load for final bell")
        }

        if(reminderBellUrl){
            this.reminderBellAudioModel.loadResource(reminderBellUrl);
        } else {
            this.logger.info("No audio to load for reminder bell")
        }


        let initParams = get(clockModel.audioParams);
        this.gain = initParams.gain;
        this.pan = initParams.pan;

        this.clockModel.addListener(this);

        if(options.enableParamsTx){
            this.audioParamsGainTxBufferStore = writableThatDoesntPollTooMuch(this.gain, 100);
            this.audioParamsPanTxBufferStore = writableThatDoesntPollTooMuch(this.pan, 100);
        }

        this.logger.debug("ClockAudioTrack initialized with gain:", this.gain, "pan:", this.pan);

        this.setup();
    }

    get title(){
        return this.clockModel.config.teamName ?? this.clockModel.clockId;
    }

    get id(){
        return this.clockModel.clockId;
    }

    private setup(){
        this.teardown();
        this.logger.info(`Setting up ClockAudioTrackModel`);
        this.unsubscribers.push(this.clockModel.audioParams.subscribe(params=>{
            this.gain = params.gain;
            this.pan = params.pan;
        }));

        this.cleanupEffects = $effect.root(()=>{
            $effect(()=>{
                if(this.audioParamsGainTxBufferStore){
                    this.audioParamsGainTxBufferStore.set(this.gain);
                }
                this.finalBellAudioModel.gain = this.gain;
                this.reminderBellAudioModel.gain = this.gain;
            });

            $effect(()=>{
                if(this.audioParamsPanTxBufferStore){
                    this.audioParamsPanTxBufferStore.set(this.pan);
                }
                this.finalBellAudioModel.pan = this.pan;
                this.reminderBellAudioModel.pan = this.pan;
            })
             
        })

        if(this.audioParamsGainTxBufferStore && this.audioParamsPanTxBufferStore){
            this.unsubscribers.push(this.audioParamsGainTxBufferStore.subscribe(gain=>{
                fetch(`/api/clock/${this.clockModel.clockId}/audioParams`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({gain, pan: this.pan})
                }).catch(err=>{
                    console.error("Error sending audioParams update to server:", err);
                });
            }));
            this.unsubscribers.push(this.audioParamsPanTxBufferStore.subscribe(pan=>{
                fetch(`/api/clock/${this.clockModel.clockId}/audioParams`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({gain: this.gain, pan})
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
        if(this.cleanupEffects) this.cleanupEffects();
        this.clockModel.removeListener(this);
    }

    close(){
        this.teardown();
        this.finalBellAudioModel.close();
        this.reminderBellAudioModel.close();
    }


    // CLIENT MODEL LISTENER CALLBACKS
    onFinalBellRing?: (() => void) | undefined = ()=>{
        this.finalBellAudioModel.currentTime = 0;
        this.finalBellAudioModel.play().catch((err)=>{
            this.logger.error("Error playing final bell audio:", err);
        });
    };

    onBellRingRequest?: (() => void) | undefined = ()=>{
        this.onFinalBellRing?.();
    };

    onClockReset?: (() => void) | undefined;

    onReminderBellRing?: (() => void) | undefined = ()=>{
        this.reminderBellAudioModel.currentTime = 0;
        this.reminderBellAudioModel.play().then(()=>{
            this.logger.info("Played reminder bell audio");
        }).catch((err)=>{
            this.logger.error("Error playing reminder bell audio:", err);
        });
    };

    onAudioParamsChanged?: ((params: AudioParams) => void) | undefined = (params)=>{
        this.logger.info("Audio params changed:", params);
        this.gain = params.gain;
        this.pan = params.pan;
    };

    getGainDB(): number {
        return  20 * Math.log10(this.gain);
    }

    setGainDB(gainDB: number): void {
        this.gain = Math.pow(10, gainDB / 20);
    }
}