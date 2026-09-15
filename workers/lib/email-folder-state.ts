import { Folders } from "../../shared/folders";

export interface EmailFolderState {
	folder_id: string;
	previous_folder_id: string | null;
	trashed_at: string | null;
}

export function getMovedEmailFolderState(
	currentFolderId: string,
	previousFolderId: string | null,
	targetFolderId: string,
	now: string,
): EmailFolderState {
	if (targetFolderId === Folders.TRASH) {
		return {
			folder_id: targetFolderId,
			previous_folder_id:
				currentFolderId === Folders.TRASH
					? previousFolderId
					: currentFolderId,
			trashed_at: now,
		};
	}

	return {
		folder_id: targetFolderId,
		previous_folder_id: null,
		trashed_at: null,
	};
}
