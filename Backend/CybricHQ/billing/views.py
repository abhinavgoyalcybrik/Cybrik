# billing/views.py
"""
DRF ViewSets for billing management.
Security: Admin-only access with audit logging.
"""
import logging
from decimal import Decimal
from datetime import datetime, timedelta

from django.utils import timezone
from django.db.models import Sum, Count, Q
from django.db import transaction

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser

from .models import (
    Product, Plan, Subscription, Purchase, 
    Invoice, PaymentLog, AuditLog, WebhookEvent
)
from .services.razorpay_service import RazorpayService
from .serializers import (
    ProductSerializer, PlanSerializer, PlanListSerializer,
    SubscriptionSerializer, SubscriptionCreateSerializer,
    PurchaseSerializer, InvoiceSerializer, InvoiceCreateSerializer,
    PaymentLogSerializer, AuditLogSerializer, WebhookEventSerializer,
    MRRReportSerializer, RevenueByProductSerializer, ChurnReportSerializer
)

logger = logging.getLogger(__name__)


def serialize_for_audit(data):
    """Convert model instances and other non-JSON-serializable objects in a dict to strings."""
    from django.db.models import Model
    from uuid import UUID
    from decimal import Decimal
    
    if data is None:
        return None
    
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            result[key] = serialize_for_audit(value)
        return result
    elif isinstance(data, (list, tuple)):
        return [serialize_for_audit(item) for item in data]
    elif isinstance(data, Model):
        # Convert model instances to their string representation
        return str(data.pk)
    elif isinstance(data, UUID):
        return str(data)
    elif isinstance(data, Decimal):
        return float(data)
    elif hasattr(data, 'isoformat'):  # datetime, date
        return data.isoformat()
    else:
        return data


def create_audit_log(actor, action, target, changes=None, description='', request=None):
    """Helper to create audit log entries."""
    ip_address = None
    user_agent = ''
    
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
    
    # Serialize changes to ensure JSON compatibility
    serialized_changes = serialize_for_audit(changes) if changes else {}
    
    AuditLog.objects.create(
        actor=actor,
        action=action,
        target_type=target.__class__.__name__.lower(),
        target_id=str(target.pk),
        changes=serialized_changes,
        description=description,
        ip_address=ip_address,
        user_agent=user_agent
    )


class ProductViewSet(viewsets.ModelViewSet):
    """
    CRUD for Products. Admin only.
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by active status
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(active=active.lower() == 'true')
        return queryset
    
    def perform_create(self, serializer):
        product = serializer.save()
        create_audit_log(
            actor=self.request.user,
            action='product.created',
            target=product,
            changes=serializer.validated_data,
            request=self.request
        )
    
    def perform_update(self, serializer):
        old_data = ProductSerializer(serializer.instance).data
        product = serializer.save()
        create_audit_log(
            actor=self.request.user,
            action='product.updated',
            target=product,
            changes={'before': old_data, 'after': serializer.validated_data},
            request=self.request
        )


class PlanViewSet(viewsets.ModelViewSet):
    """
    CRUD for Plans. Admin only.
    """
    queryset = Plan.objects.select_related('product').all()
    # permission_classes removed to rely on get_permissions
    
    # Removed get_serializer_class to use PlanSerializer for all actions
    # This ensures the frontend receives all fields (product, price_cents, etc.)
    # needed for filtering and editing.
    serializer_class = PlanSerializer
    
    permission_classes = [AllowAny]
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [AllowAny()]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by product
        product_id = self.request.query_params.get('product')
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        
        # Filter by active
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(active=active.lower() == 'true')
        
        return queryset
    
    def perform_create(self, serializer):
        plan = serializer.save()
        create_audit_log(
            actor=self.request.user,
            action='plan.created',
            target=plan,
            changes=serializer.validated_data,
            request=self.request
        )
    
    def perform_update(self, serializer):
        old_data = PlanSerializer(serializer.instance).data
        plan = serializer.save()
        create_audit_log(
            actor=self.request.user,
            action='plan.updated',
            target=plan,
            changes={'before': old_data, 'after': serializer.validated_data},
            request=self.request
        )


class SubscriptionViewSet(viewsets.ModelViewSet):
    """
    Subscription management. Admin only.
    """
    queryset = Subscription.objects.select_related('user', 'plan', 'plan__product').all()
    permission_classes = [IsAdminUser]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return SubscriptionCreateSerializer
        return SubscriptionSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by user
        user_id = self.request.query_params.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by plan
        plan_id = self.request.query_params.get('plan')
        if plan_id:
            queryset = queryset.filter(plan_id=plan_id)
        
        return queryset
    
    def perform_create(self, serializer):
        subscription = serializer.save()
        create_audit_log(
            actor=self.request.user,
            action='subscription.created',
            target=subscription,
            description=f"Created subscription for {subscription.user.email}",
            request=self.request
        )
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a subscription."""
        subscription = self.get_object()
        
        # Get cancellation mode
        immediate = request.data.get('immediate', False)
        
        with transaction.atomic():
            if immediate:
                subscription.status = 'canceled'
                subscription.canceled_at = timezone.now()
                subscription.ended_at = timezone.now()
            else:
                subscription.cancel_at_period_end = True
                subscription.canceled_at = timezone.now()
            
            subscription.save()
            
            create_audit_log(
                actor=request.user,
                action='subscription.canceled',
                target=subscription,
                changes={'immediate': immediate},
                description=f"Subscription canceled {'immediately' if immediate else 'at period end'}",
                request=request
            )
        
        return Response({
            'message': 'Subscription canceled successfully',
            'ends_at': subscription.ended_at or subscription.current_period_end
        })
    
    @action(detail=True, methods=['post'])
    def change_plan(self, request, pk=None):
        """Change subscription to a different plan."""
        subscription = self.get_object()
        new_plan_id = request.data.get('plan_id')
        
        if not new_plan_id:
            return Response(
                {'error': 'plan_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            new_plan = Plan.objects.get(id=new_plan_id, active=True)
        except Plan.DoesNotExist:
            return Response(
                {'error': 'Plan not found or inactive'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        old_plan = subscription.plan
        
        with transaction.atomic():
            subscription.plan = new_plan
            subscription.save()
            
            create_audit_log(
                actor=request.user,
                action='subscription.updated',
                target=subscription,
                changes={'old_plan': str(old_plan.id), 'new_plan': str(new_plan.id)},
                description=f"Changed plan from {old_plan.name} to {new_plan.name}",
                request=request
            )
        
        return Response({
            'message': 'Plan changed successfully',
            'new_plan': PlanSerializer(new_plan).data
        })
    
    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        """Reactivate a canceled subscription."""
        subscription = self.get_object()
        
        if subscription.status not in ['canceled', 'paused']:
            return Response(
                {'error': 'Only canceled or paused subscriptions can be reactivated'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            subscription.status = 'active'
            subscription.cancel_at_period_end = False
            subscription.canceled_at = None
            subscription.ended_at = None
            subscription.save()
            
            create_audit_log(
                actor=request.user,
                action='subscription.updated',
                target=subscription,
                description='Subscription reactivated',
                request=request
            )
        
        return Response({'message': 'Subscription reactivated successfully'})


class PurchaseViewSet(viewsets.ModelViewSet):
    """
    One-time purchase management. Admin only.
    """
    queryset = Purchase.objects.select_related('user', 'product').all()
    serializer_class = PurchaseSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by user
        user_id = self.request.query_params.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by paid status
        paid = self.request.query_params.get('paid')
        if paid is not None:
            queryset = queryset.filter(paid=paid.lower() == 'true')
        
        return queryset


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    Invoice management. Admin only.
    """
    queryset = Invoice.objects.select_related('user', 'subscription', 'subscription__plan').all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by user
        user_id = self.request.query_params.get('user')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Date range filters
        start_date = self.request.query_params.get('start')
        end_date = self.request.query_params.get('end')
        if start_date:
            queryset = queryset.filter(issued_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(issued_at__lte=end_date)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Manually mark an invoice as paid."""
        invoice = self.get_object()
        
        if invoice.status == 'paid':
            return Response(
                {'error': 'Invoice is already paid'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payment_method = request.data.get('payment_method', 'manual')
        notes = request.data.get('notes', '')
        
        with transaction.atomic():
            invoice.mark_paid(payment_method=payment_method)
            
            # Create payment log
            PaymentLog.objects.create(
                invoice=invoice,
                gateway='manual',
                amount_cents=invoice.total_cents,
                currency=invoice.currency,
                status='succeeded',
                raw_response={'notes': notes, 'marked_by': request.user.email}
            )
            
            create_audit_log(
                actor=request.user,
                action='invoice.paid',
                target=invoice,
                changes={'payment_method': payment_method, 'notes': notes},
                description=f"Invoice {invoice.invoice_no} marked as paid manually",
                request=request
            )
        
        return Response({
            'message': 'Invoice marked as paid',
            'invoice_no': invoice.invoice_no,
            'paid_at': invoice.paid_at
        })
    
    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        """Void an invoice."""
        invoice = self.get_object()
        
        if invoice.status == 'paid':
            return Response(
                {'error': 'Cannot void a paid invoice'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            invoice.status = 'void'
            invoice.save()
            
            create_audit_log(
                actor=request.user,
                action='invoice.voided',
                target=invoice,
                description=f"Invoice {invoice.invoice_no} voided",
                request=request
            )
        
        return Response({'message': 'Invoice voided successfully'})
    
    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Get invoice PDF."""
        invoice = self.get_object()
        
        if not invoice.pdf:
            # Generate PDF on demand
            from .tasks import generate_invoice_pdf
            try:
                generate_invoice_pdf(invoice.id)
                invoice.refresh_from_db()
            except Exception as e:
                logger.error(f"PDF generation failed: {e}")
                return Response(
                    {'error': 'PDF generation failed'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        if invoice.pdf:
            return Response({
                'pdf_url': request.build_absolute_uri(invoice.pdf.url)
            })
        
        return Response(
            {'error': 'PDF not available'},
            status=status.HTTP_404_NOT_FOUND
        )


class PaymentLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only view of payment logs. Admin only.
    """
    queryset = PaymentLog.objects.select_related('invoice').all()
    serializer_class = PaymentLogSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by invoice
        invoice_id = self.request.query_params.get('invoice')
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        
        # Filter by gateway
        gateway = self.request.query_params.get('gateway')
        if gateway:
            queryset = queryset.filter(gateway=gateway)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only audit log. Admin only.
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by action
        action_filter = self.request.query_params.get('action')
        if action_filter:
            queryset = queryset.filter(action=action_filter)
        
        # Filter by target
        target_type = self.request.query_params.get('target_type')
        if target_type:
            queryset = queryset.filter(target_type=target_type)
        
        target_id = self.request.query_params.get('target_id')
        if target_id:
            queryset = queryset.filter(target_id=target_id)
        
        # Date range
        start_date = self.request.query_params.get('start')
        end_date = self.request.query_params.get('end')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        return queryset


class ReportsViewSet(viewsets.ViewSet):
    """
    Reporting endpoints. Admin only.
    """
    permission_classes = [IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def mrr(self, request):
        """Get Monthly Recurring Revenue report."""
        # Get date range from query params
        end_date = request.query_params.get('end', timezone.now().date().isoformat())
        start_date = request.query_params.get('start', (timezone.now() - timedelta(days=365)).date().isoformat())
        
        # Calculate MRR from active subscriptions
        active_subs = Subscription.objects.filter(
            status__in=['active', 'trialing'],
        ).select_related('plan')
        
        mrr = Decimal('0')
        for sub in active_subs:
            plan = sub.plan
            if plan.interval == 'month':
                mrr += plan.price_cents / Decimal('100')
            elif plan.interval == 'year':
                mrr += plan.price_cents / Decimal('1200')  # Yearly to monthly
            elif plan.interval == 'week':
                mrr += (plan.price_cents * Decimal('4.33')) / Decimal('100')
            elif plan.interval == 'day':
                mrr += (plan.price_cents * Decimal('30')) / Decimal('100')
        
        arr = mrr * 12
        
        # Count new and churned in period
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
        
        new_subs = Subscription.objects.filter(
            created_at__gte=start_dt,
            created_at__lte=end_dt
        ).count()
        
        churned_subs = Subscription.objects.filter(
            status='canceled',
            canceled_at__gte=start_dt,
            canceled_at__lte=end_dt
        ).count()
        
        return Response({
            'period': f"{start_date} to {end_date}",
            'mrr': float(mrr),
            'arr': float(arr),
            'active_subscriptions': active_subs.count(),
            'new_subscriptions': new_subs,
            'churned_subscriptions': churned_subs,
            'currency': 'USD'
        })
    
    @action(detail=False, methods=['get'], url_path='revenue-by-product')
    def revenue_by_product(self, request):
        """Get revenue breakdown by product."""
        start_date = request.query_params.get('start')
        end_date = request.query_params.get('end')
        
        invoices = Invoice.objects.filter(status='paid')
        
        if start_date:
            invoices = invoices.filter(paid_at__gte=start_date)
        if end_date:
            invoices = invoices.filter(paid_at__lte=end_date)
        
        # Aggregate by product
        products = Product.objects.all()
        total_revenue = invoices.aggregate(total=Sum('total_cents'))['total'] or 0
        
        result = []
        for product in products:
            product_invoices = invoices.filter(
                subscription__plan__product=product
            )
            revenue = product_invoices.aggregate(total=Sum('total_cents'))['total'] or 0
            count = product_invoices.count()
            
            percentage = (Decimal(revenue) / Decimal(total_revenue) * 100) if total_revenue else 0
            
            result.append({
                'product_id': str(product.id),
                'product_name': product.name,
                'revenue': float(Decimal(revenue) / 100),
                'invoices_count': count,
                'percentage': float(percentage)
            })
        
        return Response({
            'data': result,
            'total_revenue': float(Decimal(total_revenue) / 100),
            'currency': 'USD'
        })
    
    @action(detail=False, methods=['get'])
    def churn(self, request):
        """Get churn metrics."""
        end_date = request.query_params.get('end', timezone.now().date().isoformat())
        start_date = request.query_params.get('start', (timezone.now() - timedelta(days=30)).date().isoformat())
        
        start_dt = datetime.fromisoformat(start_date)
        end_dt = datetime.fromisoformat(end_date)
        
        # Subscriptions at start of period
        total_at_start = Subscription.objects.filter(
            created_at__lt=start_dt,
            status__in=['active', 'trialing', 'canceled']
        ).exclude(
            canceled_at__lt=start_dt
        ).count()
        
        # Churned during period
        churned = Subscription.objects.filter(
            status='canceled',
            canceled_at__gte=start_dt,
            canceled_at__lte=end_dt
        )
        
        churned_count = churned.count()
        churn_rate = (Decimal(churned_count) / Decimal(total_at_start) * 100) if total_at_start else 0
        
        # Calculate churned MRR
        churned_mrr = Decimal('0')
        for sub in churned.select_related('plan'):
            plan = sub.plan
            if plan.interval == 'month':
                churned_mrr += plan.price_cents / Decimal('100')
            elif plan.interval == 'year':
                churned_mrr += plan.price_cents / Decimal('1200')
        
        return Response({
            'period': f"{start_date} to {end_date}",
            'churned_count': churned_count,
            'total_at_start': total_at_start,
            'churn_rate': float(churn_rate),
            'churned_mrr': float(churned_mrr),
            'currency': 'USD'
        })
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get overall billing summary."""
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Active subscriptions
        active_subs = Subscription.objects.filter(status__in=['active', 'trialing']).count()
        
        # This month's revenue
        month_revenue = Invoice.objects.filter(
            status='paid',
            paid_at__gte=month_start
        ).aggregate(total=Sum('total_cents'))['total'] or 0
        
        # Pending invoices
        pending_invoices = Invoice.objects.filter(status='open').count()
        pending_amount = Invoice.objects.filter(status='open').aggregate(total=Sum('total_cents'))['total'] or 0
        
        # Overdue invoices
        overdue = Invoice.objects.filter(
            status='open',
            due_at__lt=now
        ).count()
        
        return Response({
            'active_subscriptions': active_subs,
            'month_revenue': float(Decimal(month_revenue) / 100),
            'pending_invoices': pending_invoices,
            'pending_amount': float(Decimal(pending_amount) / 100),
            'overdue_invoices': overdue,
            'currency': 'USD'
        })


class RazorpayViewSet(viewsets.ViewSet):
    """
    Handle Razorpay payment flow.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def initiate_payment(self, request):
        """
        Create a Purchase record and a Razorpay Order.
        """
        product_id = request.data.get('product_id')
        plan_id = request.data.get('plan_id')
        
        # Validation
        if not product_id and not plan_id:
            return Response(
                {"error": "Either product_id or plan_id is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        amount_cents = 0
        currency = 'INR'  # Razorpay default
        description = ""
        metadata = {}

        try:
            if plan_id:
                plan = Plan.objects.get(id=plan_id)
                amount_cents = plan.price_cents
                currency = plan.currency
                description = f"Subscription to {plan.name}"
                metadata['plan_id'] = str(plan_id)
                metadata['type'] = 'subscription'
            elif product_id:
                product = Product.objects.get(id=product_id)
                # For fixed price products
                return Response(
                    {"error": "Direct product purchase not yet supported, please select a plan"},
                     status=status.HTTP_400_BAD_REQUEST
                )
        except (Plan.DoesNotExist, Product.DoesNotExist):
            return Response({"error": "Invalid product or plan"}, status=status.HTTP_404_NOT_FOUND)

        # Create Purchase Record (Unpaid)
        with transaction.atomic():
            try:
                purchase = Purchase.objects.create(
                    user=request.user,
                    product=plan.product if plan_id else None,
                    amount_cents=amount_cents,
                    currency=currency,
                    paid=False,
                    payment_method='razorpay',
                    metadata=metadata
                )
            except Exception as e:
                logger.error(f"Failed to create Purchase record: {e}")
                return Response({"error": f"Database error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Create Razorpay Order
            rzp = RazorpayService()
            try:
                # Razorpay expects amount in paise (100 paise = 1 INR)
                # Ensure amount_cents is treated as such
                order = rzp.create_order(
                    amount=amount_cents, 
                    currency=currency, 
                    receipt=str(purchase.id),
                    notes={'user_email': request.user.email, 'purchase_id': str(purchase.id)}
                )
            except Exception as e:
                logger.error(f"Razorpay Order Creation Failed: {e}")
                purchase.delete() # Rollback
                return Response(
                    {"error": "Failed to create payment order"}, 
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            # Save Order ID to Purchase metadata
            purchase.payment_id = order['id'] # Store format: order_xxxx
            purchase.save()

            return Response({
                'order_id': order['id'],
                'key_id': settings.RAZORPAY_KEY_ID,
                'amount': amount_cents,
                'currency': currency,
                'name': "Cybrik IELTS",
                'description': description,
                'prefill': {
                    'name': request.user.get_full_name(),
                    'email': request.user.email,
                },
                'purchase_id': purchase.id
            })

    @action(detail=False, methods=['post'])
    def verify_payment(self, request):
        """
        Verify Razorpay signature and mark purchase as paid.
        """
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_signature = request.data.get('razorpay_signature')

        if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
            return Response(
                {"error": "Missing verification parameters"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        rzp = RazorpayService()
        if rzp.verify_payment_signature(razorpay_payment_id, razorpay_order_id, razorpay_signature):
            try:
                purchase = Purchase.objects.get(payment_id=razorpay_order_id)
            except Purchase.DoesNotExist:
                 return Response(
                    {"error": "Purchase not found for this order"}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            if purchase.paid:
                 return Response({"status": "already_paid"})

            # Mark as Paid
            with transaction.atomic():
                purchase.paid = True
                purchase.paid_at = timezone.now()
                purchase.metadata['razorpay_payment_id'] = razorpay_payment_id
                purchase.save()

                # Create PaymentLog
                PaymentLog.objects.create(
                    invoice=None,
                    gateway='razorpay',
                    gateway_payment_id=razorpay_payment_id,
                    amount_cents=purchase.amount_cents,
                    currency=purchase.currency,
                    status='succeeded',
                    raw_response=request.data
                )
                
                # Create Invoice
                Invoice.objects.create(
                    user=purchase.user,
                    purchase=purchase,
                    total_cents=purchase.amount_cents,
                    currency=purchase.currency,
                    status='paid',
                    paid_at=timezone.now(),
                    payment_method='razorpay'
                )
                
                return Response({"status": "success"})
        else:
            return Response(
                {"error": "Signature verification failed"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
