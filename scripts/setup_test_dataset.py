import os
import shutil
from PIL import Image

DEST_DIR = r"c:\AI\frontend\public\assets\test_subjects"
os.makedirs(DEST_DIR, exist_ok=True)

BRAIN_DIR = r"C:\Users\ajay2\.gemini\antigravity-ide\brain\36bf6328-d1ff-4cc7-9e83-dfb063f622cc"
ASSET_DIR = r"c:\AI\frontend\public\assets"

subjects = [
    {
        "id": "subject_01",
        "name": "Subject 1: Male (Caucasian, Slim, A-Pose Baseline)",
        "source": os.path.join(ASSET_DIR, "demo_person_male.jpg"),
        "dest": os.path.join(DEST_DIR, "subject_01_male_slim.jpg"),
        "height_cm": 180.0,
        "gender": "Male"
    },
    {
        "id": "subject_02",
        "name": "Subject 2: Female (South Asian, Regular Build, Upright)",
        "source": os.path.join(ASSET_DIR, "demo_person.jpg"),
        "dest": os.path.join(DEST_DIR, "subject_02_female_olive.jpg"),
        "height_cm": 165.0,
        "gender": "Female"
    },
    {
        "id": "subject_03",
        "name": "Subject 3: Male (Black, Athletic, Broad Shoulders)",
        "source": os.path.join(BRAIN_DIR, "test_person_male_athletic_1792478190243.jpg"),
        "dest": os.path.join(DEST_DIR, "subject_03_male_athletic.jpg"),
        "height_cm": 185.0,
        "gender": "Male"
    },
    {
        "id": "subject_04",
        "name": "Subject 4: Female (East Asian, Petite/Regular Build)",
        "source": os.path.join(BRAIN_DIR, "test_person_female_asian_1792478207888.jpg"),
        "dest": os.path.join(DEST_DIR, "subject_04_female_asian.jpg"),
        "height_cm": 162.0,
        "gender": "Female"
    },
    {
        "id": "subject_05",
        "name": "Subject 5: Female (Caucasian, Posture Tilt / Lean Angle)",
        "source": os.path.join(BRAIN_DIR, "test_person_tilted_pose_1792478230344.jpg"),
        "dest": os.path.join(DEST_DIR, "subject_05_female_tilted.jpg"),
        "height_cm": 170.0,
        "gender": "Female"
    }
]

print("Setting up Phase 6 diverse test dataset...")
for s in subjects:
    if os.path.exists(s["source"]):
        im = Image.open(s["source"])
        # Standardize size: ensure aspect ratio 3:4 or standard height 1200
        # If necessary, convert to RGB
        im = im.convert("RGB")
        im.save(s["dest"], format="JPEG", quality=95)
        print(f"Copied {s['id']}: {s['name']} -> {os.path.basename(s['dest'])} ({im.size})")
    else:
        print(f"ERROR: Source file {s['source']} not found!")

print("\nTest dataset setup complete.")
