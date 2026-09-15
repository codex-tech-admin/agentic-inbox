// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	MAX_ATTACHMENT_BYTES,
	MAX_ATTACHMENT_COUNT,
	MAX_TOTAL_ATTACHMENT_BYTES,
	formatAttachmentSize,
	type OutboundAttachment,
} from "../../shared/attachments";
import api from "~/services/api";
import type { Attachment } from "~/types";

export type ComposeAttachment =
	| {
			kind: "existing";
			id: string;
			filename: string;
			size: number;
			type: string;
	  }
	| {
			kind: "local";
			id: string;
			filename: string;
			size: number;
			type: string;
			file: File;
	  };

export function existingComposeAttachments(
	attachments?: Attachment[],
): ComposeAttachment[] {
	return (attachments ?? []).map((attachment) => ({
		kind: "existing" as const,
		id: attachment.id,
		filename: attachment.filename,
		size: attachment.size,
		type: attachment.mimetype || "application/octet-stream",
	}));
}

function attachmentFingerprint(attachment: Pick<ComposeAttachment, "filename" | "size">) {
	return `${attachment.filename.toLowerCase()}\0${attachment.size}`;
}

export function addLocalAttachments(
	current: ComposeAttachment[],
	files: File[],
): { attachments: ComposeAttachment[]; error: string | null } {
	const next = [...current];
	const seen = new Set(current.map(attachmentFingerprint));
	let totalBytes = current.reduce((sum, attachment) => sum + attachment.size, 0);
	const errors: string[] = [];

	for (const file of files) {
		if (next.length >= MAX_ATTACHMENT_COUNT) {
			errors.push(`You can attach up to ${MAX_ATTACHMENT_COUNT} files.`);
			break;
		}
		if (file.size > MAX_ATTACHMENT_BYTES) {
			errors.push(`${file.name} is larger than ${formatAttachmentSize(MAX_ATTACHMENT_BYTES)}.`);
			continue;
		}
		if (totalBytes + file.size > MAX_TOTAL_ATTACHMENT_BYTES) {
			errors.push(`Attachments can total up to ${formatAttachmentSize(MAX_TOTAL_ATTACHMENT_BYTES)}.`);
			continue;
		}

		const fingerprint = attachmentFingerprint({
			filename: file.name,
			size: file.size,
		});
		if (seen.has(fingerprint)) continue;

		seen.add(fingerprint);
		totalBytes += file.size;
		next.push({
			kind: "local",
			id: `local:${file.name}:${file.size}:${file.lastModified}`,
			filename: file.name,
			size: file.size,
			type: file.type || "application/octet-stream",
			file,
		});
	}

	return {
		attachments: next,
		error: errors.length > 0 ? [...new Set(errors)].join(" ") : null,
	};
}

export async function blobToBase64(blob: Blob): Promise<string> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const chunkSize = 0x8000;
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
	}
	return btoa(binary);
}

async function toOutboundAttachment(
	attachment: ComposeAttachment,
	mailboxId: string,
	draftId?: string,
): Promise<OutboundAttachment> {
	let blob: Blob;
	if (attachment.kind === "local") {
		blob = attachment.file;
	} else {
		if (!draftId) throw new Error(`Cannot load ${attachment.filename} without a saved draft.`);
		blob = await api.getAttachment(mailboxId, draftId, attachment.id);
	}

	return {
		content: await blobToBase64(blob),
		filename: attachment.filename,
		type: attachment.type,
		disposition: "attachment",
	};
}

export function serializeLocalAttachments(
	attachments: ComposeAttachment[],
): Promise<OutboundAttachment[]> {
	return Promise.all(
		attachments
			.filter((attachment) => attachment.kind === "local")
			.map((attachment) => toOutboundAttachment(attachment, "")),
	);
}

export function serializeComposeAttachments(
	attachments: ComposeAttachment[],
	mailboxId: string,
	draftId?: string,
): Promise<OutboundAttachment[]> {
	return Promise.all(
		attachments.map((attachment) =>
			toOutboundAttachment(attachment, mailboxId, draftId),
		),
	);
}
