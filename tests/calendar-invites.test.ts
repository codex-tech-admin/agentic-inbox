import { describe, expect, it } from "vitest";
import {
	buildCalendarReply,
	encodeUtf8Base64,
	parseCalendarInvite,
} from "../workers/lib/calendar-invites";

const invite = `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN\r
METHOD:REQUEST\r
BEGIN:VEVENT\r
UID:interview-123@example.com\r
SEQUENCE:2\r
DTSTAMP:20260811T010000Z\r
DTSTART:20260811T050000Z\r
DTEND:20260811T053000Z\r
SUMMARY:Infrastructure & Platform Lead - Interview\r
DESCRIPTION:Join the interview at https://teams.microsoft.com/meet/12345\r
LOCATION:Microsoft Teams meeting\r
ORGANIZER;CN=Miley He:mailto:miley.he@kepleranalytics.com\r
ATTENDEE;CN=Raihan Razi;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:contact@raihanrazi.com\r
ATTENDEE;CN=Hasan Shabbir;ROLE=REQ-PARTICIPANT:mailto:hasan.shabbir@kepleranalytics.com\r
END:VEVENT\r
END:VCALENDAR\r
`;

describe("calendar invitations", () => {
	it("parses an incoming meeting request into display data", () => {
		const parsed = parseCalendarInvite(invite, "contact@raihanrazi.com");

		expect(parsed).toMatchObject({
			uid: "interview-123@example.com",
			method: "REQUEST",
			summary: "Infrastructure & Platform Lead - Interview",
			start: "2026-08-11T05:00:00.000Z",
			end: "2026-08-11T05:30:00.000Z",
			location: "Microsoft Teams meeting",
			meetingUrl: "https://teams.microsoft.com/meet/12345",
			canRespond: true,
			organizer: {
				name: "Miley He",
				email: "miley.he@kepleranalytics.com",
			},
		});
		expect(parsed.attendees).toHaveLength(2);
	});

	it("builds an RFC 5545 reply from the invited mailbox identity", () => {
		const parsed = parseCalendarInvite(invite, "contact@raihanrazi.com");
		const reply = buildCalendarReply(
			parsed,
			"accepted",
			"contact@raihanrazi.com",
			"Raihan Razi",
		);
		const unfoldedReply = reply.replace(/\r\n[ \t]/g, "");

		expect(unfoldedReply).toContain("METHOD:REPLY");
		expect(unfoldedReply).toContain("UID:interview-123@example.com");
		expect(unfoldedReply).toContain("SEQUENCE:2");
		expect(unfoldedReply).toContain("PARTSTAT=ACCEPTED");
		expect(unfoldedReply).toContain("RSVP=FALSE");
		expect(unfoldedReply).toContain("mailto:contact@raihanrazi.com");
		expect(unfoldedReply).not.toContain("mailto:hasan.shabbir@kepleranalytics.com");
	});

	it("does not offer RSVP when the mailbox is not an attendee", () => {
		const parsed = parseCalendarInvite(invite, "someone-else@example.com");
		expect(parsed.canRespond).toBe(false);
		expect(() => buildCalendarReply(parsed, "declined", "someone-else@example.com"))
			.toThrow("Mailbox is not an attendee");
	});

	it("encodes Unicode calendar replies as UTF-8 base64", () => {
		const encoded = encodeUtf8Base64("Résumé discussion");
		const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
		expect(new TextDecoder().decode(bytes)).toBe("Résumé discussion");
	});
});
