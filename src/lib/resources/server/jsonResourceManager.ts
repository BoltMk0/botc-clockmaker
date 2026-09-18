import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isGrimoireStateHistory } from "../../../routes/admin/games/[id]/grimoire/types";

type Identifiable = {
    id: string;
};

export class ValidationFailedError extends Error {
    constructor(message = "Validation failed") {
        super(message);
        this.name = "ValidationFailedError";
        Object.setPrototypeOf(this, ValidationFailedError.prototype);
    }
}

const RESOURCE_DATA_DIR = process.env.RESOURCE_DATA_DIR || "data/resources";

export class JSONMultiResourceManager<T> {
    #values: T[];
    readonly #dirpath: string;
    readonly #getId: (t: T) => string;

    constructor(
        readonly identifier: string,
        private readonly validator?: (obj: unknown) => obj is T,
        getId?: (t: T) => string
    ) {
        this.#getId = getId ?? ((t: T) => (t as Identifiable).id);
        this.#dirpath = join(RESOURCE_DATA_DIR, identifier);
        if (!existsSync(this.#dirpath)) {
            mkdirSync(this.#dirpath, { recursive: true });
        }
        this.#values = this.#readdir();
    }

    get values(): readonly T[] {
        return this.#values;
    }

    #readdir(): T[] {
        const values: T[] = [];
        for (const f of readdirSync(this.#dirpath)) {
            if (!f.endsWith('.json')) continue;

            const fpath = join(this.#dirpath, f);
            try {
                values.push(this.#loadOne(fpath));
            } catch (e) {
                if (e instanceof ValidationFailedError || e instanceof SyntaxError) {
                    console.warn(`Failed to load ${this.identifier} from ${fpath}. Ignoring.`, e);
                } else {
                    throw e;
                }
            }
        }
        return values;
    }

    #objectFilepath(objOrId: T | string): string {
        const id = typeof objOrId === 'string' ? objOrId : this.#getId(objOrId);
        return join(this.#dirpath, `${id}.json`);
    }

    #saveOne(obj: T): void {
        writeFileSync(this.#objectFilepath(obj), JSON.stringify(obj, undefined, 2), { encoding: 'utf-8' });
    }

    #loadOne(filepath: string): T {
        const raw = readFileSync(filepath, { encoding: 'utf-8' });
        const obj = JSON.parse(raw);
        if (this.validator && !this.validator(obj)) {
            throw new ValidationFailedError(`Invalid ${this.identifier} in ${filepath}`);
        }
        return obj;
    }

    add(obj: unknown): T {
        if (this.validator && !this.validator(obj)) {
            throw new ValidationFailedError(`Object is not a valid ${this.identifier}`);
        }
        const validated = obj as T;
        const existingIndex = this.getIndex(this.#getId(validated));
        if (existingIndex >= 0) {
            this.#values[existingIndex] = validated;
        } else {
            this.#values.push(validated);
        }
        this.#saveOne(validated);
        return validated;
    }

    delete(val: T | string): void {
        const id = typeof val === 'string' ? val : this.#getId(val);

        const index = this.getIndex(id);
        if (index >= 0) {
            this.#values.splice(index, 1);
        }

        const filepath = this.#objectFilepath(id);
        if (existsSync(filepath)) {
            unlinkSync(filepath);
        }
    }

    get(id: string): T | undefined {
        return this.#values.find(v => this.#getId(v) === id);
    }

    getIndex(id: string): number {
        return this.#values.findIndex(v => this.#getId(v) === id);
    }
}

function singletonFilepath(identifier: string): string {
    return join(RESOURCE_DATA_DIR, 'singletons', `${identifier}.json`);
}

export function loadSingletonJSONResource<T>(identifier: string, validator?: (obj: unknown) => obj is T): T | null {
    const filepath = singletonFilepath(identifier);
    if (!existsSync(filepath)) return null;

    const raw = readFileSync(filepath, { encoding: 'utf-8' });
    const obj = JSON.parse(raw);

    if (validator && !validator(obj)) {
        throw new ValidationFailedError(`Invalid ${identifier} in ${filepath}`);
    }

    return obj;
}

export function saveSingletonJSONResource<T>(identifier: string, value: T): void {
    const filepath = singletonFilepath(identifier);
    const dir = join(RESOURCE_DATA_DIR, 'singletons');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filepath, JSON.stringify(value, undefined, 2), { encoding: 'utf-8' });
}

export class JSONSingletonResourceManager<T> {
    #value: T | null;

    constructor(
        readonly identifier: string,
        private readonly validator?: (obj: unknown) => obj is T
    ) {
        this.#value = loadSingletonJSONResource(identifier, validator);
    }

    get value(): T | null {
        return this.#value;
    }

    save(value: T): void {
        if (this.validator && !this.validator(value)) {
            throw new ValidationFailedError(`Object is not a valid ${this.identifier}`);
        }
        this.#value = value;
        saveSingletonJSONResource(this.identifier, value);
    }
}


export const GRIM_STATE_MANAGER = new JSONMultiResourceManager('grimoire-state-v2', isGrimoireStateHistory);
