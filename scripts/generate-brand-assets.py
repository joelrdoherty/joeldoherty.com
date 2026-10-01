#!/usr/bin/env python3
"""Extract production web assets from the supplied studio-logo sheet.

Usage: python3 scripts/generate-brand-assets.py /path/to/presentation.png
The presentation source is intentionally not copied into the website.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageStat

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
NAVY = (26, 26, 46)


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def isolate(crop: Image.Image, matte: tuple[int, int, int], edge0: float, edge1: float) -> Image.Image:
    """Recover alpha and decontaminate antialiased pixels from a known matte."""
    rgb = crop.convert("RGB")
    out = Image.new("RGBA", rgb.size)
    result = []
    for pixel in rgb.getdata():
        distance = math.sqrt(sum((pixel[i] - matte[i]) ** 2 for i in range(3)))
        alpha = smoothstep(edge0, edge1, distance)
        if alpha < 0.025:
            result.append((0, 0, 0, 0))
            continue
        recovered = tuple(
            max(0, min(255, round((pixel[i] - (1.0 - alpha) * matte[i]) / alpha)))
            for i in range(3)
        )
        result.append((*recovered, round(alpha * 255)))
    out.putdata(result)
    # Remove isolated compression/noise without hardening real antialiased edges.
    alpha = out.getchannel("A")
    alpha = alpha.filter(ImageFilter.MedianFilter(3))
    out.putalpha(alpha)
    bbox = alpha.getbbox()
    if not bbox:
        raise RuntimeError("No artwork detected in crop")
    return out.crop(bbox)


def fit(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    scale = min(max_width / image.width, max_height / image.height)
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)


def transparent_trim(image: Image.Image, padding: int = 0) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def save_scaled(master: Image.Image, stem: str, widths: list[int], png_width: int) -> None:
    for width in widths:
        resized = master.resize((width, round(master.height * width / master.width)), Image.Resampling.LANCZOS)
        resized.save(ASSETS / f"{stem}-{width}.webp", "WEBP", quality=92, method=6, exact=True)
    png = master.resize((png_width, round(master.height * png_width / master.width)), Image.Resampling.LANCZOS)
    png.save(ASSETS / f"{stem}.png", "PNG", optimize=True)


def draw_tracked_text(
    image: Image.Image,
    text: str,
    font: ImageFont.FreeTypeFont,
    center_x: int,
    y: int,
    tracking: float,
    fill: tuple[int, int, int, int],
) -> None:
    """Draw centered all-caps text with explicit tracking."""
    draw = ImageDraw.Draw(image)
    widths = [draw.textlength(char, font=font) for char in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = center_x - total / 2
    for char, width in zip(text, widths):
        draw.text((round(x), y), char, font=font, fill=fill)
        x += width + tracking


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Pass the presentation-sheet PNG path")
    source_path = Path(sys.argv[1]).expanduser().resolve()
    source = Image.open(source_path).convert("RGB")
    if source.size != (1536, 1024):
        raise SystemExit(f"Unexpected source dimensions: {source.size}; expected 1536x1024")
    ASSETS.mkdir(exist_ok=True)

    # High-resolution dark-on-light pieces from the primary presentation.
    light_matte = (248, 250, 252)
    monogram_light = isolate(source.crop((500, 100, 1000, 450)), light_matte, 2.0, 24.0)
    wordmark_light = isolate(source.crop((330, 472, 1215, 665)), light_matte, 2.0, 24.0)

    header = Image.new("RGBA", (1000, 240), (0, 0, 0, 0))
    mark = fit(monogram_light, 320, 218)
    words = fit(wordmark_light, 640, 144)
    total_width = mark.width + 30 + words.width
    x = (header.width - total_width) // 2
    header.alpha_composite(mark, (x, (header.height - mark.height) // 2))
    header.alpha_composite(words, (x + mark.width + 30, (header.height - words.height) // 2 + 2))
    header = transparent_trim(header, 4)
    save_scaled(header, "studio-logo-header", [320, 640], 640)

    # Mobile lockup keeps the supplied mark/name but redraws the tiny descriptor
    # at a readable rendered size. The presentation's original descriptor is
    # intended for larger applications and becomes illegible in a 390px header.
    mobile_header = header.copy()
    wordmark_left = round(mobile_header.width * 0.34)
    descriptor_top = round(mobile_header.height * 0.64)
    ImageDraw.Draw(mobile_header).rectangle(
        (wordmark_left, descriptor_top, mobile_header.width, mobile_header.height),
        fill=(0, 0, 0, 0),
    )
    descriptor_font = ImageFont.truetype(
        "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf",
        round(mobile_header.height * 0.18),
    )
    draw_tracked_text(
        mobile_header,
        "INDEPENDENT SOFTWARE STUDIO",
        descriptor_font,
        (wordmark_left + mobile_header.width) // 2,
        round(mobile_header.height * 0.61),
        tracking=1.5,
        fill=(59, 130, 143, 255),
    )
    save_scaled(mobile_header, "studio-logo-header-mobile", [320, 640], 640)

    # Original reversed horizontal lockup for a dark footer.
    dark_matte = (26, 27, 45)
    footer = isolate(source.crop((135, 780, 980, 966)), dark_matte, 1.5, 22.0)
    footer = transparent_trim(footer, 3)
    save_scaled(footer, "studio-logo-footer", [380, 760], 760)

    # Reversed monogram only, centered on an opaque navy square for robust tiny icons.
    reversed_mark = isolate(source.crop((140, 785, 380, 960)), dark_matte, 1.5, 22.0)
    favicon_master = Image.new("RGB", (512, 512), NAVY)
    mark_for_icon = fit(reversed_mark, 404, 316)
    favicon_master.paste(
        mark_for_icon.convert("RGB"),
        ((512 - mark_for_icon.width) // 2, (512 - mark_for_icon.height) // 2),
        mark_for_icon.getchannel("A"),
    )
    favicon_master.save(ASSETS / "favicon-512.png", "PNG", optimize=True)
    for size, target in [(192, ASSETS / "favicon-192.png"), (32, ASSETS / "favicon-32.png"), (180, ROOT / "apple-touch-icon.png")]:
        favicon_master.resize((size, size), Image.Resampling.LANCZOS).save(target, "PNG", optimize=True)
    favicon_master.save(
        ROOT / "favicon.ico", "ICO", sizes=[(16, 16), (32, 32), (48, 48)]
    )

    # Contact sheet used for extraction QA; kept outside the repository.
    qa = Image.new("RGB", (1200, 760), (230, 233, 238))
    draw = ImageDraw.Draw(qa)
    cards = [
        ((30, 30, 1170, 260), (255, 255, 255), "Header on white"),
        ((30, 280, 1170, 510), (247, 248, 250), "Header on site paper"),
        ((30, 530, 780, 730), NAVY, "Footer on navy"),
    ]
    for box, color, label in cards:
        draw.rounded_rectangle(box, radius=18, fill=color)
        draw.text((box[0] + 18, box[1] + 14), label, fill=(92, 98, 112) if color != NAVY else (190, 195, 206))
    preview_header = fit(header, 720, 155)
    qa.paste(preview_header, (80, 82), preview_header)
    qa.paste(preview_header, (80, 332), preview_header)
    preview_footer = fit(footer, 650, 125)
    qa.paste(preview_footer, (80, 580), preview_footer)
    icon = favicon_master.resize((170, 170), Image.Resampling.LANCZOS)
    qa.paste(icon, (920, 560))
    qa_path = Path.home() / ".hermes" / "cache" / "scratch" / "joeldoherty-logo-extraction-qa.png"
    qa_path.parent.mkdir(parents=True, exist_ok=True)
    qa.save(qa_path, "PNG", optimize=True)
    print(f"Generated studio brand assets; QA contact sheet: {qa_path}")


if __name__ == "__main__":
    main()
