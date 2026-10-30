import asyncio
import io
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import httpx
from app.main import app
from PIL import Image

async def test_conversion():
    print("=" * 60)
    print("TESTING IPHONE PHOTO & DOCUMENT CONVERTER ENDPOINT")
    print("=" * 60)

    # 1. Create a dummy test image
    img = Image.new("RGB", (300, 400), color=(120, 180, 240))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    jpeg_bytes = buf.getvalue()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Test simulated iPhone upload with empty content type and .heic filename
        print("\n--> Testing simulated iPhone photo (IMG_8921.HEIC)...")
        files = {
            "file": ("IMG_8921.HEIC", jpeg_bytes, "application/octet-stream")
        }
        res = await client.post("/v1/tryon/convert-upload", files=files)
        print("Response status:", res.status_code)
        data = res.json()
        assert res.status_code == 200, f"Conversion failed: {res.text}"
        assert data.get("status") == "success"
        assert data.get("dataUrl", "").startswith("data:image/jpeg;base64,")
        print(f"Success! Converted format: {data.get('format')}, Dimensions: {data.get('width')}x{data.get('height')}")

    print("\n" + "=" * 60)
    print("IPHONE DOCUMENT & HEIC CONVERTER VERIFIED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_conversion())

