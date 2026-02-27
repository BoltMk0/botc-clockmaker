import { validateConfig, type Config } from "$lib/common/config";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { getLocalResource } from "./localfiles";

export function defaultConfigPathForId(id: string): string {
    return getLocalResource(`config/${id}.json`, {makeDirs: true});
}

export function loadConfigForId(id: string): Config {
    const filepath = defaultConfigPathForId(id);
    const data = JSON.parse(readFileSync(filepath, 'utf-8'));
    if(validateConfig(data)){
        return data;
    } else {
        throw new Error("Invalid config format in file: " + filepath);
    }
}

export function loadAllConfigs(){
    const configs: {id: string, config: Config}[] = [];
    const configDir = getLocalResource('config', {makeDirs: true, isDir: true});
    const files = readdirSync(configDir);
    for (const file of files) {
        if(!file.endsWith('.json')) continue;
        const filepath = `${configDir}/${file}`;
        const id = file.slice(0, -5);
        const data = JSON.parse(readFileSync(filepath, 'utf-8'));
        if (validateConfig(data)) {
            configs.push({ id, config: data });
        } else {
            console.warn("Invalid config format in file:", filepath);
        }
    }
    return configs;
}

export function saveConfigWithId(config: Config, id: string): void {
    const filepath = defaultConfigPathForId(id);
    writeFileSync(filepath, JSON.stringify(config, null, 2), 'utf-8');
    console.log("Config saved to", filepath);
}