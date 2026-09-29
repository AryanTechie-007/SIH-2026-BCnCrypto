import re
from typing import Dict, Any

class DocumentIntelligence:
    """
    Dynamic AI Content Classifier & Security Policy Configurator.
    Inspects document text and dynamically assigns classification level
    along with tailored NIST Post-Quantum KEM parameters and watermark strengths.
    """
    def __init__(self):
        # Keywords for defense-grade classification
        self.patterns = {
            "TOP_SECRET": r"\b(nuclear|deployment|warhead|intercept|classified)\b",
            "CONFIDENTIAL": r"\b(internal|budget|strategy|personnel|logistics)\b",
            "RESTRICTED": r"\b(memo|draft|meeting|update)\b"
        }

    def classify_and_configure(self, text: str) -> Dict[str, Any]:
        """
        Dynamically adjusts security policy based on document content.
        """
        text = text.lower()
        classification = "UNCLASSIFIED"
        security_level = 1

        for level, pattern in self.patterns.items():
            if re.search(pattern, text):
                classification = level
                break

        # Dynamic Policy Mapping
        if classification == "TOP_SECRET":
            policy = {"kem": "ML-KEM-1024", "auth": "MFA_REQUIRED", "watermark_strength": 0.15}
        elif classification == "CONFIDENTIAL":
            policy = {"kem": "ML-KEM-768", "auth": "BIOMETRIC", "watermark_strength": 0.10}
        else:
            policy = {"kem": "ML-KEM-512", "auth": "PASSWORD", "watermark_strength": 0.05}

        return {"label": classification, "policy": policy}
