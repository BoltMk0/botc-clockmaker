import type { AmbienceResourceType } from "$lib/common/ambience";

class AmbienceChannel {
    audio: HTMLAudioElement;
    source: MediaElementAudioSourceNode;
    gainNode: GainNode;
    private audioContext: AudioContext;

    private stopTimeout: NodeJS.Timeout | null = null;

    constructor(audioContext: AudioContext, audio: HTMLAudioElement){
        this.audioContext = audioContext;
        this.audio = audio;
        this.audio.loop = true;
        this.source = audioContext.createMediaElementSource(this.audio);
        this.gainNode = audioContext.createGain();
        this.source.connect(this.gainNode);
    }

    connect(destination: AudioNode) {
        return this.gainNode.connect(destination);
    }

    private stopNow(){
        if(this.audio.src == "") return;
        if(this.stopTimeout) {
            clearTimeout(this.stopTimeout);
            this.stopTimeout = null;
        }
        this.audio.pause();
        this.audio.src = "";
        this.gainNode.gain.value = 0;
    }

    stop(){
        console.log("Stopping ambience channel with audio src:", this.audio.src);
        if(this.audio.src == "") return;
        this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 2);
        this.stopTimeout = setTimeout(()=>{
            this.stopNow();
        }, 1500);
    }

    loadResource(resource: AmbienceResourceType, onPlaybackStarted?: ()=>void) {
        this.stopNow();
        this.audio.src = resource.url;

        // Keep the success path separate so we don't claim playback started when it was blocked.
        this.audio.play()
            .then(() => {
                if(onPlaybackStarted) onPlaybackStarted();
                console.log("Ambience audio started playing:", this.audio.src);
                this.gainNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 2);
            })
            .catch((err) => {
                console.error("Error playing ambience audio:", err);
            });
    }
};



export class AmbienceEngine {
    private channels: AmbienceChannel[] = [];
    private activeChannelIndex = 0;
    masterGain: GainNode;
    constructor(context: AudioContext, audioElements: HTMLAudioElement[], destination?: AudioNode) {
        this.masterGain = context.createGain();
        this.masterGain.connect(destination ?? context.destination);
        this.masterGain.gain.value = 1;
        for(const audio of audioElements){
            const channel = new AmbienceChannel(context, audio);
            channel.connect(this.masterGain);
            this.channels.push(channel);
        }
    }

    loadResource(resource: AmbienceResourceType) {
        console.log("Loading ambience resource:", resource);
        let currentChannel = this.channels[this.activeChannelIndex];
        this.activeChannelIndex = (this.activeChannelIndex + 1) % this.channels.length;
        try {
            this.channels[this.activeChannelIndex].loadResource(resource, ()=>{
                currentChannel.stop();
            });
        } catch (err) {
            console.error("Error loading ambience resource:", err);
        }
    }
    
    stop() {
        this.channels[this.activeChannelIndex].stop();
    }
}