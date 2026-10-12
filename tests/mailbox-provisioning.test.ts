import { afterEach, describe, expect, it, vi } from "vitest";
import { app, receiveEmail } from "../workers/index";
import {
	EmailRoutingError,
	ensureEmailRoutingRule,
} from "../workers/lib/cloudflare-email-routing";

const options = {
	token: " \ntest-\n token\r\n",
	zoneId: "zone-1",
	email: "sales@sponsoredfeeds.com",
	workerName: "raihan-agentic-inbox",
	displayName: "SponsoredFeeds Sales",
};

function jsonResponse(body: unknown, status = 200) {
	return Response.json(body, { status });
}

describe("Cloudflare email routing", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("adopts an existing rule that already targets this inbox", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
			success: true,
			result: [{
				id: "existing-rule",
				enabled: true,
				matchers: [{ type: "literal", field: "to", value: options.email }],
				actions: [{ type: "worker", value: [options.workerName] }],
			}],
			result_info: { page: 1, total_pages: 1 },
		}));

		await expect(ensureEmailRoutingRule(options, fetcher)).resolves.toEqual({
			ruleId: "existing-rule",
			created: false,
		});
		expect(fetcher).toHaveBeenCalledOnce();
		expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
			Authorization: "Bearer test-token",
		});
	});

	it("creates an explicit address rule when none exists", async () => {
		const fetcher = vi.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse({
				success: true,
				result: [],
				result_info: { page: 1, total_pages: 1 },
			}))
			.mockResolvedValueOnce(jsonResponse({
				success: true,
				result: {
					id: "new-rule",
					enabled: true,
					matchers: [{ type: "literal", field: "to", value: options.email }],
					actions: [{ type: "worker", value: [options.workerName] }],
				},
			}));

		await expect(ensureEmailRoutingRule(options, fetcher)).resolves.toEqual({
			ruleId: "new-rule",
			created: true,
		});
		const [, request] = fetcher.mock.calls[1];
		expect(request?.method).toBe("POST");
		expect(JSON.parse(request?.body as string)).toMatchObject({
			enabled: true,
			matchers: [{ type: "literal", field: "to", value: options.email }],
			actions: [{ type: "worker", value: [options.workerName] }],
		});
	});

	it("rejects an address already routed somewhere else", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
			success: true,
			result: [{
				id: "conflicting-rule",
				enabled: true,
				matchers: [{ type: "literal", field: "to", value: options.email }],
				actions: [{ type: "forward", value: ["someone@example.com"] }],
			}],
			result_info: { page: 1, total_pages: 1 },
		}));

		await expect(ensureEmailRoutingRule(options, fetcher)).rejects.toMatchObject<EmailRoutingError>({
			status: 409,
		});
	});
});

describe("mailbox provisioning API", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function createEnvironment() {
		const objects = new Map<string, string>();
		const bucket = {
			head: vi.fn(async (key: string) => objects.has(key) ? {} : null),
			put: vi.fn(async (key: string, value: string) => {
				objects.set(key, value);
			}),
			delete: vi.fn(async (keys: string | string[]) => {
				for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
			}),
		};
		const folders = vi.fn().mockResolvedValue([]);
		return {
			objects,
			folders,
			env: {
				BUCKET: bucket,
				MAILBOX: {
					idFromName: vi.fn((value: string) => value),
					get: vi.fn(() => ({ getFolders: folders })),
				},
				EMAIL_DOMAIN_ZONES: { "sponsoredfeeds.com": "zone-1" },
				EMAIL_ROUTING_WORKER: options.workerName,
				EMAIL_ROUTING_API_TOKEN: options.token,
			},
		};
	}

	it("creates mailbox storage and routing metadata together", async () => {
		const { env, objects, folders } = createEnvironment();
		const fetcher = vi.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse({
				success: true,
				result: [],
				result_info: { page: 1, total_pages: 1 },
			}))
			.mockResolvedValueOnce(jsonResponse({
				success: true,
				result: {
					id: "new-rule",
					enabled: true,
					matchers: [{ type: "literal", field: "to", value: options.email }],
					actions: [{ type: "worker", value: [options.workerName] }],
				},
			}));
		vi.stubGlobal("fetch", fetcher);

		const response = await app.request("/api/v1/mailboxes", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: options.email, name: options.displayName }),
		}, env as never);

		expect(response.status).toBe(201);
		expect(folders).toHaveBeenCalledOnce();
		expect(objects.has(`mailboxes/${options.email}.json`)).toBe(true);
		expect(JSON.parse(objects.get(`mailbox-routing/${options.email}.json`) ?? "{}")).toMatchObject({
			ruleId: "new-rule",
			zoneId: "zone-1",
			managed: "created",
		});
	});

	it("rolls back mailbox storage when Cloudflare rejects provisioning", async () => {
		const { env, objects } = createEnvironment();
		vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
			success: false,
			errors: [{ code: 10000, message: "Authentication error" }],
		}, 403)));

		const response = await app.request("/api/v1/mailboxes", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: options.email, name: options.displayName }),
		}, env as never);

		expect(response.status).toBe(502);
		expect(objects.has(`mailboxes/${options.email}.json`)).toBe(false);
	});

	it("rejects domains outside the approved registry", async () => {
		const { env } = createEnvironment();
		const response = await app.request("/api/v1/mailboxes", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "sales@example.com", name: "Sales" }),
		}, env as never);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: "Choose an approved email domain" });
	});
});

describe("dynamic inbound mailbox routing", () => {
	it("uses the trusted envelope recipient instead of the visible To header", async () => {
		const mailboxId = options.email;
		const message = [
			"From: Sender <sender@example.com>",
			"To: visible-recipient@example.com",
			"Subject: Envelope routing test",
			"Message-ID: <envelope-test@example.com>",
			"Content-Type: text/plain; charset=UTF-8",
			"",
			"Hello from the routing test.",
		].join("\r\n");
		const bytes = new TextEncoder().encode(message);
		const createEmail = vi.fn().mockResolvedValue(undefined);
		const agentFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		const env = {
			EMAIL_DOMAIN_ZONES: { "sponsoredfeeds.com": "zone-1" },
			BUCKET: {
				head: vi.fn(async (key: string) => key === `mailboxes/${mailboxId}.json` ? {} : null),
				put: vi.fn().mockResolvedValue(undefined),
			},
			MAILBOX: {
				idFromName: vi.fn((value: string) => value),
				get: vi.fn(() => ({
					findThreadBySubject: vi.fn().mockResolvedValue(null),
					createEmail,
				})),
			},
			EMAIL_AGENT: {
				idFromName: vi.fn((value: string) => value),
				get: vi.fn(() => ({ fetch: agentFetch })),
			},
		};
		const background: Promise<unknown>[] = [];
		const ctx = {
			waitUntil: vi.fn((promise: Promise<unknown>) => background.push(promise)),
		};

		await receiveEmail({
			to: mailboxId,
			raw: new Response(bytes).body!,
			rawSize: bytes.byteLength,
		}, env as never, ctx as never);
		await Promise.all(background);

		expect(env.MAILBOX.idFromName).toHaveBeenCalledWith(mailboxId);
		expect(createEmail).toHaveBeenCalledWith(
			"inbox",
			expect.objectContaining({
				subject: "Envelope routing test",
				recipient: "visible-recipient@example.com",
			}),
			[],
		);
	});
});
