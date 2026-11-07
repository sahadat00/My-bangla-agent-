import os
import re
import asyncio
import requests

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
GEMINI_KEY = os.environ["GEMINI_API_KEY"]
ALLOWED = os.environ.get("ALLOWED_CHAT_ID", "").strip()
MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash-preview",
]
VOICES_F = ["bn-BD-NabanitaNeural", "bn-IN-TanishaaNeural"]
VOICES_M = ["bn-BD-PradeepNeural", "bn-IN-BashkarNeural"]
TG = f"https://api.telegram.org/bot{TOKEN}"
VOICE_CMD = re.compile(r"^ভয়েস(-ছেলে)?\s*[:ঃ]?\s*", re.S)


def tg_send(chat_id, text):
    requests.post(
        f"{TG}/sendMessage",
        json={"chat_id": chat_id, "text": text[:4000]},
        timeout=30,
    )


def tg_send_audio(chat_id, path, caption=""):
    with open(path, "rb") as f:
        r = requests.post(
            f"{TG}/sendAudio",
            data={"chat_id": chat_id, "caption": caption[:200]},
            files={"audio": f},
            timeout=180,
        )
    r.raise_for_status()


def tts_edge(text, voice, path):
    import edge_tts

    async def run():
        await edge_tts.Communicate(text, voice).save(path)

    asyncio.run(run())
    if os.path.getsize(path) < 1000:
        raise RuntimeError("empty audio")


def tts_gtts(text, path):
    from gtts import gTTS

    gTTS(text=text, lang="bn").save(path)


def handle_voice(chat_id, text):
    m = VOICE_CMD.match(text)
    male = bool(m.group(1))
    body = text[m.end():].strip()
    if not body:
        tg_send(chat_id, "লিখুন: ভয়েস: আপনার স্ক্রিপ্ট")
        return
    tg_send(chat_id, "ভয়েস বানাচ্ছি...")
    path = "voice.mp3"
    last_err = None
    for v in (VOICES_M if male else VOICES_F):
        try:
            tts_edge(body, v, path)
            tg_send_audio(chat_id, path, f"ভয়েস: {v}")
            return
        except Exception as e:
            last_err = e
    try:
        tts_gtts(body, path)
        tg_send_audio(chat_id, path, "ভয়েস: gTTS (বিকল্প)")
        return
    except Exception as e:
        last_err = e
    tg_send(chat_id, f"ত্রুটি: {type(last_err).__name__}: {str(last_err)[:200]}")


def short_error(r):
    try:
        return r.json()["error"]["message"][:150]
    except Exception:
        return r.text[:150]


def ask_gemini(topic):
    prompt = (
        "তুমি 'টপিকস বাংলা' নামের মহাকাশ বিষয়ক ফেসবুক পেজের স্ক্রিপ্টরাইটার।\n"
        f"টপিক: {topic}\n\n"
        "নিয়ম:\n"
        "- সহজ ও সুন্দর বাংলায় ৬০-৯০ সেকেন্ডের ভিডিওর ন্যারেশন লেখো (প্রায় ১৫০-২০০ শব্দ)।\n"
        "- প্রথম বাক্যেই দর্শকের কৌতূহল জাগাও।\n"
        "- কোনো মার্কডাউন চিহ্ন (** বা #) ব্যবহার কোরো না, শুধু সাদামাটা লেখা দাও।\n"
        "- শিরোনাম বা সময়সীমার লাইন লিখো না, শুধু ন্যারেশনের লেখা দাও।\n"
        "- বৈজ্ঞানিক শর্ত বাদ দিয়ে ঢালাও দাবি করো না (যেমন 'যেকোনো নক্ষত্র' না বলে 'অনেক ভারী নক্ষত্র')।\n"
        "- শুধু নিশ্চিত ও প্রতিষ্ঠিত তথ্য দাও। কোনো সংখ্যা বা দূরত্ব নিয়ে নিশ্চিত না হলে সেটা বাদ দাও।\n"
        "- শেষে আলাদা লাইনে 'যাচাই করার তথ্য:' লিখে স্ক্রিপ্টের সব সংখ্যা ও দাবির তালিকা দাও।"
    )
    errors = []
    for model in MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        r = requests.post(
            url,
            headers={"x-goog-api-key": GEMINI_KEY},
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=120,
        )
        if r.status_code == 200:
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
        errors.append(f"{model} -> {r.status_code}: {short_error(r)}")
        if r.status_code in (400, 401, 403):
            break
    raise RuntimeError("\n".join(errors))


def main():
    r = requests.get(f"{TG}/getUpdates", params={"timeout": 0}, timeout=30)
    r.raise_for_status()
    updates = r.json().get("result", [])
    if not updates:
        print("No new messages.")
        return
    last_id = updates[-1]["update_id"]
    for u in updates:
        msg = u.get("message")
        if not msg or "text" not in msg:
            continue
        chat_id = str(msg["chat"]["id"])
        text = msg["text"].strip()
        if not ALLOWED:
            tg_send(chat_id, f"আপনার Chat ID: {chat_id}\nএটা GitHub Secret-এ ALLOWED_CHAT_ID নামে সেভ করুন।")
            continue
        if chat_id != ALLOWED:
            continue
        if text.startswith("/start"):
            tg_send(chat_id, "আমি রেডি। 'ভয়েস: স্ক্রিপ্ট' লিখে ভয়েস পান, অথবা একটা টপিক পাঠান।")
            continue
        if VOICE_CMD.match(text):
            handle_voice(chat_id, text)
            continue
        try:
            tg_send(chat_id, "স্ক্রিপ্ট লিখছি...")
            tg_send(chat_id, ask_gemini(text))
        except Exception as e:
            tg_send(chat_id, f"ত্রুটি:\n{e}")
    requests.get(
        f"{TG}/getUpdates",
        params={"offset": last_id + 1, "timeout": 0},
        timeout=30,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("Failed:", type(e).__name__)
        raise SystemExit(1)
