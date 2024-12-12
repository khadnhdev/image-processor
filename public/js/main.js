document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewSection = document.getElementById('previewSection');
    const imagePreview = document.getElementById('imagePreview');
    const originalSize = document.getElementById('originalSize');
    const newWidth = document.getElementById('newWidth');
    const newHeight = document.getElementById('newHeight');
    const keepAspectRatio = document.getElementById('keepAspectRatio');
    const resizeBtn = document.getElementById('resizeBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    let currentFile = null;
    let aspectRatio = 1;
    let originalWidth = 0;
    let originalHeight = 0;
    
    // Thêm biến cho crop area
    const cropArea = document.getElementById('cropArea');
    let isResizing = false;
    let isDragging = false;
    let startX, startY, startWidth, startHeight;
    let startLeft, startTop;
    let activeHandle = null;

    // Xử lý Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        if (files.length > 1) {
            alert('Vui lòng tải lên từng ảnh một.');
            return;
        }

        const file = files[0];
        if (!file.type.match('image.*')) {
            alert('Vui lòng chọn file ảnh (jpg, jpeg, png)');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            currentFile = data.filename;
            imagePreview.src = `/uploads/${data.filename}`;
            originalSize.textContent = `Kích thước gốc: ${data.originalWidth}x${data.originalHeight}px`;
            originalWidth = data.originalWidth;
            originalHeight = data.originalHeight;
            previewSection.classList.remove('d-none');
            showCropArea();
            
            newWidth.value = data.originalWidth;
            newHeight.value = data.originalHeight;
            aspectRatio = data.originalWidth / data.originalHeight;
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Có lỗi xảy ra khi tải ảnh lên');
        });
    }

    // Xử lý giữ tỷ lệ ảnh
    newWidth.addEventListener('input', () => {
        if (keepAspectRatio.checked) {
            newHeight.value = Math.round(newWidth.value / aspectRatio);
        }
    });

    newHeight.addEventListener('input', () => {
        if (keepAspectRatio.checked) {
            newWidth.value = Math.round(newHeight.value * aspectRatio);
        }
    });

    // Xử lý resize ảnh
    resizeBtn.addEventListener('click', () => {
        if (!currentFile) return;

        // Tính toán tỷ lệ crop
        const cropX = cropArea.offsetLeft / imagePreview.offsetWidth;
        const cropY = cropArea.offsetTop / imagePreview.offsetHeight;
        const cropWidth = cropArea.offsetWidth / imagePreview.offsetWidth;
        const cropHeight = cropArea.offsetHeight / imagePreview.offsetHeight;

        fetch('/resize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: currentFile,
                width: newWidth.value,
                height: newHeight.value,
                crop: {
                    x: Math.round(cropX * originalWidth),
                    y: Math.round(cropY * originalHeight),
                    width: Math.round(cropWidth * originalWidth),
                    height: Math.round(cropHeight * originalHeight)
                }
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                imagePreview.src = `/uploads/${data.resizedImage}?t=${Date.now()}`;
                imagePreview.addEventListener('load', () => {
                    const imageWidth = imagePreview.offsetWidth;
                    const imageHeight = imagePreview.offsetHeight;
                    
                    const newLeft = Math.round(cropX * imageWidth);
                    const newTop = Math.round(cropY * imageHeight);
                    const newWidth = Math.round(cropWidth * imageWidth);
                    const newHeight = Math.round(cropHeight * imageHeight);
                    
                    cropArea.style.left = Math.min(newLeft, imageWidth - newWidth) + 'px';
                    cropArea.style.top = Math.min(newTop, imageHeight - newHeight) + 'px';
                    cropArea.style.width = Math.min(newWidth, imageWidth) + 'px';
                    cropArea.style.height = Math.min(newHeight, imageHeight) + 'px';
                }, { once: true });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Có lỗi xảy ra khi thay đổi kích thước ảnh');
        });
    });

    // Xử lý tải xuống ZIP
    downloadBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        const zip = new JSZip();
        const response = await fetch(imagePreview.src);
        const blob = await response.blob();
        
        zip.file('resized-image' + getFileExtension(currentFile), blob);

        zip.generateAsync({type: 'blob'})
            .then(content => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = 'resized-images.zip';
                link.click();
            });
    });

    function getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 1);
    }

    // Xử lý crop area
    cropArea.addEventListener('mousedown', initCrop);

    function initCrop(e) {
        // Kiểm tra xem click có phải vào handle hay không
        const isHandle = e.target.classList.contains('handle');
        // Kiểm tra xem click có phải vào vùng crop border hay không
        const isCropBorder = e.target.classList.contains('crop-border');
        
        if (isHandle) {
            isResizing = true;
            activeHandle = e.target;
        } else if (isCropBorder || e.target === cropArea) {
            isDragging = true;
        }

        startX = e.clientX;
        startY = e.clientY;
        startWidth = cropArea.offsetWidth;
        startHeight = cropArea.offsetHeight;
        startLeft = cropArea.offsetLeft;
        startTop = cropArea.offsetTop;

        document.addEventListener('mousemove', handleCrop);
        document.addEventListener('mouseup', stopCrop);
    }

    function handleCrop(e) {
        e.preventDefault();

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const imageWidth = imagePreview.offsetWidth;
        const imageHeight = imagePreview.offsetHeight;

        if (isDragging) {
            // Di chuyển vùng crop
            const newLeft = startLeft + dx;
            const newTop = startTop + dy;
            
            // Giới hạn trong phạm vi ảnh
            const maxLeft = imageWidth - cropArea.offsetWidth;
            const maxTop = imageHeight - cropArea.offsetHeight;
            
            // Đảm bảo khung không vượt ra ngoài ảnh
            cropArea.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
            cropArea.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
            updateCropDimensions();
        } else if (isResizing) {
            const minSize = 50;
            let newWidth, newHeight;

            if (activeHandle.classList.contains('bottom-right')) {
                // Góc trái trên cố định
                newWidth = Math.min(Math.max(minSize, startWidth + dx), imageWidth - startLeft);
                newHeight = Math.min(Math.max(minSize, startHeight + dy), imageHeight - startTop);
            } else if (activeHandle.classList.contains('bottom-left')) {
                // Góc phải trên cố định
                const right = startLeft + startWidth;
                newWidth = Math.min(Math.max(minSize, startWidth - dx), right);
                newHeight = Math.min(Math.max(minSize, startHeight + dy), imageHeight - startTop);
                cropArea.style.left = Math.min(Math.max(0, right - newWidth), right - minSize) + 'px';
            } else if (activeHandle.classList.contains('top-right')) {
                // Góc trái dưới cố định
                const bottom = startTop + startHeight;
                newWidth = Math.min(Math.max(minSize, startWidth + dx), imageWidth - startLeft);
                newHeight = Math.min(Math.max(minSize, startHeight - dy), bottom);
                cropArea.style.top = Math.min(Math.max(0, bottom - newHeight), bottom - minSize) + 'px';
            } else if (activeHandle.classList.contains('top-left')) {
                // Góc phải dưới cố định
                const right = startLeft + startWidth;
                const bottom = startTop + startHeight;
                newWidth = Math.min(Math.max(minSize, startWidth - dx), right);
                newHeight = Math.min(Math.max(minSize, startHeight - dy), bottom);
                cropArea.style.left = Math.min(Math.max(0, right - newWidth), right - minSize) + 'px';
                cropArea.style.top = Math.min(Math.max(0, bottom - newHeight), bottom - minSize) + 'px';
            }

            // Cập nhật kích thước
            cropArea.style.width = newWidth + 'px';
            cropArea.style.height = newHeight + 'px';
            updateCropDimensions();
        }
    }

    function stopCrop() {
        isResizing = false;
        isDragging = false;
        activeHandle = null;
        document.removeEventListener('mousemove', handleCrop);
        document.removeEventListener('mouseup', stopCrop);
    }

    // Hiển thị crop area khi ảnh được tải
    function showCropArea() {
        cropArea.classList.add('active');
        
        // Đợi ảnh load xong để lấy kích thước chính xác
        imagePreview.addEventListener('load', () => {
            // Tính toán kích thước ban đầu (30% kích thước ảnh)
            const width = Math.round(imagePreview.offsetWidth * 0.3);
            const height = Math.round(imagePreview.offsetHeight * 0.3);
            
            // Tính toán vị trí giữa ảnh
            const left = Math.round((imagePreview.offsetWidth - width) / 2);
            const top = Math.round((imagePreview.offsetHeight - height) / 2);
            
            cropArea.style.width = width + 'px';
            cropArea.style.height = height + 'px';
            cropArea.style.left = left + 'px';
            cropArea.style.top = top + 'px';
        }, { once: true });
    }

    // Thêm hàm cập nhật kích thước
    function updateCropDimensions() {
        // Tính toán kích thước thực tế dựa trên tỷ lệ với ảnh gốc
        const scaleX = originalWidth / imagePreview.offsetWidth;
        const scaleY = originalHeight / imagePreview.offsetHeight;
        
        const realWidth = Math.round(cropArea.offsetWidth * scaleX);
        const realHeight = Math.round(cropArea.offsetHeight * scaleY);
        
        // Cập nhật giá trị input
        newWidth.value = realWidth;
        newHeight.value = realHeight;
        
        // Nếu đang giữ tỷ lệ, cập nhật aspectRatio
        if (keepAspectRatio.checked) {
            aspectRatio = cropArea.offsetWidth / cropArea.offsetHeight;
        }
    }
}); 