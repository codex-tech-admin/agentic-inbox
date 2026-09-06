import ICAL from "ical.js";
import type { CalendarInvite, CalendarPerson, CalendarResponse } from "../../shared/calendar";

interface ParsedCalendarInvite extends Omit<CalendarInvite, "attachmentId" | "attachmentFilename"> {
	calendar: InstanceType<typeof ICAL.Component>;
	eventComponent: InstanceType<typeof ICAL.Component>;
	attendeeProperty?: InstanceType<typeof ICAL.Property>;
}

const RESPONSE_TO_PARTSTAT: Record<CalendarResponse, string> = {
	accepted: "ACCEPTED",
	tentative: "TENTATIVE",
	declined: "DECLINED",
};

function addressFromValue(value: unknown): string {
	return String(value ?? "").replace(/^mailto:/i, "").trim().toLowerCase();
}

function propertyPerson(property: InstanceType<typeof ICAL.Property>): CalendarPerson {
	const email = addressFromValue(property.getFirstValue());
	const name = property.getFirstParameter("cn") || undefined;
	const partstat = property.getFirstParameter("partstat")?.toUpperCase() || undefined;
	return { email, ...(name ? { name } : {}), ...(partstat ? { partstat } : {}) };
}

function stringValue(component: InstanceType<typeof ICAL.Component>, name: string): string | undefined {
	const value = component.getFirstPropertyValue(name);
	if (value === null || value === undefined) return undefined;
	const text = String(value).trim();
	return text || undefined;
}

function findMeetingUrl(...values: Array<string | undefined>): string | undefined {
	const text = values.filter(Boolean).join("\n");
	const preferred = text.match(/https?:\/\/[^\s<>"']+(?:teams\.microsoft\.com|meet\.google\.com|zoom\.us)[^\s<>"']*/i);
	if (preferred) return preferred[0].replace(/[),.;]+$/, "");
	const anyUrl = text.match(/https?:\/\/[^\s<>"']+/i);
	return anyUrl?.[0].replace(/[),.;]+$/, "");
}

function calendarTimeToIso(time: ICAL.Time): string {
	return time.toJSDate().toISOString();
}

export function parseCalendarInvite(ics: string, mailboxId: string, emailBody?: string): ParsedCalendarInvite {
	const calendar = new ICAL.Component(ICAL.parse(ics));
	const eventComponent = calendar.getFirstSubcomponent("vevent");
	if (!eventComponent) throw new Error("Calendar attachment does not contain an event");

	const event = new ICAL.Event(eventComponent);
	const organizerProperty = eventComponent.getFirstProperty("organizer");
	if (!organizerProperty) throw new Error("Calendar invitation has no organizer");

	const attendeeProperties = eventComponent.getAllProperties("attendee");
	const mailboxAddress = mailboxId.toLowerCase();
	const attendeeProperty = attendeeProperties.find(
		(property) => addressFromValue(property.getFirstValue()) === mailboxAddress,
	);
	const attendees = attendeeProperties.map(propertyPerson);
	const method = (stringValue(calendar, "method") || "PUBLISH").toUpperCase();
	const status = stringValue(eventComponent, "status")?.toUpperCase();
	const description = stringValue(eventComponent, "description");
	const location = stringValue(eventComponent, "location");
	const explicitUrl = stringValue(eventComponent, "url");
	const timezone = event.startDate.zone?.tzid;
	const attendeePartstat = attendeeProperty?.getFirstParameter("partstat")?.toUpperCase();
	const attendeeResponse = attendeePartstat === "ACCEPTED"
		? "accepted"
		: attendeePartstat === "TENTATIVE"
			? "tentative"
			: attendeePartstat === "DECLINED"
				? "declined"
				: undefined;

	return {
		calendar,
		eventComponent,
		...(attendeeProperty ? { attendeeProperty } : {}),
		uid: event.uid,
		method,
		...(status ? { status } : {}),
		summary: event.summary || "Calendar invitation",
		...(description ? { description } : {}),
		...(location ? { location } : {}),
		...(findMeetingUrl(explicitUrl, location, description, emailBody) ? {
			meetingUrl: findMeetingUrl(explicitUrl, location, description, emailBody),
		} : {}),
		start: calendarTimeToIso(event.startDate),
		end: calendarTimeToIso(event.endDate),
		allDay: event.startDate.isDate,
		...(timezone && timezone !== "floating" ? { timezone } : {}),
		organizer: propertyPerson(organizerProperty),
		attendees,
		...(attendeeResponse ? { response: attendeeResponse } : {}),
		canRespond: method === "REQUEST" && status !== "CANCELLED" && Boolean(attendeeProperty),
	};
}

function cloneProperty(property: InstanceType<typeof ICAL.Property>): InstanceType<typeof ICAL.Property> {
	return new ICAL.Property(structuredClone(property.toJSON()));
}

export function buildCalendarReply(
	parsed: ParsedCalendarInvite,
	response: CalendarResponse,
	mailboxId: string,
	displayName?: string,
): string {
	if (!parsed.attendeeProperty) throw new Error("Mailbox is not an attendee on this invitation");

	const calendar = new ICAL.Component("vcalendar");
	calendar.addPropertyWithValue("prodid", "-//Raihan Agentic Inbox//Calendar RSVP//EN");
	calendar.addPropertyWithValue("version", "2.0");
	calendar.addPropertyWithValue("method", "REPLY");

	const replyEvent = new ICAL.Component("vevent");
	for (const name of ["uid", "sequence", "recurrence-id", "dtstart", "dtend", "duration", "summary", "organizer"]) {
		const property = parsed.eventComponent.getFirstProperty(name);
		if (property) replyEvent.addProperty(cloneProperty(property));
	}
	replyEvent.updatePropertyWithValue("dtstamp", ICAL.Time.fromJSDate(new Date(), true));

	const attendee = cloneProperty(parsed.attendeeProperty);
	attendee.setValue(`mailto:${mailboxId.toLowerCase()}`);
	attendee.setParameter("partstat", RESPONSE_TO_PARTSTAT[response]);
	attendee.setParameter("rsvp", "FALSE");
	if (displayName) attendee.setParameter("cn", displayName);
	replyEvent.addProperty(attendee);
	calendar.addSubcomponent(replyEvent);

	return calendar.toString();
}

export function responseLabel(response: CalendarResponse): string {
	return response === "accepted" ? "Accepted" : response === "tentative" ? "Tentative" : "Declined";
}

export function encodeUtf8Base64(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	}
	return btoa(binary);
}
