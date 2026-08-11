import type { Context } from "hono";
import { z } from "zod";
import { calendarResponses, isCalendarAttachment, type CalendarInvite, type CalendarResponse } from "../../shared/calendar";
import { Folders } from "../../shared/folders";
import { sendEmail } from "../email-sender";
import { storeAttachments } from "../lib/attachments";
import {
	buildReferencesChain,
	buildThreadingHeaders,
	generateMessageId,
	validateSender,
} from "../lib/email-helpers";
import {
	buildCalendarReply,
	encodeUtf8Base64,
	parseCalendarInvite,
	responseLabel,
} from "../lib/calendar-invites";
import type { MailboxContext } from "../lib/mailbox";
import type { AttachmentInfo, EmailFull } from "../lib/schemas";

type AppContext = Context<MailboxContext>;
type EmailWithCalendarResponse = EmailFull & { calendar_response?: CalendarResponse | null };
type RateLimitStub = { checkSendRateLimit: () => Promise<string | null> };

const CalendarResponseBody = z.object({
	response: z.enum(calendarResponses),
});

function calendarAttachment(email: EmailFull): AttachmentInfo | undefined {
	return email.attachments?.find(isCalendarAttachment);
}

async function readInvite(c: AppContext, email: EmailWithCalendarResponse) {
	const attachment = calendarAttachment(email);
	if (!attachment) return null;

	const object = await c.env.BUCKET.get(
		`attachments/${email.id}/${attachment.id}/${attachment.filename}`,
	);
	if (!object) throw new Error("Calendar attachment file is missing");

	const parsed = parseCalendarInvite(await object.text(), c.req.param("mailboxId") ?? "", email.body ?? undefined);
	return { attachment, parsed };
}

function publicInvite(
	attachment: AttachmentInfo,
	parsed: ReturnType<typeof parseCalendarInvite>,
	response?: CalendarResponse | null,
): CalendarInvite {
	const { calendar: _calendar, eventComponent: _event, attendeeProperty: _attendee, ...invite } = parsed;
	return {
		...invite,
		...(response ? { response } : {}),
		attachmentId: attachment.id,
		attachmentFilename: attachment.filename || "invite.ics",
	};
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

export async function handleGetCalendarInvite(c: AppContext) {
	const email = await c.var.mailboxStub.getEmail(c.req.param("id") ?? "") as EmailWithCalendarResponse | null;
	if (!email) return c.json({ error: "Email not found" }, 404);

	try {
		const loaded = await readInvite(c, email);
		if (!loaded) return c.json({ error: "No calendar invitation found" }, 404);
		return c.json(publicInvite(loaded.attachment, loaded.parsed, email.calendar_response));
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Calendar invitation could not be read" }, 422);
	}
}

export async function handleCalendarResponse(c: AppContext) {
	const mailboxId = c.req.param("mailboxId") ?? "";
	const emailId = c.req.param("id") ?? "";
	const { response } = CalendarResponseBody.parse(await c.req.json());
	const stub = c.var.mailboxStub;
	const email = await stub.getEmail(emailId) as EmailWithCalendarResponse | null;
	if (!email) return c.json({ error: "Email not found" }, 404);

	let loaded: Awaited<ReturnType<typeof readInvite>>;
	try {
		loaded = await readInvite(c, email);
	} catch (error) {
		return c.json({ error: error instanceof Error ? error.message : "Calendar invitation could not be read" }, 422);
	}
	if (!loaded) return c.json({ error: "No calendar invitation found" }, 404);
	if (!loaded.parsed.canRespond) {
		return c.json({ error: "This invitation cannot be answered from this mailbox" }, 422);
	}
	if (!loaded.parsed.organizer.email) {
		return c.json({ error: "Calendar invitation has no organizer email" }, 422);
	}

	const settingsObject = await c.env.BUCKET.get(`mailboxes/${mailboxId}.json`);
	const settings = settingsObject
		? await settingsObject.json<{ fromName?: string }>()
		: {};
	const displayName = settings.fromName || loaded.parsed.attendeeProperty?.getFirstParameter("cn") || mailboxId;
	const from = displayName !== mailboxId ? { email: mailboxId, name: displayName } : mailboxId;
	const { toStr, fromEmail, fromDomain } = validateSender(loaded.parsed.organizer.email, from, mailboxId);
	const rateLimitError = await (stub as unknown as RateLimitStub).checkSendRateLimit();
	if (rateLimitError) return c.json({ error: rateLimitError }, 429);

	const ics = buildCalendarReply(loaded.parsed, response, mailboxId, displayName);
	const encodedIcs = encodeUtf8Base64(ics);
	const label = responseLabel(response);
	const subject = `${label}: ${loaded.parsed.summary}`;
	const text = `${displayName} has ${response === "tentative" ? "tentatively accepted" : response} this invitation.`;
	const html = `<p>${escapeHtml(text)}</p>`;
	const { originalMsgId, references, threadId } = buildReferencesChain(email);
	const { messageId, outgoingMessageId } = generateMessageId(fromDomain);
	const headers = {
		...buildThreadingHeaders(originalMsgId, references),
		"Content-Class": "urn:content-classes:calendarmessage",
	};
	const outboundAttachment = {
		content: encodedIcs,
		filename: "response.ics",
		type: "text/calendar; charset=UTF-8; method=REPLY",
		disposition: "attachment" as const,
	};

	await sendEmail(c.env.EMAIL, {
		to: loaded.parsed.organizer.email,
		from,
		subject,
		text,
		html,
		attachments: [outboundAttachment],
		headers,
	});

	const attachmentData = await storeAttachments(c.env.BUCKET, messageId, [outboundAttachment]);
	const now = new Date().toISOString();
	await stub.createEmail(Folders.SENT, {
		id: messageId,
		subject,
		sender: fromEmail,
		recipient: toStr,
		cc: null,
		bcc: null,
		date: now,
		body: html,
		in_reply_to: originalMsgId,
		email_references: JSON.stringify(references),
		thread_id: threadId,
		message_id: outgoingMessageId,
		raw_headers: JSON.stringify([
			{ key: "from", value: typeof from === "string" ? from : `${from.name} <${from.email}>` },
			{ key: "to", value: loaded.parsed.organizer.email },
			{ key: "subject", value: subject },
			{ key: "date", value: now },
			{ key: "message-id", value: `<${outgoingMessageId}>` },
			{ key: "in-reply-to", value: `<${originalMsgId}>` },
			{ key: "references", value: references.map((reference) => `<${reference}>`).join(" ") },
		]),
	}, attachmentData);
	await (stub as unknown as { setCalendarResponse: (id: string, response: CalendarResponse) => Promise<unknown> })
		.setCalendarResponse(emailId, response);
	await stub.markThreadRead(threadId);

	return c.json({ status: "sent", response, invite: publicInvite(loaded.attachment, loaded.parsed, response) });
}
