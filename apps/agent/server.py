"""Cloud Run entrypoint for the Vera agent (Track A).

Wraps the ADK agent in a FastAPI app via `get_fast_api_app` (per ADK Cloud Run
docs) and adds a /health probe for the smoke harness. Track A finalizes the
agent discovery (expose `root_agent`) — this is the deployment scaffold.

Run locally (Python >=3.10):  uvicorn server:app --port 8000
"""

import os

try:
    from google.adk.cli.fast_api import get_fast_api_app  # type: ignore

    # agents_dir = this directory; ADK discovers the `vera` agent package.
    AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
    app = get_fast_api_app(agents_dir=AGENT_DIR, web=False)
except Exception as e:  # ADK not installed / agent not yet discoverable
    from fastapi import FastAPI

    app = FastAPI()
    _err = str(e)

    @app.get("/")
    def root():
        return {"service": "vera-agent", "status": "scaffold", "detail": _err}


@app.get("/health")
def health():
    return {"ok": True, "service": "agent"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
