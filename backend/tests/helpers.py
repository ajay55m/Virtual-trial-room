"""
Test helpers for generating synthetic test images and fixtures.
"""
import io
from PIL import Image, ImageDraw, ImageFilter


def create_sharp_test_image(width: int = 300, height: int = 300) -> bytes:
    """
    Creates a high-frequency grid pattern JPEG.
    Generates strong edge gradients resulting in high Laplacian variance (> 50.0).
    """
    img = Image.new("RGB", (width, height), color="white")
    draw = ImageDraw.Draw(img)
    grid_size = 15
    for x in range(0, width, grid_size):
        for y in range(0, height, grid_size):
            if ((x // grid_size) + (y // grid_size)) % 2 == 0:
                draw.rectangle([x, y, x + grid_size, y + grid_size], fill="black")

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=95)
    return buffer.getvalue()


def create_blurry_test_image(width: int = 300, height: int = 300) -> bytes:
    """
    Creates a uniform blurred JPEG.
    Has virtually zero edge variance, yielding Laplacian sharpness < 50.0.
    """
    img = Image.new("RGB", (width, height), color=(140, 140, 140))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def create_image_with_exif(width: int = 200, height: int = 200) -> bytes:
    """
    Creates a JPEG containing full sensitive EXIF metadata tags
    (Camera Make, Model, DateTime, Software, and GPS Info).
    """
    img = Image.new("RGB", (width, height), color=(50, 100, 200))
    exif = img.getexif()
    # Standard EXIF tags
    exif[0x010F] = "Aura Kiosk Optics Corp"       # Make
    exif[0x0110] = "UltraVision 4K Depth Kiosk"   # Model
    exif[0x0131] = "Kiosk Firmware v2.4.0"        # Software
    exif[0x0132] = "2026:10:10 07:30:00"          # DateTime
    exif[0x8298] = "Confidential Biometric Device" # Copyright

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


def create_corrupt_image_bytes() -> bytes:
    """Returns random non-image bytes to test error handling."""
    return b"NOT_A_VALID_JPEG_HEADER_CORRUPTED_DATA_12345"
