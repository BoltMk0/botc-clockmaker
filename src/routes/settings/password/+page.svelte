<div class="wrapper">
    <section class="card">
        <header>
            <h1>Password</h1>
            <p>Manage the password that protects this site.</p>
        </header>

        <div class="row">
            <div class="row-text">
                <h2>Reset password</h2>
                <p>
                    Removes the current password and signs out every device. You'll be asked to choose a
                    new password straight away.
                </p>
            </div>
            <form
                method="POST"
                action="?/reset"
                onsubmit={(e) => {
                    if (!confirm('Reset the password and sign out everywhere?')) e.preventDefault();
                }}
            >
                <button class="button-style error" type="submit">Reset password</button>
            </form>
        </div>

        <div class="notice">
            Until a new password is set, anyone who opens the site can claim it.
        </div>
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
    }
    header {
        margin-bottom: 1.25rem;
    }
    h1 {
        margin: 0 0 0.25rem;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }
    header p, .row-text p {
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
    .row button {
        padding: 0.6rem 1rem;
        white-space: nowrap;
        font-weight: 600;
    }
    .notice {
        margin-top: 1rem;
        padding: 0.7rem 0.9rem;
        font-size: 0.85rem;
        border-radius: 8px;
        border-left: 3px solid var(--theme-highlight);
        background-color: color-mix(in srgb, var(--theme-highlight) 12%, transparent);
    }
    @media (max-width: 560px) {
        .row {
            flex-direction: column;
            align-items: stretch;
        }
    }
</style>
