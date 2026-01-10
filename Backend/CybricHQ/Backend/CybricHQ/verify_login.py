import os
import django
import sys
import getpass

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from django.contrib.auth import authenticate, get_user_model

User = get_user_model()

def test_login():
    print("\n=== Login Verification Tool ===")
    print("This tool tests authentication directly using the Django backend logic.\n")
    
    username_input = input("Enter Username (or Email): ").strip()
    password_input = getpass.getpass("Enter Password: ").strip()
    
    print(f"\nAttempting authentication for: '{username_input}'...")
    
    # 1. Try Standard Authentication
    user = authenticate(username=username_input, password=password_input)
    
    if user:
        print(f"\n✅ SUCCESS! Authenticated as: {user.username} (ID: {user.id})")
        print(f"   User is active: {user.is_active}")
        print("   This username/password combination is CORRECT.")
    else:
        print("\n❌ FAILED. Authentication returned None.")
        
        # 2. Debugging Analysis
        print("\n--- Diagnostics ---")
        
        # Check if user exists by Username
        try:
            u_obj = User.objects.get(username=username_input)
            print(f"1. Username '{username_input}': FOUND in database.")
            if u_obj.check_password(password_input):
                print("   Password check: PASSED.")
                if not u_obj.is_active:
                    print("   ⚠️ User is INACTIVE. This is why login fails.")
            else:
                print("   Password check: FAILED. (Wrong password)")
        except User.DoesNotExist:
            print(f"1. Username '{username_input}': NOT FOUND in database.")
            
            # Check if it might be an Email
            if '@' in username_input:
                try:
                    u_email = User.objects.get(email=username_input)
                    print(f"2. Email '{username_input}': FOUND user with this email (Username: '{u_email.username}').")
                    print("   ⚠️ Login with Email is DISABLED. You must use the Username above.")
                except User.DoesNotExist:
                    print(f"2. Email '{username_input}': NOT FOUND in database.")
                except User.MultipleObjectsReturned:
                    print(f"2. Email '{username_input}': Found MULTIPLE users with this email.")

    print("\n===============================")

if __name__ == "__main__":
    test_login()
