# billing/admin.py
"""
Django Admin configuration for billing models.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import (
    Product, Plan, Subscription, Purchase, 
    Invoice, PaymentLog, AuditLog, WebhookEvent
)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'active', 'feature_flags_display', 'plans_count', 'created_at']
    list_filter = ['active', 'created_at']
    search_fields = ['name', 'code', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Product Info', {
            'fields': ('id', 'code', 'name', 'description', 'active')
        }),
        ('Feature Access', {
            'fields': ('feature_flags',),
            'description': 'Define which modules this product unlocks: {"crm": true, "ielts_module": true, "application_portal": true}'
        }),
        ('Stripe', {
            'fields': ('stripe_product_id',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def plans_count(self, obj):
        return obj.plans.count()
    plans_count.short_description = 'Plans'
    
    def feature_flags_display(self, obj):
        if obj.feature_flags:
            features = [k for k, v in obj.feature_flags.items() if v]
            return ', '.join(features) if features else '-'
        return '-'
    feature_flags_display.short_description = 'Features'



class PlanInline(admin.TabularInline):
    model = Plan
    extra = 0
    fields = ['name', 'price_cents', 'currency', 'interval', 'trial_days', 'active']


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'product', 'formatted_price', 'interval', 'trial_days', 'active']
    list_filter = ['active', 'interval', 'product', 'currency']
    search_fields = ['name', 'product__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    raw_id_fields = ['product']


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ['tenant', 'plan', 'status', 'product_display', 'current_period_end', 'cancel_at_period_end', 'created_at']
    list_filter = ['status', 'cancel_at_period_end', 'plan__product', 'created_at']
    search_fields = ['tenant__name', 'tenant__slug', 'billing_contact__email', 'plan__name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    raw_id_fields = ['tenant', 'billing_contact', 'user', 'plan']
    
    fieldsets = (
        ('Subscription Info', {
            'fields': ('id', 'tenant', 'plan', 'status')
        }),
        ('Billing Contact', {
            'fields': ('billing_contact', 'user'),
            'description': 'Primary contact for billing. User is legacy field.'
        }),
        ('Billing Period', {
            'fields': ('start_date', 'current_period_start', 'current_period_end')
        }),
        ('Trial', {
            'fields': ('trial_start', 'trial_end'),
            'classes': ('collapse',)
        }),
        ('Cancellation', {
            'fields': ('cancel_at_period_end', 'canceled_at', 'ended_at'),
            'classes': ('collapse',)
        }),
        ('Stripe', {
            'fields': ('stripe_subscription_id', 'stripe_customer_id'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('metadata', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def product_display(self, obj):
        return obj.plan.product.name if obj.plan else '-'
    product_display.short_description = 'Product'


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ['user', 'product', 'amount_display', 'paid', 'created_at']
    list_filter = ['paid', 'product', 'currency', 'created_at']
    search_fields = ['user__email', 'product__name', 'payment_id']
    readonly_fields = ['id', 'created_at']
    raw_id_fields = ['user', 'product']
    
    def amount_display(self, obj):
        return f"{obj.currency} {obj.amount_cents / 100:.2f}"
    amount_display.short_description = 'Amount'


class PaymentLogInline(admin.TabularInline):
    model = PaymentLog
    extra = 0
    readonly_fields = ['gateway', 'gateway_payment_id', 'amount_cents', 'status', 'received_at']
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_no', 'user', 'total_display', 'status', 'issued_at', 'paid_at']
    list_filter = ['status', 'currency', 'issued_at']
    search_fields = ['invoice_no', 'user__email', 'stripe_invoice_id']
    readonly_fields = ['id', 'invoice_no', 'created_at', 'updated_at', 'pdf_link']
    raw_id_fields = ['user', 'subscription', 'purchase']
    inlines = [PaymentLogInline]
    
    def total_display(self, obj):
        return f"{obj.currency} {obj.total_cents / 100:.2f}"
    total_display.short_description = 'Total'
    
    def pdf_link(self, obj):
        if obj.pdf:
            return format_html('<a href="{}" target="_blank">Download PDF</a>', obj.pdf.url)
        return '-'
    pdf_link.short_description = 'PDF'
    
    fieldsets = (
        ('Invoice Info', {
            'fields': ('id', 'invoice_no', 'user', 'subscription', 'purchase')
        }),
        ('Amounts', {
            'fields': ('subtotal_cents', 'tax_cents', 'total_cents', 'currency')
        }),
        ('Status', {
            'fields': ('status', 'issued_at', 'due_at', 'paid_at', 'payment_method')
        }),
        ('Period', {
            'fields': ('period_start', 'period_end'),
            'classes': ('collapse',)
        }),
        ('Files & Stripe', {
            'fields': ('pdf', 'pdf_link', 'stripe_invoice_id', 'stripe_payment_intent_id'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('metadata', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['mark_paid', 'void_invoices']
    
    @admin.action(description='Mark selected invoices as paid')
    def mark_paid(self, request, queryset):
        updated = 0
        for invoice in queryset.filter(status__in=['draft', 'open']):
            invoice.mark_paid(payment_method='admin')
            updated += 1
        self.message_user(request, f'{updated} invoices marked as paid.')
    
    @admin.action(description='Void selected invoices')
    def void_invoices(self, request, queryset):
        updated = queryset.exclude(status='paid').update(status='void')
        self.message_user(request, f'{updated} invoices voided.')


@admin.register(PaymentLog)
class PaymentLogAdmin(admin.ModelAdmin):
    list_display = ['invoice', 'gateway', 'amount_display', 'status', 'received_at']
    list_filter = ['gateway', 'status', 'received_at']
    search_fields = ['invoice__invoice_no', 'gateway_payment_id']
    readonly_fields = ['id', 'created_at']
    raw_id_fields = ['invoice']
    
    def amount_display(self, obj):
        return f"{obj.currency} {obj.amount_cents / 100:.2f}"
    amount_display.short_description = 'Amount'


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'actor_email', 'target_type', 'target_id', 'created_at']
    list_filter = ['action', 'target_type', 'created_at']
    search_fields = ['actor_email', 'target_id', 'description']
    readonly_fields = [
        'id', 'actor', 'actor_email', 'action', 'target_type', 'target_id',
        'changes', 'description', 'ip_address', 'user_agent', 'created_at'
    ]
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ['event_id', 'source', 'event_type', 'processed', 'received_at']
    list_filter = ['source', 'event_type', 'processed', 'received_at']
    search_fields = ['event_id', 'event_type']
    readonly_fields = ['id', 'event_id', 'source', 'event_type', 'payload', 'processed', 'processed_at', 'error', 'received_at']
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
