"""
CIPHERTRACE watermark geometry helpers.

Pure functions over NumPy arrays / plain tuples (no engine state, no PDF dependency) so they can be
unit-tested in isolation.

WHY THIS MODULE EXISTS
----------------------
The DCT watermark maps block (row, col) of the page render to payload bit
``(row * blocks_per_row + col) % codeword_bits``. That index depends on the image origin, the row length
and the 8-px lattice scale, so a screenshot (window chrome, display scaling, fit-to-window) re-phases the
entire payload. The extractor therefore has to *normalise* a suspect image back to the canonical
150-DPI page geometry before reading bits. The helpers here do the locating / sizing / phase work.
"""

from typing import Iterator, List, Optional, Sequence, Tuple

import cv2
import numpy as np

# Canonical page render sizes (pixels) at 150 DPI: A4, US Letter, US Legal, A3.
CANONICAL_SIZES: List[Tuple[int, int]] = [
    (1240, 1755),
    (1275, 1650),
    (1275, 2100),
    (1754, 2480),
]

# Boxes covering less than this fraction of the image, or with a side shorter than MIN_PAGE_SIDE px,
# are treated as "page not found". A page in a wide viewer window routinely fills only ~1/3 of the
# capture (e.g. 621x880 in 1600x1000), so this floor must stay well below that.
MIN_PAGE_AREA_FRACTION = 0.05
MIN_PAGE_SIDE = 200
# Aspect-ratio tolerance when matching a located box to a standard page size.
ASPECT_TOLERANCE = 0.03


def blocks(dim: int, bs: int = 8) -> int:
    """
    Number of blocks along one axis, EXACTLY as the embedder/extractor loops count them:
    ``len(range(0, dim - bs, bs))``.

    NOT ``dim // bs``: the loop bound skips the last partial block and, for dims that are an exact
    multiple of ``bs``, one more block. Changing this changes the bit mapping and invalidates every
    watermark ever issued.
    """
    return len(range(0, dim - bs, bs))


def locate_page(img_rgb: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    """
    Locate the bright page rectangle inside darker window chrome.

    Luminance threshold at 200, morphological close with a 9x9 kernel, largest external contour's
    bounding box. Returns (x, y, w, h), or None when nothing is found or the box is implausibly small
    (see MIN_PAGE_AREA_FRACTION / MIN_PAGE_SIDE); callers then use the whole image.
    """
    if img_rgb.ndim == 3:
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_rgb
    mask = (gray > 200).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    x, y, w, h = cv2.boundingRect(max(contours, key=cv2.contourArea))
    if w * h < MIN_PAGE_AREA_FRACTION * gray.shape[0] * gray.shape[1] or min(w, h) < MIN_PAGE_SIDE:
        return None
    return int(x), int(y), int(w), int(h)


def candidate_sizes(
    box_w: int,
    box_h: int,
    extra: Optional[Sequence[Tuple[int, int]]] = None,
) -> List[Tuple[int, int]]:
    """
    Canonical (width, height) sizes to try for a located box, best first.

    Sizes whose aspect ratio is within 3% of box_w/box_h come first, nearest aspect first. ``extra``
    (exact render sizes read from the database) is prepended. Never returns an empty list: when no
    standard size matches, all CANONICAL_SIZES are returned.
    """
    result: List[Tuple[int, int]] = []
    for size in (extra or []):
        size = (int(size[0]), int(size[1]))
        if size not in result:
            result.append(size)

    if box_w > 0 and box_h > 0:
        aspect = box_w / float(box_h)
        near = []
        for (cw, ch) in CANONICAL_SIZES:
            diff = abs(cw / float(ch) - aspect) / aspect
            if diff <= ASPECT_TOLERANCE:
                near.append((diff, (cw, ch)))
        for _, size in sorted(near):
            if size not in result:
                result.append(size)

    if not result:
        result = list(CANONICAL_SIZES)
    return result


def phase_offsets(block_size: int, step: int = 1) -> Iterator[Tuple[int, int]]:
    """
    Yield (dy, dx) sub-block phase offsets, (0, 0) first, then the rest.

    With step=1 this is block_size**2 pairs (64 for 8x8); ``step`` thins the search for coarse carriers.
    """
    yield (0, 0)
    for dy in range(0, block_size, step):
        for dx in range(0, block_size, step):
            if (dy, dx) != (0, 0):
                yield (dy, dx)


def dct_basis_2d(block_size: int, u: int, v: int) -> np.ndarray:
    """
    Orthonormal 2-D DCT-II basis image for coefficient (u, v) of a block_size x block_size block
    (axis 0 <-> u, axis 1 <-> v; matches ``dct(dct(block.T).T)`` with norm='ortho').

    Projecting a block onto this image yields exactly that block's (u, v) DCT coefficient, which lets
    the extractor read one coefficient per block with a single matrix product instead of a full DCT.
    """
    n = block_size
    idx = np.arange(n)

    def _basis(k: int) -> np.ndarray:
        scale = np.sqrt(1.0 / n) if k == 0 else np.sqrt(2.0 / n)
        return scale * np.cos((2 * idx + 1) * k * np.pi / (2.0 * n))

    return np.outer(_basis(u), _basis(v))


def block_stack(
    y: np.ndarray, block_size: int, dy: int, dx: int, nbx: int, nby: int
) -> Optional[np.ndarray]:
    """
    Raster-ordered (rows outer, cols inner) stack of non-overlapping blocks, shape (nby*nbx, bs, bs),
    starting at pixel offset (dy, dx). Returns None if the image is too small for nbx x nby blocks.
    """
    h, w = y.shape
    if dy + nby * block_size > h or dx + nbx * block_size > w or nbx < 1 or nby < 1:
        return None
    region = y[dy:dy + nby * block_size, dx:dx + nbx * block_size]
    stack = region.reshape(nby, block_size, nbx, block_size).transpose(0, 2, 1, 3)
    return stack.reshape(-1, block_size, block_size)


def coeff_map(
    y: np.ndarray, u: int, v: int, block_size: int,
    dy: int = 0, dx: int = 0, nbx: Optional[int] = None, nby: Optional[int] = None,
) -> Optional[np.ndarray]:
    """
    DCT coefficient (u, v) of every block in raster order (1-D array), grid anchored at (dy, dx).

    nbx / nby default to ``blocks()`` of the (offset) image; pass the canonical counts to FORCE the
    row length so a phase offset cannot silently re-phase the payload.
    """
    h, w = y.shape
    if nbx is None:
        nbx = blocks(w - dx, block_size)
    if nby is None:
        nby = blocks(h - dy, block_size)
    stack = block_stack(y, block_size, dy, dx, nbx, nby)
    if stack is None:
        return None
    # float32 is ample here (pixel sums of <= 1024 terms in 0..255) and halves the memory traffic that
    # dominates the 64+ phase searches.
    basis = dct_basis_2d(block_size, u, v).reshape(-1).astype(np.float32)
    flat = stack.reshape(stack.shape[0], -1)
    if flat.dtype != np.float32:
        flat = flat.astype(np.float32)
    return (flat @ basis).astype(np.float64)
