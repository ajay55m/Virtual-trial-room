from celery import Celery
from app.config import settings

celery_app = Celery(
    "aura_vton_workers",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.tryon_worker",
        "app.workers.purge_daemon"
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_routes={
        "app.workers.tryon_worker.*": {"queue": "tryon_queue"},
        "app.workers.purge_daemon.*": {"queue": "purge_queue"},
    },
    beat_schedule={
        "purge-expired-biometrics-every-minute": {
            "task": "app.workers.purge_daemon.reconcile_ephemeral_storage_purge",
            "schedule": 60.0, # Run every 60 seconds
        },
    }
)
