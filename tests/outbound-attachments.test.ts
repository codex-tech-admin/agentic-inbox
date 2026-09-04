// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
	addLocalAttachments,
	blobToBase64,
} from "../app/lib/outbound-attachments";
import {
	MAX_ATTACHMENT_BYTES,
	MAX_ATTACHMENT_COUNT,
} from "../shared/attachments";

describe("compose attachments", () => {
	it("adds files and ignores an exact duplicate", () => {
		const file = new File(["cover letter"], "cover-letter.pdf", {
			type: "application/pdf",
			lastModified: 123,
		});
		const first = addLocalAttachments([], [file]);
		const second = addLocalAttachments(first.attachments, [file]);

		expect(first.error).toBeNull();
		expect(second.attachments).toHaveLength(1);
		expect(second.attachments[0]).toMatchObject({
			kind: "local",
			filename: "cover-letter.pdf",
			type: "application/pdf",
		});
	});

	it("enforces per-file and file-count limits", () => {
		const tooLarge = {
			name: "too-large.pdf",
			size: MAX_ATTACHMENT_BYTES + 1,
			type: "application/pdf",
			lastModified: 1,
		} as File;
		const existing = Array.from({ length: MAX_ATTACHMENT_COUNT }, (_, index) => ({
			kind: "existing" as const,
			id: `attachment-${index}`,
			filename: `attachment-${index}.txt`,
			size: 1,
			type: "text/plain",
		}));

		expect(addLocalAttachments([], [tooLarge]).error).toContain("larger than");
		expect(addLocalAttachments(existing, [new File(["x"], "extra.txt")]).error)
			.toContain(`up to ${MAX_ATTACHMENT_COUNT} files`);
	});

	it("converts file content to base64", async () => {
		expect(await blobToBase64(new Blob(["hello"]))).toBe("aGVsbG8=");
	});
});
