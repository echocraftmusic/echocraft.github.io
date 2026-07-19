"use strict";

let currentAlbum = null;
let currentTrackIndex = 0;

function escapeAlbumText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function resolveAlbumPath(value) {
    if (!value) return "";

    if (
        value.startsWith("http://") ||
        value.startsWith("https://")
    ) {
        return value;
    }

    return "../" + value;
}

function updateMainPlayIcon() {
    const audio =
        document.getElementById("albumAudio");

    const icon =
        document.querySelector(
            "#mainPlay i"
        );

    if (!audio || !icon) return;

    icon.className =
        audio.paused
            ? "fas fa-play"
            : "fas fa-pause";
}

function renderTrackList() {
    const list =
        document.getElementById(
            "albumTrackList"
        );

    if (!list || !currentAlbum) {
        return;
    }

    list.innerHTML =
        currentAlbum.tracks
            .map((track, index) => `
                <article
                    class="track-row"
                    data-track-index="${index}"
                    tabindex="0"
                    role="button"
                    aria-label="Preview ${escapeAlbumText(track.title)}"
                >
                    <div class="track-number">
                        ${String(index + 1).padStart(2, "0")}
                    </div>

                    <div class="track-title">
                        ${escapeAlbumText(track.title)}
                    </div>

                    <button
                        type="button"
                        class="track-play"
                        aria-label="Play ${escapeAlbumText(track.title)}"
                    >
                        <i class="fas fa-play"></i>
                    </button>
                </article>
            `)
            .join("");

    list.querySelectorAll(".track-row")
        .forEach(row => {
            const activate = () => {
                selectTrack(
                    Number(
                        row.dataset.trackIndex
                    ),
                    true
                );
            };

            row.addEventListener(
                "click",
                activate
            );

            row.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        activate();
                    }
                }
            );
        });
}

function selectTrack(index, autoplay = false) {
    if (
        !currentAlbum ||
        !currentAlbum.tracks.length
    ) {
        return;
    }

    currentTrackIndex =
        (
            index +
            currentAlbum.tracks.length
        ) % currentAlbum.tracks.length;

    const track =
        currentAlbum.tracks[
            currentTrackIndex
        ];

    const audio =
        document.getElementById(
            "albumAudio"
        );

    document.getElementById(
        "nowNumber"
    ).textContent =
        String(
            currentTrackIndex + 1
        ).padStart(2, "0");

    document.getElementById(
        "nowTitle"
    ).textContent =
        track.title;

    document
        .querySelectorAll(".track-row")
        .forEach((row, rowIndex) => {
            row.classList.toggle(
                "active",
                rowIndex === currentTrackIndex
            );

            const icon =
                row.querySelector("i");

            if (icon) {
                icon.className =
                    rowIndex === currentTrackIndex &&
                    audio &&
                    !audio.paused
                        ? "fas fa-pause"
                        : "fas fa-play";
            }
        });

    if (!audio) {
        return;
    }

    const nextSource =
        resolveAlbumPath(
            track.preview
        );

    if (audio.dataset.source !== nextSource) {
        audio.src = nextSource;
        audio.dataset.source = nextSource;
    }

    if (autoplay && nextSource) {
        audio.play().catch(() => {});
    }

    updateMainPlayIcon();
}

function buildAlbumLinks(album) {
    const container =
        document.getElementById(
            "albumLinks"
        );

    const links = [];

    if (album.hyperfollow) {
        links.push(`
            <a
                href="${album.hyperfollow}"
                target="_blank"
                rel="noopener noreferrer"
                class="album-link primary"
            >
                <i class="fas fa-headphones"></i>
                Listen Everywhere
            </a>
        `);
    }

    if (album.spotify) {
        links.push(`
            <a
                href="${album.spotify}"
                target="_blank"
                rel="noopener noreferrer"
                class="album-link secondary"
            >
                <i class="fab fa-spotify"></i>
                Spotify
            </a>
        `);
    }

    if (album.apple) {
        links.push(`
            <a
                href="${album.apple}"
                target="_blank"
                rel="noopener noreferrer"
                class="album-link secondary"
            >
                <i class="fab fa-apple"></i>
                Apple Music
            </a>
        `);
    }

    container.innerHTML =
        links.join("");
}

async function loadAlbum() {
    const requestedTitle =
        document.body.dataset.albumTitle;

    try {
        const response = await fetch(
            "../music/music.json?ts=" +
            Date.now()
        );

        if (!response.ok) {
            throw new Error(
                `Unable to load album data: ${response.status}`
            );
        }

        const data =
            await response.json();

        currentAlbum =
            data.items.find(
                item =>
                    item.type === "album" &&
                    String(item.title)
                        .toLowerCase() ===
                    String(requestedTitle)
                        .toLowerCase()
            );

        if (!currentAlbum) {
            throw new Error(
                "Album not found."
            );
        }

        document.title =
            `${currentAlbum.title} | Echo Craft`;

        document.getElementById(
            "albumTitle"
        ).textContent =
            currentAlbum.title;

        document.getElementById(
            "albumArtist"
        ).textContent =
            currentAlbum.artist ||
            "Echo Craft";

        document.getElementById(
            "albumCover"
        ).src =
            resolveAlbumPath(
                currentAlbum.cover
            );

        document.getElementById(
            "albumLabel"
        ).textContent =
            `Album · ${currentAlbum.tracks.length} Tracks`;

        if (
            currentAlbum.description &&
            currentAlbum.description.trim()
        ) {
            document.getElementById(
                "albumDescription"
            ).textContent =
                currentAlbum.description;
        }

        document.getElementById(
            "trackCount"
        ).textContent =
            `${currentAlbum.tracks.length} tracks`;

        const topListen =
            document.getElementById(
                "topListenEverywhere"
            );

        if (currentAlbum.hyperfollow) {
            topListen.href =
                currentAlbum.hyperfollow;
        } else {
            topListen.hidden = true;
        }

        buildAlbumLinks(
            currentAlbum
        );

        renderTrackList();

        selectTrack(0, false);
    } catch (error) {
        console.error(error);

        document.getElementById(
            "albumTrackList"
        ).innerHTML = `
            <div class="track-row">
                The album could not be loaded. Please return to the main site and try again.
            </div>
        `;
    }
}

document
    .getElementById("previousTrack")
    .addEventListener(
        "click",
        () => {
            selectTrack(
                currentTrackIndex - 1,
                true
            );
        }
    );

document
    .getElementById("nextTrack")
    .addEventListener(
        "click",
        () => {
            selectTrack(
                currentTrackIndex + 1,
                true
            );
        }
    );

document
    .getElementById("mainPlay")
    .addEventListener(
        "click",
        () => {
            const audio =
                document.getElementById(
                    "albumAudio"
                );

            if (!audio.src) {
                selectTrack(
                    currentTrackIndex,
                    true
                );

                return;
            }

            if (audio.paused) {
                audio.play().catch(() => {});
            } else {
                audio.pause();
            }
        }
    );

const albumAudio =
    document.getElementById(
        "albumAudio"
    );

albumAudio.addEventListener(
    "play",
    () => {
        updateMainPlayIcon();
        selectTrack(
            currentTrackIndex,
            false
        );
    }
);

albumAudio.addEventListener(
    "pause",
    () => {
        updateMainPlayIcon();
        selectTrack(
            currentTrackIndex,
            false
        );
    }
);

albumAudio.addEventListener(
    "ended",
    () => {
        selectTrack(
            currentTrackIndex + 1,
            true
        );
    }
);

window.addEventListener(
    "DOMContentLoaded",
    loadAlbum
);
