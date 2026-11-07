import os
import re
import json
import time
import wave
import base64
import asyncio
import subprocess
import requests

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
GEMINI_KEY = os.environ["GEMINI_API_KEY"]
ALLOWED = os.environ.get("ALLOWED_CHAT_ID", "").strip()
MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
]
TTS_MODELS = [
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts",
]
VOICES_F = ["bn-BD-NabanitaNeural", "bn-IN-TanishaaNeural"]
VOICES_M = ["bn-BD-PradeepNeural", "bn-IN-BashkarNeural"]
TG = f"https://api.telegram.org/bot{TOKEN}"
VOICE_CMD = re.compile(r"^ভয়েস(-ছেলে)?\s*[:ঃ]?\s*", re.S)
GEM_CMD = re.compile(r"^জেমিনি(?:-([A-Za-z]+))?\s*[:ঃ]\s*", re.S)
TIME_CMD = re.compile(r"^সময়(?:-([A-Za-z]+))?\s*[:ঃ]
