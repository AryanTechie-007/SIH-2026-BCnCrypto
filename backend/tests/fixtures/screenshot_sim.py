"""
Helpers that simulate what a leaker's screenshot of a watermarked PDF looks like.

Every screenshot test is parameterised off ``composite_screenshot``: it fits the document render into a
synthetic grey viewer window (with a toolbar), at a given viewport and optional JPEG quality.
"""

import io
from typing import Tuple

import fitz
import numpy as np
from PIL import Image


def make_sample_pdf(path: str, pages: int = 1) -> str:
    """A text-heavy A4 page (595x842 pt -> 1240x1755 px at 150 DPI); `pages` copies."""
    doc = fitz.open()
    for p in range(pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text(fitz.Point(60, 80), f"DEFENSE INTELLIGENCE DISPATCH - CONFIDENTIAL (p{p + 1})", fontsize=15)
        for i in range(20):
            page.insert_text(
                fitz.Point(60, 130 + i * 28),
                f"Section {i + 1}: tactical dissemination log entry, standard guidelines.",
                fontsize=9,
            )
    doc.save(path)
    doc.close()
    return path


def render_page(pdf_path: str, dpi: int = 150, page_index: int = 0) -> Image.Image:
    doc = fitz.open(pdf_path)
    try:
        pix = doc[page_index].get_pixmap(dpi=dpi)
        return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    finally:
        doc.close()


def composite_screenshot(
    doc_img: Image.Image,
    viewport: Tuple[int, int] = (1600, 1000),
    jpeg_quality: int = None,
    chrome_offset: int = 0,
) -> Tuple[Image.Image, float]:
    """
    Fit the page into a dark viewer window (64 px toolbar, 20 px margins) and optionally JPEG-encode it.
    ``chrome_offset`` shifts the page horizontally by extra pixels (odd sub-block phases).
    Returns (screenshot, document_scale).
    """
    vw, vh = viewport
    scale = (vh - 120) / doc_img.height
    dw, dh = int(doc_img.width * scale), int(doc_img.height * scale)
    canvas = Image.new("RGB", viewport, (52, 55, 60))
    canvas.paste(Image.new("RGB", (vw, 64), (32, 34, 38)), (0, 0))
    ox = (vw - dw) // 2 + chrome_offset
    canvas.paste(doc_img.resize((dw, dh), Image.LANCZOS), (ox, 84))
    if jpeg_quality:
        buf = io.BytesIO()
        canvas.save(buf, "JPEG", quality=jpeg_quality)
        buf.seek(0)
        canvas = Image.open(buf).convert("RGB")
    return canvas, scale


def to_png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def to_jpeg_bytes(img: Image.Image, quality: int = 90) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    return buf.getvalue()


def blank_page(size: Tuple[int, int] = (1240, 1755)) -> Image.Image:
    return Image.new("RGB", size, "white")


def noise_image(size: Tuple[int, int] = (1240, 1755), seed: int = 7) -> Image.Image:
    rng = np.random.default_rng(seed)
    return Image.fromarray(rng.integers(0, 256, (size[1], size[0], 3), dtype=np.uint8))
