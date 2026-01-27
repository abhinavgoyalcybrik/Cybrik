import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from ielts_service.models import SupportTicket, TicketReply
from django.contrib.auth import get_user_model

User = get_user_model()

print("--- DEBUG NOTIFICATION STATE ---")


print("--- CHECKING USER STATUS ---")
users = User.objects.filter(email__startswith='info')
if not users.exists():
    print("User starting with 'info' not found")
else:
    for info_user in users:
        print(f"\nUser: {info_user.email}")
        print(f"ID: {info_user.id}")
        print(f"is_staff: {info_user.is_staff}")
        print(f"is_superuser: {info_user.is_superuser}")
        
        # Check tickets for this user
        user_tickets = SupportTicket.objects.filter(user=info_user)
        print(f"Tickets by this user: {user_tickets.count()}")
        
        # Simulate View Logic
        print("--- VIEW LOGIC SIMULATION ---")
        if info_user.is_staff or info_user.is_superuser:
            print("User is treated as ADMIN")
            # Admin Notification Logic
            count = SupportTicket.objects.filter(status__in=['open', 'in_progress']).count()
            print(f"Admin Count (Open/InProgress): {count}")
        else:
            print("User is treated as STUDENT")
            # Student Notification Logic
            count = TicketReply.objects.filter(ticket__user=info_user, is_admin=True, is_read=False).count()
            print(f"Student Count (Unread Admin Replies): {count}")


print("--------------------------------")
print(f"Replies from Students (Unread for Admin): {admin_unread_replies.count()}")

student_unread_replies = TicketReply.objects.filter(is_read=False, is_admin=True)
print(f"Replies from Admin (Unread for Student): {student_unread_replies.count()}")

print("--------------------------------")
