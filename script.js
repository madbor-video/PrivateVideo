/* =========================================
   LOGIN
========================================= */

const LOGIN_USERNAME = "mom";
const LOGIN_PASSWORD = "2580";


function login(event) {

    event.preventDefault();

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value;

    const error =
        document.getElementById("loginError");


    if (
        username === LOGIN_USERNAME &&
        password === LOGIN_PASSWORD
    ) {

        sessionStorage.setItem(
            "videoAuth",
            "true"
        );

        window.location.href = "index.html";

    } else {

        if (error) {
            error.style.display = "block";
        }

    }

}


/* =========================================
   LOGOUT
========================================= */

function logout() {

    sessionStorage.removeItem("videoAuth");

    sessionStorage.removeItem("ageConfirmed");

    window.location.href = "login.html";

}


/* =========================================
   AGE POPUP
========================================= */

function confirmAge() {

    sessionStorage.setItem(
        "ageConfirmed",
        "true"
    );

    const popup =
        document.getElementById("agePopup");

    if (popup) {
        popup.style.display = "none";
    }

}


function leaveSite() {

    window.location.href =
        "https://www.google.com/";

}


/* =========================================
   VIDEO SETTINGS
========================================= */

const VIDEOS_PER_PAGE = 24;

let currentPage = 1;

let currentCategory = "Japanese Mom";


const categories = [
    "Japanese Mom",
    "Brazzur Mom",
    "Bangladesh Video",
    "Indian Video"
];


/* =========================================
   VIDEO DATABASE
   ONLY SERVER UPLOADED VIDEOS
========================================= */

const videos = [];


/* =========================================
   LOAD VIDEOS FROM SERVER
========================================= */

async function loadUploadedVideos() {

    try {

        const response =
            await fetch("/api/videos", {
                cache: "no-store"
            });


        if (!response.ok) {

            throw new Error(
                "Server থেকে video load করা যায়নি।"
            );

        }


        const uploadedVideos =
            await response.json();


        /* পুরোনো video list সম্পূর্ণ পরিষ্কার */
        videos.length = 0;


        /* শুধু server-এর uploaded video যোগ হবে */
        uploadedVideos.forEach(video => {

            let embedUrl =
                video.embed_url ||
                video.embedUrl ||
                "";


            /* পুরোনো VCDN /embed/ URL ঠিক করা */
            if (
                embedUrl.includes(
                    "https://embed.vcdn.me/embed/"
                )
            ) {

                embedUrl =
                    embedUrl.replace(
                        "https://embed.vcdn.me/embed/",
                        "https://embed.vcdn.me/"
                    );

            }


            /* VCDN ID থাকলে embed URL তৈরি */
            if (
                !embedUrl &&
                video.vcdn_id
            ) {

                embedUrl =
                    "https://embed.vcdn.me/" +
                    video.vcdn_id;

            }


            videos.push({

                id:
                    "uploaded-" +
                    video.id,

                title:
                    video.title ||
                    "Untitled Video",

                category:
                    video.category ||
                    "Japanese Mom",

                thumbnail:
                    video.thumbnail ||
                    "",

                videoUrl:
                    video.video ||
                    "",

                embedUrl:
                    embedUrl,

                vcdnId:
                    video.vcdn_id ||
                    "",

                views:
                    video.views ||
                    0,

                likes:
                    video.likes ||
                    0,

                users:
                    video.users ||
                    0,

                createdAt:
                    video.createdAt ||
                    video.uploadedAt ||
                    "",

                uploaded:
                    true

            });

        });


        /* নতুন upload আগে দেখাবে */
        videos.sort(
            (a, b) => {

                const dateA =
                    new Date(a.createdAt || 0)
                        .getTime();

                const dateB =
                    new Date(b.createdAt || 0)
                        .getTime();

                return dateB - dateA;

            }
        );


        currentPage = 1;

        renderVideos();


    } catch (error) {

        console.error(
            "Video loading error:",
            error
        );


        const grid =
            document.getElementById(
                "videoGrid"
            );


        if (grid) {

            grid.innerHTML = `

                <div style="
                    width:100%;
                    padding:40px;
                    text-align:center;
                    color:#888;
                    grid-column:1/-1;
                ">

                    এখনো কোনো video upload করা হয়নি।

                </div>

            `;

            updatePagination(1, 1);

        }

    }

}


/* =========================================
   FORMAT NUMBER
========================================= */

function formatNumber(number) {

    number =
        Number(number) || 0;


    if (number >= 1000000) {

        return (
            (number / 1000000)
                .toFixed(1)
                .replace(".0", "")
            + "M"
        );

    }


    if (number >= 1000) {

        return (
            (number / 1000)
                .toFixed(1)
                .replace(".0", "")
            + "K"
        );

    }


    return number.toString();

}


/* =========================================
   RENDER VIDEOS
========================================= */

function renderVideos() {

    const grid =
        document.getElementById("videoGrid");


    if (!grid) {
        return;
    }


    grid.innerHTML = "";


    const filtered =
        videos.filter(
            video =>
                video.category === currentCategory
        );


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                filtered.length /
                VIDEOS_PER_PAGE
            )
        );


    if (filtered.length === 0) {

        grid.innerHTML = `

            <div style="
                width:100%;
                padding:50px 20px;
                text-align:center;
                color:#777;
                grid-column:1/-1;
            ">

                এই category-তে এখনো কোনো video upload করা হয়নি।

            </div>

        `;


        updatePagination(1, 1);


        const categoryTitle =
            document.getElementById(
                "categoryTitle"
            );


        if (categoryTitle) {

            categoryTitle.textContent =
                currentCategory;

        }


        return;

    }


    if (currentPage > totalPages) {

        currentPage =
            totalPages;

    }


    const start =
        (currentPage - 1) *
        VIDEOS_PER_PAGE;


    const end =
        start +
        VIDEOS_PER_PAGE;


    const pageVideos =
        filtered.slice(
            start,
            end
        );


    pageVideos.forEach(video => {

        const card =
            document.createElement("div");


        card.className =
            "video-card";


        card.innerHTML = `

            <div class="thumbnail-wrap">

                <img
                    class="thumbnail"
                    src="${escapeHTML(video.thumbnail)}"
                    loading="lazy"
                    alt="${escapeHTML(video.title)}"
                >

                <div class="play-button">
                    ▶
                </div>

            </div>


            <div class="card-body">

                <div class="video-title">
                    ${escapeHTML(video.title)}
                </div>


                <div class="video-category">
                    ${escapeHTML(video.category)}
                </div>


                <div class="card-stats">

                    <span>
                        👁 ${formatNumber(video.views)}
                    </span>

                    <span>
                        ♥ ${formatNumber(video.likes)}
                    </span>

                </div>

            </div>

        `;


        card.onclick = function () {

            openVideo(video);

        };


        grid.appendChild(card);

    });


    updatePagination(
        currentPage,
        totalPages
    );


    const categoryTitle =
        document.getElementById(
            "categoryTitle"
        );


    if (categoryTitle) {

        categoryTitle.textContent =
            currentCategory;

    }

}


/* =========================================
   PAGINATION
========================================= */

function updatePagination(
    page,
    totalPages
) {

    const pageNumber =
        document.getElementById(
            "pageNumber"
        );


    if (pageNumber) {

        pageNumber.textContent =
            `Page ${page} / ${totalPages}`;

    }


    const prevBtn =
        document.getElementById(
            "prevBtn"
        );


    if (prevBtn) {

        prevBtn.disabled =
            page <= 1;

    }


    const nextBtn =
        document.getElementById(
            "nextBtn"
        );


    if (nextBtn) {

        nextBtn.disabled =
            page >= totalPages;

    }

}


/* =========================================
   CATEGORY
========================================= */

function showCategory(
    category,
    button
) {

    currentCategory =
        category;


    currentPage =
        1;


    document
        .querySelectorAll(".category")
        .forEach(btn => {

            btn.classList.remove(
                "active"
            );

        });


    if (button) {

        button.classList.add(
            "active"
        );

    }


    renderVideos();

}


/* =========================================
   NEXT PAGE
========================================= */

function nextPage() {

    const filtered =
        videos.filter(
            video =>
                video.category === currentCategory
        );


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                filtered.length /
                VIDEOS_PER_PAGE
            )
        );


    if (currentPage < totalPages) {

        currentPage++;

        renderVideos();

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }

}


/* =========================================
   PREVIOUS PAGE
========================================= */

function previousPage() {

    if (currentPage > 1) {

        currentPage--;

        renderVideos();

        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }

}


/* =========================================
   OPEN VIDEO
   SUPPORT VCDN
========================================= */

function openVideo(video) {

    /*
       VCDN video হলে videoUrl খালি থাকতে পারে।
       তাই videoUrl অথবা embedUrl অথবা vcdnId
       যেকোনো একটি থাকলেই watch page খুলবে।
    */

    if (
        !video.videoUrl &&
        !video.embedUrl &&
        !video.vcdnId
    ) {

        alert(
            "এই video-টির কোনো playable video পাওয়া যায়নি।"
        );

        return;

    }


    window.location.href =
        "watch.html?id=" +
        encodeURIComponent(
            video.id
        );

}


/* =========================================
   HTML ESCAPE
========================================= */

function escapeHTML(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================
   START WEBSITE
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadUploadedVideos();

    }
);
