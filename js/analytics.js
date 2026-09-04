/*
==========================================
Echo Craft Music - Private Analytics v2
==========================================
Tracks:
- Page views / visitor sessions
- Traffic source (TikTok, Facebook, Instagram, YouTube, Google, etc.)
- Music play starts
- Outbound clicks

Public visitors can INSERT analytics only; reporting remains private in Supabase.
Localhost is ignored by default so VS Code testing does not pollute live data.
Add ?analytics_test=1 to a local URL when you intentionally want to test recording.
*/

(() => {
    "use strict";

    const SUPABASE_URL = "https://jryqukxridujdqfuqinz.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1Uyu1Lfzwolx26MvLEHbQg_NXNHzTLW";
    const ENDPOINT = `${SUPABASE_URL}/rest/v1/analytics_events`;

    const PLAY_DEDUP_MS = 30000;
    const lastTrackPlay = new Map();

    const params = new URLSearchParams(window.location.search);
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const allowLocalTesting = params.get("analytics_test") === "1";
    const analyticsEnabled = !isLocal || allowLocalTesting;

    function makeId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `ec-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    }

    function getOrCreateId(storage, key) {
        try {
            let value = storage.getItem(key);
            if (!value) {
                value = makeId();
                storage.setItem(key, value);
            }
            return value;
        } catch (_) {
            return makeId();
        }
    }

    const visitorId = getOrCreateId(window.localStorage, "ec_visitor_id");
    const sessionId = getOrCreateId(window.sessionStorage, "ec_session_id");

    function getReferrerHost() {
        try {
            return document.referrer ? new URL(document.referrer).hostname.toLowerCase() : null;
        } catch (_) {
            return null;
        }
    }

    function deviceType() {
        const width = window.innerWidth || document.documentElement.clientWidth || 0;
        if (width <= 768) return "mobile";
        if (width <= 1100) return "tablet";
        return "desktop";
    }

    function normalizeSource(value) {
        return (value || "").trim().toLowerCase();
    }

    function sourceFromHost(host) {
        if (!host) return { source: "Direct", detail: null };
        if (host === window.location.hostname.toLowerCase()) return { source: "Internal", detail: host };

        if (host.includes("tiktok.com")) return { source: "TikTok", detail: host };
        if (host.includes("facebook.com") || host.includes("fb.com") || host.includes("l.facebook.com")) return { source: "Facebook", detail: host };
        if (host.includes("instagram.com")) return { source: "Instagram", detail: host };
        if (host.includes("youtube.com") || host.includes("youtu.be")) return { source: "YouTube", detail: host };
        if (host.includes("google.")) return { source: "Google", detail: host };
        if (host.includes("bing.com")) return { source: "Bing", detail: host };
        if (host.includes("duckduckgo.com")) return { source: "DuckDuckGo", detail: host };
        if (host.includes("yahoo.com")) return { source: "Yahoo", detail: host };

        return { source: "Other Referral", detail: host };
    }

    function sourceFromUtm(utmSource) {
        const source = normalizeSource(utmSource);
        if (!source) return null;
        if (source.includes("tiktok")) return "TikTok";
        if (source.includes("facebook") || source === "fb") return "Facebook";
        if (source.includes("instagram") || source === "ig") return "Instagram";
        if (source.includes("youtube") || source === "yt") return "YouTube";
        if (source.includes("google")) return "Google";
        if (source.includes("bing")) return "Bing";
        return utmSource.trim();
    }

    function determineSessionSource() {
        try {
            const stored = window.sessionStorage.getItem("ec_session_source");
            if (stored) return JSON.parse(stored);
        } catch (_) {}

        const utmSourceRaw = params.get("utm_source");
        const utmMedium = params.get("utm_medium");
        const utmCampaign = params.get("utm_campaign");
        const referrerHost = getReferrerHost();

        const mappedUtm = sourceFromUtm(utmSourceRaw);
        const ref = sourceFromHost(referrerHost);

        const result = {
            traffic_source: mappedUtm || (ref.source === "Internal" ? "Direct" : ref.source),
            source_detail: utmSourceRaw || ref.detail,
            utm_source: utmSourceRaw,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            landing_page: `${window.location.pathname || "/"}${window.location.search || ""}`
        };

        try {
            window.sessionStorage.setItem("ec_session_source", JSON.stringify(result));
        } catch (_) {}

        return result;
    }

    const sessionSource = determineSessionSource();

    async function sendEvent(eventType, extra = {}) {
        if (!analyticsEnabled) return;

        const payload = {
            event_type: eventType,
            page_path: window.location.pathname || "/",
            page_title: document.title || null,
            visitor_id: visitorId,
            session_id: sessionId,
            referrer_host: getReferrerHost(),
            device_type: deviceType(),
            track_title: extra.track_title || null,
            album_title: extra.album_title || null,
            destination: extra.destination || null,
            metadata: {
                site_host: window.location.hostname,
                traffic_source: sessionSource.traffic_source,
                source_detail: sessionSource.source_detail,
                utm_source: sessionSource.utm_source,
                utm_medium: sessionSource.utm_medium,
                utm_campaign: sessionSource.utm_campaign,
                landing_page: sessionSource.landing_page,
                ...(extra.metadata || {})
            }
        };

        try {
            const response = await fetch(ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": SUPABASE_PUBLISHABLE_KEY,
                    "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify(payload),
                keepalive: true
            });

            if (!response.ok) {
                console.warn("Echo Craft analytics event was not recorded.", response.status);
            }
        } catch (error) {
            console.warn("Echo Craft analytics unavailable.", error);
        }
    }

    function trackPageView() {
        sendEvent("page_view");
    }

    function trackAudioPlay(audio) {
        if (!(audio instanceof HTMLAudioElement)) return;

        const card = audio.closest(".music-card");
        const albumTrack = audio.closest("[data-track-title]");

        const trackTitle =
            card?.dataset?.title ||
            albumTrack?.dataset?.trackTitle ||
            audio.getAttribute("data-track-title") ||
            audio.getAttribute("aria-label")?.replace(/^Preview\s+/i, "") ||
            "Unknown Track";

        const albumTitle =
            audio.getAttribute("data-album-title") ||
            albumTrack?.dataset?.albumTitle ||
            null;

        const key = `${window.location.pathname}|${trackTitle}`;
        const now = Date.now();
        const lastTime = lastTrackPlay.get(key) || 0;

        if (now - lastTime < PLAY_DEDUP_MS) return;
        lastTrackPlay.set(key, now);

        sendEvent("track_play", {
            track_title: trackTitle,
            album_title: albumTitle
        });
    }

    function trackOutboundClick(anchor) {
        if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return;

        let url;
        try {
            url = new URL(anchor.href, window.location.href);
        } catch (_) {
            return;
        }

        if (url.hostname === window.location.hostname) return;
        if (!["http:", "https:"].includes(url.protocol)) return;

        sendEvent("outbound_click", {
            destination: url.hostname,
            metadata: {
                label: (anchor.textContent || anchor.getAttribute("aria-label") || "").trim().slice(0, 120),
                destination_url: url.href.slice(0, 500)
            }
        });
    }

    document.addEventListener("DOMContentLoaded", trackPageView, { once: true });

    document.addEventListener("play", (event) => {
        if (event.target instanceof HTMLAudioElement) trackAudioPlay(event.target);
    }, true);

    document.addEventListener("click", (event) => {
        const anchor = event.target.closest?.("a");
        if (anchor) trackOutboundClick(anchor);
    }, true);

    window.EchoCraftAnalytics = {
        track: sendEvent,
        enabled: analyticsEnabled,
        source: sessionSource.traffic_source
    };
})();
