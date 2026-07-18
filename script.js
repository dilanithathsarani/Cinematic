let key = "85c9c8ba"

function findMovie() {
    let movieName = document.getElementById("searchInput").value;
    let url = `https://www.omdbapi.com/?t=${movieName}&apikey=${key}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.Response === "True") {
                document.getElementById("results").innerHTML = `
                    <h2>${data.Title}</h2>
                    <p><strong>Year:</strong> ${data.Year}</p>
                    <p><strong>Director:</strong> ${data.Director}</p>
                    <p><strong>Actors:</strong> ${data.Actors}</p>
                `;
            } else {
                document.getElementById("results").innerHTML = "<p>Movie not found.</p>";
            }
        })
        .catch(error => {
            console.error("Error fetching movie data:", error);
        });
}