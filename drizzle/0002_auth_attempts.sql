CREATE TABLE "auth_attempts" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"window" integer NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "auth_attempts_scope_key_window_pk" PRIMARY KEY("scope","key","window")
);
