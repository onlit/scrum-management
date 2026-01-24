# Generated manually to sync status choices with model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('a_pm_rapi', '0135_migrate_bug_statuses'),
    ]

    operations = [
        migrations.AlterField(
            model_name='bug',
            name='status',
            field=models.CharField(
                choices=[
                    ('Unassigned', 'Unassigned'),
                    ('Clarify', 'Clarify'),
                    ('Backlog', 'Backlog'),
                    ('WIP', 'WIP'),
                    ('Failed Testing', 'Failed Testing'),
                    ('Awaiting Sandbox Deploy', 'Awaiting Sandbox Deploy'),
                    ('Ready for Sandbox Testing', 'Ready for Sandbox Testing'),
                    ('Awaiting Prod Deploy', 'Awaiting Prod Deploy'),
                    ('Ready for Prod Testing', 'Ready for Prod Testing'),
                    ('Fixed', 'Fixed'),
                    ('Archived', 'Archived'),
                ],
                default='Unassigned',
                max_length=30,
                null=True
            ),
        ),
    ]
