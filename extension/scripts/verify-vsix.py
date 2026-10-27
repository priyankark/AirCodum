"""Audit and execute the native runtime from the exact distributable VSIX."""
import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile
import zipfile

archive = pathlib.Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix="aircodum-vsix-") as directory:
    root = pathlib.Path(directory)
    with zipfile.ZipFile(archive) as package:
        names = package.namelist()
        for name in names:
            parts = pathlib.PurePosixPath(name).parts
            assert not name.startswith("/") and ".." not in parts, name
            assert not {"benchmark-artifacts", "benchmarks", "tests", ".git", "target", "native"}.intersection(parts), name
            assert not name.endswith((".map", ".tsbuildinfo")), name
        package.extractall(root)
    extension = root / "extension"
    metadata = json.loads((extension / "package.json").read_text())
    assert metadata["publisher"] == "priyankark"
    native = extension / "dist/rusty-robot"
    native_metadata = json.loads((native / "package.json").read_text())
    assert native_metadata["name"] == "@priyankark/rusty-robot"
    version = native_metadata["version"]
    archive_url = f"https://github.com/priyankark/rusty-robot/releases/download/v{version}/priyankark-rusty-robot-{version}.tgz"
    assert metadata["dependencies"][native_metadata["name"]] in {version, archive_url}
    manifest = json.loads((native / "manifest.json").read_text())
    expected = {"darwin-arm64", "darwin-x64", "linux-x64-gnu", "linux-arm64-gnu", "win32-x64", "win32-arm64", "win32-ia32"}
    assert set(manifest["binaries"]) == expected
    for target, record in manifest["binaries"].items():
        data = (native / "prebuilds" / (target + ".node")).read_bytes()
        assert len(data) == record["size"]
        assert hashlib.sha256(data).hexdigest() == record["sha256"]
    bundle = (extension / "dist/extension.js").read_text()
    assert 'require("./rusty-robot")' in bundle or "require('./rusty-robot')" in bundle
    subprocess.run(["node", str(pathlib.Path(__file__).with_name("verify-native.cjs")), str(native)], check=True)
    print(f"Verified AirCodum {metadata['version']}: packaged bundle, seven binaries, native media")
