import { browser } from "$app/environment";
import type { FullDisplayMode } from "$lib/components/FullDisplay/fullDisplayTypes";

const STORAGE_KEY = "appSettings";

interface AppSettingsState {
    displayMode: FullDisplayMode;
    autoSize: boolean;
    size: number;
    showClockNames: boolean;
}

const DEFAULT_STATE: AppSettingsState = {
    displayMode: 'clocktower',
    autoSize: true,
    size: 600,
    showClockNames: true,
};

class AppSettingsModel {
    displayMode: FullDisplayMode = $state(DEFAULT_STATE.displayMode);
    autoSize: boolean = $state(DEFAULT_STATE.autoSize);
    size: number = $state(DEFAULT_STATE.size);
    showClockNames: boolean = $state(DEFAULT_STATE.showClockNames);

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
                    };
                    this.saveState(state);
                });

                // When autosize is enabled, immediately set the size
                $effect(()=>{
                    if(this.autoSize) this.size = this.calculateIdealSize();
                });

                // When autosize is enabled, always recalculate size when browser window is resized
                $effect(()=>{
                    if(!browser) return;
                    if(this.autoSize){
                        console.debug("Enabling autosize and adding resize listener");
                        window.addEventListener('resize', this.reCalculateSize);
                    } else {
                        console.debug("Disabling autosize and adding resize listener");
                        window.removeEventListener('resize', this.reCalculateSize);
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
        } catch(e) {
            console.error("Failed to parse stored app settings", e);
        }
    }

    
    private calculateIdealSize(){
        if(browser && this.displayMode !== undefined){
            switch(this.displayMode){
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

    reCalculateSize(){
        this.size = this.calculateIdealSize();
    }
}

export const appSettings = new AppSettingsModel();
