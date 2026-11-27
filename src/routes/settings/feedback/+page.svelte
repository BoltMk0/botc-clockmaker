<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { deleteIcon } from "$lib/icons/material.js";
    import { invalidateAll } from "$app/navigation";
    import { enhance } from "$app/forms";
    import ServiceSettingsForm, { type ServiceSettingGroup } from "$lib/components/settings/ServiceSettingsForm.svelte";
    import type { PageProps } from "./$types";

    let { data, form }: PageProps = $props();

    type Tab = 'messages' | 'setup';
    const TABS: { tab: Tab, label: string }[] = [
        { tab: 'messages', label: 'Messages' },
        { tab: 'setup', label: 'Setup' }
    ];
    let tab: Tab = $state('messages');

    const SERVICE_GROUPS: ServiceSettingGroup[] = [
        {
            title: 'Bot check',
            description: "Optional. Checks each submission with your Cloudflare Turnstile widget. Without a secret key there's no check, only a per-visitor rate limit.",
            fields: [
                { name: 'TURNSTILE_SITE_KEY', label: 'Site key', hint: "Without it, the original Clockmaker deployment's widget is used, which won't work on your domain." },
                { name: 'TURNSTILE_SECRET_KEY', label: 'Secret key' }
            ]
        },
        {
            title: 'Emails',
            description: 'Optional. Emails each submission from a Gmail account, using an app password. Without these, feedback is only saved on the server.',
            fields: [
                { name: 'GMAIL_USER', label: 'Gmail address' },
                { name: 'GMAIL_APP_PASSWORD', label: 'App password' },
                { name: 'FEEDBACK_TO_EMAILS', label: 'Send to', hint: 'Several addresses separated by ;' }
            ]
        }
    ];

    function deleteEntry(filename: string) {
        if (!confirm("Are you sure you want to delete this feedback entry? This action cannot be undone.")) return;
        fetch(`/api/feedback/${encodeURIComponent(filename)}`, { method: "DELETE" }).then(async (response) => {
            if (response.ok) {
                await invalidateAll();
            } else {
                alert("Failed to delete feedback entry");
            }
        });
    }
</script>

<div class="center-content main">
<div class="column">

<div class="tab-bar" role="tablist" aria-label="Feedback">
    {#each TABS as t}
        <button role="tab" id="feedback-tab-button-{t.tab}" aria-controls="feedback-tab-{t.tab}" aria-selected={tab === t.tab} class:selected={tab === t.tab} onclick={() => tab = t.tab}>
            {t.label}
        </button>
    {/each}
</div>

<div class="panel" id="feedback-tab-messages" hidden={tab !== 'messages'} role="tabpanel" aria-labelledby="feedback-tab-button-messages">
    <header>
        <h1>Feedback</h1>
    </header>
    <p class="description">
        Anonymous feedback submitted through the feedback form.
        {#if !data.enabled}The form is turned off: turn it on in the Setup tab.{/if}
    </p>

    <div class="list-container">
        {#if data.entries.length === 0}
            <p class="empty">No feedback submitted yet.</p>
        {/if}

        <ul>
            {#each data.entries as entry (entry.filename)}
                <li>
                    <div class="entry-header">
                        <span class="entry-date">{new Date(entry.timestamp).toLocaleString()}</span>
                        <button class="delete" title="Delete" aria-label="Delete entry" onclick={() => deleteEntry(entry.filename)}><MaterialIcon icon={deleteIcon} size="1.25em"/></button>
                    </div>
                    <p class="entry-text">{entry.text}</p>
                </li>
            {/each}
        </ul>
    </div>
</div>

<div class="panel" id="feedback-tab-setup" hidden={tab !== 'setup'} role="tabpanel" aria-labelledby="feedback-tab-button-setup">
    <header>
        <h1>Feedback Setup</h1>
    </header>

    <form class="option" method="POST" action="?/setEnabled" use:enhance={() => async ({ update }) => update({ reset: false })}>
        <label>
            <input
                type="checkbox"
                name="enabled"
                value="true"
                checked={data.enabled}
                onchange={(ev) => ev.currentTarget.form?.requestSubmit()}
            />
            Accept feedback
        </label>
        <p>
            {#if !data.enabled}
                The feedback form is turned off: anyone opening it is told feedback isn't being accepted.
            {:else if data.turnstile}
                The feedback form is open to anyone, and checked with Cloudflare Turnstile.
            {:else}
                The feedback form is open to anyone, <strong>without a bot check</strong>. Set a Turnstile secret key
                below to add one.
            {/if}
        </p>
    </form>

    <ServiceSettingsForm groups={SERVICE_GROUPS} services={data.services} error={form?.error}/>
</div>

</div>
</div>

<style>
    .main {
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.5rem;
        align-items: flex-start;
    }

    .column {
        width: min(60rem, 100%);
        display: flex;
        flex-direction: column;
    }

    /* Folder tabs on top of the open tab's panel, as in Communications */
    .tab-bar {
        display: flex;
        gap: 0.25rem;
        padding: 0 1rem;
    }

    .tab-bar button {
        position: relative;
        padding: 0.6em 1.4em;
        font: inherit;
        background: none;
        color: var(--theme-on-bg);
        border: 1px solid transparent;
        border-bottom: none;
        border-radius: 10px 10px 0 0;
        opacity: 0.7;
        white-space: nowrap;
        cursor: pointer;
    }

    .tab-bar button:hover {
        filter: none;
        opacity: 1;
        background-color: color-mix(in srgb, var(--theme-bg-secondary) 50%, transparent);
    }

    .tab-bar button.selected {
        z-index: 1;
        margin-bottom: -1px;
        padding-bottom: calc(0.6em + 1px);
        opacity: 1;
        font-weight: bold;
        background-color: var(--theme-bg-secondary);
        border-color: var(--theme-bg-tertiary);
    }

    .panel[hidden] {
        display: none;
    }

    @media (max-width: 560px) {
        .tab-bar button {
            flex: 1;
        }
    }

    .panel {
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
        width: min(60rem, 100%);
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
    }

    h1 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }

    .description {
        margin: 0.25rem 0 1.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
    }

    .option {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        margin-bottom: 1.25rem;
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
    }

    .option label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        color: var(--theme-on-bg);
        cursor: pointer;
    }

    .option p {
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.8;
    }

    .list-container {
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    li {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        background-color: var(--theme-bg-secondary);
        border-radius: 8px;
    }

    .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .entry-date {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--theme-on-bg-secondary);
        opacity: 0.8;
    }

    .entry-text {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
    }

    button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font: inherit;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
    }

    button:hover {
        filter: brightness(1.15);
    }

    .delete:hover {
        background-color: var(--theme-error);
        color: var(--theme-on-error);
    }

    .empty {
        text-align: center;
        color: var(--theme-on-bg-secondary);
        margin: 0.5rem 0 1rem;
    }
</style>
