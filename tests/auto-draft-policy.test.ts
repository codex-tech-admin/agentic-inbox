import { describe, expect, it } from "vitest";
import { classifyAutoDraft } from "../workers/lib/auto-draft-policy";

const baseMessage = {
	mailboxId: "contact@raihanrazi.com",
	sender: "recruiter@company.com",
	subject: "Your application",
	body: "Hello Raihan",
};

describe("career inbox auto-draft policy", () => {
	it.each([
		{
			name: "application confirmation",
			message: { sender: "talent@company.com", subject: "Application received", body: "Thank you for applying. We have received your application." },
			category: "application_confirmation",
		},
		{
			name: "no-reply sender",
			message: { sender: "Workday <no-reply@workday.com>", subject: "Application update", body: "Here is the latest information." },
			category: "automated_sender",
		},
		{
			name: "rejection notice",
			message: { sender: "talent@company.com", subject: "Application update", body: "Unfortunately, we will not be moving forward with your application." },
			category: "application_status",
		},
		{
			name: "verification email",
			message: { sender: "accounts@company.com", subject: "Verify your email", body: "Your one-time code is 123456." },
			category: "verification",
		},
		{
			name: "assessment invitation",
			message: { sender: "hiring@company.com", subject: "Coding assessment", body: "Please complete your assessment by Friday." },
			category: "assessment_notification",
		},
	])("skips $name", ({ message, category }) => {
		const decision = classifyAutoDraft({ ...baseMessage, ...message });
		expect(decision.shouldDraft).toBe(false);
		expect(decision.category).toBe(category);
	});

	it("skips a blank email", () => {
		expect(classifyAutoDraft({ ...baseMessage, body: "   " })).toMatchObject({ shouldDraft: false, category: "blank_message" });
	});

	it("skips a message sent by the managed mailbox", () => {
		expect(classifyAutoDraft({ ...baseMessage, sender: "contact@raihanrazi.com" })).toMatchObject({ shouldDraft: false, category: "self_message" });
	});

	it("drafts for a human recruiter asking for interview availability", () => {
		const decision = classifyAutoDraft({
			...baseMessage,
			sender: "Jane Recruiter <jane@company.com>",
			subject: "Interview availability",
			body: "Hi Raihan, are you available Tuesday for a 30-minute interview?",
		});
		expect(decision).toMatchObject({ shouldDraft: true, category: "reply_requested" });
	});

	it("drafts for a direct human question", () => {
		const decision = classifyAutoDraft({
			...baseMessage,
			subject: "Portfolio",
			body: "Which project best demonstrates your recent platform work?",
		});
		expect(decision).toMatchObject({ shouldDraft: true, category: "human_question" });
	});

	it("defaults ambiguous informational mail to no draft", () => {
		const decision = classifyAutoDraft({
			...baseMessage,
			subject: "Role information",
			body: "Sharing the role description for your reference.",
		});
		expect(decision).toMatchObject({ shouldDraft: false, category: "no_reply_needed" });
	});
});
