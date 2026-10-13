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
	it("preserves embedded email styles while removing executable markup", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				createElement(EmailIframe, {
					body: `<!doctype html>
						<html>
							<head>
								<style>
									.container { max-width: 560px; margin: 0 auto; }
									@media (max-width: 600px) { .container { padding: 12px; } }
								</style>
								<script>window.parent.postMessage("unsafe", "*")</script>
							</head>
							<body class="email-shell" style="background: #f4f4f4" onload="alert('unsafe')">
								<div class="container" onclick="alert('unsafe')">Styled email</div>
								<a href="javascript:alert('unsafe')">Unsafe link</a>
							</body>
						</html>`,
				}),
			);
		});

		const iframe = container.querySelector("iframe");
		const srcdoc = iframe?.srcdoc ?? "";

		expect(srcdoc).toContain(".container { max-width: 560px; margin: 0 auto; }");
		expect(srcdoc).toContain("@media (max-width: 600px)");
		expect(srcdoc).toContain('<body class="email-shell" style="background: #f4f4f4">');
		expect(srcdoc).toContain('<div class="container">Styled email</div>');
		expect(srcdoc).not.toContain('onclick="alert');
		expect(srcdoc).not.toContain('onload="alert');
		expect(srcdoc).not.toContain("javascript:");
		expect(srcdoc).not.toContain('postMessage("unsafe"');
	});

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

	it("repairs Outlook artifacts in legacy quoted replies", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				createElement(EmailIframe, {
					body: `<p>Reply text</p>
						<blockquote>
							On Tue, Oct 13, Eiman wrote:<br><br>
							v\\:* {behavior:url(#default#VML);} .shape {behavior:url(#default#VML);}
							Hi Raihan, Regards &amp;nbsp; &amp;nbsp; Eiman
						</blockquote>`,
				}),
			);
		});

		const srcdoc = container.querySelector("iframe")?.srcdoc ?? "";
		expect(srcdoc).toContain("Reply text");
		expect(srcdoc).toContain("Hi Raihan, Regards Eiman");
		expect(srcdoc).not.toContain("behavior:url");
		expect(srcdoc).not.toContain("default#VML");
		expect(srcdoc).not.toContain("&amp;nbsp;");
	});
});
