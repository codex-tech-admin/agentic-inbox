// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export const MAX_ATTACHMENT_COUNT = 10;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export interface OutboundAttachment {
	content: string;
	filename: string;
	type: string;
	disposition: "attachment" | "inline";
	contentId?: string;
}

export function formatAttachmentSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function decodedBase64Size(content: string): number {
	const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
	return Math.floor((content.length * 3) / 4) - padding;
}
