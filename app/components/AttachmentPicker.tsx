// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	FileIcon,
	PaperclipIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useRef, useState, type DragEvent } from "react";
import { formatAttachmentSize } from "../../shared/attachments";
import type { ComposeAttachment } from "~/lib/outbound-attachments";

interface AttachmentPickerProps {
	attachments: ComposeAttachment[];
	disabled?: boolean;
	onAdd: (files: File[]) => void;
	onRemove: (id: string) => void;
}

export default function AttachmentPicker({
	attachments,
	disabled = false,
	onAdd,
	onRemove,
}: AttachmentPickerProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragging(false);
		if (disabled) return;
		onAdd(Array.from(event.dataTransfer.files));
	};

	return (
		<div className="space-y-2">
			<div
				onDragEnter={(event) => {
					event.preventDefault();
					if (!disabled) setIsDragging(true);
				}}
				onDragOver={(event) => event.preventDefault()}
				onDragLeave={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
						setIsDragging(false);
					}
				}}
				onDrop={handleDrop}
				aria-label="Attachment drop zone"
				className={`flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2.5 transition-colors ${
					isDragging
						? "border-kumo-link bg-kumo-tint"
						: "border-kumo-line bg-kumo-fill/20"
				}`}
			>
				<div className="flex min-w-0 items-center gap-2.5">
					<PaperclipIcon size={18} className="shrink-0 text-kumo-subtle" />
					<div className="min-w-0">
						<p className="text-sm font-medium text-kumo-default">Attach files</p>
						<p className="text-xs text-kumo-subtle">Drop files here or choose from your computer</p>
					</div>
				</div>
				<input
					ref={inputRef}
					type="file"
					multiple
					className="sr-only"
					aria-label="Choose attachment files"
					disabled={disabled}
					onChange={(event) => {
						onAdd(Array.from(event.target.files ?? []));
						event.target.value = "";
					}}
				/>
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					disabled={disabled}
					className="shrink-0 rounded-md border border-kumo-line bg-kumo-base px-2.5 py-1.5 text-xs font-medium text-kumo-default hover:bg-kumo-fill disabled:cursor-not-allowed disabled:opacity-50"
				>
					Choose files
				</button>
			</div>

			{attachments.length > 0 ? (
				<ul className="space-y-1" aria-label="Attachments">
					{attachments.map((attachment) => (
						<li
							key={attachment.id}
							className="flex items-center gap-2 rounded-md border border-kumo-line bg-kumo-base px-2.5 py-2"
						>
							<FileIcon size={16} className="shrink-0 text-kumo-subtle" />
							<span className="min-w-0 flex-1 truncate text-sm text-kumo-default">
								{attachment.filename}
							</span>
							<span className="shrink-0 text-xs text-kumo-subtle">
								{formatAttachmentSize(attachment.size)}
							</span>
							<button
								type="button"
								disabled={disabled}
								onClick={() => onRemove(attachment.id)}
								aria-label={`Remove ${attachment.filename}`}
								className="rounded p-1 text-kumo-subtle hover:bg-kumo-fill hover:text-kumo-default disabled:cursor-not-allowed disabled:opacity-50"
							>
								<XIcon size={14} />
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
