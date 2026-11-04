import os
import shutil

mirrors = [
    # root main.py
    ("backend/main.py", "main.py"),
    
    # root services
    ("backend/services/fast_tryon.py", "services/fast_tryon.py"),
    ("backend/services/meta_analyzer.py", "services/meta_analyzer.py"),
    ("backend/services/meta_planner.py", "services/meta_planner.py"),
    
    # backend/app/services
    ("backend/services/fast_tryon.py", "backend/app/services/fast_tryon.py"),
    ("backend/services/meta_analyzer.py", "backend/app/services/meta_analyzer.py"),
    ("backend/services/meta_planner.py", "backend/app/services/meta_planner.py"),
    
    # ai-tryon backend & services
    ("backend/main.py", "ai-tryon/backend/main.py"),
    ("backend/services/fast_tryon.py", "ai-tryon/backend/services/fast_tryon.py"),
    ("backend/services/meta_analyzer.py", "ai-tryon/backend/services/meta_analyzer.py"),
    ("backend/services/meta_planner.py", "ai-tryon/backend/services/meta_planner.py"),
    
    # ai-tryon frontend
    ("frontend/data.js", "ai-tryon/frontend/data.js"),
    ("frontend/app.js", "ai-tryon/frontend/app.js"),
]

for src, dst in mirrors:
    if os.path.exists(src):
        d = os.path.dirname(dst)
        if d:
            os.makedirs(d, exist_ok=True)
        shutil.copy2(src, dst)
        print(f"Copied {src} -> {dst}")
    else:
        print(f"Source not found: {src}")

print("All mirrors synchronized!")
