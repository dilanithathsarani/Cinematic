/* ============================================================
   CINEMATIC — script.js
   SPA routing, popular grid tiles, star favorites, details page
   ============================================================ */

const API_KEY = "85c9c8ba";
const API_URL = "https://www.omdbapi.com/";

const POPULAR_TITLES = [
    // 2024 Blockbusters
    "Dune: Part Two",
    "Inside Out 2",
    "Deadpool & Wolverine",
    "Alien: Romulus",
    "Godzilla x Kong: The New Empire",
    "Twisters",
    "Furiosa: A Mad Max Saga",
    "Challengers",
    "Longlegs",
    // 2023 Hits
    "Oppenheimer",
    "Barbie",
    "Poor Things",
    "The Batman",
    "Killers of the Flower Moon",
    "Past Lives",
    "Mission: Impossible Dead Reckoning",
    // All-time Popular
    "Inception",
    "Interstellar",
    "The Dark Knight",
    "Avengers: Endgame",
    "Top Gun: Maverick",
    "Everything Everywhere All at Once",
    "Parasite",
    "Spider-Man: No Way Home"
];

/* ── State ── */
const movieCache = {};            // imdbID → full data object
let favorites = loadFavorites();  // persisted array of lightweight favourite objects
let currentTab = "popular";       // "popular" | "favorites"
let popularMovies = [];           // cached popular movies array

/* ── Helpers ── */
function loadFavorites() {
    try { return JSON.parse(localStorage.getItem("cinematic_favs") || "[]"); }
    catch { return []; }
}
function saveFavorites() {
    localStorage.setItem("cinematic_favs", JSON.stringify(favorites));
    updateFavBadges();
}
function isFav(imdbID) { return favorites.some(f => f.imdbID === imdbID); }
function updateFavBadges() {
    const n = favorites.length;
    document.getElementById("favCountBadge").textContent = n;
    document.getElementById("tabFavBadge").textContent = n;
}

async function apiFetch(params) {
    const u = new URLSearchParams({ ...params, apikey: API_KEY });
    const res = await fetch(`${API_URL}?${u}`);
    return res.json();
}

/* ── AMBIENT BACKDROP ── */
function setBackdrop(url) {
    const el = document.getElementById("ambientBackdrop");
    if (!url || url === "N/A") { el.classList.remove("active"); return; }
    el.style.backgroundImage = `url('${url}')`;
    el.classList.add("active");
}
function clearBackdrop() {
    document.getElementById("ambientBackdrop").classList.remove("active");
}

/* ============================================================
   VIEW SWITCHING — SPA Navigation
   ============================================================ */
function showHome() {
    document.getElementById("homeView").classList.remove("d-none");
    document.getElementById("detailsView").classList.add("d-none");
}
function showDetails() {
    document.getElementById("homeView").classList.add("d-none");
    document.getElementById("detailsView").classList.remove("d-none");
}

/* Navigate to home from anywhere */
function navigateToHome() {
    history.pushState({}, "", window.location.pathname);
    clearBackdrop();
    showHome();
    renderCurrentTab();
}

/* Navigate to a movie's details page */
async function navigateToMovie(imdbID) {
    // Update URL without reloading
    history.pushState({ imdbID }, "", `?id=${imdbID}`);
    showDetails();
    await renderDetailsPage(imdbID);
}

/* Browser back/forward support */
window.addEventListener("popstate", () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
        showDetails();
        renderDetailsPage(id);
    } else {
        clearBackdrop();
        showHome();
        renderCurrentTab();
    }
});

/* ============================================================
   SEARCH
   ============================================================ */
async function findMovie(presetName) {
    const input = document.getElementById("searchInput");
    const name = presetName || input.value.trim();
    if (!name) return;

    // Get data via title lookup
    try {
        const data = await apiFetch({ t: encodeURIComponent(name) });
        if (data && data.Response === "True") {
            movieCache[data.imdbID] = data;
            input.value = ""; // Clear search bar on success
            navigateToMovie(data.imdbID);
        } else {
            // If no exact match, try searching and use first result
            const searchData = await apiFetch({ s: encodeURIComponent(name) });
            if (searchData && searchData.Response === "True" && searchData.Search.length > 0) {
                input.value = ""; // Clear search bar on success
                navigateToMovie(searchData.Search[0].imdbID);
            } else {
                input.value = ""; // Clear even on failure so user can try again cleanly
                alert(`No movie found for "${name}". Try a different title.`);
            }
        }
    } catch (e) {
        console.error(e);
        input.value = "";
        alert("Network error. Please check your connection.");
    }
}

function quickSearch(name) { findMovie(name); }

/* Enter key on search input */
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("searchInput").addEventListener("keypress", e => {
        if (e.key === "Enter") findMovie();
    });
});

/* ============================================================
   HOME: POPULAR GRID
   ============================================================ */
async function loadPopularMovies() {
    if (popularMovies.length > 0) { renderTiles(popularMovies); return; }

    // Show skeleton tiles while loading
    renderSkeletonTiles(POPULAR_TITLES.length);

    const promises = POPULAR_TITLES.map(async title => {
        try {
            const data = await apiFetch({ t: encodeURIComponent(title) });
            if (data && data.Response === "True") {
                movieCache[data.imdbID] = data;
                return data;
            }
        } catch { /* skip */ }
        return null;
    });

    const results = await Promise.all(promises);
    popularMovies = results.filter(Boolean);
    renderTiles(popularMovies);

    // Set ambient to first popular movie
    if (popularMovies.length > 0 && popularMovies[0].Poster !== "N/A") {
        setBackdrop(popularMovies[0].Poster);
    }
}

/* ============================================================
   TABS
   ============================================================ */
function switchTab(tab) {
    currentTab = tab;
    document.getElementById("tabPopular").classList.toggle("active", tab === "popular");
    document.getElementById("tabFavorites").classList.toggle("active", tab === "favorites");
    renderCurrentTab();
}

function showFavoritesTab() { switchTab("favorites"); }

function renderCurrentTab() {
    if (currentTab === "popular") {
        document.getElementById("sectionMeta").textContent = `${POPULAR_TITLES.length} featured titles`;
        loadPopularMovies();
    } else {
        document.getElementById("sectionMeta").textContent = `${favorites.length} saved`;
        renderFavoritesGrid();
    }
}

function renderFavoritesGrid() {
    if (favorites.length === 0) {
        document.getElementById("moviesGrid").innerHTML = `
            <div class="empty-state">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <h4>No Favorites Yet</h4>
                <p>Browse popular movies and click the ★ button to save favorites here.</p>
            </div>`;
        return;
    }
    // Build lightweight tile data from saved favorites
    const favData = favorites.map(f => ({
        imdbID: f.imdbID, Title: f.Title, Poster: f.Poster,
        Year: f.Year, imdbRating: f.imdbRating,
        Genre: f.Genre || "", Type: f.Type || "movie"
    }));
    renderTiles(favData);
}

/* ============================================================
   TILE RENDERING
   ============================================================ */
function renderSkeletonTiles(count) {
    const grid = document.getElementById("moviesGrid");
    grid.innerHTML = Array(count).fill('<div class="skeleton-tile"></div>').join("");
}

function renderTiles(movies) {
    const grid = document.getElementById("moviesGrid");
    if (!movies || movies.length === 0) {
        grid.innerHTML = `<div class="empty-state"><h4>No movies found.</h4></div>`;
        return;
    }

    grid.innerHTML = movies.map((movie, idx) => {
        const poster = (movie.Poster && movie.Poster !== "N/A")
            ? movie.Poster
            : "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&q=80";
        const rating = (movie.imdbRating && movie.imdbRating !== "N/A") ? movie.imdbRating : null;
        const favActive = isFav(movie.imdbID) ? "active" : "";
        const genre = movie.Genre ? movie.Genre.split(",")[0].trim() : movie.Type || "Film";
        const safeId = movie.imdbID;

        return `
        <div class="movie-tile" style="animation-delay: ${idx * 40}ms"
             onclick="tileClick(event, '${safeId}')">

            <!-- Poster with overlays -->
            <div class="tile-poster-wrap">
                <img src="${poster}" class="tile-poster" alt="${movie.Title}" loading="lazy"
                     onerror="this.src='https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&q=80'">
                <div class="tile-overlay"></div>
                <div class="tile-view-hint">View Details</div>

                <!-- Year badge (top-left) -->
                <span class="tile-year-badge">${movie.Year}</span>

                <!-- ⭐ Favorites star (top-right) -->
                <button class="fav-tile-btn ${favActive}" id="favBtn-${safeId}"
                        onclick="toggleFavorite('${safeId}', event)"
                        title="${favActive ? 'Remove from favorites' : 'Add to favorites'}">
                    <svg viewBox="0 0 24 24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                </button>

                ${rating ? `
                <span class="tile-rating-badge">
                    <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ${rating}
                </span>` : ""}
            </div>

            <!-- Title + genre -->
            <div class="tile-body">
                <h3 class="tile-title">${movie.Title}</h3>
                <span class="tile-meta">${genre}</span>
            </div>
        </div>`;
    }).join("");
}

/* Click on a tile card body triggers navigation */
function tileClick(event, imdbID) {
    // If the star button was clicked, don't navigate
    if (event.target.closest(".fav-tile-btn")) return;
    navigateToMovie(imdbID);
}

/* ============================================================
   FAVORITES TOGGLE
   ============================================================ */
async function toggleFavorite(imdbID, event) {
    event.stopPropagation();

    if (isFav(imdbID)) {
        // REMOVE from favorites
        favorites = favorites.filter(f => f.imdbID !== imdbID);
    } else {
        // ADD to favorites — fetch if not in cache
        let data = movieCache[imdbID];
        if (!data) {
            try { data = await apiFetch({ i: imdbID }); movieCache[imdbID] = data; }
            catch { return; }
        }
        if (!data || data.Response !== "True") return;

        favorites.push({
            imdbID: data.imdbID,
            Title:     data.Title,
            Poster:    data.Poster,
            Year:      data.Year,
            imdbRating: data.imdbRating,
            Genre:     data.Genre,
            Type:      data.Type
        });
    }

    saveFavorites();

    // Sync star button in grid
    const btn = document.getElementById(`favBtn-${imdbID}`);
    if (btn) {
        const active = isFav(imdbID);
        btn.classList.toggle("active", active);
        btn.title = active ? "Remove from favorites" : "Add to favorites";
    }

    // Sync star button on details page (if currently open)
    const detailsBtn = document.getElementById("detailsFavBtn");
    if (detailsBtn && detailsBtn.dataset.id === imdbID) {
        syncDetailsFavBtn(imdbID);
    }

    // If we are on the favorites tab, re-render
    if (currentTab === "favorites") { renderFavoritesGrid(); }
}

function syncDetailsFavBtn(imdbID) {
    const btn = document.getElementById("detailsFavBtn");
    if (!btn || btn.dataset.id !== imdbID) return;
    const active = isFav(imdbID);
    btn.classList.toggle("active", active);
    btn.querySelector("span").textContent = active ? "Favorited" : "Add to Favorites";
}

/* ============================================================
   DETAILS PAGE RENDER
   ============================================================ */
async function renderDetailsPage(imdbID) {
    const body = document.getElementById("detailsBody");

    // Show loading skeleton
    body.innerHTML = `
        <div class="details-loading">
            <div class="details-hero">
                <div class="skel skel-poster"></div>
                <div style="flex:1;display:flex;flex-direction:column;gap:0;">
                    <div class="skel skel-title"></div>
                    <div class="skel skel-meta"></div>
                    <div class="skel skel-line" style="width:100%;margin-bottom:10px;"></div>
                    <div class="skel skel-line" style="width:88%;margin-bottom:10px;"></div>
                    <div class="skel skel-line" style="width:70%;"></div>
                </div>
            </div>
        </div>`;

    try {
        let movie = movieCache[imdbID];
        if (!movie || !movie.Plot || movie.Plot === "N/A") {
            movie = await apiFetch({ i: imdbID, plot: "full" });
            if (movie && movie.Response === "True") movieCache[imdbID] = movie;
        }

        if (!movie || movie.Response !== "True") {
            body.innerHTML = `<div class="empty-state"><h4>Movie Not Found</h4><p>Could not load details for this title.</p></div>`;
            return;
        }

        // Set ambient backdrop to this movie's poster
        setBackdrop(movie.Poster);

        const poster = (movie.Poster && movie.Poster !== "N/A")
            ? movie.Poster
            : "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=500&q=80";

        const ratings   = movie.Ratings || [];
        const rtScore   = ratings.find(r => r.Source === "Rotten Tomatoes")?.Value || "N/A";
        const metaScore = movie.Metascore !== "N/A" ? `${movie.Metascore}/100` : "N/A";
        const boxOffice = movie.BoxOffice !== "N/A" ? movie.BoxOffice : "N/A";
        const favActive = isFav(movie.imdbID);

        const genres = movie.Genre
            ? movie.Genre.split(",").map(g => `<span class="genre-pill">${g.trim()}</span>`).join("")
            : "";

        body.innerHTML = `
            <!-- Hero: Poster + Info -->
            <div class="details-hero">
                <div class="details-poster-wrap">
                    <img src="${poster}" class="details-poster" alt="${movie.Title}"
                         onerror="this.src='https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=500&q=80'">
                </div>

                <div class="details-info">
                    <h1 class="details-title">${movie.Title}</h1>

                    <div class="details-meta-row">
                        <span class="detail-badge gold">★ ${movie.imdbRating}</span>
                        <span class="detail-badge">${movie.Year}</span>
                        <span class="detail-badge">${movie.Rated}</span>
                        <span class="detail-badge">${movie.Runtime}</span>
                        <span class="detail-badge accent">${movie.Type}</span>
                    </div>

                    <div class="details-genres">${genres}</div>

                    <p class="details-plot">${movie.Plot}</p>

                    <div class="details-credits">
                        <div class="credit-row">
                            <span class="credit-label">Director</span>
                            <span class="credit-value">${movie.Director}</span>
                        </div>
                        <div class="credit-row">
                            <span class="credit-label">Cast</span>
                            <span class="credit-value">${movie.Actors}</span>
                        </div>
                        <div class="credit-row">
                            <span class="credit-label">Language</span>
                            <span class="credit-value">${movie.Language}</span>
                        </div>
                        <div class="credit-row">
                            <span class="credit-label">Awards</span>
                            <span class="credit-value">${movie.Awards}</span>
                        </div>
                    </div>

                    <!-- Favorites Button on detail page -->
                    <button class="details-fav-btn ${favActive ? 'active' : ''}"
                            id="detailsFavBtn"
                            data-id="${movie.imdbID}"
                            onclick="toggleFavFromDetails('${movie.imdbID}')">
                        <svg viewBox="0 0 24 24">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        <span>${favActive ? "Favorited" : "Add to Favorites"}</span>
                    </button>
                </div>
            </div>

            <!-- Ratings Scorecard -->
            <div class="ratings-scorecard">
                <div class="score-item">
                    <span class="score-val">${movie.imdbRating}/10</span>
                    <span class="score-lbl">IMDb Rating</span>
                </div>
                <div class="score-item">
                    <span class="score-val">${movie.imdbVotes || "N/A"}</span>
                    <span class="score-lbl">IMDb Votes</span>
                </div>
                <div class="score-item">
                    <span class="score-val">${rtScore}</span>
                    <span class="score-lbl">Rotten Tomatoes</span>
                </div>
                <div class="score-item">
                    <span class="score-val">${metaScore}</span>
                    <span class="score-lbl">Metacritic</span>
                </div>
                <div class="score-item">
                    <span class="score-val">${boxOffice}</span>
                    <span class="score-lbl">Box Office</span>
                </div>
            </div>
        `;
    } catch (e) {
        console.error("Details error:", e);
        body.innerHTML = `<div class="empty-state"><h4>Error Loading Movie</h4><p>Check your connection and try again.</p></div>`;
    }
}

/* Toggle favorite from the details page */
async function toggleFavFromDetails(imdbID) {
    if (isFav(imdbID)) {
        favorites = favorites.filter(f => f.imdbID !== imdbID);
    } else {
        let data = movieCache[imdbID];
        if (!data || data.Response !== "True") return;
        favorites.push({
            imdbID: data.imdbID, Title: data.Title,
            Poster: data.Poster,  Year: data.Year,
            imdbRating: data.imdbRating, Genre: data.Genre, Type: data.Type
        });
    }
    saveFavorites();
    syncDetailsFavBtn(imdbID);
}

/* ============================================================
   INIT — On page load, check URL and route accordingly
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    updateFavBadges();

    const params = new URLSearchParams(window.location.search);
    const movieId = params.get("id");

    if (movieId) {
        // Direct link to a movie
        showDetails();
        renderDetailsPage(movieId);
    } else {
        // Home view: show popular grid
        showHome();
        loadPopularMovies();
        document.getElementById("sectionMeta").textContent = `${POPULAR_TITLES.length} featured titles`;
    }
});