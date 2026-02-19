from pathlib import Path

from config import settings


def _safe_resolve(base_dir: str, relative: str) -> Path:
    """Resolve a relative path against a base directory, guarding against traversal."""
    base = Path(base_dir).resolve()
    target = (base / relative).resolve()
    if not str(target).startswith(str(base)):
        raise ValueError("Path traversal detected")
    return target


def save_upload(data: bytes, relative_path: str) -> Path:
    target = _safe_resolve(settings.upload_dir, relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return target


def save_output(data: bytes, relative_path: str) -> Path:
    target = _safe_resolve(settings.output_dir, relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return target


def get_upload_path(relative: str) -> Path:
    return _safe_resolve(settings.upload_dir, relative)


def get_output_path(relative: str) -> Path:
    return _safe_resolve(settings.output_dir, relative)


def delete_job_files(upload_path: str | None, stl_path: str | None, glb_path: str | None) -> None:
    for rel, base in [
        (upload_path, settings.upload_dir),
        (stl_path, settings.output_dir),
        (glb_path, settings.output_dir),
    ]:
        if rel:
            try:
                p = _safe_resolve(base, rel)
                p.unlink(missing_ok=True)
            except ValueError:
                pass
