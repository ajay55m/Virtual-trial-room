import io
import logging
from datetime import timedelta, datetime, timezone
from typing import Optional, Any
from app.config import settings

try:
    from minio import Minio
    from minio.error import S3Error
except ImportError:
    Minio = None  # type: ignore
    S3Error = Exception  # type: ignore

logger = logging.getLogger(__name__)

import urllib3

class EphemeralStorageService:
    def __init__(self):
        self._client: Optional[Any] = None
        self._bucket_verified = False
        self._offline = False
        self.bucket_name: str = settings.MINIO_BUCKET_NAME

    def get_client(self) -> Optional[Any]:
        """Lazy client instantiation to avoid blocking network I/O on module import."""
        if self._offline:
            return None
        if self._client is None and Minio is not None:
            try:
                # Fast timeout and 0 retries to fail fast if MinIO daemon is offline in dev/test
                http_client = urllib3.PoolManager(
                    timeout=urllib3.Timeout(connect=0.3, read=2.0),
                    retries=urllib3.Retry(total=0, connect=0)
                )
                self._client = Minio(
                    settings.MINIO_ENDPOINT,
                    access_key=settings.MINIO_ACCESS_KEY,
                    secret_key=settings.MINIO_SECRET_KEY,
                    secure=settings.MINIO_SECURE,
                    http_client=http_client
                )
            except Exception as e:
                logger.debug(f"MinIO client initialization skipped: {e}")
                self._client = None
                self._offline = True
        return self._client

    def _ensure_bucket(self):
        """Ensures bucket exists only when performing real I/O operations."""
        if self._bucket_verified or self._offline:
            return
        client = self.get_client()
        if not client:
            return
        try:
            if not client.bucket_exists(self.bucket_name):
                client.make_bucket(self.bucket_name)
                logger.info(f"Created ephemeral bucket: {self.bucket_name}")
            self._bucket_verified = True
        except Exception as e:
            logger.debug(f"MinIO storage offline, operating in local asset fallback mode: {e}")
            self._client = None
            self._offline = True

    def upload_ephemeral_file(self, object_name: str, data: bytes, content_type: str = "image/jpeg") -> str:
        """Upload an ephemeral image with session-scoped naming."""
        # Always persist to local frontend assets directory for instant browser rendering
        try:
            import os
            local_path = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "assets", object_name)
            )
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(data)
        except Exception as e:
            logger.debug(f"Local disk write cache skipped: {e}")

        client = self.get_client()
        if not client:
            return f"/assets/{object_name}"
        try:
            self._ensure_bucket()
            now_iso = datetime.now(timezone.utc).isoformat()
            client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=io.BytesIO(data),
                length=len(data),
                content_type=content_type,
                metadata={"uploaded_at": now_iso}
            )
            return self.get_presigned_url(object_name)
        except Exception as e:
            logger.debug(f"MinIO upload fallback for {object_name}: {e}")
            return f"/assets/{object_name}"

    def get_presigned_url(self, object_name: str, expiry_minutes: int = 15) -> str:
        """Generate a short-lived presigned download URL."""
        client = self.get_client()
        if not client:
            return f"/assets/{object_name}"
        try:
            return client.presigned_get_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                expires=timedelta(minutes=expiry_minutes)
            )
        except Exception as e:
            logger.debug(f"MinIO presigned URL fallback: {e}")
            return f"/assets/{object_name}"

    def purge_expired_objects(self, ttl_minutes: int = 15) -> int:
        """Hard purge daemon: removes any objects older than ttl_minutes."""
        client = self.get_client()
        if not client:
            return 0
        purged_count = 0
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=ttl_minutes)
        try:
            objects = client.list_objects(self.bucket_name, recursive=True)
            for obj in objects:
                if getattr(obj, 'last_modified', None):
                    last_mod = obj.last_modified
                    if not last_mod.tzinfo:
                        last_mod = last_mod.replace(tzinfo=timezone.utc)
                    if last_mod < cutoff_time:
                        client.remove_object(self.bucket_name, obj.object_name)
                        purged_count += 1
                        logger.info(f"[SECURITY AUDIT] Hard purged expired object: {obj.object_name}")
            return purged_count
        except Exception as e:
            logger.debug(f"MinIO purge reconciliation skipped: {e}")
            return purged_count

storage_service = EphemeralStorageService()
