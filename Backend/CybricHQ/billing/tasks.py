# billing/tasks.py
"""
Celery tasks for billing operations.
Includes invoice generation, PDF creation, and reconciliation.
"""
import logging
from decimal import Decimal
from datetime import timedelta
from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.core.files.base import ContentFile
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def generate_invoices(self):
    """
    Generate invoices for subscriptions due for renewal.
    Should be run daily via Celery Beat.
    """
    from .models import Subscription, Invoice, AuditLog
    
    now = timezone.now()
    
    # Find subscriptions where current period ends today or has passed
    subscriptions = Subscription.objects.filter(
        status__in=['active', 'trialing'],
        current_period_end__lte=now
    ).select_related('plan', 'user')
    
    created_count = 0
    errors = []
    
    for subscription in subscriptions:
        try:
            # Check if invoice already exists for this period
            existing_invoice = Invoice.objects.filter(
                subscription=subscription,
                period_start=subscription.current_period_start,
                period_end=subscription.current_period_end
            ).exists()
            
            if existing_invoice:
                logger.info(f"Invoice already exists for subscription {subscription.id}")
                continue
            
            # Create new invoice
            plan = subscription.plan
            invoice = Invoice.objects.create(
                user=subscription.user,
                subscription=subscription,
                subtotal_cents=plan.price_cents,
                tax_cents=0,  # TODO: Implement tax calculation
                total_cents=plan.price_cents,
                currency=plan.currency,
                status='open',
                issued_at=now,
                due_at=now + timedelta(days=7),
                period_start=subscription.current_period_start,
                period_end=subscription.current_period_end,
            )
            
            # Update subscription period
            subscription.current_period_start = subscription.current_period_end
            subscription.current_period_end = subscription._calculate_period_end(
                subscription.current_period_start
            )
            
            # Update status if trial ended
            if subscription.status == 'trialing' and subscription.trial_end and subscription.trial_end <= now:
                subscription.status = 'active'
            
            subscription.save()
            
            # Create audit log
            AuditLog.objects.create(
                action='invoice.created',
                target_type='invoice',
                target_id=str(invoice.id),
                description=f"Invoice {invoice.invoice_no} generated for subscription renewal"
            )
            
            created_count += 1
            
            # Queue PDF generation and email
            generate_invoice_pdf.delay(str(invoice.id))
            send_invoice_email.delay(str(invoice.id))
            
        except Exception as e:
            logger.exception(f"Error creating invoice for subscription {subscription.id}: {e}")
            errors.append(str(subscription.id))
    
    logger.info(f"Generated {created_count} invoices. Errors: {len(errors)}")
    return {'created': created_count, 'errors': errors}


@shared_task(bind=True, max_retries=3)
def generate_invoice_pdf(self, invoice_id):
    """
    Generate PDF for an invoice using WeasyPrint.
    """
    from .models import Invoice
    
    try:
        invoice = Invoice.objects.select_related(
            'user', 'subscription', 'subscription__plan', 'subscription__plan__product'
        ).get(id=invoice_id)
    except Invoice.DoesNotExist:
        logger.error(f"Invoice not found: {invoice_id}")
        return
    
    try:
        # Import WeasyPrint
        try:
            from weasyprint import HTML
        except ImportError:
            logger.error("WeasyPrint not installed. Run: pip install weasyprint")
            return
        
        # Render HTML template
        context = {
            'invoice': invoice,
            'company_name': getattr(settings, 'COMPANY_NAME', 'CybrikHQ'),
            'company_address': getattr(settings, 'COMPANY_ADDRESS', ''),
            'company_email': getattr(settings, 'COMPANY_EMAIL', ''),
        }
        
        html_content = render_to_string('billing/invoice_pdf.html', context)
        
        # Generate PDF
        pdf_file = HTML(string=html_content).write_pdf()
        
        # Save to model
        filename = f"invoice_{invoice.invoice_no}.pdf"
        invoice.pdf.save(filename, ContentFile(pdf_file), save=True)
        
        logger.info(f"PDF generated for invoice {invoice.invoice_no}")
        return True
        
    except Exception as e:
        logger.exception(f"PDF generation failed for invoice {invoice_id}: {e}")
        raise self.retry(exc=e, countdown=60)


@shared_task(bind=True, max_retries=3)
def send_invoice_email(self, invoice_id):
    """
    Send invoice email to customer.
    """
    from .models import Invoice
    from django.core.mail import send_mail
    
    try:
        invoice = Invoice.objects.select_related('user').get(id=invoice_id)
    except Invoice.DoesNotExist:
        logger.error(f"Invoice not found: {invoice_id}")
        return
    
    try:
        subject = f"Invoice {invoice.invoice_no} from CybrikHQ"
        message = f"""
Dear {invoice.user.get_full_name() or invoice.user.email},

Your invoice {invoice.invoice_no} is now available.

Amount Due: {invoice.currency} {invoice.total_cents / 100:.2f}
Due Date: {invoice.due_at.strftime('%B %d, %Y') if invoice.due_at else 'On Receipt'}

Please log in to your account to view and pay this invoice.

Thank you for your business.

Best regards,
CybrikHQ Team
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invoice.user.email],
            fail_silently=False,
        )
        
        logger.info(f"Invoice email sent to {invoice.user.email}")
        return True
        
    except Exception as e:
        logger.exception(f"Failed to send invoice email: {e}")
        raise self.retry(exc=e, countdown=60)


@shared_task(bind=True, max_retries=3)
def send_payment_failed_email(self, invoice_id):
    """
    Send payment failure notification.
    """
    from .models import Invoice
    from django.core.mail import send_mail
    
    try:
        invoice = Invoice.objects.select_related('user', 'subscription').get(id=invoice_id)
    except Invoice.DoesNotExist:
        logger.error(f"Invoice not found: {invoice_id}")
        return
    
    try:
        subject = f"Payment Failed - Invoice {invoice.invoice_no}"
        message = f"""
Dear {invoice.user.get_full_name() or invoice.user.email},

We were unable to process the payment for invoice {invoice.invoice_no}.

Amount: {invoice.currency} {invoice.total_cents / 100:.2f}

Please update your payment method to avoid service interruption.

If you have any questions, please contact our support team.

Best regards,
CybrikHQ Team
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invoice.user.email],
            fail_silently=False,
        )
        
        # Also notify admin
        admin_email = getattr(settings, 'ADMIN_EMAIL', None)
        if admin_email:
            send_mail(
                subject=f"[ALERT] Payment Failed - {invoice.invoice_no}",
                message=f"Payment failed for user {invoice.user.email}\nInvoice: {invoice.invoice_no}\nAmount: {invoice.currency} {invoice.total_cents / 100:.2f}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[admin_email],
                fail_silently=True,
            )
        
        logger.info(f"Payment failed email sent for invoice {invoice.invoice_no}")
        return True
        
    except Exception as e:
        logger.exception(f"Failed to send payment failed email: {e}")
        raise self.retry(exc=e, countdown=60)


@shared_task(bind=True, max_retries=2)
def reconcile_payments(self):
    """
    Reconcile payments from Stripe.
    Matches Stripe charges to local invoices.
    """
    from .models import Invoice, PaymentLog, AuditLog
    
    try:
        import stripe
    except ImportError:
        logger.error("Stripe not installed")
        return {'error': 'Stripe not installed'}
    
    stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', None)
    if not stripe.api_key:
        logger.error("STRIPE_SECRET_KEY not configured")
        return {'error': 'Stripe not configured'}
    
    try:
        # Get recent charges from Stripe (last 7 days)
        charges = stripe.Charge.list(
            created={'gte': int((timezone.now() - timedelta(days=7)).timestamp())},
            limit=100
        )
        
        matched = 0
        unmatched = []
        
        for charge in charges.auto_paging_iter():
            if charge.status != 'succeeded':
                continue
            
            # Try to match by invoice ID in metadata
            invoice_id = charge.metadata.get('invoice_id')
            if invoice_id:
                try:
                    invoice = Invoice.objects.get(id=invoice_id)
                    if invoice.status != 'paid':
                        invoice.mark_paid(payment_method='stripe')
                        
                        PaymentLog.objects.create(
                            invoice=invoice,
                            gateway='stripe',
                            gateway_payment_id=charge.id,
                            amount_cents=charge.amount,
                            currency=charge.currency.upper(),
                            status='succeeded',
                            raw_response={'charge_id': charge.id}
                        )
                        
                        matched += 1
                        continue
                except Invoice.DoesNotExist:
                    pass
            
            # Try to match by Stripe invoice ID
            stripe_invoice_id = charge.invoice
            if stripe_invoice_id:
                try:
                    invoice = Invoice.objects.get(stripe_invoice_id=stripe_invoice_id)
                    if invoice.status != 'paid':
                        invoice.mark_paid(payment_method='stripe')
                        
                        PaymentLog.objects.create(
                            invoice=invoice,
                            gateway='stripe',
                            gateway_payment_id=charge.id,
                            amount_cents=charge.amount,
                            currency=charge.currency.upper(),
                            status='succeeded'
                        )
                        
                        matched += 1
                        continue
                except Invoice.DoesNotExist:
                    pass
            
            # Try to match by amount and customer email
            customer_email = charge.billing_details.email or charge.receipt_email
            if customer_email:
                potential_invoices = Invoice.objects.filter(
                    user__email=customer_email,
                    total_cents=charge.amount,
                    status='open'
                )
                if potential_invoices.count() == 1:
                    invoice = potential_invoices.first()
                    invoice.mark_paid(payment_method='stripe')
                    
                    PaymentLog.objects.create(
                        invoice=invoice,
                        gateway='stripe',
                        gateway_payment_id=charge.id,
                        amount_cents=charge.amount,
                        currency=charge.currency.upper(),
                        status='succeeded',
                        raw_response={'matched_by': 'amount_and_email'}
                    )
                    
                    matched += 1
                    continue
            
            # Could not match
            unmatched.append({
                'charge_id': charge.id,
                'amount': charge.amount,
                'email': customer_email
            })
        
        # Create audit log
        AuditLog.objects.create(
            action='reconciliation.completed',
            target_type='system',
            target_id='reconciliation',
            changes={'matched': matched, 'unmatched': len(unmatched)},
            description=f"Reconciliation completed: {matched} matched, {len(unmatched)} unmatched"
        )
        
        logger.info(f"Reconciliation complete: {matched} matched, {len(unmatched)} unmatched")
        return {'matched': matched, 'unmatched': unmatched}
        
    except Exception as e:
        logger.exception(f"Reconciliation failed: {e}")
        raise self.retry(exc=e, countdown=300)


@shared_task
def cleanup_old_webhook_events():
    """
    Clean up old webhook events (older than 30 days).
    """
    from .models import WebhookEvent
    
    cutoff = timezone.now() - timedelta(days=30)
    deleted, _ = WebhookEvent.objects.filter(
        received_at__lt=cutoff,
        processed=True
    ).delete()
    
    logger.info(f"Cleaned up {deleted} old webhook events")
    return deleted


@shared_task
def send_payment_reminders():
    """
    Send reminders for overdue invoices.
    """
    from .models import Invoice
    from django.core.mail import send_mail
    
    now = timezone.now()
    
    # Find overdue invoices (3 days past due)
    overdue_invoices = Invoice.objects.filter(
        status='open',
        due_at__lt=now - timedelta(days=3)
    ).select_related('user')
    
    sent_count = 0
    
    for invoice in overdue_invoices:
        # Check if reminder was already sent recently (via metadata)
        last_reminder = invoice.metadata.get('last_reminder')
        if last_reminder:
            last_reminder_date = timezone.datetime.fromisoformat(last_reminder)
            if (now - last_reminder_date).days < 3:
                continue  # Skip, reminder sent within last 3 days
        
        try:
            send_mail(
                subject=f"Payment Reminder - Invoice {invoice.invoice_no}",
                message=f"""
Dear Customer,

This is a reminder that invoice {invoice.invoice_no} is overdue.

Amount Due: {invoice.currency} {invoice.total_cents / 100:.2f}
Original Due Date: {invoice.due_at.strftime('%B %d, %Y') if invoice.due_at else 'N/A'}

Please make payment as soon as possible to avoid service interruption.

Best regards,
CybrikHQ Team
                """,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[invoice.user.email],
                fail_silently=True,
            )
            
            # Update metadata
            invoice.metadata['last_reminder'] = now.isoformat()
            invoice.save(update_fields=['metadata'])
            sent_count += 1
            
        except Exception as e:
            logger.error(f"Failed to send reminder for invoice {invoice.id}: {e}")
    
    logger.info(f"Sent {sent_count} payment reminders")
    return sent_count
