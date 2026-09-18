const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// ===============================
// FOLDERS
// ===============================

const videoFolder = path.join(__dirname, "uploads", "videos");
const imageFolder = path.join(__dirname, "uploads", "thumbnails");

fs.mkdirSync(videoFolder, { recursive: true });
fs.mkdirSync(imageFolder, { recursive: true });

// ===============================
// ADMIN LOGIN
// ===============================

// তোমার আগের username/password এই দুই লাইনে রাখবে।
const ADMIN_USERNAME = "tasmiya";
const ADMIN_PASSWORD = "1922006";

// ===============================
// VIDEO DATABASE
// ===============================

const videosFile = path.join(__dirname, "videos.json");

if (!fs.existsSync(videosFile)) {
    fs.writeFileSync(videosFile, "[]", "utf8");
}

// ===============================
// ADMIN SESSIONS
// ===============================

const adminSessions = new Set();

function checkAdmin(req, res, next) {
    const token = req.headers["x-admin-token"];

    if (!token || !adminSessions.has(token)) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized. Admin login required."
        });
    }

    next();
}

// ===============================
// MULTER STORAGE
// ===============================

const storage = multer.diskStorage({
    destination: function (req, file, cb) {

        if (file.fieldname === "video") {
            cb(null, videoFolder);

        } else if (file.fieldname === "thumbnail") {
            cb(null, imageFolder);

        } else {
            cb(new Error("Invalid file type"));
        }
    },

    filename: function (req, file, cb) {

        const ext = path.extname(file.originalname);

        const filename =
            Date.now() +
            "-" +
            crypto.randomBytes(4).toString("hex") +
            ext;

        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024 * 1024
    }
});

// ===============================
// STATIC WEBSITE
// ===============================

app.use(express.json());

app.use(express.static(__dirname));

app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

// ===============================
// ADMIN LOGIN
// ===============================

app.post("/api/admin-login", (req, res) => {

    const { username, password } = req.body;

    if (
        username === ADMIN_USERNAME &&
        password === ADMIN_PASSWORD
    ) {

        const token = crypto.randomBytes(32).toString("hex");

        adminSessions.add(token);

        return res.json({
            success: true,
            token: token,
            message: "Admin login successful."
        });
    }

    res.status(401).json({
        success: false,
        message: "Wrong admin username or password."
    });
});

// ===============================
// ADMIN LOGOUT
// ===============================

app.post("/api/admin-logout", checkAdmin, (req, res) => {

    const token = req.headers["x-admin-token"];

    adminSessions.delete(token);

    res.json({
        success: true,
        message: "Logged out."
    });
});

// ===============================
// UPLOAD VIDEO
// ===============================

app.post(
    "/api/upload",

    checkAdmin,

    upload.fields([
        {
            name: "video",
            maxCount: 1
        },
        {
            name: "thumbnail",
            maxCount: 1
        }
    ]),

    (req, res) => {

        let videoPath = null;
        let thumbnailPath = null;

        try {

            if (
                !req.files ||
                !req.files.video ||
                !req.files.thumbnail
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Video and thumbnail are required."
                });
            }

            const title =
                req.body.title ||
                "Untitled Video";

            const category =
                req.body.category ||
                "Other";

            const videoFile =
                req.files.video[0].filename;

            const thumbnailFile =
                req.files.thumbnail[0].filename;

            videoPath =
                path.join(videoFolder, videoFile);

            thumbnailPath =
                path.join(imageFolder, thumbnailFile);

            const newVideo = {

                id: Date.now().toString(),

                title: title,

                category: category,

                video:
                    "/uploads/videos/" +
                    videoFile,

                thumbnail:
                    "/uploads/thumbnails/" +
                    thumbnailFile,

                uploadedAt:
                    new Date().toISOString()
            };

            let videos = [];

            if (fs.existsSync(videosFile)) {

                const data =
                    fs.readFileSync(
                        videosFile,
                        "utf8"
                    );

                if (data.trim()) {
                    videos = JSON.parse(data);
                }
            }

            videos.unshift(newVideo);

            fs.writeFileSync(
                videosFile,
                JSON.stringify(
                    videos,
                    null,
                    2
                ),
                "utf8"
            );

            console.log("");
            console.log("==============================");
            console.log("NEW VIDEO UPLOADED");
            console.log("==============================");
            console.log("Title:", title);
            console.log("Category:", category);
            console.log("Video:", videoFile);
            console.log("Thumbnail:", thumbnailFile);
            console.log("==============================");
            console.log("");

            res.json({
                success: true,
                message: "Video uploaded successfully!",
                video: newVideo
            });

        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );

            // JSON save fail হলে uploaded files remove করবে
            try {
                if (
                    videoPath &&
                    fs.existsSync(videoPath)
                ) {
                    fs.unlinkSync(videoPath);
                }

                if (
                    thumbnailPath &&
                    fs.existsSync(thumbnailPath)
                ) {
                    fs.unlinkSync(thumbnailPath);
                }
            } catch (cleanupError) {
                console.error(
                    "Cleanup error:",
                    cleanupError
                );
            }

            res.status(500).json({
                success: false,
                message:
                    "Video upload failed."
            });
        }
    }
);

// ===============================
// GET ALL UPLOADED VIDEOS
// ===============================

app.get("/api/videos", (req, res) => {

    try {

        if (!fs.existsSync(videosFile)) {
            return res.json([]);
        }

        const data =
            fs.readFileSync(
                videosFile,
                "utf8"
            );

        if (!data.trim()) {
            return res.json([]);
        }

        const videos =
            JSON.parse(data);

        res.json(videos);

    } catch (error) {

        console.error(
            "LOAD VIDEOS ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Could not load videos."
        });
    }
});

// ===============================
// DELETE VIDEO
// ===============================

app.delete(
    "/api/videos/:id",

    checkAdmin,

    (req, res) => {

        try {

            const videoId =
                req.params.id;

            let videos =
                JSON.parse(
                    fs.readFileSync(
                        videosFile,
                        "utf8"
                    )
                );

            const videoIndex =
                videos.findIndex(
                    video =>
                        video.id === videoId
                );

            if (videoIndex === -1) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Video not found."
                });
            }

            const video =
                videos[videoIndex];

            // ভিডিও file delete
            if (video.video) {

                const videoFile =
                    path.basename(
                        video.video
                    );

                const fullVideoPath =
                    path.join(
                        videoFolder,
                        videoFile
                    );

                if (
                    fs.existsSync(
                        fullVideoPath
                    )
                ) {
                    fs.unlinkSync(
                        fullVideoPath
                    );
                }
            }

            // thumbnail delete
            if (video.thumbnail) {

                const thumbnailFile =
                    path.basename(
                        video.thumbnail
                    );

                const fullThumbnailPath =
                    path.join(
                        imageFolder,
                        thumbnailFile
                    );

                if (
                    fs.existsSync(
                        fullThumbnailPath
                    )
                ) {
                    fs.unlinkSync(
                        fullThumbnailPath
                    );
                }
            }

            // JSON থেকে remove
            videos.splice(
                videoIndex,
                1
            );

            fs.writeFileSync(
                videosFile,
                JSON.stringify(
                    videos,
                    null,
                    2
                ),
                "utf8"
            );

            console.log(
                "Deleted video:",
                video.title
            );

            res.json({
                success: true,
                message:
                    "Video deleted successfully."
            });

        } catch (error) {

            console.error(
                "DELETE ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Could not delete video."
            });
        }
    }
);

// ===============================
// MULTER ERROR HANDLER
// ===============================

app.use(
    (error, req, res, next) => {

        if (
            error instanceof multer.MulterError
        ) {

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                return res.status(413).json({
                    success: false,
                    message:
                        "File is larger than 5 GB."
                });
            }

            return res.status(400).json({
                success: false,
                message:
                    error.message
            });
        }

        if (error) {

            console.error(error);

            return res.status(500).json({
                success: false,
                message:
                    error.message ||
                    "Server error."
            });
        }

        next();
    }
);

// ===============================
// START SERVER
// ===============================

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
            "http://localhost:" + PORT
        );
        console.log(
            "================================="
        );
        console.log("");
    }
);