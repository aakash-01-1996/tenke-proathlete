import os
import re
import cloudinary
import cloudinary.uploader

# Configure once on import
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)


def extract_public_id(url: str) -> str | None:
    """
    Extract the Cloudinary public_id from a URL.
    e.g. https://res.cloudinary.com/cloud/image/upload/v123/events/abc.jpg
         → events/abc
    """
    if not url or "res.cloudinary.com" not in url:
        return None
    # Remove version segment (v followed by digits) if present
    match = re.search(r"/upload/(?:v\d+/)?(.+?)(?:\.[a-zA-Z]+)?$", url)
    return match.group(1) if match else None


def delete_image(url: str) -> None:
    """Best-effort delete of a Cloudinary image by its URL. Silently ignores errors."""
    public_id = extract_public_id(url)
    if not public_id:
        return
    try:
        cloudinary.uploader.destroy(public_id)
    except Exception:
        pass
