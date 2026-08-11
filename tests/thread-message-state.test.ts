import { describe, expect, it } from "vitest";
import { Folders } from "../shared/folders";
import {
	getThreadMessageState,
	isThreadMessageVisibleInFolder,
} from "../app/lib/thread-message-state";
import { getMovedEmailFolderState } from "../workers/lib/email-folder-state";
import type { Email } from "../app/types";

const baseEmail: Email = {
	id: "message-1",
	subject: "Re: Interview",
	sender: "contact@example.com",
	recipient: "recruiter@example.com",
	date: "2026-07-27T00:00:00.000Z",
	read: true,
	starred: false,
};

describe("thread message state", () => {
	it("remembers that a discarded message came from Drafts", () => {
		expect(
			getMovedEmailFolderState(
				Folders.DRAFT,
				null,
				Folders.TRASH,
				"2026-07-27T00:01:00.000Z",
			),
		).toEqual({
			folder_id: Folders.TRASH,
			previous_folder_id: Folders.DRAFT,
			trashed_at: "2026-07-27T00:01:00.000Z",
		});
	});

	it("clears the previous folder when a message is restored", () => {
		expect(
			getMovedEmailFolderState(
				Folders.TRASH,
				Folders.DRAFT,
				Folders.DRAFT,
				"2026-07-27T00:02:00.000Z",
			),
		).toEqual({
			folder_id: Folders.DRAFT,
			previous_folder_id: null,
			trashed_at: null,
		});
	});

	it("labels active and discarded outgoing messages distinctly", () => {
		expect(
			getThreadMessageState({
				...baseEmail,
				folder_id: Folders.SENT,
			}),
		).toBe("sent");
		expect(
			getThreadMessageState({
				...baseEmail,
				folder_id: Folders.TRASH,
				previous_folder_id: Folders.DRAFT,
			}),
		).toBe("discarded");
	});

	it("hides discarded messages from Sent and isolates them in Trash", () => {
		const sent = { ...baseEmail, id: "sent", folder_id: Folders.SENT };
		const discarded = {
			...baseEmail,
			id: "discarded",
			folder_id: Folders.TRASH,
			previous_folder_id: Folders.DRAFT,
		};
		const received = {
			...baseEmail,
			id: "received",
			folder_id: Folders.INBOX,
		};

		expect(
			[sent, discarded, received].filter((email) =>
				isThreadMessageVisibleInFolder(email, Folders.SENT),
			).map((email) => email.id),
		).toEqual(["sent", "received"]);
		expect(
			[sent, discarded, received].filter((email) =>
				isThreadMessageVisibleInFolder(email, Folders.TRASH),
			).map((email) => email.id),
		).toEqual(["discarded"]);
	});
});
