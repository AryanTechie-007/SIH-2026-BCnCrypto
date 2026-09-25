from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..services.embedding_service import EmbeddingService
import os

router = APIRouter(prefix="/api/attacks", tags=["Attack Lab"])

embedding_service = EmbeddingService()

@router.post("/simulate")
async def simulate_attack(
    attack_type: str, # "compress", "crop", "resize", "noise"
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Simulates a digital attack on a leaked PDF to test watermark robustness.
    """
    # 1. Save original
    temp_in = f"attack_in_{file.filename}"
    with open(temp_in, "wb") as f:
        f.write(await file.read())

    temp_out = f"attack_out_{file.filename}"

    # 2. Apply Attack
    if attack_type == "compress":
        # Simulate JPEG compression by converting to JPG and back to PDF
        # (Simplified for prototype)
        import cv2
        import numpy as np
        import fitz
        from PIL import Image

        doc = fitz.open(temp_in)
        pages = []
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img.save("temp.jpg", "JPEG", quality=30) # High compression
            attacked_img = Image.open("temp.jpg")
            pages.append(attacked_img)

        pages[0].save(temp_out, save_all=True, append_images=pages[1:])
        doc.close()

    elif attack_type == "crop":
        import cv2
        import numpy as np
        import fitz
        from PIL import Image

        doc = fitz.open(temp_in)
        pages = []
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img_np = np.array(img)
            # Crop 10% from each side
            h, w, _ = img_np.shape
            cropped = img_np[int(h*0.1):int(h*0.9), int(w*0.1):int(w*0.9)]
            pages.append(Image.fromarray(cropped))

        pages[0].save(temp_out, save_all=True, append_images=pages[1:])
        doc.close()

    else:
        # Default: just copy file
        import shutil
        shutil.copy(temp_in, temp_out)

    return {
        "original_file": temp_in,
        "attacked_file": temp_out,
        "attack_type": attack_type,
        "message": "Attack applied successfully"
    }
