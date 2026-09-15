import React from "react";
import { Toasty } from "@cloudflare/kumo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CalendarInviteCard from "../app/components/email-panel/CalendarInviteCard";
import { queryKeys } from "../app/queries/keys";
import type { CalendarInvite } from "../shared/calendar";
import type { Email } from "../app/types";

describe("CalendarInviteCard", () => {
	it("shows parsed event details and RSVP actions", () => {
		const mailboxId = "contact@raihanrazi.com";
		const email: Email = {
			id: "message-1",
			subject: "Interview",
			sender: "organizer@example.com",
			recipient: mailboxId,
			date: "2026-08-11T00:00:00.000Z",
			read: true,
			starred: false,
			attachments: [{
				id: "attachment-1",
				filename: "untitled",
				mimetype: "text/calendar; method=REQUEST",
				size: 2048,
				disposition: "attachment",
			}],
		};
		const invite: CalendarInvite = {
			uid: "invite-1",
			method: "REQUEST",
			summary: "Infrastructure & Platform Lead - Interview",
			start: "2026-08-11T05:00:00.000Z",
			end: "2026-08-11T05:30:00.000Z",
			allDay: false,
			location: "Microsoft Teams meeting",
			meetingUrl: "https://teams.microsoft.com/meet/12345",
			organizer: { name: "Miley He", email: "miley.he@kepleranalytics.com" },
			attendees: [{ name: "Raihan Razi", email: mailboxId }],
			canRespond: true,
			attachmentId: "attachment-1",
			attachmentFilename: "untitled",
		};
		const client = new QueryClient();
		client.setQueryData(queryKeys.emails.calendarInvite(mailboxId, email.id), invite);

		const markup = renderToStaticMarkup(
			<QueryClientProvider client={client}>
				<Toasty>
					<CalendarInviteCard email={email} mailboxId={mailboxId} />
				</Toasty>
			</QueryClientProvider>,
		);

		expect(markup).toContain("Infrastructure &amp; Platform Lead - Interview");
		expect(markup).toContain("Miley He");
		expect(markup).toContain("Microsoft Teams meeting");
		expect(markup).toContain("Join online meeting");
		expect(markup).toContain("Accept");
		expect(markup).toContain("Tentative");
		expect(markup).toContain("Decline");
		expect(markup).toContain("Download invite");
	});
});
