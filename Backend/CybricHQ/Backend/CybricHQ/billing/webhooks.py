# billing/webhooks.py
"""
Stripe webhook handler.
Security-critical: validates signatures and ensures idempotency.
"""
import json
import logging
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone

from .models import (
    Subscription, Invoice, PaymentLog, AuditLog, WebhookEvent
)

logger = logging.getLogger(__name__)

# Try to import Stripe
try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False
    stripe = None


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """
    Handle incoming Stripe webhooks.
    
    Security:
    - CSRF exempt (external webhook)
    - Signature verification required
    - Idempotency via WebhookEvent model
    """
    if not STRIPE_AVAILABLE:
        logger.error("Stripe SDK not installed")
        return HttpResponse(status=500)
    
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None)
    
    if not webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET not configured")
        return HttpResponse(status=500)
    
    if not sig_header:
        logger.warning("Missing Stripe signature header")
        return HttpResponse(status=400)
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        return HttpResponse(status=400)
    
    # Check for idempotency - only process each event once
    event_id = event.get('id')
    event_type = event.get('type')
    
    webhook_event, created = WebhookEvent.objects.get_or_create(
        event_id=event_id,
        defaults={
            'source': 'stripe',
            'event_type': event_type,
            'payload': event,
        }
    )
    
    if not created and webhook_event.processed:
        logger.info(f"Event {event_id} already processed, skipping")
        return HttpResponse(status=200)
    
    try:
        # Process the event based on type
        if event_type == 'invoice.paid':
            handle_invoice_paid(event)
        elif event_type == 'invoice.payment_failed':
            handle_invoice_payment_failed(event)
        elif event_type == 'customer.subscription.created':
            handle_subscription_created(event)
        elif event_type == 'customer.subscription.updated':
            handle_subscription_updated(event)
        elif event_type == 'customer.subscription.deleted':
            handle_subscription_deleted(event)
        elif event_type == 'payment_intent.succeeded':
            handle_payment_intent_succeeded(event)
        elif event_type == 'payment_intent.payment_failed':
            handle_payment_intent_failed(event)
        else:
            logger.info(f"Unhandled event type: {event_type}")
        
        # Mark as processed
        webhook_event.processed = True
        webhook_event.processed_at = timezone.now()
        webhook_event.save()
        
        return HttpResponse(status=200)
        
    except Exception as e:
        logger.exception(f"Error processing webhook {event_id}: {e}")
        webhook_event.error = str(e)
        webhook_event.save()
        return HttpResponse(status=500)


def handle_invoice_paid(event):
    """Handle invoice.paid event."""
    stripe_invoice = event['data']['object']
    stripe_invoice_id = stripe_invoice.get('id')
    
    try:
        invoice = Invoice.objects.get(stripe_invoice_id=stripe_invoice_id)
        
        if invoice.status != 'paid':
            invoice.status = 'paid'
            invoice.paid_at = timezone.now()
            invoice.payment_method = 'stripe'
            invoice.save()
            
            # Create payment log
            PaymentLog.objects.create(
                invoice=invoice,
                gateway='stripe',
                gateway_payment_id=stripe_invoice.get('payment_intent'),
                amount_cents=stripe_invoice.get('amount_paid', 0),
                currency=stripe_invoice.get('currency', 'usd').upper(),
                status='succeeded',
                raw_response={'invoice_id': stripe_invoice_id}
            )
            
            # Create audit log
            AuditLog.objects.create(
                action='invoice.paid',
                target_type='invoice',
                target_id=str(invoice.id),
                description=f"Invoice {invoice.invoice_no} paid via Stripe"
            )
            
            logger.info(f"Invoice {invoice.invoice_no} marked as paid")
            
    except Invoice.DoesNotExist:
        logger.warning(f"Invoice not found for Stripe ID: {stripe_invoice_id}")


def handle_invoice_payment_failed(event):
    """Handle invoice.payment_failed event."""
    stripe_invoice = event['data']['object']
    stripe_invoice_id = stripe_invoice.get('id')
    
    try:
        invoice = Invoice.objects.get(stripe_invoice_id=stripe_invoice_id)
        
        # Update subscription status if applicable
        if invoice.subscription:
            invoice.subscription.status = 'past_due'
            invoice.subscription.save()
        
        # Create payment log
        PaymentLog.objects.create(
            invoice=invoice,
            gateway='stripe',
            gateway_payment_id=stripe_invoice.get('payment_intent'),
            amount_cents=stripe_invoice.get('amount_due', 0),
            currency=stripe_invoice.get('currency', 'usd').upper(),
            status='failed',
            error_message=stripe_invoice.get('last_finalization_error', {}).get('message', ''),
            raw_response={'invoice_id': stripe_invoice_id}
        )
        
        # Create audit log
        AuditLog.objects.create(
            action='payment.failed',
            target_type='invoice',
            target_id=str(invoice.id),
            description=f"Payment failed for invoice {invoice.invoice_no}"
        )
        
        logger.warning(f"Payment failed for invoice {invoice.invoice_no}")
        
        # TODO: Send payment failed email
        # from .tasks import send_payment_failed_email
        # send_payment_failed_email.delay(invoice.id)
        
    except Invoice.DoesNotExist:
        logger.warning(f"Invoice not found for Stripe ID: {stripe_invoice_id}")


def handle_subscription_created(event):
    """Handle customer.subscription.created event."""
    stripe_sub = event['data']['object']
    stripe_sub_id = stripe_sub.get('id')
    
    # Update local subscription with Stripe IDs
    try:
        subscription = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
        subscription.stripe_customer_id = stripe_sub.get('customer')
        subscription.status = map_stripe_status(stripe_sub.get('status'))
        subscription.save()
        logger.info(f"Subscription {subscription.id} synced with Stripe")
    except Subscription.DoesNotExist:
        logger.info(f"No local subscription for Stripe ID: {stripe_sub_id}")


def handle_subscription_updated(event):
    """Handle customer.subscription.updated event."""
    stripe_sub = event['data']['object']
    stripe_sub_id = stripe_sub.get('id')
    
    try:
        subscription = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
        old_status = subscription.status
        
        subscription.status = map_stripe_status(stripe_sub.get('status'))
        
        # Update billing period
        current_period_start = stripe_sub.get('current_period_start')
        current_period_end = stripe_sub.get('current_period_end')
        
        if current_period_start:
            subscription.current_period_start = timezone.datetime.fromtimestamp(
                current_period_start, tz=timezone.utc
            )
        if current_period_end:
            subscription.current_period_end = timezone.datetime.fromtimestamp(
                current_period_end, tz=timezone.utc
            )
        
        subscription.cancel_at_period_end = stripe_sub.get('cancel_at_period_end', False)
        subscription.save()
        
        if old_status != subscription.status:
            AuditLog.objects.create(
                action='subscription.updated',
                target_type='subscription',
                target_id=str(subscription.id),
                changes={'old_status': old_status, 'new_status': subscription.status},
                description=f"Subscription status changed from {old_status} to {subscription.status}"
            )
        
        logger.info(f"Subscription {subscription.id} updated from Stripe")
        
    except Subscription.DoesNotExist:
        logger.warning(f"Subscription not found for Stripe ID: {stripe_sub_id}")


def handle_subscription_deleted(event):
    """Handle customer.subscription.deleted event."""
    stripe_sub = event['data']['object']
    stripe_sub_id = stripe_sub.get('id')
    
    try:
        subscription = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
        subscription.status = 'canceled'
        subscription.ended_at = timezone.now()
        subscription.save()
        
        AuditLog.objects.create(
            action='subscription.canceled',
            target_type='subscription',
            target_id=str(subscription.id),
            description=f"Subscription canceled via Stripe"
        )
        
        logger.info(f"Subscription {subscription.id} canceled from Stripe")
        
    except Subscription.DoesNotExist:
        logger.warning(f"Subscription not found for Stripe ID: {stripe_sub_id}")


def handle_payment_intent_succeeded(event):
    """Handle payment_intent.succeeded event."""
    payment_intent = event['data']['object']
    pi_id = payment_intent.get('id')
    
    # Find invoice by payment_intent_id
    try:
        invoice = Invoice.objects.get(stripe_payment_intent_id=pi_id)
        if invoice.status != 'paid':
            invoice.status = 'paid'
            invoice.paid_at = timezone.now()
            invoice.payment_method = 'stripe'
            invoice.save()
            logger.info(f"Invoice {invoice.invoice_no} paid via PaymentIntent")
    except Invoice.DoesNotExist:
        pass  # May not be linked to an invoice


def handle_payment_intent_failed(event):
    """Handle payment_intent.payment_failed event."""
    payment_intent = event['data']['object']
    pi_id = payment_intent.get('id')
    error = payment_intent.get('last_payment_error', {})
    
    try:
        invoice = Invoice.objects.get(stripe_payment_intent_id=pi_id)
        
        PaymentLog.objects.create(
            invoice=invoice,
            gateway='stripe',
            gateway_payment_id=pi_id,
            amount_cents=payment_intent.get('amount', 0),
            currency=payment_intent.get('currency', 'usd').upper(),
            status='failed',
            error_message=error.get('message', ''),
            raw_response={'payment_intent_id': pi_id}
        )
        
        logger.warning(f"Payment failed for invoice {invoice.invoice_no}")
    except Invoice.DoesNotExist:
        pass


def map_stripe_status(stripe_status):
    """Map Stripe subscription status to local status."""
    status_map = {
        'trialing': 'trialing',
        'active': 'active',
        'past_due': 'past_due',
        'unpaid': 'unpaid',
        'canceled': 'canceled',
        'incomplete': 'incomplete',
        'incomplete_expired': 'incomplete_expired',
        'paused': 'paused',
    }
    return status_map.get(stripe_status, 'incomplete')
