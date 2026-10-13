import { EventEmitter } from "node:events";
import mqtt, { type MqttClient } from "mqtt";
import { ENV } from "./env.ts";

/** A Zigbee device, as far as the configuration page needs to know it. */
export type ZigbeeDevice = {
    name: string;
    description: string;
    /** Can be turned on and off (a light, or a plug). */
    switchable: boolean;
    color: boolean;
    colorTemp: boolean;
    /** The actions it sends, if it's a button or remote. Empty if it sends none, or doesn't say which. */
    actions: string[] | null;
};

export type ZigbeeGroup = { name: string; members: number };

/** The parts of Zigbee2MQTT's bridge/devices payload used here. */
type Z2MExpose = { type?: string; name?: string; property?: string; values?: string[]; features?: Z2MExpose[] };
type Z2MDevice = {
    friendly_name: string;
    type: string;
    supported?: boolean;
    definition?: { description?: string; vendor?: string; model?: string; exposes?: Z2MExpose[] } | null;
};

function allExposes(exposes: Z2MExpose[]): Z2MExpose[] {
    return exposes.flatMap(e => [e, ...allExposes(e.features ?? [])]);
}

function describeDevice(device: Z2MDevice): ZigbeeDevice {
    const exposes = allExposes(device.definition?.exposes ?? []);
    const named = (name: string) => exposes.some(e => e.name === name || e.property === name);
    const action = exposes.find(e => e.name === 'action' || e.property === 'action');
    const { vendor, model, description } = device.definition ?? {};
    return {
        name: device.friendly_name,
        description: [vendor, model, description].filter(Boolean).join(' · '),
        switchable: named('state'),
        color: named('color_xy') || named('color_hs'),
        colorTemp: named('color_temp'),
        actions: action ? (action.values ?? []) : null
    };
}

export interface Zigbee {
    on(event: 'action', listener: (device: string, action: string) => void): this;
    /** Zigbee2MQTT (re)connected, so the lights may need setting again. */
    on(event: 'online', listener: () => void): this;
}

/** Zigbee2MQTT, over MQTT: the devices and groups it has, button presses, and setting lights. */
export class Zigbee extends EventEmitter {
    mqttConnected = false;
    /** Whether Zigbee2MQTT itself says it's running, or null before it's said. */
    bridgeOnline: boolean | null = null;
    devices: ZigbeeDevice[] = [];
    groups: ZigbeeGroup[] = [];

    #client: MqttClient;
    #base = ENV.baseTopic;

    constructor() {
        super();
        this.#client = mqtt.connect(ENV.mqttUrl, {
            username: ENV.mqttUsername,
            password: ENV.mqttPassword,
            reconnectPeriod: 5000
        });
        this.#client.on('connect', () => {
            this.mqttConnected = true;
            console.log(`MQTT: connected to ${ENV.mqttUrl}`);
            this.#client.subscribe(`${this.#base}/#`);
        });
        this.#client.on('close', () => {
            if(this.mqttConnected) console.warn('MQTT: disconnected');
            this.mqttConnected = false;
        });
        this.#client.on('error', err => console.warn('MQTT:', err.message));
        this.#client.on('message', (topic, payload, packet) => this.#handle(topic, payload, packet.retain));
    }

    #handle(topic: string, payload: Buffer, retained: boolean) {
        const subtopic = topic.slice(this.#base.length + 1);
        if(subtopic === 'bridge/state'){
            // `{"state":"online"}` since Zigbee2MQTT 1.x's later versions, plain `online` before
            const text = payload.toString();
            let state = text;
            try { state = JSON.parse(text).state ?? text; } catch { /* plain text */ }
            const online = state === 'online';
            const wasOnline = this.bridgeOnline;
            this.bridgeOnline = online;
            if(online && wasOnline !== true){
                console.log('Zigbee2MQTT: online');
                this.emit('online');
            } else if(!online && wasOnline !== false) console.warn('Zigbee2MQTT: offline');
            return;
        }
        if(subtopic === 'bridge/devices'){
            try {
                const devices = JSON.parse(payload.toString()) as Z2MDevice[];
                this.devices = devices.filter(d => d.type !== 'Coordinator').map(describeDevice)
                    .sort((a, b) => a.name.localeCompare(b.name));
            } catch(err) { console.error('Zigbee2MQTT: bad device list', err); }
            return;
        }
        if(subtopic === 'bridge/groups'){
            try {
                const groups = JSON.parse(payload.toString()) as { friendly_name: string; members?: unknown[] }[];
                this.groups = groups.map(g => ({ name: g.friendly_name, members: g.members?.length ?? 0 }))
                    .sort((a, b) => a.name.localeCompare(b.name));
            } catch(err) { console.error('Zigbee2MQTT: bad group list', err); }
            return;
        }
        // A retained press is an old one, not the button being pressed now
        if(retained || subtopic.startsWith('bridge/')) return;
        // Device names can have slashes in, so match the whole rest of the topic against them
        if(!this.devices.some(d => d.name === subtopic)) return;
        try {
            const message = JSON.parse(payload.toString());
            if(typeof message?.action === 'string' && message.action !== '') this.emit('action', subtopic, message.action);
        } catch { /* not JSON, so not a press */ }
    }

    /** Sets a light or group (by its friendly name). */
    set(target: string, payload: Record<string, unknown>) {
        const topic = `${this.#base}/${target}/set`;
        const message = JSON.stringify(payload);
        if(ENV.dryRun){
            console.log(`[dry run] ${topic} ${message}`);
            return;
        }
        if(!this.mqttConnected) return;
        this.#client.publish(topic, message);
    }

    close() {
        this.#client.end();
    }
}
