# 1. Imports: always at the very top
import json
from datetime import datetime
from pathlib import Path
import re

from flask import Flask, request, jsonify
from flask_cors import CORS

#app creations and stuff
app = Flask(__name__)
CORS(app)

# 3. Constants
RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

# 4. Routes: one decorated function per endpoint
@app.post("/collect")
def collect():
    page = request.get_json()
    if not page or "fields" not in page:
        return jsonify({"error": "expected a page with fields"}), 400

    site = re.sub(r"[^a-zA-Z0-9.-]", "_", page.get("site", "unknown"))
    filename = f"{site}_{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    with open(RAW_DIR / filename, "x", encoding="utf-8") as f:
        json.dump(page, f, indent=2, ensure_ascii=False)

    return jsonify({"saved": filename, "fields": len(page["fields"])}), 201

# 5. Start the server, only when this file is run directly
if __name__ == "__main__":
    app.run(port=5000, debug=True)