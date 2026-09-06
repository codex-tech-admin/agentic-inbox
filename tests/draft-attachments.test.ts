import { describe, expect, it } from "vitest";
import { selectDraftAttachments } from "../workers/lib/attachments";

const existing = [
	{
		id: "attachment-1",
		filename: "one.pdf",
		mimetype: "application/pdf",
		size: 10,
		disposition: "attachment",
	},
	{
		id: "attachment-2",
		filename: "two.pdf",
		mimetype: "application/pdf",
		size: 20,
		disposition: "attachment",
	},
];

describe("draft attachment replacement", () => {
	it("retains selected files and reports removed files", () => {
		const selected = selectDraftAttachments("draft-1", existing, ["attachment-2"]);

		expect(selected.retained).toEqual([expect.objectContaining({
			id: "attachment-2",
			email_id: "draft-1",
		})]);
		expect(selected.removed).toEqual([existing[0]]);
		expect(selected.unknownIds).toEqual([]);
	});

	it("rejects attachment ids from another draft", () => {
		expect(selectDraftAttachments("draft-1", existing, ["not-on-this-draft"]).unknownIds)
			.toEqual(["not-on-this-draft"]);
	});
});
