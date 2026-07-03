# What is CSP and Why Is It Fucking Blocking WebRTC?

## What is CSP?

**CSP = Content Security Policy**

It's a browser security feature that tells the browser:
- "Only load scripts from these domains"
- "Only connect to these WebSocket servers"
- "Only load images from these sources"

**It's like a bouncer at a club** - it blocks everything except what you explicitly allow.

## Why Was It Added?

Looking at the code comments:
- "Allow WebSocket connections to Twilio for WebRTC"
- "Also allows Stripe.js for payment processing"

**It was added to ALLOW WebRTC and Stripe**, but it's so restrictive that it's BLOCKING them instead.

## The Problem

CSP is **too strict**. Every time Twilio adds a new domain or you use a different edge region, you have to manually add it to CSP. That's why WebRTC keeps breaking.

## Do We Need It?

**NO. You don't need CSP for this app.**

CSP is useful for:
- Public websites that might get XSS attacks
- Apps that load untrusted content
- High-security environments

**For your internal app with trusted users, CSP is just causing problems.**

## Solution: Remove CSP

We can remove it entirely and let the browser's default security handle it. Your app will work fine without it.
