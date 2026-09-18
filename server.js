const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const videoFolder = path.join(__dirname, "uploads", "videos");
const thumbnailFolder = path.join(__dirname, "uploads", "thumbnails");
const videosFile = path.join(__dirname, "videos.json");

fs.mkdirSync(videoFolder, { recursive: true });
fs.mkdirSync(thumbnailFolder, { recursive: true });

if (!fs.existsSync(videosFile)) {
fs.writeFileSync(videosFile, "[]", "utf8");
}

const ADMIN_USERNAME = "tasmiya";
const ADMIN_PASSWORD = "1922006";

const adminSessions = new Set();

function readVideos() {
try {
if (!fs.existsSync(videosFile)) {
return [];
}


    const data = fs.readFileSync(videosFile, "utf8");

    if (!data.trim()) {
        return [];
    }

    const videos = JSON.parse(data);

    return Array.isArray(videos) ? videos : [];
} catch (error) {
    console.error("READ VIDEOS ERROR:", error);
    return [];
}


}

function saveVideos(videos) {
fs.writeFileSync(
videosFile,
JSON.stringify(videos, null, 2),
"utf8"
);
}

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

const storage = multer.diskStorage({
destination: function (req, file, cb) {
if (file.fieldname === "video") {
cb(null, videoFolder);
} else if (file.fieldname === "thumbnail") {
cb(null, thumbnailFolder);
} else {
cb(new Error("Invalid file field."));
}
},


filename: function (req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();

    const filename =
        Date.now() +
        "-" +
        crypto.randomBytes(6).toString("hex") +
        extension;

    cb(null, filename);
}


});

const upload = multer({
storage: storage,
limits: {
fileSize: 5 * 1024 * 1024 * 1024
}
});

app.use(express.json({ limit: "10mb" }));

app.use(express.static(__dirname));

app.use(
"/uploads",
express.static(path.join(__dirname, "uploads"))
);

app.post("/api/admin-login", (req, res) => {
try {
const username = String(req.body.username || "").trim();
const password = String(req.body.password || "");


    if (
        username === ADMIN_USERNAME &&
        password === ADMIN_PASSWORD
    ) {
        const token = crypto.randomBytes(32).toString("hex");

        adminSessions.add(token);

        console.log("ADMIN LOGIN SUCCESS");

        return res.json({
            success: true,
            token: token,
            message: "Admin login successful."
        });
    }

    console.log("ADMIN LOGIN FAILED");

    return res.status(401).json({
        success: false,
        message: "Wrong admin username or password."
    });
} catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
        success: false,
        message: "Login failed."
    });
}


});

app.post("/api/admin-logout", checkAdmin, (req, res) => {
const token = req.headers["x-admin-token"];


adminSessions.delete(token);

res.json({
    success: true,
    message: "Logged out."
});


});

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
let uploadedVideoPath = null;
let uploadedThumbnailPath = null;


    try {
        if (
            !req.files ||
            !req.files.video ||
            !req.files.video[0]
        ) {
            return res.status(400).json({
                success: false,
                message: "Video file is required."
            });
        }

        if (
            !req.files.thumbnail ||
            !req.files.thumbnail[0]
        ) {
            uploadedVideoPath = path.join(
                videoFolder,
                req.files.video[0].filename
            );

            if (fs.existsSync(uploadedVideoPath)) {
                fs.unlinkSync(uploadedVideoPath);
            }

            return res.status(400).json({
                success: false,
                message: "Thumbnail is required."
            });
        }

        const title = String(
            req.body.title || "Untitled Video"
        ).trim();

        const category = String(
            req.body.category || "Other"
        ).trim();

        const videoFile = req.files.video[0];
        const thumbnailFile = req.files.thumbnail[0];

        uploadedVideoPath = path.join(
            videoFolder,
            videoFile.filename
        );

        uploadedThumbnailPath = path.join(
            thumbnailFolder,
            thumbnailFile.filename
        );

        const newVideo = {
            id:
                Date.now().toString() +
                "-" +
                crypto.randomBytes(4).toString("hex"),

            title: title,

            category: category,

            video:
                "/uploads/videos/" +
                videoFile.filename,

            thumbnail:
                "/uploads/thumbnails/" +
                thumbnailFile.filename,

            views: 0,

            likes: 0,

            users: 0,

            uploadedAt: new Date().toISOString()
        };

        const videos = readVideos();

        videos.unshift(newVideo);

        saveVideos(videos);

        console.log("=================================");
        console.log("NEW VIDEO UPLOADED");
        console.log("Title:", newVideo.title);
        console.log("Category:", newVideo.category);
        console.log("Video:", newVideo.video);
        console.log("Thumbnail:", newVideo.thumbnail);
        console.log("=================================");

        return res.json({
            success: true,
            message: "Video uploaded successfully!",
            video: newVideo
        });
    } catch (error) {
        console.error("UPLOAD ERROR:", error);

        try {
            if (
                uploadedVideoPath &&
                fs.existsSync(uploadedVideoPath)
            ) {
                fs.unlinkSync(uploadedVideoPath);
            }

            if (
                uploadedThumbnailPath &&
                fs.existsSync(uploadedThumbnailPath)
            ) {
                fs.unlinkSync(uploadedThumbnailPath);
            }
        } catch (cleanupError) {
            console.error(
                "CLEANUP ERROR:",
                cleanupError
            );
        }

        return res.status(500).json({
            success: false,
            message: "Video upload failed."
        });
    }
}


);

app.get("/api/videos", (req, res) => {
try {
const videos = readVideos();


    res.json(videos);
} catch (error) {
    console.error("GET VIDEOS ERROR:", error);

    res.status(500).json({
        success: false,
        message: "Could not load videos."
    });
}


});

app.get("/api/videos/:id", (req, res) => {
try {
const videoId = String(req.params.id);


    const videos = readVideos();

    const video = videos.find(
        item => String(item.id) === videoId
    );

    if (!video) {
        return res.status(404).json({
            success: false,
            message: "Video not found."
        });
    }

    res.json({
        success: true,
        video: video
    });
} catch (error) {
    console.error("GET SINGLE VIDEO ERROR:", error);

    res.status(500).json({
        success: false,
        message: "Could not load video."
    });
}


});

app.delete("/api/videos/:id", checkAdmin, (req, res) => {
try {
const videoId = String(req.params.id);


    const videos = readVideos();

    const index = videos.findIndex(
        video => String(video.id) === videoId
    );

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Video not found."
        });
    }

    const video = videos[index];

    if (video.video) {
        const videoFilename = path.basename(video.video);

        const videoPath = path.join(
            videoFolder,
            videoFilename
        );

        if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
        }
    }

    if (video.thumbnail) {
        const thumbnailFilename =
            path.basename(video.thumbnail);

        const thumbnailPath = path.join(
            thumbnailFolder,
            thumbnailFilename
        );

        if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
        }
    }

    videos.splice(index, 1);

    saveVideos(videos);

    console.log(
        "VIDEO DELETED:",
        video.title
    );

    res.json({
        success: true,
        message: "Video deleted successfully."
    });
} catch (error) {
    console.error("DELETE ERROR:", error);

    res.status(500).json({
        success: false,
        message: "Could not delete video."
    });
}


});

app.get("/api/video-test/:filename", (req, res) => {
try {
const filename = path.basename(
req.params.filename
);


    const filePath = path.join(
        videoFolder,
        filename
    );

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            message: "Video file not found."
        });
    }

    const stats = fs.statSync(filePath);

    res.json({
        success: true,
        filename: filename,
        size: stats.size
    });
} catch (error) {
    console.error("VIDEO TEST ERROR:", error);

    res.status(500).json({
        success: false,
        message: "Could not test video."
    });
}


});

app.use((error, req, res, next) => {
if (error instanceof multer.MulterError) {
if (error.code === "LIMIT_FILE_SIZE") {
return res.status(413).json({
success: false,
message: "File is larger than 5 GB."
});
}


    return res.status(400).json({
        success: false,
        message: error.message
    });
}

if (error) {
    console.error("SERVER ERROR:", error);

    return res.status(500).json({
        success: false,
        message: error.message || "Server error."
    });
}

next();


});

app.listen(PORT, HOST, () => {
console.log("=================================");
console.log("Video website server is running");
console.log("http://localhost:" + PORT);
console.log("=================================");
});
