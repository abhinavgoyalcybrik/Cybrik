import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from ielts_service.models import SupportTicket, TicketReply
from django.contrib.auth import get_user_model

User = get_user_model()

print("--- DEBUG NOTIFICATION STATE ---")


print("--- CHECKING USER STATUS ---")
try:
    info_user = User.objects.get(email__startswith='info')
    print(f"User: {info_user.email}")
    print(f"ID: {info_user.id}")
    print(f"is_staff: {info_user.is_staff}")
    print(f"is_superuser: {info_user.is_superuser}")
    
    # Check tickets for this user
    user_tickets = SupportTicket.objects.filter(user=info_user)
    print(f"Tickets by this user: {user_tickets.count()}")
    for t in user_tickets:
        print(f" - Ticket {t.id} Read: {t.is_read}")

except User.DoesNotExist:
    print("User starting with 'info' not found")

print("--------------------------------")


admin_unread_replies = TicketReply.objects.filter(is_read=False, is_admin=False)
print(f"Replies from Students (Unread for Admin): {admin_unread_replies.count()}")

student_unread_replies = TicketReply.objects.filter(is_read=False, is_admin=True)
print(f"Replies from Admin (Unread for Student): {student_unread_replies.count()}")

print("--------------------------------")
