interface TurnstileRenderParams {
    sitekey: string;
    action?: string;
    appearance?: "always" | "execute" | "interaction-only";
    retry?: "auto" | "never";
    "refresh-expired"?: "auto" | "manual" | "never";
    callback?: (token: string) => void;
    "error-callback"?: (code?: string) => boolean | void;
    "expired-callback"?: () => void;
    "timeout-callback"?: () => void;
    [key: string]: unknown;
}

interface Window {
    turnstile?: {
        ready(callback: () => void): void;
        render(container: HTMLElement, params: TurnstileRenderParams): string;
        reset(widget?: string | HTMLElement): void;
        remove(widget?: string | HTMLElement): void;
    };
}
