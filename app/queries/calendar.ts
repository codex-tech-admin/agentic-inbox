import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalendarInvite, CalendarResponse } from "shared/calendar";
import api from "~/services/api";
import { queryKeys } from "./keys";

export function useCalendarInvite(
	mailboxId: string | undefined,
	emailId: string,
	enabled: boolean,
) {
	return useQuery<CalendarInvite>({
		queryKey: mailboxId
			? queryKeys.emails.calendarInvite(mailboxId, emailId)
			: ["emails", "_disabled_calendar"],
		queryFn: () => api.getCalendarInvite(mailboxId!, emailId),
		enabled: Boolean(mailboxId) && enabled,
		retry: false,
	});
}

export function useRespondToCalendarInvite() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			mailboxId,
			emailId,
			response,
		}: {
			mailboxId: string;
			emailId: string;
			response: CalendarResponse;
		}) => api.respondToCalendarInvite(mailboxId, emailId, response),
		onSuccess: ({ invite }, { mailboxId, emailId }) => {
			queryClient.setQueryData(
				queryKeys.emails.calendarInvite(mailboxId, emailId),
				invite,
			);
			queryClient.invalidateQueries({ queryKey: ["emails", mailboxId] });
		},
	});
}
