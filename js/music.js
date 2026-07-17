/*
==========================================
Echo Craft Music Module
==========================================
*/

"use strict";

async function loadMusicTracks() {

    try {

        const response = await fetch("music/music.json?ts=" + Date.now());

        if (!response.ok) {
            throw new Error("music.json not found");
        }

        const data = await response.json();

        const container = document.getElementById("musicContainer");

        if (!container) return;

        container.innerHTML = "";

        if (!data.items || data.items.length === 0) {

            container.innerHTML =
                "<p style='text-align:center;'>No music found.</p>";

            return;
        }

        // ---------------------------------
        // Sort A → Z
        // ---------------------------------

        data.items.sort((a, b) =>
            a.title.localeCompare(b.title)
        );

        // ---------------------------------
        // Render Music Cards
        // ---------------------------------

        data.items.forEach(track => {

            const cover =
                track.cover && track.cover.trim() !== ""
                    ? track.cover
                    : "assets/images/ec-icon.png";

            const preview =
                track.preview && track.preview.trim() !== ""
                    ? track.preview
                    : "";

            const spotify =
                track.spotify && track.spotify.trim() !== ""
                    ? track.spotify
                    : "";

            const apple =
                track.apple && track.apple.trim() !== ""
                    ? track.apple
                    : "";

            const letter = track.title.trim().charAt(0).toUpperCase();

            container.innerHTML += `

<div class="music-card" data-letter="${letter}">

    <img
        class="music-cover"
        src="${cover}"
        alt="${track.title}"
        loading="lazy"
        onerror="this.src='assets/images/ec-icon.png';"
    >

    <div class="music-content">

        <div class="music-title">
            ${track.title}
        </div>

        <div class="music-meta">
            Echo Craft
        </div>

        <div class="audio-wrap">

            <audio
                controls
                preload="none"
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                oncontextmenu="return false;"
            >
                <source src="${preview}" type="audio/mpeg">
            </audio>

        </div>

        <div class="music-buttons">

            ${spotify ? `
            <a href="${spotify}"
               target="_blank"
               rel="noopener noreferrer"
               class="music-btn">
               🟢 Spotify
            </a>
            ` : ""}

            ${apple ? `
            <a href="${apple}"
               target="_blank"
               rel="noopener noreferrer"
               class="music-btn">
               🍎 Apple Music
            </a>
            ` : ""}

        </div>

    </div>

</div>`;

        });

        // ---------------------------------
        // Build Browse Music A-Z
        // ---------------------------------

        const letterNav = document.getElementById("letterNav");

        if (letterNav) {

            letterNav.innerHTML = "";

            const availableLetters = new Set(
                data.items.map(item =>
                    item.title.trim().charAt(0).toUpperCase()
                )
            );

            "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(letter => {

                const btn = document.createElement("button");

                btn.textContent = letter;

                if (availableLetters.has(letter)) {

                    btn.classList.add("available");

                    btn.addEventListener("click", () => {

                        document
                            .querySelectorAll("#letterNav button")
                            .forEach(b => b.classList.remove("active"));

                        btn.classList.add("active");

                        const target = document.querySelector(
                            `.music-card[data-letter="${letter}"]`
                        );

                        if (target) {

                            window.scrollTo({
                                top:
                                    target.getBoundingClientRect().top +
                                    window.scrollY -
                                    120,
                                behavior: "smooth"
                            });

                        }

                    });

                } else {

                    btn.disabled = true;

                }

                letterNav.appendChild(btn);

            });

        }

    } catch (err) {

        console.error("Music Error:", err);

    }

}

window.loadMusicTracks = loadMusicTracks;

window.addEventListener("load", loadMusicTracks);