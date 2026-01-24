from django.test import TestCase
from django.urls import reverse
from django.conf import settings
from faker import Faker
import faker
import requests
import random
from .models import TaskStatus


class ViewsTestCase(TestCase):
    fake = Faker()

    data = {
        "username" : fake.name().replace(" ", ""),
        "email" : "testcase@testcase.com",
        "password" : fake.password(),
    }


    def test_main(self):

        for i in range(4):
            TaskStatus.objects.create(name = self.fake.name(), description = self.fake.text()).save()

        #auth

        self.register()
        self.login()

        # create -|- retrieve

        self.get_task_status_choices()
        self.create_new_program()
        self.get_programs()
        self.get_specific_program()
        self.create_new_resource()
        self.get_resources()
        self.get_specific_resource()
        self.get_resource_choices()
        self.create_new_work_code()
        self.get_work_codes()
        self.get_specific_workcode()
        self.get_work_code_choices()
        self.create_new_role()
        self.get_roles()
        self.get_specific_role()
        self.create_new_project()
        self.get_projects()
        self.get_specific_project()
        self.create_new_hlr()
        self.get_hlrs()
        self.get_specific_hlr()
        self.create_new_sprint()
        self.get_project_sprints()
        self.get_specific_sprint()
        self.get_sprint_choices()
        self.create_new_persona()
        self.get_project_personas()
        self.get_specific_persona()
        self.get_persona_choices()
        self.create_new_backlog()
        self.get_project_backlogs()
        self.get_specific_backlog()
        self.get_backlog_choices()
        self.create_new_task()
        self.get_project_tasks()
        self.get_specific_task()
        self.get_task_choices()
        self.create_new_comment()
        self.get_task_comments()
        self.create_new_acceptance_criteria()
        self.get_task_acceptance_criteria()
        self.create_new_task_resource()
        self.get_task_resources()
        self.get_specific_task_resource()
        self.create_new_working_time()
        self.get_working_time()
        self.get_specific_working_time()
        self.create_new_timesheet()
        self.get_timesheets()
        self.get_specific_timesheet()
        self.create_new_artifact()
        self.get_artifact()
        self.create_new_stakeholder()
        self.get_stakeholder()
        self.get_specific_stakeholder()

        # update

        self.edit_specific_program()
        self.edit_specific_resource()
        self.edit_specific_work_code()
        self.edit_specific_role()
        self.edit_specific_project()
        self.edit_specific_hlr()
        self.edit_specific_sprint()
        self.edit_specific_persona()
        self.edit_specific_backlog()
        self.edit_specific_task()
        self.edit_specific_task_resource()
        self.edit_specific_working_time()
        self.edit_specific_timesheet()
        self.edit_specific_artifact()
        self.edit_specific_stakeholder()

        # delete

        self.delete_specific_task_resource()
        self.delete_specific_artifact()
        self.delete_specific_task()
        self.delete_specific_backlog()
        self.delete_specific_sprint()
        self.delete_specific_persona()
        self.delete_specific_stakeholder()
        self.delete_specific_working_time()
        self.delete_specific_hlr()
        self.delete_specific_project()
        self.delete_specific_role()
        self.delete_specific_workcode()
        self.delete_specific_resource()

    def register(self):
        response = requests.post(settings.AUTH_HOST + "accounts/register/", self.data)
        self.assertEqual(response.status_code, 201)

    def login(self):
        response = requests.post(settings.AUTH_HOST + "accounts/login/", self.data)
        self.assertEqual(response.status_code, 200)
        json = response.json()
        self.refresh = json.get("refresh")
        self.access = json.get("access")

    def auth_header(self):
        return {
            "Authorization": f"Bearer {self.access}"
        }

    def create_new_program(self):
        ''' create new program '''

        url = f"{settings.RAPI_HOST}programs/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
        }

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_programs(self):
        ''' get all program lists '''

        url = f"{settings.RAPI_HOST}programs/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)
        self.programs = response.json()[0]["id"]

    def get_specific_program(self):
        ''' grep data of specific program '''

        url = settings.RAPI_HOST + "program/" + self.programs + "/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def create_new_project(self):
        ''' create new project '''

        url = settings.RAPI_HOST + self.programs + "/project/"

        data = {
            "name": "TestCaseProject",
            "description": "TestCaseProject",
            "start_date": "2020-10-20",
            "template": True,
        }

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_projects(self):
        ''' get all program lists '''

        url = settings.RAPI_HOST + "projects/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.project = response.json()[0]["id"]

    def get_specific_project(self):
        ''' grep data of specific project '''

        url = settings.RAPI_HOST + f"project/{ self.project }/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def create_new_hlr(self):
        ''' create new hlr '''

        url = settings.RAPI_HOST + f"hlr/{ self.project }/"


        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
        }

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_hlrs(self):
        ''' get all hrl lists '''
        
        url = settings.RAPI_HOST + "hlr/"
        
        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.hlr = response.json()[0]["id"]

    def get_specific_hlr(self):
        ''' get specific hlr '''

        url = settings.RAPI_HOST + f"{ self.hlr }/hlr/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_hlr(self):
        ''' update hlr '''

        url = settings.RAPI_HOST + f"{ self.hlr }/hlr/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
        }

        response = requests.put(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_specific_role(self):
        ''' get specific role '''

        url = settings.RAPI_HOST + f"{ self.role }/role/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_specific_backlog(self):
        ''' get specific backlog '''

        url = settings.RAPI_HOST + f"{ self.project }/{ self.backlog }/backlog/retrieve/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_specific_stakeholder(self):
        ''' get specific stakeholder '''

        url = settings.RAPI_HOST + f"stakeholder/{ self.stakeholder }/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_specific_timesheet(self):
        ''' get specific timesheet '''

        url = settings.RAPI_HOST + f"{ self.timesheet }/time/sheet/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_specific_resource(self):
        ''' get specific resource '''

        url = settings.RAPI_HOST + f"{ self.resource }/resource/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_resources(self):
        ''' give you all resources! '''

        url = settings.RAPI_HOST + "resources/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.resource = response.json()[0]["id"]

    def create_new_resource(self):
        ''' create new resource '''

        url = settings.RAPI_HOST + "resources/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "cost": 777,
            "email": self.fake.email(),
            "mobile": "+923335189005",
            "landline": "+923335189005",
        }

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_work_codes(self):
        ''' get work code '''

        url = settings.RAPI_HOST + "work/code/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.workcode = response.json()[0]["id"]

    def get_specific_workcode(self):
        ''' get specific workcode '''

        url = settings.RAPI_HOST + f"{ self.workcode }/work/code/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_specific_sprint(self):
        ''' get_specific_sprint '''

        url = settings.RAPI_HOST + f"{ self.sprint }/sprint/retrieve/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_specific_persona(self):
        ''' get_specific_persona '''

        url = settings.RAPI_HOST + f"persona/{ self.persona }/{ self.project }/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def create_new_work_code(self):
        ''' create new work code '''

        url = settings.RAPI_HOST + "work/code/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "billable": True,
        }

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_timesheets(self):
        ''' get all timesheets '''

        url = settings.RAPI_HOST + "time/sheet/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.timesheet = response.json()[0]["id"]

    def get_task_choices(self):
        ''' get tasks and return back chocies for form '''

        self.task_choices = []

        url = settings.RAPI_HOST + "tasks/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        tasks = response.json()

        for task in tasks:
            self.task_choices.append(task["id"])

    def get_resource_choices(self):
        ''' get resources and return back to form as a chocies '''
        
        self.resource_choices = []

        url = settings.RAPI_HOST + "resources/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)
        resources = response.json()

        for resource in resources:
            self.resource_choices.append(resource["id"])

    def get_work_code_choices(self):
        ''' get resources and return back to form as a chocies '''
        
        self.workcode_choices = []

        url = settings.RAPI_HOST + "work/code/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        workcodes = response.json()

        for workcode in workcodes:
            self.workcode_choices.append(workcode["id"])

    def create_new_timesheet(self):
        ''' create new timesheet '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "task": random.choice(self.task_choices),
            "resource": random.choice(self.resource_choices),
            "workcode": random.choice(self.workcode_choices),
            "date_time_started": "2020-10-14 11:44:46+00:00",
            "hours": 7,
        }

        url = (settings.RAPI_HOST
            + "task/"
            + self.task
            + "/resource/"
            + self.resource
            + "/workcode/"
            + self.workcode
            + "/time/sheet/")

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def edit_specific_project(self):
        ''' edit_specific_project '''

        url = settings.RAPI_HOST + f"project/{ self.project }/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "start_date": "2020-10-20",
            "template": False,
        }

        response = requests.put(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_project_tasks(self):
        ''' get task from specific project '''

        url = settings.RAPI_HOST + f"project/{ self.project }/task/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)
        self.task = response.json()[0]["id"]

    def get_project_sprints(self):
        ''' get sprints from specific project '''

        url = settings.RAPI_HOST + f"{ self.project }/sprint/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.sprint = response.json()[0]["id"]

    def create_new_sprint(self):
        ''' create new sprint '''

        url = settings.RAPI_HOST + f"{ self.project }/sprint/"

        data = {
            "name": self.fake.name(),
            "goal": self.fake.text(),
            "method": self.fake.text(),
            "metrics": self.fake.text(),
            "start": "2020-10-20",
            "days": 7,
        }

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def create_new_persona(self):
        ''' create new persona '''

        url = settings.RAPI_HOST + f"{ self.project }/persona/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
        }

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_project_personas(self):
        ''' get personas from specific project '''

        url = settings.RAPI_HOST + f"{ self.project }/persona/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.persona = response.json()[0]["id"]

    def get_persona_choices(self):
        ''' get persona and return back to form as a chocies '''
        
        self.persona_choices = []

        url = settings.RAPI_HOST + f"{ self.project }/persona/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        personas = response.json()

        for persona in personas:
            self.persona_choices.append(persona["id"])

    def get_sprint_choices(self):
        ''' get sprints and return back to form as a chocies '''
        
        self.sprint_choices = []

        url = settings.RAPI_HOST + f"{ self.project }/sprint/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        sprints = response.json()

        for sprint in sprints:
            self.sprint_choices.append(sprint["id"])

    def get_backlog_choices(self):
        ''' get backlogs and return back to form as a chocies '''
        
        self.backlog_choices = []

        url = settings.RAPI_HOST + f"{ self.project }/backlog/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        backlogs = response.json()

        for backlog in backlogs:
            self.backlog_choices.append(backlog["id"])

    def get_task_status_choices(self):
        ''' get task status and return back to form as a chocies '''
        
        self.task_status_choices = []

        url = settings.RAPI_HOST + f"task/status/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        statuses = response.json()

        for status in statuses:
            self.task_status_choices.append(status["id"])

    def create_new_backlog(self):
        ''' create new backlog '''

        url = settings.RAPI_HOST + f"{ self.project }/backlog/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "i_want": self.fake.text(),
            "so_that": self.fake.text(),
            "as_a": random.choice(self.persona_choices),
            "sprint": random.choice(self.sprint_choices),
            "story_points": 7,
            "impact_on_business": 7,
        }

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_project_backlogs(self):
        ''' get backlogs from specific project '''

        url = settings.RAPI_HOST + f"{ self.project }/backlog/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.backlog = response.json()[0]["id"]

    def create_new_task(self):
        ''' create new task '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "start_date": "2020-10-20",
            "duration_estimate": 1,
            "duration_unit": "1",
            "duration_actual": 1,
            "milestone": True,
            "deadline": "2020-10-20",
            "completion_percent": 50,
            "notes": "",
            "task_status": random.choice(self.task_status_choices),
            "resource": random.choice(self.resource_choices),
            "sprint": random.choice(self.sprint_choices),
            "backlog": random.choice(self.backlog_choices),
        }

        url = settings.RAPI_HOST + f"backlog/{ data['backlog'] }/sprint/{ data['sprint'] }/resource/{ data['resource'] }/project/{ self.project }/status/{ data['task_status'] }/task/create/"

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_project_tasks(self):
        ''' get tasks from specific project '''

        url = settings.RAPI_HOST + f"project/{ self.project }/task/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.task = response.json()[0]["id"]

    def get_specific_task(self):
        ''' grep data of specific task '''

        url = settings.RAPI_HOST + f"task/{ self.task }/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_task(self):
        ''' edit data of specific task '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "start_date": "2020-10-20",
            "duration_estimate": 1,
            "duration_unit": "1",
            "duration_actual": 1,
            "milestone": True,
            "deadline": "2020-10-20",
            "completion_percent": 60,
            "notes": "",
            "task_status": random.choice(self.task_status_choices),
            "resource": random.choice(self.resource_choices),
            "sprint": random.choice(self.sprint_choices),
            "backlog": random.choice(self.backlog_choices),
        }

        url = settings.RAPI_HOST + f"task/{ self.task }/"

        response = requests.put(url, headers = self.auth_header(), data = data)

        self.assertEqual(response.status_code, 200)

    def get_task_comments(self):
        ''' get comments from specific task '''

        url = settings.RAPI_HOST + f"task/{ self.task }/comment/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)
        self.comment = response.json()[0]["id"]

    def create_new_comment(self):
        ''' create new comment for specific task '''

        data = {
            "comment": self.fake.text(),
        }

        url = settings.RAPI_HOST + f"task/{ self.task }/comment/"

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_task_acceptance_criteria(self):
        ''' get acceptance_criteria from specific task '''

        url = settings.RAPI_HOST + f"task/{ self.task }/acceptance-criteria/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)
        self.acceptance_criteria = response.json()[0]["id"]

    def create_new_acceptance_criteria(self):
        ''' create new acceptance_criteria for specific task '''

        data = {
            "name": self.fake.name(),
            "criteria": "c1",
        }

        url = settings.RAPI_HOST + f"task/{ self.task }/acceptance-criteria/"

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_task_resources(self):
        ''' get resource from specific task '''

        url = settings.RAPI_HOST + f"task/{ self.task }/resource/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.task_resource = response.json()[0]["id"]

    def create_new_task_resource(self):
        ''' create new resource for specific task '''

        data = {
            "percentage_time": 50,
            "resource": self.resource,
        }

        url = settings.RAPI_HOST + f"task/{ self.task }/resource/{ data['resource'] }/"

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_roles(self):
        ''' get all role lists '''

        url = settings.RAPI_HOST + "role/"
        
        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)
        self.role = response.json()[0]["id"]

    def get_stakeholder(self):
        ''' get all stakeholder lists '''

        url = settings.RAPI_HOST + f"project/{ self.project }/stakeholder/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)
        self.stakeholder = response.json()[0]["id"]

    def create_new_role(self):
        ''' create new role '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
        }

        url = settings.RAPI_HOST + f"role/create/"

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def create_new_stakeholder(self):
        ''' create new stakeholder '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "role": self.role,
            "email": self.fake.email(),
            "mobile": 1234567891011,
            "landline": 1234567891011,
        }

        url = settings.RAPI_HOST + f"project/{ self.project }/role/{ data['role'] }/stakeholder/"

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_role_choices(self):
        ''' get role and return back to form as a chocies '''
        
        self.role_choices = []

        url = settings.RAPI_HOST + f"role/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)
        roles = response.json()

        for role in roles:
            self.role_choices.append(role["id"])

    def get_artifact(self):
        ''' get all artifact lists '''
        
        url = settings.RAPI_HOST + f"project/{ self.project }/backlog/{ self.backlog }/artifact/"
        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.artifact = response.json()[0]["id"]

    def create_new_artifact(self):
        ''' create new artifact '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "link": "https://www.google.com/"
        }

        url = settings.RAPI_HOST + f"project/{ self.project }/backlog/{ self.backlog }/artifact/"

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def get_working_time(self):
        '''  get all work time lists '''
        
        url = settings.RAPI_HOST + f"project/{ self.project }/working/time/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

        self.working_time = response.json()[0]["id"]

    def create_new_working_time(self):
        ''' create new working time '''

        data = {
            "week_start": "123",
            "fiscal_year_start": "2020-10-14 11:44:46",
            "default_start_time": 7,
            "default_end_time": 7,
            "hours_per_week": 7,
            "days_per_month": 7,
        }

        url = settings.RAPI_HOST + f"project/{ self.project }/working/time/"

        response = requests.post(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 201)

    def edit_specific_working_time(self):
        ''' edit_specific_working_time '''

        url = settings.RAPI_HOST + f"{ self.working_time }/working/time/"

        data = {
            "week_start": "777",
            "fiscal_year_start": "2020-10-14 11:44:46",
            "default_start_time": 7,
            "default_end_time": 7,
            "hours_per_week": 7,
            "days_per_month": 7,
        }

        response = requests.put(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_specific_working_time(self):
        ''' get specific working time '''

        url = settings.RAPI_HOST + f"{ self.working_time }/working/time/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_artifact(self):
        ''' edit_specific_artifact '''

        url = settings.RAPI_HOST + f"{ self.artifact }/artifact/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "link": "https://www.youtube.com/"
        }

        response = requests.put(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_specific_artifact(self):
        ''' get specific artifact '''

        url = settings.RAPI_HOST + f"{ self.artifact }/artifact/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_task_resource(self):
        ''' edit_specific_task_resource '''

        url = settings.RAPI_HOST + f"{ self.task_resource }/task/resource/"

        data = {
            "percentage_time": 77,
            "resource": self.resource,
        }

        response = requests.put(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def get_specific_task_resource(self):
        ''' get specific task_resource '''

        url = settings.RAPI_HOST + f"{ self.task_resource }/task/resource/"

        response = requests.get(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def delete_specific_hlr(self):
        ''' delete_specific_hlr '''

        url = settings.RAPI_HOST + f"{ self.hlr }/hlr/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_program(self):
        ''' delete_specific_program '''

        url = settings.RAPI_HOST + f"program/{ self.project }/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_project(self):
        ''' delete_specific_project '''

        url = settings.RAPI_HOST + f"project/{ self.project }/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_role(self):
        ''' delete_specific_role '''

        url = settings.RAPI_HOST + f"{ self.role }/role/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_sprint(self):
        ''' delete_specific_sprint '''

        url = settings.RAPI_HOST + f"{ self.sprint }/sprint/retrieve/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)
    
    def edit_specific_backlog(self):
        ''' edit_specific_backlog '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "i_want": self.fake.text(),
            "so_that": self.fake.text(),
            "as_a": random.choice(self.persona_choices),
            "sprint": random.choice(self.sprint_choices),
            "story_points": 77,
            "impact_on_business": 77,
        }

        url = settings.RAPI_HOST + f"{ self.project }/{ self.backlog }/backlog/retrieve/"

        response = requests.put(url, data = data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_stakeholder(self):
        ''' edit_specific_stakeholder '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "role": self.role,
            "email": self.fake.email(),
            "mobile": 7777777777,
            "landline": 7777777777,
        }

        url = settings.RAPI_HOST + f"stakeholder/{ self.stakeholder }/"

        response = requests.put(url, data = data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_timesheet(self):
        ''' edit_specific_timesheet '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "task": random.choice(self.task_choices),
            "resource": random.choice(self.resource_choices),
            "workcode": random.choice(self.workcode_choices),
            "date_time_started": "2020-10-14 7:44:46",
            "hours": 7,
        }

        url = settings.RAPI_HOST + f"{ self.timesheet }/time/sheet/"

        response = requests.put(url, data = data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_program(self):
        ''' edit_specific_program '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
        }

        url = settings.RAPI_HOST + f"program/{ self.programs }/"

        response = requests.put(url, data = data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_sprint(self):
        ''' edit_specific_sprint '''

        data = {
            "name": self.fake.name(),
            "goal": self.fake.text(),
            "method": self.fake.text(),
            "metrics": self.fake.text(),
            "start": "2020-7-7",
            "days": 7,
        }

        url = settings.RAPI_HOST + f"{ self.sprint }/sprint/retrieve/"

        response = requests.put(url, data = data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_resource(self):
        ''' edit_specific_resource '''

        url = settings.RAPI_HOST + f"{ self.resource }/resource/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "cost": 7777,
            "email": self.fake.email(),
            "mobile": "+923335189005",
            "landline": "+923335189005",
        }

        response = requests.put(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def delete_specific_resource(self):
        ''' delete_specific_resource '''

        url = settings.RAPI_HOST + f"{ self.resource }/resource/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_timesheet(self):
        ''' delete_specific_timesheet '''

        url = settings.RAPI_HOST + f"{ self.timesheet }/time/sheet/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_stakeholder(self):
        ''' delete_specific_stakeholder '''

        url = settings.RAPI_HOST + f"stakeholder/{ self.stakeholder }/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_backlog(self):
        ''' delete_specific_backlog '''

        url = settings.RAPI_HOST + f"{ self.project }/{ self.backlog }/backlog/retrieve/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_workcode(self):
        ''' delete_specific_workcode '''

        url = settings.RAPI_HOST + f"{ self.workcode }/work/code/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_persona(self):
        ''' delete_specific_persona '''

        url = settings.RAPI_HOST + f"persona/{ self.persona }/{ self.project }/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def edit_specific_work_code(self):
        ''' edit_specific_work_code '''

        url = settings.RAPI_HOST + f"{ self.workcode }/work/code/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
            "billable": False,
        }

        response = requests.put(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_persona(self):
        ''' edit_specific_work_code '''

        url = settings.RAPI_HOST + f"persona/{ self.persona }/{ self.project }/"

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
        }

        response = requests.put(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def edit_specific_role(self):
        ''' edit_specific_role '''

        data = {
            "name": self.fake.name(),
            "description": self.fake.text(),
        }

        url = settings.RAPI_HOST + f"{ self.role }/role/"

        response = requests.put(url, data, headers = self.auth_header())

        self.assertEqual(response.status_code, 200)

    def delete_specific_task(self):
        ''' delete specific task '''

        url = settings.RAPI_HOST + f"task/{ self.task }/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_working_time(self):
        ''' delete_specific_working_time '''

        url = settings.RAPI_HOST + f"{ self.working_time }/working/time/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_artifact(self):
        ''' delete_specific_artifact '''

        url = settings.RAPI_HOST + f"{ self.artifact }/artifact/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)

    def delete_specific_task_resource(self):
        ''' delete_specific_task_resource '''

        url = settings.RAPI_HOST + f"{ self.task_resource }/task/resource/"

        response = requests.delete(url, headers = self.auth_header())

        self.assertEqual(response.status_code, 204)