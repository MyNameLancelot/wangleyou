"""Copy the signed Release APK to its family distribution filename."""

import json
import re
import shutil
from pathlib import Path


RELEASE = Path(__file__).resolve().parent / "app/build/outputs/apk/release"
metadata = json.loads((RELEASE / "output-metadata.json").read_text())
element = metadata["elements"][0]
version = element["versionName"]
if not re.fullmatch(r"[0-9]+(?:\.[0-9]+)*", version):
    raise ValueError(f"Unexpected Android versionName: {version!r}")

source = RELEASE / element["outputFile"]
if source.name != "app-release.apk" or not source.is_file():
    raise FileNotFoundError("Signed Release APK is missing; build with family signing first")

target = RELEASE / f"乐悠时光-v{version}.apk"
shutil.copy2(source, target)
print(target)
