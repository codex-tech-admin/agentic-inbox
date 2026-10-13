// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	apos: "'",
	gt: ">",
	lt: "<",
	nbsp: " ",
	quot: '"',
};

function decodeHtmlEntities(value: string): string {
	let decoded = value;
	for (let pass = 0; pass < 2; pass += 1) {
		const next = decoded.replace(
			/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi,
			(match, decimal: string | undefined, hexadecimal: string | undefined, named: string | undefined) => {
				const codePoint = decimal
					? Number.parseInt(decimal, 10)
					: hexadecimal
						? Number.parseInt(hexadecimal, 16)
						: undefined;
				if (codePoint !== undefined) {
					return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
						? String.fromCodePoint(codePoint)
						: match;
				}
				return named ? (NAMED_ENTITIES[named.toLowerCase()] ?? match) : match;
			},
		);
		if (next === decoded) break;
		decoded = next;
	}
	return decoded;
}

/**
 * Convert stored email HTML into readable plain text for replies, forwards,
 * snippets, and agent context. Email-client CSS and executable blocks are
 * removed before tags so Outlook/VML declarations never become visible text.
 */
export function emailHtmlToText(html: string): string {
	if (!html) return "";

	const text = html
		.replace(/\r\n?/g, "\n")
		.replace(/<style[^>]*>[\s\S]*?(?:<\/style>|$)/gi, " ")
		.replace(/<script[^>]*>[\s\S]*?(?:<\/script>|$)/gi, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(
			/(?:[a-z][\w-]*\\?:\*|\.[\w-]+)\s*\{\s*behavior\s*:\s*url\([^)]*#default#VML[^)]*\)\s*;?\s*\}/gi,
			" ",
		)
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(?:address|blockquote|div|h[1-6]|li|p|pre|table|tr)>/gi, "\n")
		.replace(/<li(?:\s[^>]*)?>/gi, "• ")
		.replace(/<[^>]+>/g, " ");

	return decodeHtmlEntities(text)
		.replace(/\u00a0/g, " ")
		.replace(/[ \t\f\v]+/g, " ")
		.replace(/ *\n */g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
