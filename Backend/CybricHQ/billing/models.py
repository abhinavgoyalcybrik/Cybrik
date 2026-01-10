# billing/models.py
"""
Billing models for subscription management, invoices, and payments.
Security-critical: handles financial data.
"""
import uuid
import hashlib
import secrets
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator


class Product(models.Model):
    """
    A product that can be sold (e.g., "CybrikHQ CRM", "IELTS Prep", "Application Portal").
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True, db_index=True, help_text="Unique product code")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True, db_index=True)
    
    # Feature flags - which modules/features this product unlocks
    feature_flags = models.JSONField(
        default=dict,
        blank=True,
        help_text="Features unlocked by this product: {'crm': true, 'ielts_module': true, 'application_portal': true}"
    )
    
    # Stripe integration
    stripe_product_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Plan(models.Model):
    """
    A pricing plan for a product (e.g., "Monthly", "Annual").
    """
    INTERVAL_CHOICES = [
        ('day', 'Daily'),
        ('week', 'Weekly'),
        ('month', 'Monthly'),
        ('year', 'Yearly'),
    ]
    
    CURRENCY_CHOICES = [
        ('USD', 'US Dollar'),
        ('EUR', 'Euro'),
        ('GBP', 'British Pound'),
        ('INR', 'Indian Rupee'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='plans')
    name = models.CharField(max_length=255)
    
    # Pricing - stored in cents to avoid floating point issues
    price_cents = models.PositiveIntegerField(validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD')
    
    # Billing interval
    interval = models.CharField(max_length=10, choices=INTERVAL_CHOICES, default='month')
    interval_count = models.PositiveIntegerField(default=1, help_text="Number of intervals between billings")
    
    # Trial
    trial_days = models.PositiveIntegerField(default=0)
    
    # Stripe integration
    stripe_price_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    
    active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['product', 'price_cents']
    
    def __str__(self):
        return f"{self.product.name} - {self.name} ({self.formatted_price})"
    
    @property
    def formatted_price(self):
        """Return price in human-readable format."""
        return f"{self.currency} {self.price_cents / 100:.2f}/{self.interval}"
    
    @property
    def price_decimal(self):
        """Return price as Decimal."""
        return Decimal(self.price_cents) / Decimal(100)


class Subscription(models.Model):
    """
    A tenant's subscription to a plan.
    Subscriptions are now tenant-level, not user-level.
    """
    STATUS_CHOICES = [
        ('trialing', 'Trialing'),
        ('active', 'Active'),
        ('past_due', 'Past Due'),
        ('canceled', 'Canceled'),
        ('unpaid', 'Unpaid'),
        ('incomplete', 'Incomplete'),
        ('incomplete_expired', 'Incomplete Expired'),
        ('paused', 'Paused'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Tenant-level subscription
    tenant = models.ForeignKey(
        'crm_app.Tenant',
        on_delete=models.CASCADE,
        related_name='subscriptions',
        null=True,  # Nullable for migration of existing data
        blank=True,
        help_text="The tenant/organization this subscription belongs to"
    )
    
    # Billing contact (optional - for invoices/communications)
    billing_contact = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='billing_subscriptions',
        help_text="Primary contact for billing communications"
    )
    
    # Legacy user field - kept for backward compatibility during migration
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscriptions',
        null=True,  # Now nullable
        blank=True
    )
    
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='subscriptions')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='incomplete', db_index=True)
    
    # Billing period
    start_date = models.DateTimeField(default=timezone.now)
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    
    # Trial period
    trial_start = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    
    # Cancellation
    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    
    # Stripe integration
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True, unique=True, db_index=True)
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    
    # Metadata (JSON field for flexible data)
    metadata = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['current_period_end']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.plan.name} ({self.status})"
    
    def save(self, *args, **kwargs):
        # Set initial period if not set
        if not self.current_period_start:
            self.current_period_start = self.start_date
        if not self.current_period_end:
            self.current_period_end = self._calculate_period_end(self.current_period_start)
        super().save(*args, **kwargs)
    
    def _calculate_period_end(self, start):
        """Calculate the end of a billing period."""
        from dateutil.relativedelta import relativedelta
        
        delta_map = {
            'day': relativedelta(days=self.plan.interval_count),
            'week': relativedelta(weeks=self.plan.interval_count),
            'month': relativedelta(months=self.plan.interval_count),
            'year': relativedelta(years=self.plan.interval_count),
        }
        return start + delta_map.get(self.plan.interval, relativedelta(months=1))


class Purchase(models.Model):
    """
    One-time purchase (non-subscription).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='purchases')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='purchases')
    
    amount_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default='USD')
    
    # Payment info
    payment_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    payment_method = models.CharField(max_length=50, blank=True)  # 'stripe', 'manual', etc.
    paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user} - {self.product.name} ({self.amount_cents / 100:.2f} {self.currency})"


def generate_invoice_number():
    """Generate a unique invoice number."""
    timestamp = timezone.now().strftime('%Y%m')
    random_part = secrets.token_hex(4).upper()
    return f"INV-{timestamp}-{random_part}"


class Invoice(models.Model):
    """
    Invoice for a subscription period or purchase.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('open', 'Open'),
        ('paid', 'Paid'),
        ('void', 'Void'),
        ('uncollectible', 'Uncollectible'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_no = models.CharField(max_length=50, unique=True, default=generate_invoice_number, db_index=True)
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='invoices')
    subscription = models.ForeignKey(Subscription, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    purchase = models.ForeignKey(Purchase, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    
    # Amounts
    subtotal_cents = models.PositiveIntegerField(default=0)
    tax_cents = models.PositiveIntegerField(default=0)
    total_cents = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=3, default='USD')
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    
    # Dates
    issued_at = models.DateTimeField(default=timezone.now)
    due_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    
    # Period for subscription invoices
    period_start = models.DateTimeField(null=True, blank=True)
    period_end = models.DateTimeField(null=True, blank=True)
    
    # PDF storage
    pdf = models.FileField(upload_to='invoices/pdfs/%Y/%m/', null=True, blank=True)
    
    # Stripe integration
    stripe_invoice_id = models.CharField(max_length=255, blank=True, null=True, unique=True, db_index=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, null=True)
    
    # Payment info
    payment_method = models.CharField(max_length=50, blank=True)
    
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-issued_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['issued_at']),
        ]
    
    def __str__(self):
        return f"{self.invoice_no} - {self.total_cents / 100:.2f} {self.currency}"
    
    @property
    def is_paid(self):
        return self.status == 'paid'
    
    def mark_paid(self, payment_method='manual'):
        """Mark invoice as paid."""
        self.status = 'paid'
        self.paid_at = timezone.now()
        self.payment_method = payment_method
        self.save(update_fields=['status', 'paid_at', 'payment_method', 'updated_at'])


class PaymentLog(models.Model):
    """
    Log of all payment attempts and transactions.
    Security-critical: stores payment gateway responses.
    """
    GATEWAY_CHOICES = [
        ('stripe', 'Stripe'),
        ('manual', 'Manual'),
        ('bank_transfer', 'Bank Transfer'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
        ('disputed', 'Disputed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payment_logs')
    
    gateway = models.CharField(max_length=20, choices=GATEWAY_CHOICES)
    gateway_payment_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    
    amount_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default='USD')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Store raw response for debugging/audit (sanitized - no full card numbers)
    raw_response = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    
    received_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-received_at']
    
    def __str__(self):
        return f"{self.gateway} - {self.status} - {self.amount_cents / 100:.2f} {self.currency}"


class AuditLog(models.Model):
    """
    Audit trail for all billing-related actions.
    Security requirement: immutable log of financial actions.
    """
    ACTION_CHOICES = [
        ('subscription.created', 'Subscription Created'),
        ('subscription.updated', 'Subscription Updated'),
        ('subscription.canceled', 'Subscription Canceled'),
        ('invoice.created', 'Invoice Created'),
        ('invoice.paid', 'Invoice Paid'),
        ('invoice.voided', 'Invoice Voided'),
        ('payment.received', 'Payment Received'),
        ('payment.failed', 'Payment Failed'),
        ('payment.refunded', 'Payment Refunded'),
        ('plan.created', 'Plan Created'),
        ('plan.updated', 'Plan Updated'),
        ('product.created', 'Product Created'),
        ('product.updated', 'Product Updated'),
        ('reconciliation.completed', 'Reconciliation Completed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Actor who performed the action (can be null for system actions)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='billing_audit_logs'
    )
    actor_email = models.EmailField(blank=True)  # Preserved even if user deleted
    
    action = models.CharField(max_length=50, choices=ACTION_CHOICES, db_index=True)
    
    # Target of the action
    target_type = models.CharField(max_length=50)  # 'subscription', 'invoice', etc.
    target_id = models.CharField(max_length=100)  # UUID as string
    
    # What changed (before/after or description)
    changes = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True)
    
    # IP and User Agent for security
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ['-created_at']
        # Prevent modification/deletion at DB level
        managed = True
    
    def save(self, *args, **kwargs):
        # Capture actor email for persistence
        if self.actor and not self.actor_email:
            self.actor_email = self.actor.email
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.action} by {self.actor_email or 'System'} at {self.created_at}"


class WebhookEvent(models.Model):
    """
    Store incoming webhook events for idempotency and debugging.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    source = models.CharField(max_length=50, default='stripe')  # 'stripe', 'paypal', etc.
    event_id = models.CharField(max_length=255, unique=True, db_index=True)  # Stripe event ID
    event_type = models.CharField(max_length=100, db_index=True)  # 'invoice.paid', etc.
    
    payload = models.JSONField(default=dict)
    
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)
    
    received_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['source', 'event_type']),
        ]
    
    def __str__(self):
        return f"{self.source}:{self.event_type} ({self.event_id})"
