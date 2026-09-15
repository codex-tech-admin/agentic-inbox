import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../workers/types";

const mocks = vi.hoisted(() => ({
	getMailboxStub: vi.fn(),
	verifyDraft: vi.fn(),
}));

vi.mock("@cloudflare/ai-chat", () => ({
	AIChatAgent: class {},
}));

vi.mock("ai", () => ({
	convertToModelMessages: vi.fn(),
	generateText: vi.fn(),
	stepCountIs: vi.fn(),
	streamText: vi.fn(),
}));

vi.mock("workers-ai-provider", () => ({
	createWorkersAI: vi.fn(),
}));

vi.mock("../workers/lib/email-helpers", async (importOriginal) => ({
	...(await importOriginal<typeof import("../workers/lib/email-helpers")>()),
	getMailboxStub: mocks.getMailboxStub,
}));

vi.mock("../workers/lib/ai", async (importOriginal) => ({
	...(await importOriginal<typeof import("../workers/lib/ai")>()),
	verifyDraft: mocks.verifyDraft,
}));

import { createEmailTools } from "../workers/agent";
import { toolUpdateDraft } from "../workers/lib/tools";

describe("draft updates", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("exposes update_draft to the inbox agent", () => {
		const tools = createEmailTools({} as Env, "contact@example.com");

		expect(tools).toHaveProperty("update_draft");
	});

	it("updates the original draft record in place", async () => {
		const stub = {
			getEmail: vi.fn().mockResolvedValue({
				id: "draft-123",
				folder_id: "draft",
				subject: "Original subject",
				recipient: "person@example.com",
				body: "<p>Original body</p>",
			}),
			updateDraft: vi.fn().mockResolvedValue({ id: "draft-123" }),
			deleteEmail: vi.fn(),
			createEmail: vi.fn(),
		};
		mocks.getMailboxStub.mockReturnValue(stub);
		mocks.verifyDraft.mockResolvedValue("<p>Updated body</p>");

		const result = await toolUpdateDraft(
			{} as Env,
			"contact@example.com",
			{
				draftId: "draft-123",
				bodyHtml: "<p>Updated body</p>",
			},
		);

		expect(result).toEqual({
			status: "draft_updated",
			draftId: "draft-123",
			message: "Draft updated in Drafts folder.",
		});
		expect(stub.updateDraft).toHaveBeenCalledWith("draft-123", {
			recipient: "person@example.com",
			subject: "Original subject",
			body: "<p>Updated body</p>",
			date: expect.any(String),
		});
		expect(stub.deleteEmail).not.toHaveBeenCalled();
		expect(stub.createEmail).not.toHaveBeenCalled();
	});
});
