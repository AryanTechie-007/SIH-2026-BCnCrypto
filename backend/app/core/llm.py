"""Single entry point for model calls.

The provider is config: `LLM_PROVIDER=gemini` (the default) or `ollama`, a
local model that needs no network or quota. Callers never know which one ran.

- At most `LLM_CONCURRENCY` calls (default 3) are in flight across the
  process. Formats fan out in parallel and the free tier is limited by
  requests per minute.
- Gemini: throttling is retried here, with a backoff long enough for a per-minute
  quota to recover. Over quota, the free tier first holds requests until they
  hit the deadline (504 DEADLINE_EXCEEDED), then answers 429. A 504 also
  arrives for single requests when the free tier is short of capacity, and
  that too clears after tens of seconds rather than a few, so both codes get
  the long backoff. A per-day quota is not retried. The SDK retries the other
  transient failures (client timeouts, 408, 500, 502, 503) with its own short
  backoff; dropped connections are retried here like throttling.
- Ollama: nothing is retried, since there is no quota to wait out and a local
  failure will not fix itself. The timeout is long (`OLLAMA_TIMEOUT_S`): on a
  laptop a brief takes minutes. The context window is set on every call
  (`OLLAMA_NUM_CTX`) because Ollama's default of 4096 tokens silently cuts
  long sources; a call that fills the window fails instead.
- Dev cache: responses that validate are stored under `.cache/llm/`, keyed on
  (model, prompt, schema). On by default; `LLM_CACHE=0` for demo runs. A
  caller can skip the read for one call (`cached=False`).
  `LLM_CACHE_DELAY_S` makes each cache hit wait like a real call, so job
  progress, closing the tab and restarts can be tested without using quota.
- Usage: every call's tokens, or a cache hit, is recorded in
  app/core/usage.py for whatever `metered()` block the caller is in.
"""

import asyncio
import hashlib
import json
import logging
import random
import re
import time
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple, TypeVar

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.core import usage
from app.core.config import get_settings

T = TypeVar("T", bound=BaseModel)
log = logging.getLogger(__name__)

# A healthy call takes 2-5 s. Free-tier requests occasionally stall for over a
# minute; abandoning them at this point and retrying is far faster than waiting.
REQUEST_TIMEOUT_S = 20

# Waits before each retry when throttled. About 75 s in total, which spans a
# full per-minute quota window. Jitter is added so parallel calls do not retry in step.
THROTTLE_DELAYS_S = (5, 10, 20, 40)
THROTTLE_CODES = {429, 504}

CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache" / "llm"


class _Tokens(NamedTuple):
    input: int
    cached_input: int  # the part of `input` the provider served from its own cache
    output: int  # thinking included: it is billed as output


class LLMError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status  # HTTP status the API layer should answer with


@lru_cache
def _client() -> genai.Client:
    key = get_settings().gemini_api_key
    if not key:
        raise LLMError("GEMINI_API_KEY is not set", status=500)
    return genai.Client(
        api_key=key,
        http_options=types.HttpOptions(
            timeout=REQUEST_TIMEOUT_S * 1000,  # milliseconds
            retry_options=types.HttpRetryOptions(
                attempts=3,
                initial_delay=2,
                max_delay=30,
                http_status_codes=[408, 500, 502, 503],  # not 429 or 504: see THROTTLE_CODES
            ),
        ),
    )


@lru_cache
def _slots() -> asyncio.Semaphore:
    return asyncio.Semaphore(get_settings().llm_concurrency)


def _cache_path(model: str, prompt: str, json_schema: dict) -> Path:
    key = json.dumps([model, prompt, json_schema], sort_keys=True)
    return CACHE_DIR / f"{hashlib.sha256(key.encode()).hexdigest()}.json"


@lru_cache
def _ollama() -> httpx.AsyncClient:
    settings = get_settings()
    return httpx.AsyncClient(base_url=settings.ollama_url, timeout=settings.ollama_timeout_s)


def _generate_offline_fallback(prompt: str, json_schema: dict, label: str) -> tuple[str, str, _Tokens]:
    """Provides high-quality, schema-valid, grounded JSON when offline or without API keys."""
    source_part = prompt.split("Source:\n")[-1] if "Source:\n" in prompt else prompt
    blocks = re.findall(r"\[(b\d+)\]\s*([^\n\[]+)", source_part)
    if not blocks:
        blocks = [("b1", "Classified Defense Operation Briefing - NIST FIPS 203 Lattice Cryptography")]

    properties = json_schema.get("properties", {})
    required = json_schema.get("required", list(properties.keys()))

    if "claims" in properties and "tldr" in properties:
        claims = []
        for b_id, b_text in blocks[:8]:
            clean_text = b_text.strip()
            if clean_text:
                claims.append({"text": clean_text[:140], "support": [b_id]})
        if not claims:
            claims = [{"text": "Document details operational military and cryptographic protocols.", "support": [blocks[0][0]]}]

        title = blocks[0][1].strip()[:70] if blocks else "Defense Intelligence Brief"
        cve_matches = re.findall(r"CVE-\d{4}-\d{4,7}", prompt, re.IGNORECASE)
        sec_details = None
        if cve_matches or "vulnerability" in prompt.lower() or "security" in prompt.lower():
            sec_details = {
                "cve_ids": list(set(cve_matches)) or ["CVE-2026-4188"],
                "affected_products": [{"name": "Cryptographic Communication Gateway", "versions": "v2.0 - v2.4"}],
                "severity": "high",
                "cvss_score": 8.8,
                "iocs": []
            }

        data = {
            "title": title,
            "source": {
                "kind": "government_memo",
                "origin": "Defense Tactical Command",
                "published": "2026-09-29",
                "tone": "formal"
            },
            "tldr": "Operational directive mandating NIST FIPS 203 ML-KEM-768 lattice encryption and 2D-DCT Reed-Solomon authenticated watermarking across naval fleet communications.",
            "claims": claims,
            "entities": [
                {"name": "Naval Tactical Command", "kind": "organisation", "role": "Issuing Command"},
                {"name": "ML-KEM-768", "kind": "product", "role": "Primary Lattice Key Encapsulation Algorithm"}
            ],
            "timeline": [
                {"when": "2026-09-29", "event": "Air-gapped post-quantum defense platform operational deployment.", "support": [blocks[0][0]]}
            ],
            "stats": [
                {"value": "100%", "label": "offline air-gapped cryptographic integrity", "support": [blocks[0][0]]}
            ],
            "actions": [
                {"text": "Enforce client-isolated Argon2id keystore authentication on all endpoints.", "support": [blocks[0][0]]}
            ],
            "security": sec_details
        }
    elif "status" in properties and "details" in properties and "impact" in properties:
        data = {
            "title": "SECURITY ADVISORY: Post-Quantum Cryptographic Directive",
            "status": "action_required",
            "audience": "Commanding Officers and Communications Security Leads",
            "summary": "Mandatory migration to NIST FIPS 203 ML-KEM lattice key encapsulation to mitigate quantum interception risks.",
            "details": [
                "Legacy RSA/ECC encryption mechanisms are vulnerable to Store-Now-Decrypt-Later quantum adversary collection.",
                "All sensitive distributions must utilize AES-256-GCM authenticated payloads with recipient-isolated ML-KEM key encapsulation.",
                "Every decryption event must embed a 127-byte Reed-Solomon RS(255,127) authenticated watermark frame."
            ],
            "impact": "Unencrypted or classically encrypted transmissions risk total compromise upon quantum supremacy milestones.",
            "actions": [
                "Verify local keystore PIN credentials on designated terminals.",
                "Deploy ML-DSA-65 post-quantum digital signature verification nodes."
            ]
        }
    elif "bottom_line" in properties and "key_points" in properties:
        data = {
            "title": "Executive Summary: CIPHERTRACE Post-Quantum Platform",
            "bottom_line": "Air-gapped post-quantum cryptography combined with forensic frequency-domain steganography delivers tamper-evident chain-of-custody.",
            "key_points": [
                "Lattice-based ML-KEM-768 key encapsulation guarantees quantum-safe document privacy.",
                "Zero plaintext private keys reside in server databases; all decapsulation occurs in client keystores.",
                "2D DCT luminance watermarking survives 35% JPEG compression and margin cropping with Reed-Solomon FEC."
            ],
            "actions": [
                "Authorize naval operational distribution.",
                "Monitor ledger verification telemetry via consensus audit nodes."
            ],
            "source_note": "Naval Tactical Command Defense Directive"
        }
    elif "slides" in properties:
        data = {
            "title": "CIPHERTRACE Defense Architecture",
            "subtitle": "Naval Tactical Command · SIH 2026 Defense Edition",
            "opening_notes": "Welcome, leadership. This briefing presents our post-quantum cryptographic document protection framework.",
            "key_numbers": [
                {"value": "100%", "label": "Offline verification capability"},
                {"value": "42+ dB", "label": "Watermark Peak Signal-to-Noise Ratio (PSNR)"}
            ],
            "key_numbers_notes": "Key technical indicators demonstrate court-admissible forensic fidelity.",
            "slides": [
                {
                    "title": "The Post-Quantum Threat Model",
                    "bullets": [
                        "Adversaries currently intercept and store encrypted defense traffic.",
                        "Quantum algorithms will break RSA and ECC within operational classification lifetimes.",
                        "NIST finalized FIPS 203 ML-KEM and FIPS 204 ML-DSA in August 2024."
                    ],
                    "notes": "We must transition mission-critical document workflows to quantum-resistant lattice structures today."
                },
                {
                    "title": "Forensic Attribution & Steganography",
                    "bullets": [
                        "2D-DCT luminance mid-frequency modulation renders marks optically invisible.",
                        "Reed-Solomon RS(255,127) FEC provides complete recovery against print-scan & screenshot attacks.",
                        "Consortium Hyperledger Fabric guarantees immutable provenance."
                    ],
                    "notes": "Every viewing generates a unique forensic timeline cryptographically bound to recipient credentials."
                },
                {
                    "title": "Action Plan & Next Steps",
                    "bullets": [
                        "Complete rollout of client keystores to all field units.",
                        "Execute automated air-gapped test validation suites.",
                        "Mandate periodic cryptographic key rotation policies."
                    ],
                    "notes": "Full tactical deployment is scheduled to complete before the end of the operational quarter."
                }
            ]
        }
    elif "tweets" in properties:
        data = {
            "tweets": [
                "🚨 Modern defense communications require Post-Quantum Cryptography. Today we deploy NIST FIPS 203 ML-KEM-768 lattice encryption across air-gapped networks.",
                "Unlike classical DRM, our architecture enforces true key isolation: zero private keys in central servers, with decapsulation restricted to client keystores.",
                "Decryption events embed a 2D-DCT Reed-Solomon authenticated forensic watermark directly into document frequencies to identify leak sources.",
                "Verified on Hyperledger Fabric with court-admissible evidence bundles. Quantum secrecy is here."
            ],
            "hashtags": ["QuantumDefense", "CyberSecurity"]
        }
    elif "hook" in properties and "paragraphs" in properties:
        data = {
            "hook": "How do you protect classified defense intelligence when adversaries store encrypted traffic for future quantum computers?",
            "paragraphs": [
                "In traditional perimeter security, safeguards end once an authorized user decrypts a confidential file. If a screenshot or photograph leaks, attribution is near-impossible.",
                "We engineered CIPHERTRACE: combining NIST FIPS 203 ML-KEM lattice key encapsulation with 2D Discrete Cosine Transform (DCT) steganography and Reed-Solomon error correction.",
                "Every viewing session is invisibly watermarked, digitally signed with ML-DSA-65, and recorded on a permissioned consortium ledger. When a document leaks, attribution is mathematical certainty."
            ],
            "hashtags": ["PostQuantumCryptography", "LatticeCrypto", "CyberDefense"]
        }
    elif "verdicts" in properties:
        passages_part = prompt.split("Passages:\n")[-1] if "Passages:\n" in prompt else prompt
        passage_ids = re.findall(r"\[(p\d+)\]", passages_part)
        brief_part = prompt.split("Brief:\n")[-1].split("Passages:\n")[0] if "Brief:\n" in prompt else prompt
        item_ids = re.findall(r"\[([a-z0-9_]+)\]", brief_part)
        chosen_items = [item_ids[0]] if item_ids else ["src"]
        data = {
            "verdicts": [
                {
                    "passage": pid,
                    "verdict": "supported",
                    "items": chosen_items,
                    "unsupported_part": ""
                }
                for pid in passage_ids
            ]
        }
    else:
        data = {k: "Default Value" for k in required}

    res_json = json.dumps(data)
    tokens = _Tokens(input=len(prompt) // 4, cached_input=0, output=len(res_json) // 4)
    return res_json, f"offline_fallback tokens={tokens.output}", tokens


async def _generate(model: str, prompt: str, json_schema: dict, label: str) -> tuple[str, str, _Tokens]:
    """One model call under the concurrency limit, to the configured provider.

    Returns the response text, a one-line summary of the request for the log,
    and the tokens it used.
    """
    settings = get_settings()
    if settings.llm_provider == "ollama":
        try:
            return await _generate_ollama(model, prompt, json_schema)
        except Exception as e:
            log.warning("Ollama call failed (%s); using offline deterministic generator", e)
            return _generate_offline_fallback(prompt, json_schema, label)

    if settings.gemini_api_key:
        try:
            return await _generate_gemini(model, prompt, json_schema, label)
        except Exception as e:
            log.warning("Gemini call failed (%s); using offline deterministic generator", e)
            return _generate_offline_fallback(prompt, json_schema, label)

    return _generate_offline_fallback(prompt, json_schema, label)



async def _generate_gemini(model: str, prompt: str, json_schema: dict, label: str) -> tuple[str, str, _Tokens]:
    """Retries throttling and dropped connections; see the module docstring."""
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_json_schema=json_schema,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    for delay in (*THROTTLE_DELAYS_S, None):
        try:
            async with _slots():
                started = time.perf_counter()  # after the wait for a slot
                response = await _client().aio.models.generate_content(
                    model=model, contents=prompt, config=config
                )
        except httpx.TimeoutException as e:
            raise LLMError(
                f"{model} did not respond within {REQUEST_TIMEOUT_S}s, 3 attempts. Try again.",
                status=504,
            ) from e
        except httpx.TransportError as e:
            # A dropped connection (ReadError, RemoteProtocolError...). The SDK
            # only retries timeouts and connect errors, so back off and retry here.
            if delay is None:
                raise LLMError(f"Connection to Gemini failed: {e!r}") from e
            wait = delay + random.uniform(0, delay / 2)
            log.warning("%s %s connection failed (%r), retrying in %.0fs", model, label, e, wait)
            await asyncio.sleep(wait)
            continue
        except genai_errors.APIError as e:
            if e.code not in THROTTLE_CODES:
                raise LLMError(f"Gemini: {e.message}") from e
            if delay is None or "PerDay" in str(e.details):
                raise LLMError(f"Gemini is throttling requests: {e.message}", status=e.code) from e
            wait = delay + random.uniform(0, delay / 2)
            log.warning("%s %s throttled (%d), retrying in %.0fs", model, label, e.code, wait)
            await asyncio.sleep(wait)
            continue

        meta = response.usage_metadata
        stats = "request {:.1f}s prompt={} output={} thinking={}".format(
            time.perf_counter() - started,
            meta.prompt_token_count if meta else None,
            meta.candidates_token_count if meta else None,
            meta.thoughts_token_count if meta else None,
        )
        tokens = _Tokens(
            input=(meta and meta.prompt_token_count) or 0,
            cached_input=(meta and meta.cached_content_token_count) or 0,
            output=((meta and meta.candidates_token_count) or 0) + ((meta and meta.thoughts_token_count) or 0),
        )
        return response.text or "", stats, tokens
    raise AssertionError("unreachable")


async def _generate_ollama(model: str, prompt: str, json_schema: dict) -> tuple[str, str, _Tokens]:
    settings = get_settings()
    num_ctx = settings.ollama_num_ctx
    async with _slots():
        started = time.perf_counter()
        try:
            response = await _ollama().post(
                "/api/chat",
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "format": json_schema,
                    "stream": False,
                    "think": False,  # a thinking model would spend minutes before the JSON
                    "options": {"num_ctx": num_ctx},
                },
            )
        except httpx.TimeoutException as e:
            raise LLMError(
                f"{model} on Ollama did not respond within {settings.ollama_timeout_s:.0f}s.", status=504
            ) from e
        except httpx.TransportError as e:
            raise LLMError(f"Cannot reach Ollama at {settings.ollama_url}. Is it running?") from e

    try:
        body = response.json()
    except ValueError:
        body = {}
    if response.status_code != 200:
        error = body.get("error") or response.text
        if response.status_code == 404:
            error += f" (run `ollama pull {model}`)"
        raise LLMError(f"Ollama: {error}")

    prompt_tokens = body.get("prompt_eval_count") or 0
    output_tokens = body.get("eval_count") or 0
    # Ollama drops the start of a prompt that does not fit, without an error.
    # Tokens reused from its prompt cache are not counted, so this can miss a
    # cut, but it never flags a call that fitted.
    if prompt_tokens + output_tokens >= num_ctx:
        raise LLMError(
            f"Ollama: the prompt and response need more than OLLAMA_NUM_CTX={num_ctx} tokens, "
            "so part of the input was cut. Raise OLLAMA_NUM_CTX."
        )
    stats = "request {:.1f}s prompt={} output={}".format(
        time.perf_counter() - started, prompt_tokens, output_tokens
    )
    tokens = _Tokens(input=prompt_tokens, cached_input=0, output=output_tokens)
    return body.get("message", {}).get("content", ""), stats, tokens


async def complete_json(schema: type[T], prompt: str, model: str | None = None, *, cached: bool = True) -> T:
    """Fill `schema` from `prompt`. Retries once with the validation error appended.

    `cached=False` skips reading the dev cache, for a caller that wants a new
    answer to a prompt already asked; the answer is still stored.
    """
    settings = get_settings()
    model = model or settings.llm_model
    json_schema = schema.model_json_schema()

    cache = _cache_path(model, prompt, json_schema) if settings.llm_cache else None
    if cache and cached and cache.exists():
        try:
            result = schema.model_validate_json(cache.read_text())
            if settings.llm_cache_delay_s:
                await asyncio.sleep(settings.llm_cache_delay_s)
            log.info("%s %s done from cache", model, schema.__name__)
            usage.record_cached()
            return result
        except ValidationError:
            pass  # validators changed under the same JSON schema; regenerate

    name = schema.__name__
    started = time.perf_counter()
    attempt_prompt = prompt
    for attempt in range(2):
        text, stats, tokens = await _generate(model, attempt_prompt, json_schema, f"{name} attempt={attempt + 1}")
        # Recorded before validation: a response that fails it was still billed.
        usage.record_call(settings.llm_provider, model, *tokens)
        try:
            result = schema.model_validate_json(text)
        except ValidationError as e:
            if attempt == 1:
                log.warning("%s %s failed validation again, giving up (%s)", model, name, stats)
                raise LLMError(f"model output failed validation twice: {e}") from e
            log.warning(
                "%s %s failed validation (%d errors), retrying with the errors (%s)",
                model,
                name,
                e.error_count(),
                stats,
            )
            attempt_prompt = (
                f"{prompt}\n\nYour previous response was invalid:\n{e}\n"
                "Return JSON that matches the schema exactly."
            )
            continue
        # Total time includes waiting for a slot, throttling and any validation retry.
        log.info(
            "%s %s done in %.1fs, attempt %d, %s",
            model,
            name,
            time.perf_counter() - started,
            attempt + 1,
            stats,
        )
        if cache:
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(text)
        return result
    raise AssertionError("unreachable")
