<script lang="ts" module>
    export type ServiceSettingField = { name: string; label: string; hint?: string };
    export type ServiceSettingGroup = { title: string; description: string; fields: ServiceSettingField[] };

    /** What the server says about the services' settings (serviceSettingsStatus). Never includes a secret's value. */
    export type ServiceSettingsData = {
        canStore: boolean;
        unreadable: boolean;
        settings: { name: string; secret: boolean; fromEnv: boolean; isSet: boolean; value?: string }[];
    };
</script>

<script lang="ts">
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';

    /**
     * Edits some of the outside services' settings, a form per group. The page's server needs the actions from
     * serviceSettingsActions (?/saveServices and ?/clearService).
     */
    let { groups, services, error }: {
        groups: ServiceSettingGroup[];
        services: ServiceSettingsData;
        /** The error a failed action returned, if any. */
        error?: string;
    } = $props();

    const status = $derived(new Map(services.settings.map(s => [s.name, s])));
    const disabled = $derived(!services.canStore);

    let savedGroup = $state<string | null>(null);

    function submit(group: string): SubmitFunction {
        return ({ action, cancel }) => {
            if (action.search === '?/clearService' && !confirm('Clear this setting?')) {
                cancel();
                return;
            }
            return async ({ result, update }) => {
                // The page's data is reloaded, which re-renders the fields empty (see the #key below)
                await update({ reset: false });
                if (result.type === 'success') {
                    savedGroup = group;
                    setTimeout(() => { if (savedGroup === group) savedGroup = null; }, 2000);
                }
            };
        };
    }
</script>

<div class="service-settings">
    <p class="about">
        Secrets are write-only: once saved, they're never shown again, only whether they're set. They're stored
        encrypted with the server's <code>SECRETS_KEY</code>.
    </p>

    {#if !services.canStore}
        <div class="notice">
            To save these here, set the <code>SECRETS_KEY</code> environment variable on the server to a long random
            passphrase and restart it. Until then they can only be set as environment variables.
        </div>
    {:else if services.unreadable}
        <div class="notice error">
            The saved settings couldn't be decrypted, probably because <code>SECRETS_KEY</code> has changed. They're
            being ignored. Saving anything replaces them, so enter them all again (in Feedback and Services).
        </div>
    {/if}

    {#if error}
        <div class="notice error">{error}</div>
    {/if}

    {#key services}
        {#each groups as group (group.title)}
            <form class="group" method="POST" action="?/saveServices" use:enhance={submit(group.title)}>
                <div class="group-text">
                    <h2>{group.title}</h2>
                    <p>{group.description}</p>
                </div>

                {#each group.fields as field (field.name)}
                    {@const s = status.get(field.name)!}
                    <div class="field">
                        <label for={field.name}>
                            {field.label}
                            {#if s.fromEnv}
                                <span class="chip">Set by environment variable</span>
                            {:else if s.secret}
                                <span class="chip" class:set={s.isSet}>{s.isSet ? 'Set' : 'Not set'}</span>
                            {/if}
                        </label>
                        <div class="field-row">
                            {#if s.secret}
                                <input
                                    id={field.name}
                                    name={s.fromEnv ? undefined : field.name}
                                    type="password"
                                    autocomplete="new-password"
                                    spellcheck="false"
                                    placeholder={s.fromEnv ? field.name : s.isSet ? 'Saved. Type a new one to replace it' : 'Not set'}
                                    disabled={disabled || s.fromEnv}
                                />
                                {#if s.isSet && !s.fromEnv}
                                    <button class="button-style" type="submit" formaction="?/clearService" name="name" value={field.name} disabled={disabled}>Clear</button>
                                {/if}
                            {:else}
                                <input
                                    id={field.name}
                                    name={s.fromEnv ? undefined : field.name}
                                    type="text"
                                    autocomplete="off"
                                    spellcheck="false"
                                    value={s.value}
                                    placeholder="Not set"
                                    disabled={disabled || s.fromEnv}
                                />
                            {/if}
                        </div>
                        {#if field.hint}<p class="hint">{field.hint}</p>{/if}
                    </div>
                {/each}

                <div class="actions">
                    {#if savedGroup === group.title}<span class="saved">Saved</span>{/if}
                    <button class="button-style" type="submit" disabled={disabled || group.fields.every(f => status.get(f.name)!.fromEnv)}>Save</button>
                </div>
            </form>
        {/each}
    {/key}
</div>

<style>
    .service-settings {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .about, .group-text p {
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.8;
    }
    .notice {
        padding: 0.7rem 0.9rem;
        border-radius: 8px;
        font-size: 0.9rem;
        border-left: 3px solid var(--theme-highlight);
        background-color: color-mix(in srgb, var(--theme-highlight) 12%, transparent);
    }
    .notice.error {
        border-left-color: var(--theme-error);
        background-color: color-mix(in srgb, var(--theme-error) 12%, transparent);
    }
    .group {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
    }
    h2 {
        margin: 0 0 0.25rem;
        font-size: 1.05rem;
        color: var(--theme-on-bg);
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }
    label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        font-size: 0.9rem;
    }
    .chip {
        font-weight: normal;
        font-size: 0.75rem;
        padding: 0.1rem 0.5rem;
        border-radius: 999px;
        background-color: var(--theme-bg-tertiary);
        opacity: 0.85;
    }
    .chip.set {
        background-color: color-mix(in srgb, var(--theme-highlight) 25%, transparent);
        opacity: 1;
    }
    .field-row {
        display: flex;
        gap: 0.5rem;
    }
    .field-row input {
        flex: 1;
        min-width: 0;
    }
    .hint {
        margin: 0;
        font-size: 0.8rem;
        opacity: 0.7;
    }
    .actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.75rem;
    }
    .saved {
        font-size: 0.9rem;
        opacity: 0.8;
    }
    button {
        padding: 0.5rem 1rem;
        white-space: nowrap;
        font-weight: 600;
    }
    code {
        font-size: 0.85em;
    }
</style>
