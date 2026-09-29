"""
Dynamic AI Content Classifier & Security Policy Configurator powered by the content-transform pipeline.
Analyzes document text, structures it into citable blocks, extracts a rich ContentBrief
(claims, entities, timelines, security details like CVEs/IOCs), and dynamically assigns
defense classification levels alongside tailored NIST Post-Quantum KEM parameters.
"""

import re
from typing import Dict, Any, Optional, List

from app.ingest.text import ingest_text
from app.ingest.base import SourceDocument


class DocumentIntelligence:
    """
    Defense-grade Document Intelligence and Content Transformation Engine.
    Uses the content-transform pipeline to ingest documents, extract structured
    content briefs, classify security sensitivity, and orchestrate NIST PQC encryption policies.
    """
    def __init__(self):
        # High-assurance defense classification patterns
        self.patterns = {
            "TOP_SECRET": r"\b(nuclear|deployment|warhead|intercept|classified|ballistic|zero-day|cve-\d{4}-\d{4,7})\b",
            "CONFIDENTIAL": r"\b(internal|budget|strategy|personnel|logistics|fleet|vessel|tactical|operational)\b",
            "RESTRICTED": r"\b(memo|draft|meeting|update|briefing|protocol)\b"
        }

    def classify_and_configure(self, text: str) -> Dict[str, Any]:
        """
        Dynamically adjusts security policy based on document content using
        content-transform ingestion and semantic analysis.
        """
        # 1. Ingest into structured SourceDocument with citable blocks
        source_doc = ingest_text(text)
        
        # 2. Determine classification level based on content patterns & security indicators
        text_lower = text.lower()
        classification = "UNCLASSIFIED"

        for level, pattern in self.patterns.items():
            if re.search(pattern, text_lower):
                classification = level
                break

        # 3. Dynamic Policy Mapping
        if classification == "TOP_SECRET":
            policy = {"kem": "ML-KEM-1024", "auth": "MFA_REQUIRED", "watermark_strength": 0.15}
        elif classification == "CONFIDENTIAL":
            policy = {"kem": "ML-KEM-768", "auth": "BIOMETRIC", "watermark_strength": 0.10}
        elif classification == "RESTRICTED":
            policy = {"kem": "ML-KEM-512", "auth": "PASSWORD", "watermark_strength": 0.05}
        else:
            policy = {"kem": "ML-KEM-512", "auth": "PASSWORD", "watermark_strength": 0.05}

        # 4. Generate structured summary & claims from source blocks
        claims = []
        for i, block in enumerate(source_doc.blocks[:10], start=1):
            if block.text.strip():
                claims.append({
                    "id": f"c{i}",
                    "text": block.text.strip(),
                    "support": [block.id]
                })

        # 5. Extract defense & security indicators (e.g. CVEs, IPs)
        cves = re.findall(r"CVE-\d{4}-\d{4,7}", text, re.IGNORECASE)
        iocs = []
        ips = re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", text)
        for ip in ips:
            iocs.append({"kind": "ip", "value": ip})

        return {
            "label": classification,
            "policy": policy,
            "doc_id": source_doc.doc_id,
            "blocks_count": len(source_doc.blocks),
            "claims": claims,
            "cves": list(set(cves)),
            "iocs": iocs,
            "summary": text[:250].strip() + ("..." if len(text) > 250 else "")
        }

    async def analyze_and_brief(self, text: str) -> Dict[str, Any]:
        """
        Full asynchronous ContentBrief analysis from the content-transform pipeline.
        Attempts LLM-backed understanding (Gemini / Ollama) if configured, with
        graceful deterministic fallback if offline.
        """
        source_doc = ingest_text(text)
        base_result = self.classify_and_configure(text)

        try:
            from app.understand.brief import build_brief
            brief = await build_brief(source_doc)
            base_result["brief"] = brief.model_dump()
            # If the LLM detected security severity, upgrade classification accordingly
            if brief.security and brief.security.severity in ("critical", "high"):
                base_result["label"] = "TOP_SECRET"
                base_result["policy"]["kem"] = "ML-KEM-1024"
                base_result["policy"]["auth"] = "MFA_REQUIRED"
                base_result["policy"]["watermark_strength"] = 0.15
        except Exception:
            # Deterministic fallback brief
            base_result["brief"] = {
                "brief_id": "brief-local",
                "doc_id": source_doc.doc_id,
                "title": source_doc.blocks[0].text[:80] if source_doc.blocks else "Document Intelligence Brief",
                "tldr": base_result["summary"],
                "claims": base_result["claims"],
                "entities": [],
                "timeline": [],
                "stats": [],
                "actions": [],
                "security": None
            }

        return base_result
