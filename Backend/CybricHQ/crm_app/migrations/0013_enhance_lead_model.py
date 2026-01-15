# Generated migration for Lead model enhancements and optional Lead ForeignKey

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('crm_app', '0012_tenantsettings_elevenlabs_agent_id_and_more'),
    ]

    operations = [
        # Add new fields to Lead model
        migrations.AddField(
            model_name='lead',
            name='first_name',
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='last_name',
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='dob',
            field=models.DateField(blank=True, help_text='Date of Birth', null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='passport_number',
            field=models.CharField(blank=True, max_length=128, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='address',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='preferred_country',
            field=models.CharField(blank=True, max_length=128, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='stage',
            field=models.CharField(default='new', max_length=64),
        ),
        migrations.AddField(
            model_name='lead',
            name='profile_completeness_score',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='lead',
            name='qualification_status',
            field=models.CharField(default='pending', max_length=64),
        ),
        migrations.AddField(
            model_name='lead',
            name='counseling_notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='metadata',
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='created_at',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name='lead',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        
        # Make applicant optional on Document
        migrations.AlterField(
            model_name='document',
            name='applicant',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='crm_app.applicant'),
        ),
        # Add lead to Document
        migrations.AddField(
            model_name='document',
            name='lead',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='documents', to='crm_app.lead'),
        ),
        
        # Make applicant optional on AcademicRecord
        migrations.AlterField(
            model_name='academicrecord',
            name='applicant',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='academic_records', to='crm_app.applicant'),
        ),
        # Add lead to AcademicRecord
        migrations.AddField(
            model_name='academicrecord',
            name='lead',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='academic_records', to='crm_app.lead'),
        ),
        
        # Make applicant optional on Application
        migrations.AlterField(
            model_name='application',
            name='applicant',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='applications', to='crm_app.applicant'),
        ),
        # Add lead to Application
        migrations.AddField(
            model_name='application',
            name='lead',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='applications', to='crm_app.lead'),
        ),
    ]
