/*
==========================================
Echo Craft Music Module
Premium Desktop + Mobile Carousel Edition
==========================================
*/

"use strict";

let echoCraftTracks = [];
let activeMobileCardIndex = 0;
let mobileScrollTimer = null;

/*
------------------------------------------
Protect text inserted into the page
------------------------------------------
*/

function escapeMusicText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeMusicAttribute(value) {
    return escapeMusicText(value);
}

/*
------------------------------------------
Create one premium music card
------------------------------------------
*/

function createMusicCard(track, index) {
    const rawTitle = String(track.title || "Untitled Release");
    const title = escapeMusicText(rawTitle);

    const cover =
        track.cover && track.cover.trim() !== ""
            ? escapeMusicAttribute(track.cover)
            : "assets/images/ec-icon.webp";

    const preview =
        track.preview && track.preview.trim() !== ""
            ? escapeMusicAttribute(track.preview)
            : "";

    const spotify =
        track.spotify && track.spotify.trim() !== ""
            ? escapeMusicAttribute(track.spotify)
            : "";

    const apple =
        track.apple && track.apple.trim() !== ""
            ? escapeMusicAttribute(track.apple)
            : "";

    const hyperfollow =
        track.hyperfollow && track.hyperfollow.trim() !== ""
            ? escapeMusicAttribute(track.hyperfollow)
            : "";

    const letter = rawTitle
        .trim()
        .charAt(0)
        .toUpperCase();

    const audioPlayer = preview
        ? `
            <div class="audio-wrap">
                <audio
                    controls
                    preload="none"
                    controlsList="nodownload noplaybackrate"
                    disablePictureInPicture
                    aria-label="Preview ${title}"
                    oncontextmenu="return false;"
                >
                    <source src="${preview}" type="audio/mpeg">
                    Your browser does not support audio playback.
                </audio>
            </div>
        `
        : `
            <div class="audio-unavailable">
                Preview coming soon
            </div>
        `;

    const hyperfollowButton = hyperfollow
        ? `
            <a
                href="${hyperfollow}"
                target="_blank"
                rel="noopener noreferrer"
                class="listen-everywhere-btn"
                aria-label="Listen to ${title} everywhere"
                title="Listen Everywhere"
            >
                <i class="fas fa-headphones"></i>
                <span>Listen Everywhere</span>
            </a>
        `
        : "";

    const spotifyButton = spotify
        ? `
            <a
                href="${spotify}"
                target="_blank"
                rel="noopener noreferrer"
                class="platform-btn spotify-btn"
                aria-label="Listen to ${title} on Spotify"
                title="Spotify"
            >
                <i class="fab fa-spotify"></i>
            </a>
        `
        : "";

    const appleButton = apple
        ? `
            <a
                href="${apple}"
                target="_blank"
                rel="noopener noreferrer"
                class="platform-btn apple-btn"
                aria-label="Listen to ${title} on Apple Music"
                title="Apple Music"
            >
                <i class="fab fa-apple"></i>
            </a>
        `
        : "";

    return `
        <article
            class="music-card"
            data-index="${index}"
            data-letter="${letter}"
            data-title="${title}"
        >
            <div class="music-artwork">
                <img
                    class="music-cover"
                    src="${cover}"
                    alt="${title} cover artwork"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='assets/images/ec-icon.webp';"
                >

                <div class="music-artwork-shine"></div>
            </div>

            <div class="music-content">
                <h3 class="music-title">${title}</h3>

                ${audioPlayer}

                <div class="music-actions">
                    ${hyperfollowButton}

                    <div class="platform-buttons">
                        ${spotifyButton}
                        ${appleButton}
                    </div>
                </div>
            </div>
        </article>
    `;
}

/*
------------------------------------------
Pause other previews
------------------------------------------
*/

function activateSingleAudioPlayback() {
    const players = document.querySelectorAll(
        "#musicContainer audio"
    );

    players.forEach(player => {
        player.addEventListener("play", () => {
            players.forEach(otherPlayer => {
                if (otherPlayer !== player) {
                    otherPlayer.pause();
                }
            });
        });
    });
}

/*
------------------------------------------
Find available starting letters
------------------------------------------
*/

function getAvailableLetters(items) {
    return [
        ...new Set(
            items.map(item =>
                String(item.title || "")
                    .trim()
                    .charAt(0)
                    .toUpperCase()
            )
        )
    ].filter(Boolean);
}

/*
------------------------------------------
Scroll to a music card
------------------------------------------
*/

function scrollToMusicCard(index, behavior = "smooth") {
    const container =
        document.getElementById("musicContainer");

    const card = container?.querySelector(
        `.music-card[data-index="${index}"]`
    );

    if (!container || !card) return;

    if (window.innerWidth <= 768) {
        const left =
            card.offsetLeft -
            (container.clientWidth - card.clientWidth) / 2;

        container.scrollTo({
            left,
            behavior
        });
    } else {
        card.scrollIntoView({
            behavior,
            block: "center"
        });
    }

    activeMobileCardIndex = index;
    updateMobileMusicNavigator(index);
}

/*
------------------------------------------
Jump to first song beginning with a letter
------------------------------------------
*/

function goToMusicLetter(letter) {
    const index = echoCraftTracks.findIndex(track =>
        String(track.title || "")
            .trim()
            .toUpperCase()
            .startsWith(letter)
    );

    if (index === -1) return;

    scrollToMusicCard(index);

    document
        .querySelectorAll("#letterNav button")
        .forEach(button =>
            button.classList.toggle(
                "active",
                button.textContent === letter
            )
        );
}

/*
------------------------------------------
Desktop A–Z navigation
------------------------------------------
*/

function buildLetterNavigation(items) {
    const letterNav =
        document.getElementById("letterNav");

    if (!letterNav) return;

    letterNav.innerHTML = "";

    const availableLetters =
        new Set(getAvailableLetters(items));

    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        .split("")
        .forEach(letter => {
            const button =
                document.createElement("button");

            button.type = "button";
            button.textContent = letter;

            button.setAttribute(
                "aria-label",
                `Browse music beginning with ${letter}`
            );

            if (availableLetters.has(letter)) {
                button.classList.add("available");

                button.addEventListener("click", () => {
                    goToMusicLetter(letter);
                });
            } else {
                button.disabled = true;

                button.setAttribute(
                    "aria-disabled",
                    "true"
                );
            }

            letterNav.appendChild(button);
        });
}

/*
------------------------------------------
Create mobile alphabet navigator
------------------------------------------
*/

function buildMobileMusicNavigator(items) {
    const musicLayout =
        document.querySelector(".music-layout");

    const existingNavigator =
        document.getElementById(
            "mobileMusicNavigator"
        );

    if (existingNavigator) {
        existingNavigator.remove();
    }

    if (!musicLayout) return;

    const availableLetters =
        getAvailableLetters(items);

    const navigator =
        document.createElement("div");

    navigator.id = "mobileMusicNavigator";
    navigator.className =
        "mobile-music-navigator";

    navigator.innerHTML = `
        <div class="mobile-letter-dial">
            <button
                type="button"
                class="mobile-letter-arrow"
                id="previousMusicLetter"
                aria-label="Previous music letter"
            >
                <i class="fas fa-chevron-left"></i>
            </button>

            <button
                type="button"
                class="mobile-active-letter"
                id="activeMusicLetter"
                aria-label="Current music letter"
            >
                ${availableLetters[0] || "A"}
            </button>

            <button
                type="button"
                class="mobile-letter-arrow"
                id="nextMusicLetter"
                aria-label="Next music letter"
            >
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>

        <div
            class="mobile-letter-strip"
            id="mobileLetterStrip"
            aria-label="Browse music alphabet"
        >
            ${availableLetters
                .map(
                    letter => `
                        <button
                            type="button"
                            class="mobile-letter-option"
                            data-letter="${letter}"
                            aria-label="Go to music beginning with ${letter}"
                        >
                            ${letter}
                        </button>
                    `
                )
                .join("")}
        </div>

        <div class="mobile-swipe-note">
            <i class="fas fa-arrows-left-right"></i>
            Swipe to explore music
        </div>
    `;

    const browseMusic =
        musicLayout.querySelector(".browse-music");

    musicLayout.insertBefore(
        navigator,
        browseMusic || null
    );

    navigator
        .querySelectorAll(
            ".mobile-letter-option"
        )
        .forEach(button => {
            button.addEventListener("click", () => {
                goToMusicLetter(
                    button.dataset.letter
                );
            });
        });

    document
        .getElementById("previousMusicLetter")
        ?.addEventListener("click", () => {
            moveMobileLetter(-1);
        });

    document
        .getElementById("nextMusicLetter")
        ?.addEventListener("click", () => {
            moveMobileLetter(1);
        });

    document
        .getElementById("activeMusicLetter")
        ?.addEventListener("click", () => {
            const activeLetter =
                document
                    .getElementById(
                        "activeMusicLetter"
                    )
                    ?.textContent.trim();

            if (activeLetter) {
                goToMusicLetter(activeLetter);
            }
        });

    updateMobileMusicNavigator(0);
}

/*
------------------------------------------
Move between available letters
------------------------------------------
*/

function moveMobileLetter(direction) {
    const letters =
        getAvailableLetters(echoCraftTracks);

    if (!letters.length) return;

    const currentLetter =
        String(
            echoCraftTracks[
                activeMobileCardIndex
            ]?.title || ""
        )
            .trim()
            .charAt(0)
            .toUpperCase();

    let currentLetterIndex =
        letters.indexOf(currentLetter);

    if (currentLetterIndex === -1) {
        currentLetterIndex = 0;
    }

    const nextLetterIndex =
        (
            currentLetterIndex +
            direction +
            letters.length
        ) % letters.length;

    goToMusicLetter(
        letters[nextLetterIndex]
    );
}

/*
------------------------------------------
Update active mobile letter
------------------------------------------
*/

function updateMobileMusicNavigator(index) {
    const track = echoCraftTracks[index];

    if (!track) return;

    const activeLetter =
        String(track.title || "")
            .trim()
            .charAt(0)
            .toUpperCase();

    const activeLetterButton =
        document.getElementById(
            "activeMusicLetter"
        );

    if (activeLetterButton) {
        activeLetterButton.textContent =
            activeLetter;
    }

    document
        .querySelectorAll(
            ".mobile-letter-option"
        )
        .forEach(button => {
            const isActive =
                button.dataset.letter ===
                activeLetter;

            button.classList.toggle(
                "active",
                isActive
            );

            if (isActive) {
                const strip = document.getElementById("mobileLetterStrip");

                if (strip) {
                    const targetLeft =
                        button.offsetLeft -
                        (strip.clientWidth - button.clientWidth) / 2;

                    strip.scrollTo({
                        left: Math.max(0, targetLeft),
                        behavior: "smooth"
                    });
                }
            }
        });

    document
        .querySelectorAll("#letterNav button")
        .forEach(button => {
            button.classList.toggle(
                "active",
                button.textContent ===
                    activeLetter
            );
        });
}

/*
------------------------------------------
Detect active card while swiping
------------------------------------------
*/

function activateMobileMusicScrollTracking() {
    const container =
        document.getElementById(
            "musicContainer"
        );

    if (!container) return;

    container.addEventListener(
        "scroll",
        () => {
            if (window.innerWidth > 768) {
                return;
            }

            window.clearTimeout(
                mobileScrollTimer
            );

            mobileScrollTimer =
                window.setTimeout(() => {
                    const cards = [
                        ...container.querySelectorAll(
                            ".music-card"
                        )
                    ];

                    const containerCenter =
                        container.scrollLeft +
                        container.clientWidth / 2;

                    let nearestIndex = 0;
                    let nearestDistance =
                        Number.POSITIVE_INFINITY;

                    cards.forEach(
                        (card, index) => {
                            const cardCenter =
                                card.offsetLeft +
                                card.clientWidth / 2;

                            const distance =
                                Math.abs(
                                    containerCenter -
                                    cardCenter
                                );

                            if (
                                distance <
                                nearestDistance
                            ) {
                                nearestDistance =
                                    distance;
                                nearestIndex =
                                    index;
                            }
                        }
                    );

                    activeMobileCardIndex =
                        nearestIndex;

                    updateMobileMusicNavigator(
                        nearestIndex
                    );
                }, 80);
        },
        { passive: true }
    );
}

/*
------------------------------------------
Load music catalog
------------------------------------------
*/

async function loadMusicTracks() {
    const container =
        document.getElementById(
            "musicContainer"
        );

    if (!container) return;

    container.innerHTML = `
        <div class="music-loading">
            <i class="fas fa-circle-notch fa-spin"></i>
            <span>Loading the Echo Craft catalog...</span>
        </div>
    `;

    try {
        const response = await fetch(
            "music/music.json?ts=" +
                Date.now()
        );

        if (!response.ok) {
            throw new Error(
                `Unable to load music.json: ${response.status}`
            );
        }

        const data =
            await response.json();

        if (
            !data.items ||
            !Array.isArray(data.items) ||
            data.items.length === 0
        ) {
            container.innerHTML = `
                <div class="music-empty">
                    No music releases are currently available.
                </div>
            `;

            return;
        }

        echoCraftTracks = [
            ...data.items
        ].sort((a, b) =>
            String(
                a.title || ""
            ).localeCompare(
                String(b.title || ""),
                undefined,
                {
                    sensitivity: "base",
                    numeric: true
                }
            )
        );

        container.innerHTML =
            echoCraftTracks
                .map(createMusicCard)
                .join("");

        buildLetterNavigation(
            echoCraftTracks
        );

        buildMobileMusicNavigator(
            echoCraftTracks
        );

        activateSingleAudioPlayback();
        activateMobileMusicScrollTracking();

        activeMobileCardIndex = 0;
        updateMobileMusicNavigator(0);
    } catch (error) {
        console.error(
            "Music loading error:",
            error
        );

        container.innerHTML = `
            <div class="music-error">
                <i class="fas fa-triangle-exclamation"></i>
                <span>
                    The music catalog could not be loaded.
                    Please refresh the page.
                </span>
            </div>
        `;
    }
}

window.loadMusicTracks =
    loadMusicTracks;

window.addEventListener(
    "DOMContentLoaded",
    loadMusicTracks
);