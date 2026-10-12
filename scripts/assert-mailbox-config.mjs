import { readFile } from "node:fs/promises";

const expectedDomainZones = {
	"raihanrazi.com": "511f5c78985dac195d65affb397cf07c",
	"codexdigital.ai": "d4623cc5d49eb9d3cbb8a774753b7d95",
	"semanticlab.ai": "0087b1e96834429a581a7ee1cfc98bab",
	"sponsoredfeeds.com": "4e18f9c2c23cf03b22a8d063a1056761",
};

function assert(condition, message) {
	if (!condition) throw new Error(`Deployment config assertion failed: ${message}`);
}

const [source, artifactText] = await Promise.all([
	readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
	readFile(new URL("../build/server/wrangler.json", import.meta.url), "utf8"),
]);
const artifact = JSON.parse(artifactText);

assert(source.includes('"EMAIL_DOMAIN_ZONES"'), "source domain registry is missing");
assert(source.includes('"EMAIL_ROUTING_WORKER": "raihan-agentic-inbox"'), "source routing worker is missing");
assert(!source.includes('"EMAIL_ADDRESSES"'), "legacy static address allowlist remains in source");
assert(!source.includes('"allowed_sender_addresses"'), "source send binding still has a static sender list");
assert(
	JSON.stringify(artifact.vars?.EMAIL_DOMAIN_ZONES) === JSON.stringify(expectedDomainZones),
	"flattened domain registry does not match the approved production zones",
);
assert(artifact.vars?.EMAIL_ROUTING_WORKER === "raihan-agentic-inbox", "flattened routing worker is wrong");
assert(
	JSON.stringify(artifact.send_email) === JSON.stringify([{ name: "EMAIL", remote: true }]),
	"flattened email-sending binding is not dynamically provisionable",
);
assert(
	artifact.routes?.some((route) => route.pattern === "inbox.raihanrazi.com" && route.custom_domain === true),
	"production inbox route is missing from the flattened artifact",
);

console.log("Mailbox provisioning config matches the flattened Worker artifact.");
