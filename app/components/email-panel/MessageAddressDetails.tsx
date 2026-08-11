// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { formatDetailDate } from "~/lib/utils";
import type { Email } from "~/types";

interface SourceHeader {
	key?: string;
	name?: string;
	value?: unknown;
}

function getSourceHeader(email: Email, name: string) {
	if (!email.raw_headers) return undefined;

	try {
		const parsed: unknown = JSON.parse(email.raw_headers);
		if (Array.isArray(parsed)) {
			const header = (parsed as SourceHeader[]).find((entry) =>
				(entry.key || entry.name || "").toLowerCase() === name.toLowerCase(),
			);
			if (header?.value != null) return String(header.value);
		}
		if (typeof parsed === "object" && parsed !== null) {
			const entry = Object.entries(parsed).find(
				([key]) => key.toLowerCase() === name.toLowerCase(),
			);
			if (entry?.[1] != null) return String(entry[1]);
		}
	} catch {
		// Field-level values below remain available for malformed legacy headers.
	}

	return undefined;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
	if (!value) return null;

	return (
		<>
			<dt className="font-medium text-kumo-default">{label}</dt>
			<dd className="min-w-0 break-words text-kumo-subtle">{value}</dd>
		</>
	);
}

export default function MessageAddressDetails({ email }: { email: Email }) {
	const [showDetails, setShowDetails] = useState(false);
	const from = getSourceHeader(email, "from") || email.sender;
	const to = getSourceHeader(email, "to") || email.recipient;
	const cc = getSourceHeader(email, "cc") || email.cc;
	const bcc = getSourceHeader(email, "bcc") || email.bcc;
	const replyTo = getSourceHeader(email, "reply-to");

	return (
		<div className="mt-0.5 w-full text-xs">
			<div className="flex min-w-0 items-center gap-1 text-kumo-subtle">
				<span className="min-w-0 truncate">
					<span className="font-medium text-kumo-default">To:</span> {to}
				</span>
				<button
					type="button"
					onClick={() => setShowDetails((visible) => !visible)}
					aria-label={showDetails ? "Hide message details" : "Show message details"}
					aria-expanded={showDetails}
					className="shrink-0 rounded p-0.5 hover:bg-kumo-tint hover:text-kumo-default"
				>
					{showDetails ? <CaretUpIcon size={12} /> : <CaretDownIcon size={12} />}
				</button>
			</div>

			{cc ? (
				<div className="min-w-0 truncate text-kumo-subtle" title={cc}>
					<span className="font-medium text-kumo-default">Cc:</span> {cc}
				</div>
			) : null}
			{bcc ? (
				<div className="min-w-0 truncate text-kumo-subtle" title={bcc}>
					<span className="font-medium text-kumo-default">Bcc:</span> {bcc}
				</div>
			) : null}

			{showDetails ? (
				<dl className="mt-2 grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md border border-kumo-line bg-kumo-tint/40 p-2.5">
					<DetailRow label="From" value={from} />
					<DetailRow label="To" value={to} />
					<DetailRow label="Cc" value={cc} />
					<DetailRow label="Bcc" value={bcc} />
					<DetailRow label="Reply-To" value={replyTo} />
					<DetailRow label="Subject" value={email.subject} />
					<DetailRow label="Date" value={formatDetailDate(email.date)} />
				</dl>
			) : null}
		</div>
	);
}
