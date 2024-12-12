const express = require('express');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs-extra');

const app = express();
const port = process.env.PORT || 3000;

// Đảm bảo thư mục uploads tồn tại
const uploadDir = path.join(__dirname, 'public/uploads');
fs.ensureDirSync(uploadDir);

// Cấu hình multer để xử lý upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Chỉ chấp nhận file ảnh (jpg, jpeg, png)!'));
    }
});

// Cấu hình middleware
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Không có file được tải lên' });
        }

        const imageInfo = await sharp(req.file.path).metadata();
        
        res.json({
            filename: req.file.filename,
            originalWidth: imageInfo.width,
            originalHeight: imageInfo.height
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/resize', async (req, res) => {
    try {
        const { filename, width, height, crop } = req.body;
        const inputPath = path.join(__dirname, 'public/uploads', filename);
        const outputPath = path.join(__dirname, 'public/uploads', `resized-${filename}`);

        let sharpInstance = sharp(inputPath);
        
        // Nếu có thông tin crop, thực hiện crop trước
        if (crop) {
            sharpInstance = sharpInstance.extract({
                left: crop.x,
                top: crop.y,
                width: crop.width,
                height: crop.height
            });
        }

        await sharpInstance
            .resize(parseInt(width), parseInt(height), {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .toFile(outputPath);

        res.json({ success: true, resizedImage: `resized-${filename}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Khởi động server
app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
}); 