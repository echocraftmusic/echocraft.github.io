function isReleaseAvailable(item, now = Date.now()) {
    if (item.publicationStatus === "draft") return false;
    if (item.publicationStatus !== "scheduled") return true;
    const release = Date.parse(item.publishAt || "");
    return Number.isFinite(release) && release <= now;
}
/*
==========================================
Echo Craft Music Module
Premium Desktop + Mobile Carousel Edition
==========================================
*/

"use strict";

let echoCraftTracks = [];
let echoCraftAlbums = [];
let activeAlbumIndex = 0;
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


/* Catalog-driven album cards: no separate page or manual layout per release. */
let storeAlbumTrack = null;
let storeAlbumPlayGeneration = 0;
const storePreviewCart = new Map(); // Demonstration only; never touches the production cart.

function storeAlbumURL(value) {
    if (!value) return '';
    try {
        const url = new URL(String(value).replaceAll('\\', '/'), window.location.href);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
}

function storeAlbumPrice(album) {
    const price = Number(album?.price);
    return Number.isFinite(price) && price >= 0.5 ? price : 9.99;
}

function createAlbumCard(album, index) {
    const title = escapeMusicText(album.title || 'Untitled Album');
    const price = storeAlbumPrice(album).toFixed(2);
    const configuredPrice = Number(album.price);
    const priceLabel = album.price != null && Number.isFinite(configuredPrice) && configuredPrice >= 0.5 ? 'Album price' : 'Illustrative price';
    const tracks = Array.isArray(album.tracks) ? album.tracks : [];
    const description = escapeMusicText(album.description || 'A complete Echo Craft listening experience. Hear the available track previews below, then continue listening on your preferred platform.');
    const platform = (url, label, icon, className) => storeAlbumURL(url) ? `<a href="${escapeMusicAttribute(storeAlbumURL(url))}" class="ac-${className}" target="_blank" rel="noopener noreferrer"><i class="${icon}" aria-hidden="true"></i><span>${label}</span></a>` : '';
    return `<article class="ac-card" data-album-index="${index}" aria-labelledby="ac-title-${index}" ${index ? 'hidden' : ''}>
        <div class="ac-upper">
            <img class="ac-cover" src="${escapeMusicAttribute(storeAlbumURL(album.cover) || 'assets/images/no-cover.webp')}" alt="${title} album cover" loading="lazy" onerror="this.onerror=null;this.src='assets/images/no-cover.webp'">
            <div class="ac-details">
                <div class="ac-badge">ALBUM • ${tracks.length} TRACKS</div>
                <h3 class="ac-title" id="ac-title-${index}" title="${title}"><a href="albums/album.html?title=${encodeURIComponent(album.title || '')}">${title}</a></h3>
                <p class="ac-artist">${escapeMusicText(album.artist || 'Echo Craft')}</p>
                <div class="ac-pills"><span>Album</span><span>Track previews</span></div>
                <p class="ac-description" title="${description}">${description}</p>
                <div class="ac-tracks" role="group" aria-label="${title} track previews">${tracks.length ? tracks.map((track, trackIndex) => `<div class="ac-track"><span class="ac-number">${trackIndex + 1}</span><button class="ac-play" type="button" data-track-index="${trackIndex}" aria-label="Play preview: ${escapeMusicAttribute(track.title)}" aria-pressed="false" ${storeAlbumURL(track.preview) ? '' : 'disabled'}><i class="fas fa-play" aria-hidden="true"></i></button><span class="ac-track-title" title="${escapeMusicAttribute(track.title)}">${escapeMusicText(track.title)}</span><span class="ac-clip">${storeAlbumURL(track.preview) ? 'Preview' : 'Unavailable'}</span></div>`).join('') : '<p class="ac-no-tracks">Track previews are not available yet.</p>'}</div>
            </div>
        </div>
        <div class="ac-streaming">${platform(album.hyperfollow, 'Listen Everywhere', 'fas fa-headphones', 'listen')}${platform(album.spotify, 'Spotify', 'fab fa-spotify', 'platform ac-spotify')}${platform(album.apple, 'Apple Music', 'fab fa-apple', 'platform')}</div>
        <div class="ac-purchase"><div class="ac-cart-icon"><i class="fas fa-shopping-cart" aria-hidden="true"></i></div><div class="ac-purchase-copy"><strong>Get This Album</strong><span>Digital album · Store preview</span></div><div class="ac-price"><strong>$${price}</strong><small>${priceLabel}</small></div><button class="ac-add" type="button"><i class="fas fa-shopping-cart" aria-hidden="true"></i>Add to Cart</button></div>
    </article>`;
}

function stopStoreAlbumPreview() {
    storeAlbumPlayGeneration++;
    const audio = document.getElementById('storeAlbumAudio');
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    storeAlbumTrack = null;
    updateStoreAlbumPlayButtons();
}

function storeAlbumStatus(message = '') {
    const status = document.getElementById('storeAlbumStatus');
    if (status) status.textContent = message;
}

function updateStoreAlbumPlayButtons() {
    const audio = document.getElementById('storeAlbumAudio');
    document.querySelectorAll('.ac-play').forEach(button => {
        const albumIndex = Number(button.closest('.ac-card').dataset.albumIndex);
        const trackIndex = Number(button.dataset.trackIndex);
        const playing = storeAlbumTrack && storeAlbumTrack.albumIndex === albumIndex && storeAlbumTrack.trackIndex === trackIndex && audio && !audio.paused;
        button.setAttribute('aria-pressed', String(Boolean(playing)));
        button.querySelector('i').className = playing ? 'fas fa-pause' : 'fas fa-play';
        const title = echoCraftAlbums[albumIndex]?.tracks?.[trackIndex]?.title || '';
        button.setAttribute('aria-label', (playing ? 'Pause preview: ' : 'Play preview: ') + title);
        button.closest('.ac-track').classList.toggle('ac-playing', Boolean(playing));
    });
}

async function playStoreAlbumTrack(albumIndex, trackIndex) {
    const audio = document.getElementById('storeAlbumAudio');
    const track = echoCraftAlbums[albumIndex]?.tracks?.[trackIndex];
    const source = storeAlbumURL(track?.preview);
    if (!audio || !source) return;
    const generation = ++storeAlbumPlayGeneration;
    const sameTrack = storeAlbumTrack?.albumIndex === albumIndex && storeAlbumTrack?.trackIndex === trackIndex;
    if (sameTrack && !audio.paused) { audio.pause(); storeAlbumStatus('Preview paused.'); return; }
    if (!sameTrack) { audio.pause(); audio.src = source; storeAlbumTrack = { albumIndex, trackIndex }; }
    document.querySelectorAll('#musicContainer audio').forEach(player => player.pause());
    storeAlbumStatus('Loading preview: ' + track.title);
    try {
        await audio.play();
        if (generation === storeAlbumPlayGeneration) storeAlbumStatus('Playing preview: ' + track.title);
    } catch {
        if (generation === storeAlbumPlayGeneration) storeAlbumStatus('This preview could not start. Please try again or listen on a streaming platform.');
    }
    updateStoreAlbumPlayButtons();
}

function addStorePreviewItem(type, item) {
    const title = String(item.title || 'Untitled Release');
    const price = type === 'album' ? storeAlbumPrice(item) : storeSinglePrice(item);
    storePreviewCart.set(type + ':' + title, { title, type, price });
    renderStoreAlbumCart();
    document.getElementById('storeAlbumCart').showModal();
}

function renderStoreAlbumCart() {
    const container = document.getElementById('storeAlbumCartItems');
    container.replaceChildren();
    if (!storePreviewCart.size) { const p = document.createElement('p'); p.textContent = 'Your preview cart is empty.'; container.append(p); }
    storePreviewCart.forEach((item, key) => {
        const row = document.createElement('div'); row.className = 'ac-cart-row';
        const label = document.createElement('span'); label.textContent = item.title + ' · $' + item.price.toFixed(2);
        const remove = document.createElement('button'); remove.className = 'ac-remove'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', 'Remove ' + item.title);
        remove.onclick = () => { storePreviewCart.delete(key); renderStoreAlbumCart(); };
        row.append(label, remove); container.append(row);
    });
}

function selectStoreAlbum(index) {
    if (!echoCraftAlbums.length) return;
    stopStoreAlbumPreview();
    activeAlbumIndex = (index + echoCraftAlbums.length) % echoCraftAlbums.length;
    document.querySelectorAll('#albumsContainer .ac-card').forEach((card, i) => { card.hidden = i !== activeAlbumIndex; });
    document.querySelectorAll('.ac-thumbnail').forEach((button, i) => button.setAttribute('aria-pressed', String(i === activeAlbumIndex)));
    document.getElementById('albumsPosition').textContent = `${activeAlbumIndex + 1} / ${echoCraftAlbums.length}`;
    storeAlbumStatus();
}

function setupAlbumCarousel() {
    const container = document.getElementById('albumsContainer');
    const previous = document.getElementById('previousAlbum'), next = document.getElementById('nextAlbum');
    if (!container || !previous || !next) return;
    stopStoreAlbumPreview();
    previous.disabled = next.disabled = echoCraftAlbums.length < 2;
    previous.onclick = () => selectStoreAlbum(activeAlbumIndex - 1);
    next.onclick = () => selectStoreAlbum(activeAlbumIndex + 1);
    document.getElementById('albumsPosition').textContent = echoCraftAlbums.length ? `1 / ${echoCraftAlbums.length}` : '0 / 0';
    const gallery = document.getElementById('storeAlbumGallery'); gallery.replaceChildren();
    echoCraftAlbums.forEach((album, index) => {
        const button = document.createElement('button'); button.className = 'ac-thumbnail'; button.type = 'button';
        button.setAttribute('aria-label', 'Show ' + album.title); button.setAttribute('aria-pressed', String(index === 0));
        const image = document.createElement('img'); image.src = storeAlbumURL(album.cover) || 'assets/images/no-cover.webp'; image.alt = ''; image.loading = 'lazy'; image.onerror = () => { image.onerror = null; image.src = 'assets/images/no-cover.webp'; };
        const label = document.createElement('span'); label.textContent = album.title; label.title = album.title;
        button.append(image, label); button.onclick = () => selectStoreAlbum(index); gallery.append(button);
    });
    container.querySelectorAll('.ac-play').forEach(button => { button.onclick = () => playStoreAlbumTrack(Number(button.closest('.ac-card').dataset.albumIndex), Number(button.dataset.trackIndex)); });
    container.querySelectorAll('.ac-add').forEach(button => { button.onclick = () => { addStorePreviewItem('album', echoCraftAlbums[Number(button.closest('.ac-card').dataset.albumIndex)]); }; });
    document.getElementById('storeAlbumCartClose').onclick = () => document.getElementById('storeAlbumCart').close();
    const audio = document.getElementById('storeAlbumAudio');
    audio.onplay = updateStoreAlbumPlayButtons; audio.onpause = updateStoreAlbumPlayButtons;
    audio.onended = () => { updateStoreAlbumPlayButtons(); storeAlbumStatus('Preview finished. Choose another track to listen.'); };
    audio.onerror = () => { if (storeAlbumTrack) storeAlbumStatus('This preview is unavailable. Please try another track or a streaming platform.'); };
    activeAlbumIndex = 0;
}

/*
------------------------------------------
Create one premium music card
------------------------------------------
*/

function storeSinglePrice(track) {
    const price = Number(track?.price);
    return Number.isFinite(price) && price >= 0.5 ? price : 0.99;
}

function activateSinglePurchaseButtons() {
    document.querySelectorAll('#musicContainer .single-buy').forEach(button => {
        button.onclick = () => {
            const track = echoCraftTracks[Number(button.closest('.music-card').dataset.index)];
            if (track) addStorePreviewItem('single', track);
        };
    });
}

function createMusicCard(track, index) {
    const rawTitle = String(track.title || "Untitled Release");
    const title = escapeMusicText(rawTitle);
    const price = storeSinglePrice(track).toFixed(2);

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
                    onerror="this.src='assets/images/ec-icon.webp';"
                >

                <div class="music-artwork-shine"></div>
            </div>

            <div class="music-content">
                <h3 class="music-title" title="${title}"><span>${title}</span></h3>

                ${audioPlayer}

                <div class="music-actions">
                    ${hyperfollowButton || '<span class="single-stream-placeholder" aria-hidden="true"></span>'}

                    <div class="platform-buttons">
                        ${spotifyButton}
                        ${appleButton}
                    </div>
                </div>
                <div class="single-purchase">
                    <div class="single-purchase-copy"><strong>Get This Track</strong><span>Digital single · Store preview</span></div>
                    <div class="single-price">$${price}</div>
                    <button type="button" class="single-buy" aria-label="Add ${title} to the preview cart"><i class="fas fa-shopping-cart" aria-hidden="true"></i>Buy Here</button>
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
        "#musicContainer audio, #storeAlbumAudio"
    );

    players.forEach(player => {
        if (player.dataset.singlePlaybackBound) return;
        player.dataset.singlePlaybackBound = "true";
        player.addEventListener("play", () => {
            if (player.paused) return;
            document.querySelectorAll("#musicContainer audio, #storeAlbumAudio").forEach(otherPlayer => {
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
                const strip =
                    document.getElementById(
                        "mobileLetterStrip"
                    );

                if (strip) {
                    const targetLeft =
                        button.offsetLeft -
                        (
                            strip.clientWidth -
                            button.clientWidth
                        ) / 2;

                    strip.scrollTo({
                        left: Math.max(
                            0,
                            targetLeft
                        ),
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

        const data = await response.json();
        const allItems = Array.isArray(data.items) ? data.items : [];
        const nextRelease = allItems.filter(item => item.publicationStatus === 'scheduled').map(item => Date.parse(item.publishAt)).filter(time => time > Date.now()).sort((a,b)=>a-b)[0];
        clearTimeout(window.echoCraftReleaseTimer);
        if (nextRelease) window.echoCraftReleaseTimer = setTimeout(loadMusicTracks, Math.min(nextRelease-Date.now()+100, 2147483647));
        data.items = allItems.filter(item => isReleaseAvailable(item));

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

        echoCraftAlbums =
            data.items
                .filter(
                    item =>
                        item.type === "album"
                )
                .sort((a, b) =>
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

        echoCraftTracks =
            data.items
                .filter(
                    item =>
                        item.type !== "album"
                )
                .sort((a, b) =>
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

        const albumsContainer =
            document.getElementById(
                "albumsContainer"
            );

        if (albumsContainer) {
            albumsContainer.innerHTML =
                echoCraftAlbums.length
                    ? echoCraftAlbums
                        .map(createAlbumCard)
                        .join("")
                    : `
                        <div class="albums-empty">
                            Albums and collections are coming soon.
                        </div>
                    `;
        }

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

        setupAlbumCarousel();
        activateSingleAudioPlayback();
        activateSinglePurchaseButtons();
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
