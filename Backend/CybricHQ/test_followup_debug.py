import os
import django
import sys
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from crm_app.models import FollowUp
from crm_app.tasks import check_and_initiate_followups

print("--- Debugging FollowUps ---")
now = timezone.now()
print(f"Current Server Time (UTC): {now}")

# Check for pending tasks
pending = FollowUp.objects.filter(
    completed=False,
    channel__in=['ai_call', 'phone'],
    status__in=['pending', 'scheduled']
)
print(f"Total Pending/Scheduled AI/Phone tasks: {pending.count()}")

# Check for DUE tasks
due = pending.filter(due_at__lte=now)
print(f"Due Tasks (due_at <= now): {due.count()}")

if due.exists():
    print("Listing first 5 due tasks:")
    for task in due[:5]:
        print(f" - ID: {task.id}, Due: {task.due_at}, Lead: {task.lead_id or task.crm_lead_id}")

print("\n--- Running Task Manually ---")
try:
    result = check_and_initiate_followups()
    print(f"Task Result: {result}")
except Exception as e:
    print(f"Task Crashed: {e}")
    import traceback
    traceback.print_exc()

print("Done.")
