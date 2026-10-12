// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Badge, Button, Dialog, Input, Loader, useKumoToastManager } from "@cloudflare/kumo";
import { AddressBookIcon, MagnifyingGlassIcon, PlusIcon, StarIcon, TrashIcon } from "@phosphor-icons/react";
import { useDeferredValue, useState } from "react";
import { useParams } from "react-router";
import { useContacts, useCreateContact, useDeleteContact, useUpdateContact } from "~/queries/contacts";
import type { Contact } from "~/types";

function contactName(contact: Contact) {
	return contact.name || contact.email.split("@")[0];
}

function formatLastInteraction(value?: string | null) {
	if (!value) return "No interaction date";
	return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export default function ContactsRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const toastManager = useKumoToastManager();
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const { data: contacts = [], isLoading } = useContacts(mailboxId, deferredSearch);
	const createContact = useCreateContact();
	const updateContact = useUpdateContact();
	const deleteContact = useDeleteContact();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editing, setEditing] = useState<Contact | null>(null);
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [company, setCompany] = useState("");
	const [notes, setNotes] = useState("");

	const openAdd = () => {
		setEditing(null);
		setEmail("");
		setName("");
		setCompany("");
		setNotes("");
		setIsDialogOpen(true);
	};

	const openEdit = (contact: Contact) => {
		setEditing(contact);
		setEmail(contact.email);
		setName(contact.name || "");
		setCompany(contact.company || "");
		setNotes(contact.notes || "");
		setIsDialogOpen(true);
	};

	const saveContact = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!mailboxId) return;
		try {
			if (editing) {
				await updateContact.mutateAsync({
					mailboxId,
					id: editing.id,
					contact: { name, company, notes },
				});
				toastManager.add({ title: "Contact updated" });
			} else {
				await createContact.mutateAsync({
					mailboxId,
					contact: { email, name, company, notes },
				});
				toastManager.add({ title: "Contact added" });
			}
			setIsDialogOpen(false);
		} catch (error) {
			toastManager.add({
				title: error instanceof Error ? error.message : "Unable to save contact",
				variant: "error",
			});
		}
	};

	const toggleFavorite = (contact: Contact) => {
		if (!mailboxId) return;
		updateContact.mutate({
			mailboxId,
			id: contact.id,
			contact: { favorite: !contact.favorite },
		});
	};

	const removeContact = async () => {
		if (!mailboxId || !editing) return;
		if (!window.confirm(`Delete ${contactName(editing)} from this mailbox's contacts?`)) return;
		try {
			await deleteContact.mutateAsync({ mailboxId, id: editing.id });
			setIsDialogOpen(false);
			toastManager.add({ title: "Contact deleted" });
		} catch {
			toastManager.add({ title: "Unable to delete contact", variant: "error" });
		}
	};

	return (
		<div className="flex h-full flex-col overflow-hidden bg-kumo-base">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-kumo-line px-4 py-4 md:px-8">
				<div>
					<h1 className="text-lg font-semibold text-kumo-default">Contacts</h1>
					<p className="mt-0.5 text-sm text-kumo-subtle">
						{contacts.length} {contacts.length === 1 ? "contact" : "contacts"} in this mailbox
					</p>
				</div>
				<Button variant="primary" size="sm" icon={<PlusIcon size={16} />} onClick={openAdd}>
					Add contact
				</Button>
			</div>

			<div className="border-b border-kumo-line px-4 py-3 md:px-8">
				<div className="relative max-w-lg">
					<MagnifyingGlassIcon size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kumo-subtle" />
					<input
						type="search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search by name, email, or company"
						aria-label="Search contacts"
						className="h-9 w-full rounded-md border border-kumo-line bg-kumo-base pl-9 pr-3 text-sm text-kumo-default outline-none placeholder:text-kumo-subtle focus:border-kumo-ring focus:ring-1 focus:ring-kumo-ring"
					/>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				{isLoading ? (
					<div className="flex justify-center py-20"><Loader size="lg" /></div>
				) : contacts.length === 0 ? (
					<div className="flex flex-col items-center justify-center px-6 py-24 text-center">
						<AddressBookIcon size={48} weight="thin" className="mb-4 text-kumo-subtle" />
						<h2 className="text-base font-semibold text-kumo-default">
							{search ? "No matching contacts" : "No contacts yet"}
						</h2>
						<p className="mt-1 max-w-sm text-sm text-kumo-subtle">
							{search ? "Try a different name or email address." : "People you email and people who write to you will appear here automatically."}
						</p>
						{!search && <Button variant="secondary" size="sm" className="mt-5" onClick={openAdd}>Add your first contact</Button>}
					</div>
				) : (
					<div className="divide-y divide-kumo-line">
						{contacts.map((contact) => (
							<div key={contact.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-kumo-tint md:px-8">
								<button
									type="button"
									onClick={() => toggleFavorite(contact)}
									className="rounded p-1 text-kumo-subtle hover:bg-kumo-fill hover:text-kumo-default"
									aria-label={contact.favorite ? `Remove ${contactName(contact)} from favorites` : `Add ${contactName(contact)} to favorites`}
								>
									<StarIcon size={17} weight={contact.favorite ? "fill" : "regular"} className={contact.favorite ? "text-amber-500" : ""} />
								</button>
								<button type="button" onClick={() => openEdit(contact)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kumo-fill text-sm font-semibold uppercase text-kumo-strong">
										{contactName(contact).charAt(0)}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<span className="truncate text-sm font-medium text-kumo-default">{contactName(contact)}</span>
											<Badge variant={contact.source === "manual" ? "primary" : "secondary"}>
												{contact.source === "manual" ? "Saved" : "From email"}
											</Badge>
										</div>
										<div className="truncate text-sm text-kumo-subtle">{contact.email}{contact.company ? ` · ${contact.company}` : ""}</div>
									</div>
									<div className="hidden shrink-0 text-right text-xs text-kumo-subtle sm:block">
										<div>{formatLastInteraction(contact.last_seen_at)}</div>
										<div>{contact.sent_count} sent · {contact.received_count} received</div>
									</div>
								</button>
							</div>
						))}
					</div>
				)}
			</div>

			<Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<Dialog size="base" className="p-6">
					<Dialog.Title className="mb-5 text-lg font-semibold">
						{editing ? "Edit contact" : "Add contact"}
					</Dialog.Title>
					<form onSubmit={saveContact} className="space-y-4">
						<Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={Boolean(editing)} required />
						<Input label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Contact name" />
						<Input label="Company" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company or organization" />
						<label className="block text-sm font-medium text-kumo-default">
							<span className="mb-1.5 block">Notes</span>
							<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full resize-y rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm text-kumo-default outline-none focus:border-kumo-ring focus:ring-1 focus:ring-kumo-ring" />
						</label>
						<div className="flex items-center justify-between pt-2">
							<div>
								{editing && (
									<Button type="button" variant="ghost" size="sm" icon={<TrashIcon size={15} />} onClick={removeContact} disabled={deleteContact.isPending}>
										Delete
									</Button>
								)}
							</div>
							<div className="flex gap-2">
								<Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
								<Button type="submit" variant="primary" loading={createContact.isPending || updateContact.isPending}>Save contact</Button>
							</div>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}
