<script lang="ts">
    import { enhance } from "$app/forms";
    import { onMount } from "svelte";
    import type { SubmitFunction } from "@sveltejs/kit";

    const SITEKEY = "0x4AAAAAAEk55R9-W9ZS1kzr";
    const TURNSTILE_SRC =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

    let { form } = $props();

    let text = $state("");
    let submitting = $state(false);
    let turnstileEl: HTMLElement | undefined = $state();
    let token = $state("");
    let loadError = $state(false);

    // Set once the widget is rendered; used to reset it after a submit.
    let resetWidget: () => void = () => {};

    function loadScript(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (window.turnstile) return resolve();
            const existing = document.querySelector<HTMLScriptElement>(
                "script[data-turnstile]",
            );
            if (existing) {
                existing.addEventListener("load", () => resolve());
                existing.addEventListener("error", () =>
                    reject(new Error("turnstile script failed to load")),
                );
                return;
            }
            const s = document.createElement("script");
            s.src = TURNSTILE_SRC;
            s.async = true;
            s.defer = true;
            s.dataset.turnstile = "";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("turnstile script failed to load"));
            document.head.appendChild(s);
        });
    }

    onMount(() => {
        let cancelled = false;
        let widgetId: string | undefined;

        // If the challenge hasn't produced a token in a reasonable window,
        // surface a recovery path rather than leaving the user stuck.
        const timeout = setTimeout(() => {
            if (!token) loadError = true;
        }, 20_000);

        loadScript()
            .then(() => {
                // loadScript resolves on the script's load event (or immediately
                // if it was already present), so the api is ready to use here.
                // Don't call turnstile.ready() — it warns when invoked after the
                // script has already loaded, which is always the case for us.
                if (cancelled || !turnstileEl) return;
                if (!window.turnstile) {
                    loadError = true;
                    return;
                }
                widgetId = window.turnstile.render(turnstileEl, {
                    sitekey: SITEKEY,
                    action: "feedback",
                    appearance: "always",
                    retry: "auto",
                    "refresh-expired": "auto",
                    callback: (t) => {
                        token = t;
                        loadError = false;
                    },
                    "error-callback": () => {
                        loadError = true;
                        return true;
                    },
                    "expired-callback": () => {
                        token = "";
                        if (widgetId) window.turnstile?.reset(widgetId);
                    },
                    "timeout-callback": () => {
                        if (widgetId) window.turnstile?.reset(widgetId);
                    },
                });
                resetWidget = () => {
                    token = "";
                    if (widgetId) window.turnstile?.reset(widgetId);
                };
            })
            .catch(() => {
                loadError = true;
            });

        return () => {
            cancelled = true;
            clearTimeout(timeout);
            if (widgetId) window.turnstile?.remove(widgetId);
        };
    });

    const submit: SubmitFunction = () => {
        submitting = true;
        return async ({ update }) => {
            await update({ reset: false });
            submitting = false;
            resetWidget();
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

    /* Reserve space so the layout doesn't jump while the widget loads. */
    .turnstile {
        min-height: 65px;
        display: flex;
        justify-content: center;
    }

    .hint {
        color: #9ca3af;
        font-size: 0.9rem;
    }

    .error {
        margin-top: 1em;
        color: #ff6b6b;
    }

    .reload {
        margin-top: 0.5em;
        width: auto;
        align-self: center;
        padding: 0.4em 1.2em;
    }
</style>

<div class="wrap">
    {#if form?.success}
        <h1>Thank you!</h1>
        <p>Your feedback has been sent.</p>
        <button class="reload" onclick={closeTab}>Close</button>
    {:else}
        <form method="POST" use:enhance={submit}>
            <div style="display: flex; flex-direction: column; gap: 1em;">
                <div style="display: flex; flex-direction: column; gap: 0.3em;">
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
                <div class="turnstile" bind:this={turnstileEl}></div>

                {#if loadError}
                    <p class="error">
                        Couldn't load the verification check. This can happen with
                        strict privacy settings or a flaky connection.
                    </p>
                    <button
                        type="button"
                        class="reload"
                        onclick={() => window.location.reload()}
                    >
                        Reload
                    </button>
                {:else if !token}
                    <p class="hint">Verifying you're human…</p>
                {:else}
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
