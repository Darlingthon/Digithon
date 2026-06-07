"""ADK entrypoint — exposes `root_agent` so `adk web` / `adk run` discover Vera."""

from .main import build_agent

root_agent = build_agent()
