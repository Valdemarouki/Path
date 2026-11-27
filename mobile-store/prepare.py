"""Generate the store targets from the tested native shell and pinned collaboration client."""
import hashlib
import shutil
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile

root = Path("mobile-native")
sys.path.insert(0,str(Path("rc33/collaboration").resolve()))
from prepare_mobile import refresh_web

def change(path, old, new):
    text=path.read_text()
    if old not in text: raise ValueError(f"Unrecognized target: {path}")
    path.write_text(text.replace(old,new))

source=root/"bundle/web.zip"
if hashlib.sha256(source.read_bytes()).hexdigest()!="c1667ef83ab40615b5ee51db8f858e9ecfc41cec2b231a236e0e9777d7837139":
    raise ValueError("Unexpected native source bundle")
with tempfile.TemporaryDirectory() as d, ZipFile(source) as old:
    tmp=Path(d)
    old.extractall(tmp)
    refresh_web(tmp)
    with ZipFile(source.with_suffix(".new"),"w") as out:
        for entry in old.infolist():out.writestr(entry,(tmp/entry.filename).read_bytes())
source.with_suffix(".new").replace(source)
(root/"bundle/web.sha256").write_text(hashlib.sha256(source.read_bytes()).hexdigest()+"\n")
shutil.copyfile("mobile-store/build-shell.cjs",root/"tools/build-shell.cjs")

gradle=root/"android/app/build.gradle"
change(root/"android/settings.gradle", "mavenCentral()",
       "maven { url = uri('https://maven-central.storage-download.googleapis.com/maven2/') }; mavenCentral()")
change(root/"android/build.gradle","8.7.3","8.10.1")
change(gradle,"compileSdk 35","compileSdk 36")
change(gradle,"targetSdk 35","targetSdk 36")
change(gradle,"com.pathyourday.path.preview","com.pathyourday.path")
change(gradle,"versionCode 1","versionCode 2")
change(gradle,"0.1.0-preview.1","0.1.1")
change(root/"android/app/src/main/AndroidManifest.xml",'android:label="Path Preview"','android:label="Path"')
ios=root/"ios/project.yml"
change(ios,"PathPreview","Path")
change(ios,"Path Preview","Path")
change(ios,"com.pathyourday.path.preview","com.pathyourday.path")
change(ios,"CURRENT_PROJECT_VERSION: 1","CURRENT_PROJECT_VERSION: 2")
change(ios,'MARKETING_VERSION: "0.1.0"','MARKETING_VERSION: "0.1.1"')
change(ios,'    SWIFT_VERSION:', '    CODE_SIGN_STYLE: Automatic\n    SWIFT_VERSION:')
change(ios, "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft",
       "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft")
