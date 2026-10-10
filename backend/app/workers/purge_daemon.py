import logging
from app.workers.celery_app import celery_app
from app.services.storage import storage_service
from app.config import settings

logger = logging.getLogger(__name__)

@celery_app.task(name="app.workers.purge_daemon.reconcile_ephemeral_storage_purge")
def reconcile_ephemeral_storage_purge():
    """
    Automated Privacy Reconciler:
    Runs periodically to enforce GDPR/BIPA hard 15-minute TTL purge on user captures.
    """
    logger.info(f"[SECURITY AUDIT] Running 15-minute TTL Ephemeral Storage Reconciler...")
    purged = storage_service.purge_expired_objects(ttl_minutes=settings.STORAGE_TTL_MINUTES)
    if purged > 0:
        logger.info(f"[SECURITY AUDIT] Purged {purged} stale objects from ephemeral object store.")
    return {"purged_count": purged}
