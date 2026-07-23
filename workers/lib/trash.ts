export const TRASH_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function getTrashPurgeCutoff(now = new Date()): string {
	return new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS).toISOString();
}

export function attachmentObjectKeys(
	attachments: Array<{ emailId: string; id: string; filename: string }>,
): string[] {
	return attachments.map(
		(attachment) =>
			`attachments/${attachment.emailId}/${attachment.id}/${attachment.filename}`,
	);
}
