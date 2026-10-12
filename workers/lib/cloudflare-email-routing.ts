import { z } from "zod";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

const RoutingRuleSchema = z.object({
	id: z.string().min(1),
	enabled: z.boolean().optional().default(true),
	actions: z.array(z.object({
		type: z.string(),
		value: z.array(z.string()).optional(),
	})).optional().default([]),
	matchers: z.array(z.object({
		type: z.string(),
		field: z.string().optional(),
		value: z.string().optional(),
	})).optional().default([]),
});

const RoutingRulesResponseSchema = z.object({
	success: z.boolean(),
	result: z.array(RoutingRuleSchema).optional().default([]),
	errors: z.array(z.object({
		code: z.number().optional(),
		message: z.string().optional(),
	})).optional().default([]),
	result_info: z.object({
		page: z.number().optional(),
		total_pages: z.number().optional(),
	}).optional(),
});

const RoutingRuleResponseSchema = z.object({
	success: z.boolean(),
	result: RoutingRuleSchema.nullable().optional(),
	errors: z.array(z.object({
		code: z.number().optional(),
		message: z.string().optional(),
	})).optional().default([]),
});

export class EmailRoutingError extends Error {
	readonly status: number;

	constructor(message: string, status = 502) {
		super(message);
		this.name = "EmailRoutingError";
		this.status = status;
	}
}

export interface EnsureEmailRoutingRuleOptions {
	token: string;
	zoneId: string;
	email: string;
	workerName: string;
	displayName: string;
}

export interface EnsuredEmailRoutingRule {
	ruleId: string;
	created: boolean;
}

function apiHeaders(token: string): HeadersInit {
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
	};
}

function errorMessage(
	fallback: string,
	errors: { code?: number; message?: string }[],
): string {
	const detail = errors.find((error) => error.message)?.message;
	return detail ? `${fallback}: ${detail}` : fallback;
}

async function parseApiResponse(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		throw new EmailRoutingError(
			`Cloudflare returned an unreadable response (${response.status})`,
		);
	}
}

function routesToWorker(
	rule: z.infer<typeof RoutingRuleSchema>,
	workerName: string,
): boolean {
	return rule.enabled && rule.actions.some(
		(action) => action.type === "worker" && action.value?.includes(workerName),
	);
}

function matchesAddress(
	rule: z.infer<typeof RoutingRuleSchema>,
	email: string,
): boolean {
	return rule.matchers.some(
		(matcher) => matcher.type === "literal"
			&& matcher.field === "to"
			&& matcher.value?.toLowerCase() === email,
	);
}

async function listRoutingRules(
	options: EnsureEmailRoutingRuleOptions,
	fetcher: typeof fetch,
): Promise<z.infer<typeof RoutingRuleSchema>[]> {
	const rules: z.infer<typeof RoutingRuleSchema>[] = [];
	let page = 1;
	let totalPages = 1;

	do {
		const url = new URL(`${CLOUDFLARE_API_BASE}/zones/${options.zoneId}/email/routing/rules`);
		url.searchParams.set("page", String(page));
		url.searchParams.set("per_page", "50");
		const response = await fetcher(url, {
			headers: apiHeaders(options.token),
		});
		const payload = RoutingRulesResponseSchema.safeParse(await parseApiResponse(response));
		if (!response.ok || !payload.success || !payload.data.success) {
			const errors = payload.success ? payload.data.errors : [];
			throw new EmailRoutingError(errorMessage("Cloudflare could not list email routes", errors));
		}
		rules.push(...payload.data.result);
		totalPages = payload.data.result_info?.total_pages ?? 1;
		page += 1;
	} while (page <= totalPages);

	return rules;
}

function findAddressRule(
	rules: z.infer<typeof RoutingRuleSchema>[],
	email: string,
): z.infer<typeof RoutingRuleSchema> | undefined {
	return rules.find((rule) => matchesAddress(rule, email));
}

export async function ensureEmailRoutingRule(
	options: EnsureEmailRoutingRuleOptions,
	fetcher: typeof fetch = fetch,
): Promise<EnsuredEmailRoutingRule> {
	const email = options.email.toLowerCase();
	const existing = findAddressRule(await listRoutingRules(options, fetcher), email);
	if (existing) {
		if (!routesToWorker(existing, options.workerName)) {
			throw new EmailRoutingError(
				`A Cloudflare routing rule already exists for ${email}, but it does not route to this inbox`,
				409,
			);
		}
		return { ruleId: existing.id, created: false };
	}

	const response = await fetcher(
		`${CLOUDFLARE_API_BASE}/zones/${options.zoneId}/email/routing/rules`,
		{
			method: "POST",
			headers: apiHeaders(options.token),
			body: JSON.stringify({
				name: `${options.displayName} inbox (${email})`.slice(0, 256),
				enabled: true,
				matchers: [{ type: "literal", field: "to", value: email }],
				actions: [{ type: "worker", value: [options.workerName] }],
			}),
		},
	);
	const payload = RoutingRuleResponseSchema.safeParse(await parseApiResponse(response));
	if (!response.ok || !payload.success || !payload.data.success || !payload.data.result) {
		const errors = payload.success ? payload.data.errors : [];
		throw new EmailRoutingError(errorMessage("Cloudflare could not create the email route", errors));
	}

	if (!routesToWorker(payload.data.result, options.workerName)) {
		throw new EmailRoutingError("Cloudflare created an unexpected email routing rule");
	}

	return { ruleId: payload.data.result.id, created: true };
}

export async function deleteEmailRoutingRule(
	token: string,
	zoneId: string,
	ruleId: string,
	fetcher: typeof fetch = fetch,
): Promise<void> {
	const response = await fetcher(
		`${CLOUDFLARE_API_BASE}/zones/${zoneId}/email/routing/rules/${ruleId}`,
		{
			method: "DELETE",
			headers: apiHeaders(token),
		},
	);
	if (!response.ok) {
		throw new EmailRoutingError("Cloudflare could not roll back the email route");
	}
}
