import os
from typing import Dict, Any

KeyEncapsulation = None
try:
    import oqs
    if hasattr(oqs, "KeyEncapsulation"):
        KeyEncapsulation = oqs.KeyEncapsulation
except Exception:
    pass

if KeyEncapsulation is None:
    # Genuine NIST FIPS 203 ML-KEM pure-Python implementation
    from mlkem.ml_kem import ML_KEM as _ML_KEM
    from mlkem.parameter_set import ML_KEM_768 as _PARAM_ML_KEM_768
    
    class KeyEncapsulation:
        def __init__(self, kem_name: str = "ML-KEM-768", secret_key: bytes = None):
            self.kem_name = kem_name
            self.secret_key = secret_key
            self._kem = _ML_KEM(_PARAM_ML_KEM_768)

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

        def generate_keypair(self) -> bytes:
            ek, dk = self._kem.key_gen()
            self.secret_key = dk
            return ek

        def encap_secret(self, public_key: bytes):
            ss, ct = self._kem.encaps(public_key)
            return ct, ss

        def decap_secret(self, ciphertext: bytes) -> bytes:
            return self._kem.decaps(self.secret_key, ciphertext)

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class QuantumCrypto:
    def __init__(self):
        self.kemalg = "ML-KEM-768"

    def encrypt_file(self, data: bytes) -> Dict[str, str]:
        with KeyEncapsulation(self.kemalg) as server_kem:
            # 1. Generate Quantum Keypair
            public_key = server_kem.generate_keypair()
            
            # 2. Encapsulate to get Shared Secret
            ciphertext_pqc, shared_secret = server_kem.encap_secret(public_key)
            
            # 3. Derive Symmetric Key (KDF)
            key = HKDF(
                algorithm=hashes.SHA256(),
                length=32, salt=None, info=b"sih-pqc"
            ).derive(shared_secret)

            # 4. AES-GCM Encryption
            aesgcm = AESGCM(key)
            iv = os.urandom(12)
            encrypted_payload = aesgcm.encrypt(iv, data, None)
            
            return {
                "pqc_public_key": public_key.hex(),
                "pqc_ciphertext": ciphertext_pqc.hex(),
                "iv": iv.hex(),
                "blob": encrypted_payload.hex(),
                "key_hex": key.hex()
            }
