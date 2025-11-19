CREATE TABLE `chats` (
	`id` integer PRIMARY KEY NOT NULL,
	`config` text,
	`mode` text DEFAULT 'FORM'
);
--> statement-breakpoint
CREATE TABLE `chat-admins` (
	`chat` integer NOT NULL,
	`user` integer NOT NULL,
	PRIMARY KEY(`chat`, `user`)
);
--> statement-breakpoint
CREATE TABLE `chat-permissions` (
	`id` integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `join-requests` (
	`chat` integer NOT NULL,
	`user` integer NOT NULL,
	`userChatId` integer NOT NULL,
	`userBio` text,
	`date` integer NOT NULL,
	`deadline` integer NOT NULL,
	`workflowId` text NOT NULL,
	PRIMARY KEY(`chat`, `user`)
);
--> statement-breakpoint
CREATE TABLE `join-responses` (
	`chat` integer,
	`user` integer,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`details` text NOT NULL,
	`date` integer NOT NULL,
	PRIMARY KEY(`chat`, `user`),
	FOREIGN KEY (`chat`,`user`) REFERENCES `join-requests`(`chat`,`user`) ON UPDATE no action ON DELETE cascade
);
