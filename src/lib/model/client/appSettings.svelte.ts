import { browser } from "$app/environment";
import type { FullDisplayMode } from "$lib/components/FullDisplay/fullDisplayTypes";
import { isQrPosition, type QrPosition } from "$lib/resources/common/qrCodes";

const STORAGE_KEY = "appSettings";

export const NOW_PLAYING_MODES = ['off', 'popup', 'on'] as const;
export type NowPlayingMode = typeof NOW_PLAYING_MODES[number];
export const NOW_PLAYING_MODE_LABELS: Record<NowPlayingMode, string> = { off: 'Off', popup: 'Popup', on: 'On' };

export const NOW_PLAYING_POSITIONS = ['top', 'top-right', 'bottom', 'bottom-left', 'bottom-right'] as const;
export type NowPlayingPosition = typeof NOW_PLAYING_POSITIONS[number];
export const NOW_PLAYING_POSITION_LABELS: Record<NowPlayingPosition, string> = {
    top: 'Top', 'top-right': 'Top right', bottom: 'Bottom', 'bottom-left': 'Bottom left', 'bottom-right': 'Bottom right'
};

function isNowPlayingMode(value: unknown): value is NowPlayingMode {
    return (NOW_PLAYING_MODES as readonly unknown[]).includes(value);
}

function isNowPlayingPosition(value: unknown): value is NowPlayingPosition {
    return (NOW_PLAYING_POSITIONS as readonly unknown[]).includes(value);
}

interface AppSettingsState {
    displayMode: FullDisplayMode;
    autoSize: boolean;
    size: number;
    showClockNames: boolean;
    showQRCodes: boolean;
    /** Where the town square shows a QR code for the game's script; null hides it. */
    scriptQrPosition: QrPosition | null;
    /** When on, QR codes use their default size and qrScale is ignored. */
    qrAutoSize: boolean;
    /** Multiplies the default QR code size, when qrAutoSize is off. */
    qrScale: number;
    /** Whether the town square shows the track playing (on Spotify or the music player) (title, artist and album art): never, popping up when a track starts, or all the time. */
    nowPlayingMode: NowPlayingMode;
    /** Where on the screen it shows. */
    nowPlayingPosition: NowPlayingPosition;
    /** Whether the town square plays the mixer's sound on this device. When off, its mixer only acts as a remote. */
    audioEngineEnabled: boolean;
}

const DEFAULT_STATE: AppSettingsState = {
    displayMode: 'clocktower3d',
    autoSize: true,
    size: 600,
    showClockNames: true,
    showQRCodes: false,
    scriptQrPosition: null,
    qrAutoSize: true,
    qrScale: 1,
    nowPlayingMode: 'popup',
    nowPlayingPosition: 'top',
    audioEngineEnabled: true
};


function calculateIdealSize(displayMode: FullDisplayMode){
    if(browser && displayMode !== undefined){
        switch(displayMode){
            case 'clocktower':
                return window.innerHeight/1.5;
            case 'original':
                return Math.min(window.innerWidth/2 - 30, window.innerHeight-60) - 30;
            default:
                return 700;
        }
    } else {
        return 700;
    }
}

class AppSettingsModel {
    displayMode: FullDisplayMode = $state(DEFAULT_STATE.displayMode);
    autoSize: boolean = $state(DEFAULT_STATE.autoSize);
    size: number = $state(DEFAULT_STATE.size);
    showClockNames: boolean = $state(DEFAULT_STATE.showClockNames);
    showQRCodes: boolean = $state(DEFAULT_STATE.showQRCodes);
    scriptQrPosition: QrPosition | null = $state(DEFAULT_STATE.scriptQrPosition);
    qrAutoSize: boolean = $state(DEFAULT_STATE.qrAutoSize);
    qrScale: number = $state(DEFAULT_STATE.qrScale);
    nowPlayingMode: NowPlayingMode = $state(DEFAULT_STATE.nowPlayingMode);
    nowPlayingPosition: NowPlayingPosition = $state(DEFAULT_STATE.nowPlayingPosition);
    audioEngineEnabled: boolean = $state(DEFAULT_STATE.audioEngineEnabled);

    /** How much to scale QR codes by, relative to their default size. */
    get qrSizeScale(): number {
        return this.qrAutoSize ? 1 : this.qrScale;
    }

    private saveTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(){
        this.loadState();

        if(browser){
            $effect.root(()=>{
                // On any changes, save state
                $effect(()=>{
                    // Read every setting so this effect reruns on any change.
                    const state: AppSettingsState = {
                        displayMode: this.displayMode,
                        autoSize: this.autoSize,
                        size: this.size,
                        showClockNames: this.showClockNames,
                        showQRCodes: this.showQRCodes,
                        scriptQrPosition: this.scriptQrPosition,
                        qrAutoSize: this.qrAutoSize,
                        qrScale: this.qrScale,
                        nowPlayingMode: this.nowPlayingMode,
                        nowPlayingPosition: this.nowPlayingPosition,
                        audioEngineEnabled: this.audioEngineEnabled
                    };
                    this.saveState(state);
                });

                // When autosize is enabled, immediately set the size
                $effect(()=>{
                    if(this.autoSize) this.size = calculateIdealSize(this.displayMode);
                });

                // When autosize is enabled, always recalculate size when browser window is resized
                $effect(()=>{
                    if(!browser) return;

                    const self = this;
                    function onResize(){
                        if(!self) return;
                        self.reCalculateSize();
                    }
                    if(this.autoSize){
                        console.debug("Enabling autosize and adding resize listener");
                        window.addEventListener('resize', onResize);
                    } else {
                        console.debug("Disabling autosize and adding resize listener");
                        window.removeEventListener('resize', onResize);
                    }
                });
            });
        }
    }

    private saveState(state: AppSettingsState){
        if(this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(()=>{
            console.debug("Saving appSettings:", state);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            this.saveTimeout = null;
        }, 500);
    }

    private loadState(){
        if(!browser) return;

        const storedValue = localStorage.getItem(STORAGE_KEY);
        if(!storedValue) return;

        try {
            const parsedValue = JSON.parse(storedValue);
            this.displayMode = parsedValue.displayMode ?? this.displayMode;
            this.autoSize = parsedValue.autoSize ?? this.autoSize;
            this.size = parsedValue.size ?? this.size;
            this.showClockNames = parsedValue.showClockNames ?? this.showClockNames;
            this.showQRCodes = parsedValue.showQRCodes ?? this.showQRCodes;
            if (parsedValue.scriptQrPosition === null || isQrPosition(parsedValue.scriptQrPosition)) {
                this.scriptQrPosition = parsedValue.scriptQrPosition;
            }
            this.qrAutoSize = parsedValue.qrAutoSize ?? this.qrAutoSize;
            this.qrScale = parsedValue.qrScale ?? this.qrScale;
            if (isNowPlayingMode(parsedValue.nowPlayingMode)) this.nowPlayingMode = parsedValue.nowPlayingMode;
            if (isNowPlayingPosition(parsedValue.nowPlayingPosition)) this.nowPlayingPosition = parsedValue.nowPlayingPosition;
            if (typeof parsedValue.audioEngineEnabled === 'boolean') this.audioEngineEnabled = parsedValue.audioEngineEnabled;
        } catch(e) {
            console.error("Failed to parse stored app settings", e);
        }
    }

    reCalculateSize(){
        this.size = calculateIdealSize(this.displayMode);
    }
}

export const appSettings = new AppSettingsModel();
