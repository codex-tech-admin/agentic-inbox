// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import EmailIframe from "../app/components/EmailIframe";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeAll(() => {
	(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
		.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
	if (root) {
		await act(async () => root?.unmount());
	}
	container?.remove();
	root = undefined;
	container = undefined;
});

describe("EmailIframe", () => {
	it("opens sanitized email links outside the sandbox", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				createElement(EmailIframe, {
					body: `
						<a href="https://example.com/job">Job description</a>
						<a href="https://example.com/profile" target="_self" rel="opener">
							Sender-supplied target
						</a>
					`,
				}),
			);
		});

		const iframe = container.querySelector("iframe");
		expect(iframe).not.toBeNull();

		const emailDocument = new DOMParser().parseFromString(
			iframe?.srcdoc ?? "",
			"text/html",
		);
		const links = Array.from(emailDocument.querySelectorAll("a"));

		expect(links).toHaveLength(2);
		for (const link of links) {
			expect(link.getAttribute("target")).toBe("_blank");
			expect(link.getAttribute("rel")).toBe("noopener noreferrer");
		}

		expect(iframe?.getAttribute("sandbox")).toContain("allow-popups");
		expect(iframe?.getAttribute("sandbox")).toContain(
			"allow-popups-to-escape-sandbox",
		);
		expect(iframe?.getAttribute("sandbox")).not.toContain(
			"allow-top-navigation",
		);
	});
});
