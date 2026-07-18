// Cinematic Explorer - Core Script
const API_KEY = "85c9c8ba";
const API_URL = "https://www.omdbapi.com/";

// Selected popular movies to display on first load
const TRENDING_TITLES = [
    "Inception",
    "Interstellar",
    "The Dark Knight",
    "Avatar",
    "The Matrix",
    "Gladiator",
    "Spirited Away",
    "Pulp Fiction",
    "Whiplash",
    "Django Unchained"
];

// Cache of loaded movie detail structures to avoid double fetching
const movieCache = {};
let favorites = JSON.parse(localStorage.getItem("cinematic_favorites")) || [];
let searchDebounceTimer = null;
let currentTrendingMovies = []; // Memory cache of trending movies

// DOM Elements
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const suggestionsBox = document.getElementById("suggestionsBox");
const moviesGrid = document.getElementById("moviesGrid");
const sectionTitle = document.getElementById("sectionTitle");
const resultsCount = document.getElementById("resultsCount");
const favCountBadge = document.getElementById("favCount");
const favoritesList = document.getElementById("favoritesList");
const ambientBackdrop = document.getElementById("ambientBackdrop");

// Modal Elements
const modalHero = document.getElementById("modalHero");
const modalScores = document.getElementById("modalScores");
let bootstrapModalInstance = null;

// Initialize app when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    bootstrapModalInstance = new bootstrap.Modal(document.getElementById("movieModal"));
    updateFavoritesBadge();
    loadTrendingSection();
    setupEventListeners();
});

// Setup DOM Event Listeners
function setupEventListeners() {
    // Debounced search autocomplete
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        toggleClearButton(query.length > 0);
        
        clearTimeout(searchDebounceTimer);
        if (query.length < 3) {
            suggestionsBox.classList.remove("active");
            return;
        }

        searchDebounceTimer = setTimeout(() => {
            fetchSearchSuggestions(query);
        }, 300);
    });

    // Handle enter key inside search box
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            performSearch();
            suggestionsBox.classList.remove("active");
        }
    });

    // Clear search button behavior
    clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        toggleClearButton(false);
        suggestionsBox.classList.remove("active");
        resetToHome();
    });

    // Close suggestions dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-wrapper")) {
            suggestionsBox.classList.remove("active");
        }
    });
}

// Show/Hide Clear Search Button
function toggleClearButton(visible) {
    if (visible) {
        clearSearchBtn.classList.add("visible");
    } else {
        clearSearchBtn.classList.remove("visible");
    }
}

// Fetch helper with standard error checking
async function apiFetch(params) {
    const urlParams = new URLSearchParams({ ...params, apikey: API_KEY });
    const response = await fetch(`${API_URL}?${urlParams.toString()}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

// Load default feed on startup
async function loadTrendingSection() {
    sectionTitle.textContent = "Popular Cinema";
    resultsCount.textContent = "";
    renderSkeletons(8);

    try {
        if (currentTrendingMovies.length > 0) {
            renderMovies(currentTrendingMovies);
            if (currentTrendingMovies[0].Poster && currentTrendingMovies[0].Poster !== "N/A") {
                setAmbientBackdrop(currentTrendingMovies[0].Poster);
            }
            return;
        }

        // Fetch detail information for popular movies in parallel
        const fetchPromises = TRENDING_TITLES.slice(0, 8).map(async (title) => {
            const searchData = await apiFetch({ t: title });
            if (searchData && searchData.Response === "True") {
                movieCache[searchData.imdbID] = searchData;
                return searchData;
            }
            return null;
        });

        const results = await Promise.all(fetchPromises);
        currentTrendingMovies = results.filter(movie => movie !== null);
        
        renderMovies(currentTrendingMovies);
        if (currentTrendingMovies.length > 0 && currentTrendingMovies[0].Poster !== "N/A") {
            setAmbientBackdrop(currentTrendingMovies[0].Poster);
        }
    } catch (error) {
        console.error("Error loading trending movies:", error);
        renderError("Failed to load featured section.", "Please check your network connection and try again.");
    }
}

// Reset view back to Home feed
function resetToHome() {
    loadTrendingSection();
}

// Retrieve single movie details from Cache or Endpoint
async function getMovieDetails(imdbId) {
    if (movieCache[imdbId]) {
        return movieCache[imdbId];
    }
    
    const details = await apiFetch({ i: imdbId, plot: "full" });
    if (details && details.Response === "True") {
        movieCache[imdbId] = details;
        return details;
    }
    throw new Error("Movie details not found");
}

// Search Suggestions Autocomplete
async function fetchSearchSuggestions(query) {
    try {
        const data = await apiFetch({ s: query });
        if (data && data.Response === "True" && data.Search) {
            renderSuggestions(data.Search.slice(0, 5));
        } else {
            suggestionsBox.classList.remove("active");
        }
    } catch (err) {
        console.error("Suggestions fetch error:", err);
    }
}

// Render Suggestions Dropdown list
function renderSuggestions(items) {
    suggestionsBox.innerHTML = "";
    
    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.onclick = () => {
            showMovieDetails(item.imdbID);
            suggestionsBox.classList.remove("active");
        };

        const poster = item.Poster !== "N/A" ? item.Poster : "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=100&q=80";
        
        div.innerHTML = `
            <img src="${poster}" class="suggestion-poster" alt="${item.Title}">
            <div class="suggestion-info">
                <span class="suggestion-title">${item.Title}</span>
                <span class="suggestion-meta">${item.Year} • ${item.Type}</span>
            </div>
        `;
        suggestionsBox.appendChild(div);
    });

    suggestionsBox.classList.add("active");
}

// Main Search Trigger
async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    suggestionsBox.classList.remove("active");
    sectionTitle.textContent = `Search Results`;
    resultsCount.textContent = `searching...`;
    renderSkeletons(8);

    try {
        const data = await apiFetch({ s: query });
        
        if (data && data.Response === "True" && data.Search) {
            resultsCount.textContent = `Found ${data.totalResults} results`;
            
            // To make search grid beautiful, fetch rating and plot for top 8 results in parallel
            const targetItems = data.Search.slice(0, 8);
            const detailedPromises = targetItems.map(async (item) => {
                try {
                    return await getMovieDetails(item.imdbID);
                } catch {
                    return item; // Fallback to basic search result if detail fetch fails
                }
            });

            const detailedMovies = await Promise.all(detailedPromises);
            renderMovies(detailedMovies);
            
            if (detailedMovies.length > 0 && detailedMovies[0].Poster !== "N/A") {
                setAmbientBackdrop(detailedMovies[0].Poster);
            }
        } else {
            resultsCount.textContent = `0 results`;
            renderEmptySearch(query);
        }
    } catch (error) {
        console.error("Search error:", error);
        renderError("Search error occurred.", "We could not search movies at this moment. Try again.");
    }
}

// Render skeleton card templates
function renderSkeletons(count) {
    moviesGrid.innerHTML = "";
    for (let i = 0; i < count; i++) {
        const div = document.createElement("div");
        div.className = "col";
        div.innerHTML = `
            <div class="skeleton-card">
                <div class="skeleton-poster skeleton-shimmer"></div>
                <div class="skeleton-content">
                    <div class="skeleton-line title skeleton-shimmer mb-2"></div>
                    <div class="skeleton-line meta skeleton-shimmer"></div>
                </div>
            </div>
        `;
        moviesGrid.appendChild(div);
    }
}

// Render Movies inside Grid
function renderMovies(movies) {
    moviesGrid.innerHTML = "";

    movies.forEach(movie => {
        const isFav = isFavorite(movie.imdbID);
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=500&q=80";
        const rating = movie.imdbRating && movie.imdbRating !== "N/A" ? movie.imdbRating : "N/A";
        const primaryGenre = movie.Genre ? movie.Genre.split(",")[0] : "Cinema";
        
        const col = document.createElement("div");
        col.className = "col";
        col.innerHTML = `
            <div class="movie-card" onmouseenter="setAmbientBackdrop('${poster}')" onclick="showMovieDetails('${movie.imdbID}')">
                <div class="poster-container">
                    <img src="${poster}" class="poster-img" alt="${movie.Title}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=500&q=80';">
                    <div class="poster-overlay">
                        <button class="overlay-details-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            Details
                        </button>
                    </div>
                    <span class="card-badge">${movie.Year}</span>
                    <button class="fav-card-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${movie.imdbID}', event)" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </button>
                </div>
                <div class="card-content">
                    <span class="movie-year">${movie.Type}</span>
                    <h3 class="movie-title">${movie.Title}</h3>
                    <div class="card-meta-row">
                        <span class="card-rating">
                            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            ${rating}
                        </span>
                        <span class="card-media-type">${primaryGenre}</span>
                    </div>
                </div>
            </div>
        `;
        moviesGrid.appendChild(col);
    });
}

// Ambient Background Image Cross-fade
function setAmbientBackdrop(imageUrl) {
    if (!imageUrl || imageUrl === "N/A") return;
    
    ambientBackdrop.style.backgroundImage = `url('${imageUrl}')`;
    ambientBackdrop.classList.add("active");
}

// Display Detailed Movie Modal
async function showMovieDetails(imdbId) {
    // Show loading indicator or simple transition
    try {
        const movie = await getMovieDetails(imdbId);
        setAmbientBackdrop(movie.Poster);
        
        const isFav = isFavorite(movie.imdbID);
        const poster = movie.Poster !== "N/A" ? movie.Poster : "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=500&q=80";
        
        // Modal Main Hero Grid
        modalHero.innerHTML = `
            <div class="col-12 col-md-4">
                <div class="modal-poster-wrap">
                    <img src="${poster}" class="modal-poster" alt="${movie.Title}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=500&q=80';">
                </div>
            </div>
            <div class="col-12 col-md-8 d-flex flex-column modal-details ps-md-4">
                <h2 class="modal-title">${movie.Title}</h2>
                
                <div class="modal-meta-row">
                    <span class="modal-meta-item modal-rating-badge">IMDb ${movie.imdbRating}</span>
                    <span class="modal-meta-item">${movie.Year}</span>
                    <span class="modal-meta-item">•</span>
                    <span class="modal-meta-item">${movie.Rated}</span>
                    <span class="modal-meta-item">•</span>
                    <span class="modal-meta-item">${movie.Runtime}</span>
                </div>
                
                <div class="modal-genres">
                    ${movie.Genre.split(",").map(g => `<span class="genre-tag">${g.trim()}</span>`).join("")}
                </div>
                
                <p class="modal-plot">${movie.Plot}</p>
                
                <div class="modal-credits">
                    <div class="credits-item">
                        <span class="credits-label">Director</span>
                        <span class="credits-value">${movie.Director}</span>
                    </div>
                    <div class="credits-item">
                        <span class="credits-label">Cast</span>
                        <span class="credits-value">${movie.Actors}</span>
                    </div>
                    <div class="credits-item">
                        <span class="credits-label">Awards</span>
                        <span class="credits-value">${movie.Awards}</span>
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="modal-fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${movie.imdbID}', event, true)">
                        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <span>${isFav ? 'Favorited' : 'Add to Favorites'}</span>
                    </button>
                </div>
            </div>
        `;

        // Ratings Scores Row
        const ratings = movie.Ratings || [];
        const rottenTomatoes = ratings.find(r => r.Source === "Rotten Tomatoes")?.Value || "N/A";
        const metaScore = movie.Metascore !== "N/A" ? `${movie.Metascore}/100` : "N/A";
        const boxOffice = movie.BoxOffice !== "N/A" ? movie.BoxOffice : "N/A";

        modalScores.innerHTML = `
            <div class="score-box">
                <span class="score-value">${movie.imdbRating}/10</span>
                <span class="score-label">IMDb Score</span>
            </div>
            <div class="score-box">
                <span class="score-value">${rottenTomatoes}</span>
                <span class="score-label">Rotten Tomatoes</span>
            </div>
            <div class="score-box">
                <span class="score-value">${metaScore}</span>
                <span class="score-label">Metacritic</span>
            </div>
            <div class="score-box">
                <span class="score-value">${boxOffice}</span>
                <span class="score-label">Box Office</span>
            </div>
        `;

        bootstrapModalInstance.show();
    } catch (err) {
        console.error("Modal load error:", err);
    }
}

// Favorites Logic
function isFavorite(imdbId) {
    return favorites.some(item => item.imdbID === imdbId);
}

async function toggleFavorite(imdbId, event, fromModal = false) {
    if (event) event.stopPropagation();

    const isFav = isFavorite(imdbId);
    
    if (isFav) {
        // Remove favorite
        favorites = favorites.filter(item => item.imdbID !== imdbId);
        localStorage.setItem("cinematic_favorites", JSON.stringify(favorites));
        
        // Update states
        updateFavoriteButtons(imdbId, false);
    } else {
        // Fetch full detail if not in cache (highly unlikely to not be in cache at this step)
        try {
            const movie = await getMovieDetails(imdbId);
            const favItem = {
                imdbID: movie.imdbID,
                Title: movie.Title,
                Poster: movie.Poster,
                Year: movie.Year,
                Type: movie.Type,
                imdbRating: movie.imdbRating
            };
            
            favorites.push(favItem);
            localStorage.setItem("cinematic_favorites", JSON.stringify(favorites));
            
            // Update states
            updateFavoriteButtons(imdbId, true);
        } catch (err) {
            console.error("Error toggling favorite item:", err);
        }
    }

    updateFavoritesBadge();
    renderFavoritesList();
}

// Sync Star States on visible buttons (Modal + Grid items)
function updateFavoriteButtons(imdbId, isFav) {
    // Update card buttons in grid if they match
    document.querySelectorAll(".movie-card").forEach(card => {
        // Retrieve imdbID via click handler or caching attributes if available.
        // E.g., cards match trigger function call 'showMovieDetails("imdbId")'
        if (card.outerHTML.includes(`showMovieDetails('${imdbId}')`)) {
            const star = card.querySelector(".fav-card-btn");
            if (star) {
                if (isFav) star.classList.add("active");
                else star.classList.remove("active");
            }
        }
    });

    // Update modal button if currently displayed
    const modalBtn = document.querySelector(".modal-fav-btn");
    if (modalBtn && modalBtn.outerHTML.includes(`toggleFavorite('${imdbId}'`)) {
        if (isFav) {
            modalBtn.classList.add("active");
            modalBtn.querySelector("span").textContent = "Favorited";
        } else {
            modalBtn.classList.remove("active");
            modalBtn.querySelector("span").textContent = "Add to Favorites";
        }
    }
}

// Update Favorites Drawer Badge counts
function updateFavoritesBadge() {
    favCountBadge.textContent = favorites.length;
}

// Render offcanvas sidebar favorites list
function renderFavoritesList() {
    favoritesList.innerHTML = "";
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = `
            <div class="favorites-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span>No favorites saved yet. Add some movies!</span>
            </div>
        `;
        return;
    }

    favorites.forEach(item => {
        const div = document.createElement("div");
        div.className = "favorite-item";

        const poster = item.Poster !== "N/A" ? item.Poster : "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=100&q=80";

        div.innerHTML = `
            <img src="${poster}" class="fav-item-poster" alt="${item.Title}" onclick="openDetailsFromSidebar('${item.imdbID}')">
            <div class="fav-item-info">
                <span class="fav-item-title" onclick="openDetailsFromSidebar('${item.imdbID}')">${item.Title}</span>
                <span class="fav-item-meta">${item.Year} • Rating: ${item.imdbRating}</span>
            </div>
            <button class="remove-fav-btn" onclick="toggleFavorite('${item.imdbID}', event)" title="Remove Favorite">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;
        favoritesList.appendChild(div);
    });
}

// Offcanvas triggers details modal
function openDetailsFromSidebar(imdbId) {
    // Hide Offcanvas using bootstrap instance
    const offcanvasEl = document.getElementById("favoritesSidebar");
    const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasEl);
    if (offcanvasInstance) {
        offcanvasInstance.hide();
    }
    
    // Show Details modal
    showMovieDetails(imdbId);
}

// Favorites Offcanvas toggle event listener
const offcanvasSidebar = document.getElementById("favoritesSidebar");
if (offcanvasSidebar) {
    offcanvasSidebar.addEventListener("show.bs.offcanvas", () => {
        renderFavoritesList();
    });
}

// Error state display
function renderError(title, subtitle) {
    moviesGrid.innerHTML = `
        <div class="error-container">
            <div class="error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <h4 class="error-title">${title}</h4>
            <p class="error-message">${subtitle}</p>
            <button class="retry-btn" onclick="resetToHome()">Retry</button>
        </div>
    `;
}

// Empty search feedback template
function renderEmptySearch(query) {
    moviesGrid.innerHTML = `
        <div class="error-container">
            <div class="error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            <h4 class="error-title">No Movies Found</h4>
            <p class="error-message">No results matching "<strong>${query}</strong>" were found. Check spelling or try other keywords.</p>
            <button class="retry-btn" onclick="resetToHome()">Clear search</button>
        </div>
    `;
}