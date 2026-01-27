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





        # --- TEST REPLY CREATION ---
        print("--- TESTING REPLY CREATION ---")
        try:
            # Find a ticket for this user
            test_ticket = SupportTicket.objects.filter(user=info_user).first()
            if test_ticket:
                print(f"Attempting to create reply on ticket {test_ticket.id}")
                
                # Simulate logic in view
                is_admin = info_user.is_staff or info_user.is_superuser
                
                reply = TicketReply.objects.create(
                    ticket=test_ticket,
                    user=info_user,
                    message="Debug auto-reply test",
                    is_admin=is_admin
                )
                print(f"SUCCESS: Reply created with ID {reply.id}")
                print(f"is_admin: {reply.is_admin}")
                print(f"is_read: {reply.is_read}")
                
                # Cleanup
                reply.delete()
                print("Test reply deleted.")
            else:
                print("No tickets found to test reply on.")
        except Exception as e:
            print(f"FAILED to create reply: {e}")
            import traceback
            traceback.print_exc()

print("--------------------------------")
