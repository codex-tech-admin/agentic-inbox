// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "~/services/api";
import type { Contact, ContactInput } from "~/types";
import { queryKeys } from "./keys";

export function useContacts(
	mailboxId: string | undefined,
	query = "",
	options: { enabled?: boolean; limit?: number } = {},
) {
	return useQuery<Contact[]>({
		queryKey: mailboxId
			? queryKeys.contacts.list(mailboxId, query)
			: ["contacts", "_disabled"],
		queryFn: ({ signal }) => api.listContacts(
			mailboxId!,
			query,
			options.limit ?? 100,
			{ signal },
		),
		enabled: Boolean(mailboxId) && (options.enabled ?? true),
		staleTime: 30_000,
	});
}

export function useCreateContact() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ mailboxId, contact }: { mailboxId: string; contact: ContactInput }) =>
			api.createContact(mailboxId, contact),
		onSuccess: (_contact, { mailboxId }) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all(mailboxId) });
		},
	});
}

export function useUpdateContact() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ mailboxId, id, contact }: {
			mailboxId: string;
			id: string;
			contact: Partial<Omit<ContactInput, "email">>;
		}) => api.updateContact(mailboxId, id, contact),
		onSuccess: (_contact, { mailboxId }) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all(mailboxId) });
		},
	});
}

export function useDeleteContact() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ mailboxId, id }: { mailboxId: string; id: string }) =>
			api.deleteContact(mailboxId, id),
		onSuccess: (_contact, { mailboxId }) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all(mailboxId) });
		},
	});
}
