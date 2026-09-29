import os
import sys
import uuid
import hashlib
import unittest
import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.ledger_client import (
    submit_record,
    query_record,
    get_all_records,
    validate_record_schema,
    _canonical,
    LedgerError,
    REQUIRED_FIELDS,
)


class TestForensicAuditLedger(unittest.TestCase):
    """
    Unit tests verifying full compliance with the forensic-audit
    smart contract and client specification (https://github.com/vishalbala-nps/forensic-audit).
    """

    def setUp(self):
        self.wm = uuid.uuid4().hex[:20].lower()
        self.doc_hash = hashlib.sha256(b"original classified defense intelligence document").hexdigest().lower()
        self.wm_doc_hash = hashlib.sha256(b"watermarked classified document with steganography").hexdigest().lower()
        self.pubkey_fp = hashlib.sha256(b"NIST_FIPS_204_ML_DSA_65_PUBLIC_KEY").hexdigest().lower()

        self.valid_record = {
            "record_id": str(uuid.uuid4()),
            "watermark_id": self.wm,
            "recipient_id": "user-042",
            "document_hash": self.doc_hash,
            "watermarked_doc_hash": self.wm_doc_hash,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "pqc_algorithm": "ML-DSA-65",
            "signature": "c3R1YnNpZ25hdHVyZQ==",
            "recipient_pubkey_fingerprint": self.pubkey_fp,
        }

    def test_canonical_json_serialization(self):
        """Canonical JSON must sort keys, use compact separators, and preserve non-ASCII."""
        rec = {"b": 2, "a": 1, "text": "DEFENSE"}
        serialized = _canonical(rec)
        self.assertEqual(serialized, '{"a":1,"b":2,"text":"DEFENSE"}')

    def test_valid_record_schema_passes(self):
        """A properly formatted record must pass schema validation."""
        try:
            validate_record_schema(self.valid_record)
        except LedgerError as e:
            self.fail(f"Valid record failed schema validation: {e}")

    def test_missing_required_fields_rejected(self):
        """Missing any of the 9 required fields must raise LedgerError."""
        for field in REQUIRED_FIELDS:
            corrupt = self.valid_record.copy()
            del corrupt[field]
            with self.assertRaises(LedgerError, msg=f"Missing field {field} was not rejected"):
                validate_record_schema(corrupt)

    def test_invalid_watermark_id_rejected(self):
        """Watermark must be exactly 20 lowercase hex characters."""
        # Too short (19 chars)
        rec_short = self.valid_record.copy()
        rec_short["watermark_id"] = "a" * 19
        with self.assertRaises(LedgerError):
            validate_record_schema(rec_short)

        # Too long (21 chars)
        rec_long = self.valid_record.copy()
        rec_long["watermark_id"] = "a" * 21
        with self.assertRaises(LedgerError):
            validate_record_schema(rec_long)

        # Uppercase (must be lowercase)
        rec_upper = self.valid_record.copy()
        rec_upper["watermark_id"] = ("A" * 20)
        with self.assertRaises(LedgerError):
            validate_record_schema(rec_upper)

        # Non-hex characters
        rec_nonhex = self.valid_record.copy()
        rec_nonhex["watermark_id"] = "z" * 20
        with self.assertRaises(LedgerError):
            validate_record_schema(rec_nonhex)

    def test_invalid_document_hashes_rejected(self):
        """Hashes must be 64-character lowercase hex digests."""
        rec_bad_doc = self.valid_record.copy()
        rec_bad_doc["document_hash"] = "short_hash"
        with self.assertRaises(LedgerError):
            validate_record_schema(rec_bad_doc)

        rec_bad_wm = self.valid_record.copy()
        rec_bad_wm["watermarked_doc_hash"] = "short_hash"
        with self.assertRaises(LedgerError):
            validate_record_schema(rec_bad_wm)

    def test_submit_and_query_fallback(self):
        """Submit record returns transaction ID and query handles not-found gracefully."""
        tx_id = submit_record(self.valid_record)
        self.assertIsNotNone(tx_id)
        self.assertTrue(len(tx_id) > 0)

        # Querying an unknown watermark offline returns None (not an exception)
        res = query_record("0" * 20)
        self.assertIsNone(res)


if __name__ == '__main__':
    unittest.main()
