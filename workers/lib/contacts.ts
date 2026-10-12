// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeContactEmail(value: string): string | null {
	const normalized = value.trim().toLowerCase();
	return SIMPLE_EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function splitContactAddresses(value?: string | null): string[] {
	if (!value) return [];
	const seen = new Set<string>();
	const addresses: string[] = [];
	for (const part of value.split(",")) {
		const normalized = normalizeContactEmail(part);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		addresses.push(normalized);
	}
	return addresses;
}

export function contactDisplayNameFromHeaders(
	headersJson?: string | null,
): string | null {
	if (!headersJson) return null;
	try {
		const headers = JSON.parse(headersJson) as Array<{ key?: unknown; value?: unknown }>;
		const from = headers.find(
			(header) => typeof header.key === "string" && header.key.toLowerCase() === "from",
		);
		if (!from || typeof from.value !== "string") return null;
		const match = from.value.match(/^\s*(?:"([^"]+)"|([^<]+?))\s*<[^>]+>\s*$/);
		const name = (match?.[1] || match?.[2] || "").trim();
		return name || null;
	} catch {
		return null;
	}
}
