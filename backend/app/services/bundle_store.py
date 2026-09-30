"""
CIPHERTRACE Identity Bundle Store
=================================
A bundle is the zip written by blockchain/scripts/bundle-identity.sh: one
user's Fabric certificate and private key plus their org's TLS root, laid out
like fabric-samples so cli.js can use it directly as FABRIC_SAMPLES:

    test-network/organizations/peerOrganizations/<domain>/
        tlsca/tlsca.<domain>-cert.pem
        users/<name>@<domain>/msp/signcerts/<cert>.pem
        users/<name>@<domain>/msp/keystore/<private key>

The zip may also wrap that in a single top-level folder (as zipping the
bundle folder in Finder does). Uploads are unpacked into a staging folder,
checked, and only moved to BUNDLES_DIR/<username> after the ledger has
accepted the identity.
"""

import glob
import io
import os
import re
import shutil
import stat
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import List, Optional, Tuple

from app.config import settings

# Must match what blockchain/scripts/new-recipient.sh accepts as a name.
USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

# The orgs ledger.js knows how to reach.
KNOWN_DOMAINS = {"org1.example.com": "Org1MSP", "org2.example.com": "Org2MSP"}

# A real bundle is a few KB; these bounds only exist to refuse junk and zip bombs.
MAX_ZIP_BYTES = 1024 * 1024
MAX_UNPACKED_BYTES = 5 * 1024 * 1024
MAX_ENTRIES = 200


class BundleError(Exception):
    """The upload is not a usable identity bundle."""


@dataclass
class StagedBundle:
    staging_dir: str   # everything under here is deleted by discard()
    root: str          # the folder to use as FABRIC_SAMPLES
    username: str
    domain: str
    msp_id: str


def is_valid_username(name: str) -> bool:
    return bool(USERNAME_RE.match(name)) and not name.startswith(".")


def _staging_parent() -> str:
    # Inside BUNDLES_DIR so install_bundle's move is a same-filesystem rename.
    path = os.path.join(settings.BUNDLES_DIR, ".staging")
    os.makedirs(path, mode=0o700, exist_ok=True)
    return path


def _safe_parts(name: str) -> Tuple[str, ...]:
    if "\\" in name:
        raise BundleError(f"invalid path in zip: {name}")
    path = PurePosixPath(name)
    if path.is_absolute() or any(part in ("", "..") for part in path.parts):
        raise BundleError(f"invalid path in zip: {name}")
    return path.parts


def _extract(data: bytes, dest: str) -> None:
    if len(data) > MAX_ZIP_BYTES:
        raise BundleError("file is too large to be an identity bundle")
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise BundleError("file is not a zip archive")

    with zf:
        infos = zf.infolist()
        if len(infos) > MAX_ENTRIES:
            raise BundleError("zip has too many entries to be an identity bundle")
        if sum(i.file_size for i in infos) > MAX_UNPACKED_BYTES:
            raise BundleError("zip unpacks to more data than an identity bundle holds")

        for info in infos:
            if info.is_dir():
                continue
            if stat.S_ISLNK(info.external_attr >> 16):
                raise BundleError(f"zip contains a symbolic link: {info.filename}")
            parts = _safe_parts(info.filename)
            # Finder adds these to every zip it makes.
            if parts[0] == "__MACOSX" or parts[-1] == ".DS_Store":
                continue
            target = os.path.join(dest, *parts)
            os.makedirs(os.path.dirname(target), mode=0o700, exist_ok=True)
            with zf.open(info) as src, open(target, "wb") as out:
                shutil.copyfileobj(src, out)
            os.chmod(target, 0o600)


def _find_root(extracted: str) -> str:
    """The folder containing test-network/, either the zip root or one level down."""
    marker = os.path.join("test-network", "organizations", "peerOrganizations")
    candidates = [extracted] + [
        os.path.join(extracted, d) for d in sorted(os.listdir(extracted))
        if os.path.isdir(os.path.join(extracted, d))
    ]
    roots = [c for c in candidates if os.path.isdir(os.path.join(c, marker))]
    if len(roots) != 1:
        raise BundleError(
            "zip does not have the bundle layout (test-network/organizations/peerOrganizations/...). "
            "Create it with blockchain/scripts/bundle-identity.sh"
        )
    return roots[0]


def _find_identities(root: str) -> List[Tuple[str, str]]:
    """Every complete (username, domain) identity in the bundle."""
    orgs = os.path.join(root, "test-network", "organizations", "peerOrganizations")
    found = []
    for domain in sorted(os.listdir(orgs)):
        if domain not in KNOWN_DOMAINS:
            continue
        org_dir = os.path.join(orgs, domain)
        if not os.path.isfile(os.path.join(org_dir, "tlsca", f"tlsca.{domain}-cert.pem")):
            raise BundleError(f"bundle is missing the TLS root certificate for {domain}")
        users_dir = os.path.join(org_dir, "users")
        if not os.path.isdir(users_dir):
            continue
        for entry in sorted(os.listdir(users_dir)):
            name, _, entry_domain = entry.partition("@")
            if entry_domain != domain:
                continue
            msp = os.path.join(users_dir, entry, "msp")
            if _has_files(os.path.join(msp, "signcerts")) and _has_files(os.path.join(msp, "keystore")):
                found.append((name, domain))
    return found


def _has_files(path: str) -> bool:
    return os.path.isdir(path) and any(not n.startswith(".") for n in os.listdir(path))


def stage_bundle(data: bytes) -> StagedBundle:
    """Unpacks and checks an uploaded bundle zip. Call discard() when done with it."""
    staging_dir = os.path.join(_staging_parent(), uuid.uuid4().hex)
    extracted = os.path.join(staging_dir, "bundle")
    os.makedirs(extracted, mode=0o700)
    try:
        _extract(data, extracted)
        root = _find_root(extracted)
        identities = _find_identities(root)
        if not identities:
            raise BundleError("bundle contains no complete user identity (certificate and private key)")
        if len(identities) > 1:
            names = ", ".join(f"{n}@{d}" for n, d in identities)
            raise BundleError(f"bundle must contain exactly one user identity, found: {names}")
        username, domain = identities[0]
        if not is_valid_username(username):
            raise BundleError(f"bundle identity has an invalid name: {username}")
        return StagedBundle(staging_dir, root, username, domain, KNOWN_DOMAINS[domain])
    except Exception:
        shutil.rmtree(staging_dir, ignore_errors=True)
        raise


def install_bundle(staged: StagedBundle) -> str:
    """Moves a verified bundle to BUNDLES_DIR/<username>, replacing any earlier one."""
    final = os.path.join(settings.BUNDLES_DIR, staged.username)
    previous = None
    if os.path.exists(final):
        previous = os.path.join(staged.staging_dir, "previous")
        os.replace(final, previous)
    os.replace(staged.root, final)
    os.chmod(final, 0o700)
    if previous:
        shutil.rmtree(previous, ignore_errors=True)
    return final


def discard(staged: StagedBundle) -> None:
    shutil.rmtree(staged.staging_dir, ignore_errors=True)


def certificate_path(bundle_path: str) -> Optional[str]:
    """The user's signing certificate inside an installed bundle."""
    pattern = os.path.join(bundle_path, "test-network", "organizations", "peerOrganizations",
                           "*", "users", "*", "msp", "signcerts", "*.pem")
    matches = sorted(glob.glob(pattern))
    return matches[0] if matches else None
