import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

export interface CreateOrderParams {
  amountInr: number;
  accountId: string;
  planId?: string;
  receipt?: string;
}

export interface RazorpayOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

/**
 * Creates an order via Razorpay API using Basic Auth
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrderResult> {
  const keyId = process.env.RAZORPAY_KEY_ID || RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const amountPaise = Math.round(params.amountInr * 100);

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: params.receipt || `rcpt_${params.accountId.slice(0, 8)}_${Date.now()}`,
      notes: {
        accountId: params.accountId,
        planId: params.planId,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay Order creation failed: ${response.status} ${errorBody}`);
  }

  return (await response.json()) as RazorpayOrderResult;
}

export interface CreatePaymentLinkParams {
  amountInr: number;
  description: string;
  customer?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  notes?: Record<string, string>;
  callbackUrl?: string;
}

export interface RazorpayPaymentLinkResult {
  id: string;
  short_url: string;
  status: string;
  amount: number;
}

/**
 * Creates a dynamic payment link via Razorpay API using Basic Auth
 */
export async function createRazorpayPaymentLink(params: CreatePaymentLinkParams): Promise<RazorpayPaymentLinkResult> {
  const keyId = process.env.RAZORPAY_KEY_ID || RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const amountPaise = Math.round(params.amountInr * 100);

  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      description: params.description,
      customer: params.customer,
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: params.notes,
      callback_url: params.callbackUrl,
      callback_method: "get",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay Payment Link creation failed: ${response.status} ${errorBody}`);
  }

  return (await response.json()) as RazorpayPaymentLinkResult;
}

/**
 * Validates Razorpay client-side payment signature (orderId|paymentId)
 */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!RAZORPAY_KEY_SECRET) return false;

  const body = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf-8"),
      Buffer.from(params.signature, "utf-8")
    );
  } catch {
    return false;
  }
}

/**
 * Validates incoming webhook payload signature
 */
export function verifyRazorpayWebhookSignature(params: {
  payload: string;
  signature: string;
}): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET) return false;

  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(params.payload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf-8"),
      Buffer.from(params.signature, "utf-8")
    );
  } catch {
    return false;
  }
}

