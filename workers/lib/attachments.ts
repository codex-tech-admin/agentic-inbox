// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Shared attachment storage logic.
 * Eliminates the triplicated atob → Uint8Array → R2.put pattern.
 */
import type { Env } from "../types";
import type { AttachmentInfo } from "./schemas";

export interface StoredAttachment {
	id: string;
	email_id: string;
	filename: string;
	mimetype: string;
	size: number;
	content_id: string | null;
	disposition: string;
}

/**
 * Store base64-encoded attachments to R2 and return metadata for the DO.
 */
export async function storeAttachments(
	bucket: Env["BUCKET"],
	emailId: string,
	attachments?: {
		content: string;
		filename: string;
		type: string;
		disposition: string;
		contentId?: string;
	}[],
): Promise<StoredAttachment[]> {
	if (!attachments?.length) return [];

	const results: StoredAttachment[] = [];
	try {
		for (const att of attachments) {
			const attachmentId = crypto.randomUUID();
			// Sanitize filename to prevent path traversal in R2 keys
			const safeFilename = (att.filename || "untitled").replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_");
			const key = `attachments/${emailId}/${attachmentId}/${safeFilename}`;
			const binaryStr = atob(att.content);
			const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
			await bucket.put(key, bytes);
			results.push({
				id: attachmentId,
				email_id: emailId,
				filename: safeFilename,
				mimetype: att.type,
				size: bytes.byteLength,
				content_id: att.contentId || null,
				disposition: att.disposition,
			});
		}
	} catch (error) {
		if (results.length > 0) {
			await bucket.delete(
				results.map((attachment) =>
					`attachments/${emailId}/${attachment.id}/${attachment.filename}`,
				),
			);
		}
		throw error;
	}
	return results;
}

export function selectDraftAttachments(
	emailId: string,
	existing: AttachmentInfo[],
	retainedIds?: string[],
) {
	const requestedIds = retainedIds === undefined
		? new Set(existing.map((attachment) => attachment.id))
		: new Set(retainedIds);
	const existingIds = new Set(existing.map((attachment) => attachment.id));

	return {
		retained: existing
			.filter((attachment) => requestedIds.has(attachment.id))
			.map((attachment): StoredAttachment => ({
				id: attachment.id,
				email_id: emailId,
				filename: attachment.filename,
				mimetype: attachment.mimetype,
				size: attachment.size,
				content_id: attachment.content_id ?? null,
				disposition: attachment.disposition ?? "attachment",
			})),
		removed: existing.filter((attachment) => !requestedIds.has(attachment.id)),
		unknownIds: [...requestedIds].filter((id) => !existingIds.has(id)),
	};
}
