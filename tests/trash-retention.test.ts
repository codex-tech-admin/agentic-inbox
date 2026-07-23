import { describe, expect, it } from "vitest";
import {
	attachmentObjectKeys,
	getTrashPurgeCutoff,
	TRASH_RETENTION_DAYS,
} from "../workers/lib/trash";

describe("trash retention", () => {
	it("uses a 30-day retention window", () => {
		expect(TRASH_RETENTION_DAYS).toBe(30);
		expect(getTrashPurgeCutoff(new Date("2026-07-31T03:00:00.000Z")))
			.toBe("2026-07-01T03:00:00.000Z");
	});

	it("builds attachment cleanup keys for deleted messages", () => {
		expect(attachmentObjectKeys([
			{ emailId: "email-1", id: "attachment-1", filename: "resume.pdf" },
		])).toEqual(["attachments/email-1/attachment-1/resume.pdf"]);
	});
});
