import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ThreadMessage from "../app/components/email-panel/ThreadMessage";
import SingleMessageView from "../app/components/email-panel/SingleMessageView";
import type { Email } from "../app/types";

const email: Email = {
	id: "message-1",
	thread_id: "thread-1",
	folder_id: "inbox",
	subject: "Infrastructure & Platform Lead – Interview",
	sender: "miley.he@kepleranalytics.com",
	recipient: "contact@raihanrazi.com",
	cc: "copied.user@example.com",
	date: "2026-08-11T09:43:00+10:00",
	read: true,
	starred: false,
	body: "<p>Interview details</p>",
};

describe("ThreadMessage recipient metadata", () => {
	it("shows copied recipients before the user chooses Reply All", () => {
		const markup = renderToStaticMarkup(
			<ThreadMessage
				email={email}
				mailboxId="contact@raihanrazi.com"
				mailboxEmail="contact@raihanrazi.com"
				isLast
				isExpanded
				onToggleExpand={() => {}}
			/>,
		);

		expect(markup).toContain("To:");
		expect(markup).toContain("contact@raihanrazi.com");
		expect(markup).toContain("Cc:");
		expect(markup).toContain("copied.user@example.com");
	});

	it("shows copied recipients in the single-message view", () => {
		const markup = renderToStaticMarkup(
			<SingleMessageView
				email={email}
				mailboxId="contact@raihanrazi.com"
				onPreviewImage={() => {}}
			/>,
		);

		expect(markup).toContain("Cc:");
		expect(markup).toContain("copied.user@example.com");
		expect(markup).toContain("Show message details");
	});
});
