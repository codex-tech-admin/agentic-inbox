export type AutoDraftDecision = {
	shouldDraft: boolean;
	category:
		| "self_message"
		| "blank_message"
		| "automated_sender"
		| "application_confirmation"
		| "verification"
		| "application_status"
		| "assessment_notification"
		| "bulk_notification"
		| "reply_requested"
		| "human_question"
		| "no_reply_needed";
	reason: string;
};

/**
 * Decide whether an inbound career email is sufficiently likely to need a
 * human reply before spending AI tokens or creating a draft. This policy is
 * deliberately conservative: uncertain and informational mail stays visible
 * in the inbox, but does not create draft clutter.
 */
export function classifyAutoDraft(input: {
	mailboxId: string;
	sender: string;
	subject: string;
	body: string;
}): AutoDraftDecision {
	const sender = input.sender.trim().toLowerCase();
	const mailboxId = input.mailboxId.trim().toLowerCase();
	const addressMatch = sender.match(/<([^>]+)>/);
	const senderAddress = (addressMatch?.[1] ?? sender).trim();
	const localPart = senderAddress.split("@")[0] ?? "";
	const subject = input.subject.trim().toLowerCase();
	const body = input.body.replace(/\s+/g, " ").trim().toLowerCase();
	const content = `${subject}\n${body}`;

	if (senderAddress === mailboxId) {
		return { shouldDraft: false, category: "self_message", reason: "Message was sent by this mailbox." };
	}

	if (!body) {
		return { shouldDraft: false, category: "blank_message", reason: "Blank messages do not need an automatic reply." };
	}

	if (/^(?:no[._-]?reply|do[._-]?not[._-]?reply|donotreply|mailer[._-]?daemon|postmaster|notifications?|alerts?|updates?)$/i.test(localPart)) {
		return { shouldDraft: false, category: "automated_sender", reason: "Sender address identifies an automated mailbox." };
	}

	if (/\b(?:application (?:has been )?(?:received|submitted)|we (?:have )?received your application|thank you for (?:applying|your application)|thanks for applying|application receipt|successfully applied|submission confirmation)\b/i.test(content)) {
		return { shouldDraft: false, category: "application_confirmation", reason: "Routine application confirmation." };
	}

	if (/\b(?:verify (?:your )?(?:email|account)|email verification|verification (?:code|link)|confirm your email|activate your account|one[ -]time (?:code|password)|otp)\b/i.test(content)) {
		return { shouldDraft: false, category: "verification", reason: "Verification messages require an action, not an email reply." };
	}

	if (/\b(?:unfortunately|not (?:be )?moving forward|will not (?:be )?progressing|other candidates|position has been filled|application (?:status|update)|status of your application|no longer under consideration|unsuccessful application)\b/i.test(content)) {
		return { shouldDraft: false, category: "application_status", reason: "Application status notifications are informational." };
	}

	if (/\b(?:assessment invitation|complete (?:the|your|this) assessment|coding (?:test|challenge|assessment)|online assessment|skills assessment|take the assessment)\b/i.test(content)) {
		return { shouldDraft: false, category: "assessment_notification", reason: "Assessment invitations require task tracking, not an email reply." };
	}

	if (/\b(?:unsubscribe|email preferences|view (?:this email )?in (?:your )?browser|automated (?:email|message)|please do not reply)\b/i.test(content)) {
		return { shouldDraft: false, category: "bulk_notification", reason: "Bulk or system notification." };
	}

	if (/\b(?:please (?:reply|respond|confirm)|kindly (?:reply|respond|confirm)|let me know|are you available|could you (?:confirm|send|share|let)|would you (?:be available|like to)|what (?:day|date|time)|schedule (?:a|the) (?:call|chat|interview)|book a time)\b/i.test(content)) {
		return { shouldDraft: true, category: "reply_requested", reason: "A human sender explicitly requested a response or scheduling coordination." };
	}

	if (body.includes("?")) {
		return { shouldDraft: true, category: "human_question", reason: "A non-automated sender asked a direct question." };
	}

	return { shouldDraft: false, category: "no_reply_needed", reason: "No explicit request for a reply was detected." };
}
