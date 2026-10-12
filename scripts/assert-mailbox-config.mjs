import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const demoAddress = "demo@sponsoredfeeds.com";
const source = JSON.parse(
	readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""),
);
const built = JSON.parse(readFileSync("build/server/wrangler.json", "utf8"));

for (const [label, config] of [["source", source], ["built", built]]) {
	assert.equal(config.name, "raihan-agentic-inbox", `${label}: wrong Worker`);
	const receivers = config.vars?.EMAIL_ADDRESSES;
	const senders = config.send_email?.find((binding) => binding.name === "EMAIL")
		?.allowed_sender_addresses;
	assert.ok(Array.isArray(receivers), `${label}: missing received addresses`);
	assert.ok(Array.isArray(senders), `${label}: missing allowed senders`);
	assert.ok(receivers.includes(demoAddress), `${label}: demo inbox cannot receive`);
	assert.ok(senders.includes(demoAddress), `${label}: demo inbox cannot send`);
	assert.deepEqual(
		[...new Set(receivers)].sort(),
		[...new Set(senders)].sort(),
		`${label}: sender and receiver allowlists differ`,
	);
}

assert.deepEqual(built.vars.EMAIL_ADDRESSES, source.vars.EMAIL_ADDRESSES);
assert.deepEqual(built.send_email, source.send_email);
console.log("Demo mailbox config matches the flattened Worker artifact.");
