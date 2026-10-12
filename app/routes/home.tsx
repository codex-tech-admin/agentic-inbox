// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Button,
	Dialog,
	Empty,
	Input,
	Loader,
	Select,
	Text,
	useKumoToastManager,
} from "@cloudflare/kumo";
import {
	ArrowRightIcon,
	EnvelopeIcon,
	PlusIcon,
} from "@phosphor-icons/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";
import api from "~/services/api";
import {
	useCreateMailbox,
	useMailboxes,
} from "~/queries/mailboxes";
import { queryKeys } from "~/queries/keys";
import type { Folder } from "~/types";

const mailboxThemes = [
	{
		avatar: "bg-blue-100 text-blue-700 ring-blue-200/70",
		arrow: "text-blue-500",
	},
	{
		avatar: "bg-violet-100 text-violet-700 ring-violet-200/70",
		arrow: "text-violet-500",
	},
	{
		avatar: "bg-emerald-100 text-emerald-700 ring-emerald-200/70",
		arrow: "text-emerald-500",
	},
	{
		avatar: "bg-orange-100 text-orange-700 ring-orange-200/70",
		arrow: "text-orange-500",
	},
] as const;

export function meta() {
	return [{ title: "Agentic Inbox" }];
}

export default function HomeRoute() {
	const toastManager = useKumoToastManager();
	const { data: mailboxes = [] } = useMailboxes();
	const createMailbox = useCreateMailbox();

	const { data: configData } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: Infinity, // config rarely changes
	});

	const domains = configData?.domains ?? [];

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newPrefix, setNewPrefix] = useState("");
	const [selectedDomain, setSelectedDomain] = useState("");
	const [newName, setNewName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	// Set default domain when config loads
	useEffect(() => {
		if (domains.length > 0 && !selectedDomain) {
			setSelectedDomain(domains[0]);
		}
	}, [domains, selectedDomain]);

	const handleCreate = async (e: FormEvent) => {
		e.preventDefault();
		setCreateError(null);
		const prefix = newPrefix.trim().toLowerCase();
		if (!prefix || !selectedDomain) {
			setCreateError("Please fill in all fields");
			return;
		}
		if (!/^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/.test(prefix)) {
			setCreateError("Use letters, numbers, dots, dashes, underscores, or plus signs");
			return;
		}
		const email = `${prefix}@${selectedDomain}`;
		const name = newName.trim() || prefix;
		setIsCreating(true);
		try {
			await createMailbox.mutateAsync({ email, name });
			toastManager.add({ title: `${email} is ready` });
			setIsCreateOpen(false);
			setNewPrefix("");
			setNewName("");
		} catch (err: unknown) {
			const message = (err instanceof Error ? err.message : null) || "Failed to create mailbox";
			setCreateError(message);
		} finally {
			setIsCreating(false);
		}
	};

	const accounts = mailboxes.map((mailbox) => ({
		...mailbox,
		name: mailbox.settings?.fromName?.trim()
			|| mailbox.name
			|| mailbox.email.split("@")[0]
			|| mailbox.email,
	}));
	const folderQueries = useQueries({
		queries: accounts.map((account) => ({
			queryKey: queryKeys.folders.list(account.id),
			queryFn: () => api.listFolders(account.id) as Promise<Folder[]>,
			staleTime: 30_000,
		})),
	});
	const unreadByMailbox = new Map(
		accounts.map((account, index) => [
			account.id,
			folderQueries[index]?.data?.find((folder) => folder.id === "inbox")
				?.unreadCount ?? 0,
		]),
	);

	const isLoading = !configData;

	return (
		<div className="mailbox-hub min-h-screen">
			<main className="relative mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-20 lg:py-28">
				<header className="mb-10 text-center sm:mb-12">
					<div className="relative">
						<h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
							Mailboxes
						</h1>
						<div className="mt-6 sm:absolute sm:right-0 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2">
							<Button
								variant="primary"
								icon={<PlusIcon size={16} />}
								onClick={() => setIsCreateOpen(true)}
							>
								Add Mailbox
							</Button>
						</div>
					</div>
					<p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
						Choose an inbox to read, compose, and manage mail.
					</p>
				</header>

				{isLoading ? (
					<div className="flex justify-center py-24">
						<Loader size="lg" />
					</div>
				) : accounts.length > 0 ? (
					<div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
						{accounts.map((account, idx) => {
							const domain = account.email.split("@")[1] || account.email;
							const theme = mailboxThemes[idx % mailboxThemes.length];
							const unreadCount = unreadByMailbox.get(account.id) ?? 0;

							return (
								<RouterLink
									key={account.id}
									to={`/mailbox/${account.id}`}
									aria-label={`Open ${account.email}${unreadCount > 0 ? `, ${unreadCount} unread ${unreadCount === 1 ? "email" : "emails"}` : ""}`}
									className="mailbox-card group relative flex min-h-36 items-center gap-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-5 no-underline outline-none sm:gap-5 sm:p-6"
								>
									<div className="relative shrink-0">
										<div
											className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold ring-1 sm:h-16 sm:w-16 sm:text-xl ${theme.avatar}`}
										>
											{account.name.charAt(0).toUpperCase()}
										</div>
										{unreadCount > 0 && (
											<>
												<span
													aria-hidden="true"
													className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-[3px] border-white bg-blue-500 shadow-sm"
												/>
												<span className="sr-only">
													{unreadCount} unread {unreadCount === 1 ? "email" : "emails"}
												</span>
											</>
										)}
									</div>
									<div className="min-w-0 flex-1">
										<div className="truncate text-base font-semibold text-slate-950 sm:text-lg">
											{account.name}
										</div>
										<div className="mt-1 truncate text-sm text-slate-600 sm:text-base">
											{account.email}
										</div>
										<div className="mt-1.5 truncate text-xs font-medium text-slate-400 sm:text-sm">
											{domain}
										</div>
									</div>
									<ArrowRightIcon
										size={22}
										weight="bold"
										aria-hidden="true"
										className={`shrink-0 transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1 ${theme.arrow}`}
									/>
								</RouterLink>
							);
						})}
					</div>
				) : (
					<div className="mailbox-card rounded-2xl border border-slate-200/90 bg-white/90 px-6 py-16">
						<div className="flex flex-col items-center text-center">
							<div className="mb-4">
								<EnvelopeIcon
									size={48}
									weight="thin"
									className="text-kumo-subtle"
								/>
							</div>
							<h3 className="text-base font-semibold text-kumo-default mb-1.5">
								No mailboxes yet
							</h3>
							<p className="text-sm text-kumo-subtle max-w-sm mb-5">
								Add an address on one of your approved domains to start sending and receiving email.
							</p>
							<Button
								variant="primary"
								icon={<PlusIcon size={16} />}
								onClick={() => setIsCreateOpen(true)}
							>
								Add Mailbox
							</Button>
						</div>
					</div>
				)}
			</main>

			{/* Create Dialog */}
			<Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-2">
						Add Mailbox
					</Dialog.Title>
					<Dialog.Description className="mb-5 text-sm text-kumo-subtle">
						The address will be routed to this inbox automatically.
					</Dialog.Description>
					<form onSubmit={handleCreate} className="space-y-4">
						{createError && (
							<Text variant="error" size="sm">
								{createError}
							</Text>
						)}
						<div>
							<span className="text-sm font-medium text-kumo-default mb-1.5 block">
								Email Address
							</span>
							<div className="flex items-center gap-2">
								<div className="flex-1">
									<Input
										aria-label="Address prefix"
										placeholder="info"
										size="sm"
										value={newPrefix}
										onChange={(e) => setNewPrefix(e.target.value)}
										maxLength={64}
										autoCapitalize="none"
										spellCheck={false}
										required
									/>
								</div>
								<span className="text-sm text-kumo-subtle">@</span>
								{domains.length > 1 ? (
									<div className="flex-1">
							<Select
								aria-label="Domain"
								value={selectedDomain}
								onValueChange={(value) => {
									if (value) setSelectedDomain(value);
								}}
							>
											{domains.map((d) => (
												<Select.Option key={d} value={d}>
													{d}
												</Select.Option>
											))}
										</Select>
									</div>
								) : (
									<span className="text-sm text-kumo-subtle">
										{selectedDomain || "no domain"}
									</span>
								)}
							</div>
						</div>
						<Input
							label="Display Name (optional)"
							placeholder="Info"
							size="sm"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						<div className="flex justify-end gap-2 pt-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary" size="sm">
										Cancel
									</Button>
								)}
							/>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={isCreating}
								disabled={!selectedDomain}
							>
								Add Mailbox
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}
