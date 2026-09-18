/* =========================================
   ADMIN PANEL JAVASCRIPT
========================================= */


/* =========================================
   HELPER
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

        message.textContent =
            "Username and password দিন।";

        return;
    }


    message.textContent = "Logging in...";


    try {

        const response =
            await fetch("/api/admin-login", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username: username,
                    password: password
                })

            });


        const result =
            await response.json();


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
                result.message || "Invalid username or password.";

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

function adminLogout() {

    const confirmed =
        confirm("আপনি কি Admin Panel থেকে logout করতে চান?");


    if (!confirmed) {
        return;
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


    document.getElementById(
        "selectedCount"
    ).textContent = "0 video selected";


    const dashboardSelected =
        document.getElementById("dashboardSelected");


    if (dashboardSelected) {

        dashboardSelected.textContent = "0";

    }

}


/* =========================================
   UPLOAD VIDEO
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
            async function (e) {

                e.preventDefault();


                const title =
                    document.getElementById(
                        "title"
                    ).value.trim();


                const category =
                    document.getElementById(
                        "category"
                    ).value;


                const video =
                    document.getElementById(
                        "video"
                    ).files[0];


                const thumbnail =
                    document.getElementById(
                        "thumbnail"
                    ).files[0];


                const message =
                    document.getElementById(
                        "uploadMessage"
                    );


                const token =
                    getAdminToken();


                /* -------------------------
                   CHECK LOGIN
                ------------------------- */

                if (!token) {

                    message.textContent =
                        "Admin login required.";

                    return;

                }


                /* -------------------------
                   CHECK TITLE
                ------------------------- */

                if (!title) {

                    message.textContent =
                        "Video title দিন।";

                    return;

                }


                /* -------------------------
                   CHECK CATEGORY
                ------------------------- */

                if (!category) {

                    message.textContent =
                        "Video category select করুন।";

                    return;

                }


                /* -------------------------
                   CHECK FILES
                ------------------------- */

                if (!video) {

                    message.textContent =
                        "Video file select করুন।";

                    return;

                }


                if (!thumbnail) {

                    message.textContent =
                        "Thumbnail select করুন।";

                    return;

                }


                /* -------------------------
                   FILE TYPE CHECK
                ------------------------- */

                if (
                    !video.type.startsWith("video/")
                ) {

                    message.textContent =
                        "শুধু video file upload করুন।";

                    return;

                }


                if (
                    !thumbnail.type.startsWith("image/")
                ) {

                    message.textContent =
                        "শুধু image thumbnail upload করুন।";

                    return;

                }


                /* -------------------------
                   FORM DATA
                ------------------------- */

                const formData =
                    new FormData();


                formData.append(
                    "title",
                    title
                );


                formData.append(
                    "category",
                    category
                );


                formData.append(
                    "video",
                    video
                );


                formData.append(
                    "thumbnail",
                    thumbnail
                );


                /* -------------------------
                   UPLOAD START
                ------------------------- */

                message.textContent =
                    "Uploading video... Please wait.";


                const uploadButton =
                    uploadForm.querySelector(
                        ".upload-btn"
                    );


                if (uploadButton) {

                    uploadButton.disabled = true;

                    uploadButton.textContent =
                        "⏳ Uploading...";

                }


                try {

                    const response =
                        await fetch(
                            "/api/upload",
                            {

                                method: "POST",

                                headers: {

                                    "x-admin-token":
                                        token

                                },

                                body: formData

                            }
                        );


                    /*
                     * Server may return
                     * non-JSON error
                     */

                    let result;


                    try {

                        result =
                            await response.json();

                    } catch {

                        result = {
                            success: false,
                            message:
                                "Server returned an invalid response."
                        };

                    }


                    if (
                        response.status === 401 ||
                        response.status === 403
                    ) {

                        sessionStorage.removeItem(
                            "adminToken"
                        );


                        message.textContent =
                            "Admin session expired. Please login again.";


                        document.getElementById(
                            "uploadPanel"
                        ).style.display = "none";


                        document.getElementById(
                            "adminLogin"
                        ).style.display = "flex";


                        return;

                    }


                    message.textContent =
                        result.message ||
                        (
                            result.success
                                ? "Video uploaded successfully."
                                : "Upload failed."
                        );


                    if (result.success) {

                        /*
                         * Reset form
                         */

                        uploadForm.reset();


                        /*
                         * Reload admin video list
                         */

                        await loadAdminVideos();


                        /*
                         * Show success message
                         */

                        message.textContent =
                            "✅ Video uploaded successfully!";

                    }


                } catch (error) {

                    console.error(
                        "Upload error:",
                        error
                    );


                    message.textContent =
                        "❌ Upload failed. Check server connection.";

                } finally {

                    if (uploadButton) {

                        uploadButton.disabled = false;

                        uploadButton.textContent =
                            "⬆️ Upload Video";

                    }

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


    /*
     * Loading UI
     */

    list.innerHTML = `
        <div class="loading-box">
            <div class="loader"></div>
            <p>Loading uploaded videos...</p>
        </div>
    `;


    try {

        const response =
            await fetch(
                "/api/videos"
            );


        if (!response.ok) {

            throw new Error(
                "Failed to load videos"
            );

        }


        const videos =
            await response.json();


        /*
         * Reset Select All
         */

        const selectAll =
            document.getElementById(
                "selectAllVideos"
            );


        if (selectAll) {

            selectAll.checked = false;

        }


        /*
         * Clear list
         */

        list.innerHTML = "";


        /*
         * Update total uploaded
         */

        updateTotalUploaded(
            Array.isArray(videos)
                ? videos.length
                : 0
        );


        /*
         * Reset selected counter
         */

        updateSelectedCount();


        /*
         * No videos
         */

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


        /*
         * Render videos
         */

        videos.forEach(
            function (video) {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "admin-video-item";


                /*
                 * Safe values
                 */

                const videoId =
                    escapeHTML(
                        video.id || ""
                    );


                const title =
                    escapeHTML(
                        video.title || "Untitled Video"
                    );


                const category =
                    escapeHTML(
                        video.category || "Uncategorized"
                    );


                const thumbnail =
                    escapeHTML(
                        video.thumbnail || ""
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


                list.appendChild(
                    item
                );

            }
        );


        /*
         * Make sure selected count
         * starts from zero
         */

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
   TOTAL UPLOADED COUNTER
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


    /*
     * Dashboard selected counter
     */

    const dashboardSelected =
        document.getElementById(
            "dashboardSelected"
        );


    if (dashboardSelected) {

        dashboardSelected.textContent =
            count;

    }


    /*
     * Automatically update Select All
     */

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
            (
                selected.length ===
                allCheckboxes.length
            );

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


    /*
     * Disable delete button
     */

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


    /*
     * Delete one by one
     */

    for (
        const checkbox of selected
    ) {

        const videoId =
            checkbox.value;


        try {

            const response =
                await fetch(
                    "/api/videos/" +
                    encodeURIComponent(
                        videoId
                    ),
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


    /*
     * Result message
     */

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


    /*
     * Reload list
     */

    await loadAdminVideos();


    /*
     * Enable button again
     */

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