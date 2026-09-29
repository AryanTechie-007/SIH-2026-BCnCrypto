"""Jinja HTML templates to PDF bytes with WeasyPrint. No model calls.

Templates are in render/templates/ and extend base.html, which takes its
colours, font, organisation name and logo from a Theme (render/theme.py). What
a template shows comes from a validated payload, which is model output, so
Jinja autoescapes everything.
"""

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from app.render.theme import Theme

TEMPLATES = Path(__file__).parent / "templates"

_env = Environment(
    loader=FileSystemLoader(TEMPLATES),
    autoescape=True,
    undefined=StrictUndefined,  # a misspelt field fails the render instead of printing nothing
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_pdf(template: str, theme: Theme, **context) -> bytes:
    html = _env.get_template(template).render(theme=theme, **context)
    try:
        from weasyprint import HTML
        from weasyprint.urls import URLFetcher
        return HTML(string=html, url_fetcher=URLFetcher(allowed_protocols=("data",))).write_pdf()
    except Exception as e:
        # Fallback to PyMuPDF on Windows or environments without GTK/Pango
        try:
            import pymupdf
            doc = pymupdf.open()
            page = doc.new_page(width=595, height=842)  # Standard A4
            # Insert styled HTML content box
            page.insert_htmlbox(pymupdf.Rect(36, 36, 559, 806), html)
            return doc.tobytes()
        except Exception as fallback_err:
            raise RuntimeError(
                f"PDF rendering failed. WeasyPrint error: {e}. PyMuPDF fallback error: {fallback_err}"
            ) from e

