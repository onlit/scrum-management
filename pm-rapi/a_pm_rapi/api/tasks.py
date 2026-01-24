from a_pm_rapi.models import INA
from a_pm_rapi.utils import send_email, get_detail_of_a_record
from django.conf import settings
from django.utils import timezone
from celery import shared_task
from datetime import datetime
import pytz


@shared_task(name="send_ina_email")
def send_ina_email(ina_id, link, user):
    ina = INA.objects.get(id=ina_id)

    send_email(settings.INA_EMAIL_TEMPLATE_ID, [user.get("email")], context={
        "first_name": user.get("username"),
        "email": user.get("email"),
        "ina": {
            "link": f"{link}{ina.record_id}/",
            "datetime": ina.datetime.strftime("%d/%m/%Y %H:%M"),
            "date": ina.datetime.date().strftime("%d/%m/%Y"),
            "time": ina.datetime.strftime("%H:%M"),
            "timezone": ina.datetime.strftime('%Z'),
            "next_action": f"{ina.next_action}",
            "notes": f"{ina.notes}",
        },
    })
