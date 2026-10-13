import { loadConfig } from "./config.ts";
import { ClockFollower } from "./clock.ts";
import { Zigbee } from "./zigbee.ts";
import { Engine } from "./engine.ts";
import { startServer } from "./server.ts";
import { ENV } from "./env.ts";

if(ENV.dryRun) console.log('Dry run: the lights are logged, not set');

const zigbee = new Zigbee();
const clock = new ClockFollower();
const engine = new Engine(loadConfig(), clock, zigbee);
const server = startServer(engine, clock, zigbee);

function shutdown() {
    clock.stop();
    zigbee.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
