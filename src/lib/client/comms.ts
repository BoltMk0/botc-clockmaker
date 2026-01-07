import type { ClockMessage } from "$lib/common/comms";

export function createWebSocketClient(
    {
        url = '/ws/clock', 
        onStateChanged
    }: 
    {
        url?: string, 
        onStateChanged: (state: ClockMessage)=>void
    }
): WebSocket {
    const ws = new WebSocket(url);
    ws.onmessage = (event) => {
        const message: ClockMessage = JSON.parse(event.data);
        onStateChanged(message);
    };
    return ws;
}
