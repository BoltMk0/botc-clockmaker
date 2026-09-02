<script lang="ts">
    import { enhance } from "$app/forms";
    import { onMount } from "svelte";
    import type { SubmitFunction } from "@sveltejs/kit";

    let { form } = $props();

    let text = $state("");
    let submitting = $state(false);
    let turnstileEl: HTMLElement | undefined = $state();
    let turnstileReady = $state(false);

    onMount(() => {
        // Poll until the Turnstile script has loaded, then render explicitly.
        // This avoids the string-based data-callback approach, which is fragile
        // when the script is cached and initialises before the global is defined.
        const interval = setInterval(() => {
            if (!window.turnstile || !turnstileEl) return;
            clearInterval(interval);
            window.turnstile.render(turnstileEl, {
                sitekey: '0x4AAAAAAEk55R9-W9ZS1kzr',
                action: 'feedback',
                callback: () => { turnstileReady = true; },
            });
        }, 50);
        return () => clearInterval(interval);
    });

    const submit: SubmitFunction = () => {
        submitting = true;
        return async ({ update }) => {
            await update({ reset: false });
            submitting = false;
            turnstileReady = false;
            if (turnstileEl && window.turnstile) {
                window.turnstile.reset(turnstileEl);
            }
        };
    };

    function closeTab() {
        window.close();
        // window.close() is a no-op for tabs the user opened themselves;
        // fall back to sending them somewhere sensible.
        setTimeout(() => {
            if (!window.closed) window.location.href = "/";
        }, 150);
    }
</script>

<svelte:head>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</svelte:head>

<style>
    .wrap {
        width: 100%;
        max-width: 40em;
        margin: 0 auto;
        box-sizing: border-box;
        padding: 1.5em 1em;
        /* keep clear of iOS notch / home indicator in landscape */
        padding-left: max(1em, env(safe-area-inset-left));
        padding-right: max(1em, env(safe-area-inset-right));
        padding-bottom: max(1.5em, env(safe-area-inset-bottom));
        display: flex;
        flex-direction: column;
        align-items: stretch;
        text-align: center;
    }

    form {
        display: contents;
    }

    h1 {
        margin: 0 0 0.25em;
    }

    p {
        margin: 0;
    }

    textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 1em;
        min-height: 14em;
        max-height: 60vh;
        resize: vertical;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        font-size: 1rem;
    }

    button {
        width: 100%;
        padding: 0.4em 1em;
        font-size: 1rem;
    }

    .error {
        margin-top: 1em;
        color: #ff6b6b;
    }
</style>

<div class="wrap">
    {#if form?.success}
        <h1>Thank you!</h1>
        <p>Your feedback has been sent.</p>
    {:else}
        <form method="POST" use:enhance={submit}>
            <div style="display: flex; flex-direction: column; gap: 1em;">
                <div>
                    <h1>Feedback</h1>
                    <p>Leave us some anonymous feedback!</p>
                    <p>We don't store anything except what you write below.</p>
                </div>
                <input
                    type="text"
                    name="website"
                    tabindex="-1"
                    autocomplete="off"
                    aria-hidden="true"
                    style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0"
                />
                <div bind:this={turnstileEl}></div>
                {#if turnstileReady}
                <textarea
                    name="text"
                    placeholder="Write your message here..."
                    maxlength="5000"
                    bind:value={text}
                    required
                    autofocus
                ></textarea>
                <button disabled={text === "" || submitting}>
                    {submitting ? "Sending…" : "Send"}
                </button>
                {/if}
                {#if form && !form.success}
                    <p class="error">Couldn't send that. Please try again in a moment.</p>
                {/if}
            </div>
        </form>
    {/if}
</div>
