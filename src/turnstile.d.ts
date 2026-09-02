interface Window {
    turnstile?: {
        render(container: HTMLElement, params: {
            sitekey: string;
            action?: string;
            callback?: (token: string) => void;
            [key: string]: unknown;
        }): string;
        reset(widget: string | HTMLElement): void;
    };
}
