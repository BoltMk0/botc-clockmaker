import { readFileSync, writeFileSync } from "node:fs";

export type TimerOption = {
    label?: string;
    duration: number;
    ringBellWhenRemaining?: number;
}

export type Config = {
    timerOptions: TimerOption[];
}

export function getDefaultConfig(): Config {
    return {
        timerOptions: [
            { label: '5 Seconds', duration: 5 },
            { label: '15 Seconds', duration: 15, ringBellWhenRemaining: 5 },
            { label: '1 Minute', duration: 60 },
            { label: '3 Minutes', duration: 3 * 60, ringBellWhenRemaining: 30 },
            { label: '5 Minutes', duration: 5 * 60, ringBellWhenRemaining: 30 },
            { label: '8 Minutes', duration: 8 * 60, ringBellWhenRemaining: 30 },
        ]
    };
}

export function validateConfig(config: any): config is Config {
    if(typeof config !== 'object' || config === null) return false;
    if(!Array.isArray(config.timerOptions)) return false;
    for(const option of config.timerOptions){
        if(typeof option !== 'object' || option === null) return false;
        if(typeof option.duration !== 'number' || option.duration <= 0) return false;
        if(option.label !== undefined && typeof option.label !== 'string') return false;
        if(option.ringBellWhenRemaining !== undefined && (typeof option.ringBellWhenRemaining !== 'number' || option.ringBellWhenRemaining < 0)) return false;
    }
    return true;
}

export function defaultConfigPath(): string {
    const dataDir = process.env.DATA_DIR || '.';
    return `${dataDir}/botc-clocktower.config.json`;
}

export function saveConfigToFile(config: Config, opts: {filepath?: string} = {}): void {
    const filepath = opts.filepath || defaultConfigPath();
    writeFileSync(filepath, JSON.stringify(config, null, 2), 'utf-8');
}

export function loadConfigFromFile(opts: {filepath?: string} = {}): Config {
    const filepath = opts.filepath || defaultConfigPath();
    const data = JSON.parse(readFileSync(filepath, 'utf-8'));
    if(validateConfig(data)){
        return data;
    } else {
        throw new Error("Invalid config format in file: " + filepath);
    }
}
