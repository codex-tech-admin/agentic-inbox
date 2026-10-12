// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const folders = sqliteTable("folders", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
	is_deletable: integer("is_deletable").notNull().default(1),
});

export const emails = sqliteTable("emails", {
	id: text("id").primaryKey(),
	folder_id: text("folder_id")
		.notNull()
		.references(() => folders.id, { onDelete: "cascade" }),
	subject: text("subject"),
	sender: text("sender"),
	recipient: text("recipient"),
	cc: text("cc"),
	bcc: text("bcc"),
	date: text("date"),
	read: integer("read").default(0),
	starred: integer("starred").default(0),
	body: text("body"),
	in_reply_to: text("in_reply_to"),
	email_references: text("email_references"),
	thread_id: text("thread_id"),
	message_id: text("message_id"),
	raw_headers: text("raw_headers"),
	trashed_at: text("trashed_at"),
	previous_folder_id: text("previous_folder_id"),
	calendar_response: text("calendar_response"),
});

export const contacts = sqliteTable("contacts", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	name: text("name"),
	company: text("company"),
	notes: text("notes"),
	source: text("source").notNull().default("history"),
	favorite: integer("favorite").notNull().default(0),
	first_seen_at: text("first_seen_at"),
	last_seen_at: text("last_seen_at"),
	sent_count: integer("sent_count").notNull().default(0),
	received_count: integer("received_count").notNull().default(0),
	created_at: text("created_at").notNull(),
	updated_at: text("updated_at").notNull(),
});

export const attachments = sqliteTable("attachments", {
	id: text("id").primaryKey(),
	email_id: text("email_id")
		.notNull()
		.references(() => emails.id, { onDelete: "cascade" }),
	filename: text("filename").notNull(),
	mimetype: text("mimetype").notNull(),
	size: integer("size").notNull(),
	content_id: text("content_id"),
	disposition: text("disposition"),
});
