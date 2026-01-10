from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group

class Command(BaseCommand):
    help = "create_crm_user <username> <email> <role> [--password=pw]"

    def add_arguments(self, parser):
        parser.add_argument("username")
        parser.add_argument("email")
        parser.add_argument("role", choices=["SuperAdmin","Admin","Counsellor"])
        parser.add_argument("--password", default=None)

    def handle(self, *args, **options):
        username = options["username"]
        email = options["email"]
        role = options["role"]
        password = options["password"] or User.objects.make_random_password()
        user, created = User.objects.get_or_create(username=username, defaults={"email": email})
        if created:
            user.set_password(password)
            user.is_staff = role in ["Admin","SuperAdmin"]
            user.is_superuser = role == "SuperAdmin"
            user.save()
        else:
            if options["password"]:
                user.set_password(password)
                user.save()
        grp = Group.objects.get(name=role)
        user.groups.clear()
        user.groups.add(grp)
        self.stdout.write(self.style.SUCCESS(f"User {username} created/updated with role {role}. Password: {password}"))
