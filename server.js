const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const ADMIN_USERNAME = "tasmiya";
const ADMIN_PASSWORD = "1922006";

const VCDN_API_KEY = process.env.VCDN_API_KEY;

// =========================================
// DIRECTORIES
// =========================================

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const VIDEO_DIR = path.join(UPLOADS_DIR, "videos");
const THUMBNAIL_DIR = path.join(UPLOADS_DIR, "thumbnails");
const VIDEOS_FILE = path.join(DATA_DIR, "videos.json");

[
    DATA_DIR,
    UPLOADS_DIR,
    VIDEO_DIR,
    THUMBNAIL_DIR
].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

if (!fs.existsSync(VIDEOS_FILE)) {
    fs.writeFileSync(VIDEOS_FILE, "[]", "utf8");
}

// =========================================
// EXPRESS
// =========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

app.use(
    "/uploads",
    express.static(UPLOADS_DIR)
);

// =========================================
// MULTER
// =========================================

const storage = multer.diskStorage({
    destination: function (req, file, cb) {

        if (file.fieldname === "video1") {
            cb(null, VIDEO_DIR);

        } else if (file.fieldname === "thumbnail1") {
            cb(null, THUMBNAIL_DIR);

        } else {
            cb(new Error("Unexpected file field"));
        }
    },

    filename: function (req, file, cb) {

        const ext = path.extname(file.originalname) || "";

        const random = Math.random()
            .toString(36)
            .substring(2, 10);

        cb(
            null,
            `${Date.now()}-${random}${ext}`
        );
    }
});

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024 * 1024
    }
});

// =========================================
// ADMIN SESSIONS
// =========================================

const adminSessions = new Set();

function getAdminToken(req) {
    return req.headers["x-admin-token"] || "";
}

function requireAdmin(req, res, next) {

    const token = getAdminToken(req);

    if (!token || !adminSessions.has(token)) {

        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    next();
}

// =========================================
// VIDEOS DATABASE
// =========================================

function readVideos() {

    try {

        const data = fs.readFileSync(
            VIDEOS_FILE,
            "utf8"
        );

        return JSON.parse(data);

    } catch (error) {

        console.error(
            "Could not read videos.json:",
            error.message
        );

        return [];
    }
}

function saveVideos(videos) {

    fs.writeFileSync(
        VIDEOS_FILE,
        JSON.stringify(videos, null, 2),
        "utf8"
    );
}

// =========================================
// VCDN HEADERS
// =========================================

function getVcdnHeaders(json = false) {

    const headers = {
        "X-API-Key": VCDN_API_KEY,
        "Authorization": `Bearer ${VCDN_API_KEY}`
    };

    if (json) {
        headers["Content-Type"] = "application/json";
    }

    return headers;
}

// =========================================
// READ RESPONSE
// =========================================

async function readResponse(response) {

    const text = await response.text();

    let data = null;

    try {
        data = JSON.parse(text);
    } catch (error) {
        data = null;
    }

    return {
        text,
        data
    };
}

// =========================================
// EXTRACT VCDN DATA
// =========================================

function extractUploadId(data) {

    if (!data) {
        return "";
    }

    return (
        data.upload_id ||
        data.uploadId ||
        data.id ||
        data.data?.upload_id ||
        data.data?.uploadId ||
        data.data?.id ||
        ""
    );
}

function extractVideoId(data) {

    if (!data) {
        return "";
    }

    return (
        data.videoId ||
        data.video_id ||
        data.id ||
        data.data?.videoId ||
        data.data?.video_id ||
        data.data?.id ||
        ""
    );
}

function extractPlaybackUrl(data) {

    if (!data) {
        return "";
    }

    return (
        data.playback_url ||
        data.playbackUrl ||
        data.data?.playback_url ||
        data.data?.playbackUrl ||
        ""
    );
}

function extractEmbedUrl(data) {

    if (!data) {
        return "";
    }

    return (
        data.embed_url ||
        data.embedUrl ||
        data.data?.embed_url ||
        data.data?.embedUrl ||
        ""
    );
}

// =========================================
// UPLOAD VIDEO TO VCDN
// =========================================

async function uploadVideoToVCDN(
    filePath,
    originalName,
    title,
    progressCallback
) {

    if (!VCDN_API_KEY) {

        throw new Error(
            "VCDN_API_KEY is not configured."
        );
    }

    const fileStats = fs.statSync(filePath);

    console.log("");
    console.log("=================================");
    console.log("VCDN: Initializing upload...");
    console.log("File:", originalName);
    console.log("Size:", fileStats.size, "bytes");
    console.log("=================================");

    if (!fileStats.size || fileStats.size <= 0) {

        throw new Error(
            "Video file size is invalid."
        );
    }

    progressCallback(0);

    // =====================================
    // VCDN INIT
    // =====================================

    const initResponse = await fetch(
        "https://cdn.vcdn.me/api/v1/upload/init",
        {
            method: "POST",

            headers: getVcdnHeaders(true),

            body: JSON.stringify({
                filename: originalName,
                title: title,
                size: fileStats.size
            })
        }
    );

    const initResult =
        await readResponse(initResponse);

    console.log(
        "VCDN INIT STATUS:",
        initResponse.status
    );

    console.log(
        "VCDN INIT RESPONSE:",
        initResult.text
    );

    if (!initResponse.ok) {

        throw new Error(
            `VCDN init failed: ${
                initResult.text ||
                initResponse.statusText
            }`
        );
    }

    const uploadId =
        extractUploadId(initResult.data);

    if (!uploadId) {

        throw new Error(
            "VCDN did not return upload_id."
        );
    }

    console.log(
        "VCDN Upload ID:",
        uploadId
    );

    // =====================================
    // CHUNK UPLOAD
    // =====================================

    const chunkSize =
        10 * 1024 * 1024;

    let uploadedBytes = 0;

    const fileHandle =
        await fs.promises.open(
            filePath,
            "r"
        );

    try {

        for (
            let offset = 0;
            offset < fileStats.size;
            offset += chunkSize
        ) {

            const currentChunkSize =
                Math.min(
                    chunkSize,
                    fileStats.size - offset
                );

            const buffer =
                Buffer.allocUnsafe(
                    currentChunkSize
                );

            await fileHandle.read(
                buffer,
                0,
                currentChunkSize,
                offset
            );

            const chunkResponse =
                await fetch(
                    `https://cdn.vcdn.me/api/v1/upload/${uploadId}/chunk`,
                    {
                        method: "POST",

                        headers: {
                            ...getVcdnHeaders(false),

                            "Content-Type":
                                "application/octet-stream",

                            "Content-Length":
                                String(
                                    currentChunkSize
                                )
                        },

                        body: buffer
                    }
                );

            const chunkResult =
                await readResponse(
                    chunkResponse
                );

            if (!chunkResponse.ok) {

                console.error(
                    "VCDN CHUNK STATUS:",
                    chunkResponse.status
                );

                console.error(
                    "VCDN CHUNK RESPONSE:",
                    chunkResult.text
                );

                throw new Error(
                    `VCDN chunk upload failed: ${
                        chunkResult.text ||
                        chunkResponse.statusText
                    }`
                );
            }

            uploadedBytes +=
                currentChunkSize;

            const percent =
                Math.min(
                    99,
                    Math.round(
                        (
                            uploadedBytes /
                            fileStats.size
                        ) * 100
                    )
                );

            progressCallback(percent);

            console.log(
                `VCDN chunk progress: ${percent}%`
            );
        }

    } finally {

        await fileHandle.close();
    }

    // =====================================
    // COMPLETE UPLOAD
    // =====================================

    let completeResponse =
        await fetch(
            "https://cdn.vcdn.me/api/v1/upload/complete",
            {
                method: "POST",

                headers:
                    getVcdnHeaders(true),

                body: JSON.stringify({
                    upload_id: uploadId
                })
            }
        );

    let completeResult =
        await readResponse(
            completeResponse
        );

    console.log(
        "VCDN COMPLETE STATUS:",
        completeResponse.status
    );

    console.log(
        "VCDN COMPLETE RESPONSE:",
        completeResult.text
    );

    // =====================================
    // RETRY WITH uploadId
    // =====================================

    const completeText =
        (
            completeResult.text ||
            ""
        ).toLowerCase();

    if (
        !completeResponse.ok &&
        (
            completeText.includes(
                "uploadid required"
            ) ||
            completeText.includes(
                "upload_id required"
            ) ||
            completeText.includes(
                "uploadid"
            )
        )
    ) {

        console.log(
            "VCDN rejected upload_id."
        );

        console.log(
            "Retrying with uploadId..."
        );

        completeResponse =
            await fetch(
                "https://cdn.vcdn.me/api/v1/upload/complete",
                {
                    method: "POST",

                    headers:
                        getVcdnHeaders(true),

                    body: JSON.stringify({
                        uploadId: uploadId
                    })
                }
            );

        completeResult =
            await readResponse(
                completeResponse
            );

        console.log(
            "VCDN COMPLETE RETRY STATUS:",
            completeResponse.status
        );

        console.log(
            "VCDN COMPLETE RETRY RESPONSE:",
            completeResult.text
        );
    }

    if (!completeResponse.ok) {

        throw new Error(
            `VCDN complete failed: ${
                completeResult.text ||
                completeResponse.statusText
            }`
        );
    }

    // =====================================
    // VCDN RESULT
    // =====================================

    const completeData =
        completeResult.data || {};

    const videoId =
        extractVideoId(completeData);

    const playbackUrl =
        extractPlaybackUrl(completeData);

    let embedUrl =
        extractEmbedUrl(completeData);

    // =====================================
    // FIXED VCDN EMBED URL
    // =====================================

    if (!embedUrl && videoId) {

        embedUrl =
            `https://embed.vcdn.me/${videoId}`;

        console.log(
            "VCDN embed URL created:"
        );

        console.log(embedUrl);
    }

    progressCallback(100);

    console.log("");
    console.log("=================================");
    console.log("VCDN UPLOAD COMPLETE");
    console.log("Video ID:", videoId);
    console.log("Playback URL:", playbackUrl);
    console.log("Embed URL:", embedUrl);
    console.log("=================================");

    return {

        id: videoId,

        videoId: videoId,

        upload_id: uploadId,

        uploadId: uploadId,

        playback_url: playbackUrl,

        embed_url: embedUrl
    };
}

// =========================================
// ADMIN LOGIN
// =========================================

app.post(
    "/api/admin-login",
    (req, res) => {

        const {
            username,
            password
        } = req.body;

        if (
            username === ADMIN_USERNAME &&
            password === ADMIN_PASSWORD
        ) {

            const token =
                `${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(2)}`;

            adminSessions.add(token);

            console.log(
                "ADMIN LOGIN SUCCESS"
            );

            return res.json({

                success: true,

                token: token
            });
        }

        return res.status(401).json({

            success: false,

            message:
                "Invalid username or password"
        });
    }
);

// =========================================
// ADMIN LOGOUT
// =========================================

app.post(
    "/api/admin-logout",
    (req, res) => {

        const token =
            getAdminToken(req);

        if (token) {
            adminSessions.delete(token);
        }

        res.json({
            success: true
        });
    }
);

// =========================================
// UPLOAD VIDEO
// =========================================

app.post(
    "/api/upload",

    requireAdmin,

    upload.fields([
        {
            name: "video1",
            maxCount: 1
        },

        {
            name: "thumbnail1",
            maxCount: 1
        }
    ]),

    async (req, res) => {

        let videoFile = null;
        let thumbnailFile = null;

        try {

            const title =
                String(
                    req.body.title || ""
                ).trim();

            const category =
                String(
                    req.body.category || ""
                ).trim();

            videoFile =
                req.files?.video1?.[0] ||
                null;

            thumbnailFile =
                req.files?.thumbnail1?.[0] ||
                null;

            if (!title) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Video title is required."
                });
            }

            if (!category) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Video category is required."
                });
            }

            if (!videoFile) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Video file is required."
                });
            }

            if (!thumbnailFile) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Thumbnail file is required."
                });
            }

            console.log("");
            console.log(
                "================================="
            );

            console.log(
                "NEW VIDEO UPLOAD"
            );

            console.log(
                "Title:",
                title
            );

            console.log(
                "Category:",
                category
            );

            console.log(
                "File:",
                videoFile.originalname
            );

            console.log(
                "================================="
            );

            // =================================
            // SEND VIDEO TO VCDN
            // =================================

            const vcdnVideo =
                await uploadVideoToVCDN(
                    videoFile.path,
                    videoFile.originalname,
                    title,
                    function (percent) {

                        console.log(
                            `Upload Progress: ${percent}%`
                        );
                    }
                );

            const finalVideoId =
                vcdnVideo.id ||
                vcdnVideo.videoId ||
                "";

            // =================================
            // FIXED EMBED URL
            // =================================

            let finalEmbedUrl =
                vcdnVideo.embed_url ||
                "";

            if (
                !finalEmbedUrl &&
                finalVideoId
            ) {

                finalEmbedUrl =
                    `https://embed.vcdn.me/${finalVideoId}`;
            }

            // =================================
            // SAVE DATABASE
            // =================================

            const videos =
                readVideos();

            const newVideo = {

                id:
                    Date.now().toString(),

                title:
                    title,

                category:
                    category,

                thumbnail:
                    `/uploads/thumbnails/${thumbnailFile.filename}`,

                video:
                    finalEmbedUrl ||
                    vcdnVideo.playback_url ||
                    "",

                playback_url:
                    vcdnVideo.playback_url ||
                    "",

                embed_url:
                    finalEmbedUrl,

                vcdn_id:
                    finalVideoId,

                vcdn_upload_id:
                    vcdnVideo.upload_id ||
                    vcdnVideo.uploadId ||
                    "",

                createdAt:
                    new Date().toISOString()
            };

            videos.unshift(newVideo);

            saveVideos(videos);

            // =================================
            // DELETE TEMP VIDEO
            // =================================

            try {

                if (
                    fs.existsSync(
                        videoFile.path
                    )
                ) {

                    fs.unlinkSync(
                        videoFile.path
                    );

                    console.log(
                        "Temporary local video deleted."
                    );
                }

            } catch (deleteError) {

                console.warn(
                    "Could not delete temporary video:",
                    deleteError.message
                );
            }

            console.log("");
            console.log(
                "================================="
            );

            console.log(
                "VIDEO SAVED SUCCESSFULLY"
            );

            console.log(
                "Database ID:",
                newVideo.id
            );

            console.log(
                "VCDN ID:",
                newVideo.vcdn_id
            );

            console.log(
                "Embed URL:",
                newVideo.embed_url
            );

            console.log(
                "================================="
            );

            return res.json({

                success: true,

                message:
                    "Video successfully uploaded to VCDN!",

                video:
                    newVideo
            });

        } catch (error) {

            console.error("");
            console.error(
                "================================="
            );

            console.error(
                "UPLOAD ERROR:",
                error
            );

            console.error(
                "================================="
            );

            // =================================
            // CLEANUP VIDEO
            // =================================

            try {

                if (
                    videoFile &&
                    videoFile.path &&
                    fs.existsSync(
                        videoFile.path
                    )
                ) {

                    fs.unlinkSync(
                        videoFile.path
                    );

                    console.log(
                        "Failed upload temporary video deleted."
                    );
                }

            } catch (cleanupError) {

                console.warn(
                    "Cleanup error:",
                    cleanupError.message
                );
            }

            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Video upload failed."
            });
        }
    }
);

// =========================================
// GET ALL VIDEOS
// =========================================

app.get(
    "/api/videos",
    (req, res) => {

        const videos =
            readVideos();

        res.json(videos);
    }
);

// =========================================
// GET SINGLE VIDEO
// =========================================

app.get(
    "/api/videos/:id",
    (req, res) => {

        const videos =
            readVideos();

        const video =
            videos.find(
                (item) =>
                    item.id ===
                    req.params.id
            );

        if (!video) {

            return res.status(404).json({

                success: false,

                message:
                    "Video not found."
            });
        }

        res.json(video);
    }
);

// =========================================
// DELETE VIDEO
// =========================================

app.delete(
    "/api/videos/:id",

    requireAdmin,

    async (req, res) => {

        try {

            const videos =
                readVideos();

            const index =
                videos.findIndex(
                    (item) =>
                        item.id ===
                        req.params.id
                );

            if (index === -1) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Video not found."
                });
            }

            const video =
                videos[index];

            // =================================
            // DELETE FROM VCDN
            // =================================

            if (
                VCDN_API_KEY &&
                video.vcdn_id
            ) {

                try {

                    const deleteResponse =
                        await fetch(
                            `https://cdn.vcdn.me/api/v1/videos/${video.vcdn_id}`,
                            {
                                method: "DELETE",

                                headers:
                                    getVcdnHeaders(false)
                            }
                        );

                    console.log(
                        "VCDN DELETE STATUS:",
                        deleteResponse.status
                    );

                } catch (
                    vcdnDeleteError
                ) {

                    console.warn(
                        "VCDN delete failed:",
                        vcdnDeleteError.message
                    );
                }
            }

            // =================================
            // DELETE THUMBNAIL
            // =================================

            if (video.thumbnail) {

                const thumbnailRelative =
                    video.thumbnail.replace(
                       (/^\/+/, "")
                    );

                const thumbnailPath =
                    path.join(
                        __dirname,
                        thumbnailRelative
                    );

                try {

                    if (
                        fs.existsSync(
                            thumbnailPath
                        )
                    ) {

                        fs.unlinkSync(
                            thumbnailPath
                        );

                        console.log(
                            "Thumbnail deleted."
                        );
                    }

                } catch (
                    thumbnailError
                ) {

                    console.warn(
                        "Thumbnail delete failed:",
                        thumbnailError.message
                    );
                }
            }

            // =================================
            // REMOVE DATABASE RECORD
            // =================================

            videos.splice(index, 1);

            saveVideos(videos);

            console.log(
                "VIDEO DELETED:",
                video.title
            );

            return res.json({

                success: true,

                message:
                    "Video deleted successfully."
            });

        } catch (error) {

            console.error(
                "Delete error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Delete failed."
            });
        }
    }
);

// =========================================
// VIDEO TEST
// =========================================

app.get(
    "/api/video-test/:filename",
    (req, res) => {

        const filename =
            path.basename(
                req.params.filename
            );

        const filePath =
            path.join(
                VIDEO_DIR,
                filename
            );

        if (
            !fs.existsSync(
                filePath
            )
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "Video file not found."
            });
        }

        res.json({

            success: true,

            file:
                filename,

            size:
                fs.statSync(
                    filePath
                ).size
        });
    }
);

// =========================================
// HEALTH CHECK
// =========================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            server:
                "running",

            vcdn:
                VCDN_API_KEY
                    ? "READY"
                    : "NOT CONFIGURED"
        });
    }
);

// =========================================
// START SERVER
// =========================================

app.listen(
    PORT,
    HOST,
    () => {

        console.log("");

        console.log(
            "================================="
        );

        console.log(
            "Video website server is running"
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            "VCDN integration:",
            VCDN_API_KEY
                ? "READY"
                : "NOT CONFIGURED"
        );

        console.log(
            "================================="
        );
    }
);