import { Folders } from "../../shared/folders";
import type { Email } from "~/types";

export type ThreadMessageState =
	| "received"
	| "sent"
	| "draft"
	| "discarded"
	| "trash";

export function getThreadMessageState(email: Email): ThreadMessageState {
	if (email.folder_id === Folders.DRAFT) return "draft";
	if (email.folder_id === Folders.SENT) return "sent";
	if (email.folder_id === Folders.TRASH) {
		return email.previous_folder_id === Folders.DRAFT
			? "discarded"
			: "trash";
	}
	return "received";
}

export function isThreadMessageVisibleInFolder(
	email: Email,
	currentFolder?: string,
): boolean {
	if (currentFolder === Folders.TRASH) {
		return email.folder_id === Folders.TRASH;
	}
	return email.folder_id !== Folders.TRASH;
}
