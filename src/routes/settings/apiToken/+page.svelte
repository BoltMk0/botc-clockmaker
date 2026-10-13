<script lang="ts">
    import { enhance } from '$app/forms';
    import type { PageProps } from './$types';

    let { data, form }: PageProps = $props();

    let copied = $state(false);

    async function copyToken(token: string) {
        await navigator.clipboard.writeText(token);
        copied = true;
        setTimeout(() => copied = false, 2000);
    }
</script>

<div class="wrapper">
    <section class="card">
        <header>
            <h1>API Token</h1>
            <p>
                Lets other programs, like Lightscapes, use this site's API and follow its games without the password.
                Give it only to programs you trust: it can do anything the clock remote can.
            </p>
        </header>

        {#if form?.token}
            <div class="token">
                <p>Copy the new token now: it won't be shown again.</p>
                <div class="token-row">
                    <code>{form.token}</code>
                    <button class="button-style" type="button" onclick={() => copyToken(form.token)}>{copied ? 'Copied' : 'Copy'}</button>
                </div>
            </div>
        {/if}

        <div class="row">
            <div class="row-text">
                <h2>{data.createdAt === null ? 'Create a token' : 'Replace the token'}</h2>
                <p>
                    {#if data.createdAt === null}
                        There's no token yet, so only signed-in devices can use the API.
                    {:else}
                        Created {new Date(data.createdAt).toLocaleString()}. Replacing it stops the old one working.
                    {/if}
                </p>
            </div>
            <form
                method="POST"
                action="?/create"
                use:enhance={({ cancel }) => {
                    if (data.createdAt !== null && !confirm('Replace the token? Programs using the old one will stop working.')) cancel();
                }}
            >
                <button class="button-style" type="submit">{data.createdAt === null ? 'Create token' : 'Replace token'}</button>
            </form>
        </div>

        {#if data.createdAt !== null}
            <div class="row">
                <div class="row-text">
                    <h2>Revoke the token</h2>
                    <p>Programs using it lose access straight away.</p>
                </div>
                <form
                    method="POST"
                    action="?/revoke"
                    use:enhance={({ cancel }) => {
                        if (!confirm('Revoke the token?')) cancel();
                    }}
                >
                    <button class="button-style error" type="submit">Revoke token</button>
                </form>
            </div>
        {/if}
    </section>
</div>

<style>
    .wrapper {
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.5rem;
        display: flex;
        justify-content: center;
        align-items: flex-start;
    }
    .card {
        width: 100%;
        max-width: 42rem;
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    header {
        margin-bottom: 0.25rem;
    }
    h1 {
        margin: 0 0 0.25rem;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }
    header p, .row-text p, .token p {
        margin: 0;
        font-size: 0.9rem;
        opacity: 0.8;
    }
    .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
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
    button {
        padding: 0.6rem 1rem;
        white-space: nowrap;
        font-weight: 600;
    }
    .token {
        padding: 0.7rem 0.9rem;
        border-radius: 8px;
        border-left: 3px solid var(--theme-highlight);
        background-color: color-mix(in srgb, var(--theme-highlight) 12%, transparent);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .token-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    code {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
        font-size: 0.9rem;
        color: var(--theme-on-bg);
    }
    @media (max-width: 560px) {
        .row {
            flex-direction: column;
            align-items: stretch;
        }
    }
</style>
