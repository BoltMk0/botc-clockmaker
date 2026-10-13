import { resolve } from "node:path";

/** Settings for where Lightscapes runs, from the environment. Everything about the lights is in the configuration. */
export const ENV = {
    /** The port the configuration page is served on. */
    port: Number(process.env.PORT ?? 8090),
    /** Where the configuration is kept. */
    dataDir: resolve(process.env.LIGHTSCAPES_DATA_DIR ?? './data'),
    /** The MQTT broker Zigbee2MQTT uses. */
    mqttUrl: process.env.MQTT_URL ?? 'mqtt://localhost:1883',
    mqttUsername: process.env.MQTT_USERNAME || undefined,
    mqttPassword: process.env.MQTT_PASSWORD || undefined,
    /** Zigbee2MQTT's base topic. */
    baseTopic: process.env.Z2M_BASE_TOPIC ?? 'zigbee2mqtt',
    /** If set, the configuration page asks for it (any user name). */
    password: process.env.LIGHTSCAPES_PASSWORD || undefined,
    /** Logs what would be sent to the lights instead of sending it, to try things out without any. */
    dryRun: ['1', 'true', 'yes'].includes((process.env.DRY_RUN ?? '').toLowerCase()),
    /** Where the configuration page's files are. */
    publicDir: resolve(process.env.LIGHTSCAPES_PUBLIC_DIR ?? './public')
};
