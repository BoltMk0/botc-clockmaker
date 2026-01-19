import { validateConfig, type Config } from "$lib/common/config";
import { readFileSync, writeFileSync } from "node:fs";
import { getLocalResource } from "./localfiles";

export function defaultConfigPath(): string {
    return getLocalResource(`config/botc-clocktower.config.json`, {makeDirs: true});
}

export function saveConfigToFile(config: Config, opts: {filepath?: string} = {}): void {
    const filepath = opts.filepath || defaultConfigPath();
    writeFileSync(filepath, JSON.stringify(config, null, 2), 'utf-8');
    console.log("Config saved to", filepath);
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
