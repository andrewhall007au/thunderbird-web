# Welcome Email System

## Overview
Implement two welcome emails based on user signup state.

## Email 1: Incomplete Payment Reminder
- **Trigger**: 1 hour after user exits checkout without completing payment
- **Mechanism**: Cron job every 15 mins checks for `email_pending_at` > 1 hour ago AND `payment_completed = false`
- **Content**: "Complete your signup" reminder with link back to checkout
- **Incentive**: None

## Email 2: Welcome + Onboarding (Payment Complete)
- **Trigger**: Immediately on successful payment
- **Content**:
  - Quick start guide (how to send first forecast)
  - Route setup instructions
  - Command reference (CAST12, CAST7, etc.)
  - Link to web version with tracking

## Technical Decisions
- **Email service**: Resend (already configured)
- **Delay mechanism**: Cron job (cheapest - no extra infrastructure)
- **Templates**: HTML in Python backend (Jinja2/f-strings)
- **Tracking**: Web version link with open/click tracking

## Database Changes Needed
- Add `welcome_email_sent` boolean to users table
- Add `incomplete_email_sent` boolean to users table
- Add `email_pending_at` timestamp to track checkout abandonment

## Implementation Steps
1. Add database columns
2. Create email templates in backend
3. Add Resend send function for each email type
4. Hook welcome email into payment success webhook
5. Create cron job for incomplete payment check
6. Add tracking pixel/link tracking
