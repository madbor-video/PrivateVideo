/* =========================================
ADMIN PANEL JAVASCRIPT
========================================= */

function getAdminToken() {
return sessionStorage.getItem("adminToken");
}

/* =========================================
ADMIN LOGIN
========================================= */

async function adminLogin() {


const username =
    document.getElementById("adminUsername").value.trim();

const password =
    document.getElementById("adminPassword").value;

const message =
    document.getElementById("loginMessage");

if (!username || !password) {
    message.textContent = "Username and password দিন।";
    return;
}

message.textContent = "Logging in...";

try {

    const response = await fetch(
        "/api/admin-login",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        }
    );

    const result = await response.json();

    if (result.success) {

        sessionStorage.setItem(
            "adminToken",
            result.token
        );

        document.getElementById(
            "adminLogin"
        ).style.display = "none";

        document.getElementById(
            "uploadPanel"
        ).style.display = "block";

        message.textContent = "";

        loadAdminVideos();

    } else {

        message.textContent =
            result.message ||
            "Invalid username or password.";
    }

} catch (error) {

    console.error("Login error:", error);

    message.textContent =
        "Server connection failed.";
}


}

/* =========================================
ENTER KEY LOGIN
========================================= */

document.addEventListener(
"keydown",
function (event) {


    if (
        event.key === "Enter" &&
        document.getElementById("adminLogin") &&
        document.getElementById("adminLogin").style.display !== "none"
    ) {
        adminLogin();
    }

}


);

/* =========================================
LOGOUT
========================================= */

async function adminLogout() {


const confirmed = confirm(
    "আপনি কি Admin Panel থেকে logout করতে চান?"
);

if (!confirmed) {
    return;
}

const token = getAdminToken();

try {

    if (token) {

        await fetch(
            "/api/admin-logout",
            {
                method: "POST",
                headers: {
                    "x-admin-token": token
                }
            }
        );
    }

} catch (error) {

    console.error("Logout error:", error);
}

sessionStorage.removeItem("adminToken");

document.getElementById(
    "uploadPanel"
).style.display = "none";

document.getElementById(
    "adminLogin"
).style.display = "flex";

document.getElementById(
    "adminUsername"
).value = "";

document.getElementById(
    "adminPassword"
).value = "";

document.getElementById(
    "loginMessage"
).textContent = "";

updateSelectedCount();


}

/* =========================================
RESET PROGRESS
========================================= */

function resetUploadProgress() {


const bar =
    document.getElementById("progressBar1");

const text =
    document.getElementById("progressText1");

const status =
    document.getElementById("status1");

if (bar) {
    bar.style.width = "0%";
}

if (text) {
    text.textContent = "0%";
}

if (status) {
    status.textContent = "Waiting...";
}


}

/* =========================================
SET PROGRESS
========================================= */

function setUploadProgress(percent, statusText) {


const bar =
    document.getElementById("progressBar1");

const text =
    document.getElementById("progressText1");

const status =
    document.getElementById("status1");

if (bar) {
    bar.style.width = percent + "%";
}

if (text) {
    text.textContent = percent + "%";
}

if (status && statusText) {
    status.textContent = statusText;
}


}

/* =========================================
UPLOAD VIDEO
========================================= */

function uploadVideo(
title,
category,
video,
thumbnail,
token
) {


return new Promise(function (resolve) {

    const formData = new FormData();

    /*
     * IMPORTANT:
     * server.js expects these exact field names
     */

    formData.append(
        "title",
        title
    );

    formData.append(
        "category",
        category
    );

    formData.append(
        "video1",
        video
    );

    formData.append(
        "thumbnail1",
        thumbnail
    );


    const xhr =
        new XMLHttpRequest();


    xhr.open(
        "POST",
        "/api/upload",
        true
    );


    xhr.setRequestHeader(
        "x-admin-token",
        token
    );


    /* =========================
       UPLOAD PROGRESS
    ========================= */

    xhr.upload.addEventListener(
        "progress",
        function (event) {

            if (event.lengthComputable) {

                const percent =
                    Math.round(
                        (
                            event.loaded /
                            event.total
                        ) * 100
                    );

                setUploadProgress(
                    percent,
                    "Uploading to server..."
                );
            }
        }
    );


    /* =========================
       SERVER RESPONSE
    ========================= */

    xhr.addEventListener(
        "load",
        function () {

            let result;

            try {

                result =
                    JSON.parse(
                        xhr.responseText
                    );

            } catch (error) {

                console.error(
                    "Invalid server response:",
                    xhr.responseText
                );

                result = {
                    success: false,
                    message:
                        "Invalid server response."
                };
            }


            if (
                xhr.status === 401 ||
                xhr.status === 403
            ) {

                setUploadProgress(
                    0,
                    "❌ Admin session expired."
                );

                resolve({
                    success: false,
                    sessionExpired: true,
                    message:
                        "Admin session expired."
                });

                return;
            }


            if (
                xhr.status >= 200 &&
                xhr.status < 300 &&
                result.success
            ) {

                setUploadProgress(
                    100,
                    "✅ Uploaded successfully"
                );

                resolve({
                    success: true,
                    video: result.video
                });

                return;
            }


            setUploadProgress(
                0,
                "❌ " +
                (
                    result.message ||
                    "Upload failed."
                )
            );

            resolve({
                success: false,
                message:
                    result.message ||
                    "Upload failed."
            });
        }
    );


    /* =========================
       NETWORK ERROR
    ========================= */

    xhr.addEventListener(
        "error",
        function () {

            setUploadProgress(
                0,
                "❌ Network error"
            );

            resolve({
                success: false,
                message:
                    "Network error."
            });
        }
    );


    /* =========================
       ABORT
    ========================= */

    xhr.addEventListener(
        "abort",
        function () {

            setUploadProgress(
                0,
                "❌ Upload cancelled"
            );

            resolve({
                success: false,
                message:
                    "Upload cancelled."
            });
        }
    );


    setUploadProgress(
        0,
        "Starting upload..."
    );


    xhr.send(formData);
});


}

/* =========================================
SINGLE UPLOAD FORM
========================================= */

document.addEventListener(
"DOMContentLoaded",
function () {


    const uploadForm =
        document.getElementById("uploadForm");

    if (!uploadForm) {
        return;
    }


    uploadForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const message =
                document.getElementById(
                    "uploadMessage"
                );

            const token =
                getAdminToken();


            /* =========================
               CHECK LOGIN
            ========================= */

            if (!token) {

                message.textContent =
                    "Admin login required.";

                return;
            }


            /* =========================
               GET DATA
            ========================= */

            const title =
                document.getElementById(
                    "title1"
                ).value.trim();

            const category =
                document.getElementById(
                    "category1"
                ).value;

            const videoInput =
                document.getElementById(
                    "video1"
                );

            const thumbnailInput =
                document.getElementById(
                    "thumbnail1"
                );

            const video =
                videoInput.files[0];

            const thumbnail =
                thumbnailInput.files[0];


            /* =========================
               VALIDATION
            ========================= */

            if (!title) {

                message.textContent =
                    "Video title দিন.";

                return;
            }

            if (!category) {

                message.textContent =
                    "Category select করুন.";

                return;
            }

            if (!video) {

                message.textContent =
                    "Video file select করুন.";

                return;
            }

            if (!thumbnail) {

                message.textContent =
                    "Thumbnail select করুন.";

                return;
            }

            if (
                !video.type.startsWith("video/")
            ) {

                message.textContent =
                    "Selected fileটি video হতে হবে.";

                return;
            }

            if (
                !thumbnail.type.startsWith("image/")
            ) {

                message.textContent =
                    "Thumbnail image হতে হবে.";

                return;
            }


            /* =========================
               BUTTON
            ========================= */

            const uploadButton =
                uploadForm.querySelector(
                    ".upload-btn"
                );

            if (uploadButton) {

                uploadButton.disabled = true;

                uploadButton.textContent =
                    "⏳ Uploading...";
            }


            message.textContent =
                "Video uploading...";


            resetUploadProgress();


            /* =========================
               UPLOAD
            ========================= */

            const result =
                await uploadVideo(
                    title,
                    category,
                    video,
                    thumbnail,
                    token
                );


            /* =========================
               SESSION EXPIRED
            ========================= */

            if (result.sessionExpired) {

                sessionStorage.removeItem(
                    "adminToken"
                );

                document.getElementById(
                    "uploadPanel"
                ).style.display = "none";

                document.getElementById(
                    "adminLogin"
                ).style.display = "flex";

                message.textContent =
                    "Admin session expired. Please login again.";

                return;
            }


            /* =========================
               SUCCESS
            ========================= */

            if (result.success) {

                message.textContent =
                    "✅ Video successfully uploaded to VCDN!";

                await loadAdminVideos();

                uploadForm.reset();

            } else {

                message.textContent =
                    "❌ " +
                    (
                        result.message ||
                        "Upload failed."
                    );
            }


            /* =========================
               BUTTON RESTORE
            ========================= */

            if (uploadButton) {

                uploadButton.disabled = false;

                uploadButton.textContent =
                    "🚀 Upload Video";
            }

        }
    );
}


);

/* =========================================
LOAD ADMIN VIDEOS
========================================= */

async function loadAdminVideos() {


const list =
    document.getElementById(
        "adminVideoList"
    );

if (!list) {
    return;
}

list.innerHTML = `
    <div class="loading-box">
        <div class="loader"></div>
        <p>Loading uploaded videos...</p>
    </div>
`;


try {

    const response =
        await fetch("/api/videos");


    if (!response.ok) {

        throw new Error(
            "Failed to load videos"
        );
    }


    const videos =
        await response.json();


    const selectAll =
        document.getElementById(
            "selectAllVideos"
        );

    if (selectAll) {
        selectAll.checked = false;
    }


    list.innerHTML = "";


    updateTotalUploaded(
        Array.isArray(videos)
            ? videos.length
            : 0
    );


    updateSelectedCount();


    if (
        !Array.isArray(videos) ||
        videos.length === 0
    ) {

        list.innerHTML = `
            <div class="loading-box">
                <p>📂 No uploaded videos found.</p>
            </div>
        `;

        return;
    }


    videos.forEach(
        function (video) {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "admin-video-item";


            const videoId =
                escapeHTML(
                    video.id || ""
                );

            const title =
                escapeHTML(
                    video.title ||
                    "Untitled Video"
                );

            const category =
                escapeHTML(
                    video.category ||
                    "Uncategorized"
                );

            const thumbnail =
                escapeHTML(
                    video.thumbnail ||
                    ""
                );


            item.innerHTML = `

                <div class="video-select">

                    <input
                        type="checkbox"
                        class="video-checkbox"
                        value="${videoId}"
                        onchange="updateSelectedCount()"
                    >

                </div>

                <img
                    src="${thumbnail}"
                    alt="Video Thumbnail"
                    loading="lazy"
                >

                <div class="admin-video-info">

                    <h3>
                        ${title}
                    </h3>

                    <p>
                        📂 ${category}
                    </p>

                </div>
            `;


            list.appendChild(item);
        }
    );


    updateSelectedCount();


} catch (error) {

    console.error(
        "Load videos error:",
        error
    );

    list.innerHTML = `
        <div class="loading-box">
            <p>❌ Could not load uploaded videos.</p>
            <p>Please check if the server is running.</p>
        </div>
    `;
}


}

/* =========================================
TOTAL UPLOADED
========================================= */

function updateTotalUploaded(count) {


const totalUploaded =
    document.getElementById(
        "totalUploaded"
    );

if (totalUploaded) {

    totalUploaded.textContent =
        count;
}


}

/* =========================================
SELECT ALL
========================================= */

function toggleSelectAll() {


const selectAll =
    document.getElementById(
        "selectAllVideos"
    );

if (!selectAll) {
    return;
}


const checked =
    selectAll.checked;


const checkboxes =
    document.querySelectorAll(
        ".video-checkbox"
    );


checkboxes.forEach(
    function (checkbox) {

        checkbox.checked =
            checked;
    }
);


updateSelectedCount();


}

/* =========================================
SELECTED COUNT
========================================= */

function updateSelectedCount() {


const selected =
    document.querySelectorAll(
        ".video-checkbox:checked"
    );


const count =
    selected.length;


const text =
    document.getElementById(
        "selectedCount"
    );


if (text) {

    text.textContent =
        count +
        (
            count === 1
                ? " video selected"
                : " videos selected"
        );
}


const dashboardSelected =
    document.getElementById(
        "dashboardSelected"
    );


if (dashboardSelected) {

    dashboardSelected.textContent =
        count;
}


const allCheckboxes =
    document.querySelectorAll(
        ".video-checkbox"
    );


const selectAll =
    document.getElementById(
        "selectAllVideos"
    );


if (
    selectAll &&
    allCheckboxes.length > 0
) {

    selectAll.checked =
        selected.length ===
        allCheckboxes.length;

} else if (selectAll) {

    selectAll.checked = false;
}


}

/* =========================================
DELETE SELECTED VIDEOS
========================================= */

async function deleteSelectedVideos() {


const selected =
    document.querySelectorAll(
        ".video-checkbox:checked"
    );


if (selected.length === 0) {

    alert(
        "আগে যে video delete করতে চান সেটি select করুন।"
    );

    return;
}


const count =
    selected.length;


const confirmed =
    confirm(
        count +
        " টি video permanently delete করতে চান?\n\n" +
        "এই action undo করা যাবে না।"
    );


if (!confirmed) {
    return;
}


const token =
    getAdminToken();


if (!token) {

    alert(
        "Admin session নেই। আবার login করুন।"
    );

    return;
}


const deleteButton =
    document.querySelector(
        ".delete-selected-btn"
    );


if (deleteButton) {

    deleteButton.disabled = true;

    deleteButton.textContent =
        "⏳ Deleting...";
}


let successCount = 0;

let failedCount = 0;


for (const checkbox of selected) {

    const videoId =
        checkbox.value;


    try {

        const response =
            await fetch(
                "/api/videos/" +
                encodeURIComponent(videoId),
                {
                    method: "DELETE",
                    headers: {
                        "x-admin-token":
                            token
                    }
                }
            );


        let result;


        try {

            result =
                await response.json();

        } catch {

            result = {
                success: false
            };
        }


        if (
            response.status === 401 ||
            response.status === 403
        ) {

            sessionStorage.removeItem(
                "adminToken"
            );

            alert(
                "Admin session expired. আবার login করুন।"
            );


            document.getElementById(
                "uploadPanel"
            ).style.display = "none";


            document.getElementById(
                "adminLogin"
            ).style.display = "flex";


            return;
        }


        if (result.success) {

            successCount++;

        } else {

            failedCount++;
        }


    } catch (error) {

        console.error(
            "Delete error:",
            error
        );

        failedCount++;
    }
}


if (failedCount === 0) {

    alert(
        "✅ " +
        successCount +
        " টি video successfully deleted."
    );

} else {

    alert(
        "Deleted: " +
        successCount +
        "\nFailed: " +
        failedCount
    );
}


await loadAdminVideos();


if (deleteButton) {

    deleteButton.disabled = false;

    deleteButton.textContent =
        "🗑️ Delete Selected";
}


}

/* =========================================
HTML ESCAPE
========================================= */

function escapeHTML(value) {


return String(value)

    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");


}

/* =========================================
AUTO LOGIN
========================================= */

document.addEventListener(
"DOMContentLoaded",
function () {


    const token =
        sessionStorage.getItem(
            "adminToken"
        );


    if (token) {

        const login =
            document.getElementById(
                "adminLogin"
            );

        const panel =
            document.getElementById(
                "uploadPanel"
            );


        if (login) {

            login.style.display =
                "none";
        }


        if (panel) {

            panel.style.display =
                "block";
        }


        loadAdminVideos();
    }
}


);
