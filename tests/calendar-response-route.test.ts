import { describe, expect, it, vi } from "vitest";
import { app } from "../workers/index";

const invite = `BEGIN:VCALENDAR\r
VERSION:2.0\r
METHOD:REQUEST\r
BEGIN:VEVENT\r
UID:test-interview@example.com\r
DTSTART:20260812T000000Z\r
DTEND:20260812T003000Z\r
SUMMARY:Test interview\r
ORGANIZER;CN=Test Organizer:mailto:organizer@example.com\r
ATTENDEE;CN=Raihan Razi;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:contact@raihanrazi.com\r
END:VEVENT\r
END:VCALENDAR\r
`;

describe("calendar response API", () => {
	it("sends and records an accepted calendar reply", async () => {
		const email = {
			id: "invite-email",
			folder_id: "inbox",
			subject: "Test interview",
			sender: "organizer@example.com",
			recipient: "contact@raihanrazi.com",
			date: "2026-08-11T00:00:00.000Z",
			read: false,
			starred: false,
			body: "Interview invitation",
			message_id: "original-message@example.com",
			thread_id: "thread-1",
			email_references: null,
			attachments: [{
				id: "calendar-attachment",
				email_id: "invite-email",
				filename: "invite.ics",
				mimetype: "text/calendar; method=REQUEST",
				size: invite.length,
				disposition: "attachment",
			}],
		};
		const stub = {
			getEmail: vi.fn().mockResolvedValue(email),
			checkSendRateLimit: vi.fn().mockResolvedValue(null),
			createEmail: vi.fn().mockResolvedValue(undefined),
			setCalendarResponse: vi.fn().mockResolvedValue(undefined),
			markThreadRead: vi.fn().mockResolvedValue(undefined),
		};
		const bucket = {
			head: vi.fn().mockResolvedValue({}),
			get: vi.fn().mockImplementation(async (key: string) => {
				if (key === "mailboxes/contact@raihanrazi.com.json") {
					return { json: async () => ({ fromName: "Raihan Razi" }) };
				}
				if (key.endsWith("/calendar-attachment/invite.ics")) {
					return { text: async () => invite };
				}
				return null;
			}),
			put: vi.fn().mockResolvedValue(undefined),
		};
		const emailBinding = { send: vi.fn().mockResolvedValue({ messageId: "delivered-message" }) };
		const env = {
			BUCKET: bucket,
			EMAIL: emailBinding,
			MAILBOX: {
				idFromName: vi.fn().mockReturnValue("mailbox-do-id"),
				get: vi.fn().mockReturnValue(stub),
			},
		};

		const response = await app.request(
			"/api/v1/mailboxes/contact%40raihanrazi.com/emails/invite-email/calendar-response",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ response: "accepted" }),
			},
			env as never,
		);
		const payload = await response.json() as { status: string; response: string };

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({ status: "sent", response: "accepted" });
		expect(emailBinding.send).toHaveBeenCalledOnce();
		const delivered = emailBinding.send.mock.calls[0][0];
		expect(delivered).toMatchObject({
			to: "organizer@example.com",
			from: { email: "contact@raihanrazi.com", name: "Raihan Razi" },
			subject: "Accepted: Test interview",
		});
		const replyBytes = Uint8Array.from(atob(delivered.attachments[0].content), (character) => character.charCodeAt(0));
		const replyIcs = new TextDecoder().decode(replyBytes).replace(/\r\n[ \t]/g, "");
		expect(replyIcs).toContain("METHOD:REPLY");
		expect(replyIcs).toContain("PARTSTAT=ACCEPTED");
		expect(replyIcs).toContain("mailto:contact@raihanrazi.com");
		expect(stub.createEmail).toHaveBeenCalledWith("sent", expect.objectContaining({
			thread_id: "thread-1",
			subject: "Accepted: Test interview",
		}), expect.any(Array));
		expect(stub.setCalendarResponse).toHaveBeenCalledWith("invite-email", "accepted");
		expect(stub.markThreadRead).toHaveBeenCalledWith("thread-1");
	});
});
