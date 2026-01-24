from a_pm_rapi.models import *

# programs = Program.objects.all()
# task_types = ["Reminder", "Backlog", "Bug", "Feature Request"]

# for task_type in task_types:
#     for program in programs:
#         TaskType.objects.create(name = task_type, program = program, created_by = program.created_by, client = program.client)

task_types = TaskType.objects.filter(project__isnull=False)
for type in task_types:
    new_type = TaskType.objects.get(name=type.name, program = type.project.program)
    for task in Task.objects.filter(task_type=type).all():
        task.task_type = new_type
        task.save()
        
        

for type in task_types:
    type.delete()