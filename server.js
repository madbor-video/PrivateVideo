const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// =====================================================
// ADMIN
// =====================================================

const ADMIN_USERNAME = "tasmiya";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "CHANGE_THIS_PASSWORD";

// =====================================================
// NEON DATABASE
// =====================================================

const DATABASE_URL =
    process.env.DATABASE_URL || "";

if (!DATABASE_URL) {
    console.error("DATABASE_URL is missing");
}

const pool = DATABASE_URL
    ? new Pool({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    })
    : null;


// =====================================================
// VCDN
// =====================================================

const VCDN_API_KEY =
    process.env.VCDN_API_KEY || "";

const VCDN_PROJECT_ID =
    process.env.VCDN_PROJECT_ID ||
    "85c1c523-4c65-4324-b77e-6f18e027dbb4";

const VCDN_BASE_URL =
    "https://cdn.vcdn.me";


// =====================================================
// KNOWN VCDN VIDEOS
// =====================================================

const KNOWN_VCDN_VIDEO_IDS = [

    "fc586010-6f5a-4117-b0c2-2fa3d1ff1209",

    "a04320a7-cb4b-482f-ab57-abab85706c86",

    "f958ac98-48e2-4c59-a455-33fed0b90170",

    "d845f70d-e7df-4cd6-8891-0d4cb2037c9e",

    "3d713855-8351-40ce-a483-524e5feed726",

    "9a4dcbb4-8099-4943-9709-a5391e53e402",

    "5a50cf94-e650-432d-9a90-1d9ef02efb21"

];


// =====================================================
// LOCAL DIRECTORIES
// =====================================================

const DATA_DIR =
    path.join(__dirname, "data");

const THUMB_DIR =
    path.join(__dirname, "uploads", "thumbnails");

const TMP_DIR =
    path.join(__dirname, "uploads", "tmp");

const DB_FILE =
    path.join(DATA_DIR, "videos.json");

fs.mkdirSync(DATA_DIR, {
    recursive: true
});

fs.mkdirSync(THUMB_DIR, {
    recursive: true
});

fs.mkdirSync(TMP_DIR, {
    recursive: true
});


// =====================================================
// MULTER
// =====================================================

const upload =
    multer({
        dest: TMP_DIR
    });


// =====================================================
// EXPRESS
// =====================================================

app.use(
    express.json({
        limit: "50mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "50mb"
    })
);

app.use(
    express.static(__dirname)
);


// =====================================================
// OLD JSON DATABASE
// Used only for first-time migration
// =====================================================

function readOldVideos() {

    try {

        if (!fs.existsSync(DB_FILE)) {
            return [];
        }

        const text =
            fs.readFileSync(
                DB_FILE,
                "utf8"
            );

        if (!text.trim()) {
            return [];
        }

        const data =
            JSON.parse(text);

        if (!Array.isArray(data)) {
            return [];
        }

        return data;

    } catch (error) {

        console.error(
            "OLD JSON READ ERROR:",
            error.message
        );

        return [];
    }
}


// =====================================================
// NEON DATABASE INIT
// =====================================================

async function initDatabase() {

    if (!pool) {
        throw new Error(
            "DATABASE_URL is missing"
        );
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT DEFAULT 'Uncategorized',
            thumbnail TEXT DEFAULT '',
            video TEXT DEFAULT '',
            video_url TEXT DEFAULT '',
            embed_url TEXT DEFAULT '',
            playback_url TEXT DEFAULT '',
            vcdn_id TEXT DEFAULT '',
            vcdn_status TEXT DEFAULT '',
            playback_ready BOOLEAN DEFAULT FALSE,
            duration_sec DOUBLE PRECISION DEFAULT 0,
            size_bytes BIGINT DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    console.log(
        "NEON DATABASE: READY"
    );
}


// =====================================================
// CONVERT DB ROW TO WEBSITE OBJECT
// =====================================================

function rowToVideo(row) {

    return {

        id:
            row.id,

        title:
            row.title,

        category:
            row.category ||
            "Uncategorized",

        thumbnail:
            row.thumbnail ||
            "",

        video:
            row.video ||
            "",

        videoUrl:
            row.video_url ||
            "",

        embed_url:
            row.embed_url ||
            "",

        embedUrl:
            row.embed_url ||
            "",

        playback_url:
            row.playback_url ||
            "",

        playbackUrl:
            row.playback_url ||
            "",

        vcdn_id:
            row.vcdn_id ||
            "",

        vcdnId:
            row.vcdn_id ||
            "",

        vcdn_status:
            row.vcdn_status ||
            "",

        playback_ready:
            row.playback_ready === true,

        duration_sec:
            Number(
                row.duration_sec || 0
            ),

        size_bytes:
            Number(
                row.size_bytes || 0
            ),

        createdAt:
            row.created_at
                ? new Date(
                    row.created_at
                ).toISOString()
                : new Date().toISOString()
    };
}


// =====================================================
// GET ALL VIDEOS FROM NEON
// =====================================================

async function getAllVideos() {

    if (!pool) {
        return [];
    }

    const result =
        await pool.query(`
            SELECT *
            FROM videos
            ORDER BY created_at DESC
        `);

    return result.rows.map(
        rowToVideo
    );
}


// =====================================================
// GET ONE VIDEO FROM NEON
// =====================================================

async function getVideoById(id) {

    if (!pool) {
        return null;
    }

    const result =
        await pool.query(
            `
            SELECT *
            FROM videos
            WHERE id = $1
            LIMIT 1
            `,
            [String(id)]
        );

    if (
        result.rows.length === 0
    ) {
        return null;
    }

    return rowToVideo(
        result.rows[0]
    );
}


// =====================================================
// SAVE VIDEO TO NEON
// =====================================================

async function saveVideo(video) {

    if (!pool) {
        throw new Error(
            "DATABASE_URL is missing"
        );
    }

    await pool.query(
        `
        INSERT INTO videos (
            id,
            title,
            category,
            thumbnail,
            video,
            video_url,
            embed_url,
            playback_url,
            vcdn_id,
            vcdn_status,
            playback_ready,
            duration_sec,
            size_bytes,
            created_at
        )

        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14
        )

        ON CONFLICT (id)
        DO UPDATE SET

            title = EXCLUDED.title,

            category =
                EXCLUDED.category,

            thumbnail =
                EXCLUDED.thumbnail,

            video =
                EXCLUDED.video,

            video_url =
                EXCLUDED.video_url,

            embed_url =
                EXCLUDED.embed_url,

            playback_url =
                EXCLUDED.playback_url,

            vcdn_id =
                EXCLUDED.vcdn_id,

            vcdn_status =
                EXCLUDED.vcdn_status,

            playback_ready =
                EXCLUDED.playback_ready,

            duration_sec =
                EXCLUDED.duration_sec,

            size_bytes =
                EXCLUDED.size_bytes
        `,

        [

            String(video.id),

            video.title ||
                "Untitled Video",

            video.category ||
                "Uncategorized",

            video.thumbnail ||
                "",

            video.video ||
                "",

            video.videoUrl ||
                "",

            video.embed_url ||
                video.embedUrl ||
                "",

            video.playback_url ||
                video.playbackUrl ||
                "",

            video.vcdn_id ||
                video.vcdnId ||
                "",

            video.vcdn_status ||
                "",

            video.playback_ready === true,

            Number(
                video.duration_sec || 0
            ),

            Number(
                video.size_bytes || 0
            ),

            video.createdAt
                ? new Date(
                    video.createdAt
                )
                : new Date()
        ]
    );
}


// =====================================================
// DELETE VIDEO FROM NEON
// =====================================================

async function deleteVideoFromDatabase(id) {

    if (!pool) {
        throw new Error(
            "DATABASE_URL is missing"
        );
    }

    await pool.query(
        `
        DELETE FROM videos
        WHERE id = $1
        `,
        [String(id)]
    );
}


// =====================================================
// MIGRATE OLD JSON TO NEON
// =====================================================

async function migrateOldJsonToNeon() {

    if (!pool) {
        return;
    }

    const oldVideos =
        readOldVideos();

    if (
        oldVideos.length === 0
    ) {

        console.log(
            "JSON MIGRATION: NOTHING TO IMPORT"
        );

        return;
    }

    console.log(
        "JSON MIGRATION START:",
        oldVideos.length,
        "videos"
    );

    for (
        const video
        of oldVideos
    ) {

        try {

            await saveVideo(
                video
            );

            console.log(
                "MIGRATED:",
                video.title
            );

        } catch (error) {

            console.error(
                "MIGRATION ERROR:",
                video.id,
                error.message
            );
        }
    }

    console.log(
        "JSON MIGRATION COMPLETE"
    );
}


// =====================================================
// VCDN HEADERS
// =====================================================

function vcdnHeaders() {

    return {

        "X-API-Key":
            VCDN_API_KEY,

        "Authorization":
            `Bearer ${VCDN_API_KEY}`,

        "Content-Type":
            "application/json"
    };
}


// =====================================================
// GET ONE VCDN VIDEO
// =====================================================

async function getVcdnVideo(videoId) {

    if (!VCDN_API_KEY) {

        throw new Error(
            "VCDN_API_KEY is missing"
        );
    }

    const response =
        await fetch(
            `${VCDN_BASE_URL}/api/v1/videos/${videoId}`,
            {
                method: "GET",
                headers: vcdnHeaders()
            }
        );

    const text =
        await response.text();

    let data = {};

    try {

        data =
            JSON.parse(text);

    } catch {

        data = {};
    }

    console.log(
        `VCDN VIDEO ${videoId} STATUS:`,
        response.status
    );

    if (!response.ok) {

        return null;
    }

    return data;
}


// =====================================================
// MAKE WEBSITE VIDEO FROM VCDN
// =====================================================

function makeVideoFromVcdn(
    vcdn,
    oldVideo = null
) {

    if (!vcdn) {
        return null;
    }

    const videoId =
        vcdn.id ||
        vcdn.video_id ||
        vcdn.videoId;

    if (!videoId) {
        return null;
    }

    const embedUrl =
        vcdn.embed_url ||
        vcdn.embedUrl ||
        `https://embed.vcdn.me/${videoId}`;

    const playbackUrl =
        vcdn.legacy_playback_url ||
        vcdn.playback_url ||
        vcdn.playbackUrl ||
        "";

    const thumbnail =
        vcdn.poster_url ||
        vcdn.posterUrl ||
        vcdn.thumbnail_url ||
        vcdn.thumbnailUrl ||
        oldVideo?.thumbnail ||
        "";

    const title =
        vcdn.title ||
        oldVideo?.title ||
        "Untitled Video";

    const category =
        oldVideo?.category ||
        "Uncategorized";

    const createdAt =
        vcdn.created_at ||
        oldVideo?.createdAt ||
        new Date().toISOString();

    return {

        id:
            oldVideo?.id ||
            videoId,

        title,

        category,

        thumbnail,

        video: "",

        videoUrl: "",

        embed_url:
            embedUrl,

        embedUrl:
            embedUrl,

        playback_url:
            playbackUrl,

        playbackUrl:
            playbackUrl,

        vcdn_id:
            videoId,

        vcdnId:
            videoId,

        vcdn_status:
            vcdn.status ||
            "",

        playback_ready:
            vcdn.playback_ready === true,

        duration_sec:
            vcdn.duration_sec ||
            0,

        size_bytes:
            vcdn.size_bytes ||
            0,

        createdAt
    };
}


// =====================================================
// RECOVER VIDEOS FROM VCDN
// =====================================================

async function recoverVideosFromVCDN() {

    console.log("");
    console.log(
        "================================="
    );
    console.log(
        "VCDN VIDEO RECOVERY STARTING"
    );
    console.log(
        "================================="
    );

    if (!VCDN_API_KEY) {

        console.log(
            "VCDN RECOVERY: API KEY MISSING"
        );

        return;
    }

    const oldVideos =
        readOldVideos();

    let recoveredCount = 0;

    for (
        const videoId
        of KNOWN_VCDN_VIDEO_IDS
    ) {

        try {

            const vcdn =
                await getVcdnVideo(
                    videoId
                );

            if (!vcdn) {
                continue;
            }

            if (
                vcdn.project_id &&
                String(vcdn.project_id) !==
                String(VCDN_PROJECT_ID)
            ) {

                console.log(
                    "SKIPPING DIFFERENT PROJECT:",
                    videoId
                );

                continue;
            }

            const oldVideo =
                oldVideos.find(
                    item =>
                        String(
                            item.vcdn_id ||
                            item.vcdnId
                        ) ===
                        String(videoId)
                );

            const websiteVideo =
                makeVideoFromVcdn(
                    vcdn,
                    oldVideo
                );

            if (!websiteVideo) {
                continue;
            }

            await saveVideo(
                websiteVideo
            );

            recoveredCount++;

            console.log(
                "RECOVERED TO NEON:",
                websiteVideo.title
            );

            console.log(
                "EMBED:",
                websiteVideo.embed_url
            );

        } catch (error) {

            console.error(
                "RECOVERY ERROR:",
                videoId,
                error.message
            );
        }
    }

    console.log("");
    console.log(
        "VCDN RECOVERY FINISHED"
    );
    console.log(
        "VCDN VIDEOS RECOVERED:",
        recoveredCount
    );
    console.log(
        "================================="
    );
}


// =====================================================
// LOGIN
// =====================================================

app.post(
    "/api/login",

    (req, res) => {

        const {
            username,
            password
        } = req.body;

        if (
            username ===
            ADMIN_USERNAME &&

            password ===
            ADMIN_PASSWORD
        ) {

            return res.json({
                success: true
            });
        }

        return res.status(401).json({

            success: false,

            message:
                "Invalid username or password"
        });
    }
);


// =====================================================
// GET VIDEOS
// =====================================================

app.get(
    "/api/videos",

    async (req, res) => {

        try {

            const videos =
                await getAllVideos();

            res.setHeader(
                "Cache-Control",
                "no-store, no-cache, must-revalidate"
            );

            return res.json(
                videos
            );

        } catch (error) {

            console.error(
                "GET VIDEOS ERROR:",
                error.message
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to load videos"
            });
        }
    }
);


// =====================================================
// VCDN UPLOAD
// =====================================================

async function uploadVideoToVCDN(
    filePath,
    originalName,
    title
) {

    if (!VCDN_API_KEY) {

        throw new Error(
            "VCDN_API_KEY is missing"
        );
    }

    console.log("");
    console.log(
        "================================="
    );
    console.log(
        "VCDN UPLOAD START"
    );
    console.log(
        "================================="
    );


    // =================================================
    // INIT
    // =================================================

    const initResponse =
        await fetch(
            `${VCDN_BASE_URL}/api/v1/upload/init`,
            {

                method: "POST",

                headers:
                    vcdnHeaders(),

                body:
                    JSON.stringify({

                        filename:
                            originalName,

                        title:
                            title
                    })
            }
        );

    const initText =
        await initResponse.text();

    let initData = {};

    try {

        initData =
            JSON.parse(
                initText
            );

    } catch {

        initData = {};
    }

    console.log(
        "VCDN INIT STATUS:",
        initResponse.status
    );

    if (!initResponse.ok) {

        throw new Error(
            `VCDN init failed: ${initResponse.status} ${initText}`
        );
    }

    const uploadId =
        initData.upload_id ||
        initData.uploadId ||
        initData.id;

    if (!uploadId) {

        throw new Error(
            "VCDN upload ID not found"
        );
    }

    console.log(
        "VCDN UPLOAD ID:",
        uploadId
    );


    // =================================================
    // READ FILE
    // =================================================

    const fileBuffer =
        fs.readFileSync(
            filePath
        );

    const CHUNK_SIZE =
        10 * 1024 * 1024;

    let offset = 0;

    while (
        offset <
        fileBuffer.length
    ) {

        const end =
            Math.min(
                offset +
                CHUNK_SIZE,

                fileBuffer.length
            );

        const chunk =
            fileBuffer.subarray(
                offset,
                end
            );

        const chunkResponse =
            await fetch(

                `${VCDN_BASE_URL}/api/v1/upload/${uploadId}/chunk`,

                {

                    method: "POST",

                    headers: {

                        "X-API-Key":
                            VCDN_API_KEY,

                        "Authorization":
                            `Bearer ${VCDN_API_KEY}`,

                        "Content-Type":
                            "application/octet-stream"
                    },

                    body:
                        chunk
                }
            );

        const chunkText =
            await chunkResponse.text();

        console.log(
            `VCDN CHUNK: ${end}/${fileBuffer.length} STATUS ${chunkResponse.status}`
        );

        if (!chunkResponse.ok) {

            throw new Error(
                `VCDN chunk failed: ${chunkResponse.status} ${chunkText}`
            );
        }

        offset =
            end;
    }


    // =================================================
    // COMPLETE
    // =================================================

    const completeResponse =
        await fetch(

            `${VCDN_BASE_URL}/api/v1/upload/complete`,

            {

                method: "POST",

                headers:
                    vcdnHeaders(),

                body:
                    JSON.stringify({

                        upload_id:
                            uploadId
                    })
            }
        );

    const completeText =
        await completeResponse.text();

    let completeData = {};

    try {

        completeData =
            JSON.parse(
                completeText
            );

    } catch {

        completeData = {};
    }

    console.log(
        "VCDN COMPLETE STATUS:",
        completeResponse.status
    );

    if (!completeResponse.ok) {

        throw new Error(
            `VCDN complete failed: ${completeResponse.status} ${completeText}`
        );
    }

    const videoId =
        completeData.id ||
        completeData.video_id ||
        completeData.videoId;

    const playbackUrl =
        completeData.playback_url ||
        completeData.playbackUrl ||
        "";

    const embedUrl =
        completeData.embed_url ||
        completeData.embedUrl ||
        (
            videoId
                ? `https://embed.vcdn.me/${videoId}`
                : ""
        );

    console.log(
        "VCDN VIDEO ID:",
        videoId
    );

    console.log(
        "VCDN EMBED URL:",
        embedUrl
    );

    return {

        videoId,

        embedUrl,

        playbackUrl,

        raw:
            completeData
    };
}


// =====================================================
// UPLOAD ROUTE
// =====================================================

app.post(

    "/api/upload",

    upload.fields([

        {
            name:
                "video1",

            maxCount:
                1
        },

        {
            name:
                "thumbnail1",

            maxCount:
                1
        }

    ]),

    async (req, res) => {

        let videoTempPath =
            null;

        let thumbnailTempPath =
            null;

        try {

            console.log("");
            console.log(
                "================================="
            );
            console.log(
                "NEW VIDEO UPLOAD"
            );
            console.log(
                "================================="
            );

            const title =
                req.body.title1 ||
                "Untitled Video";

            const category =
                req.body.category1 ||
                "Uncategorized";

            const videoFile =
                req.files?.video1?.[0];

            const thumbnailFile =
                req.files?.thumbnail1?.[0];

            if (!videoFile) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Video file missing"
                });
            }

            videoTempPath =
                videoFile.path;

            if (thumbnailFile) {
                thumbnailTempPath =
                    thumbnailFile.path;
            }


            // =================================================
            // UPLOAD VIDEO TO VCDN
            // =================================================

            const vcdn =
                await uploadVideoToVCDN(

                    videoFile.path,

                    videoFile.originalname,

                    title
                );


            // =================================================
            // THUMBNAIL
            // =================================================

            let thumbnailUrl =
                "";

            if (thumbnailFile) {

                const filename =
                    `${Date.now()}-${thumbnailFile.originalname}`;

                const destination =
                    path.join(
                        THUMB_DIR,
                        filename
                    );

                fs.copyFileSync(
                    thumbnailFile.path,
                    destination
                );

                thumbnailUrl =
                    `/uploads/thumbnails/${filename}`;
            }


            // =================================================
            // SAVE TO NEON
            // =================================================

            const newVideo = {

                id:
                    Date.now().toString(),

                title,

                category,

                thumbnail:
                    thumbnailUrl,

                video: "",

                videoUrl: "",

                embed_url:
                    vcdn.embedUrl,

                embedUrl:
                    vcdn.embedUrl,

                playback_url:
                    vcdn.playbackUrl,

                playbackUrl:
                    vcdn.playbackUrl,

                vcdn_id:
                    vcdn.videoId,

                vcdnId:
                    vcdn.videoId,

                vcdn_status:
                    "processing",

                playback_ready:
                    false,

                duration_sec:
                    0,

                size_bytes:
                    videoFile.size,

                createdAt:
                    new Date().toISOString()
            };

            await saveVideo(
                newVideo
            );


            // =================================================
            // DELETE TEMP FILES
            // =================================================

            try {

                if (
                    videoTempPath &&
                    fs.existsSync(
                        videoTempPath
                    )
                ) {

                    fs.unlinkSync(
                        videoTempPath
                    );
                }

            } catch {}

            try {

                if (
                    thumbnailTempPath &&
                    fs.existsSync(
                        thumbnailTempPath
                    )
                ) {

                    fs.unlinkSync(
                        thumbnailTempPath
                    );
                }

            } catch {}


            // =================================================
            // ADD RUNTIME ID
            // =================================================

            if (
                vcdn.videoId &&
                !KNOWN_VCDN_VIDEO_IDS.includes(
                    vcdn.videoId
                )
            ) {

                KNOWN_VCDN_VIDEO_IDS.push(
                    vcdn.videoId
                );
            }


            console.log(
                "VIDEO SAVED TO NEON:",
                newVideo.id
            );

            console.log(
                "VCDN ID:",
                newVideo.vcdn_id
            );

            console.log(
                "EMBED:",
                newVideo.embed_url
            );

            return res.json({

                success: true,

                video:
                    newVideo
            });

        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );

            try {

                if (
                    videoTempPath &&
                    fs.existsSync(
                        videoTempPath
                    )
                ) {

                    fs.unlinkSync(
                        videoTempPath
                    );
                }

            } catch {}

            try {

                if (
                    thumbnailTempPath &&
                    fs.existsSync(
                        thumbnailTempPath
                    )
                ) {

                    fs.unlinkSync(
                        thumbnailTempPath
                    );
                }

            } catch {}

            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Upload failed"
            });
        }
    }
);


// =====================================================
// DELETE VIDEO
// =====================================================

app.post(

    "/api/delete",

    async (req, res) => {

        try {

            const id =
                req.body.id ||
                req.body.videoId;

            if (!id) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Video ID missing"
                });
            }

            const video =
                await getVideoById(
                    id
                );

            if (!video) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Video not found"
                });
            }


            // =================================================
            // DELETE FROM VCDN
            // =================================================

            const vcdnId =
                video.vcdn_id ||
                video.vcdnId;

            if (
                VCDN_API_KEY &&
                vcdnId
            ) {

                try {

                    const response =
                        await fetch(

                            `${VCDN_BASE_URL}/api/v1/videos/${vcdnId}`,

                            {

                                method:
                                    "DELETE",

                                headers:
                                    vcdnHeaders()
                            }
                        );

                    console.log(
                        "VCDN DELETE STATUS:",
                        response.status
                    );

                } catch (
                    deleteError
                ) {

                    console.error(
                        "VCDN DELETE ERROR:",
                        deleteError.message
                    );
                }
            }


            // =================================================
            // DELETE LOCAL THUMBNAIL
            // =================================================

            if (

                video.thumbnail &&

                video.thumbnail.startsWith(
                    "/uploads/thumbnails/"
                )

            ) {

                const thumbnailPath =
                    path.join(
                        __dirname,
                        video.thumbnail
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
                    }

                } catch {}
            }


            // =================================================
            // DELETE FROM NEON
            // =================================================

            await deleteVideoFromDatabase(
                id
            );

            return res.json({

                success:
                    true
            });

        } catch (error) {

            console.error(
                "DELETE ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Delete failed"
            });
        }
    }
);


// =====================================================
// HEALTH
// =====================================================

app.get(
    "/api/health",

    async (req, res) => {

        let databaseStatus =
            "missing";

        if (pool) {

            try {

                await pool.query(
                    "SELECT 1"
                );

                databaseStatus =
                    "connected";

            } catch {

                databaseStatus =
                    "error";
            }
        }

        res.json({

            success:
                true,

            status:
                "online",

            database:
                databaseStatus,

            vcdn:
                VCDN_API_KEY
                    ? "ready"
                    : "missing",

            project:
                VCDN_PROJECT_ID
        });
    }
);


// =====================================================
// HOME
// =====================================================

app.get(
    "/",

    (req, res) => {

        res.sendFile(

            path.join(
                __dirname,
                "index.html"
            )

        );
    }
);


// =====================================================
// START SERVER
// =====================================================

async function startServer() {

    try {

        // -----------------------------------------------
        // DATABASE
        // -----------------------------------------------

        await initDatabase();

        // -----------------------------------------------
        // OLD JSON → NEON
        // -----------------------------------------------

        await migrateOldJsonToNeon();

        // -----------------------------------------------
        // VCDN RECOVERY
        // -----------------------------------------------

        await recoverVideosFromVCDN();

        // -----------------------------------------------
        // START EXPRESS
        // -----------------------------------------------

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
                    "DATABASE:",
                    DATABASE_URL
                        ? "NEON READY"
                        : "MISSING"
                );

                console.log(
                    "VCDN integration:",
                    VCDN_API_KEY
                        ? "READY"
                        : "NOT CONFIGURED"
                );

                console.log(
                    "VCDN Project:",
                    VCDN_PROJECT_ID
                );

                console.log(
                    "================================="
                );
            }
        );

    } catch (error) {

        console.error("");
        console.error(
            "================================="
        );
        console.error(
            "SERVER START ERROR"
        );
        console.error(
            "================================="
        );
        console.error(
            error.message
        );
        console.error(
            "================================="
        );

        process.exit(1);
    }
}

startServer();