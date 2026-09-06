// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Shared types and Zod schemas for email data.
 *
 * Types (from email-types.ts): used by the agent, MCP server, and route
 * handlers to avoid `as any` casting.
 *
 * Zod schemas: used across route handlers to eliminate duplication.
 */
import { z } from "zod";
import {
	MAX_ATTACHMENT_BYTES,
	MAX_ATTACHMENT_COUNT,
	MAX_TOTAL_ATTACHMENT_BYTES,
	decodedBase64Size,
} from "../../shared/attachments";

// ── TypeScript Interfaces ──────────────────────────────────────────

export interface EmailMetadata {
	id: string;
	subject: string;
	sender: string;
	recipient: string;
	cc?: string | null;
	bcc?: string | null;
	date: string;
	read: boolean;
	starred: boolean;
	in_reply_to?: string | null;
	email_references?: string | null;
	thread_id?: string | null;
	folder_id?: string | null;
	snippet?: string | null;
	calendar_response?: string | null;
}

export interface EmailFull extends EmailMetadata {
	body?: string | null;
	message_id?: string | null;
	raw_headers?: string | null;
	attachments?: AttachmentInfo[];
}

export interface AttachmentInfo {
	id: string;
	filename: string;
	mimetype: string;
	size: number;
	content_id?: string | null;
	disposition?: string | null;
}

// ── Zod Schemas ────────────────────────────────────────────────────

const RecipientFieldSchema = z.union([
	z.string().email(),
	z.array(z.string().email()).min(1),
]);

export const ErrorResponseSchema = z.object({
	error: z.string(),
});

const MAX_BASE64_ATTACHMENT_LENGTH = Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4;

export const OutboundAttachmentSchema = z.object({
	content: z
		.string()
		.max(MAX_BASE64_ATTACHMENT_LENGTH)
		.regex(/^[A-Za-z0-9+/]*={0,2}$/, "Attachment content must be valid base64")
		.refine((content) => content.length % 4 === 0, "Attachment content must be valid base64"),
	filename: z.string().trim().min(1).max(255),
	type: z.string().trim().min(1).max(255),
	disposition: z.enum(["attachment", "inline"]),
	contentId: z.string().max(255).optional(),
}).superRefine((attachment, ctx) => {
	if (decodedBase64Size(attachment.content) > MAX_ATTACHMENT_BYTES) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["content"],
			message: `Each attachment must be ${MAX_ATTACHMENT_BYTES} bytes or smaller`,
		});
	}
});

export const OutboundAttachmentsSchema = z
	.array(OutboundAttachmentSchema)
	.max(MAX_ATTACHMENT_COUNT)
	.superRefine((attachments, ctx) => {
		const totalBytes = attachments.reduce(
			(total, attachment) => total + decodedBase64Size(attachment.content),
			0,
		);
		if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `Attachments must total ${MAX_TOTAL_ATTACHMENT_BYTES} bytes or less`,
			});
		}
	});

export const SendEmailRequestSchema = z.object({
	to: RecipientFieldSchema,
	cc: RecipientFieldSchema.optional(),
	bcc: RecipientFieldSchema.optional(),
	from: z.union([
		z.string().email(),
		z.object({ email: z.string().email(), name: z.string() }),
	]),
	subject: z.string(),
	html: z.string().optional(),
	text: z.string().optional(),
	attachments: OutboundAttachmentsSchema.optional(),
	in_reply_to: z.string().optional(),
	references: z.array(z.string()).optional(),
	thread_id: z.string().optional(),
});

export const SendEmailResponseSchema = z.object({
	id: z.string(),
	status: z.string(),
});
