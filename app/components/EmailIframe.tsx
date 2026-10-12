// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import DOMPurify from "dompurify";
import { useCallback, useEffect, useRef, useState } from "react";

interface EmailIframeProps {
	body: string;
	/** When true, iframe auto-sizes to content height instead of filling parent */
	autoSize?: boolean;
}

const UNSAFE_URL_PROTOCOL = /^\s*(?:javascript|vbscript):/i;
const BODY_ATTRIBUTES = ["class", "id", "style", "dir", "lang", "bgcolor"] as const;

function escapeAttribute(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/**
 * Split a complete HTML email into its stylesheet and body portions before
 * DOMPurify flattens the document. Email generators commonly put responsive
 * class rules in <head><style>; dropping those rules is what makes templates
 * such as Gojiberry render as unformatted document fragments.
 */
function prepareEmailHtml(body: string) {
	const emailDocument = new DOMParser().parseFromString(body, "text/html");
	const emailStyles = Array.from(emailDocument.querySelectorAll("style"))
		.map((style) => style.textContent || "")
		.filter(Boolean)
		.join("\n")
		// A CSS string cannot be allowed to terminate the trusted wrapper's
		// style element, even if a malformed parser ever exposes that sequence.
		.replace(/<\/style/gi, "<\\/style");

	for (const element of emailDocument.querySelectorAll(
		"script, iframe, object, embed, base, link, meta",
	)) {
		element.remove();
	}

	for (const element of emailDocument.querySelectorAll("*")) {
		for (const attribute of Array.from(element.attributes)) {
			if (attribute.name.toLowerCase().startsWith("on")) {
				element.removeAttribute(attribute.name);
				continue;
			}
			if (
				["href", "src", "xlink:href", "action", "formaction", "poster", "background"].includes(
					attribute.name.toLowerCase(),
				) &&
				UNSAFE_URL_PROTOCOL.test(attribute.value)
			) {
				element.removeAttribute(attribute.name);
			}
		}
	}

	const bodyAttributes = BODY_ATTRIBUTES.flatMap((name) => {
		const value = emailDocument.body.getAttribute(name);
		return value ? [`${name}="${escapeAttribute(value)}"`] : [];
	}).join(" ");

	return {
		bodyAttributes: bodyAttributes ? ` ${bodyAttributes}` : "",
		bodyMarkup: emailDocument.body.innerHTML,
		emailStyles,
	};
}

/**
 * Renders email HTML inside a sandboxed iframe.
 *
 * Security model:
 * - DOMPurify sanitises the HTML before injection.
 * - The iframe sandbox does NOT include `allow-same-origin`, so even if
 *   DOMPurify has a bypass the attacker's code runs in an opaque origin
 *   with no access to the parent page's cookies, DOM, or API.
 * - Because the iframe is cross-origin we cannot read `contentDocument`
 *   for auto-sizing. Instead, the injected HTML includes a tiny inline
 *   script that posts its body height to the parent via `postMessage`.
 *   The `allow-scripts` flag is required for this, but scripts inside
 *   the opaque-origin sandbox cannot access anything useful.
 * - A strict CSP meta tag blocks external resource loads inside the
 *   iframe as a defense-in-depth layer.
 * - Sanitized links are forced into isolated top-level tabs. Sender-supplied
 *   targets cannot navigate either the inbox or the email iframe.
 */
export default function EmailIframe({ body, autoSize }: EmailIframeProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [height, setHeight] = useState(autoSize ? 100 : 0);

	// Listen for height reports from the sandboxed iframe
	const handleMessage = useCallback(
		(event: MessageEvent) => {
			if (!autoSize) return;
			// Only accept messages from our own iframe
			if (event.source !== iframeRef.current?.contentWindow) return;
			if (
				event.data &&
				typeof event.data === "object" &&
				event.data.__emailIframeHeight &&
				typeof event.data.height === "number" &&
				event.data.height > 0
			) {
				setHeight(event.data.height);
			}
		},
		[autoSize],
	);

	useEffect(() => {
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [handleMessage]);

	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe || !body) return;
		const { bodyAttributes, bodyMarkup, emailStyles } = prepareEmailHtml(body);

		const cleanWrapper = DOMPurify.sanitize(
			`<div data-email-root>${bodyMarkup}</div>`,
			{
				USE_PROFILES: { html: true },
				FORBID_TAGS: ["style"],
				ADD_ATTR: ["target", "data-email-root"],
				FORCE_BODY: true,
			},
		);

		const emailBody = document.createElement("template");
		emailBody.innerHTML = cleanWrapper;
		const emailRoot = emailBody.content.querySelector("[data-email-root]");
		const cleanBody = emailRoot?.innerHTML ?? cleanWrapper;
		emailBody.innerHTML = cleanBody;
		for (const link of emailBody.content.querySelectorAll("a[href]")) {
			link.setAttribute("target", "_blank");
			link.setAttribute("rel", "noopener noreferrer");
		}
		const safeBody = emailBody.innerHTML;

		const padding = autoSize ? "0" : "24px";

		// Height-reporting script: sends body.scrollHeight to the parent.
		// Runs inside the opaque-origin sandbox so it has zero access to
		// the parent page — it can only postMessage.
		const heightScript = autoSize
			? `<script>
				function reportHeight() {
					var h = document.body.scrollHeight;
					if (h > 0) parent.postMessage({ __emailIframeHeight: true, height: h }, "*");
				}
				reportHeight();
				setTimeout(reportHeight, 50);
				setTimeout(reportHeight, 150);
				setTimeout(reportHeight, 400);
			<\/script>`
			: "";

		// Use srcdoc so the iframe is truly sandboxed (no same-origin access).
		// We can't use doc.write() because that requires allow-same-origin.
		iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: cid: https:; script-src 'unsafe-inline';">
<style>
* { box-sizing: border-box; }
html {
	background: #ffffff;
	color-scheme: light;
}
body {
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	font-size: 14px;
	line-height: 1.6;
	color: #1a1a1a;
	background: #ffffff;
	padding: ${padding};
	margin: 0;
	word-wrap: break-word;
	overflow-wrap: break-word;
	${autoSize ? "overflow: hidden;" : ""}
}
[style*="position: fixed"], [style*="position:fixed"], [style*="position: absolute"], [style*="position:absolute"] {
	position: relative !important;
}
a { color: #2563eb; }
img { max-width: 100%; height: auto; }
blockquote {
	border-left: 3px solid #d1d5db;
	padding-left: 1em;
	margin-left: 0;
	color: #6b7280;
}
pre {
	background: #f3f4f6;
	padding: 12px;
	border-radius: 6px;
	overflow-x: auto;
	font-size: 13px;
}
table { border-collapse: collapse; max-width: 100%; }
td, th { padding: 4px 8px; }
p { margin: 4px 0; }
h1, h2, h3 { margin: 8px 0 4px; }
ul, ol { padding-left: 20px; margin: 4px 0; }
</style>
${emailStyles ? `<style data-email-styles>${emailStyles}</style>` : ""}
</head>
<body${bodyAttributes}>${safeBody}${heightScript}</body>
</html>`;
	}, [body, autoSize]);

	return (
		<iframe
			ref={iframeRef}
			className="block w-full border-0"
			style={autoSize ? { height: `${height}px` } : { height: "100%" }}
			sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
			title="Email content"
		/>
	);
}
