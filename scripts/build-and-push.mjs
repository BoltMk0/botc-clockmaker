import { parseArgs } from "node:util";
import { DEFAULT_IMAGE_NAME, buildImage, docker, resolveTags } from "./docker-build.mjs";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        name: { type: "string", short: "n", default: DEFAULT_IMAGE_NAME },
        tag: { type: "string", short: "t" },
        registry: { type: "string", short: "r" },
        "archive-out": { type: "string", short: "o" },
        help: { type: "boolean", short: "h" }
    }
});

if (values.help) {
    console.log(`Build and push Docker image for BOTC Clocktower

Usage: npm run docker:push -- [package_dir] [options]

  package_dir            Directory containing package.json (default: .)
  -n, --name <name>      Image name (default: ${DEFAULT_IMAGE_NAME})
  -t, --tag <tag>        Tag the image only with this (default: the package.json version and latest)
  -r, --registry <url>   Docker registry URL
  -o, --archive-out <f>  Also save the built image as a tar archive (e.g. botc-clockmaker.tar)`);
    process.exit(0);
}

const packageDir = positionals[0] ?? ".";
const tags = resolveTags({ packageDir, name: values.name, tag: values.tag, registry: values.registry });

console.log("Building and pushing Docker image:", tags.join(", "));

buildImage({ packageDir, tags, platform: "linux/amd64" });

console.log("\n\n\n\n\nPushing Docker image...");
for (const tag of tags) docker("push", tag);

if (values["archive-out"]) {
    console.log("\n\n\n\n\nSaving Docker image to archive:", values["archive-out"]);
    docker("save", ...tags, "-o", values["archive-out"]);
}

console.log("\n\nDone.\n\n");
