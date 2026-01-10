"""
Tenant-aware mixins for ViewSets and QuerySets.
Provides automatic tenant filtering for all data models.
"""
from django.db import models


class TenantQuerySetMixin:
    """
    Mixin for ViewSets to automatically filter queryset by request.tenant.
    
    Usage:
        class ApplicantViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
            queryset = Applicant.objects.all()
            ...
    """
    
    def get_queryset(self):
        """Filter queryset by the current request's tenant."""
        queryset = super().get_queryset()
        tenant = getattr(self.request, 'tenant', None)
        
        if tenant:
            # Only return data belonging to this tenant
            return queryset.filter(tenant=tenant)
        
        # If user is superuser without tenant, they can see all
        if hasattr(self.request, 'user') and self.request.user.is_authenticated:
            if self.request.user.is_superuser:
                return queryset
        
        # No tenant and not superuser = no data (security)
        return queryset.none()
    
    def perform_create(self, serializer):
        """Automatically set tenant when creating new objects."""
        tenant = getattr(self.request, 'tenant', None)
        
        # If the model has a tenant field, set it automatically
        if tenant and hasattr(serializer.Meta.model, 'tenant'):
            serializer.save(tenant=tenant)
        else:
            serializer.save()


class TenantModelMixin(models.Model):
    """
    Abstract mixin to add tenant FK to a model.
    
    Usage:
        class MyModel(TenantModelMixin, models.Model):
            name = models.CharField(...)
    """
    tenant = models.ForeignKey(
        'crm_app.Tenant',
        on_delete=models.CASCADE,
        related_name='%(class)ss',  # e.g., 'applicants' for Applicant model
        null=True,
        blank=True,
        help_text="Tenant this record belongs to"
    )
    
    class Meta:
        abstract = True


class TenantManager(models.Manager):
    """
    Custom manager that can filter by tenant.
    
    Usage:
        class Applicant(models.Model):
            objects = TenantManager()
    """
    
    def for_tenant(self, tenant):
        """Return queryset filtered by tenant."""
        if tenant:
            return self.filter(tenant=tenant)
        return self.none()
    
    def get_queryset(self):
        return super().get_queryset()
