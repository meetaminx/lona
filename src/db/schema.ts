import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const merchants = pgTable("merchants", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  businessName: text("business_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("merchants_email_idx").on(t.email)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settlementSettings = pgTable("settlement_settings", {
  merchantId: text("merchant_id").primaryKey().references(() => merchants.id, { onDelete: "cascade" }),
  assetKey: text("asset_key").notNull(),
  payoutAddress: text("payout_address").notNull(),
  refundAddress: text("refund_address").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  livemode: boolean("livemode").notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  last4: text("last4").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("api_keys_hash_idx").on(t.keyHash)]);

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  livemode: boolean("livemode").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("webhook_endpoints_merchant_idx").on(t.merchantId, t.livemode)]);

export const paymentLinks = pgTable("payment_links", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  livemode: boolean("livemode").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  amountCents: integer("amount_cents").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("payment_links_slug_idx").on(t.slug)]);

export type InvoiceStatus =
  | "open"
  | "awaiting_payment"
  | "payment_received"
  | "converting"
  | "paid_out"
  | "underpaid"
  | "refunded"
  | "failed"
  | "expired"
  | "canceled";

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  livemode: boolean("livemode").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  description: text("description").notNull(),
  reference: text("reference"),
  customerEmail: text("customer_email"),
  status: text("status").$type<InvoiceStatus>().notNull().default("open"),
  settlementAssetKey: text("settlement_asset_key").notNull(),
  payoutAddress: text("payout_address").notNull(),
  refundAddress: text("refund_address").notNull(),
  paymentLinkId: text("payment_link_id"),
  successUrl: text("success_url"),
  metadata: jsonb("metadata").$type<Record<string, string>>().notNull().default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  paidOutAt: timestamp("paid_out_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("invoices_merchant_idx").on(t.merchantId, t.livemode, t.createdAt)]);

export type ProviderStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "PROCESSING"
  | "SUCCESS"
  | "INCOMPLETE_DEPOSIT"
  | "REFUNDED"
  | "FAILED";

export type TxRef = { hash: string; explorerUrl?: string };

export const paymentAttempts = pgTable("payment_attempts", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  depositAddress: text("deposit_address").notNull(),
  depositMemo: text("deposit_memo"),
  amountInBase: text("amount_in_base").notNull(),
  amountInFormatted: text("amount_in_formatted").notNull(),
  amountOutBase: text("amount_out_base").notNull(),
  refundAddress: text("refund_address").notNull(),
  quoteDeadline: timestamp("quote_deadline", { withTimezone: true }).notNull(),
  providerStatus: text("provider_status").$type<ProviderStatus>().notNull().default("PENDING_DEPOSIT"),
  originTxs: jsonb("origin_txs").$type<TxRef[]>().notNull().default([]),
  destinationTxs: jsonb("destination_txs").$type<TxRef[]>().notNull().default([]),
  raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("payment_attempts_invoice_idx").on(t.invoiceId, t.createdAt),
  uniqueIndex("payment_attempts_deposit_idx").on(t.depositAddress),
]);

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  merchantId: text("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  livemode: boolean("livemode").notNull(),
  type: text("type").notNull(),
  invoiceId: text("invoice_id"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("webhook_events_merchant_idx").on(t.merchantId, t.livemode, t.createdAt)]);

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => webhookEvents.id, { onDelete: "cascade" }),
  endpointId: text("endpoint_id").notNull().references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  status: text("status").$type<"pending" | "succeeded" | "failed">().notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  lastResponseCode: integer("last_response_code"),
  lastError: text("last_error"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt)]);

export type Merchant = typeof merchants.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type PaymentLink = typeof paymentLinks.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type SettlementSettings = typeof settlementSettings.$inferSelect;
