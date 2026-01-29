import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from crm_app.models import Applicant, Lead

print(f'Total applicants: {Applicant.objects.count()}')
apps_with_country = Applicant.objects.exclude(preferred_country__isnull=True).exclude(preferred_country='')
print(f'With preferred_country: {apps_with_country.count()}')
if apps_with_country.exists():
    countries = list(apps_with_country.values_list('preferred_country', flat=True).distinct()[:10])
    print(f'Countries: {countries}')
    
print(f'\nTotal leads: {Lead.objects.count()}')
leads_with_country = Lead.objects.exclude(country__isnull=True).exclude(country='')
print(f'With country: {leads_with_country.count()}')
