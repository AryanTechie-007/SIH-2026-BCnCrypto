"""
CIPHERTRACE 2D DCT Frequency-Domain Steganography Engine
======================================================
Two independent carriers are written into the Y (luma) channel of every 150-DPI page render:

1. FINE FRAME  - the full authenticated forensic frame.
   - Reed-Solomon RS(255, 127) over GF(2^8): 127 data bytes + 128 parity bytes, t = 64 byte errors.
   - 8x8 block 2-D DCT (ortho), mid-frequency coefficient (2, 2), embed_strength 32.
   - 127-byte frame: magic, version, watermark ID, event ID, document / recipient fingerprints,
     session nonce, timestamp, algorithm IDs, 20 bytes reserved, 16-byte HMAC-SHA3-256 tag.
2. BEACON      - only the 10-byte watermark ID (the ledger / database lookup key) + a 4-byte HMAC tag.
   - RS(32, 14) over GF(2^8), t = 9. 32x32 blocks, coefficient (2, 2), strength 60.
   - A very low spatial frequency that survives the heavy downscaling + JPEG re-encoding of
     screenshots, where the fine frame does not.

Extraction never trusts an RS decode on its own: a detection requires the ``CPTC`` magic AND a valid
HMAC tag (fine frame) or a valid 4-byte tag (beacon). Anything else is reported as NOT detected.

Screenshots
-----------
The bit carried by block (row, col) is ``(row * blocks_per_row + col) % codeword_bits``, so a suspect image
must be brought back to the canonical page geometry before it can be read. ``extract_watermark`` therefore
locates the page rectangle, resamples it to each candidate canonical size EXACTLY, and searches the 8-px
sub-block phase (see ``watermark_geometry``).

Legacy profile
--------------
Documents watermarked by earlier builds (251-byte frame, RS(255, 251), coefficient (3, 3)) remain readable
at native geometry through the ``v2-legacy`` profile.
"""

import io
import hmac
import hashlib
import struct
import time
from dataclasses import dataclass
from typing import Tuple, Dict, Any, Union, Optional, List, Sequence

import fitz  # PyMuPDF
import cv2
import numpy as np
from PIL import Image
from reedsolo import RSCodec, ReedSolomonError
from scipy.fftpack import dct, idct

from app.config import settings
from app.services.crypto_engine import CryptoEngine
from app.services.watermark_geometry import (
    blocks,
    candidate_sizes,
    coeff_map,
    dct_basis_2d,
    block_stack,
    locate_page,
    phase_offsets,
)

IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif')


def _looks_like_image(head: bytes) -> bool:
    return (
        head.startswith(b"\x89PNG")
        or head.startswith(b"\xff\xd8")
        or (head.startswith(b"RIFF") and b"WEBP" in head[:16])
        or head.startswith(b"BM")
        or head.startswith(b"II*\x00")
        or head.startswith(b"MM\x00*")
    )


@dataclass(frozen=True)
class _Profile:
    """One fine-frame embedding/decoding profile."""
    name: str
    frame_len: int
    rs: RSCodec
    coord: Tuple[int, int]
    strength: float
    ecc_strategy: str


class WatermarkEngine:
    """
    High-fidelity 2D DCT steganography engine: fine RS(255, 127) frame + RS(32, 14) ID beacon.
    """

    MAGIC_HEADER = b"CPTC"
    PROTOCOL_VERSION = 3
    FRAME_DATA_LEN = 127        # bytes of raw frame carried by the fine carrier
    PARITY_LEN = 128            # Reed-Solomon parity bytes (t = 64)
    CODEWORD_LEN = 255          # codeword bytes (2040 bits) - MUST equal FRAME_DATA_LEN + PARITY_LEN
    TAG_LEN = 16                # trailing HMAC-SHA3-256 tag bytes
    FRAME_FIXED_LEN = 91        # magic .. algorithm IDs (bytes 0..90); the rest up to the tag is reserved
    ECC_STRATEGY = "Reed-Solomon RS(255, 127) over GF(2^8)"
    RS_PROFILE_LABEL = "RS(255,127)"     # short label persisted in WatermarkRecord.reed_solomon_profile

    HEAD_PREFILTER_MAX_BIT_ERRORS = 14   # of the 40 magic+version bits; see _try_fine

    LEGACY_PROFILE = "v2-legacy"
    CURRENT_PROFILE = "v3-current"
    LEGACY_FRAME_LEN = 251
    LEGACY_PARITY_LEN = 4
    LEGACY_COORD = (3, 3)
    LEGACY_STRENGTH = 20.0
    LEGACY_ECC_STRATEGY = "Reed-Solomon RS(255, 251) over GF(2^8)"

    BEACON_BLOCK = 32
    BEACON_COORD = (2, 2)
    BEACON_STRENGTH = 60.0
    BEACON_ID_LEN = 10
    BEACON_TAG_LEN = 4
    BEACON_N = 32               # beacon codeword bytes (256 bits)
    BEACON_PARITY = 18          # RS(32, 14), t = 9
    BEACON_ECC_STRATEGY = "Reed-Solomon RS(32, 14) over GF(2^8) (ID beacon)"

    def __init__(self, embed_strength: float = 32.0, render_dpi: int = 150):
        self.rs = RSCodec(self.PARITY_LEN)
        self._rs_legacy = RSCodec(self.LEGACY_PARITY_LEN)
        self._rs_beacon = RSCodec(self.BEACON_PARITY, nsize=self.BEACON_N)
        self.block_size = 8
        self.embed_coord = (2, 2)
        self.embed_strength = float(embed_strength)
        self.render_dpi = render_dpi

    def _profile(self, name: str) -> _Profile:
        if name == self.LEGACY_PROFILE:
            return _Profile(name, self.LEGACY_FRAME_LEN, self._rs_legacy, self.LEGACY_COORD,
                            self.LEGACY_STRENGTH, self.LEGACY_ECC_STRATEGY)
        return _Profile(self.CURRENT_PROFILE, self.FRAME_DATA_LEN, self.rs, self.embed_coord,
                        self.embed_strength, self.ECC_STRATEGY)

    # -------------------------------------------------------------
    # Forensic Watermark Frame Definition & Serialization
    # -------------------------------------------------------------
    @classmethod
    def build_watermark_frame(
        cls,
        watermark_id: str,
        event_id: str,
        document_hash: str,
        recipient_key_id: str,
        session_nonce: str,
        secret: Optional[bytes] = None,
        frame_len: Optional[int] = None
    ) -> bytes:
        """
        Constructs a structured, authenticated watermark frame (127 bytes; 251 for the legacy profile).
        Layout:
          [0..3]    : 4 bytes Magic header: b"CPTC"
          [4]       : 1 byte Protocol version (0x03)
          [5..14]   : 10 bytes Watermark ID (raw bytes from hex)
          [15..30]  : 16 bytes Event ID / UUID
          [31..46]  : 16 bytes Document Fingerprint (truncated SHA3-256)
          [47..62]  : 16 bytes Recipient Key ID Fingerprint
          [63..78]  : 16 bytes Session Nonce
          [79..86]  : 8 bytes Timestamp (Unix epoch big-endian)
          [87..88]  : 2 bytes KEM Algorithm ID (0x0001 = ML-KEM-768)
          [89..90]  : 2 bytes Signature Algorithm ID (0x0001 = ML-DSA-65)
          [91..len-17] : reserved zero padding (20 bytes for 127-byte frames, 144 for legacy 251)
          [len-16..len-1]: 16 bytes HMAC-SHA3-256 Authentication Tag over everything before it
        """
        frame_len = int(frame_len or cls.FRAME_DATA_LEN)
        if secret is None:
            secret = CryptoEngine.derive_system_secret()

        try:
            wm_id_raw = bytes.fromhex(watermark_id)[:10].ljust(10, b'\x00')
        except Exception:
            wm_id_raw = watermark_id.encode("ascii")[:10].ljust(10, b'\x00')

        try:
            ev_id_raw = bytes.fromhex(event_id.replace("-", ""))[:16].ljust(16, b'\x00')
        except Exception:
            ev_id_raw = event_id.encode("ascii")[:16].ljust(16, b'\x00')

        try:
            doc_fp_raw = bytes.fromhex(document_hash)[:16].ljust(16, b'\x00')
        except Exception:
            doc_fp_raw = hashlib.sha3_256(document_hash.encode()).digest()[:16]

        try:
            rec_fp_raw = bytes.fromhex(recipient_key_id)[:16].ljust(16, b'\x00')
        except Exception:
            rec_fp_raw = hashlib.sha3_256(recipient_key_id.encode()).digest()[:16]

        try:
            nonce_raw = bytes.fromhex(session_nonce)[:16].ljust(16, b'\x00')
        except Exception:
            nonce_raw = session_nonce.encode("ascii")[:16].ljust(16, b'\x00')

        ts = int(time.time())
        ts_bytes = struct.pack(">Q", ts)
        algo_ids = struct.pack(">HH", 1, 1)
        body_len = frame_len - cls.TAG_LEN
        padding = b"\x00" * (body_len - cls.FRAME_FIXED_LEN)

        body = (
            cls.MAGIC_HEADER +
            bytes([cls.PROTOCOL_VERSION]) +
            wm_id_raw +
            ev_id_raw +
            doc_fp_raw +
            rec_fp_raw +
            nonce_raw +
            ts_bytes +
            algo_ids +
            padding
        )
        assert len(body) == body_len, f"Frame body length must be {body_len} bytes, got {len(body)}"

        tag = hmac.new(secret, body, hashlib.sha3_256).digest()[:cls.TAG_LEN]
        frame = body + tag
        assert len(frame) == frame_len, f"Total frame must be {frame_len} bytes, got {len(frame)}"
        return frame

    @classmethod
    def parse_watermark_frame(cls, frame: bytes, secret: Optional[bytes] = None) -> Optional[Dict[str, Any]]:
        """
        Parses and verifies an extracted watermark frame (current 127 bytes, or legacy 251 bytes).
        The tag is always the trailing 16 bytes and covers everything before it.
        """
        if len(frame) not in (cls.FRAME_DATA_LEN, cls.LEGACY_FRAME_LEN):
            return None
        if not frame.startswith(cls.MAGIC_HEADER):
            return None

        if secret is None:
            try:
                secret = CryptoEngine.derive_system_secret()
            except Exception:
                secret = b""

        version = frame[4]
        wm_id_hex = frame[5:15].hex()
        ev_id_raw = frame[15:31]
        doc_fp_hex = frame[31:47].hex()
        rec_fp_hex = frame[47:63].hex()
        nonce_hex = frame[63:79].hex()
        ts = struct.unpack(">Q", frame[79:87])[0]
        kem_algo_id, dsa_algo_id = struct.unpack(">HH", frame[87:91])
        tag = frame[-cls.TAG_LEN:]

        tag_valid = False
        if secret:
            expected_tag = hmac.new(secret, frame[:-cls.TAG_LEN], hashlib.sha3_256).digest()[:cls.TAG_LEN]
            tag_valid = hmac.compare_digest(tag, expected_tag)

        return {
            "magic": cls.MAGIC_HEADER.decode("ascii"),
            "version": version,
            "watermark_id": wm_id_hex,
            "event_id_raw": ev_id_raw.hex(),
            "document_fingerprint": doc_fp_hex,
            "recipient_key_id": rec_fp_hex,
            "session_nonce": nonce_hex,
            "timestamp": ts,
            "kem_algorithm": "ML-KEM-768" if kem_algo_id == 1 else f"ALGO_{kem_algo_id}",
            "signature_algorithm": "ML-DSA-65" if dsa_algo_id == 1 else f"ALGO_{dsa_algo_id}",
            "authenticity_tag_valid": tag_valid
        }

    # -------------------------------------------------------------
    # Beacon payload: 10-byte watermark ID + 4-byte HMAC, RS(32, 14)
    # -------------------------------------------------------------
    @classmethod
    def beacon_tag(cls, wm_id_raw: bytes, secret: Optional[bytes] = None) -> bytes:
        if secret is None:
            secret = CryptoEngine.derive_system_secret()
        return hmac.new(secret, wm_id_raw, hashlib.sha3_256).digest()[:cls.BEACON_TAG_LEN]

    def build_beacon_codeword(self, wm_id_raw: bytes, secret: Optional[bytes] = None) -> bytes:
        payload = wm_id_raw + self.beacon_tag(wm_id_raw, secret)
        codeword = bytes(self._rs_beacon.encode(payload))
        assert len(codeword) == self.BEACON_N
        return codeword

    # -------------------------------------------------------------
    # 2D DCT Mathematics (kept for API compatibility)
    # -------------------------------------------------------------
    def _dct2(self, block: np.ndarray) -> np.ndarray:
        return dct(dct(block.T, norm='ortho').T, norm='ortho')

    def _idct2(self, block: np.ndarray) -> np.ndarray:
        return idct(idct(block.T, norm='ortho').T, norm='ortho')

    @staticmethod
    def _bytes_to_bits(data: bytes) -> np.ndarray:
        return np.unpackbits(np.frombuffer(bytes(data), dtype=np.uint8))

    @staticmethod
    def _embed_carrier(y_f: np.ndarray, bits: np.ndarray, u: int, v: int, bs: int, strength: float) -> None:
        """
        Sets DCT coefficient (u, v) of every bs x bs block of y_f (in place) to +/-strength according to
        ``bits[block_index % len(bits)]``, block_index in raster order over the SAME grid the extractor
        walks (``range(0, dim - bs, bs)``). Equivalent to dct -> set coefficient -> idct per block.
        """
        h, w = y_f.shape
        nby, nbx = blocks(h, bs), blocks(w, bs)
        if nby < 1 or nbx < 1:
            return
        stack = block_stack(y_f, bs, 0, 0, nbx, nby).astype(np.float64)
        basis = dct_basis_2d(bs, u, v)
        cur = stack.reshape(stack.shape[0], -1) @ basis.reshape(-1)
        n = stack.shape[0]
        target = np.where(bits[np.arange(n) % len(bits)] == 1, strength, -strength)
        new = stack + (target - cur)[:, None, None] * basis[None, :, :]
        region = new.reshape(nby, nbx, bs, bs).transpose(0, 2, 1, 3).reshape(nby * bs, nbx * bs)
        y_f[:nby * bs, :nbx * bs] = region

    # -------------------------------------------------------------
    # Watermark Embedding: fine RS(255, 127) frame + ID beacon
    # -------------------------------------------------------------
    def embed_watermark(
        self,
        input_pdf_path: str,
        payload: Union[bytes, str],
        output_pdf_path: str,
        frame_metadata: Optional[Dict[str, Any]] = None,
        profile: str = CURRENT_PROFILE
    ) -> str:
        prof = self._profile(profile)
        legacy = prof.name == self.LEGACY_PROFILE

        if isinstance(payload, str):
            try:
                raw_payload = bytes.fromhex(payload)
            except Exception:
                raw_payload = payload.encode("utf-8")
        else:
            raw_payload = payload

        if len(raw_payload) == prof.frame_len and raw_payload.startswith(self.MAGIC_HEADER):
            frame = raw_payload
        else:
            wm_id = raw_payload[:10].hex()
            ev_id = (frame_metadata or {}).get("event_id", "0" * 32)
            doc_h = (frame_metadata or {}).get("doc_hash", "0" * 32)
            rec_id = (frame_metadata or {}).get("recipient_key_id", "0" * 32)
            nonce = (frame_metadata or {}).get("session_nonce", "0" * 32)
            frame = self.build_watermark_frame(wm_id, str(ev_id), doc_h, rec_id, nonce, frame_len=prof.frame_len)

        coded_payload = bytes(prof.rs.encode(frame))
        assert len(coded_payload) == self.CODEWORD_LEN, f"Codeword must be 255 bytes, got {len(coded_payload)}"
        fine_bits = self._bytes_to_bits(coded_payload)

        beacon_bits = None
        if not legacy:
            beacon_bits = self._bytes_to_bits(self.build_beacon_codeword(frame[5:15]))

        src_doc = fitz.open(input_pdf_path)
        try:
            if len(src_doc) > settings.MAX_PDF_PAGES:
                raise ValueError(
                    f"Document has {len(src_doc)} pages; maximum supported is {settings.MAX_PDF_PAGES}"
                )
            out_doc = fitz.open()
            try:
                u, v = prof.coord
                for page in src_doc:
                    rect = page.rect
                    pix = page.get_pixmap(dpi=self.render_dpi)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    img_np = np.array(img, dtype=np.uint8)

                    ycrcb = cv2.cvtColor(img_np, cv2.COLOR_RGB2YCrCb)
                    y, cr, cb = cv2.split(ycrcb)
                    y_f = y.astype(np.float32)

                    # Fine carrier first, then the coarse beacon on top.
                    self._embed_carrier(y_f, fine_bits, u, v, self.block_size, prof.strength)
                    if beacon_bits is not None:
                        bu, bv = self.BEACON_COORD
                        self._embed_carrier(y_f, beacon_bits, bu, bv, self.BEACON_BLOCK, self.BEACON_STRENGTH)

                    y_out = np.clip(y_f, 0, 255).astype(np.uint8)
                    merged = cv2.merge([y_out, cr, cb])
                    final_img = cv2.cvtColor(merged, cv2.COLOR_YCrCb2RGB)

                    with io.BytesIO() as buf:
                        Image.fromarray(final_img).save(buf, format="PNG")
                        png_bytes = buf.getvalue()

                    new_page = out_doc.new_page(width=rect.width, height=rect.height)
                    new_page.insert_image(rect, stream=png_bytes)
                    del png_bytes, final_img, merged, y_out
                out_doc.save(output_pdf_path)
            finally:
                out_doc.close()
        finally:
            src_doc.close()
        return output_pdf_path

    @classmethod
    def render_size(cls, pdf_path: str, dpi: int = 150) -> Tuple[int, int]:
        """Pixel size (w, h) that page 0 of ``pdf_path`` renders to at ``dpi`` - the canonical geometry."""
        doc = fitz.open(pdf_path)
        try:
            scale = dpi / 72.0
            r = (doc[0].rect * fitz.Matrix(scale, scale)).irect
            return int(r.width), int(r.height)
        finally:
            doc.close()

    # -------------------------------------------------------------
    # Extraction primitives
    # -------------------------------------------------------------
    @staticmethod
    def _luma(rgb: np.ndarray) -> np.ndarray:
        ycrcb = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
        return cv2.split(ycrcb)[0].astype(np.float32)

    @staticmethod
    def _fold_bits(vals: np.ndarray, nbits: int, strength: float) -> Tuple[bytes, float]:
        """Averages the coefficient stream modulo ``nbits``, thresholds on sign, packs MSB-first."""
        idx = np.arange(vals.size) % nbits
        sums = np.bincount(idx, weights=vals, minlength=nbits)
        counts = np.bincount(idx, minlength=nbits)
        avg = sums / np.maximum(counts, 1)
        coded = np.packbits((avg > 0).astype(np.uint8)).tobytes()
        carrier_strength = float(min(1.0, max(0.0, float(np.mean(np.abs(avg))) / strength)))
        return coded, carrier_strength

    def _failure(self, reason: str, ecc_strategy: str, carrier_strength: float = 0.0,
                 analysis: Optional[str] = None) -> Dict[str, Any]:
        return {
            "watermark_detected": False,
            "attribution_tier": "none",
            "authenticity_tag_valid": False,
            "carrier_strength": carrier_strength,
            "bit_error_rate": 100.0,
            "payload_recovery_pct": 0.0,
            "ecc_strategy": ecc_strategy,
            "failure_reason": reason,
            "analysis": analysis or f"No authenticated watermark recovered ({reason})",
            "extracted_raw_hex": ""
        }

    def _try_fine(
        self, y: np.ndarray, prof: _Profile, dy: int = 0, dx: int = 0,
        nbx: Optional[int] = None, nby: Optional[int] = None
    ) -> Tuple[Optional[bytes], Dict[str, Any]]:
        """One fine-frame decode attempt at a fixed grid. Success requires magic AND a valid HMAC tag."""
        nbits = self.CODEWORD_LEN * 8
        u, v = prof.coord
        vals = coeff_map(y, u, v, self.block_size, dy, dx, nbx, nby)
        if vals is None or vals.size < nbits:
            return None, self._failure("image_too_small", prof.ecc_strategy,
                                       analysis="Image too small for watermark extraction")
        coded, carrier_strength = self._fold_bits(vals, nbits, prof.strength)

        # Cheap pre-filter so the phase search does not pay for a full RS decode on every misaligned
        # grid. The code is systematic, so the first bytes of the codeword ARE the frame's magic +
        # version. Random data disagrees on ~20 of these 40 bits; a genuine frame within the RS budget
        # disagrees on far fewer.
        expected_head = self.MAGIC_HEADER + bytes([self.PROTOCOL_VERSION])
        head_bit_errors = int(np.unpackbits(
            np.frombuffer(coded[:len(expected_head)], dtype=np.uint8) ^
            np.frombuffer(expected_head, dtype=np.uint8)).sum())
        if head_bit_errors > self.HEAD_PREFILTER_MAX_BIT_ERRORS:
            return None, self._failure("magic_mismatch", prof.ecc_strategy, carrier_strength)

        try:
            candidate = bytes(prof.rs.decode(coded)[0])
        except ReedSolomonError:
            return None, self._failure("rs_decode_failed", prof.ecc_strategy, carrier_strength,
                                       "Reed-Solomon decoding threshold exceeded")
        if len(candidate) != prof.frame_len:
            return None, self._failure("bad_length", prof.ecc_strategy, carrier_strength)
        if not candidate.startswith(self.MAGIC_HEADER):
            return None, self._failure("magic_mismatch", prof.ecc_strategy, carrier_strength)
        parsed = self.parse_watermark_frame(candidate)
        if not parsed or not parsed["authenticity_tag_valid"]:
            return None, self._failure("hmac_invalid", prof.ecc_strategy, carrier_strength)

        re_encoded = bytes(prof.rs.encode(candidate))
        corrupted = sum(a != b for a, b in zip(coded, re_encoded))
        return candidate, {
            "watermark_detected": True,
            "attribution_tier": "frame",
            "authenticity_tag_valid": True,
            "carrier_strength": carrier_strength,
            "bit_error_rate": float(corrupted / float(self.CODEWORD_LEN) * 100.0),
            "corrupted_bytes_count": corrupted,
            "ecc_corrected": corrupted > 0,
            "payload_recovery_pct": float(max(0.0, 1.0 - corrupted / float(self.CODEWORD_LEN)) * 100.0),
            "extracted_raw_hex": candidate.hex(),
            "watermark_id": parsed["watermark_id"],
            "frame": parsed,
            "profile": prof.name,
            "ecc_strategy": prof.ecc_strategy,
            "analysis": f"{prof.ecc_strategy} multi-tile accumulated decoding "
                        f"(repetitions: {(vals.size // nbits)}x, profile {prof.name})"
        }

    def _try_beacon(
        self, y: np.ndarray, dy: int = 0, dx: int = 0,
        nbx: Optional[int] = None, nby: Optional[int] = None
    ) -> Tuple[Optional[bytes], Dict[str, Any]]:
        """One beacon decode attempt. Success requires RS decode AND a valid 4-byte HMAC over the ID."""
        nbits = self.BEACON_N * 8
        u, v = self.BEACON_COORD
        vals = coeff_map(y, u, v, self.BEACON_BLOCK, dy, dx, nbx, nby)
        if vals is None or vals.size < nbits:
            return None, self._failure("image_too_small", self.BEACON_ECC_STRATEGY)
        coded, carrier_strength = self._fold_bits(vals, nbits, self.BEACON_STRENGTH)
        try:
            payload = bytes(self._rs_beacon.decode(coded)[0])
        except ReedSolomonError:
            return None, self._failure("rs_decode_failed", self.BEACON_ECC_STRATEGY, carrier_strength)
        if len(payload) != self.BEACON_ID_LEN + self.BEACON_TAG_LEN:
            return None, self._failure("bad_length", self.BEACON_ECC_STRATEGY, carrier_strength)
        wm_id_raw, tag = payload[:self.BEACON_ID_LEN], payload[self.BEACON_ID_LEN:]
        if not hmac.compare_digest(tag, self.beacon_tag(wm_id_raw)):
            return None, self._failure("hmac_invalid", self.BEACON_ECC_STRATEGY, carrier_strength)

        corrupted = sum(a != b for a, b in zip(coded, bytes(self._rs_beacon.encode(payload))))
        return wm_id_raw, {
            "watermark_detected": True,
            "attribution_tier": "beacon",
            "authenticity_tag_valid": True,
            "carrier_strength": carrier_strength,
            "bit_error_rate": float(corrupted / float(self.BEACON_N) * 100.0),
            "corrupted_bytes_count": corrupted,
            "ecc_corrected": corrupted > 0,
            "payload_recovery_pct": float(max(0.0, 1.0 - corrupted / float(self.BEACON_N)) * 100.0),
            "extracted_raw_hex": wm_id_raw.hex(),
            "watermark_id": wm_id_raw.hex(),
            "frame": None,
            "profile": self.CURRENT_PROFILE,
            "ecc_strategy": self.BEACON_ECC_STRATEGY,
            "analysis": "Only the watermark ID beacon was recovered (fine forensic frame unrecoverable)"
        }

    def _extract_from_image(self, img: Image.Image) -> Tuple[Union[bytes, None], Dict[str, Any]]:
        """
        Fast path: read the image at its NATIVE geometry with the current profile, then the legacy
        profile. No geometry search, no beacon. Use ``extract_from_image`` for the full pipeline.
        """
        y = self._luma(np.array(img.convert("RGB"), dtype=np.uint8))
        first_failure: Optional[Dict[str, Any]] = None
        for name in (self.CURRENT_PROFILE, self.LEGACY_PROFILE):
            payload, metrics = self._try_fine(y, self._profile(name))
            if payload is not None:
                return payload, metrics
            if first_failure is None:
                first_failure = metrics
        return None, first_failure

    def _search_regions(self, rgb: np.ndarray, extra_sizes: Optional[Sequence[Tuple[int, int]]]):
        """(page_box, [(canonical_w, canonical_h, crop_resized_rgb), ...]) - crops resampled EXACTLY."""
        h, w = rgb.shape[:2]
        box = locate_page(rgb) or (0, 0, w, h)
        x, yy, bw, bh = box
        crop = Image.fromarray(rgb[yy:yy + bh, x:x + bw])
        regions = []
        for (cw, ch) in candidate_sizes(bw, bh, extra_sizes):
            norm = np.array(crop.resize((cw, ch), Image.LANCZOS), dtype=np.uint8)
            regions.append((cw, ch, norm))
        return box, regions

    @staticmethod
    def _pad_luma(norm_rgb: np.ndarray, pad: int) -> np.ndarray:
        """Edge-pad AFTER the exact resize so phase offsets never shrink the block grid."""
        padded = cv2.copyMakeBorder(norm_rgb, 0, pad, 0, pad, cv2.BORDER_REPLICATE)
        return WatermarkEngine._luma(padded)

    def _extract_with_geometry_search(
        self, rgb: np.ndarray, extra_sizes: Optional[Sequence[Tuple[int, int]]] = None
    ) -> Tuple[Optional[bytes], Dict[str, Any]]:
        """Fine-frame recovery from a screenshot: locate page -> exact rescale -> 8-px phase search."""
        prof = self._profile(self.CURRENT_PROFILE)
        bs = self.block_size
        box, regions = self._search_regions(rgb, extra_sizes)
        lumas = [(cw, ch, self._pad_luma(norm, bs)) for cw, ch, norm in regions]
        last = self._failure("no_candidate", prof.ecc_strategy)

        def attempt(cw, ch, y, dy, dx):
            return self._try_fine(y, prof, dy, dx, blocks(cw, bs), blocks(ch, bs))

        for cw, ch, y in lumas:                       # (0, 0) at every size first
            payload, m = attempt(cw, ch, y, 0, 0)
            if payload is not None:
                m["geometry"] = {"canonical_size": [cw, ch], "phase": [0, 0], "page_box": list(box)}
                return payload, m
            last = m
        for cw, ch, y in lumas:                       # then the remaining 63 phases
            for dy, dx in phase_offsets(bs):
                if (dy, dx) == (0, 0):
                    continue
                payload, m = attempt(cw, ch, y, dy, dx)
                if payload is not None:
                    m["geometry"] = {"canonical_size": [cw, ch], "phase": [dx, dy], "page_box": list(box)}
                    return payload, m
                last = m
        return None, last

    def _extract_beacon(
        self, rgb: np.ndarray, extra_sizes: Optional[Sequence[Tuple[int, int]]] = None
    ) -> Tuple[Optional[bytes], Dict[str, Any]]:
        """ID-only recovery: same search as the fine frame at the beacon block size, phases stepped by 2."""
        bs = self.BEACON_BLOCK
        last = self._failure("no_candidate", self.BEACON_ECC_STRATEGY)

        # Native geometry (exact 150-DPI renders).
        payload, m = self._try_beacon(self._luma(rgb))
        if payload is not None:
            return payload, m

        box, regions = self._search_regions(rgb, extra_sizes)
        lumas = [(cw, ch, self._pad_luma(norm, bs)) for cw, ch, norm in regions]

        def attempt(cw, ch, y, dy, dx):
            return self._try_beacon(y, dy, dx, blocks(cw, bs), blocks(ch, bs))

        for cw, ch, y in lumas:
            payload, m = attempt(cw, ch, y, 0, 0)
            if payload is not None:
                m["geometry"] = {"canonical_size": [cw, ch], "phase": [0, 0], "page_box": list(box)}
                return payload, m
            last = m
        for cw, ch, y in lumas:
            for dy, dx in phase_offsets(bs, step=2):
                if (dy, dx) == (0, 0):
                    continue
                payload, m = attempt(cw, ch, y, dy, dx)
                if payload is not None:
                    m["geometry"] = {"canonical_size": [cw, ch], "phase": [dx, dy], "page_box": list(box)}
                    return payload, m
                last = m
        return None, last

    def extract_from_image(
        self, img: Image.Image, extra_sizes: Optional[Sequence[Tuple[int, int]]] = None
    ) -> Tuple[Union[bytes, None], Dict[str, Any]]:
        """
        Full extraction pipeline for an image of unknown geometry:
          1. native geometry, current profile, then legacy profile
          2. geometry search (page box -> exact rescale -> phase search), current profile
          3. ID beacon
        Returns (payload, metrics). payload is the authenticated frame (tier "frame"), the 10-byte watermark
        ID (tier "beacon"), or None (tier "none").
        """
        payload, metrics = self._extract_from_image(img)
        if payload is not None:
            return payload, metrics
        primary_failure = metrics

        rgb = np.array(img.convert("RGB"), dtype=np.uint8)
        payload, m = self._extract_with_geometry_search(rgb, extra_sizes)
        if payload is not None:
            return payload, m

        payload, m = self._extract_beacon(rgb, extra_sizes)
        if payload is not None:
            return payload, m

        return None, primary_failure

    # -------------------------------------------------------------
    # Public extraction entry point
    # -------------------------------------------------------------
    def _render_pdf_pages(self, doc: "fitz.Document"):
        """Yields each page (up to MAX_PDF_PAGES) rendered at the canonical DPI."""
        for idx, page in enumerate(doc):
            if idx >= settings.MAX_PDF_PAGES:
                break
            pix = page.get_pixmap(dpi=self.render_dpi)
            yield Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    def _extract_pdf(self, doc: "fitz.Document", extra_sizes) -> Tuple[Union[bytes, None], Dict[str, Any]]:
        """Every page carries an independent codeword: try each until one authenticates."""
        first_img: Optional[Image.Image] = None
        first_failure: Optional[Dict[str, Any]] = None
        for page_img in self._render_pdf_pages(doc):
            payload, metrics = self._extract_from_image(page_img)
            if payload is not None:
                return payload, metrics
            if first_img is None:
                first_img, first_failure = page_img, metrics
        if first_img is None:
            return None, self._failure("empty_document", self.ECC_STRATEGY, analysis="Document has no pages")
        payload, metrics = self.extract_from_image(first_img, extra_sizes)
        return (payload, metrics) if payload is not None else (None, first_failure)

    def extract_watermark(
        self,
        document_path: Union[str, bytes],
        extra_sizes: Optional[Sequence[Tuple[int, int]]] = None
    ) -> Tuple[Union[bytes, None], Dict[str, Any]]:
        """
        Extracts the watermark from a PDF or an image (PNG / JPEG / WebP / BMP / TIFF), given as a path or
        raw bytes. ``extra_sizes`` = exact canonical render sizes known from the database (tried first).
        """
        try:
            if isinstance(document_path, bytes):
                if _looks_like_image(document_path[:16]):
                    base_img = Image.open(io.BytesIO(document_path)).convert("RGB")
                else:
                    doc = fitz.open(stream=document_path, filetype="pdf")
                    try:
                        return self._extract_pdf(doc, extra_sizes)
                    finally:
                        doc.close()
            else:
                path = str(document_path)
                with open(path, "rb") as fh:
                    head = fh.read(16)
                if _looks_like_image(head) or path.lower().endswith(IMAGE_EXTENSIONS):
                    base_img = Image.open(path).convert("RGB")
                else:
                    doc = fitz.open(path)
                    try:
                        return self._extract_pdf(doc, extra_sizes)
                    finally:
                        doc.close()
        except Exception as e:
            metrics = self._failure("unreadable_file", self.ECC_STRATEGY, analysis="Unreadable file format")
            metrics["error"] = f"Failed to parse document: {str(e)}"
            return None, metrics

        return self.extract_from_image(base_img, extra_sizes)

    @staticmethod
    def calculate_psnr(original: np.ndarray, modified: np.ndarray) -> float:
        """Computes Peak Signal-to-Noise Ratio (PSNR) in dB."""
        mse = np.mean((original.astype(float) - modified.astype(float)) ** 2)
        if mse == 0:
            return 100.0
        return float(20 * np.log10(255.0 / np.sqrt(mse)))
