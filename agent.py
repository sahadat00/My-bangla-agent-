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
VIDEO_CMD = re.compile(r"^ভিডিও(-লম্বা)?\s*[:ঃ]\s*", re.S)
IMG_CMD = re.compile(r"^ছবি\s*[:ঃ]\s*", re.S)
BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
SAMPLE_RATE = 24000
GAP_SECONDS = 0.4
TAIL_SECONDS = 0.8
FPS = 30
MIN_IMG_KB = 200
BAD_TITLE = re.compile(
    r"chart|graph|diagram|logo|infographic|poster|table|schematic|map of|timeline|"
    r"seal|emblem|badge|patch|screenshot|icon|flag",
    re.I,
)
UA = {"User-Agent": "TopicsBanglaAgent/1.0 (personal space video project)"}

PLAN_SYSTEM = """তুমি "টপিকস বাংলা" মহাকাশ পেজের ভিডিও পরিচালক। ইউজার একটি বাংলা স্ক্রিপ্ট দেবে। তুমি শুধু দৃশ্য-পরিকল্পনা JSON আকারে দেবে। কোড লিখবে না, কোনো প্রশ্ন করবে না।

১. স্ক্রিপ্টের নিয়ম
- স্ক্রিপ্ট চূড়ান্ত। একটি শব্দও বদলাবে না, যোগ বা বাদ দেবে না।
- কোনো সংখ্যা, দূরত্ব বা ঢালাও দাবি সন্দেহজনক মনে হলে বদলাবে না। "doubts" তালিকায় বাক্য নম্বরসহ লিখবে।
- স্ক্রিপ্টে নেই এমন সংখ্যা বা তথ্য স্ক্রিনে দেখাবে না।

২. দৃশ্য ভাগ
- স্ক্রিপ্টের বাক্যগুলো আগেই নম্বর দেওয়া আছে। প্রতি সিনে এক বা কয়েকটি পরপর বাক্য, আনুমানিক ৩-৮ সেকেন্ড। সব বাক্য কোনো না কোনো সিনে থাকতে হবে, ক্রম ঠিক রেখে।
- টেমপ্লেট শুধু এগুলো: hook, keyword_card, number_counter, image_kenburns, process_steps, comparison, statement, closing।
- প্রথম সিন hook, শেষ সিন closing। পরপর দুই সিনে একই টেমপ্লেট নয়।
- number_counter শুধু তখনই, যখন স্ক্রিপ্টে নির্দিষ্ট সংখ্যা (যেমন ৮, ৩০০, ১.৫) লেখা আছে। "কোটি কোটি", "অনেক", "হাজার হাজার" এমন অনির্দিষ্ট কথায় নয়, সেখানে keyword_card বা statement দেবে। on_screen_text-এ সেই সংখ্যাটাই লিখবে।
- on_screen_text: সিনের মূল শব্দ বা ছোট বাক্যাংশ, সর্বোচ্চ ৬ শব্দ। পুরো বাক্য স্ক্রিনে লিখবে না।
- টেকনিক্যাল শব্দ ও নাম ইংরেজিতে রাখা যাবে।

৩. ছবি
- প্রতিটি সিনে image_queries দেবে: ৩টি আলাদা ইংরেজি সার্চ (প্রতিটি ২-৪ শব্দ), সিনের বিষয়ের ছবির জন্য। প্রথমটি সবচেয়ে নির্দিষ্ট, শেষটি সবচেয়ে সাধারণ (যেমন ["Saturn rings Cassini", "Saturn planet", "ringed planet"])।
- শুধু বাস্তব মহাকাশ ছবির সার্চ দেবে। চার্ট, ডায়াগ্রাম, লোগো নয়।
- image_sources তালিকা ফাঁকা রাখবে, সিস্টেম নিজে ভরবে।

৪. সাউন্ড
- প্রতি সিনে sfx: pop, whoosh, click, chime অথবা none। পুরো ভিডিওতে ৫-৭টির বেশি নয় (none গোনা হবে না)।

৫. আউটপুট: শুধু এই ছকের JSON, বাড়তি লেখা বা মার্কডাউন নয়
{
  "title": "ছোট শিরোনাম (পোস্টের জন্য)",
  "scenes": [
    {"sentences": [1,2], "template": "hook", "on_screen_text": "...", "image_queries": ["...", "...", "..."], "sfx": "whoosh"}
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


def tg_send_doc(chat_id, path, caption=""):
    with open(path, "rb") as f:
        requests.post(
            f"{TG}/sendDocument",
            data={"chat_id": chat_id, "caption": caption[:200]},
            files={"document": f},
            timeout=60,
        )


def tg_send_photo(chat_id, path, caption=""):
    with open(path, "rb") as f:
        r = requests.post(
            f"{TG}/sendPhoto",
            data={"chat_id": chat_id, "caption": caption[:1000]},
            files={"photo": f},
            timeout=120,
        )
    if r.status_code != 200:
        tg_send_doc(chat_id, path, caption)


def clean_query(q):
    q = q.strip().strip("।.!?,;:")
    return re.sub(r"\s+", " ", q)


def download(url, min_kb):
    try:
        img = requests.get(url, headers=UA, timeout=90)
    except Exception:
        return None
    if img.status_code != 200:
        return None
    if len(img.content) < min_kb * 1024:
        return None
    ctype = img.headers.get("content-type", "")
    if ctype and not ctype.startswith("image/"):
        return None
    return img.content


def nasa_search(query, out_path):
    r = requests.get(
        "https://images-api.nasa.gov/search",
        params={"q": query, "media_type": "image"},
        headers=UA,
        timeout=30,
    )
    r.raise_for_status()
    items = r.json().get("collection", {}).get("items", [])
    for it in items[:10]:
        data = it["data"][0]
        nid = data.get("nasa_id")
        title = data.get("title", "")
        if not nid or BAD_TITLE.search(title):
            continue
        try:
            a = requests.get(f"https://images-api.nasa.gov/asset/{nid}", headers=UA, timeout=30)
            a.raise_for_status()
            hrefs = [x["href"] for x in a.json()["collection"]["items"]]
        except Exception:
            continue
        for key in ("~large.jpg", "~medium.jpg"):
            pick = next((h for h in hrefs if h.lower().endswith(key)), None)
            if not pick:
                continue
            pick = pick.replace("http://", "https://")
            content = download(pick, MIN_IMG_KB)
            if content:
                with open(out_path, "wb") as f:
                    f.write(content)
                return {
                    "source": "NASA",
                    "title": title,
                    "id": nid,
                    "license": "NASA media (ক্রেডিট: NASA)",
                    "credit": f"NASA ({data.get('center', '')})".replace(" ()", ""),
                    "url": f"https://images.nasa.gov/details/{nid}",
                    "kb": round(len(content) / 1024),
                }
    return None


def strip_html(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()


OK_LICENSE = re.compile(r"public domain|^pd|cc0|cc[- ]by|cc[- ]by[- ]sa", re.I)
NO_LICENSE = re.compile(r"\bnc\b|noncommercial|\bnd\b|noderiv|fair use|non-free", re.I)


def wikimedia_search(query, out_path):
    r = requests.get(
        "https://commons.wikimedia.org/w/api.php",
        params={
            "action": "query",
            "generator": "search",
            "gsrsearch": f"{query} filetype:bitmap",
            "gsrnamespace": 6,
            "gsrlimit": 10,
            "prop": "imageinfo",
            "iiprop": "url|size|extmetadata",
            "iiurlwidth": 2000,
            "format": "json",
        },
        headers=UA,
        timeout=30,
    )
    r.raise_for_status()
    pages = r.json().get("query", {}).get("pages", {})
    for p in sorted(pages.values(), key=lambda x: x.get("index", 99)):
        title = p.get("title", "")
        if BAD_TITLE.search(title):
            continue
        info = (p.get("imageinfo") or [None])[0]
        if not info:
            continue
        meta = info.get("extmetadata", {})
        lic = strip_html(meta.get("LicenseShortName", {}).get("value", ""))
        if not lic or NO_LICENSE.search(lic) or not OK_LICENSE.search(lic):
            continue
        if info.get("width", 0) < 1000 or info.get("height", 0) < 1000:
            continue
        url = info.get("thumburl") or info.get("url")
        content = download(url, MIN_IMG_KB)
        if not content:
            continue
        with open(out_path, "wb") as f:
            f.write(content)
        artist = strip_html(meta.get("Artist", {}).get("value", "")) or "অজানা"
        return {
            "source": "Wikimedia Commons",
            "title": title.replace("File:", ""),
            "id": title,
            "license": lic,
            "credit": artist[:80],
            "url": info.get("descriptionurl", ""),
            "kb": round(len(content) / 1024),
        }
    return None


def find_image(queries, out_path):
    """সার্চের তালিকা ধরে NASA, তারপর Wikimedia-তে খোঁজে। না মিললে None।"""
    for q in queries:
        q = clean_query(q)
        if not q:
            continue
        for fn in (nasa_search, wikimedia_search):
            try:
                info = fn(q, out_path)
            except Exception:
                info = None
            if info:
                info["query"] = q
                return info
    return None


def handle_image(chat_id, text):
    m = IMG_CMD.match(text)
    raw = text[m.end():].strip()
    queries = [clean_query(x) for x in raw.split("|") if clean_query(x)]
    if not queries:
        tg_send(chat_id, "লিখুন: ছবি: Milky Way galaxy")
        return
    tg_send(chat_id, "খুঁজছি: " + " | ".join(queries))
    try:
        info = find_image(queries, "img_test.jpg")
        if not info:
            tg_send(chat_id, "কোনো সোর্সে উপযুক্ত ছবি পাওয়া যায়নি (NASA ও Wikimedia দুটোতেই দেখেছি)।")
            return
        cap = (
            f"{info['title']}\n"
            f"সোর্স: {info['source']} | সার্চ: {info['query']}\n"
            f"লাইসেন্স: {info['license']}\n"
            f"ক্রেডিট: {info['credit']} | {info['kb']} KB\n"
            f"{info['url']}"
        )
        tg_send_photo(chat_id, "img_test.jpg", cap)
    except Exception as e:
        tg_send(chat_id, f"ত্রুটি:\n{str(e)[:600]}")


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


def build_voice(sentences, voice, out_mp3):
    """প্রতিটা বাক্যের ভয়েস বানিয়ে জোড়া দেয়। (সময়ের তালিকা, মোট সময়, মডেল) ফেরত দেয়।"""
    gap = b"\x00\x00" * int(SAMPLE_RATE * GAP_SECONDS)
    pcm_all = b""
    t = 0.0
    timings = []
    models_used = set()
    for i, s in enumerate(sentences, 1):
        wav = f"s{i}.wav"
        model = tts_gemini_retry(s, voice, wav)
        models_used.add(model)
        with wave.open(wav, "rb") as w:
            n = w.getnframes()
            frames = w.readframes(n)
            dur = n / w.getframerate()
        timings.append({"start": round(t, 2), "end": round(t + dur, 2)})
        pcm_all += frames
        t += dur
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
        ["ffmpeg", "-y", "-i", "all.wav", "-b:a", "128k", out_mp3],
        check=True,
        capture_output=True,
    )
    return timings, t, sorted(models_used)


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
        if t == "number_counter" and not re.search(r"[0-9০-৯]", str(sc.get("on_screen_text", ""))):
            probs.append(f"সিন {i}: number_counter-এ সংখ্যা নেই")
        qs = sc.get("image_queries")
        if not isinstance(qs, list) or not qs:
            probs.append(f"সিন {i}: image_queries নেই")
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


def plan_lines(plan):
    out = []
    for i, sc in enumerate(plan["scenes"], 1):
        line = f"{i}. [{sc.get('template')}] বাক্য {sc.get('sentences')} | {sc.get('on_screen_text')}"
        if sc.get("image_file"):
            line += f" | ছবি ✓ ({sc.get('image_source')})"
        elif "image_file" in sc:
            line += " | ছবি ✗ (মোশন গ্রাফিক্স)"
        line += f" | {sc.get('sfx')}"
        if "duration_sec" in sc:
            line += f" | {sc['start_sec']}→{sc['end_sec']} ({sc['duration_sec']}s)"
        out.append(line)
    return out


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
        out.extend(plan_lines(plan))
        doubts = plan.get("doubts") or []
        out.append("")
        out.append("সন্দেহজনক দাবি:" if doubts else "সন্দেহজনক দাবি: নেই")
        out.extend(f"- {d}" for d in doubts)
        if probs:
            out.append("")
            out.append("পরিকল্পনায় সমস্যা:")
            out.extend(f"- {p}" for p in probs)
        tg_send(chat_id, "\n".join(out))
        tg_send_doc(chat_id, "plan.json", "plan.json")
    except Exception as e:
        tg_send(chat_id, f"ত্রুটি:\n{str(e)[:600]}")


def handle_video(chat_id, text):
    m = VIDEO_CMD.match(text)
    wide = bool(m.group(1))
    body = text[m.end():].strip()
    if not body:
        tg_send(chat_id, "লিখুন: ভিডিও: আপনার স্ক্রিপ্ট")
        return
    sentences = split_sentences(body)
    if len(sentences) > 20:
        tg_send(chat_id, f"বাক্য অনেক বেশি ({to_bn(len(sentences))}টা)। একবারে ২০টার বেশি নিতে পারব না।")
        return
    voice = "Sulafat"
    tg_send(
        chat_id,
        f"{to_bn(len(sentences))}টা বাক্য পেয়েছি। পরিকল্পনা, ভয়েস আর ছবি জোগাড় করছি, কয়েক মিনিট লাগবে...",
    )
    try:
        numbered = "\n".join(f"{i}. {s}" for i, s in enumerate(sentences, 1))
        plan = ask_plan(numbered)
        plan["ratio"] = "16:9" if wide else "9:16"
        plan["sentences"] = sentences
        probs = check_plan(plan, len(sentences))

        os.makedirs("video/public", exist_ok=True)
        timings, total, models = build_voice(sentences, voice, "video/public/voice.mp3")

        scenes = plan["scenes"]
        for i, sc in enumerate(scenes):
            first = sc["sentences"][0] - 1
            start = timings[first]["start"]
            if i + 1 < len(scenes):
                nxt = scenes[i + 1]["sentences"][0] - 1
                end = timings[nxt]["start"]
            else:
                end = round(total + TAIL_SECONDS, 2)
            sc["start_sec"] = round(start, 2)
            sc["end_sec"] = round(end, 2)
            sc["duration_sec"] = round(end - start, 2)
            sc["duration_frames"] = max(1, int(round((end - start) * FPS)))
        plan["sentence_timings"] = timings
        plan["voice"] = voice
        plan["fps"] = FPS
        plan["total_sec"] = round(total + TAIL_SECONDS, 2)
        plan["total_frames"] = sum(sc["duration_frames"] for sc in scenes)

        credits = []
        used_ids = set()
        for i, sc in enumerate(scenes, 1):
            qs = sc.get("image_queries") or []
            fname = f"scene{i}.jpg"
            info = find_image(qs, f"video/public/{fname}") if qs else None
            if info and info["id"] in used_ids:
                info = None
                try:
                    os.remove(f"video/public/{fname}")
                except OSError:
                    pass
            if info:
                used_ids.add(info["id"])
                sc["image_file"] = fname
                sc["image_source"] = info["source"]
                sc["image_title"] = info["title"]
                sc["image_license"] = info["license"]
                sc["image_credit"] = info["credit"]
                sc["image_url"] = info["url"]
                credits.append(
                    f"সিন {i}: {info['title']} | {info['source']} | {info['license']} | {info['credit']}\n{info['url']}"
                )
            else:
                sc["image_file"] = ""
        plan["image_sources"] = sorted({sc["image_source"] for sc in scenes if sc.get("image_file")})

        with open("video/public/plan.json", "w", encoding="utf-8") as f:
            json.dump(plan, f, ensure_ascii=False, indent=2)
        with open("plan.json", "w", encoding="utf-8") as f:
            json.dump(plan, f, ensure_ascii=False, indent=2)
        with open("video_ready.flag", "w") as f:
            f.write("ok")

        tg_send_audio(chat_id, "video/public/voice.mp3", f"ভিডিওর ভয়েস ({voice}) {', '.join(models)}")
        out = [f"শিরোনাম: {plan.get('title', '')}", f"মাপ: {plan['ratio']}", ""]
        out.extend(plan_lines(plan))
        out.append("")
        out.append(to_bn(f"মোট: {plan['total_sec']} সেকেন্ড, {plan['total_frames']} ফ্রেম"))
        doubts = plan.get("doubts") or []
        out.append("")
        out.append("সন্দেহজনক দাবি:" if doubts else "সন্দেহজনক দাবি: নেই")
        out.extend(f"- {d}" for d in doubts)
        if probs:
            out.append("")
            out.append("পরিকল্পনায় সমস্যা:")
            out.extend(f"- {p}" for p in probs)
        tg_send(chat_id, "\n".join(out))
        if credits:
            tg_send(chat_id, "ছবির ক্রেডিট (পোস্টের আগে লিংকে লাইসেন্স একবার দেখে নিন):\n\n" + "\n\n".join(credits))
        else:
            tg_send(chat_id, "কোনো সিনেই উপযুক্ত ছবি পাওয়া যায়নি, সব সিনে মোশন গ্রাফিক্স থাকবে।")
        tg_send_doc(chat_id, "plan.json", "plan.json (সময় ও ছবিসহ)")
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
        timings, total, models = build_voice(sentences, voice, "all.mp3")
        lines = []
        for i, (s, tm) in enumerate(zip(sentences, timings), 1):
            short = s if len(s) <= 25 else s[:25] + "…"
            dur = tm["end"] - tm["start"]
            lines.append(to_bn(f"{i}. {tm['start']:.1f} → {tm['end']:.1f} ({dur:.1f} সেকেন্ড) {short}"))
        tg_send_audio(chat_id, "all.mp3", f"সব বাক্য জোড়া ({voice}) {', '.join(models)}")
        report = "বাক্য অনুযায়ী সময় (সেকেন্ডে):\n" + "\n".join(lines)
        report += to_bn(f"\n\nমোট: {total:.1f} সেকেন্ড (প্রতি বাক্যের মাঝে {GAP_SECONDS} সেকেন্ড বিরতি ধরে)")
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
            tg_send(chat_id, "আমি রেডি। 'ভয়েস: ...', 'জেমিনি: ...', 'সময়: ...', 'পরিকল্পনা: ...', 'ছবি: ...' বা 'ভিডিও: ...' লিখুন, অথবা একটা টপিক পাঠান।")
            continue
        if IMG_CMD.match(text):
            handle_image(chat_id, text)
            continue
        if VIDEO_CMD.match(text):
            handle_video(chat_id, text)
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
