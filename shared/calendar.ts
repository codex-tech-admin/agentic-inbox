export const calendarResponses = ["accepted", "tentative", "declined"] as const;

export type CalendarResponse = (typeof calendarResponses)[number];

export interface CalendarPerson {
	name?: string;
	email: string;
	partstat?: string;
}

export interface CalendarInvite {
	uid: string;
	method: string;
	status?: string;
	summary: string;
	description?: string;
	location?: string;
	meetingUrl?: string;
	start: string;
	end: string;
	allDay: boolean;
	timezone?: string;
	organizer: CalendarPerson;
	attendees: CalendarPerson[];
	response?: CalendarResponse;
	canRespond: boolean;
	attachmentId: string;
	attachmentFilename: string;
}

export interface CalendarAttachmentLike {
	filename?: string | null;
	mimetype?: string | null;
}

export function isCalendarAttachment(attachment: CalendarAttachmentLike): boolean {
	const mimetype = attachment.mimetype?.toLowerCase() ?? "";
	const filename = attachment.filename?.toLowerCase() ?? "";
	return mimetype.startsWith("text/calendar") ||
		mimetype.startsWith("application/ics") ||
		mimetype.startsWith("application/x-ical") ||
		filename.endsWith(".ics");
}
