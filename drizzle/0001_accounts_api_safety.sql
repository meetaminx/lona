CREATE TABLE "api_usage" (
	"key_id" text NOT NULL,
	"window" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_key_id_window_pk" PRIMARY KEY("key_id","window")
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"merchant_id" text NOT NULL,
	"livemode" boolean NOT NULL,
	"key" text NOT NULL,
	"path" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_merchant_id_livemode_key_pk" PRIMARY KEY("merchant_id","livemode","key")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "receipt_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "support_email" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "default_success_url" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "send_receipts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_tokens_merchant_idx" ON "auth_tokens" USING btree ("merchant_id","purpose");