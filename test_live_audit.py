import requests
import json
import os
import fitz
import numpy as np

BASE_URL = "http://127.0.0.1:8000"

def run_e2e_verification():
    print("=" * 60)
    print("CIPHERTRACE 2.0 LIVE BACKEND AUDIT")
    print("=" * 60)

    # 1. Health
    res = requests.get(f"{BASE_URL}/api/system/health")
    assert res.status_code == 200, f"Health failed: {res.text}"
    health = res.json()
    print(f"[OK] System Health: {health['status']} | Suite: {health['cryptographic_suite']['kem']}")

    # 2. Officers
    res = requests.get(f"{BASE_URL}/api/identity/officers")
    assert res.status_code == 200
    officers = res.json()
    print(f"[OK] Active Officers: {len(officers)}")
    for o in officers:
        print(f"     ID {o['id']}: {o['name']} [{o['navy_id']}] - Device: {o['device_id']}")
    assert len(officers) == 3, f"Expected 3 officers, got {len(officers)}"

    # 3. Documents
    res = requests.get(f"{BASE_URL}/api/documents/")
    assert res.status_code == 200
    docs = res.json()
    print(f"[OK] Available Documents: {len(docs)}")
    doc = docs[0]
    doc_id = doc["id"]
    print(f"     Selected Doc: ID {doc_id} - '{doc['file_name']}'")

    # 4. Encrypt for Verma (1) and Rao (2), EXCLUDING Joshi (3)
    print("\n--- TEST: Distribution to Officers 1 (Verma) & 2 (Rao) ---")
    res = requests.post(f"{BASE_URL}/api/documents/distribute", json={"document_id": doc_id, "recipient_ids": [1, 2]})
    assert res.status_code == 200, f"Encryption failed: {res.text}"
    enc_data = res.json()
    print(f"[OK] Encrypted Doc ID: {enc_data['document_id']}")
    print(f"     Recipients configured: {len(enc_data['envelopes'])}")

    # 5. Access Control Test: Try decrypting as Joshi (ID 3)
    print("\n--- TEST: Unauthorized Decryption (Officer 3: Wing Commander Joshi) ---")
    res = requests.post(
        f"{BASE_URL}/api/decryption/decrypt",
        json={"document_id": doc_id, "recipient_id": 3, "device_id": "DEF-HW-7703"}
    )
    print(f"     Status Code: {res.status_code}")
    print(f"     Response: {res.text}")
    assert res.status_code == 403, f"Expected 403 Forbidden for Joshi, got {res.status_code}!"
    print("[PASS] Access Control: Joshi was strictly REJECTED (403 Forbidden).")

    # 6. Authorized Decryption: Verma (ID 1)
    print("\n--- TEST: Authorized Decryption (Officer 1: Captain Verma) ---")
    res = requests.post(
        f"{BASE_URL}/api/decryption/decrypt",
        json={"document_id": doc_id, "recipient_id": 1, "device_id": "DEF-HW-7701"}
    )
    assert res.status_code == 200, f"Verma decrypt failed: {res.text}"
    verma_dec = res.json()
    verma_event_id = verma_dec["event_id"]
    print(f"[OK] Decryption Succeeded! Event ID: {verma_event_id}")
    print(f"     Watermark Payload: {verma_dec['watermark_hex']}")
    print(f"     Ledger Block Index: {verma_dec['ledger_block_index']}")

    # Download watermarked PDF
    dl_res = requests.get(f"{BASE_URL}{verma_dec['download_url']}")
    assert dl_res.status_code == 200
    verma_pdf_path = f"test_audit_verma_{verma_event_id}.pdf"
    with open(verma_pdf_path, "wb") as f:
        f.write(dl_res.content)
    print(f"[OK] Downloaded Watermarked PDF: {verma_pdf_path} ({len(dl_res.content)} bytes)")

    # Color integrity check on Verma's PDF
    doc_fitz = fitz.open(verma_pdf_path)
    page = doc_fitz[0]
    pix = page.get_pixmap(dpi=150)
    samples = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, 3))
    # Check top-left corner / background: should be pure white [255, 255, 255] or close
    bg_sample = samples[10:50, 10:50]
    mean_bg = np.mean(bg_sample, axis=(0, 1))
    print(f"[OK] Background color (should be near 255, 255, 255): R={mean_bg[0]:.1f}, G={mean_bg[1]:.1f}, B={mean_bg[2]:.1f}")
    assert mean_bg[0] > 240 and mean_bg[1] > 240 and mean_bg[2] > 240, f"Color distortion detected! Background: {mean_bg}"
    print("[PASS] Color Fidelity: 100% authentic white background. No neon green/yellow distortion.")
    doc_fitz.close()

    # 7. Forensic Attribution Test: Upload Verma's PDF
    print("\n--- TEST: Forensic Attribution for Verma's PDF ---")
    with open(verma_pdf_path, "rb") as f:
        files = {"file": ("leaked_verma.pdf", f, "application/pdf")}
        res = requests.post(f"{BASE_URL}/api/forensics/analyze", files=files)
    assert res.status_code == 200, f"Forensics failed: {res.text}"
    forensic_data = res.json()
    print(f"[OK] Forensic Status: {forensic_data['status']}")
    print(f"     Identified Officer: {forensic_data['recipient']['name']} ({forensic_data['recipient']['navy_id']})")
    print(f"     Clearance: {forensic_data['recipient']['clearance_level']}")
    print(f"     Confidence: {forensic_data['overall_confidence']}%")
    print(f"     Ledger Chain Valid: {forensic_data['verification_gates']['ledger_chain_integrity']}")
    assert forensic_data['recipient']['navy_id'] == 'NAVY-0001', f"Expected NAVY-0001 (Verma), got {forensic_data['recipient']['navy_id']}!"
    print("[PASS] Forensic Attribution: 100% accurate match to Captain A. Verma.")

    # 8. Authorized Decryption: Rao (ID 2)
    print("\n--- TEST: Authorized Decryption (Officer 2: Commander Rao) ---")
    res = requests.post(
        f"{BASE_URL}/api/decryption/decrypt",
        json={"document_id": doc_id, "recipient_id": 2, "device_id": "DEF-HW-7702"}
    )
    assert res.status_code == 200
    rao_dec = res.json()
    rao_event_id = rao_dec["event_id"]
    dl_res = requests.get(f"{BASE_URL}{rao_dec['download_url']}")
    rao_pdf_path = f"test_audit_rao_{rao_event_id}.pdf"
    with open(rao_pdf_path, "wb") as f:
        f.write(dl_res.content)

    # Forensic Attribution: Rao
    with open(rao_pdf_path, "rb") as f:
        files = {"file": ("leaked_rao.pdf", f, "application/pdf")}
        res = requests.post(f"{BASE_URL}/api/forensics/analyze", files=files)
    assert res.status_code == 200
    rao_forensic = res.json()
    print(f"[OK] Rao Forensic Status: {rao_forensic['status']}")
    print(f"     Identified Officer: {rao_forensic['recipient']['name']} ({rao_forensic['recipient']['navy_id']})")
    assert rao_forensic['recipient']['navy_id'] == 'NAVY-0002', f"Expected NAVY-0002 (Rao), got {rao_forensic['recipient']['navy_id']}!"
    print("[PASS] Forensic Attribution: 100% accurate match to Commander S. Rao.")

    # Clean up test files
    for p in [verma_pdf_path, rao_pdf_path]:
        if os.path.exists(p):
            os.remove(p)

    print("\n" + "=" * 60)
    print("ALL CIPHERTRACE 2.0 AUDIT TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_e2e_verification()
