import Stripe from "stripe";
import { supabaseAdmin } from "./supabase";
import { HARDCODED_CONFIG } from "./hardcoded-config";
import { getAssociateIdByEmail } from "./aoi-score-service";

// In-memory subscription cache — validated once per agent per 5 minutes
const subscriptionCache = new Map<string, { data: any; expiresAt: number }>();
const SUBSCRIPTION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type SubscriptionPlan = "starter" | "professional" | "elite";
export type SubscriptionStatus = "inactive" | "trialing" | "active" | "past_due" | "canceled";

export interface SubscriptionRecord {
  id: string;
  user_email: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_started_at: string | null;
  trial_expires_at: string | null;
  outbound_enabled: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EffectiveSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialActive: boolean;
  trialExpiresAt: string | null;
  outboundEnabled: boolean;
  hasActiveSubscription: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: number | null;
}

const PLAN_MINIMUM_FOR_OUTBOUND: SubscriptionPlan[] = ["professional", "elite"];

let stripe: Stripe | null = null;

const ensureStripe = () => {
  if (stripe) {
    return stripe;
  }

  if (!HARDCODED_CONFIG.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key not configured.");
  }

  stripe = new Stripe(HARDCODED_CONFIG.STRIPE_SECRET_KEY, {
    apiVersion: "2024-09-30.acacia",
  });

  return stripe;
};

const mapRecordToEffective = (record: SubscriptionRecord, currentPeriodEnd?: number | null): EffectiveSubscription => {
  const now = new Date();
  const trialExpiresAt = record.trial_expires_at ? new Date(record.trial_expires_at) : null;
  const trialActive = Boolean(trialExpiresAt && trialExpiresAt.getTime() > now.getTime());

  const hasActiveSubscription = trialActive || record.status === "active" || record.status === "trialing" || record.status === "past_due";
  const proOrEliteEligible = record.plan === "professional" || record.plan === "elite";

  return {
    plan: record.plan,
    status: record.status,
    trialActive,
    trialExpiresAt: record.trial_expires_at,
    outboundEnabled:
      record.outbound_enabled ||
      (proOrEliteEligible && hasActiveSubscription), // 🔥 FIX: Professional plans also get outbound enabled
    hasActiveSubscription,
    stripeCustomerId: record.stripe_customer_id,
    stripeSubscriptionId: record.stripe_subscription_id,
    currentPeriodEnd: currentPeriodEnd ?? null,
  };
};

const planPriceCache: Record<SubscriptionPlan, string | undefined> = {
  starter: HARDCODED_CONFIG.STRIPE_PRICE_STARTER,
  professional: HARDCODED_CONFIG.STRIPE_PRICE_PROFESSIONAL,
  elite: HARDCODED_CONFIG.STRIPE_PRICE_ELITE,
};

const PLAN_PRODUCT_NAMES: Record<SubscriptionPlan, string[]> = {
  starter: ["Call Connector Starter", "Call Connector Intro"],
  professional: ["Call Connector Pro", "Call Connector Professional"],
  elite: ["Call Connector Elite"],
};

/** Associate ID coupon: $55 off the first invoice only; must pair with first-time subscriber check */
export const CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS = 5500;
export const CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY = "usd";

export type AssociateDiscountValidation = {
  valid: boolean;
  discountPercent?: number;
  discountAmountOffCents?: number;
  discountCurrency?: string;
  /** Stripe Coupon id to pass to subscriptions.create (may be ccpro_<associateId>). */
  stripeCouponId?: string;
  error?: string;
};

async function userEligibleForFirstAssociateDiscount(userEmail: string): Promise<{ eligible: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { eligible: false, error: "Server configuration error" };
  }
  const normalized = userEmail.toLowerCase().trim();
  const { data, error } = await supabaseAdmin
    .from("connectnow_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_email", normalized)
    .maybeSingle();

  if (error) {
    console.warn("[userEligibleForFirstAssociateDiscount]", error);
    return { eligible: false, error: "Could not verify subscription history." };
  }

  if (!data) {
    return { eligible: true };
  }

  if (data.stripe_subscription_id) {
    return {
      eligible: false,
      error:
        "The Associate ID discount is only for your first Call Connector Pro subscription. This account already has a subscription on file.",
    };
  }

  if (data.status && data.status !== "inactive") {
    return {
      eligible: false,
      error:
        "The Associate ID discount is only for your first Call Connector Pro subscription. This account already has a subscription on file.",
    };
  }

  return { eligible: true };
}

function couponMatchesAssociatePromotion(coupon: Stripe.Coupon, associateIdForCoupon: string): boolean {
  const fixed =
    coupon.amount_off === CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS &&
    (coupon.currency || "usd").toLowerCase() === CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY;
  const legacyPercent = coupon.percent_off === 90;
  if (fixed || legacyPercent) {
    return true;
  }
  const metaAssoc = coupon.metadata?.associate_id;
  const purpose = coupon.metadata?.purpose;
  if (
    purpose === "ccpro_first_month" &&
    metaAssoc != null &&
    String(metaAssoc).trim() === String(associateIdForCoupon).trim()
  ) {
    return (
      coupon.duration === "once" &&
      (coupon.amount_off != null || coupon.percent_off != null)
    );
  }
  return false;
}

/** Resolve Associate ID for the logged-in email (customers, then producerlist). */
async function resolveAssociateIdForBillingDiscount(normalizedEmail: string): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }
  const fromCustomer = await getAssociateIdByEmail(normalizedEmail);
  if (fromCustomer != null && String(fromCustomer).trim() !== "") {
    return String(fromCustomer).trim();
  }
  const { data: prod } = await supabaseAdmin
    .from("producerlist")
    .select("associate_id")
    .ilike("company_email", normalizedEmail)
    .not("associate_id", "is", null)
    .maybeSingle();
  if (prod?.associate_id != null && String(prod.associate_id).trim() !== "") {
    return String(prod.associate_id).trim();
  }

  const { data: prodDirect, error: prodDirectErr } = await supabaseAdmin
    .from("producerlist")
    .select("associate_id")
    .eq("company_email", normalizedEmail)
    .not("associate_id", "is", null)
    .maybeSingle();
  if (prodDirectErr) {
    console.warn("[resolveAssociateIdForBillingDiscount] producerlist eq:", prodDirectErr.message);
  } else if (prodDirect?.associate_id != null && String(prodDirect.associate_id).trim() !== "") {
    return String(prodDirect.associate_id).trim();
  }

  const { data: fromProducers, error: producersErr } = await supabaseAdmin
    .from("producers")
    .select("associate_id")
    .ilike("email", normalizedEmail)
    .not("associate_id", "is", null)
    .maybeSingle();
  if (producersErr) {
    console.warn("[resolveAssociateIdForBillingDiscount] producers:", producersErr.message);
  } else if (fromProducers?.associate_id != null && String(fromProducers.associate_id).trim() !== "") {
    return String(fromProducers.associate_id).trim();
  }

  return null;
}

function sameAssociateIdEntered(resolved: string, entered: string): boolean {
  const a = resolved.trim();
  const b = entered.trim();
  if (a === b) return true;
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
    return parseInt(a, 10) === parseInt(b, 10);
  }
  return false;
}

function validationResultFromCoupon(coupon: Stripe.Coupon, codeNorm: string): AssociateDiscountValidation {
  const stripeCouponId = coupon.id;
  if (coupon.max_redemptions != null && coupon.times_redeemed >= coupon.max_redemptions) {
    return { valid: false, error: "This first-month discount was already used." };
  }
  if (!couponMatchesAssociatePromotion(coupon, codeNorm)) {
    console.warn("[validateDiscountCode] coupon shape/metadata mismatch for associate", codeNorm, {
      amount_off: coupon.amount_off,
      percent_off: coupon.percent_off,
      duration: coupon.duration,
      metadata: coupon.metadata,
    });
    return {
      valid: false,
      error:
        "This discount code is not active for the current promotion. Contact support if you need help.",
    };
  }
  if (
    coupon.amount_off === CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS &&
    (coupon.currency || "usd").toLowerCase() === CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY
  ) {
    return {
      valid: true,
      discountAmountOffCents: coupon.amount_off,
      discountCurrency: coupon.currency || CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY,
      stripeCouponId,
    };
  }
  return {
    valid: true,
    discountPercent: coupon.percent_off ?? undefined,
    discountAmountOffCents: coupon.amount_off ?? undefined,
    discountCurrency: coupon.currency ?? undefined,
    stripeCouponId,
  };
}

/** Stripe id max 40 chars; numeric-only ids sometimes fail — also use ccpro_<id>. */
function prefixedStripeCouponId(associateId: string): string {
  const t = associateId.trim();
  const safe = t.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
  return `ccpro_${safe || "x"}`;
}

function stripeCouponIdCandidates(associateId: string): string[] {
  const primary = associateId.trim();
  const alt = prefixedStripeCouponId(primary);
  const out = new Set<string>();
  if (primary.length > 0 && primary.length <= 40) {
    out.add(primary);
  }
  if (alt.length > 0 && alt.length <= 40) {
    out.add(alt);
  }
  return [...out];
}

async function tryRetrieveCoupon(stripeClient: Stripe, id: string): Promise<Stripe.Coupon | null> {
  try {
    const existing = await stripeClient.coupons.retrieve(id);
    if (existing && !(existing as { deleted?: boolean }).deleted) {
      return existing;
    }
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    const missing =
      err?.code === "resource_missing" || /no such coupon/i.test(String(err?.message ?? ""));
    if (!missing) {
      throw e;
    }
  }
  return null;
}

/**
 * Find or create coupon: try raw Associate ID, then ccpro_<id>. metadata.associate_id is always the real ID.
 */
async function retrieveOrCreateAssociateCoupon(stripeClient: Stripe, associateId: string): Promise<Stripe.Coupon> {
  const primaryAssoc = associateId.trim();
  const candidates = stripeCouponIdCandidates(primaryAssoc);

  for (const id of candidates) {
    const found = await tryRetrieveCoupon(stripeClient, id);
    if (found) {
      return found;
    }
  }

  const createBody = (stripeCouponId: string) => ({
    id: stripeCouponId,
    amount_off: CC_PRO_ASSOCIATE_DISCOUNT_AMOUNT_CENTS,
    currency: CC_PRO_ASSOCIATE_DISCOUNT_CURRENCY,
    duration: "once" as const,
    max_redemptions: 1,
    name: `CCPro $55 off first month (Associate ${primaryAssoc})`,
    metadata: { associate_id: primaryAssoc, purpose: "ccpro_first_month" },
  });

  let lastErr: unknown = null;
  for (const id of candidates) {
    try {
      const created = await stripeClient.coupons.create(createBody(id));
      console.log(`[retrieveOrCreateAssociateCoupon] created Stripe coupon id=${id} associate=${primaryAssoc}`);
      return created;
    } catch (createErr: unknown) {
      lastErr = createErr;
      const c = createErr as { code?: string; message?: string };
      const msg = String(c?.message ?? "");
      const duplicate =
        c?.code === "resource_already_exists" ||
        /already exists|already been taken|duplicate resource/i.test(msg);
      if (duplicate) {
        const again = await tryRetrieveCoupon(stripeClient, id);
        if (again) {
          return again;
        }
      }
      console.warn(`[retrieveOrCreateAssociateCoupon] create failed id=${id}:`, msg);
    }
  }

  const lastMsg = lastErr ? String((lastErr as { message?: string }).message ?? lastErr) : "unknown";
  console.error(`[retrieveOrCreateAssociateCoupon] all attempts failed associate=${primaryAssoc}:`, lastMsg);
  throw lastErr instanceof Error ? lastErr : new Error(lastMsg);
}

async function resolvePriceId(plan: SubscriptionPlan): Promise<string> {
  const cached = planPriceCache[plan];
  if (cached && !cached.toLowerCase().includes("placeholder")) {
    return cached;
  }

  const stripeClient = ensureStripe();
  const nameCandidates = PLAN_PRODUCT_NAMES[plan];

  const products = await stripeClient.products.list({ limit: 100, active: true });
  const product = products.data.find((item) => {
    const normalizedName = item.name?.toLowerCase?.() ?? "";
    return nameCandidates.some((candidate) => normalizedName.includes(candidate.toLowerCase()));
  });

  if (!product) {
    throw new Error(`Stripe product not found for plan ${plan}. Expected one of: ${nameCandidates.join(", ")}`);
  }

  let priceId: string | undefined;
  if (typeof product.default_price === "string") {
    priceId = product.default_price;
  } else if (product.default_price && typeof product.default_price === "object") {
    priceId = product.default_price.id;
  }

  if (!priceId) {
    const prices = await stripeClient.prices.list({ product: product.id, active: true, limit: 1 });
    priceId = prices.data[0]?.id;
  }

  if (!priceId) {
    throw new Error(`No active Stripe price found for plan ${plan} (product ${product.id}).`);
  }

  planPriceCache[plan] = priceId;
  return priceId;
}

export const SubscriptionService = {
  async createSetupIntent(
    userEmail: string,
    plan?: SubscriptionPlan
  ): Promise<{ clientSecret: string; setupIntentId: string }> {
    if (!userEmail) {
      throw new Error("User email is required to create setup intent.");
    }

    const stripeClient = ensureStripe();
    const customerId = await this.ensureStripeCustomer(userEmail);

    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        user_email: userEmail.toLowerCase(),
        context: "subscription_upgrade",
        plan: plan ?? "",
      },
    });

    if (!setupIntent.client_secret) {
      throw new Error("Stripe did not return a setup intent client secret.");
    }

    return {
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    };
  },

  async activateSubscription(params: {
    userEmail: string;
    plan: SubscriptionPlan;
    paymentMethodId: string;
    setupIntentId?: string | null;
    couponCode?: string;
  }): Promise<EffectiveSubscription> {
    const { userEmail, plan, paymentMethodId, couponCode } = params;

    if (!userEmail) {
      throw new Error("User email is required to activate subscription.");
    }

    if (!paymentMethodId) {
      throw new Error("Payment method ID is required to activate subscription.");
    }

    const stripeClient = ensureStripe();
    const customerId = await this.ensureStripeCustomer(userEmail);

    let stripeDiscountCouponId: string | undefined;
    if (couponCode?.trim()) {
      const discountCheck = await this.validateDiscountCode(couponCode.trim(), userEmail);
      if (!discountCheck.valid) {
        throw new Error(discountCheck.error || "Invalid discount code.");
      }
      stripeDiscountCouponId = discountCheck.stripeCouponId || couponCode.trim();
    }

    try {
      await stripeClient.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (error: any) {
      if (!error || error.code !== "resource_already_exists") {
        throw error;
      }
    }

    await stripeClient.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const priceId = await resolvePriceId(plan);

    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      metadata: {
        user_email: userEmail.toLowerCase(),
        plan,
        source: "embedded_checkout",
      },
    };
    if (stripeDiscountCouponId) {
      subscriptionParams.discounts = [{ coupon: stripeDiscountCouponId }];
    }
    let subscription: Stripe.Subscription;
    try {
      subscription = await stripeClient.subscriptions.create(subscriptionParams);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/coupon|discount|promotion/i.test(msg)) {
        console.error("[activateSubscription] Stripe rejected subscription with discount:", msg);
        throw new Error(
          "Stripe could not apply this discount on checkout. The coupon may be missing, expired, or already used. Contact support or try without a discount.",
        );
      }
      throw e;
    }

    const effective = await this.upsertFromStripe({
      userEmail,
      customerId,
      subscriptionId: subscription.id,
      plan,
      status: this.mapStripeStatus(subscription.status),
      trialStart: subscription.trial_start,
      trialEnd: subscription.trial_end,
      metadata: subscription.metadata ?? undefined,
    });

    return effective;
  },

  async validateDiscountCode(associateId: string, userEmail: string): Promise<AssociateDiscountValidation> {
    if (!supabaseAdmin) {
      return { valid: false, error: 'Server configuration error' };
    }

    const normalizedEmail = userEmail.toLowerCase().trim();
    if (!normalizedEmail || normalizedEmail === 'default@example.com') {
      return { valid: false, error: 'Sign in with your agent email to apply your Associate ID discount.' };
    }

    const codeNorm = String(associateId).trim();
    if (!codeNorm) {
      return { valid: false, error: 'Enter your Associate ID.' };
    }

    const firstTime = await userEligibleForFirstAssociateDiscount(normalizedEmail);
    if (!firstTime.eligible) {
      return { valid: false, error: firstTime.error };
    }

    const resolved = await resolveAssociateIdForBillingDiscount(normalizedEmail);

    if (!resolved) {
      return {
        valid: false,
        error:
          'No Associate ID is on file for this login. Use the same email as your AO Intelligence profile, or contact support.',
      };
    }

    if (!sameAssociateIdEntered(resolved, codeNorm)) {
      return {
        valid: false,
        error:
          'That Associate ID does not match this account. Enter the Associate ID tied to the email you are logged in with.',
      };
    }

    const stripeClient = ensureStripe();
    const couponId = codeNorm;
    try {
      const coupon = await retrieveOrCreateAssociateCoupon(stripeClient, couponId);
      return validationResultFromCoupon(coupon, codeNorm);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      console.warn("[validateDiscountCode] Stripe coupon retrieve/create failed:", err?.code, err?.message);
      return {
        valid: false,
        error:
          "Billing could not create or load this discount. Confirm Stripe is configured and try again, or contact support.",
      };
    }
  },

  /**
   * If this login has an Associate ID on file, is first-time eligible, and Stripe has a valid coupon,
   * returns valid + associateId so the client can apply the discount without typing it.
   */
  async autoDetectAssociateDiscount(userEmail: string): Promise<
    AssociateDiscountValidation & { associateId?: string }
  > {
    const normalizedEmail = userEmail.toLowerCase().trim();
    if (!normalizedEmail || normalizedEmail === "default@example.com") {
      return { valid: false };
    }

    const resolved = await resolveAssociateIdForBillingDiscount(normalizedEmail);
    if (!resolved) {
      return { valid: false };
    }

    const result = await this.validateDiscountCode(resolved, userEmail);
    if (!result.valid) {
      return result;
    }
    return { ...result, associateId: resolved };
  },

  async getOrCreateSubscription(userEmail: string): Promise<SubscriptionRecord> {
    if (!userEmail) {
      throw new Error("User email is required to fetch subscription.");
    }

    const { data, error } = await supabaseAdmin
      .from<SubscriptionRecord>("connectnow_subscriptions")
      .select("*")
      .eq("user_email", userEmail.toLowerCase())
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from<SubscriptionRecord>("connectnow_subscriptions")
      .insert({
        user_email: userEmail.toLowerCase(),
        plan: "starter",
        status: "inactive",
        outbound_enabled: false,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      throw insertError ?? new Error("Failed to insert subscription record");
    }

    return inserted;
  },

  async getEffectiveSubscription(userEmail: string): Promise<EffectiveSubscription> {
    // Check in-memory cache first — avoids hitting Supabase on every call event
    const cacheKey = userEmail.toLowerCase();
    const cached = subscriptionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const cacheAndReturn = (result: any) => {
      subscriptionCache.set(cacheKey, { data: result, expiresAt: Date.now() + SUBSCRIPTION_CACHE_TTL_MS });
      return result;
    };

    // 🔥 CRITICAL: Enable pro version for cnsysop
    if (userEmail?.toLowerCase() === 'cnsysop@aoglobelife.com') {
      const record = await this.getOrCreateSubscription(userEmail);
      return cacheAndReturn({
        ...mapRecordToEffective(record),
        plan: 'professional',
        hasActiveSubscription: true,
        outboundEnabled: true,
        status: 'active',
        currentPeriodEnd: null,
      });
    }
    
    // 🔥 HARDCODED: Enable pro version for nicolasmahaffy@aoglobelife.com
    if (userEmail?.toLowerCase() === 'nicolasmahaffy@aoglobelife.com') {
      const record = await this.getOrCreateSubscription(userEmail);
      return cacheAndReturn({
        ...mapRecordToEffective(record),
        plan: 'professional',
        hasActiveSubscription: true,
        outboundEnabled: true,
        status: 'active',
        currentPeriodEnd: null,
      });
    }
    
    const record = await this.getOrCreateSubscription(userEmail);
    const normalizedEmail = userEmail.toLowerCase();
    const stripeClient = ensureStripe();
    
    // 🔥 CRITICAL FIX: Always check Stripe directly by customer email, not just subscription ID
    // This ensures we catch active subscriptions even if database is missing/outdated
    try {
      // First, try to get customer ID from database or Stripe
      let customerId = record.stripe_customer_id;
      
      if (!customerId) {
        // Try to find customer by email in Stripe
        const customers = await stripeClient.customers.list({
          email: normalizedEmail,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
          // Update database with customer ID for future lookups
          await supabaseAdmin
            .from("connectnow_subscriptions")
            .update({ stripe_customer_id: customerId })
            .eq("id", record.id);
        }
      }
      
      // If we have a customer ID, check for active subscriptions
      if (customerId) {
        const stripeSubscriptions = await stripeClient.subscriptions.list({
          customer: customerId,
          status: 'all', // Get all statuses (active, trialing, past_due, etc.)
          limit: 10
        });
        
        // Find the most recent active/trialing subscription
        const activeSubscription = stripeSubscriptions.data.find(sub => {
          const status = sub.status;
          return status === 'active' || status === 'trialing' || status === 'past_due';
        });
        
        if (activeSubscription) {
          const planId = activeSubscription.items.data[0]?.price.id;
          const plan = this.planFromPriceId(planId);
          
          if (plan && (plan === 'professional' || plan === 'elite')) {
            const status = this.mapStripeStatus(activeSubscription.status);
            
            console.log(`✅ Found active Stripe subscription for ${normalizedEmail}: plan=${plan}, status=${status}`);
            
            // Update database with latest Stripe data
            const stripeResult = await this.upsertFromStripe({
              userEmail,
              customerId: customerId,
              subscriptionId: activeSubscription.id,
              plan,
              status,
              trialStart: activeSubscription.trial_start,
              trialEnd: activeSubscription.trial_end,
              currentPeriodEnd: activeSubscription.current_period_end,
              metadata: activeSubscription.metadata ?? undefined,
            });
            return cacheAndReturn(stripeResult);
          }
        }
      }
      
      // Fallback: If we have a subscription ID in database, try to retrieve it
      if (record.stripe_subscription_id) {
        try {
          const stripeSubscription = await stripeClient.subscriptions.retrieve(record.stripe_subscription_id);
          
          const planId = stripeSubscription.items.data[0]?.price.id;
          const plan = this.planFromPriceId(planId);
          
          if (plan) {
            const status = this.mapStripeStatus(stripeSubscription.status);
            
            // Update database with latest Stripe data
            return await this.upsertFromStripe({
              userEmail,
              customerId: typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : undefined,
              subscriptionId: stripeSubscription.id,
              plan,
              status,
              trialStart: stripeSubscription.trial_start,
              trialEnd: stripeSubscription.trial_end,
              currentPeriodEnd: stripeSubscription.current_period_end,
              metadata: stripeSubscription.metadata ?? undefined,
            });
          }
        } catch (error: any) {
          console.error(`⚠️ Failed to retrieve subscription ${record.stripe_subscription_id} from Stripe for ${userEmail}:`, error?.message || error);
          // Continue to return database record
        }
      }
    } catch (error: any) {
      console.error(`⚠️ Error checking Stripe subscriptions for ${userEmail}:`, error?.message || error);
      // Fall through to return database record if Stripe check fails
    }
    
    // Return database record as final fallback
    const result = mapRecordToEffective(record);
    subscriptionCache.set(cacheKey, { data: result, expiresAt: Date.now() + SUBSCRIPTION_CACHE_TTL_MS });
    return result;
  },

  async startTrial(userEmail: string, days: number): Promise<EffectiveSubscription> {
    const base = await this.getOrCreateSubscription(userEmail);
    const now = new Date();
    const trialExpiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from<SubscriptionRecord>("connectnow_subscriptions")
      .update({
        status: "trialing",
        trial_started_at: now.toISOString(),
        trial_expires_at: trialExpiresAt.toISOString(),
        outbound_enabled: true,
      })
      .eq("id", base.id)
      .select("*")
      .single();

    if (error || !data) {
      throw error ?? new Error("Failed to start trial");
    }

    // 🔥 CRITICAL: Sync CCPRO flag to customers table based on trial plan
    // CCPRO = true if trial is for professional or elite plan
    const ccproEnabled = 
      (data.plan === "professional" || data.plan === "elite");

    try {
      const { error: customerUpdateError } = await supabaseAdmin
        .from("customers")
        .update({ CCPRO: ccproEnabled })
        .eq("company_email", userEmail.toLowerCase());

      if (customerUpdateError) {
        console.error(`⚠️ Failed to update customers.CCPRO for ${userEmail} (trial):`, customerUpdateError);
      } else {
        console.log(`✅ Updated customers.CCPRO = ${ccproEnabled} for ${userEmail} (trial, plan: ${data.plan})`);
      }
    } catch (customerError) {
      console.error(`⚠️ Exception updating customers.CCPRO for ${userEmail} (trial):`, customerError);
    }

    return {
      ...mapRecordToEffective(data),
      currentPeriodEnd: payload.currentPeriodEnd ?? null,
    };
  },

  async upsertFromStripe(payload: {
    userEmail: string;
    customerId?: string;
    subscriptionId?: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    trialStart?: number | null;
    trialEnd?: number | null;
    currentPeriodEnd?: number | null;
    metadata?: Record<string, unknown>;
  }): Promise<EffectiveSubscription> {
    const record = await this.getOrCreateSubscription(payload.userEmail);

    const trialStartedAt =
      payload.trialStart != null ? new Date(payload.trialStart * 1000).toISOString() : record.trial_started_at;
    const trialExpiresAt =
      payload.trialEnd != null ? new Date(payload.trialEnd * 1000).toISOString() : record.trial_expires_at;

    const { data, error } = await supabaseAdmin
      .from<SubscriptionRecord>("connectnow_subscriptions")
      .update({
        plan: payload.plan,
        status: payload.status,
        stripe_customer_id: payload.customerId ?? record.stripe_customer_id,
        stripe_subscription_id: payload.subscriptionId ?? record.stripe_subscription_id,
        trial_started_at: trialStartedAt,
        trial_expires_at: trialExpiresAt,
        outbound_enabled:
          (payload.status === "active" && (payload.plan === "professional" || payload.plan === "elite")) ||
          (payload.status === "trialing" && (payload.plan === "professional" || payload.plan === "elite")) ||
          (payload.status === "past_due" && (payload.plan === "professional" || payload.plan === "elite")),
        metadata: payload.metadata ?? record.metadata,
      })
      .eq("id", record.id)
      .select("*")
      .single();

    if (error || !data) {
      throw error ?? new Error("Failed to persist subscription update");
    }

    // 🔥 CRITICAL: Sync CCPRO flag to customers table based on Stripe subscription
    // CCPRO = true if user has active/trialing professional or elite plan
    const ccproEnabled = 
      (payload.status === "active" || payload.status === "trialing" || payload.status === "past_due") &&
      (payload.plan === "professional" || payload.plan === "elite");

    try {
      const { error: customerUpdateError } = await supabaseAdmin
        .from("customers")
        .update({ CCPRO: ccproEnabled })
        .eq("company_email", payload.userEmail.toLowerCase());

      if (customerUpdateError) {
        console.error(`⚠️ Failed to update customers.CCPRO for ${payload.userEmail}:`, customerUpdateError);
        // Don't throw - subscription update succeeded, customer table update is secondary
      } else {
        console.log(`✅ Updated customers.CCPRO = ${ccproEnabled} for ${payload.userEmail} (plan: ${payload.plan}, status: ${payload.status})`);
      }
    } catch (customerError) {
      console.error(`⚠️ Exception updating customers.CCPRO for ${payload.userEmail}:`, customerError);
      // Don't throw - subscription update succeeded
    }

    return {
      ...mapRecordToEffective(data),
      currentPeriodEnd: payload.currentPeriodEnd ?? null,
    };
  },

  async ensureStripeCustomer(userEmail: string): Promise<string> {
    const record = await this.getOrCreateSubscription(userEmail);
    if (record.stripe_customer_id) {
      return record.stripe_customer_id;
    }

    const stripeClient = ensureStripe();
    const normalizedEmail = userEmail.toLowerCase();
    
    // Check if a Stripe customer already exists with this email to prevent duplicates
    const existingCustomers = await stripeClient.customers.list({
      email: normalizedEmail,
      limit: 1
    });

    let customerId: string;
    
    if (existingCustomers.data.length > 0) {
      // Use existing customer to prevent duplicates
      customerId = existingCustomers.data[0].id;
      console.log(`✅ Found existing Stripe customer for ${normalizedEmail}: ${customerId}`);
    } else {
      // Create new customer only if none exists
      const customer = await stripeClient.customers.create({
        email: normalizedEmail,
        metadata: {
          user_email: normalizedEmail,
        },
      });
      customerId = customer.id;
      console.log(`✅ Created new Stripe customer for ${normalizedEmail}: ${customerId}`);
    }

    // Update our database record with the customer ID
    const { error } = await supabaseAdmin
      .from("connectnow_subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("id", record.id);

    if (error) {
      throw error;
    }

    return customerId;
  },

  async createCheckoutSession(params: {
    userEmail: string;
    plan: SubscriptionPlan;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const normalizedEmail = params.userEmail.toLowerCase();
    
    // Check if user already has an active Call Connector Pro subscription (professional or elite)
    // Prevent multiple subscriptions
    const existingSubscription = await this.getEffectiveSubscription(normalizedEmail);
    
    if (existingSubscription.hasActiveSubscription && 
        (existingSubscription.plan === 'professional' || existingSubscription.plan === 'elite')) {
      throw new Error(
        `You already have an active Call Connector Pro subscription (${existingSubscription.plan}). ` +
        `Only one subscription is allowed per account. Please cancel your current subscription before creating a new one.`
      );
    }

    // Also check Stripe directly for any active subscriptions
    const stripeClient = ensureStripe();
    const customerId = await this.ensureStripeCustomer(normalizedEmail);
    
    // Check for active or trialing subscriptions
    const stripeSubscriptions = await stripeClient.subscriptions.list({
      customer: customerId,
      status: 'all', // Get all statuses to check active/trialing
      limit: 10
    });

    // Check if there are any active professional/elite subscriptions in Stripe
    const hasActiveStripeSubscription = stripeSubscriptions.data.some(sub => {
      const status = sub.status;
      const isActiveOrTrialing = status === 'active' || status === 'trialing';
      
      if (!isActiveOrTrialing) return false;
      
      // Check metadata for plan type
      const plan = sub.metadata?.plan;
      if (plan === 'professional' || plan === 'elite') {
        return true;
      }
      
      // Check price ID against known professional/elite prices
      const priceId = sub.items.data[0]?.price.id;
      if (priceId) {
        const proPriceId = planPriceCache.professional;
        const elitePriceId = planPriceCache.elite;
        if (proPriceId && priceId === proPriceId) return true;
        if (elitePriceId && priceId === elitePriceId) return true;
      }
      
      return false;
    });

    if (hasActiveStripeSubscription) {
      throw new Error(
        `You already have an active Call Connector Pro subscription in Stripe. ` +
        `Only one subscription is allowed per account. Please cancel your current subscription before creating a new one.`
      );
    }

    const priceId = await resolvePriceId(params.plan);

    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: normalizedEmail,
      metadata: {
        user_email: normalizedEmail,
        plan: params.plan,
      },
      subscription_data: {
        metadata: {
          user_email: normalizedEmail,
          plan: params.plan,
        },
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
    });

    if (!session.url) {
      throw new Error("Failed to create Stripe checkout session");
    }

    return session.url;
  },

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const planId = subscription.items.data[0]?.price.id;

        const plan = this.planFromPriceId(planId);
        if (!plan) {
          console.warn(`⚠️ Unknown Stripe price ${planId}; skipping subscription sync.`);
          return;
        }

        const userEmail =
          (subscription.metadata?.user_email as string | undefined) ||
          (subscription.customer_email as string | undefined) ||
          (subscription.customer as string | undefined);

        if (!userEmail) {
          console.error("❌ Unable to resolve user email from subscription event.");
          return;
        }

        const status = this.mapStripeStatus(subscription.status);

        await this.upsertFromStripe({
          userEmail,
          customerId: typeof subscription.customer === "string" ? subscription.customer : undefined,
          subscriptionId: subscription.id,
          plan,
          status,
          trialStart: subscription.trial_start,
          trialEnd: subscription.trial_end,
          currentPeriodEnd: subscription.current_period_end,
          metadata: subscription.metadata ?? undefined,
        });

        break;
      }
      default:
        break;
    }
  },

  planFromPriceId(priceId?: string | null): SubscriptionPlan | undefined {
    const entries = Object.entries(planPriceCache) as [SubscriptionPlan, string | undefined][];
    for (const [plan, id] of entries) {
      if (id && id === priceId) {
        return plan;
      }
    }
    return undefined;
  },

  mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case "trialing":
        return "trialing";
      case "active":
        return "active";
      case "past_due":
        return "past_due";
      case "canceled":
      case "unpaid":
      case "incomplete_expired":
      case "incomplete":
        return "canceled";
      default:
        return "inactive";
    }
  },

  async cancelSubscription(userEmail: string): Promise<EffectiveSubscription> {
    if (!userEmail) {
      throw new Error("User email is required to cancel subscription.");
    }

    const record = await this.getOrCreateSubscription(userEmail);

    if (!record.stripe_subscription_id) {
      // No Stripe subscription to cancel, just update database
      const { data, error } = await supabaseAdmin
        .from<SubscriptionRecord>("connectnow_subscriptions")
        .update({
          status: "inactive",
          outbound_enabled: false,
        })
        .eq("id", record.id)
        .select("*")
        .single();

      if (error || !data) {
        throw error ?? new Error("Failed to cancel subscription");
      }

      // Update CCPRO flag
      try {
        await supabaseAdmin
          .from("customers")
          .update({ CCPRO: false })
          .eq("company_email", userEmail.toLowerCase());
      } catch (error) {
        console.error("⚠️ Failed to update customers.CCPRO:", error);
      }

      return mapRecordToEffective(data);
    }

    // Cancel Stripe subscription
    const stripeClient = ensureStripe();
    
    try {
      const subscription = await stripeClient.subscriptions.cancel(record.stripe_subscription_id);
      
      console.log(`✅ Stripe subscription canceled: ${subscription.id}`);
      
      // Update database
      const status = this.mapStripeStatus(subscription.status);
      const { data, error } = await supabaseAdmin
        .from<SubscriptionRecord>("connectnow_subscriptions")
        .update({
          status,
          outbound_enabled: false,
        })
        .eq("id", record.id)
        .select("*")
        .single();

      if (error || !data) {
        throw error ?? new Error("Failed to update subscription status");
      }

      // Update CCPRO flag
      try {
        await supabaseAdmin
          .from("customers")
          .update({ CCPRO: false })
          .eq("company_email", userEmail.toLowerCase());
        console.log(`✅ Updated customers.CCPRO = false for ${userEmail}`);
      } catch (error) {
        console.error("⚠️ Failed to update customers.CCPRO:", error);
      }

      return {
        ...mapRecordToEffective(data),
        currentPeriodEnd: subscription.current_period_end,
      };
    } catch (error: any) {
      console.error("❌ Failed to cancel Stripe subscription:", error);
      throw new Error(`Failed to cancel subscription: ${error?.message || "Unknown error"}`);
    }
  },
};

