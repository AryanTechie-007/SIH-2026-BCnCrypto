import numpy as np
import cv2
import pymupdf as fitz
from PIL import Image
from typing import Tuple, List
from reedsolo import RSCodec
from scipy.fftpack import dct, idct
import os

class EmbeddingService:
    """
    Handles the embedding and extraction of watermarks in the DCT domain of PDF pages.
    Uses 2D Discrete Cosine Transform (scipy.fftpack) and Reed-Solomon Error Correction.
    """

    def __init__(self):
        # Reed-Solomon: 16 bytes data -> 32 bytes coded (16 data + 16 parity bytes)
        self.rs = RSCodec(16)
        self.block_size = 8
        self.embed_coord = (3, 3) # Mid-frequency DCT coefficient

    def _dct2(self, block):
        return dct(dct(block.T, norm='ortho').T, norm='ortho')

    def _idct2(self, block):
        return idct(idct(block.T, norm='ortho').T, norm='ortho')

    def embed_watermark(self, pdf_path: str, payload: bytes, output_path: str):
        """
        Embeds a 16-byte payload into a PDF using 2D DCT spread-spectrum.
        """
        # Ensure payload is 16 bytes
        if len(payload) > 16:
            payload = payload[:16]
        elif len(payload) < 16:
            payload = payload.ljust(16, b'\x00')

        # 1. RS Encode: 16 bytes -> 32 bytes (256 bits)
        coded_payload = self.rs.encode(payload)
        bits = ''.join(format(b, '08b') for b in coded_payload)

        src_doc = fitz.open(pdf_path)
        out_doc = fitz.open()

        for page_idx, page in enumerate(src_doc):
            rect = page.rect
            pix = page.get_pixmap(dpi=72)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img_np = np.array(img).astype(np.float32)

            # Embed in Y channel of YCrCb
            ycrcb = cv2.cvtColor(img_np, cv2.COLOR_RGB2YCrCb)
            y, cr, cb = cv2.split(ycrcb)

            h, w = y.shape
            bit_idx = 0
            # Embed bits into 8x8 blocks on the first page
            if page_idx == 0:
                for i in range(0, h - self.block_size, self.block_size):
                    for j in range(0, w - self.block_size, self.block_size):
                        if bit_idx >= len(bits):
                            break

                        block = y[i:i+self.block_size, j:j+self.block_size]
                        d_block = self._dct2(block)

                        strength = 45.0
                        d_block[self.embed_coord] = strength if bits[bit_idx] == '1' else -strength

                        y[i:i+self.block_size, j:j+self.block_size] = self._idct2(d_block)
                        bit_idx += 1
                    if bit_idx >= len(bits):
                        break

            # Clip Y channel to valid range [0, 255]
            y = np.clip(y, 0, 255)
            merged = cv2.merge([y, cr, cb])
            final_img = cv2.cvtColor(merged.astype(np.uint8), cv2.COLOR_YCrCb2RGB)

            temp_img_path = f"temp_wm_page_{page_idx}.png"
            Image.fromarray(final_img).save(temp_img_path)

            new_page = out_doc.new_page(width=rect.width, height=rect.height)
            new_page.insert_image(rect, filename=temp_img_path)

            if os.path.exists(temp_img_path):
                os.remove(temp_img_path)

        out_doc.save(output_path)
        out_doc.close()
        src_doc.close()

    def extract_watermark(self, pdf_path: str) -> bytes:
        """
        Extracts a 16-byte watermark from a PDF using 2D DCT coefficient polarity.
        """
        doc = fitz.open(pdf_path)
        extracted_bits = ""

        # Extract from first page
        page = doc[0]
        pix = page.get_pixmap(dpi=72)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        img_np = np.array(img).astype(np.float32)

        ycrcb = cv2.cvtColor(img_np, cv2.COLOR_RGB2YCrCb)
        y, _, _ = cv2.split(ycrcb)

        h, w = y.shape
        for i in range(0, h - self.block_size, self.block_size):
            for j in range(0, w - self.block_size, self.block_size):
                if len(extracted_bits) >= 256:
                    break

                block = y[i:i+self.block_size, j:j+self.block_size]
                d_block = self._dct2(block)

                val = d_block[self.embed_coord]
                extracted_bits += '1' if val > 0 else '0'
            if len(extracted_bits) >= 256:
                break

        doc.close()

        # Convert 256 bits to 32 bytes
        byte_list = []
        for i in range(0, 256, 8):
            chunk = extracted_bits[i:i+8]
            byte_list.append(int(chunk, 2))

        coded_payload = bytes(byte_list)

        try:
            return bytes(self.rs.decode(coded_payload)[0])
        except Exception:
            return b"extraction_failed"
