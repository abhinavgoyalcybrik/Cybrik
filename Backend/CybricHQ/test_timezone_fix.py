#!/usr/bin/env python
"""
Test script to verify the timezone fix works
"""
import os
import sys
import django

# Add the project directory to Python path
sys.path.insert(0, '/home/deploy/cybrik/Backend/CybricHQ')

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')

# Configure Django
django.setup()

# Test the imports
from django.utils import timezone
from datetime import timedelta

print("✅ Django timezone import successful")
print("✅ Current time:", timezone.now())

# Test the nested function scenario
def test_nested_function():
    """Test nested function with timezone import"""
    from django.utils import timezone
    from datetime import timedelta

    def get_country_metrics():
        """Simulate the nested function"""
        six_months_ago = timezone.now() - timedelta(days=180)
        this_month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return six_months_ago, this_month_start

    result = get_country_metrics()
    print("✅ Nested function timezone calls successful")
    print("✅ Six months ago:", result[0])
    print("✅ This month start:", result[1])

test_nested_function()
print("✅ All timezone tests passed!")