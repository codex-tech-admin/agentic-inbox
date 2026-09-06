import { Badge, Button, useKumoToastManager } from "@cloudflare/kumo";
import {
	CalendarBlankIcon,
	CheckIcon,
	ClockIcon,
	DownloadSimpleIcon,
	MapPinIcon,
	QuestionIcon,
	UsersIcon,
	VideoCameraIcon,
	XIcon,
} from "@phosphor-icons/react";
import { isCalendarAttachment, type CalendarResponse } from "shared/calendar";
import { getAttachmentUrl } from "~/lib/utils";
import { useCalendarInvite, useRespondToCalendarInvite } from "~/queries/calendar";
import type { Email } from "~/types";

interface CalendarInviteCardProps {
	email: Email;
	mailboxId?: string;
}

const RESPONSE_LABELS: Record<CalendarResponse, string> = {
	accepted: "Accepted",
	tentative: "Tentative",
	declined: "Declined",
};

function formatEventTime(startIso: string, endIso: string, allDay: boolean): string {
	const start = new Date(startIso);
	const end = new Date(endIso);
	if (allDay) {
		return new Intl.DateTimeFormat("en-AU", {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		}).format(start);
	}

	const date = new Intl.DateTimeFormat("en-AU", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(start);
	const time = new Intl.DateTimeFormat("en-AU", {
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	});
	return `${date}, ${time.format(start)} to ${time.format(end)}`;
}

function personLabel(person: { name?: string; email: string }): string {
	return person.name ? `${person.name} (${person.email})` : person.email;
}

function CalendarInviteDetails({ email, mailboxId }: { email: Email; mailboxId: string }) {
	const rawCalendarAttachment = email.attachments?.find(isCalendarAttachment);
	const { data: invite, isLoading, error } = useCalendarInvite(
		mailboxId,
		email.id,
		true,
	);
	const responseMutation = useRespondToCalendarInvite();
	const toastManager = useKumoToastManager();

	if (isLoading) {
		return <div className="mt-4 h-32 animate-pulse rounded-lg border border-kumo-line bg-kumo-tint" />;
	}
	if (error || !invite) {
		return (
			<div className="mt-4 rounded-lg border border-kumo-warning/40 bg-kumo-warning/[0.06] p-4 text-sm text-kumo-default">
				<p>This calendar invitation could not be read.</p>
				{rawCalendarAttachment ? (
					<a href={getAttachmentUrl(mailboxId, email.id, rawCalendarAttachment.id)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-kumo-brand underline underline-offset-2">
						<DownloadSimpleIcon size={14} /> Download the attached invite
					</a>
				) : null}
			</div>
		);
	}

	const sendResponse = (response: CalendarResponse) => {
		responseMutation.mutate(
			{ mailboxId, emailId: email.id, response },
			{
				onSuccess: () => toastManager.add({ title: `${RESPONSE_LABELS[response]} response sent` }),
				onError: (mutationError) => toastManager.add({
					title: mutationError instanceof Error ? mutationError.message : "Calendar response could not be sent",
					variant: "error",
				}),
			},
		);
	};

	const isCancelled = invite.status === "CANCELLED";
	const downloadUrl = getAttachmentUrl(mailboxId, email.id, invite.attachmentId);

	return (
		<section className="mt-4 overflow-hidden rounded-lg border border-kumo-line bg-kumo-base" aria-label="Calendar invitation">
			<div className="flex items-start gap-3 border-b border-kumo-line bg-kumo-tint/60 px-4 py-3">
				<div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-kumo-brand text-kumo-inverse">
					<CalendarBlankIcon size={20} weight="bold" />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-base font-semibold text-kumo-default">{invite.summary}</h3>
						{isCancelled ? <Badge variant="error">Cancelled</Badge> : null}
						{invite.response ? (
							<Badge variant={invite.response === "declined" ? "error" : invite.response === "accepted" ? "success" : "warning"}>
								{RESPONSE_LABELS[invite.response]}
							</Badge>
						) : null}
					</div>
					<p className="mt-0.5 text-xs text-kumo-subtle">Invitation from {personLabel(invite.organizer)}</p>
				</div>
			</div>

			<div className="space-y-2.5 px-4 py-3 text-sm text-kumo-default">
				<div className="flex items-start gap-2.5">
					<ClockIcon size={17} className="mt-0.5 shrink-0 text-kumo-subtle" />
					<span>{formatEventTime(invite.start, invite.end, invite.allDay)}</span>
				</div>
				{invite.location ? (
					<div className="flex items-start gap-2.5">
						<MapPinIcon size={17} className="mt-0.5 shrink-0 text-kumo-subtle" />
						<span>{invite.location}</span>
					</div>
				) : null}
				{invite.meetingUrl ? (
					<div className="flex items-start gap-2.5">
						<VideoCameraIcon size={17} className="mt-0.5 shrink-0 text-kumo-subtle" />
						<a href={invite.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-kumo-brand underline underline-offset-2">
							Join online meeting
						</a>
					</div>
				) : null}
				{invite.attendees.length > 0 ? (
					<div className="flex items-start gap-2.5">
						<UsersIcon size={17} className="mt-0.5 shrink-0 text-kumo-subtle" />
						<span>{invite.attendees.length} attendee{invite.attendees.length === 1 ? "" : "s"}</span>
					</div>
				) : null}
			</div>

			<div className="flex flex-wrap items-center gap-2 border-t border-kumo-line px-4 py-3">
				{invite.canRespond && !isCancelled ? (
					<>
						<Button size="sm" variant={invite.response === "accepted" ? "primary" : "secondary"} icon={<CheckIcon size={14} />} loading={responseMutation.isPending && responseMutation.variables?.response === "accepted"} disabled={responseMutation.isPending || invite.response === "accepted"} onClick={() => sendResponse("accepted")}>Accept</Button>
						<Button size="sm" variant={invite.response === "tentative" ? "primary" : "secondary"} icon={<QuestionIcon size={14} />} loading={responseMutation.isPending && responseMutation.variables?.response === "tentative"} disabled={responseMutation.isPending || invite.response === "tentative"} onClick={() => sendResponse("tentative")}>Tentative</Button>
						<Button size="sm" variant={invite.response === "declined" ? "primary" : "secondary"} icon={<XIcon size={14} />} loading={responseMutation.isPending && responseMutation.variables?.response === "declined"} disabled={responseMutation.isPending || invite.response === "declined"} onClick={() => sendResponse("declined")}>Decline</Button>
					</>
				) : null}
				<a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1.5 text-xs text-kumo-subtle hover:text-kumo-default">
					<DownloadSimpleIcon size={14} /> Download invite
				</a>
			</div>
		</section>
	);
}

export default function CalendarInviteCard({ email, mailboxId }: CalendarInviteCardProps) {
	const hasCalendarAttachment = email.attachments?.some(isCalendarAttachment) ?? false;
	if (!hasCalendarAttachment || !mailboxId) return null;
	return <CalendarInviteDetails email={email} mailboxId={mailboxId} />;
}
