from django.core.management.utils import get_random_secret_key
import os


project = input("Enter Your Project Name: ")
old_project = "p_pm_rapi"
# input("Enter Your Old Project Name: ")

files = [
    f"{ old_project }/asgi.py",
    f"{ old_project }/settings.py",
    f"{ old_project }/urls.py",
    f"{ old_project }/wsgi.py",
    "manage.py",
    ".env",
]

with open('.env', 'w', encoding='utf-8') as f:
    f.write(f'''DJANGO_DEBUG=True
DJANGO_SECRET_KEY="{ get_random_secret_key() }"

DJANGO_ALLOWED_HOSTS="*"

# Databases

#=======POSTGRESQL==========
PSQL_ENGINE='django.db.backends.postgresql'
PSQL_DATABASE='template'
PSQL_USER='postgres'
PSQL_PASSWORD=''
PSQL_HOST='localhost'
PSQL_PORT='5432'

#=======SQLITE==============
SQL_ENGINE='django.db.backends.sqlite3'
SQL_DATABASE='db.sqlite3'

# want to use database (PSQL, SQL) -- not case sensitive
USING_DB=SQL

# mode eg. (PROD, DEV)
MODE=PROD

# you can set multiple passwords via space.
# ucomment LOCKDOWN_PASSWORDS to lockdown your site.
# LOCKDOWN_PASSWORDS="openit48*@#"''')


for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        data = f.read().replace(old_project, project)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(data)

os.rename(f"{ old_project }", project)