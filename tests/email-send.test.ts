import { describe, expect, it, vi } from "vitest";
import { sendEmail } from "../workers/email-sender";
import { app } from "../workers/index";
import { SendEmailRequestSchema } from "../workers/lib/schemas";

describe("outbound email contract", () => {
	it("accepts an intentionally blank message body", () => {
		const result = SendEmailRequestSchema.parse({
			to: "recipient@example.com",
			from: "sender@example.com",
			subject: "Blank message",
			html: "",
			text: "",
		});

		expect(result.html).toBe("");
		expect(result.text).toBe("");
	});

	it("also accepts an omitted message body", () => {
		expect(() => SendEmailRequestSchema.parse({
			to: "recipient@example.com",
			from: "sender@example.com",
			subject: "No body fields",
		})).not.toThrow();
	});

	it("accepts a valid PDF attachment and rejects too many attachments", () => {
		const attachment = {
			content: "cGRm",
			filename: "cover-letter.pdf",
			type: "application/pdf",
			disposition: "attachment" as const,
		};
		const request = {
			to: "recipient@example.com",
			from: "sender@example.com",
			subject: "Cover letter",
			attachments: [attachment],
		};

		expect(SendEmailRequestSchema.parse(request).attachments).toEqual([attachment]);
		expect(() => SendEmailRequestSchema.parse({
			...request,
			attachments: Array.from({ length: 11 }, () => attachment),
		})).toThrow();
	});

	it("uses an invisible transport placeholder for Cloudflare Email Service", async () => {
		const binding = {
			send: vi.fn().mockResolvedValue({ messageId: "message-id" }),
		};

		await sendEmail(binding as unknown as SendEmail, {
			to: "recipient@example.com",
			from: "sender@example.com",
			subject: "Blank message",
			html: "",
			text: "",
		});

		expect(binding.send).toHaveBeenCalledWith(expect.objectContaining({ text: "\u200B" }));
		expect(binding.send.mock.calls[0][0]).not.toHaveProperty("html");
	});

	it("preserves ordinary visible content", async () => {
		const binding = {
			send: vi.fn().mockResolvedValue({ messageId: "message-id" }),
		};

		await sendEmail(binding as unknown as SendEmail, {
			to: "recipient@example.com",
			from: "sender@example.com",
			subject: "Visible message",
			html: "<p>Hello</p>",
			text: "Hello",
		});

		expect(binding.send).toHaveBeenCalledWith(expect.objectContaining({
			html: "<p>Hello</p>",
			text: "Hello",
		}));
	});

	it("returns a useful 400 response for invalid API input", async () => {
		const response = await app.request("/api/v1/mailboxes", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "not-an-email", name: "Test" }),
		});
		const payload = await response.json() as { error: string };

		expect(response.status).toBe(400);
		expect(payload.error).toBe("Invalid email");
	});
});
