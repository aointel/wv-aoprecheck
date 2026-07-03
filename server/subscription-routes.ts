import { Express } from "express";
import { SubscriptionService } from "./subscription-service";
import { supabaseAdmin } from "./supabase";
import { HARDCODED_CONFIG } from "./hardcoded-config";
import Stripe from "stripe";

export function registerSubscriptionRoutes(app: Express) {
  // Get subscription status
  app.get("/api/billing/subscription/status", async (req, res) => {
    try {
      const userEmail = (req.query.userEmail as string) || (req.headers['x-user-email'] as string);
      
      if (!userEmail) {
        return res.status(400).json({ 
          success: false, 
          error: "User email is required" 
        });
      }

      const subscription = await SubscriptionService.getEffectiveSubscription(userEmail);
      
      res.json({
        success: true,
        subscription
      });
    } catch (error: any) {
      console.error("❌ Error getting subscription status:", error);
      res.status(500).json({
        success: false,
        error: error?.message || "Failed to get subscription status"
      });
    }
  });

  // Create setup intent for embedded checkout
  app.post("/api/billing/subscription/setup-intent", async (req, res) => {
    try {
      const { userEmail, plan } = req.body;
      const userEmailFromHeader = req.headers['x-user-email'] as string;
      const emailToUse = userEmail || userEmailFromHeader;

      if (!emailToUse) {
        return res.status(400).json({
          success: false,
          error: "User email is required"
        });
      }

      const normalizedEmail = emailToUse.toLowerCase().trim();

      const { clientSecret, setupIntentId } = await SubscriptionService.createSetupIntent(
        normalizedEmail,
        plan as 'professional' | 'elite' | undefined
      );

      res.json({
        success: true,
        clientSecret,
        setupIntentId
      });
    } catch (error: any) {
      console.error("❌ Error creating setup intent:", error);
      res.status(500).json({
        success: false,
        error: error?.message || "Failed to create setup intent"
      });
    }
  });

  // Auto-apply Associate ID discount when the login matches an eligible first-time subscriber + Stripe coupon
  app.get("/api/billing/associate-discount/autodetect", async (req, res) => {
    try {
      const userEmail =
        (req.query.userEmail as string) || (req.headers["x-user-email"] as string);
      if (!userEmail) {
        return res.status(400).json({
          success: false,
          error: "user email required",
        });
      }
      const result = await SubscriptionService.autoDetectAssociateDiscount(userEmail);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Validate discount code
  app.post("/api/billing/validate-discount-code", async (req, res) => {
    try {
      const userEmail = (req.headers['x-user-email'] as string) || (req.body.userEmail as string);
      const { code } = req.body;
      if (!code || !userEmail) {
        return res.status(400).json({ success: false, error: 'code and userEmail required' });
      }
      const result = await SubscriptionService.validateDiscountCode(code, userEmail);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
    }
  });

  // Activate subscription after payment method is confirmed
  app.post("/api/billing/subscription/activate", async (req, res) => {
    try {
      const { userEmail, plan, paymentMethodId, setupIntentId, couponCode } = req.body;
      const userEmailFromHeader = req.headers['x-user-email'] as string;
      const emailToUse = userEmail || userEmailFromHeader;

      if (!emailToUse) {
        return res.status(400).json({
          success: false,
          error: "User email is required"
        });
      }

      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          error: "Payment method ID is required"
        });
      }

      if (!plan) {
        return res.status(400).json({
          success: false,
          error: "Plan is required"
        });
      }

      const normalizedEmail = emailToUse.toLowerCase().trim();

      const subscription = await SubscriptionService.activateSubscription({
        userEmail: normalizedEmail,
        plan: plan as 'professional' | 'elite',
        paymentMethodId,
        setupIntentId,
        couponCode,
      });

      res.json({
        success: true,
        subscription
      });
    } catch (error: any) {
      console.error("❌ Error activating subscription:", error);
      res.status(500).json({
        success: false,
        error: error?.message || "Failed to activate subscription"
      });
    }
  });

  // Create checkout session for Call Connector Pro
  app.post("/api/billing/subscription/checkout-session", async (req, res) => {
    try {
      const { userEmail, plan = 'professional' } = req.body;
      const { successUrl, cancelUrl } = req.body;

      if (!userEmail) {
        return res.status(400).json({
          success: false,
          error: "User email is required"
        });
      }

      const sessionUrl = await SubscriptionService.createCheckoutSession({
        userEmail,
        plan: plan as 'professional' | 'elite',
        successUrl: successUrl || `${req.headers.origin || 'http://localhost:3000'}/dashboard/billing-dashboard?status=success`,
        cancelUrl: cancelUrl || `${req.headers.origin || 'http://localhost:3000'}/dashboard/billing-dashboard?status=cancelled`,
      });

      res.json({
        success: true,
        url: sessionUrl
      });
    } catch (error: any) {
      console.error("❌ Error creating checkout session:", error);
      res.status(500).json({
        success: false,
        error: error?.message || "Failed to create checkout session"
      });
    }
  });

  // Cancel subscription
  app.post("/api/billing/subscription/cancel", async (req, res) => {
    try {
      const userEmail = req.body.userEmail || (req.headers['x-user-email'] as string);
      
      if (!userEmail) {
        return res.status(400).json({
          success: false,
          error: "User email is required"
        });
      }

      const subscription = await SubscriptionService.cancelSubscription(userEmail);
      
      res.json({
        success: true,
        subscription
      });
    } catch (error: any) {
      console.error("❌ Error canceling subscription:", error);
      res.status(500).json({
        success: false,
        error: error?.message || "Failed to cancel subscription"
      });
    }
  });

  // Create Stripe billing portal session
  app.post("/api/billing/subscription/billing-portal", async (req, res) => {
    try {
      const userEmail = req.body.userEmail || (req.headers['x-user-email'] as string);
      const { returnUrl } = req.body;

      if (!userEmail) {
        return res.status(400).json({
          success: false,
          error: "User email is required"
        });
      }

      const normalizedEmail = userEmail.toLowerCase().trim();
      
      // Get Stripe customer ID
      const { data: subscriptionRecord } = await supabaseAdmin
        ?.from('connectnow_subscriptions')
        .select('stripe_customer_id')
        .eq('user_email', normalizedEmail)
        .maybeSingle();

      if (!subscriptionRecord?.stripe_customer_id) {
        return res.status(404).json({
          success: false,
          error: "No Stripe customer found. Please subscribe first."
        });
      }

      if (!HARDCODED_CONFIG.STRIPE_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          error: "Stripe is not configured"
        });
      }

      const stripe = new Stripe(HARDCODED_CONFIG.STRIPE_SECRET_KEY, {
        apiVersion: "2024-09-30.acacia" as any,
      });

      // Create billing portal session with full features enabled
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: subscriptionRecord.stripe_customer_id,
        return_url: returnUrl || `${req.headers.origin || 'http://localhost:3000'}/dashboard/billing-dashboard?tab=subscription`,
        // Enable all features: subscriptions, payment methods, invoices, billing history
      });

      res.json({
        success: true,
        url: portalSession.url
      });
    } catch (error: any) {
      console.error("❌ Error creating billing portal session:", error);
      res.status(500).json({
        success: false,
        error: error?.message || "Failed to create billing portal session"
      });
    }
  });

  // Get all subscriptions for a user
  app.get("/api/billing/subscription/all", async (req, res) => {
    try {
      const userEmail = (req.query.userEmail as string) || (req.headers['x-user-email'] as string);
      
      if (!userEmail) {
        return res.status(400).json({
          success: false,
          error: "User email is required"
        });
      }

      const normalizedEmail = userEmail.toLowerCase().trim();
      
      // Get subscription record from database
      const { data: subscriptionRecord } = await supabaseAdmin
        ?.from('connectnow_subscriptions')
        .select('*')
        .eq('user_email', normalizedEmail)
        .maybeSingle();

      if (!subscriptionRecord) {
        return res.json({
          success: true,
          subscriptions: []
        });
      }

      // Get all Stripe subscriptions for this customer
      if (!HARDCODED_CONFIG.STRIPE_SECRET_KEY) {
        return res.status(500).json({
          success: false,
          error: "Stripe is not configured"
        });
      }

      const stripe = new Stripe(HARDCODED_CONFIG.STRIPE_SECRET_KEY, {
        apiVersion: "2024-09-30.acacia" as any,
      });

      let stripeSubscriptions: any[] = [];
      if (subscriptionRecord.stripe_customer_id) {
        const subscriptions = await stripe.subscriptions.list({
          customer: subscriptionRecord.stripe_customer_id,
          limit: 100,
        });
        stripeSubscriptions = subscriptions.data;
      }

      res.json({
        success: true,
        subscriptions: stripeSubscriptions.map(sub => ({
          id: sub.id,
          status: sub.status,
          plan: sub.metadata?.plan || 'professional',
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          items: sub.items.data.map((item: any) => ({
            id: item.id,
            priceId: item.price.id,
            productId: item.price.product,
            amount: item.price.unit_amount,
            currency: item.price.currency,
            interval: item.price.recurring?.interval,
          })),
        })),
        customerId: subscriptionRecord.stripe_customer_id,
      });
    } catch (error: any) {
      console.error("❌ Error getting all subscriptions:", error);
      res.status(500).json({
        success: false,
        error: error?.message || "Failed to get subscriptions"
      });
    }
  });
}
