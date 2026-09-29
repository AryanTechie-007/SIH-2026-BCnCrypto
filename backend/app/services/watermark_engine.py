"""
CIPHERTRACE 2D DCT Frequency-Domain Steganography Engine
======================================================
Mathematical Specifications:
- Color Space: YCrCb Luminance (Y channel processing, Cr/Cb untouched for zero color shift).
- Frequency Transform: 8x8 block 2D Discrete Cosine Transform (ortho-normalized).
- Mid-Band Modulation: Coordinate (3, 3) frequency coefficient modulation.
- Forward Error Correction: Genuine Reed-Solomon RS(255, 127) via reedsolo.
  - 127 Data Symbols (Forensic Frame)
  - 128 Parity Symbols
  - Maximum Symbol Error Correction: t = (255 - 127) / 2 = 64 byte errors.
- Structured Watermark Frame: 127-byte authenticated frame bound to document, recipient,
  session nonce, event ID, and HMAC-SHA3-256 integrity tag.
"""

import io
import os
import struct
import hmac
import hashlib
from typing import Tuple, Dict, Any, Union, Optional
import fitz  # PyMuPDF
import cv2
import numpy as np
from PIL import Image
from reedsolo import RSCodec, ReedSolomonError
from scipy.fftpack import dct, idct

from app.config import settings
from app.services.crypto_engine import CryptoEngine


class WatermarkEngine:
    """
    Robust 2D DCT frequency-domain steganography engine with genuine RS(255, 127) ECC.
    """

    MAGIC_HEADER = b"CPTC"
    PROTOCOL_VERSION = 2
    FRAME_DATA_LEN = 127        # 127 bytes raw frame
    PARITY_LEN = 128            # 128 bytes Reed-Solomon parity
    CODEWORD_LEN = 255          # 255 bytes codeword (2040 bits)
    ECC_STRATEGY = "Reed-Solomon RS(255, 127)"

    def __init__(self, embed_strength: float = 28.0, render_dpi: int = 150):
        # RS(255, 127) requires 128 parity bytes
        self.rs = RSCodec(self.PARITY_LEN)
        self.block_size = 8
        self.embed_coord = (3, 3)
        self.embed_strength = float(embed_strength)
        self.render_dpi = render_dpi

    # -------------------------------------------------------------
    # 127-Byte Forensic Watermark Frame Definition & Serialization
    # -------------------------------------------------------------
    @classmethod
    def build_watermark_frame(
        cls,
        watermark_id: str,
        event_id: str,
        document_hash: str,
        recipient_key_id: str,
        session_nonce: str,
        secret: Optional[bytes] = None
    ) -> bytes:
        """
        Constructs a structured, authenticated 127-byte watermark frame.
        Layout:
          [0..3]    : 4 bytes Magic header: b"CPTC"
          [4]       : 1 byte Protocol version (0x02)
          [5..14]   : 10 bytes Watermark ID (raw bytes from hex)
          [15..30]  : 16 bytes Event ID / UUID
          [31..46]  : 16 bytes Document Fingerprint (truncated SHA3-256)
          [47..62]  : 16 bytes Recipient Key ID Fingerprint
          [63..78]  : 16 bytes Session Nonce
          [79..86]  : 8 bytes Timestamp (Unix epoch big-endian)
          [87..88]  : 2 bytes KEM Algorithm ID (0x0001 = ML-KEM-768)
          [89..90]  : 2 bytes Signature Algorithm ID (0x0001 = ML-DSA-65)
          [91..110] : 20 bytes Reserved / Context padding
          [111..126]: 16 bytes HMAC-SHA3-256 Authentication Tag
        Total: exactly 127 bytes.
        """
        if secret is None:
            secret = CryptoEngine.derive_system_secret()

        # Convert hex inputs to raw bytes with safe sizing
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

        import time
        ts = int(time.time())
        ts_bytes = struct.pack(">Q", ts)
        algo_ids = struct.pack(">HH", 1, 1)  # 1=ML-KEM-768, 1=ML-DSA-65
        padding = b"\x00" * 20

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
        assert len(body) == 111, f"Frame body length must be 111 bytes, got {len(body)}"

        tag = hmac.new(secret, body, hashlib.sha3_256).digest()[:16]
        frame = body + tag
        assert len(frame) == cls.FRAME_DATA_LEN, f"Total frame must be 127 bytes, got {len(frame)}"
        return frame

    @classmethod
    def parse_watermark_frame(cls, frame: bytes, secret: Optional[bytes] = None) -> Optional[Dict[str, Any]]:
        """
        Parses and verifies an extracted 127-byte watermark frame.
        Returns parsed metadata dictionary or None if magic/length invalid.
        """
        if len(frame) != cls.FRAME_DATA_LEN:
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
        tag = frame[111:127]

        # Verify HMAC tag if secret available
        tag_valid = False
        if secret:
            expected_tag = hmac.new(secret, frame[:111], hashlib.sha3_256).digest()[:16]
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
    # 2D DCT Mathematics
    # -------------------------------------------------------------
    def _dct2(self, block: np.ndarray) -> np.ndarray:
        return dct(dct(block.T, norm='ortho').T, norm='ortho')

    def _idct2(self, block: np.ndarray) -> np.ndarray:
        return idct(idct(block.T, norm='ortho').T, norm='ortho')

    # -------------------------------------------------------------
    # Watermark Embedding: RS(255, 127) + 2D DCT Luminance Lattice
    # -------------------------------------------------------------
    def embed_watermark(
        self,
        input_pdf_path: str,
        payload: Union[bytes, str],
        output_pdf_path: str,
        frame_metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Embeds authenticated watermark frame into the PDF document.
        - Encodes 127-byte payload with RS(255, 127) -> 255 bytes codeword (2040 bits).
        - Embeds imperceptibly in 8x8 DCT mid-frequency coefficient (3, 3) across Y channel.
        - Zero color shift: Cr and Cb channels remain strictly untouched.
        - Tiled redundantly across page canvas.
        """
        if isinstance(payload, str):
            try:
                raw_payload = bytes.fromhex(payload)
            except Exception:
                raw_payload = payload.encode("utf-8")
        else:
            raw_payload = payload

        # If payload is 127 bytes structured frame, use as is; otherwise wrap into frame
        if len(raw_payload) == self.FRAME_DATA_LEN and raw_payload.startswith(self.MAGIC_HEADER):
            frame = raw_payload
        else:
            # Build structured 127-byte frame from metadata or payload
            wm_id = raw_payload[:10].hex()
            ev_id = (frame_metadata or {}).get("event_id", "00000000000000000000000000000000")
            doc_h = (frame_metadata or {}).get("doc_hash", "00000000000000000000000000000000")
            rec_id = (frame_metadata or {}).get("recipient_key_id", "00000000000000000000000000000000")
            nonce = (frame_metadata or {}).get("session_nonce", "00000000000000000000000000000000")
            frame = self.build_watermark_frame(wm_id, str(ev_id), doc_h, rec_id, nonce)

        # Reed-Solomon RS(255, 127) encode
        coded_payload = self.rs.encode(frame)
        assert len(coded_payload) == self.CODEWORD_LEN, f"Codeword must be 255 bytes, got {len(coded_payload)}"
        bits = ''.join(format(b, '08b') for b in coded_payload)  # 2040 bits

        src_doc = fitz.open(input_pdf_path)
        out_doc = fitz.open()

        for page_idx, page in enumerate(src_doc):
            rect = page.rect
            pix = page.get_pixmap(dpi=self.render_dpi)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img_np = np.array(img, dtype=np.uint8)

            # Strict uint8 RGB to YCrCb conversion
            ycrcb = cv2.cvtColor(img_np, cv2.COLOR_RGB2YCrCb)
            y, cr, cb = cv2.split(ycrcb)
            y_f = y.astype(np.float32)

            h, w = y_f.shape

            # Embed across document content using redundant tiling
            bit_idx = 0
            for i in range(0, h - self.block_size, self.block_size):
                for j in range(0, w - self.block_size, self.block_size):
                    block = y_f[i:i + self.block_size, j:j + self.block_size]
                    d_block = self._dct2(block)
                    # Modulate low-mid band frequencies (1, 2) & (2, 1) for screen-capture resilience + (3, 3)
                    target_val = self.embed_strength if bits[bit_idx % len(bits)] == '1' else -self.embed_strength
                    d_block[1, 2] = target_val
                    d_block[2, 1] = target_val
                    d_block[3, 3] = target_val
                    y_f[i:i + self.block_size, j:j + self.block_size] = self._idct2(d_block)
                    bit_idx += 1

            # Reconstruct RGB with unaltered Cr, Cb channels (zero color shift)
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
        out_doc.close()
        src_doc.close()
        return output_pdf_path

    # -------------------------------------------------------------
    # Watermark Extraction & RS(255, 127) Decoding
    # -------------------------------------------------------------
    def _extract_from_image(self, img: Image.Image) -> Tuple[Union[bytes, None], Dict[str, Any]]:
        img_np = np.array(img, dtype=np.uint8)
        ycrcb = cv2.cvtColor(img_np, cv2.COLOR_RGB2YCrCb)
        y, _, _ = cv2.split(ycrcb)
        y_f = y.astype(np.float32)
        h, w = y_f.shape

        required_bits = self.CODEWORD_LEN * 8  # 2040 bits
        best_overall_metrics = None
        min_overall_ber = 100.0
        all_candidate_streams = []

        # Evaluate extraction across two candidate frequency representations:
        # Mode A: Robust low-mid band ((1,2) + (2,1))/2 (survives screen capture, downscaling)
        # Mode B: Standard mid-band (3,3) (for legacy documents)
        modes = [
            ("low_mid", lambda d: (d[1, 2] + d[2, 1]) / 2.0),
            ("legacy_mid", lambda d: d[3, 3])
        ]

        for mode_name, get_val in modes:
            bit_results = []
            for i in range(0, h - self.block_size, self.block_size):
                for j in range(0, w - self.block_size, self.block_size):
                    block = y_f[i:i + self.block_size, j:j + self.block_size]
                    d_block = self._dct2(block)
                    val = get_val(d_block)
                    bit_results.append(('1' if val > 0 else '0', abs(val)))

            if len(bit_results) < required_bits:
                continue

            # Record initial stream for cross-correlation hypothesis testing
            stream_0 = "".join([b[0] for b in bit_results[:required_bits]])
            all_candidate_streams.append(stream_0)

            max_windows = min(len(bit_results) - required_bits + 1, 2048)
            step = 64

            for offset in range(0, max_windows, step):
                window = bit_results[offset:offset + required_bits]
                extracted_bits = "".join([b[0] for b in window])
                byte_list = [int(extracted_bits[k:k + 8], 2) for k in range(0, required_bits, 8)]
                coded_payload = bytes(byte_list)

                avg_magnitude = float(np.mean([b[1] for b in window]))
                confidence = float(min(1.0, max(0.0, avg_magnitude / self.embed_strength)))

                corrupted_indices = [int(idx) for idx, (b, mag) in enumerate(window) if mag < (self.embed_strength * 0.25)]
                ber = float((len(corrupted_indices) / float(required_bits)) * 100.0)

                cur_metrics = {
                    "watermark_detected": (ber < 60.0 and avg_magnitude >= 3.0),
                    "confidence": confidence,
                    "bit_error_rate": ber,
                    "corrupted_bits_count": len(corrupted_indices),
                    "extracted_raw_hex": coded_payload.hex(),
                    "raw_extracted_bits": extracted_bits,
                    "ecc_strategy": self.ECC_STRATEGY,
                    "analysis": f"2D DCT Lattice Multi-Tile Extraction (Mode: {mode_name}, Offset {offset})"
                }

                if ber < min_overall_ber:
                    min_overall_ber = ber
                    best_overall_metrics = cur_metrics

                # In systematic RS(255, 127), the first 4 bytes of codeword are unencoded header b"CPTC"
                # Filter before calling expensive polynomial division
                header_matches = sum(b1 == b2 for b1, b2 in zip(coded_payload[:4], self.MAGIC_HEADER))
                if header_matches >= 2 or offset == 0:
                    try:
                        decoded_tuple = self.rs.decode(coded_payload)
                        decoded_frame = bytes(decoded_tuple[0])
                        if len(decoded_frame) == self.FRAME_DATA_LEN and decoded_frame.startswith(self.MAGIC_HEADER):
                            parsed = self.parse_watermark_frame(decoded_frame)
                            # Compute exact bit error rate against corrected codeword
                            re_encoded = self.rs.encode(decoded_frame)
                            actual_errors = sum(bin(b1 ^ b2).count('1') for b1, b2 in zip(coded_payload, re_encoded))
                            actual_ber = float((actual_errors / float(len(coded_payload) * 8)) * 100.0)

                            cur_metrics["ecc_corrected"] = True
                            cur_metrics["payload_recovery_pct"] = 100.0
                            cur_metrics["watermark_detected"] = True
                            cur_metrics["bit_error_rate"] = actual_ber
                            cur_metrics["corrupted_bits_count"] = actual_errors
                            cur_metrics["frame"] = parsed
                            cur_metrics["watermark_id"] = parsed["watermark_id"] if parsed else decoded_frame[:10].hex()
                            return decoded_frame, cur_metrics
                    except ReedSolomonError:
                        pass
                    except Exception:
                        pass

        if best_overall_metrics is None:
            best_overall_metrics = {
                "watermark_detected": False,
                "confidence": 0.0,
                "bit_error_rate": 100.0,
                "ecc_strategy": self.ECC_STRATEGY,
                "analysis": "No viable watermark signal detected",
                "raw_extracted_bits": ""
            }

        best_overall_metrics["ecc_corrected"] = False
        best_overall_metrics["payload_recovery_pct"] = max(0.0, float(100.0 - min_overall_ber * 1.5))
        best_overall_metrics["candidate_bitstreams"] = all_candidate_streams
        return None, best_overall_metrics

    def extract_watermark(self, document_path: Union[str, bytes]) -> Tuple[Union[bytes, None], Dict[str, Any]]:
        """
        Extracts and decodes the embedded watermark from a PDF or image file.
        Includes multi-scale canonical screen capture normalization and Reed-Solomon decoding.
        """
        if isinstance(document_path, bytes):
            is_image = document_path.startswith(b"\x89PNG") or document_path.startswith(b"\xff\xd8") or document_path.startswith(b"RIFF")
            path_for_log = "bytes_stream"
        else:
            lower_path = str(document_path).lower()
            is_image = lower_path.endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'))
            path_for_log = document_path

        try:
            if is_image:
                if isinstance(document_path, bytes):
                    base_img = Image.open(io.BytesIO(document_path)).convert("RGB")
                else:
                    base_img = Image.open(document_path).convert("RGB")
            else:
                if isinstance(document_path, bytes):
                    doc = fitz.open(stream=document_path, filetype="pdf")
                else:
                    doc = fitz.open(document_path)
                if len(doc) == 0:
                    doc.close()
                    return None, {"error": "Empty document", "watermark_detected": False}
                page = doc[0]
                pix = page.get_pixmap(dpi=self.render_dpi)
                base_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                doc.close()
        except Exception as e:
            return None, {
                "error": f"Failed to parse document: {str(e)}",
                "watermark_detected": False,
                "confidence": 0.0,
                "bit_error_rate": 100.0,
                "ecc_strategy": self.ECC_STRATEGY,
                "analysis": "Unreadable or corrupted file format"
            }

        # 1. Native Resolution Extraction
        payload, metrics = self._extract_from_image(base_img)
        if payload is not None:
            return payload, metrics

        if is_image:
            base_np = np.array(base_img)
            gray = cv2.cvtColor(base_np, cv2.COLOR_RGB2GRAY)
            img_area = base_img.width * base_img.height

            # 2. Multi-Strategy Page Segmentation (Detects white page inside PDF viewers / Chrome / Acrobat / dark & grey UI)
            detected_boxes = []

            # Strategy A: Otsu automatic thresholding
            try:
                _, th_otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                contours, _ = cv2.findContours(th_otsu, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if contours:
                    c = max(contours, key=cv2.contourArea)
                    bx, by, bw, bh = cv2.boundingRect(c)
                    if bw > 150 and bh > 150 and (bw * bh) > (img_area * 0.15) and (bw * bh) < (img_area * 0.98):
                        detected_boxes.append((bx, by, bw, bh, "Otsu"))
            except Exception:
                pass

            # Strategy B: Explicit threshold levels (handles viewer backgrounds: #525659, #323639, #e2e8f0)
            for t_val in [180, 120, 70, 40, 230]:
                try:
                    _, thresh = cv2.threshold(gray, t_val, 255, cv2.THRESH_BINARY)
                    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    if contours:
                        c = max(contours, key=cv2.contourArea)
                        bx, by, bw, bh = cv2.boundingRect(c)
                        if bw > 150 and bh > 150 and (bw * bh) > (img_area * 0.15) and (bw * bh) < (img_area * 0.98):
                            if not any(abs(bx - obx) < 10 and abs(by - oby) < 10 and abs(bw - obw) < 10 for obx, oby, obw, obh, _ in detected_boxes):
                                detected_boxes.append((bx, by, bw, bh, f"Thresh-{t_val}"))
                except Exception:
                    pass

            # Test all detected page crops resized to canonical page resolutions
            for bx, by, bw, bh, label in detected_boxes:
                cropped = base_img.crop((bx, by, bx + bw, by + bh))
                for tw, th in [(1240, 1754), (1275, 1650)]:
                    try:
                        canon = cropped.resize((tw, th), Image.Resampling.LANCZOS)
                        p, m = self._extract_from_image(canon)
                        if p is not None:
                            m["analysis"] = f"2D DCT Lattice Extraction (Page Segmentation [{label}] -> {tw}x{th})"
                            return p, m
                        if m.get("bit_error_rate", 100.0) < metrics.get("bit_error_rate", 100.0):
                            metrics = m
                    except Exception:
                        pass

            # 3. Canonical Scaling of full image (handles direct full-page screenshots at 72/96/120/144 DPI)
            for tw, th in [(1240, 1754), (1275, 1650)]:
                if base_img.size != (tw, th):
                    try:
                        canon_img = base_img.resize((tw, th), Image.Resampling.LANCZOS)
                        c_payload, c_metrics = self._extract_from_image(canon_img)
                        if c_payload is not None:
                            c_metrics["analysis"] = f"2D DCT Lattice Extraction (Canonical Normalization {tw}x{th})"
                            return c_payload, c_metrics
                        if c_metrics.get("bit_error_rate", 100.0) < metrics.get("bit_error_rate", 100.0):
                            metrics = c_metrics
                    except Exception:
                        pass

            # 4. Inset Margin Checks (handles minor window borders, drop shadows, or 1-2% browser window frames)
            w, h = base_img.size
            for margin_pct in [0.015, 0.03]:
                mx, my = int(w * margin_pct), int(h * margin_pct)
                if mx > 0 and my > 0 and w - 2*mx > 100 and h - 2*my > 100:
                    try:
                        trimmed = base_img.crop((mx, my, w - mx, h - my))
                        canon_trimmed = trimmed.resize((1240, 1754), Image.Resampling.LANCZOS)
                        p_t, m_t = self._extract_from_image(canon_trimmed)
                        if p_t is not None:
                            m_t["analysis"] = f"2D DCT Lattice Extraction (Margin Inset {int(margin_pct*100)}%)"
                            return p_t, m_t
                        if m_t.get("bit_error_rate", 100.0) < metrics.get("bit_error_rate", 100.0):
                            metrics = m_t
                    except Exception:
                        pass

        return payload, metrics

    # -------------------------------------------------------------
    # Image Quality Benchmark Helpers (PSNR & SSIM)
    # -------------------------------------------------------------
    @staticmethod
    def calculate_psnr(original: np.ndarray, modified: np.ndarray) -> float:
        """Computes Peak Signal-to-Noise Ratio (PSNR) in dB."""
        mse = np.mean((original.astype(float) - modified.astype(float)) ** 2)
        if mse == 0:
            return 100.0
        return float(20 * np.log10(255.0 / np.sqrt(mse)))
