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

export class JSONMultiResourceManager<T extends Identifiable> {
    #values: T[];
    readonly #dirpath: string;

    constructor(readonly identifier: string, private readonly validator?: (obj: unknown) => obj is T) {
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
        return join(this.#dirpath, `${typeof objOrId === 'object' ? objOrId.id : objOrId}.json`);
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
        const existingIndex = this.getIndex(validated.id);
        if (existingIndex >= 0) {
            this.#values[existingIndex] = validated;
        } else {
            this.#values.push(validated);
        }
        this.#saveOne(validated);
        return validated;
    }

    delete(val: T | string): void {
        const id = typeof val === 'object' ? val.id : val;

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
        return this.#values.find(v => v.id === id);
    }

    getIndex(id: string): number {
        return this.#values.findIndex(v => v.id === id);
    }
}

export function loadSingletonJSONResource<T>(identifier: string, validator?: (obj: unknown) => obj is T): T | null {
    const filepath = join(RESOURCE_DATA_DIR, 'singletons', `${identifier}.json`);
    if (!existsSync(filepath)) return null;

    const raw = readFileSync(filepath, { encoding: 'utf-8' });
    const obj = JSON.parse(raw);

    if (validator && !validator(obj)) {
        throw new ValidationFailedError(`Invalid ${identifier} in ${filepath}`);
    }

    return obj;
}


export const GRIM_STATE_MANAGER = new JSONMultiResourceManager('grimoire-state-v2', isGrimoireStateHistory);
