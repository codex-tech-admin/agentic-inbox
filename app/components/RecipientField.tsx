// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { XIcon } from "@phosphor-icons/react";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { useContacts } from "~/queries/contacts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRecipientValue(value: string) {
	const recipients: string[] = [];
	let query = "";
	const seen = new Set<string>();
	for (const rawPart of value.split(",")) {
		const part = rawPart.trim();
		if (!part) continue;
		const normalized = part.toLowerCase();
		if (EMAIL_PATTERN.test(normalized)) {
			if (!seen.has(normalized)) {
				seen.add(normalized);
				recipients.push(normalized);
			}
		} else {
			query = query ? `${query}, ${part}` : part;
		}
	}
	return { recipients, query };
}

function serializeRecipients(recipients: string[], query = "") {
	return [...recipients, query.trim()].filter(Boolean).join(", ");
}

interface RecipientFieldProps {
	label: string;
	mailboxId?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	layout?: "inline" | "stacked";
}

export default function RecipientField({
	label,
	mailboxId,
	value,
	onChange,
	placeholder = "Type a name or email",
	required = false,
	disabled = false,
	layout = "stacked",
}: RecipientFieldProps) {
	const inputId = useId();
	const listboxId = `${inputId}-suggestions`;
	const { recipients, query } = useMemo(() => parseRecipientValue(value), [value]);
	const deferredQuery = useDeferredValue(query.trim());
	const [isFocused, setIsFocused] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(0);
	const { data: contacts = [], isFetching } = useContacts(mailboxId, deferredQuery, {
		enabled: isFocused && deferredQuery.length > 0,
		limit: 8,
	});
	const suggestions = contacts.filter((contact) => !recipients.includes(contact.email));
	const showSuggestions = isFocused && query.trim().length > 0;

	const selectRecipient = (email: string) => {
		const normalized = email.trim().toLowerCase();
		if (!EMAIL_PATTERN.test(normalized)) return;
		onChange(serializeRecipients([...recipients, normalized]));
		setHighlightedIndex(0);
	};

	const removeRecipient = (email: string) => {
		onChange(serializeRecipients(recipients.filter((recipient) => recipient !== email), query));
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown" && suggestions.length > 0) {
			event.preventDefault();
			setHighlightedIndex((current) => (current + 1) % suggestions.length);
			return;
		}
		if (event.key === "ArrowUp" && suggestions.length > 0) {
			event.preventDefault();
			setHighlightedIndex((current) =>
				(current - 1 + suggestions.length) % suggestions.length,
			);
			return;
		}
		if (event.key === "Enter") {
			if (suggestions[highlightedIndex]) {
				event.preventDefault();
				selectRecipient(suggestions[highlightedIndex].email);
			} else if (EMAIL_PATTERN.test(query.trim())) {
				event.preventDefault();
				selectRecipient(query);
			}
			return;
		}
		if (event.key === ",") {
			event.preventDefault();
			if (EMAIL_PATTERN.test(query.trim())) selectRecipient(query);
			return;
		}
		if (event.key === "Backspace" && !query && recipients.length > 0) {
			removeRecipient(recipients[recipients.length - 1]);
		}
		if (event.key === "Escape") setIsFocused(false);
	};

	return (
		<div className={layout === "inline" ? "grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-2" : "space-y-1.5"}>
			<label
				htmlFor={inputId}
				className={layout === "inline"
					? "pt-2 text-sm font-medium text-kumo-subtle"
					: "block text-sm font-medium text-kumo-default"}
			>
				{label}
			</label>
			<div className="relative min-w-0">
				<div className="min-h-9 w-full flex flex-wrap items-center gap-1.5 rounded-md border border-kumo-line bg-kumo-base px-2 py-1.5 focus-within:border-kumo-ring focus-within:ring-1 focus-within:ring-kumo-ring">
					{recipients.map((recipient) => (
						<span key={recipient} className="inline-flex max-w-full items-center gap-1 rounded-full bg-kumo-fill px-2 py-0.5 text-xs text-kumo-default">
							<span className="truncate">{recipient}</span>
							<button
								type="button"
								onClick={() => removeRecipient(recipient)}
								className="rounded-full text-kumo-subtle hover:text-kumo-default"
								aria-label={`Remove ${recipient}`}
							>
								<XIcon size={12} />
							</button>
						</span>
					))}
					<input
						id={inputId}
						type="text"
						value={query}
						onChange={(event) => {
							onChange(serializeRecipients(recipients, event.target.value));
							setHighlightedIndex(0);
						}}
						onKeyDown={handleKeyDown}
						onFocus={() => setIsFocused(true)}
						onBlur={() => window.setTimeout(() => setIsFocused(false), 100)}
						placeholder={recipients.length === 0 ? placeholder : "Add another"}
						required={required && recipients.length === 0}
						disabled={disabled}
						role="combobox"
						aria-autocomplete="list"
						aria-expanded={showSuggestions}
						aria-controls={listboxId}
						aria-activedescendant={suggestions[highlightedIndex] ? `${listboxId}-${highlightedIndex}` : undefined}
						className="min-w-28 flex-1 border-0 bg-transparent py-0.5 text-sm text-kumo-default outline-none placeholder:text-kumo-subtle"
					/>
				</div>

				{showSuggestions && (
					<div
						id={listboxId}
						role="listbox"
						className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-kumo-line bg-kumo-base p-1 shadow-lg"
					>
						{suggestions.map((contact, index) => (
							<button
								key={contact.id}
								id={`${listboxId}-${index}`}
								type="button"
								role="option"
								aria-selected={index === highlightedIndex}
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => selectRecipient(contact.email)}
								className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${index === highlightedIndex ? "bg-kumo-fill" : "hover:bg-kumo-tint"}`}
							>
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kumo-fill text-xs font-semibold uppercase text-kumo-strong">
									{(contact.name || contact.email).charAt(0)}
								</div>
								<div className="min-w-0">
									<div className="truncate text-sm font-medium text-kumo-default">
										{contact.name || contact.email.split("@")[0]}
									</div>
									<div className="truncate text-xs text-kumo-subtle">{contact.email}</div>
								</div>
							</button>
						))}
						{!isFetching && suggestions.length === 0 && (
							<div className="px-3 py-2 text-xs text-kumo-subtle">
								No matching contacts. Enter a full email address to add it.
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
