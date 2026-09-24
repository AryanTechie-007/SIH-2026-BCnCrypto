"""
Script to generate realistic defense document for CIPHERTRACE SIH demo
"""
import os
import pymupdf

def generate_sample_pdf(output_path="CLASSIFIED_NAVAL_OPERATIONS.pdf"):
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842) # A4
    
    # Draw classification banner at top and bottom
    red_color = (0.7, 0.1, 0.1)
    dark_gray = (0.15, 0.15, 0.2)
    border_color = (0.8, 0.8, 0.85)
    
    # Top Banner
    page.draw_rect(pymupdf.Rect(30, 25, 565, 50), color=None, fill=(0.95, 0.9, 0.9))
    page.insert_text(pymupdf.Point(180, 42), "TOP SECRET // MARITIME DEFENSE // NOFORN", 
                     fontsize=11, fontname="helv", color=red_color)
    
    # Header Info Box
    page.draw_rect(pymupdf.Rect(30, 60, 565, 140), color=border_color, width=1)
    
    page.insert_text(pymupdf.Point(45, 80), "DOCUMENT CONTROL IDENTIFIER: NAV-DEF-2026-X89", fontsize=9, fontname="helv", color=dark_gray)
    page.insert_text(pymupdf.Point(45, 96), "ORIGINATING AUTHORITY: NAVAL CYBER & DEFENSE COMMAND", fontsize=9, fontname="helv", color=dark_gray)
    page.insert_text(pymupdf.Point(45, 112), "SUBJECT: STRATEGIC PROTOCOL FOR OFFSHORE QUANTUM-RESILIENT COMM LINK", fontsize=9, fontname="helv", color=dark_gray)
    page.insert_text(pymupdf.Point(45, 128), "CLEARANCE LEVEL REQUIRED: LEVEL 5 (DIRECTORATE SIGN-OFF ONLY)", fontsize=9, fontname="helv", color=red_color)
    
    # Document Title
    page.insert_text(pymupdf.Point(45, 175), "OPERATION TRIDENT SHIELD", fontsize=18, fontname="helv", color=(0.05, 0.15, 0.35))
    page.insert_text(pymupdf.Point(45, 192), "Technical Specification & Cryptographic Deployment Parameters", fontsize=10, fontname="helv", color=(0.4, 0.4, 0.45))
    
    # Body Paragraph 1
    p1 = (
        "1. MISSION DIRECTIVE & AIR-GAPPED GOVERNANCE\n"
        "This classified operational brief establishes mandatory parameters for mission fleet deployment "
        "across the Indian Ocean littoral zone. Under strict air-gapped guidelines, all cryptographic keys "
        "and command documents distributed to tactical operational units must maintain immutable provenance "
        "and individual accountability to ensure full traceability in the event of an operational leak."
    )
    page.insert_textbox(pymupdf.Rect(45, 210, 550, 280), p1, fontsize=9.5, fontname="times-roman", color=dark_gray)
    
    # Body Paragraph 2
    p2 = (
        "2. POST-QUANTUM DEFENSE REVENUE & MANDATE\n"
        "In accordance with NIST FIPS 203 (ML-KEM-768) and FIPS 204 (ML-DSA-65), all multi-recipient "
        "payload distributions must utilize envelope encryption. Under no circumstances may raw session "
        "keys be shared between vessel nodes NAVY-0231, AIR-WING-0104, and HQ-COMMAND-0001."
    )
    page.insert_textbox(pymupdf.Rect(45, 285, 550, 355), p2, fontsize=9.5, fontname="times-roman", color=dark_gray)
    
    # Technical Table
    page.draw_rect(pymupdf.Rect(45, 365, 550, 480), color=border_color, fill=(0.97, 0.98, 1.0))
    page.draw_line(pymupdf.Point(45, 390), pymupdf.Point(550, 390), color=border_color, width=1)
    
    page.insert_text(pymupdf.Point(55, 382), "NODE IDENTIFIER", fontsize=8.5, fontname="helv", color=dark_gray)
    page.insert_text(pymupdf.Point(180, 382), "SECTOR / VESSEL", fontsize=8.5, fontname="helv", color=dark_gray)
    page.insert_text(pymupdf.Point(320, 382), "PQC KEY ALGORITHM", fontsize=8.5, fontname="helv", color=dark_gray)
    page.insert_text(pymupdf.Point(450, 382), "STATUS", fontsize=8.5, fontname="helv", color=dark_gray)
    
    rows = [
        ("NAVY-0231", "INS Vikramaditya (Flagship)", "ML-KEM-768 / ML-DSA-65", "ACTIVE / ENROLLED"),
        ("NAVY-0489", "INS Kolkata (Destroyer)", "ML-KEM-768 / ML-DSA-65", "ACTIVE / ENROLLED"),
        ("NAVY-0712", "Submarine Command Alpha", "ML-KEM-768 / ML-DSA-65", "STANDBY / VERIFIED"),
        ("AIR-0104", "Maritime Reconnaissance 312", "ML-KEM-768 / ML-DSA-65", "ACTIVE / ENROLLED")
    ]
    
    y = 412
    for r in rows:
        page.insert_text(pymupdf.Point(55, y), r[0], fontsize=8.5, fontname="helv", color=dark_gray)
        page.insert_text(pymupdf.Point(180, y), r[1], fontsize=8.5, fontname="helv", color=dark_gray)
        page.insert_text(pymupdf.Point(320, y), r[2], fontsize=8.5, fontname="helv", color=dark_gray)
        page.insert_text(pymupdf.Point(450, y), r[3], fontsize=8.5, fontname="helv", color=(0.1, 0.5, 0.2))
        y += 20
        
    # Warning Notice
    page.draw_rect(pymupdf.Rect(45, 500, 550, 560), color=red_color, fill=(1.0, 0.96, 0.96), width=1)
    warning_text = (
        "WARNING: FORENSIC ATTRIBUTION ACTIVE.\n"
        "Every authorized decryption of this document generates a cryptographically bound forensic watermark "
        "and signs the session via recipient private key into the immutable ledger. Unauthorized dissemination "
        "will result in court-martial under Defense Security Act Section 4-A."
    )
    page.insert_textbox(pymupdf.Rect(55, 508, 540, 555), warning_text, fontsize=8, fontname="helv", color=red_color)
    
    # Security Seal Placeholder / Box
    page.draw_rect(pymupdf.Rect(45, 580, 200, 660), color=border_color, width=1)
    page.insert_text(pymupdf.Point(55, 600), "DIGITAL DEFENSE SEAL", fontsize=8, fontname="helv", color=dark_gray)
    page.insert_text(pymupdf.Point(55, 615), "CRYPTOGRAPHIC PROVENANCE", fontsize=7, fontname="helv", color=(0.5, 0.5, 0.5))
    page.insert_text(pymupdf.Point(55, 630), "FIPS-204 ATTESTATION: OK", fontsize=7, fontname="helv", color=(0.1, 0.5, 0.2))
    page.insert_text(pymupdf.Point(55, 645), "HASH: 9a8f4c...72b1", fontsize=7, fontname="courier", color=dark_gray)
    
    # Signature line
    page.draw_line(pymupdf.Point(350, 640), pymupdf.Point(540, 640), color=dark_gray, width=1)
    page.insert_text(pymupdf.Point(350, 655), "Vice Admiral, Naval Operational Command", fontsize=8, fontname="helv", color=dark_gray)
    
    # Bottom Banner
    page.draw_rect(pymupdf.Rect(30, 790, 565, 815), color=None, fill=(0.95, 0.9, 0.9))
    page.insert_text(pymupdf.Point(180, 807), "TOP SECRET // MARITIME DEFENSE // NOFORN", 
                     fontsize=11, fontname="helv", color=red_color)
    
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    doc.save(output_path)
    doc.close()
    print(f"Sample PDF created successfully at {output_path}")

if __name__ == "__main__":
    generate_sample_pdf("demo_assets/CLASSIFIED_NAVAL_OPERATIONS.pdf")
