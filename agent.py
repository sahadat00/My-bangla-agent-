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
TIME_CMD = re.compile(r"^সময়(?:-([A-Za-z]+))?\s*[:ঃ]\s*", re.S)
PLAN_CMD = re.compile(r"^পরিকল্পনা(-লম্বা)?\s*[:ঃ]\s*", re.S)
BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
SAMPLE_RATE = 24000
GAP_SECONDS = 0.4

PLAN_SYSTEM = """তুমি "টপিকস বাংলা" মহাকাশ পেজের ভিডিও পরিচালক। ইউজার একটি বাংলা স্ক্রিপ্ট দেবে। তুমি শুধু দৃশ্য-পরিকল্পনা JSON আকারে দেবে। কোড লিখবে না, কোনো প্রশ্ন করবে না।

১. স্ক্রিপ্টের নিয়ম
- স্ক্রিপ্ট চূড়ান্ত। একটি শব্দও বদলাবে না, যোগ বা বাদ দেবে না।
- কোনো সংখ্যা, দূরত্ব বা ঢালাও দাবি সন্দেহজনক মনে হলে বদলাবে না। "doubts" তালিকায় বাক্য নম্বরসহ লিখবে।
- স্ক্রিপ্টে নেই এমন সংখ্যা বা তথ্য স্ক্রিনে দেখাবে না।

২. দৃশ্য ভাগ
- স্ক্রিপ্টের বাক্যগুলো আগেই নম্বর দেওয়া আছে। প্রতি সিনে এক বা কয়েকটি পরপর বাক্য, আনুমানিক ৩-৮ সেকেন্ড। সব বাক্য কোনো না কোনো সিনে থাকতে হবে, ক্রম ঠিক রেখে।
- টেমপ্লেট শুধু এগুলো: hook, keyword_card, number_counter, image_kenburns, process_steps, comparison, statement, closing।
- প্রথম সিন hook, শেষ সিন closing। পরপর দুই সিনে একই টেমপ্লেট নয়।
- number_counter শুধু স্ক্রিপ্টে থাকা সংখ্যায়।
- on_screen_text: সিনের মূল শব্দ বা ছোট বাক্যাংশ, সর্বোচ্চ ৬ শব্দ। পুরো বাক্য স্ক্রিনে লিখবে না।
- টেকনিক্যাল শব্দ ও নাম ইংরেজিতে রাখা যাবে।

৩. ছবি
- image_kenburns সিনে image_query দেবে: ইংরেজি ২-৪ শব্দের সার্চ (যেমন "Saturn rings Cassini")। অন্য সিনে image_query ফাঁকা রাখবে।
- শুধু NASA, ESA বা অন্য পাবলিক সোর্স। সোর্সের নাম image_sources তালিকায় রাখবে।

৪. সাউন্ড
- প্রতি সিনে sfx: pop, whoosh, click, chime অথবা none। পুরো ভিডিওতে ৫-৭টির বেশি নয় (none গোনা হবে না)।

৫. আউটপুট: শুধু এই ছকের JSON, বাড়তি লেখা বা মার্কডাউন নয়
{
  "title": "ছোট শিরোনাম (পোস্টের জন্য)",
  "scenes": [
    {"sentences": [1,2], "template": "hook", "on_screen_text": "...", "image_query": "", "sfx": "whoosh"}
  ],
  "doubts": ["সন্দেহজনক দাবি, বাক্য নম্বরসহ"],
  "image_sources": []
}"""

TEMPLATES = {
    "hook", "keyword_card", "number_counter", "image_kenburns",
    "process_steps", "comparison", "statement", "closing",
}
SFX_OK = {"pop", "whoosh", "click", "chime", "none"}


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


def short_error(r):
    try:
        return r.json()["error"]["message"][:150]
    except Exception:
        return r.text[:150]


def tts_gemini(text, voice, wav_path):
    prompt = (
        "Read the following Bengali text aloud like a calm, natural documentary "
        "narrator. Speak only the text after the colon.\n\n" + text
    )
    errors = []
    for model in TTS_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        r = requests.post(
            url,
            headers={"x-goog-api-key": GEMINI_KEY},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}
                    },
                },
            },
            timeout=180,
        )
        if r.status_code != 200:
            errors.append(f"{model} -> {r.status_code}: {short_error(r)}")
            continue
        try:
            b64 = r.json()["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
        except Exception:
            errors.append(f"{model} -> অডিও আসেনি")
            continue
        pcm = base64.b64decode(b64)
        with wave.open(wav_path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SAMPLE_RATE)
            w.writeframes(pcm)
        return model
    raise RuntimeError("\n".join(errors))


def tts_gemini_retry(text, voice, wav_path):
    last = None
    for attempt in range(3):
        try:
            return tts_gemini(text, voice, wav_path)
        except RuntimeError as e:
            last = e
            if "429" in str(e) and attempt < 2:
                time.sleep(30)
                continue
            raise
    raise last


def split_sentences(body):
    parts = re.split(r"(?<=[।?!])\s+|\n+", body)
    return [p.strip() for p in parts if p.strip()]


def to_bn(s):
    return str(s).translate(BN_DIGITS)


def ask_plan(numbered_script):
    errors = []
    for model in MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        r = requests.post(
            url,
            headers={"x-goog-api-key": GEMINI_KEY},
            json={
                "systemInstruction": {"parts": [{"text": PLAN_SYSTEM}]},
                "contents": [{"parts": [{"text": numbered_script}]}],
                "generationConfig": {"responseMimeType": "application/json"},
            },
            timeout=120,
        )
        if r.status_code == 200:
            try:
                raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(raw)
            except Exception:
                errors.append(f"{model} -> JSON পড়া যায়নি")
                continue
        errors.append(f"{model} -> {r.status_code}: {short_error(r)}")
        if r.status_code in (400, 401, 403):
            break
    raise RuntimeError("\n".join(errors))


def check_plan(plan, n_sent):
    probs = []
    scenes = plan.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        return ["scenes খালি"]
    used = []
    sfx_count = 0
    prev = None
    for i, sc in enumerate(scenes, 1):
        t = sc.get("template")
        if t not in TEMPLATES:
            probs.append(f"সিন {i}: অচেনা টেমপ্লেট {t}")
        if t == prev:
            probs.append(f"সিন {i}: পরপর একই টেমপ্লেট ({t})")
        prev = t
        if sc.get("sfx") not in SFX_OK:
            probs.append(f"সিন {i}: অচেনা sfx")
        if sc.get("sfx") not in (None, "none"):
            sfx_count += 1
        if len(str(sc.get("on_screen_text", "")).split()) > 6:
            probs.append(f"সিন {i}: স্ক্রিনের লেখা ৬ শব্দের বেশি")
        if t == "image_kenburns" and not sc.get("image_query"):
            probs.append(f"সিন {i}: image_query নেই")
        used.extend(sc.get("sentences", []))
    if scenes[0].get("template") != "hook":
        probs.append("প্রথম সিন hook নয়")
    if scenes[-1].get("template") != "closing":
        probs.append("শেষ সিন closing নয়")
    if sfx_count > 7:
        probs.append(f"sfx {sfx_count}টা, ৭টার বেশি")
    if used != list(range(1, n_sent + 1)):
        probs.append("বাক্যের ক্রম বা সংখ্যা মেলেনি")
    return probs


def handle_plan(chat_id, text):
    m = PLAN_CMD.match(text)
    wide = bool(m.group(1))
    body = text[m.end():].strip()
    if not body:
        tg_send(chat_id, "লিখুন: পরিকল্পনা: আপনার স্ক্রিপ্ট")
        return
    sentences = split_sentences(body)
    tg_send(chat_id, f"{to_bn(len(sentences))}টা বাক্য পেয়েছি। দৃশ্য-পরিকল্পনা বানাচ্ছি...")
    try:
        numbered = "\n".join(f"{i}. {s}" for i, s in enumerate(sentences, 1))
        plan = ask_plan(numbered)
        plan["ratio"] = "16:9" if wide else "9:16"
        plan["sentences"] = sentences
        probs = check_plan(plan, len(sentences))
        with open("plan.json", "w", encoding="utf-8") as f:
            json.dump(plan, f, ensure_ascii=False, indent=2)
        out = [f"শিরোনাম: {plan.get('title', '')}", f"মাপ: {plan['ratio']}", ""]
        for i, sc in enumerate(plan["scenes"], 1):
            line = f"{i}. [{sc.get('template')}] বাক্য {sc.get('sentences')} | {sc.get('on_screen_text')}"
            if sc.get("image_query"):
                line += f" | ছবি: {sc['image_query']}"
            line += f" | {sc.get('sfx')}"
            out.append(line)
        doubts = plan.get("doubts") or []
        out.append("")
        out.append("সন্দেহজনক দাবি:" if doubts else "সন্দেহজনক দাবি: নেই")
        out.extend(f"- {d}" for d in doubts)
        if probs:
            out.append("")
            out.append("পরিকল্পনায় সমস্যা:")
            out.extend(f"- {p}" for p in probs)
        tg_send(chat_id, "\n".join(out))
        with open("plan.json", "rb") as f:
            requests.post(
                f"{TG}/sendDocument",
                data={"chat_id": chat_id, "caption": "plan.json"},
                files={"document": f},
                timeout=60,
            )
    except Exception as e:
        tg_send(chat_id, f"ত্রুটি:\n{str(e)[:600]}")


def handle_timing(chat_id, text):
    m = TIME_CMD.match(text)
    voice = m.group(1) or "Sulafat"
    body = text[m.end():].strip()
    if not body:
        tg_send(chat_id, "লিখুন: সময়: আপনার স্ক্রিপ্ট")
        return
    sentences = split_sentences(body)
    if len(sentences) > 25:
        tg_send(chat_id, f"বাক্য অনেক বেশি ({len(sentences)}টা)। একবারে ২৫টার বেশি নিতে পারব না।")
        return
    tg_send(
        chat_id,
        f"{to_bn(len(sentences))}টা বাক্য পেয়েছি। প্রতিটার ভয়েস বানাচ্ছি ({voice}), কয়েক মিনিট লাগতে পারে...",
    )
    try:
        gap = b"\x00\x00" * int(SAMPLE_RATE * GAP_SECONDS)
        pcm_all = b""
        t = 0.0
        lines = []
        models_used = set()
        for i, s in enumerate(sentences, 1):
            wav = f"s{i}.wav"
            model = tts_gemini_retry(s, voice, wav)
            models_used.add(model)
            with wave.open(wav, "rb") as w:
                n = w.getnframes()
                frames = w.readframes(n)
                dur = n / w.getframerate()
            start = t
            end = t + dur
            short = s if len(s) <= 25 else s[:25] + "…"
            lines.append(
                to_bn(f"{i}. {start:.1f} → {end:.1f} ({dur:.1f} সেকেন্ড) {short}")
            )
            pcm_all += frames
            t = end
            if i < len(sentences):
                pcm_all += gap
                t += GAP_SECONDS
            time.sleep(3)
        with wave.open("all.wav", "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SAMPLE_RATE)
            w.writeframes(pcm_all)
        subprocess.run(
            ["ffmpeg", "-y", "-i", "all.wav", "-b:a", "128k", "all.mp3"],
            check=True,
            capture_output=True,
        )
        models_text = ", ".join(sorted(models_used))
        tg_send_audio(chat_id, "all.mp3", f"সব বাক্য জোড়া ({voice}) {models_text}")
        report = "বাক্য অনুযায়ী সময় (সেকেন্ডে):\n" + "\n".join(lines)
        report += to_bn(f"\n\nমোট: {t:.1f} সেকেন্ড (প্রতি বাক্যের মাঝে {GAP_SECONDS} সেকেন্ড বিরতি ধরে)")
        tg_send(chat_id, report)
    except Exception as e:
        tg_send(chat_id, f"ত্রুটি:\n{str(e)[:600]}")


def handle_gemini(chat_id, text):
    m = GEM_CMD.match(text)
    voice = m.group(1) or "Sulafat"
    body = text[m.end():].strip()
    if not body:
        tg_send(chat_id, "লিখুন: জেমিনি: আপনার স্ক্রিপ্ট")
        return
    tg_send(chat_id, f"Gemini ভয়েস বানাচ্ছি ({voice})...")
    try:
        model = tts_gemini(body, voice, "gem.wav")
        subprocess.run(
            ["ffmpeg", "-y", "-i", "gem.wav", "-b:a", "128k", "gem.mp3"],
            check=True,
            capture_output=True,
        )
        tg_send_audio(chat_id, "gem.mp3", f"Gemini {voice} ({model})")
    except Exception as e:
        tg_send(chat_id, f"ত্রুটি:\n{str(e)[:600]}")


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
            tg_send(chat_id, "আমি রেডি। 'ভয়েস: ...', 'জেমিনি: ...', 'সময়: ...' বা 'পরিকল্পনা: ...' লিখুন, অথবা একটা টপিক পাঠান।")
            continue
        if PLAN_CMD.match(text):
            handle_plan(chat_id, text)
            continue
        if TIME_CMD.match(text):
            handle_timing(chat_id, text)
            continue
        if GEM_CMD.match(text):
            handle_gemini(chat_id, text)
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
