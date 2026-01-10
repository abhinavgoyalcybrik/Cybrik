"""
Feature access utilities for tenant-based product access control.
Checks if a tenant has access to specific features based on their active subscriptions.
"""
from typing import List, Optional


def tenant_has_feature(tenant, feature_name: str) -> bool:
    """
    Check if a tenant has access to a specific feature based on their active subscriptions.
    
    Args:
        tenant: Tenant model instance
        feature_name: Name of the feature to check (e.g., 'crm', 'ielts_module', 'application_portal')
    
    Returns:
        True if tenant has an active subscription that includes this feature
    """
    if tenant is None:
        return False
    
    # Get all active subscriptions for this tenant
    active_subscriptions = tenant.subscriptions.filter(
        status__in=['active', 'trialing']
    ).select_related('plan__product')
    
    for subscription in active_subscriptions:
        product = subscription.plan.product
        if product.feature_flags.get(feature_name, False):
            return True
    
    return False


def get_tenant_features(tenant) -> dict:
    """
    Get all features available to a tenant based on their active subscriptions.
    
    Returns:
        Dictionary of feature_name: True for all enabled features
    """
    if tenant is None:
        return {}
    
    features = {}
    active_subscriptions = tenant.subscriptions.filter(
        status__in=['active', 'trialing']
    ).select_related('plan__product')
    
    for subscription in active_subscriptions:
        product = subscription.plan.product
        for feature, enabled in product.feature_flags.items():
            if enabled:
                features[feature] = True
    
    return features


def get_tenant_products(tenant) -> List[str]:
    """
    Get list of product names the tenant has active subscriptions for.
    
    Returns:
        List of product names
    """
    if tenant is None:
        return []
    
    active_subscriptions = tenant.subscriptions.filter(
        status__in=['active', 'trialing']
    ).select_related('plan__product')
    
    return list(set(sub.plan.product.name for sub in active_subscriptions))


def get_tenant_subscription_summary(tenant) -> dict:
    """
    Get a summary of all tenant subscriptions for display.
    
    Returns:
        {
            'products': ['CRM', 'IELTS Prep'],
            'features': {'crm': True, 'ielts_module': True},
            'subscriptions': [
                {'product': 'CRM', 'plan': 'Monthly', 'status': 'active', 'expires': datetime}
            ]
        }
    """
    if tenant is None:
        return {'products': [], 'features': {}, 'subscriptions': []}
    
    subscriptions = tenant.subscriptions.filter(
        status__in=['active', 'trialing', 'past_due']
    ).select_related('plan__product')
    
    products = []
    features = {}
    sub_list = []
    
    for sub in subscriptions:
        product = sub.plan.product
        products.append(product.name)
        
        for feature, enabled in product.feature_flags.items():
            if enabled:
                features[feature] = True
        
        sub_list.append({
            'id': str(sub.id),
            'product': product.name,
            'product_code': product.code,
            'plan': sub.plan.name,
            'status': sub.status,
            'current_period_end': sub.current_period_end,
            'cancel_at_period_end': sub.cancel_at_period_end,
        })
    
    return {
        'products': list(set(products)),
        'features': features,
        'subscriptions': sub_list,
    }
