import hashlib
import io
from pathlib import Path

from PIL import Image

from config import settings

# Magic bytes for allowed image types
_MAGIC = {
    b"\xff\xd8\xff": "jpg",
    b"\x89PNG\r\n\x1a\n": "png",
    b"RIFF": "webp",  # WebP starts with RIFF....WEBP
}

THUMBNAIL_SIZE = (256, 256)


class ImageValidationError(Exception):
    pass


def check_magic_bytes(data: bytes) -> str:
    """Return detected extension or raise."""
    for magic, ext in _MAGIC.items():
        if data[: len(magic)] == magic:
            if ext == "webp" and data[8:12] != b"WEBP":
                continue
            return ext
    raise ImageValidationError("Unsupported image format (bad magic bytes)")


def validate_and_process(data: bytes, original_filename: str) -> tuple[bytes, str, str]:
    """Validate image, strip EXIF, compute hash.

    Returns (cleaned_bytes, sha256_hex, detected_extension).
    """
    if len(data) > settings.max_upload_bytes:
        raise ImageValidationError(
            f"File too large ({len(data)} bytes, max {settings.max_upload_bytes})"
        )

    detected_ext = check_magic_bytes(data)

    # Verify Pillow can open it
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        # Re-open after verify (verify consumes the data)
        img = Image.open(io.BytesIO(data))
    except Exception as e:
        raise ImageValidationError(f"Invalid image data: {e}")

    # Strip EXIF by re-saving without metadata
    buf = io.BytesIO()
    # Convert to RGB if needed (e.g. RGBA png -> jpg)
    if img.mode in ("RGBA", "P"):
        save_fmt = "PNG"
        save_ext = "png"
    else:
        save_fmt = "JPEG"
        save_ext = "jpg"
    img.save(buf, format=save_fmt, quality=95)
    cleaned = buf.getvalue()

    sha256 = hashlib.sha256(cleaned).hexdigest()
    return cleaned, sha256, save_ext


def make_thumbnail(data: bytes, thumb_path: Path) -> None:
    """Generate a thumbnail and save it."""
    img = Image.open(io.BytesIO(data))
    img.thumbnail(THUMBNAIL_SIZE)
    thumb_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(thumb_path), format="JPEG", quality=80)
