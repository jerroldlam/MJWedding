"""Prepare May & Jerrold's original photos for the photobook website.

Reads an originals folder laid out as:

    <originals>/Outdoor/<location>/<photos>
    <originals>/Studio/<photos>

and writes, inside this repository:

    images/outdoor/<location>/<sm|md|lg>/<photo>.webp
    images/studio/<sm|md|lg>/<photo>.webp
    data/photos.json

Renditions are upright, sRGB, metadata-free WebP files. Re-running only
processes new or changed photos and removes renditions of deleted ones.

Usage:
    pip install -r tools/requirements.txt
    python tools/prepare_photos.py "D:\\Photos\\Pre-wedding"
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO
from pathlib import Path

import PIL
from PIL import ExifTags, Image, ImageCms, ImageOps

REPO_ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = REPO_ROOT / "images"
MANIFEST_PATH = REPO_ROOT / "data" / "photos.json"
CACHE_PATH = REPO_ROOT / "tools" / ".cache" / "prepare-photos.json"

SIZES = {"sm": 640, "md": 1280, "lg": 2400}
WEBP_QUALITY = 80
WEBP_METHOD = 6
SCHEMA_VERSION = 1

PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}
IGNORED_FILENAMES = {"thumbs.db", "desktop.ini"}
BUDGET_WARNING_BYTES = 500 * 1024 * 1024

CHAPTER_PREFIX = re.compile(r"^(\d+)\s*[-_.)]\s*(.+)$")
EXIF_DATETIME_ORIGINAL = 36867
EXIF_DATETIME_DIGITIZED = 36868


@dataclass(frozen=True)
class ShootSpec:
    id: str
    title: str
    theme: str
    has_locations: bool


@dataclass(frozen=True)
class Chapter:
    shoot: ShootSpec
    id: str
    title: str
    sort_key: tuple
    source_dir: Path
    path_parts: tuple[str, ...]
    alt: str


@dataclass(frozen=True)
class SourcePhoto:
    path: Path
    key: str
    id: str
    fingerprint: str


@dataclass
class RunSummary:
    per_chapter: dict[str, int] = field(default_factory=dict)
    processed: int = 0
    unchanged: int = 0
    removed: int = 0
    skipped: list[str] = field(default_factory=list)
    notices: list[str] = field(default_factory=list)
    total_bytes: int = 0


class LayoutError(Exception):
    """The originals folder is missing or not laid out as expected."""


SHOOTS = (
    ShootSpec("outdoor", "Outdoor", "light", has_locations=True),
    ShootSpec("studio", "Studio", "dark", has_locations=False),
)


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug or "photo"


def parse_chapter_name(folder_name: str) -> tuple[tuple, str]:
    """Split an optional ordering prefix ("1 - Marina") from the display title."""
    match = CHAPTER_PREFIX.match(folder_name)
    if match:
        number, title = match.groups()
        return (0, int(number), title.strip().casefold()), title.strip()
    return (1, 0, folder_name.strip().casefold()), folder_name.strip()


_SETTINGS_HASH: str | None = None


def settings_hash() -> str:
    global _SETTINGS_HASH
    if _SETTINGS_HASH is None:
        settings = {
            "sizes": SIZES,
            "quality": WEBP_QUALITY,
            "method": WEBP_METHOD,
            "schema": SCHEMA_VERSION,
            "pillow": PIL.__version__,
        }
        digest = hashlib.sha1(json.dumps(settings, sort_keys=True).encode("utf-8"))
        _SETTINGS_HASH = digest.hexdigest()[:12]
    return _SETTINGS_HASH


def is_hidden(path: Path) -> bool:
    return path.name.startswith(".")


def is_photo_file(path: Path) -> bool:
    return (
        path.is_file()
        and not is_hidden(path)
        and path.name.casefold() not in IGNORED_FILENAMES
        and path.suffix.casefold() in PHOTO_EXTENSIONS
    )


def list_photo_files(directory: Path) -> list[Path]:
    return sorted((p for p in directory.iterdir() if is_photo_file(p)), key=lambda p: p.name.casefold())


def child_dirs(directory: Path) -> list[Path]:
    return sorted((p for p in directory.iterdir() if p.is_dir() and not is_hidden(p)), key=lambda p: p.name.casefold())


def find_shoot_dirs(originals: Path, notices: list[str]) -> dict[str, Path]:
    if not originals.is_dir():
        raise LayoutError(f"Originals folder not found: {originals}")

    titles = {shoot.title.casefold(): shoot.id for shoot in SHOOTS}
    shoot_dirs: dict[str, Path] = {}
    for directory in child_dirs(originals):
        shoot_id = titles.get(directory.name.casefold())
        if shoot_id:
            shoot_dirs[shoot_id] = directory
        else:
            notices.append(f'Ignored folder "{directory.name}" (only Outdoor and Studio are used)')

    if not shoot_dirs:
        raise LayoutError(
            f'No "Outdoor" or "Studio" folder found in {originals}.\n'
            "Expected layout:\n"
            f"  {originals}{os.sep}Outdoor{os.sep}<location>{os.sep}<photos>\n"
            f"  {originals}{os.sep}Studio{os.sep}<photos>"
        )
    return shoot_dirs


def discover_chapters(shoot_dirs: dict[str, Path], notices: list[str]) -> list[Chapter]:
    chapters: list[Chapter] = []
    for shoot in SHOOTS:
        shoot_dir = shoot_dirs.get(shoot.id)
        if shoot_dir is None:
            continue

        if shoot.has_locations:
            located: list[Chapter] = []
            for folder in child_dirs(shoot_dir):
                if not list_photo_files(folder):
                    continue
                sort_key, title = parse_chapter_name(folder.name)
                chapter_id = slugify(title)
                clash = next((c for c in located if c.id == chapter_id), None)
                if clash:
                    raise LayoutError(
                        f'Folders "{clash.source_dir.name}" and "{folder.name}" in {shoot.title} '
                        "have the same name once simplified. Rename one of them."
                    )
                located.append(Chapter(
                    shoot=shoot,
                    id=chapter_id,
                    title=title,
                    sort_key=sort_key,
                    source_dir=folder,
                    path_parts=(shoot.id, chapter_id),
                    alt=f"May & Jerrold at {title}",
                ))
            loose = list_photo_files(shoot_dir)
            if loose:
                notices.append(
                    f"Ignored {len(loose)} photo(s) directly inside {shoot.title} (put them in a location folder)"
                )
            chapters.extend(sorted(located, key=lambda c: c.sort_key))
        else:
            for folder in child_dirs(shoot_dir):
                notices.append(f'Ignored folder "{shoot.title}/{folder.name}" ({shoot.title} has no sub-folders)')
            if list_photo_files(shoot_dir):
                chapters.append(Chapter(
                    shoot=shoot,
                    id=shoot.id,
                    title=shoot.title,
                    sort_key=(0, 0, ""),
                    source_dir=shoot_dir,
                    path_parts=(shoot.id,),
                    alt="May & Jerrold in the studio",
                ))

    if not chapters:
        raise LayoutError("No photos found in the Outdoor or Studio folders.")
    return chapters


def assign_photo_ids(files: list[Path]) -> dict[Path, str]:
    ids: dict[Path, str] = {}
    used: set[str] = set()
    for file in files:
        base = slugify(file.stem)
        candidate, n = base, 1
        while candidate in used:
            n += 1
            candidate = f"{base}-{n}"
        used.add(candidate)
        ids[file] = candidate
    return ids


def fingerprint(path: Path) -> str:
    st = path.stat()
    return f"{st.st_size}:{st.st_mtime_ns}:{settings_hash()}"


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def read_capture_time(image: Image.Image) -> str | None:
    try:
        exif_ifd = image.getexif().get_ifd(ExifTags.IFD.Exif)
    except Exception:
        return None
    for tag in (EXIF_DATETIME_ORIGINAL, EXIF_DATETIME_DIGITIZED):
        value = exif_ifd.get(tag)
        if not isinstance(value, str):
            continue
        try:
            return datetime.strptime(value.strip("\x00 ")[:19], "%Y:%m:%d %H:%M:%S").isoformat()
        except ValueError:
            continue
    return None


def to_srgb(image: Image.Image, notices: list[str], label: str) -> Image.Image:
    icc = image.info.get("icc_profile")
    if icc:
        try:
            image = ImageCms.profileToProfile(
                image,
                ImageCms.ImageCmsProfile(BytesIO(icc)),
                ImageCms.createProfile("sRGB"),
                outputMode="RGB",
            )
        except Exception:
            notices.append(f"Colour profile not converted for {label}")

    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.getchannel("A"))
        image = background
    return image.convert("RGB")


def save_webp(image: Image.Image, destination: Path) -> tuple[int, int]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp = destination.with_suffix(".webp.tmp")
    image.info = {}
    image.save(tmp, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD, exif=b"")
    os.replace(tmp, destination)
    return image.size


def rendition_path(chapter: Chapter, size: str, photo_id: str) -> Path:
    return IMAGES_DIR.joinpath(*chapter.path_parts, size, f"{photo_id}.webp")


def rendition_url(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def render_photo(source: SourcePhoto, chapter: Chapter, notices: list[str]) -> dict:
    with Image.open(source.path) as opened:
        captured = read_capture_time(opened)
        image = ImageOps.exif_transpose(opened)
        image = to_srgb(image, notices, source.key)

    width, height = image.size
    r, g, b = image.resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))

    renditions: dict[str, dict[str, int]] = {}
    for size, edge in SIZES.items():
        copy = image.copy()
        copy.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        w, h = save_webp(copy, rendition_path(chapter, size, source.id))
        renditions[size] = {"width": w, "height": h}

    return {
        "id": source.id,
        "fingerprint": source.fingerprint,
        "captured": captured,
        "width": width,
        "height": height,
        "color": f"#{r:02x}{g:02x}{b:02x}",
        "renditions": renditions,
    }


# ---------------------------------------------------------------------------
# Processing & persistence
# ---------------------------------------------------------------------------

def photo_sort_key(entry: dict, filename: str) -> tuple:
    return (entry["captured"] is None, entry["captured"] or "", filename.casefold())


def chapter_label(chapter: Chapter) -> str:
    return f"{chapter.shoot.title} / {chapter.title}" if chapter.shoot.has_locations else chapter.shoot.title


def process_chapter(
    chapter: Chapter,
    originals: Path,
    cache: dict,
    new_cache: dict,
    summary: RunSummary,
    expected: set[Path],
    progress: list[int],
) -> list[dict]:
    files = list_photo_files(chapter.source_dir)
    ids = assign_photo_ids(files)
    collected: list[tuple[dict, str]] = []

    for file in files:
        label = file.relative_to(originals).as_posix()
        # Keyed by output identity, so renaming "Marina" to "1 - Marina" re-renders nothing.
        key = "/".join((*chapter.path_parts, ids[file]))
        source = SourcePhoto(path=file, key=label, id=ids[file], fingerprint=fingerprint(file))
        paths = {size: rendition_path(chapter, size, source.id) for size in SIZES}

        cached = cache.get(key)
        if (
            isinstance(cached, dict)
            and cached.get("fingerprint") == source.fingerprint
            and cached.get("id") == source.id
            and all(path.exists() for path in paths.values())
        ):
            entry = cached
            summary.unchanged += 1
        else:
            progress[0] += 1
            print(f"[{progress[0]}] {label}")
            try:
                entry = render_photo(source, chapter, summary.notices)
            except Exception as error:
                summary.skipped.append(f"{label} ({error.__class__.__name__}: {error})")
                continue
            summary.processed += 1

        new_cache[key] = entry
        expected.update(paths.values())
        collected.append((entry, file.name))

    collected.sort(key=lambda item: photo_sort_key(*item))
    photos = [
        {
            "id": entry["id"],
            "width": entry["width"],
            "height": entry["height"],
            "alt": chapter.alt,
            "color": entry["color"],
            "src": {
                size: {
                    "url": rendition_url(rendition_path(chapter, size, entry["id"])),
                    "width": entry["renditions"][size]["width"],
                    "height": entry["renditions"][size]["height"],
                }
                for size in SIZES
            },
        }
        for entry, _ in collected
    ]
    summary.per_chapter[chapter_label(chapter)] = len(photos)
    return photos


def remove_orphans(expected: set[Path]) -> int:
    if not IMAGES_DIR.exists():
        return 0
    removed = 0
    for path in sorted(IMAGES_DIR.rglob("*")):
        if path.is_file() and (path.name.endswith(".webp") or path.name.endswith(".webp.tmp")):
            if path not in expected:
                path.unlink()
                removed += 1
    directories = sorted((p for p in IMAGES_DIR.rglob("*") if p.is_dir()), key=lambda p: len(p.parts), reverse=True)
    for directory in [*directories, IMAGES_DIR]:
        if not any(directory.iterdir()):
            directory.rmdir()
    return removed


def build_manifest(chapters_with_photos: list[tuple[Chapter, list[dict]]]) -> dict:
    shoots = []
    for shoot in SHOOTS:
        chapters = [
            {"id": chapter.id, "title": chapter.title, "photos": photos}
            for chapter, photos in chapters_with_photos
            if chapter.shoot is shoot and photos
        ]
        if chapters:
            shoots.append({"id": shoot.id, "title": shoot.title, "theme": shoot.theme, "chapters": chapters})
    return {"version": SCHEMA_VERSION, "shoots": shoots}


def write_json_atomic(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    os.replace(tmp, path)


def load_cache() -> dict:
    try:
        data = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    photos = data.get("photos") if isinstance(data, dict) else None
    return photos if isinstance(photos, dict) else {}


def directory_size(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(p.stat().st_size for p in path.rglob("*.webp"))


def format_bytes(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    mb = n / (1024 * 1024)
    return f"{mb:.0f} MB" if mb >= 10 else f"{mb:.1f} MB"


def print_summary(summary: RunSummary) -> None:
    print()
    width = max((len(label) for label in summary.per_chapter), default=0)
    for label, count in summary.per_chapter.items():
        print(f"  {label.ljust(width)}  {count:>4}")
    total = sum(summary.per_chapter.values())
    print()
    print(f"Processed: {summary.processed}  Unchanged: {summary.unchanged}  Removed: {summary.removed}")
    print(f"Total: {total} photos, {format_bytes(summary.total_bytes)}")

    if summary.notices:
        print("\nNotices:", file=sys.stderr)
        for notice in summary.notices:
            print(f"  - {notice}", file=sys.stderr)
    if summary.skipped:
        print(f"\nSkipped ({len(summary.skipped)}):", file=sys.stderr)
        for line in summary.skipped:
            print(f"  - {line}", file=sys.stderr)
    if summary.total_bytes > BUDGET_WARNING_BYTES:
        print(
            f"\nWARNING: prepared images total {format_bytes(summary.total_bytes)}, above the 500 MB target. "
            "GitHub Pages sites are limited to 1 GB.",
            file=sys.stderr,
        )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "originals",
        type=Path,
        help="Folder containing Outdoor/<location>/ and Studio/ with the original photos",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    originals = args.originals.expanduser().resolve()

    if originals == REPO_ROOT or REPO_ROOT in originals.parents:
        print(
            "The originals folder must be outside the website repository, so originals are never published.",
            file=sys.stderr,
        )
        return 1

    summary = RunSummary()
    try:
        shoot_dirs = find_shoot_dirs(originals, summary.notices)
        chapters = discover_chapters(shoot_dirs, summary.notices)
    except LayoutError as error:
        print(error, file=sys.stderr)
        return 1

    cache = load_cache()
    new_cache: dict = {}
    expected: set[Path] = set()
    progress = [0]
    chapters_with_photos = [
        (chapter, process_chapter(chapter, originals, cache, new_cache, summary, expected, progress))
        for chapter in chapters
    ]

    summary.removed = len(set(cache) - set(new_cache))
    remove_orphans(expected)
    write_json_atomic(MANIFEST_PATH, build_manifest(chapters_with_photos))
    write_json_atomic(CACHE_PATH, {"settings": settings_hash(), "photos": new_cache})
    summary.total_bytes = directory_size(IMAGES_DIR)
    print_summary(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
