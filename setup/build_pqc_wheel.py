import urllib.request
import tarfile
import tempfile
import os
import subprocess
import sys
import shutil

def build_wheel():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    wheels_dir = os.path.join(repo_root, "setup", "wheels")
    os.makedirs(wheels_dir, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        tar_path = os.path.join(tmpdir, "mlkem.tar.gz")
        print("[*] Downloading mlkem-0.0.3 source tarball from PyPI...")
        urllib.request.urlretrieve(
            "https://files.pythonhosted.org/packages/source/m/mlkem/mlkem-0.0.3.tar.gz",
            tar_path
        )
        with tarfile.open(tar_path, "r:gz") as tar:
            tar.extractall(tmpdir)
        pkg_dir = os.path.join(tmpdir, "mlkem-0.0.3")

        # 1. Modify setup.py to build pure Python package
        setup_py = os.path.join(pkg_dir, "setup.py")
        with open(setup_py, "w", encoding="utf-8") as f:
            f.write("from setuptools import setup\nsetup()\n")

        # 2. Add fastmath.py pure Python fallback
        fastmath_py = os.path.join(pkg_dir, "mlkem", "fastmath.py")
        fastmath_content = (
            "# Pure Python fallback for fastmath\n"
            "from mlkem.auxiliary.general import byte_decode, byte_encode\n\n"
            "def byte_encode_matrix(matrix, d):\n"
            "    return b''.join(byte_encode(d, p) for p in matrix)\n\n"
            "def byte_decode_matrix(b, d, entries):\n"
            "    chunk_len = 32 * d\n"
            "    return [byte_decode(d, b[i * chunk_len : (i + 1) * chunk_len]) for i in range(entries)]\n"
        )
        with open(fastmath_py, "w", encoding="utf-8") as f:
            f.write(fastmath_content)

        # 3. Build pure Python wheel
        print("[*] Building universal pure-Python wheel...")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "wheel", "setuptools", "--quiet"]
        )
        subprocess.check_call(
            [sys.executable, "setup.py", "bdist_wheel"],
            cwd=pkg_dir
        )

        dist_dir = os.path.join(pkg_dir, "dist")
        wheel_found = None
        for whl in os.listdir(dist_dir):
            if whl.endswith(".whl"):
                wheel_found = whl
                break

        if not wheel_found:
            raise RuntimeError("Wheel generation failed: no .whl in dist")

        universal_name = "mlkem-0.0.3-py3-none-any.whl"
        src = os.path.join(dist_dir, wheel_found)
        dst = os.path.join(wheels_dir, universal_name)
        shutil.copyfile(src, dst)
        print(f"[+] Successfully generated universal wheel: {dst}")

if __name__ == "__main__":
    build_wheel()
