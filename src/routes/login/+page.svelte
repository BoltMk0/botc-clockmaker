<script lang="ts">
    import { enhance } from "$app/forms";

    let { data, form } = $props();
    let submitting = $state(false);
</script>

<main>
    <div class="card">
        <div class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
        </div>
        <h1 class="dumbledore-font">{data.needsSetup ? "Set a password" : "Welcome back"}</h1>
        <p class="subtitle">
            {data.needsSetup
                ? "No password has been set yet. Choose one to protect this site."
                : "Enter the password to continue."}
        </p>

        <form
            method="POST"
            use:enhance={() => {
                submitting = true;
                return async ({ update }) => {
                    await update();
                    submitting = false;
                };
            }}
        >
            <label>
                <span>Password</span>
                <!-- svelte-ignore a11y_autofocus -->
                <input type="password" name="password" autofocus required
                    autocomplete={data.needsSetup ? "new-password" : "current-password"} />
            </label>
            {#if data.needsSetup}
                <label>
                    <span>Confirm password</span>
                    <input type="password" name="confirm" required autocomplete="new-password" />
                </label>
            {/if}
            {#if form?.error}
                <div class="error" role="alert">{form.error}</div>
            {/if}
            <button class="button-style highlight" type="submit" disabled={submitting}>
                {submitting ? "Please wait…" : data.needsSetup ? "Set password" : "Sign in"}
            </button>
        </form>
    </div>
</main>

<style>
    main {
        width: 100%;
        display: flex;
        justify-content: center;
        padding: 1rem;
        box-sizing: border-box;
        color: var(--theme-on-bg);
    }
    .card {
        width: 100%;
        max-width: 24rem;
        padding: 2rem 1.75rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 16px;
        box-shadow: 0 12px 40px var(--theme-shadow);
        text-align: center;
    }
    .icon {
        width: 56px;
        height: 56px;
        margin: 0 auto 1rem;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
    }
    h1 {
        margin: 0 0 0.4rem;
        font-size: 1.6rem;
        font-weight: normal;
    }
    .subtitle {
        margin: 0 0 1.5rem;
        color: var(--theme-on-bg-secondary);
        font-size: 0.95rem;
    }
    form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        text-align: left;
    }
    label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
        color: var(--theme-on-bg-secondary);
    }
    input {
        padding: 0.7rem 0.85rem;
        font-size: 1rem;
        border-radius: 8px;
        border: 1px solid var(--theme-bg-tertiary);
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus {
        outline: none;
        border-color: var(--theme-highlight);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-highlight) 35%, transparent);
    }
    .error {
        padding: 0.6rem 0.8rem;
        border-radius: 8px;
        font-size: 0.9rem;
        background-color: color-mix(in srgb, var(--theme-error) 20%, transparent);
        border: 1px solid var(--theme-error);
        color: var(--theme-on-bg);
    }
    button {
        padding: 0.75rem;
        font-size: 1rem;
        border-radius: 8px;
        font-weight: 600;
    }
</style>
