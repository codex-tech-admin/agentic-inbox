// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import AttachmentPicker from "../app/components/AttachmentPicker";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeAll(() => {
	(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
		.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
	if (root) await act(async () => root?.unmount());
	container?.remove();
	root = undefined;
	container = undefined;
});

describe("AttachmentPicker", () => {
	it("accepts dropped files and exposes removable attachment chips", async () => {
		const onAdd = vi.fn();
		const onRemove = vi.fn();
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(createElement(AttachmentPicker, {
				attachments: [{
					kind: "existing",
					id: "attachment-1",
					filename: "cover-letter.pdf",
					size: 2048,
					type: "application/pdf",
				}],
				onAdd,
				onRemove,
			}));
		});

		const file = new File(["pdf"], "new-letter.pdf", { type: "application/pdf" });
		const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
		Object.defineProperty(dropEvent, "dataTransfer", { value: { files: [file] } });
		await act(async () => {
			container?.querySelector('[aria-label="Attachment drop zone"]')
				?.dispatchEvent(dropEvent);
		});

		expect(onAdd).toHaveBeenCalledWith([file]);
		expect(container.textContent).toContain("cover-letter.pdf");
		expect(container.textContent).toContain("2 KB");

		await act(async () => {
			(container?.querySelector('[aria-label="Remove cover-letter.pdf"]') as HTMLButtonElement)
				.click();
		});
		expect(onRemove).toHaveBeenCalledWith("attachment-1");
	});
});
