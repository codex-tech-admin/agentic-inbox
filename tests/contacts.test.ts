import { describe, expect, it, vi } from "vitest";
import { parseRecipientValue } from "../app/components/RecipientField";
import { app } from "../workers/index";
import {
	contactDisplayNameFromHeaders,
	normalizeContactEmail,
	splitContactAddresses,
} from "../workers/lib/contacts";

describe("contact address helpers", () => {
	it("normalizes and de-duplicates valid addresses", () => {
		expect(normalizeContactEmail(" Person@Example.COM ")).toBe("person@example.com");
		expect(normalizeContactEmail("not-an-email")).toBeNull();
		expect(splitContactAddresses("One@example.com, one@example.com, two@example.com"))
			.toEqual(["one@example.com", "two@example.com"]);
	});

	it("extracts a sender display name from stored headers", () => {
		const headers = JSON.stringify([
			{ key: "From", value: '"Kamila Olexa" <kamila@example.com>' },
		]);
		expect(contactDisplayNameFromHeaders(headers)).toBe("Kamila Olexa");
		expect(contactDisplayNameFromHeaders("invalid json")).toBeNull();
	});

	it("keeps completed recipient chips separate from an active search", () => {
		expect(parseRecipientValue("one@example.com, Two@example.com, kam"))
			.toEqual({
				recipients: ["one@example.com", "two@example.com"],
				query: "kam",
			});
	});
});

describe("contacts API", () => {
	function environment() {
		const listContacts = vi.fn().mockResolvedValue([{ id: "person@example.com" }]);
		const createContact = vi.fn().mockImplementation(async (contact) => ({
			id: contact.email,
			...contact,
		}));
		const updateContact = vi.fn().mockImplementation(async (id, contact) => ({ id, ...contact }));
		const deleteContact = vi.fn().mockResolvedValue(true);
		return {
			listContacts,
			createContact,
			updateContact,
			deleteContact,
			env: {
				BUCKET: { head: vi.fn().mockResolvedValue({}) },
				MAILBOX: {
					idFromName: vi.fn((value: string) => value),
					get: vi.fn(() => ({ listContacts, createContact, updateContact, deleteContact })),
				},
			},
		};
	}

	it("lists mailbox contacts with bounded search options", async () => {
		const { env, listContacts } = environment();
		const response = await app.request(
			"/api/v1/mailboxes/hello%40example.com/contacts?q=kam&limit=8",
			{},
			env as never,
		);
		expect(response.status).toBe(200);
		expect(listContacts).toHaveBeenCalledWith({ query: "kam", limit: 8 });
	});

	it("validates and creates a manual contact", async () => {
		const { env, createContact } = environment();
		const response = await app.request(
			"/api/v1/mailboxes/hello%40example.com/contacts",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "person@example.com", name: "Person" }),
			},
			env as never,
		);
		expect(response.status).toBe(201);
		expect(createContact).toHaveBeenCalledWith({
			email: "person@example.com",
			name: "Person",
		});
	});

	it("rejects an invalid contact email", async () => {
		const { env, createContact } = environment();
		const response = await app.request(
			"/api/v1/mailboxes/hello%40example.com/contacts",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "not-an-email" }),
			},
			env as never,
		);
		expect(response.status).toBe(400);
		expect(createContact).not.toHaveBeenCalled();
	});
});
