#!/usr/bin/env python3
"""
YouTube Design Concept Extractor
=================================
Extracts transcript + keyframes from a YouTube video and produces
a structured markdown reference document ready for agent consumption.

Usage:
    python3 scripts/youtube-extractor/yt-design-extractor.py <youtube_url> [options]

Examples:
    python3 scripts/youtube-extractor/yt-design-extractor.py "https://youtu.be/VIDEO_ID"
    python3 scripts/youtube-extractor/yt-design-extractor.py "https://youtu.be/VIDEO_ID" --transcript-only
    python3 scripts/youtube-extractor/yt-design-extractor.py "https://youtu.be/VIDEO_ID" --interval 30
    python3 scripts/youtube-extractor/yt-design-extractor.py "https://youtu.be/VIDEO_ID" --full
    python3 scripts/youtube-extractor/yt-design-extractor.py "https://youtu.be/VIDEO_ID" -o ./out

Requirements:
    pip install yt-dlp youtube-transcript-api
    winget install ffmpeg  (skip with --transcript-only)

    Optional (OCR via Tesseract):
    pip install Pillow pytesseract
    # Tesseract installer: https://github.com/UB-Mannheim/tesseract/wiki

    Optional (better OCR for stylized text):
    pip install easyocr

    Optional (color palette extraction):
    pip install colorthief
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import textwrap
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.request import urlretrieve

# Optional imports - gracefully degrade if not available
PILLOW_AVAILABLE = False
TESSERACT_AVAILABLE = False

try:
    from PIL import Image

    PILLOW_AVAILABLE = True
except ImportError:
    pass

try:
    import pytesseract

    TESSERACT_AVAILABLE = PILLOW_AVAILABLE
except ImportError:
    pass

try:
    import easyocr

    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False

try:
    from colorthief import ColorThief

    COLORTHIEF_AVAILABLE = True
except ImportError:
    COLORTHIEF_AVAILABLE = False

# ---------------------------------------------------------------------------
# Transcript extraction
# ---------------------------------------------------------------------------


def extract_video_id(url: str) -> str:
    """Pull the 11-char video ID out of any common YouTube URL format."""
    patterns = [
        r"(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"(?:embed/)([a-zA-Z0-9_-]{11})",
        r"(?:shorts/)([a-zA-Z0-9_-]{11})",
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    if re.match(r"^[a-zA-Z0-9_-]{11}$", url):
        return url
    sys.exit(f"Could not extract video ID from: {url}")


def get_video_metadata(url: str) -> dict:
    """Use yt-dlp to pull title, description, chapters, duration, etc."""
    cmd = [
        "yt-dlp",
        "--dump-json",
        "--no-download",
        "--no-playlist",
        url,
    ]
    print("[*] Fetching video metadata ...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        sys.exit("yt-dlp metadata fetch timed out after 120s.")
    if result.returncode != 0:
        sys.exit(f"yt-dlp metadata failed:\n{result.stderr}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        sys.exit(
            f"yt-dlp returned invalid JSON: {e}\nFirst 200 chars: {result.stdout[:200]}"
        )


def get_transcript(video_id: str) -> list[dict] | None:
    """Grab the transcript via youtube-transcript-api. Returns list of
    {text, start, duration} dicts, or None if unavailable."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        from youtube_transcript_api._errors import (
            TranscriptsDisabled,
            NoTranscriptFound,
            VideoUnavailable,
            IpBlocked,
            RequestBlocked,
        )
    except ImportError:
        print("[!] youtube-transcript-api not installed. Skipping transcript.")
        return None

    try:
        print("[*] Fetching transcript ...")
        ytt_api = YouTubeTranscriptApi()
        transcript = ytt_api.fetch(video_id)
        entries = []
        for snippet in transcript:
            entries.append(
                {
                    "text": snippet.text,
                    "start": snippet.start,
                    "duration": snippet.duration,
                }
            )
        return entries
    except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
        print(f"[!] Transcript unavailable ({e}). Will proceed without it.")
        return None
    except (IpBlocked, RequestBlocked):
        print("[!] YouTube has rate-limited your IP. Transcript skipped. Try again later.")
        return None
    except Exception as e:
        print(f"[!] Transcript fetch failed ({e}). Will proceed without it.")
        return None


# ---------------------------------------------------------------------------
# Keyframe extraction
# ---------------------------------------------------------------------------


def download_video_best(url: str, out_dir: Path) -> Path:
    """Download video at highest available quality."""
    out_template = str(out_dir / "%(title)s.%(ext)s")
    cmd = [
        "yt-dlp",
        "-f",
        "bestvideo+bestaudio/best",
        "--merge-output-format",
        "mp4",
        "-o",
        out_template,
        "--no-playlist",
        url,
    ]
    print("[*] Downloading video (best quality) ...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    except subprocess.TimeoutExpired:
        sys.exit("Video download timed out after 30 minutes.")
    if result.returncode != 0:
        sys.exit(f"yt-dlp download failed:\n{result.stderr}")

    for f in out_dir.iterdir():
        if f.suffix in (".mp4", ".mkv", ".webm") and not f.name.startswith("video."):
            return f
    sys.exit("Download succeeded but could not locate video file.")


def download_video(url: str, out_dir: Path) -> Path:
    """Download video, preferring 720p or lower. Falls back to best available."""
    out_template = str(out_dir / "video.%(ext)s")
    cmd = [
        "yt-dlp",
        "-f",
        "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "--merge-output-format",
        "mp4",
        "-o",
        out_template,
        "--no-playlist",
        url,
    ]
    print("[*] Downloading video (720p preferred) ...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        sys.exit(
            "Video download timed out after 10 minutes. "
            "The video may be too large or your connection too slow."
        )
    if result.returncode != 0:
        sys.exit(f"yt-dlp download failed:\n{result.stderr}")

    for f in out_dir.iterdir():
        if f.name.startswith("video.") and f.suffix in (".mp4", ".mkv", ".webm"):
            return f
    sys.exit("Download succeeded but could not locate video file.")


def extract_frames_interval(
    video_path: Path, out_dir: Path, interval: int = 30
) -> list[Path]:
    """Extract one frame every `interval` seconds."""
    frames_dir = out_dir / "frames"
    frames_dir.mkdir(exist_ok=True)
    pattern = str(frames_dir / "frame_%04d.png")
    cmd = [
        "ffmpeg",
        "-i",
        str(video_path),
        "-vf",
        f"fps=1/{interval}",
        "-q:v",
        "2",
        pattern,
        "-y",
    ]
    print(f"[*] Extracting frames every {interval}s ...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        sys.exit("Frame extraction timed out after 10 minutes.")
    if result.returncode != 0:
        print(f"[!] ffmpeg frame extraction failed (exit code {result.returncode}):")
        print(f"    {result.stderr[:500]}")
        return []
    frames = sorted(frames_dir.glob("frame_*.png"))
    if not frames:
        print(
            "[!] WARNING: ffmpeg ran but produced no frames. "
            "The video may be too short or corrupted."
        )
    else:
        print(f"    -> captured {len(frames)} frames")
    return frames


def extract_frames_scene(
    video_path: Path, out_dir: Path, threshold: float = 0.3
) -> list[tuple[Path, float]]:
    """Use ffmpeg scene-change detection to grab visually distinct frames.
    Returns list of (frame_path, timestamp_seconds) tuples."""
    frames_dir = out_dir / "frames_scene"
    frames_dir.mkdir(exist_ok=True)
    pattern = str(frames_dir / "scene_%04d.png")
    cmd = [
        "ffmpeg",
        "-i",
        str(video_path),
        "-vf",
        f"select='gt(scene,{threshold})',showinfo",
        "-vsync",
        "vfr",
        "-q:v",
        "2",
        pattern,
        "-y",
    ]
    print(f"[*] Extracting scene-change frames (threshold={threshold}) ...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        sys.exit("Scene-change frame extraction timed out after 10 minutes.")
    if result.returncode != 0:
        print(f"[!] ffmpeg scene detection failed (exit code {result.returncode}):")
        print(f"    {result.stderr[:500]}")
        return []

    # Parse timestamps from ffmpeg showinfo output
    timestamps = []
    for line in result.stderr.split("\n"):
        pts_match = re.search(r"pts_time:\s*([\d.]+)", line)
        if pts_match:
            timestamps.append(float(pts_match.group(1)))

    frames = sorted(frames_dir.glob("scene_*.png"))
    if not frames:
        print("[!] No scene-change frames detected (try lowering --scene-threshold).")
        return []

    # Rename frames to include timestamp
    paired: list[tuple[Path, float]] = []
    used_names: dict[str, int] = {}
    for i, frame in enumerate(frames):
        ts = timestamps[i] if i < len(timestamps) else i * 30.0
        ts_int = int(ts)
        base = f"scene_{ts_int:05d}s"
        if base in used_names:
            used_names[base] += 1
            base = f"{base}_{used_names[base]}"
        else:
            used_names[base] = 0
        new_name = frames_dir / f"{base}.png"
        frame.replace(new_name)
        paired.append((new_name, ts))

    print(f"    -> captured {len(paired)} scene-change frames")
    return paired


# ---------------------------------------------------------------------------
# OCR extraction
# ---------------------------------------------------------------------------


def ocr_frame_tesseract(frame_path: Path) -> str:
    """Extract text from a frame using Tesseract OCR. Converts to grayscale first."""
    if not TESSERACT_AVAILABLE:
        return ""
    try:
        img = Image.open(frame_path)
        if img.mode != "L":
            img = img.convert("L")
        text = pytesseract.image_to_string(img, config="--psm 6")
        return text.strip()
    except Exception as e:
        print(f"[!] OCR failed for {frame_path}: {e}")
        return ""


def ocr_frame_easyocr(frame_path: Path, reader) -> str:
    """Extract text from a frame using EasyOCR (better for stylized text)."""
    try:
        results = reader.readtext(str(frame_path), detail=0)
        return "\n".join(results).strip()
    except Exception as e:
        print(f"[!] OCR failed for {frame_path}: {e}")
        return ""


def run_ocr_on_frames(
    frames: list[Path], ocr_engine: str = "tesseract", workers: int = 4
) -> dict[Path, str]:
    """Run OCR on frames. Tesseract runs in parallel; EasyOCR sequentially."""
    if not frames:
        return {}

    results = {}

    if ocr_engine == "easyocr":
        if not EASYOCR_AVAILABLE:
            sys.exit(
                "EasyOCR was explicitly requested but is not installed.\n"
                "  Install: pip install easyocr\n"
                "  Or use: --ocr-engine tesseract"
            )
        else:
            print("[*] Initializing EasyOCR (this may take a moment) ...")
            reader = easyocr.Reader(["en"], gpu=False, verbose=False)

    if ocr_engine == "tesseract" and not TESSERACT_AVAILABLE:
        print("[!] Tesseract/pytesseract not installed, skipping OCR")
        return {}

    print(f"[*] Running OCR on {len(frames)} frames ({ocr_engine}) ...")

    if ocr_engine == "easyocr":
        for i, frame in enumerate(frames):
            results[frame] = ocr_frame_easyocr(frame, reader)
            if (i + 1) % 10 == 0:
                print(f"    -> processed {i + 1}/{len(frames)} frames")
    else:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_frame = {
                executor.submit(ocr_frame_tesseract, f): f for f in frames
            }
            for i, future in enumerate(as_completed(future_to_frame)):
                frame = future_to_frame[future]
                try:
                    results[frame] = future.result()
                except Exception as e:
                    print(f"[!] OCR failed for {frame}: {e}")
                    results[frame] = ""
                if (i + 1) % 10 == 0:
                    print(f"    -> processed {i + 1}/{len(frames)} frames")

    with_text = sum(1 for t in results.values() if len(t) > 10)
    print(f"    -> found text in {with_text}/{len(frames)} frames")

    return results


# ---------------------------------------------------------------------------
# Color palette extraction
# ---------------------------------------------------------------------------


def extract_color_palette(frame_path: Path, color_count: int = 6) -> list[tuple]:
    """Extract dominant colors from a frame. Returns list of RGB tuples."""
    if not COLORTHIEF_AVAILABLE:
        return []
    try:
        ct = ColorThief(str(frame_path))
        palette = ct.get_palette(color_count=color_count, quality=5)
        return palette
    except Exception as e:
        print(f"[!] Color extraction failed for {frame_path}: {e}")
        return []


def rgb_to_hex(rgb: tuple) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def analyze_color_palettes(frames: list[Path], sample_size: int = 10) -> dict:
    """Analyze color palettes across sampled frames."""
    if not COLORTHIEF_AVAILABLE:
        return {}
    if not frames:
        return {}

    step = max(1, len(frames) // sample_size)
    sampled = frames[::step][:sample_size]

    print(f"[*] Extracting color palettes from {len(sampled)} frames ...")

    all_colors = []
    for frame in sampled:
        palette = extract_color_palette(frame)
        all_colors.extend(palette)

    if not all_colors:
        return {}

    def round_color(rgb, bucket_size=32):
        return tuple((c // bucket_size) * bucket_size for c in rgb)

    rounded = [round_color(c) for c in all_colors]
    most_common = Counter(rounded).most_common(12)

    return {
        "dominant_colors": [rgb_to_hex(c) for c, _ in most_common[:6]],
        "all_sampled_colors": [rgb_to_hex(c) for c in all_colors[:24]],
    }


# ---------------------------------------------------------------------------
# Markdown assembly
# ---------------------------------------------------------------------------


def fmt_timestamp(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def group_transcript(entries: list[dict], chunk_seconds: int = 60) -> list[dict]:
    """Merge transcript snippets into chunks of at least `chunk_seconds` duration."""
    if not entries:
        return []
    groups = []
    current = {"start": entries[0]["start"], "text": ""}
    for e in entries:
        if e["start"] - current["start"] >= chunk_seconds and current["text"]:
            groups.append(current)
            current = {"start": e["start"], "text": ""}
        current["text"] += " " + e["text"]
    if current["text"]:
        groups.append(current)
    for g in groups:
        g["text"] = " ".join(g["text"].split())
    return groups


def download_thumbnail(meta: dict, out_dir: Path) -> Path | None:
    """Download the video thumbnail to the output directory."""
    url = meta.get("thumbnail")
    if not url:
        return None
    ext = ".jpg"
    if ".png" in url:
        ext = ".png"
    elif ".webp" in url:
        ext = ".webp"
    dest = out_dir / f"thumbnail{ext}"
    try:
        print("[*] Downloading thumbnail ...")
        urlretrieve(url, dest)
        print(f"    -> saved to {dest}")
        return dest
    except Exception as e:
        print(f"[!] Thumbnail download failed: {e}")
        return None


def build_markdown(
    meta: dict,
    transcript: list[dict] | None,
    interval_frames: list[Path],
    scene_frames: list[tuple[Path, float]],
    out_dir: Path,
    interval: int,
    ocr_results: Optional[dict[Path, str]] = None,
    color_analysis: Optional[dict] = None,
    thumbnail_path: Optional[Path] = None,
) -> Path:
    """Assemble the final reference markdown document."""
    title = meta.get("title", "Untitled Video")
    channel = meta.get("channel", meta.get("uploader", "Unknown"))
    duration = meta.get("duration", 0)
    description = meta.get("description", "")
    chapters = meta.get("chapters") or []
    video_url = meta.get("webpage_url", "")
    tags = meta.get("tags") or []

    ocr_results = ocr_results or {}
    color_analysis = color_analysis or {}

    lines: list[str] = []

    lines.append(f"# {title}\n")
    if thumbnail_path and thumbnail_path.exists():
        rel = os.path.relpath(thumbnail_path, out_dir)
        lines.append(f"![thumbnail]({rel})\n")
    view_count = meta.get("view_count")
    like_count = meta.get("like_count")
    comment_count = meta.get("comment_count")
    follower_count = meta.get("channel_follower_count")
    upload_date = meta.get("upload_date", "")
    categories = meta.get("categories") or []
    heatmap = meta.get("heatmap") or []

    lines.append(f"> **Title:** {title}  ")
    lines.append(f"> **Source:** [{channel}]({video_url})  ")
    lines.append(f"> **Duration:** {fmt_timestamp(duration)}  ")
    if upload_date:
        formatted_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}"
        lines.append(f"> **Uploaded:** {formatted_date}  ")
    if categories:
        lines.append(f"> **Category:** {', '.join(categories)}  ")
    lines.append(f"> **Extracted:** {datetime.now().strftime('%Y-%m-%d %H:%M')}  ")
    if tags:
        lines.append(f"> **Tags:** {', '.join(tags[:15])}")
    lines.append("")

    if view_count or like_count or comment_count or follower_count:
        lines.append("## Engagement\n")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        if view_count:
            lines.append(f"| Views | {view_count:,} |")
        if like_count:
            lines.append(f"| Likes | {like_count:,} |")
        if comment_count:
            lines.append(f"| Comments | {comment_count:,} |")
        if follower_count:
            lines.append(f"| Subscribers | {follower_count:,} |")
        if view_count and like_count:
            ratio = (like_count / view_count) * 100
            lines.append(f"| Like ratio | {ratio:.2f}% |")
        lines.append("")

    if heatmap:
        lines.append("## Heatmap (Viewer Retention)\n")
        lines.append("Shows which segments viewers rewatched or skipped.\n")
        lines.append("| Timestamp | Engagement |")
        lines.append("|-----------|------------|")
        for segment in heatmap:
            ts = fmt_timestamp(segment.get("start_time", 0))
            value = segment.get("value", 0)
            bar = "#" * int(value * 20)
            lines.append(f"| `{ts}` | {bar} {value:.2f} |")
        lines.append("")

    if color_analysis.get("dominant_colors"):
        lines.append("## Color Palette\n")
        colors = color_analysis["dominant_colors"]
        lines.append("| Color | Hex |")
        lines.append("|-------|-----|")
        for hex_color in colors:
            lines.append(f"| #### | `{hex_color}` |")
        lines.append("")
        lines.append(f"*Full palette: {', '.join(f'`{c}`' for c in colors)}*\n")

    if description:
        lines.append("## Video Description\n")
        desc = description[:3000]
        lines.append(f"```\n{desc}\n```\n")

    if chapters:
        lines.append("## Chapters\n")
        lines.append("| Timestamp | Title |")
        lines.append("|-----------|-------|")
        for ch in chapters:
            ts = fmt_timestamp(ch.get("start_time", 0))
            lines.append(f"| `{ts}` | {ch.get('title', '')} |")
        lines.append("")

    if transcript:
        grouped = group_transcript(transcript, chunk_seconds=60)
        lines.append("## Transcript\n")
        lines.append("<details><summary>Full transcript (click to expand)</summary>\n")
        for g in grouped:
            ts = fmt_timestamp(g["start"])
            lines.append(f"**[{ts}]** {g['text']}\n")
        lines.append("</details>\n")

        lines.append("## Transcript (Condensed Segments)\n")
        lines.append("Use these timestamped segments to cross-reference with frames.\n")
        for g in grouped:
            ts = fmt_timestamp(g["start"])
            preview = g["text"][:200]
            if len(g["text"]) > 200:
                preview += " ..."
            lines.append(f"- **`{ts}`** -- {preview}")
        lines.append("")

    all_frames = []
    if interval_frames:
        lines.append(f"## Keyframes (every {interval}s)\n")
        for i, f in enumerate(interval_frames):
            rel = os.path.relpath(f, out_dir)
            ts = fmt_timestamp(i * interval)
            lines.append(f"### Frame at `{ts}`\n")
            lines.append(f"![frame-{ts}]({rel})\n")
            ocr_text = ocr_results.get(f, "").strip()
            if ocr_text and len(ocr_text) > 5:
                lines.append("<details><summary>Text detected in frame</summary>\n")
                lines.append(f"```\n{ocr_text}\n```")
                lines.append("</details>\n")
            all_frames.append((ts, rel, ocr_text))
        lines.append("")

    if scene_frames:
        grouped_for_xref = group_transcript(transcript, chunk_seconds=60) if transcript else []
        lines.append("## Scene-Change Frames\n")
        for i, (f, scene_ts) in enumerate(scene_frames):
            rel = os.path.relpath(f, out_dir)
            ts = fmt_timestamp(scene_ts)
            lines.append(f"### Scene {i + 1} at `{ts}`\n")
            lines.append(f"![scene-{ts}]({rel})\n")
            # Cross-reference with transcript
            if grouped_for_xref:
                matching = None
                for g in grouped_for_xref:
                    if g["start"] <= scene_ts:
                        matching = g
                    else:
                        break
                if matching:
                    match_ts = fmt_timestamp(matching["start"])
                    preview = matching["text"][:300]
                    if len(matching["text"]) > 300:
                        preview += " ..."
                    lines.append(f"> **[{match_ts}]** {preview}\n")
            ocr_text = ocr_results.get(f, "").strip()
            if ocr_text and len(ocr_text) > 5:
                lines.append("<details><summary>Text detected in frame</summary>\n")
                lines.append(f"```\n{ocr_text}\n```")
                lines.append("</details>\n")
            all_frames.append((ts, rel, ocr_text if ocr_text else ""))
        lines.append("")

    frames_with_text = [
        (ts, rel, txt) for ts, rel, txt in all_frames if txt and len(txt) > 10
    ]
    if frames_with_text:
        lines.append("## Visual Text Index\n")
        lines.append("| Timestamp | Key Text (preview) |")
        lines.append("|-----------|-------------------|")
        for ts, rel, txt in frames_with_text:
            preview = txt.split("\n")[0][:80].replace("|", "\\|")
            if len(txt) > 80:
                preview += "..."
            lines.append(f"| `{ts}` | {preview} |")
        lines.append("")

    lines.append("---\n")

    md_path = out_dir / "video-breakdown.md"
    md_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Reference doc written to {md_path}")
    return md_path


def write_transcript_files(
    transcript: list[dict] | None, out_dir: Path, chunk_seconds: int = 60
) -> tuple[Path | None, Path | None]:
    """Write two standalone transcript files: one with timestamps, one plain."""
    if not transcript:
        return None, None

    grouped = group_transcript(transcript, chunk_seconds=chunk_seconds)

    # Timestamped version
    ts_lines = []
    for g in grouped:
        ts = fmt_timestamp(g["start"])
        ts_lines.append(f"[{ts}] {g['text']}")
    ts_path = out_dir / "transcript-timestamped.md"
    ts_path.write_text("\n\n".join(ts_lines), encoding="utf-8")

    # Plain version (no timestamps)
    plain_lines = []
    for g in grouped:
        plain_lines.append(g["text"])
    plain_path = out_dir / "transcript-plain.md"
    plain_path.write_text("\n\n".join(plain_lines), encoding="utf-8")

    print(f"[OK] Transcript (timestamped) written to {ts_path}")
    print(f"[OK] Transcript (plain) written to {plain_path}")
    return ts_path, plain_path


def write_scene_transcript(
    scene_frames: list[tuple[Path, float]],
    transcript: list[dict] | None,
    out_dir: Path,
    chunk_seconds: int = 60,
) -> Path | None:
    """Write a combined file pairing each scene frame with matching transcript."""
    if not scene_frames:
        return None

    grouped = group_transcript(transcript, chunk_seconds=chunk_seconds) if transcript else []

    lines: list[str] = []
    lines.append("# Scene-Transcript Map\n")
    lines.append("Each scene-change frame paired with the narration at that moment.\n")

    for i, (frame_path, scene_ts) in enumerate(scene_frames):
        ts = fmt_timestamp(scene_ts)
        rel = os.path.relpath(frame_path, out_dir)
        lines.append(f"## Scene {i + 1} at {ts}\n")
        lines.append(f"**Frame:** `{rel}`\n")
        lines.append(f"![scene-{ts}]({rel})\n")

        if grouped:
            matching = None
            for g in grouped:
                if g["start"] <= scene_ts:
                    matching = g
                else:
                    break
            if matching:
                match_ts = fmt_timestamp(matching["start"])
                lines.append(f"**Transcript [{match_ts}]:** {matching['text']}\n")
            else:
                lines.append("*No narration at this point.*\n")
        lines.append("---\n")

    st_path = out_dir / "scene-transcript.md"
    st_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Scene-transcript map written to {st_path}")
    return st_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def process_video(url: str, args) -> bool:
    """Process a single video. Returns True on success, False on failure."""
    try:
        video_id = extract_video_id(url)
        meta = get_video_metadata(url)

        safe_title = re.sub(r'[<>:"/\\|?*]', "", meta.get("title", video_id))
        safe_title = " ".join(safe_title.split()).strip(". ")
        if args.output_dir:
            out_dir = Path(args.output_dir) / safe_title
        else:
            out_dir = Path(f"./{safe_title}")
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"    Title:    {meta.get('title')}")
        print(f"    Channel:  {meta.get('channel', meta.get('uploader'))}")
        print(f"    Duration: {fmt_timestamp(meta.get('duration', 0))}")

        transcript = get_transcript(video_id)

        if args.transcript_only:
            # Transcript + video-breakdown + thumbnail, no video download or frames
            thumbnail_path = download_thumbnail(meta, out_dir)

            md_path = build_markdown(
                meta,
                transcript,
                [],
                [],
                out_dir,
                args.interval,
                ocr_results={},
                color_analysis={},
                thumbnail_path=thumbnail_path,
            )

            _, plain_path = write_transcript_files(
                transcript, out_dir, chunk_seconds=args.chunk_seconds
            )
            # Remove the timestamped file since we only want plain
            ts_candidate = out_dir / "transcript-timestamped.md"
            ts_candidate.unlink(missing_ok=True)

            print("\n" + "=" * 60)
            print("DONE! Output directory:", out_dir)
            print("=" * 60)
            print(f"  Reference doc  : {md_path}")
            if thumbnail_path:
                print(f"  Thumbnail      : {thumbnail_path}")
            if plain_path:
                print(f"  Transcript     : {plain_path}")
        else:
            thumbnail_path = download_thumbnail(meta, out_dir)

            interval_frames: list[Path] = []
            scene_frames: list[tuple[Path, float]] = []
            ocr_results: dict[Path, str] = {}
            color_analysis: dict = {}

            video_path = download_video(url, out_dir)
            try:
                if args.scene_detect:
                    scene_frames = extract_frames_scene(
                        video_path, out_dir, threshold=args.scene_threshold
                    )
                else:
                    interval_frames = extract_frames_interval(
                        video_path, out_dir, interval=args.interval
                    )
            finally:
                print("[*] Removing downloaded video to save space ...")
                video_path.unlink(missing_ok=True)

            scene_paths = [p for p, _ in scene_frames]

            if args.ocr:
                all_frames_for_ocr = interval_frames + scene_paths
                ocr_results = run_ocr_on_frames(all_frames_for_ocr, ocr_engine=args.ocr_engine)
                ocr_json = {str(k): v for k, v in ocr_results.items()}
                (out_dir / "ocr-results.json").write_text(
                    json.dumps(ocr_json, indent=2), encoding="utf-8"
                )

            if args.colors:
                all_frames_for_color = interval_frames + scene_paths
                color_analysis = analyze_color_palettes(all_frames_for_color)
                if color_analysis:
                    (out_dir / "color-palette.json").write_text(
                        json.dumps(color_analysis, indent=2), encoding="utf-8"
                    )

            md_path = build_markdown(
                meta,
                transcript,
                interval_frames,
                scene_frames,
                out_dir,
                args.interval,
                ocr_results=ocr_results,
                color_analysis=color_analysis,
                thumbnail_path=thumbnail_path,
            )

            ts_path, plain_path = write_transcript_files(
                transcript, out_dir, chunk_seconds=args.chunk_seconds
            )

            scene_transcript_path = write_scene_transcript(
                scene_frames, transcript, out_dir, chunk_seconds=args.chunk_seconds
            )

            # Copy thumbnail to PRODUCTION_READY/proven/ if using -o inside a topic dir
            if thumbnail_path and args.output_dir:
                proven_dir = Path(args.output_dir).parent / "PRODUCTION_READY" / "thumbnail" / "proven"
                proven_dir.mkdir(parents=True, exist_ok=True)
                proven_thumb = proven_dir / thumbnail_path.name
                shutil.copy2(thumbnail_path, proven_thumb)
                print(f"[OK] Thumbnail copied to {proven_thumb}")

            print("\n" + "=" * 60)
            print("DONE! Output directory:", out_dir)
            print("=" * 60)
            print(f"  Reference doc  : {md_path}")
            if thumbnail_path:
                print(f"  Thumbnail      : {thumbnail_path}")
            if ts_path:
                print(f"  Transcript (ts): {ts_path}")
            if plain_path:
                print(f"  Transcript     : {plain_path}")
            if interval_frames:
                print(f"  Interval frames: {len(interval_frames)} in frames/")
            if scene_frames:
                print(f"  Scene frames   : {len(scene_frames)} in frames_scene/")
            if scene_transcript_path:
                print(f"  Scene+transcript: {scene_transcript_path}")
            if ocr_results:
                frames_with_text = sum(1 for t in ocr_results.values() if len(t) > 10)
                print(f"  OCR results    : {frames_with_text} frames with text -> ocr-results.json")
            if color_analysis:
                print(f"  Color palette  : {len(color_analysis.get('dominant_colors', []))} colors -> color-palette.json")
        return True

    except SystemExit:
        return False
    except Exception as e:
        print(f"\n[ERROR] Failed to process {url}: {e}")
        return False


def main():
    import time

    parser = argparse.ArgumentParser(
        description="Extract content from YouTube videos into structured markdown reference documents.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples (run from project root):
              %(prog)s "https://youtu.be/VIDEO_ID" --transcript-only
              %(prog)s "https://youtu.be/VIDEO_ID" -o "4 - Ideas/MyTopic/research_references"
              %(prog)s "https://youtu.be/VIDEO_ID" --full
              %(prog)s --batch urls.txt --transcript-only -o "2 - LLM Archive/inspiration/Channel"
        """),
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("url", nargs="?", help="YouTube video URL or bare video ID")
    group.add_argument(
        "--batch",
        help="Text file with one YouTube URL per line",
    )
    parser.add_argument(
        "--delay",
        type=int,
        default=10,
        help="Seconds to wait between videos in batch mode (default: 10)",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        help="Parent directory (a subfolder named after the video title is created automatically)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Seconds between keyframe captures (default: 30)",
    )
    parser.add_argument(
        "--scene-detect",
        action="store_true",
        help="Extract frames on scene changes instead of fixed intervals",
    )
    parser.add_argument(
        "--scene-threshold",
        type=float,
        default=0.3,
        help="Scene change sensitivity 0.0-1.0 (default: 0.3)",
    )
    parser.add_argument(
        "--transcript-only",
        action="store_true",
        help="Skip video download, only fetch transcript + metadata",
    )
    parser.add_argument(
        "--chunk-seconds",
        type=int,
        default=60,
        help="Group transcript into chunks of N seconds (default: 60)",
    )
    parser.add_argument(
        "--ocr",
        action="store_true",
        help="Run OCR on frames to extract on-screen text",
    )
    parser.add_argument(
        "--ocr-engine",
        choices=["tesseract", "easyocr"],
        default="tesseract",
        help="OCR engine: tesseract (fast) or easyocr (better for stylized text)",
    )
    parser.add_argument(
        "--colors",
        action="store_true",
        help="Extract color palette from frames",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Enable all features: scene-detect, OCR, and color extraction",
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="Download video at highest quality and exit (no extraction)",
    )

    args = parser.parse_args()

    if args.full:
        args.scene_detect = True
        args.ocr = True
        args.colors = True

    if not shutil.which("yt-dlp"):
        sys.exit(
            "Required tool 'yt-dlp' not found. Install with: pip install yt-dlp"
        )

    # --download: grab best quality video and exit immediately
    if args.download:
        if args.batch:
            sys.exit("--download does not support --batch mode.")
        url = args.url
        if not url:
            sys.exit("--download requires a URL argument.")
        out_dir = Path(args.output_dir) if args.output_dir else Path(".")
        out_dir.mkdir(parents=True, exist_ok=True)
        video_path = download_video_best(url, out_dir)
        print(f"\nDone! Saved to: {video_path}".encode(sys.stdout.encoding, errors="replace").decode(sys.stdout.encoding))
        return

    if not args.transcript_only and not shutil.which("ffmpeg"):
        sys.exit(
            "Required tool 'ffmpeg' not found. Install with: winget install ffmpeg\n"
            "Or use --transcript-only to skip video download."
        )

    if args.batch:
        batch_path = Path(args.batch)
        if not batch_path.exists():
            sys.exit(f"Batch file not found: {batch_path}")
        urls = [
            line.strip()
            for line in batch_path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]
        print(f"[*] Batch mode: {len(urls)} videos, {args.delay}s delay between each\n")
        succeeded = 0
        failed = 0
        for i, url in enumerate(urls):
            print(f"\n{'='*60}")
            print(f"[{i+1}/{len(urls)}] {url}")
            print(f"{'='*60}")
            if process_video(url, args):
                succeeded += 1
            else:
                failed += 1
            if i < len(urls) - 1:
                print(f"\n[*] Waiting {args.delay}s before next video ...")
                time.sleep(args.delay)
        print(f"\n{'='*60}")
        print(f"BATCH COMPLETE: {succeeded} succeeded, {failed} failed out of {len(urls)}")
        print(f"{'='*60}")
    else:
        process_video(args.url, args)


if __name__ == "__main__":
    main()
