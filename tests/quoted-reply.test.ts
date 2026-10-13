// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
	buildQuotedReplyBlock as buildBrowserQuotedReplyBlock,
	getSnippetText,
} from "../app/lib/utils";
import { buildQuotedReplyBlock as buildWorkerQuotedReplyBlock } from "../workers/lib/email-helpers";

const OUTLOOK_MESSAGE = `
	<html>
		<head>
			<style>
				v\\:* {behavior:url(#default#VML);}
				o\\:* {behavior:url(#default#VML);}
				w\\:* {behavior:url(#default#VML);}
				.shape {behavior:url(#default#VML);}
			</style>
		</head>
		<body>
			<p>Hi Raihan,</p>
			<p>What will be the cost for two day AI discovery session?</p>
			<p>Regards&nbsp;&nbsp;<br>Eiman</p>
			<p>Engineering Manager&nbsp;<br>Campbellfield VIC</p>
		</body>
	</html>
`;

function expectCleanQuote(result: string) {
	expect(result).toContain("Hi Raihan,");
	expect(result).toContain("What will be the cost for two day AI discovery session?");
	expect(result).toContain("Engineering Manager");
	expect(result).not.toContain("behavior:url");
	expect(result).not.toContain("default#VML");
	expect(result).not.toContain("&amp;nbsp;");
	expect(result).not.toContain("&nbsp;");
}

describe("quoted reply cleanup", () => {
	it("removes Outlook VML styles and decodes entities in browser replies", () => {
		expectCleanQuote(buildBrowserQuotedReplyBlock(
			"2026-10-13T13:47:00+11:00",
			"eiman.nosrati@tieman.com.au",
			OUTLOOK_MESSAGE,
		));
	});

	it("removes Outlook VML styles and decodes entities in agent replies", () => {
		expectCleanQuote(buildWorkerQuotedReplyBlock({
			date: "2026-10-13T13:47:00+11:00",
			sender: "eiman.nosrati@tieman.com.au",
			body: OUTLOOK_MESSAGE,
		}));
	});

	it("keeps Outlook artifacts out of collapsed message previews", () => {
		const snippet = getSnippetText(
			`v\\:* {behavior:url(#default#VML);} .shape {behavior:url(#default#VML);} ${OUTLOOK_MESSAGE}`,
			500,
		);
		expect(snippet).toContain("Hi Raihan");
		expect(snippet).not.toContain("behavior:url");
		expect(snippet).not.toContain("&nbsp;");
	});

	it("drops an HTML tag truncated by the server-side preview limit", () => {
		expect(getSnippetText('<meta http-equiv="Content-Type" content="text/htm'))
			.toBe("");
		expect(getSnippetText('<body style="margin:0;padding:0;background:#fff'))
			.toBe("");
	});
});
